import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function revalidatePortalAccess(clientId: string) {
  revalidatePath(`/clientes/${clientId}`)
  revalidatePath('/minha-area', 'layout')
}

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

  revalidatePortalAccess(clientId)
  return NextResponse.json({ success: true, profile_id: profile.id })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!caller || !['super_admin', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sem permissão para redefinir a senha' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  if (password.length < 8) {
    return NextResponse.json({ error: 'A nova senha deve ter no mínimo 8 caracteres' }, { status: 400 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, profile_id')
    .eq('id', clientId)
    .eq('is_active', true)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  if (!client.profile_id) {
    return NextResponse.json({ error: 'Este cliente ainda não possui acesso ao portal' }, { status: 409 })
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('auth_user_id, role, is_active')
    .eq('id', client.profile_id)
    .maybeSingle()

  if (!profile?.auth_user_id || profile.role !== 'cliente' || !profile.is_active) {
    return NextResponse.json({ error: 'O acesso do cliente está incompleto ou inativo' }, { status: 409 })
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    profile.auth_user_id,
    { password },
  )

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  revalidatePortalAccess(clientId)
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
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

  revalidatePortalAccess(clientId)
  return NextResponse.json({ success: true })
}
