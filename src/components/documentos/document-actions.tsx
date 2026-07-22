'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2, RefreshCw, Save, XCircle } from 'lucide-react'
import type { Document, DocumentStatus, Profile } from '@/types/database'

interface Props {
  document: Document
  reviewers: Pick<Profile, 'id' | 'name'>[]
}

export function DocumentActions({ document, reviewers }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    status: document.status,
    visibility: document.visibility ?? 'admin_only',
    reviewResponsibleId: document.review_responsible_id ?? '',
    rejectionReason: document.rejection_reason ?? '',
  })

  async function save(status: DocumentStatus = form.status) {
    setLoading(true)
    setError('')
    const response = await fetch(`/api/documentos/${document.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        visibility: form.visibility,
        reviewResponsibleId: form.reviewResponsibleId || null,
        rejectionReason: form.rejectionReason || null,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setError(result.error ?? 'Não foi possível atualizar o documento.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
        Revisar
      </button>
    )
  }

  return (
    <div className="min-w-64 space-y-2 rounded-xl border border-border bg-card p-3 text-left shadow-lg">
      <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as DocumentStatus }))} className="w-full rounded-lg border border-input px-2 py-1.5 text-xs">
        <option value="pending">Pendente</option>
        <option value="received">Recebido</option>
        <option value="under_review">Em revisão</option>
        <option value="approved">Aprovado</option>
        <option value="rejected">Reprovado</option>
        <option value="resend_required">Reenvio solicitado</option>
      </select>
      <select value={form.reviewResponsibleId} onChange={event => setForm(current => ({ ...current, reviewResponsibleId: event.target.value }))} className="w-full rounded-lg border border-input px-2 py-1.5 text-xs">
        <option value="">Sem revisor definido</option>
        {reviewers.map(reviewer => <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>)}
      </select>
      <select value={form.visibility} onChange={event => setForm(current => ({ ...current, visibility: event.target.value as typeof form.visibility }))} className="w-full rounded-lg border border-input px-2 py-1.5 text-xs">
        <option value="admin_only">Somente equipe</option>
        <option value="client_visible">Visível ao cliente</option>
      </select>
      <textarea value={form.rejectionReason} onChange={event => setForm(current => ({ ...current, rejectionReason: event.target.value }))} placeholder="Motivo de rejeição ou reenvio" className="min-h-16 w-full rounded-lg border border-input px-2 py-1.5 text-xs" maxLength={1000} />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-end gap-1">
        <button type="button" onClick={() => save('approved')} disabled={loading} title="Aprovar" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><CheckCircle className="h-4 w-4" /></button>
        <button type="button" onClick={() => save('rejected')} disabled={loading} title="Reprovar" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4" /></button>
        <button type="button" onClick={() => save('resend_required')} disabled={loading} title="Solicitar reenvio" className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><RefreshCw className="h-4 w-4" /></button>
        <button type="button" onClick={() => save()} disabled={loading} title="Salvar fluxo" className="rounded-lg p-2 text-primary hover:bg-primary/5">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={loading} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><span className="sr-only">Fechar</span>×</button>
      </div>
    </div>
  )
}
