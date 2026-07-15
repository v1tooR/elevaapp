import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data: _r } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
  if (_r?.role !== 'super_admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // "2025-06"

  const now = month ? new Date(month + '-01') : new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() // 0-based

  // 6-month history
  const months: { month: string; label: string; income: number; expense: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const end   = `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}`

    const { data } = await supabase
      .from('finance_entries')
      .select('type, amount')
      .gte('occurred_at', start)
      .lte('occurred_at', end)
      .eq('status', 'CONFIRMED')

    const rows = (data as any[]) ?? []
    months.push({
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: MONTH_LABELS[m],
      income:  rows.filter(r => r.type === 'INCOME').reduce((s, r) => s + Number(r.amount), 0),
      expense: rows.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + Number(r.amount), 0),
    })
  }

  // Category breakdown (expenses current month)
  const currStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
  const currLastDay = new Date(currentYear, currentMonth + 1, 0).getDate()
  const currEnd   = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${currLastDay}`

  const { data: catData } = await supabase
    .from('finance_entries')
    .select('amount, category:finance_categories(id,name,color)')
    .eq('type', 'EXPENSE')
    .gte('occurred_at', currStart)
    .lte('occurred_at', currEnd)

  const catMap = new Map<string, { id: string | null; name: string; color: string | null; total: number }>()
  for (const row of (catData as any[]) ?? []) {
    const key = row.category?.id ?? '__none'
    const existing = catMap.get(key)
    if (existing) {
      existing.total += Number(row.amount)
    } else {
      catMap.set(key, {
        id: row.category?.id ?? null,
        name: row.category?.name ?? 'Sem categoria',
        color: row.category?.color ?? null,
        total: Number(row.amount),
      })
    }
  }

  const totalExpenses = Array.from(catMap.values()).reduce((s, c) => s + c.total, 0)
  const categoryBreakdown = Array.from(catMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(c => ({ ...c, percentage: totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 100) : 0 }))

  // Comparison: current vs previous month
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear  = currentMonth === 0 ? currentYear - 1 : currentYear
  const prevStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`
  const prevLastDay = new Date(prevYear, prevMonth + 1, 0).getDate()
  const prevEnd   = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${prevLastDay}`

  const { data: currRows } = await supabase
    .from('finance_entries').select('type, amount')
    .gte('occurred_at', currStart).lte('occurred_at', currEnd)

  const { data: prevRows } = await supabase
    .from('finance_entries').select('type, amount')
    .gte('occurred_at', prevStart).lte('occurred_at', prevEnd)

  const sum = (rows: any[], t: string) => ((rows ?? []) as any[]).filter(r => r.type === t).reduce((s, r) => s + Number(r.amount), 0)

  // Receivables: process_financials pending/overdue
  const { data: receivables } = await supabase
    .from('process_financials')
    .select('service_value, payment_status, process:processes(id, title, client:clients(id, name))')
    .in('payment_status', ['pending', 'overdue'])

  const totalReceivable = ((receivables as any[]) ?? []).reduce((s, r) => s + Number(r.service_value ?? 0), 0)

  return NextResponse.json({
    months,
    categoryBreakdown,
    comparison: {
      currentIncome:  sum(currRows ?? [], 'INCOME'),
      currentExpense: sum(currRows ?? [], 'EXPENSE'),
      prevIncome:     sum(prevRows ?? [], 'INCOME'),
      prevExpense:    sum(prevRows ?? [], 'EXPENSE'),
    },
    receivables: {
      total: totalReceivable,
      count: ((receivables as any[]) ?? []).length,
      items: ((receivables as any[]) ?? []).slice(0, 5),
    },
  })
}
