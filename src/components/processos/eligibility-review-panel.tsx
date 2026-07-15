'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EligibilityAnalysis } from '@/lib/eligibility'
import type { EligibilityStatus } from '@/types/database'

const STATUS_LABEL: Record<EligibilityStatus, string> = {
  pre_elegivel: 'Pré-elegível',
  pendente_informacoes: 'Pendente de informações',
  requer_validacao: 'Requer validação',
  provavelmente_nao_elegivel: 'Provavelmente não elegível',
  elegibilidade_confirmada: 'Elegibilidade confirmada',
}

interface Props {
  processId: string
  reviewerId: string
  status: EligibilityStatus
  analysis?: EligibilityAnalysis | null
  reviewNotes?: string | null
  reviewedAt?: string | null
}

export function EligibilityReviewPanel({ processId, reviewerId, status, analysis, reviewNotes, reviewedAt }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState(reviewNotes ?? '')
  const [loading, setLoading] = useState<EligibilityStatus | null>(null)
  const [error, setError] = useState('')

  const updateStatus = async (nextStatus: EligibilityStatus) => {
    if (nextStatus === 'elegibilidade_confirmada' && notes.trim().length < 10) {
      setError('Registre a conferência documental e o fundamento antes de confirmar.')
      return
    }
    setLoading(nextStatus)
    setError('')
    const supabase = createClient()
    const reviewed = nextStatus === 'elegibilidade_confirmada'
    const { error: updateError } = await supabase.from('processes').update({
      eligibility_status: nextStatus,
      eligibility_review_notes: notes.trim() || null,
      eligibility_reviewed_at: reviewed ? new Date().toISOString() : null,
      eligibility_reviewed_by: reviewed ? reviewerId : null,
    }).eq('id', processId)

    if (updateError) {
      setError(updateError.message)
      setLoading(null)
      return
    }

    await supabase.from('process_history').insert({
      process_id: processId,
      changed_by: reviewerId,
      action_type: 'updated',
      new_value: nextStatus,
      note: reviewed
        ? 'Elegibilidade confirmada após conferência humana e documental.'
        : 'Elegibilidade devolvida para validação.',
    })

    setLoading(null)
    router.refresh()
  }

  const confirmed = status === 'elegibilidade_confirmada'

  return (
    <div className="anim anim-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-900">Revisão de elegibilidade</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">A triagem automática não confirma o direito ao benefício.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="space-y-4 p-5">
        {analysis && (
          <div className="grid gap-3 sm:grid-cols-2">
            {analysis.missingInformation.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800"><AlertCircle className="h-3.5 w-3.5" /> Pendências</p>
                <ul className="space-y-1">{analysis.missingInformation.map(item => <li key={item} className="text-[11px] leading-relaxed text-amber-800">• {item}</li>)}</ul>
              </div>
            )}
            {analysis.reasons.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-blue-800"><ClipboardCheck className="h-3.5 w-3.5" /> Critérios observados</p>
                <ul className="space-y-1">{analysis.reasons.map(item => <li key={item} className="text-[11px] leading-relaxed text-blue-800">• {item}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Registro da conferência</label>
          <textarea
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Documentos conferidos, regra aplicada e fundamento da decisão..."
            rows={3}
            className="block w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {reviewedAt && confirmed && <p className="text-[10px] text-slate-400">Confirmação registrada em {new Date(reviewedAt).toLocaleString('pt-BR')}.</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {!confirmed ? (
            <button
              type="button"
              onClick={() => updateStatus('elegibilidade_confirmada')}
              disabled={Boolean(loading)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirmar após conferência
            </button>
          ) : (
            <button
              type="button"
              onClick={() => updateStatus('requer_validacao')}
              disabled={Boolean(loading)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reabrir validação
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
