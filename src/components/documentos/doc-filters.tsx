'use client'
import { useRouter } from 'next/navigation'

interface Props {
  clients: { id: string; name: string }[]
  docTypes: { value: string; label: string }[]
  typeFilter: string
  clientFilter: string
  statusFilter: string
}

export function DocFilters({ clients, docTypes, typeFilter, clientFilter, statusFilter }: Props) {
  const router = useRouter()

  const navigate = (overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    const values = { status: statusFilter, type: typeFilter, client_id: clientFilter, ...overrides }
    Object.entries(values).forEach(([k, v]) => { if (v) params.set(k, v) })
    router.push(`/documentos?${params.toString()}`)
  }

  const selectCls = "flex-1 min-w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all dash"

  return (
    <div className="flex gap-3 flex-wrap">
      <select
        value={typeFilter}
        onChange={e => navigate({ type: e.target.value })}
        className={selectCls}
      >
        <option value="">Todos os tipos</option>
        {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <select
        value={clientFilter}
        onChange={e => navigate({ client_id: e.target.value })}
        className={selectCls}
      >
        <option value="">Todos os clientes</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  )
}
