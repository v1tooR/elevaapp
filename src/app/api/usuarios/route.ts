import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const createEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(6).max(128),
  role: z.enum(['admin', 'analista']),
})

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['admin', 'analista']),
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
    return NextResponse.json({ error: 'Funcionário ou função inválida' }, { status: 400 })
  }

  if (payload.data.id === caller.profile.id) {
    return NextResponse.json({ error: 'Você não pode alterar a sua própria função' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: target } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', payload.data.id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
  }

  if (target.role === 'cliente') {
    return NextResponse.json(
      { error: 'A função de clientes deve ser gerenciada no cadastro do cliente' },
      { status: 409 }
    )
  }

  if (target.role === 'super_admin') {
    return NextResponse.json({ error: 'A função de Super Admin não pode ser alterada aqui' }, { status: 403 })
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ role: payload.data.role })
    .eq('id', payload.data.id)

  if (updateError) {
    return NextResponse.json({ error: 'Não foi possível alterar a função' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
