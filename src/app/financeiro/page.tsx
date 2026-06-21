import { createClient } from '@/lib/supabase/server'
import { FinanceiroClient } from '@/components/financeiro/financeiro-client'
import { TrendingUp } from 'lucide-react'

export const metadata = { title: 'Financeiro — Eleva Isenções' }

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function FinanceiroPage() {
  const supabase = await createClient()

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  const monthLabel = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const [{ data: entries }, { data: receivables }] = await Promise.all([
    supabase.from('finance_entries').select('type, amount, status').gte('occurred_at', start).lte('occurred_at', end),
    supabase.from('process_financials').select('service_value').in('payment_status', ['pending', 'overdue']),
  ])

  const rows = (entries ?? []) as { type: string; amount: number; status: string }[]
  const totalIncome     = rows.filter(e => e.type === 'INCOME').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpense    = rows.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + Number(e.amount), 0)
  const balance         = totalIncome - totalExpense
  const overdueCount    = rows.filter(e => e.status === 'OVERDUE').length
  const totalReceivable = ((receivables ?? []) as { service_value: number }[]).reduce((s, r) => s + Number(r.service_value ?? 0), 0)

  const chips = [
    { label: 'Receitas',  value: fmtBRL(totalIncome),     bg: 'rgba(34,197,94,0.15)',   color: '#86efac' },
    { label: 'Despesas',  value: fmtBRL(totalExpense),    bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5' },
    { label: 'Saldo',     value: fmtBRL(balance),         bg: balance >= 0 ? 'rgba(99,102,241,0.15)' : 'rgba(239,68,68,0.18)', color: balance >= 0 ? '#a5b4fc' : '#fca5a5' },
    { label: 'A Receber', value: fmtBRL(totalReceivable), bg: 'rgba(245,158,11,0.15)',  color: '#fcd34d' },
    ...(overdueCount > 0 ? [{ label: 'Em atraso', value: String(overdueCount), bg: 'rgba(239,68,68,0.22)', color: '#f87171' }] : []),
  ]

  return (
    <div className="space-y-5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        .dash { font-family: 'Outfit', sans-serif; }
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-1 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
        .anim-2 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.08s both; }
      `}</style>

      {/* ── Dark emerald banner ── */}
      <div
        className="anim-1 rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #0C1A2E 0%, #14532d 50%, #052e16 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, #22c55e 0%, transparent 60%)' }}
        />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h1 className="dash text-2xl font-bold text-white">Financeiro</h1>
              <p className="dash text-slate-400 text-sm mt-0.5 capitalize">{monthLabel}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mt-4">
            {chips.map(chip => (
              <div
                key={chip.label}
                className="dash flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: chip.bg, border: '1px solid rgba(255,255,255,0.08)', color: chip.color }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{chip.value}</span>
                {chip.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Finance module ── */}
      <div className="anim-2">
        <FinanceiroClient />
      </div>
    </div>
  )
}
