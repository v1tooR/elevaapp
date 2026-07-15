import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: _r } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
  if (_r?.role !== 'super_admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { error } = await supabase.from('finance_categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
