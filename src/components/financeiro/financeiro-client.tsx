'use client'

import dynamic from 'next/dynamic'

const FinanceModule = dynamic(() => import('./finance-module'), {
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  ),
})

export function FinanceiroClient() {
  return <FinanceModule />
}
