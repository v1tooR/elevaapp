'use client'
import { useRouter } from 'next/navigation'

interface Props {
  processTypes: { id: string; name: string }[]
  typeFilter: string
  statusFilter: string
}

export function TypeFilterSelect({ processTypes, typeFilter, statusFilter }: Props) {
  const router = useRouter()

  return (
    <select
      value={typeFilter}
      onChange={e => {
        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        if (e.target.value) params.set('type_id', e.target.value)
        router.push(`/processos?${params.toString()}`)
      }}
      className="flex-1 min-w-45 rounded-xl border border-border px-3 py-2 text-sm bg-muted focus:bg-card focus:border-primary focus:outline-none transition-all dash"
    >
      <option value="">Todos os tipos</option>
      {processTypes.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )
}
