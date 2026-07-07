import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// ONE-TIME USE — delete this file after the admin user is set up
export async function POST(request: Request) {
  const { secret, password } = await request.json()

  if (secret !== process.env.ADMIN_INIT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const email = 'adm@elevaisencoes.com.br'

  // Find the user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  const user = users.find(u => u.email === email)
  if (!user) return NextResponse.json({ error: `User ${email} not found in auth.users` }, { status: 404 })

  // Update password and confirm email via admin API
  const { data, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  })

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Ensure profile exists with correct role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    await supabase.from('profiles').insert({
      auth_user_id: user.id,
      name: 'Administrador',
      email,
      role: 'super_admin',
    })
  } else if (profile.role !== 'super_admin') {
    await supabase.from('profiles').update({ role: 'super_admin' }).eq('auth_user_id', user.id)
  }

  return NextResponse.json({
    ok: true,
    message: 'Admin user configured. Delete this file now.',
    user_id: data.user?.id,
    email: data.user?.email,
    email_confirmed: !!data.user?.email_confirmed_at,
  })
}
