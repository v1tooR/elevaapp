'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, LockKeyhole, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Audience = 'internal' | 'client'

export function ProcessCommunicationForm({ processId }: { processId: string }) {
  const router = useRouter()
  const [audience, setAudience] = useState<Audience>('internal')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setFeedback('')

    const response = await fetch(`/api/processos/${processId}/communications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience, message }),
    })
    const result = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setFeedback(result.error ?? 'Não foi possível registrar a comunicação.')
      return
    }

    setMessage('')
    setFeedback(audience === 'client' ? 'Mensagem enviada ao cliente.' : 'Observação interna registrada.')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAudience('internal')}
          className={`rounded-xl border p-3 text-left transition ${audience === 'internal' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><LockKeyhole className="h-4 w-4 text-amber-600" /> Observação interna</span>
          <span className="mt-1 block text-xs text-slate-500">Somente a equipe poderá visualizar.</span>
        </button>
        <button
          type="button"
          onClick={() => setAudience('client')}
          className={`rounded-xl border p-3 text-left transition ${audience === 'client' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Eye className="h-4 w-4 text-blue-600" /> Mensagem para o cliente</span>
          <span className="mt-1 block text-xs text-slate-500">Fica visível na área do cliente e gera notificação.</span>
        </button>
      </div>
      <Textarea
        label={audience === 'client' ? 'Mensagem para o cliente' : 'Observação interna'}
        value={message}
        onChange={event => setMessage(event.target.value)}
        rows={4}
        maxLength={2000}
        required
      />
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs ${feedback.includes('Não') ? 'text-red-600' : 'text-emerald-600'}`}>{feedback}</p>
        <Button type="submit" disabled={loading || message.trim().length < 2}>
          <Send className="mr-2 h-4 w-4" /> {loading ? 'Registrando...' : audience === 'client' ? 'Enviar ao cliente' : 'Registrar internamente'}
        </Button>
      </div>
    </form>
  )
}
