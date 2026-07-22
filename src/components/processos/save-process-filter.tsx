'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookmarkPlus, X } from 'lucide-react'

export function SaveProcessFilter({ filters }: { filters: Record<string, string> }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const response = await fetch('/api/filtros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), filters }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      setError(result.error ?? 'Não foi possível salvar o filtro.')
      setLoading(false)
      return
    }
    setName('')
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="dash inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
        <BookmarkPlus className="h-4 w-4" /> Salvar filtro
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={name} onChange={event => setName(event.target.value)} placeholder="Nome do filtro" maxLength={60} className="dash rounded-xl border border-input bg-card px-3 py-2 text-xs outline-none focus:border-primary" />
      <button type="button" onClick={save} disabled={loading || !name.trim()} className="dash rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {loading ? 'Salvando...' : 'Confirmar'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Cancelar">
        <X className="h-4 w-4" />
      </button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  )
}
