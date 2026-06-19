import { FinanceiroClient } from '@/components/financeiro/financeiro-client'

export const metadata = { title: 'Financeiro — Eleva Isenções' }

export default function FinanceiroPage() {
  return (
    <div>
      <div className="px-6 pt-6 pb-0">
        <h1 className="text-xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-sm text-slate-500 mt-0.5">Controle de receitas, despesas e fluxo de caixa</p>
      </div>
      <FinanceiroClient />
    </div>
  )
}
