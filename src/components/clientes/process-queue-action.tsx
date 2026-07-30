'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Loader2 } from 'lucide-react'

export function ProcessQueueAction({
  clientId,
  processId,
}: {
  clientId: string
  processId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const prioritize = async () => {
    setLoading(true)
    setError('')

    const response = await fetch(`/api/clientes/${clientId}/processos/prioridade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error ?? 'Não foi possível atualizar a fila.')
      setLoading(false)
      return
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={prioritize}
        disabled={loading}
        className="dash inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <ArrowUp className="h-3 w-3" />}
        Definir como próximo
      </button>
      {error && <p className="dash max-w-44 text-right text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
