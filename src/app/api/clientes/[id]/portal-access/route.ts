import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!caller || !['super_admin', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, profile_id')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  if (client.profile_id) return NextResponse.json({ error: 'Cliente já possui acesso ao portal' }, { status: 409 })

  const adminClient = createAdminClient()

  // Create auth user — the DB trigger handle_new_user fires automatically
  // and inserts the profile row using user_metadata.role
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: client.name, role: 'cliente' },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Fetch the profile that the trigger created (do NOT insert manually)
  const { data: profile, error: profileFetchError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (profileFetchError || !profile) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Perfil não encontrado após criação do usuário' }, { status: 500 })
  }

  const { error: linkError } = await supabase
    .from('clients')
    .update({ profile_id: profile.id })
    .eq('id', clientId)

  if (linkError) {
    return NextResponse.json({ error: 'Acesso criado mas erro ao vincular: ' + linkError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, profile_id: profile.id })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!caller || caller.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super admin pode revogar acesso' }, { status: 403 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, profile_id')
    .eq('id', clientId)
    .single()

  if (!client?.profile_id) {
    return NextResponse.json({ error: 'Cliente não possui acesso ao portal' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('auth_user_id')
    .eq('id', client.profile_id)
    .single()

  await supabase.from('clients').update({ profile_id: null }).eq('id', clientId)

  if (profile?.auth_user_id) {
    const adminClient = createAdminClient()
    await adminClient.from('profiles').delete().eq('id', client.profile_id)
    await adminClient.auth.admin.deleteUser(profile.auth_user_id)
  }

  return NextResponse.json({ success: true })
}
