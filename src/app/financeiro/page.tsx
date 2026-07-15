import { FinanceiroClient } from '@/components/financeiro/financeiro-client'
import { Banknote, ShieldCheck } from 'lucide-react'

export const metadata = { title: 'Financeiro — Eleva Isenções' }

export default function FinanceiroPage() {
  return (
    <div className="space-y-5">
      <section
        className="anim relative overflow-hidden rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #512716 58%, #A14F2A 100%)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #C97A52, transparent 68%)' }}
        />

        <div className="relative flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/10 shadow-sm">
              <Banknote className="h-6 w-6 text-[#E5A27F]" />
            </div>
            <div>
              <p className="dash mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Gestão financeira</p>
              <h1 className="dash text-2xl font-bold text-white">Financeiro</h1>
              <p className="dash mt-1 max-w-xl text-sm text-white/50">
                Acompanhe receitas, despesas, saldos e lançamentos em um só lugar.
              </p>
            </div>
          </div>

          <div className="dash inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/55">
            <ShieldCheck className="h-3.5 w-3.5 text-[#E5A27F]" />
            Acesso exclusivo do Super Admin
          </div>
        </div>
      </section>

      <div className="anim anim-2">
        <FinanceiroClient />
      </div>
    </div>
  )
}
