'use client'

import dynamic from 'next/dynamic'

const FinanceModule = dynamic(() => import('./finance-module'), {
  ssr: false,
  loading: () => (
    <div className="space-y-5" aria-label="Carregando módulo financeiro">
      <div className="h-20 animate-pulse rounded-2xl border border-border bg-white" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-white" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-white lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-white" />
      </div>
    </div>
  ),
})

export function FinanceiroClient() {
  return <FinanceModule />
}
