import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: _role } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
  if (_role?.role !== 'super_admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const month = searchParams.get('month')
  const categoryId = searchParams.get('categoryId')
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  let query = supabase
    .from('finance_entries')
    .select('*, category:finance_categories(id,name,color), process:processes(id,title), client:clients(id,name)')
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)
  if (categoryId === 'none') query = query.is('category_id', null)
  else if (categoryId) query = query.eq('category_id', categoryId)
  if (status) query = query.eq('status', status)
  if (q) query = query.ilike('title', `%${q}%`)

  if (month) {
    const [year, m] = month.split('-')
    const start = `${year}-${m}-01`
    const endDate = new Date(Number(year), Number(m), 0)
    const end = `${year}-${m}-${String(endDate.getDate()).padStart(2, '0')}`
    query = query.gte('occurred_at', start).lte('occurred_at', end)
  }

  const { data: entries, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (entries as any[]) ?? []
  const totalIncome  = rows.filter(e => e.type === 'INCOME').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpense = rows.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + Number(e.amount), 0)

  return NextResponse.json({
    entries: rows,
    summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense, count: rows.length },
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('id, role').eq('auth_user_id', user.id).single()
  if (!profile || (profile as any).role !== 'super_admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json()
  const { type, title, description, amount, occurred_at, category_id, process_id, client_id, status, recurrence } = body

  if (!type || !title || !amount || !occurred_at) {
    return NextResponse.json({ error: 'Campos obrigatórios: type, title, amount, occurred_at' }, { status: 400 })
  }

  const { data, error } = await supabase.from('finance_entries').insert({
    type, title, description: description || null,
    amount: Number(amount),
    occurred_at,
    category_id: category_id || null,
    process_id: process_id || null,
    client_id: client_id || null,
    status: status || 'CONFIRMED',
    recurrence: recurrence || 'NONE',
    created_by: (profile as any).id,
  }).select('*, category:finance_categories(id,name,color)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data }, { status: 201 })
}
