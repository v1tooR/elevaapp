import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const employeeRoleSchema = z.enum(['admin', 'analista'])
const passwordSchema = z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(72)

const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    role: employeeRoleSchema,
    accessMethod: z.enum(['invite', 'password']).default('password'),
    password: passwordSchema.optional(),
    mustChangePassword: z.boolean().default(true),
  })
  .refine(data => data.accessMethod !== 'password' || Boolean(data.password), {
    path: ['password'],
    message: 'Defina a senha de acesso do funcionário',
  })

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  role: employeeRoleSchema,
  password: passwordSchema.optional(),
  mustChangePassword: z.boolean().optional(),
})

const offboardEmployeeSchema = z.object({
  id: z.string().uuid(),
  replacementProfileId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
})

async function getSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado', status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, mfa_required')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile?.is_active || profile.role !== 'super_admin') {
    return { error: 'Apenas o Super Admin pode gerenciar funcionários', status: 403 as const }
  }

  if (profile.mfa_required) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assurance?.currentLevel !== 'aal2') {
      return { error: 'Confirme a autenticação em duas etapas para realizar esta ação.', status: 403 as const }
    }
  }

  return { profile }
}

function employeeTargetError(targetRole: string, targetId: string, callerId: string) {
  if (targetId === callerId) return { error: 'Você não pode alterar a sua própria conta por este fluxo', status: 403 as const }
  if (targetRole === 'cliente') return { error: 'O acesso de clientes deve ser gerenciado no cadastro do cliente', status: 409 as const }
  if (targetRole === 'super_admin') return { error: 'A conta do Super Admin não pode ser alterada aqui', status: 403 as const }
  return null
}

export async function POST(request: Request) {
  const caller = await getSuperAdmin()
  if ('error' in caller) return NextResponse.json({ error: caller.error }, { status: caller.status })

  const payload = createEmployeeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    const issue = payload.error.issues[0]
    return NextResponse.json(
      { error: issue?.message && issue.path[0] === 'password' ? issue.message : 'Preencha nome, e-mail e função corretamente.' },
      { status: 400 },
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  const callbackUrl = new URL('/auth/callback', siteUrl)
  callbackUrl.searchParams.set('next', '/reset-password?first_access=1')

  const usesPassword = payload.data.accessMethod === 'password'
  const adminClient = createAdminClient()
  const { data: authData, error: authError } = usesPassword
    ? await adminClient.auth.admin.createUser({
        email: payload.data.email,
        password: payload.data.password!,
        email_confirm: true,
        user_metadata: { name: payload.data.name, role: payload.data.role },
      })
    : await adminClient.auth.admin.inviteUserByEmail(
        payload.data.email,
        {
          data: { name: payload.data.name, role: payload.data.role },
          redirectTo: callbackUrl.toString(),
        },
      )

  if (authError || !authData?.user) {
    const message = authError?.message ?? 'Não foi possível criar o acesso.'
    const duplicateEmail = /already|registered|exists/i.test(message)
    return NextResponse.json(
      { error: duplicateEmail ? 'Já existe uma conta com este e-mail.' : message },
      { status: duplicateEmail ? 409 : 400 },
    )
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .update({
      name: payload.data.name,
      email: payload.data.email,
      role: payload.data.role,
      is_active: true,
      must_change_password: usesPassword ? payload.data.mustChangePassword : true,
      mfa_required: true,
      invited_at: new Date().toISOString(),
    })
    .eq('auth_user_id', authData.user.id)
    .select('id, name, email, role, invited_at')
    .single()

  if (profileError || !profile) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: usesPassword ? 'O acesso não pôde ser concluído. Tente novamente.' : 'O convite não pôde ser concluído. Tente novamente.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ profile, invited: !usesPassword }, { status: 201 })
}

export async function PATCH(request: Request) {
  const caller = await getSuperAdmin()
  if ('error' in caller) return NextResponse.json({ error: caller.error }, { status: caller.status })

  const payload = updateEmployeeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    const issue = payload.error.issues[0]
    return NextResponse.json(
      { error: issue?.message && issue.path[0] === 'password' ? issue.message : 'Revise nome, e-mail e função do funcionário.' },
      { status: 400 },
    )
  }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, name, email, role, is_active')
    .eq('id', payload.data.id)
    .single()

  if (!target) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
  if (!target.is_active) return NextResponse.json({ error: 'Funcionário inativo não pode ser editado.' }, { status: 409 })
  const targetError = employeeTargetError(target.role, target.id, caller.profile.id)
  if (targetError) return NextResponse.json({ error: targetError.error }, { status: targetError.status })

  const nextName = payload.data.name ?? target.name
  const nextEmail = payload.data.email ?? target.email
  const nextRole = payload.data.role
  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(target.auth_user_id, {
    ...(nextEmail !== target.email ? { email: nextEmail } : {}),
    // Employee access is managed and verified by the Super Admin. This also
    // repairs accounts that were invited previously but never confirmed.
    email_confirm: true,
    ...(payload.data.password ? { password: payload.data.password } : {}),
    user_metadata: { name: nextName, role: nextRole },
  })

  if (authUpdateError) {
    const duplicateEmail = /already|registered|exists/i.test(authUpdateError.message)
    return NextResponse.json({ error: duplicateEmail ? 'Já existe uma conta com este e-mail.' : authUpdateError.message }, { status: duplicateEmail ? 409 : 400 })
  }

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({
      name: nextName,
      email: nextEmail,
      role: nextRole,
      ...(payload.data.password ? { must_change_password: payload.data.mustChangePassword ?? false } : {}),
    })
    .eq('id', payload.data.id)
  if (profileUpdateError) return NextResponse.json({ error: 'O acesso foi atualizado, mas o perfil não pôde ser sincronizado.' }, { status: 500 })

  return NextResponse.json({ success: true, passwordUpdated: Boolean(payload.data.password) })
}

export async function DELETE(request: Request) {
  const caller = await getSuperAdmin()
  if ('error' in caller) return NextResponse.json({ error: caller.error }, { status: caller.status })

  const payload = offboardEmployeeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) return NextResponse.json({ error: 'Informe o funcionário e o destino da operação.' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: target } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, role, is_active')
    .eq('id', payload.data.id)
    .single()

  if (!target) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
  if (!target.is_active) return NextResponse.json({ error: 'Este funcionário já está inativo.' }, { status: 409 })
  const targetError = employeeTargetError(target.role, target.id, caller.profile.id)
  if (targetError) return NextResponse.json({ error: targetError.error }, { status: targetError.status })

  const { data: transfers, error: offboardError } = await adminClient.rpc('offboard_employee', {
    p_employee_profile_id: payload.data.id,
    p_replacement_profile_id: payload.data.replacementProfileId,
    p_performed_by: caller.profile.id,
    p_reason: payload.data.reason || null,
  })
  if (offboardError) return NextResponse.json({ error: offboardError.message }, { status: 400 })

  const { error: banError } = await adminClient.auth.admin.updateUserById(target.auth_user_id, {
    ban_duration: '876000h',
  })
  if (banError) {
    return NextResponse.json({
      success: true,
      transfers,
      warning: 'O funcionário foi inativado e as sessões foram revogadas, mas o bloqueio permanente no provedor de login precisa ser conferido.',
    })
  }

  return NextResponse.json({ success: true, transfers })
}
