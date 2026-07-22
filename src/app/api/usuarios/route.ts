import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const employeeRoleSchema = z.enum(['admin', 'analista'])

const createEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(6).max(128),
  role: employeeRoleSchema,
})

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  password: z.union([z.literal(''), z.string().min(6).max(128)]).optional(),
  role: employeeRoleSchema,
})

const deleteEmployeeSchema = z.object({
  id: z.string().uuid(),
})

async function getSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autorizado', status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Apenas o Super Admin pode gerenciar funcionários', status: 403 as const }
  }

  return { profile }
}

function employeeTargetError(targetRole: string, targetId: string, callerId: string) {
  if (targetId === callerId) {
    return { error: 'Você não pode editar ou excluir a sua própria conta', status: 403 as const }
  }

  if (targetRole === 'cliente') {
    return {
      error: 'O acesso de clientes deve ser gerenciado no cadastro do cliente',
      status: 409 as const,
    }
  }

  if (targetRole === 'super_admin') {
    return { error: 'A conta do Super Admin não pode ser alterada aqui', status: 403 as const }
  }

  return null
}

export async function POST(request: Request) {
  const caller = await getSuperAdmin()
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status })
  }

  const payload = createEmployeeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return NextResponse.json(
      { error: 'Preencha nome, e-mail, senha e função corretamente' },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: payload.data.email,
    password: payload.data.password,
    email_confirm: true,
    user_metadata: {
      name: payload.data.name,
      role: payload.data.role,
    },
  })

  if (authError) {
    const duplicateEmail = authError.message.toLocaleLowerCase().includes('already')
    return NextResponse.json(
      { error: duplicateEmail ? 'Já existe uma conta com este e-mail' : authError.message },
      { status: duplicateEmail ? 409 : 400 }
    )
  }

  // Some Auth configurations can leave an admin-created user pending even when
  // email_confirm is sent during creation. Confirm once more and verify it.
  const { data: confirmedAuth, error: confirmError } = await adminClient.auth.admin.updateUserById(
    authData.user.id,
    { email_confirm: true }
  )

  if (confirmError || !confirmedAuth.user.email_confirmed_at) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: 'Não foi possível confirmar o e-mail do funcionário. Tente novamente.' },
      { status: 500 }
    )
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, name, email, role')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (profileError || !profile) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: 'A conta não pôde ser concluída. Tente novamente.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ profile }, { status: 201 })
}

export async function PATCH(request: Request) {
  const caller = await getSuperAdmin()
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status })
  }

  const payload = updateEmployeeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return NextResponse.json(
      { error: 'Revise nome, e-mail, senha e função do funcionário' },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, name, email, role')
    .eq('id', payload.data.id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
  }

  const targetError = employeeTargetError(target.role, target.id, caller.profile.id)
  if (targetError) {
    return NextResponse.json({ error: targetError.error }, { status: targetError.status })
  }

  const nextName = payload.data.name ?? target.name
  const nextEmail = payload.data.email ?? target.email
  const nextRole = payload.data.role
  const authUpdates: {
    email?: string
    password?: string
    email_confirm: boolean
    user_metadata: { name: string; role: 'admin' | 'analista' }
  } = {
    email_confirm: true,
    user_metadata: { name: nextName, role: nextRole },
  }

  if (nextEmail !== target.email) authUpdates.email = nextEmail
  if (payload.data.password) authUpdates.password = payload.data.password

  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
    target.auth_user_id,
    authUpdates
  )

  if (authUpdateError) {
    const duplicateEmail = authUpdateError.message.toLocaleLowerCase().includes('already')
    return NextResponse.json(
      { error: duplicateEmail ? 'Já existe uma conta com este e-mail' : authUpdateError.message },
      { status: duplicateEmail ? 409 : 400 }
    )
  }

  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ name: nextName, email: nextEmail, role: nextRole })
    .eq('id', payload.data.id)

  if (profileUpdateError) {
    return NextResponse.json(
      { error: 'Os dados de acesso foram atualizados, mas não foi possível atualizar o perfil' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const caller = await getSuperAdmin()
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status })
  }

  const payload = deleteEmployeeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return NextResponse.json({ error: 'Funcionário inválido' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, role')
    .eq('id', payload.data.id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
  }

  const targetError = employeeTargetError(target.role, target.id, caller.profile.id)
  if (targetError) {
    return NextResponse.json({ error: targetError.error }, { status: targetError.status })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(target.auth_user_id)
  if (deleteError) {
    return NextResponse.json(
      { error: 'Não foi possível excluir o funcionário: ' + deleteError.message },
      { status: 500 }
    )
  }

  // profiles.auth_user_id uses ON DELETE CASCADE. Existing operational records
  // keep their history and clear employee references through ON DELETE SET NULL.
  return NextResponse.json({ success: true })
}
