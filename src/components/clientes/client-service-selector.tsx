'use client'

import { useState } from 'react'
import { CheckCircle2, ListPlus, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LEAD_SERVICE_OPTIONS } from '@/lib/lead-eligibility'
import type { LeadIntendedService } from '@/types/database'

export function ClientServiceSelector({
  clientId,
  existingServices,
}: {
  clientId: string
  existingServices: LeadIntendedService[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<LeadIntendedService[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (selected.length === 0) {
      setError('Selecione pelo menos um novo servico.')
      return
    }
    setLoading(true)
    setError('')
    const response = await fetch(`/api/clientes/${clientId}/servicos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services: selected }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(result.error ?? 'Nao foi possivel atualizar o plano.')
      setLoading(false)
      return
    }
    setSelected([])
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="dash text-sm font-bold text-slate-900">Servicos contratados</p>
          <p className="dash mt-0.5 text-xs text-slate-500">Inclua varios servicos sem criar processos automaticamente.</p>
        </div>
        <button type="button" onClick={() => { setOpen(current => !current); setError('') }} className="dash inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700">
          {open ? <X className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
          {open ? 'Fechar' : 'Adicionar servicos'}
        </button>
      </div>
      {open && (
        <div className="mt-4 border-t border-blue-100 pt-4">
          <div className="flex flex-wrap gap-2">
            {LEAD_SERVICE_OPTIONS.map(option => {
              const alreadyExists = existingServices.includes(option.value)
              const checked = alreadyExists || selected.includes(option.value)
              return (
                <label key={option.value} className={`dash inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${alreadyExists ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700' : checked ? 'cursor-pointer border-blue-300 bg-blue-100 text-blue-800' : 'cursor-pointer border-slate-200 bg-white text-slate-600'}`}>
                  <input type="checkbox" disabled={alreadyExists} checked={checked} onChange={() => setSelected(current => current.includes(option.value) ? current.filter(item => item !== option.value) : [...current, option.value])} className="h-3.5 w-3.5 rounded" />
                  {alreadyExists && <CheckCircle2 className="h-3 w-3" />}{option.label}
                </label>
              )
            })}
          </div>
          <p className="dash mt-3 text-[11px] text-slate-500">Servicos ja contratados ficam preservados. Cancelamentos devem ser registrados no fluxo do servico.</p>
          {error && <p className="dash mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button type="button" disabled={loading} onClick={() => void save()} className="dash mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar no plano</button>
        </div>
      )}
    </div>
  )
}
