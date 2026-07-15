'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, RefreshCw, X } from 'lucide-react'

type DocStatus = 'pending' | 'received' | 'under_review' | 'approved' | 'rejected' | 'resend_required'

export function DocumentActions({ document }: { document: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState<DocStatus | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const updateStatus = async (status: DocStatus, extra: Record<string, any> = {}) => {
    setLoading(status)
    const supabase = createClient()
    await supabase.from('documents').update({ status, ...extra }).eq('id', document.id)

    if (document.process_id) {
      const actionMap: Record<DocStatus, string> = {
        approved: 'document_approved', rejected: 'document_rejected',
        resend_required: 'document_rejected', pending: 'updated',
        received: 'document_uploaded', under_review: 'updated',
      }
      await supabase.from('process_history').insert({
        process_id: document.process_id,
        action_type: actionMap[status] ?? 'updated',
        new_value: status,
        note: extra.rejection_reason ? `Reprovado: ${extra.rejection_reason}` : undefined,
      })
    }

    setLoading(null)
    router.refresh()
  }

  if (document.status === 'approved' || document.status === 'rejected') {
    return (
      <span className="text-xs text-slate-400 dash">
        {document.status === 'approved'
          ? <span className="text-emerald-600 font-semibold">Aprovado</span>
          : <span className="text-red-500 font-semibold" title={document.rejection_reason ?? ''}>Reprovado</span>
        }
      </span>
    )
  }

  return (
    <>
      {showRejectModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ animation: 'modalIn 0.18s ease-out both' }}
          >
            <style>{`@keyframes modalIn { from { opacity:0; transform: scale(0.96) translateY(6px); } to { opacity:1; transform: scale(1) translateY(0); } }`}</style>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: 'linear-gradient(135deg, #450a0a, #991b1b)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="dash text-white font-bold">Reprovar Documento</h3>
                <p className="dash text-red-300/70 text-xs mt-0.5 truncate max-w-55">{document.file_name}</p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dash">Motivo da reprovação</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white focus:border-red-400 focus:outline-none transition-all dash resize-none"
                  placeholder="Descreva o motivo (opcional)..."
                  autoFocus
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    updateStatus('rejected', { rejection_reason: rejectionReason || null })
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors dash"
                >
                  Confirmar Reprovação
                </button>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors dash"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => updateStatus('approved')}
          disabled={loading !== null}
          title="Aprovar"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all disabled:opacity-40 cursor-pointer"
        >
          {loading === 'approved'
            ? <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            : <CheckCircle className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading !== null}
          title="Reprovar"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-40 cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateStatus('resend_required')}
          disabled={loading !== null}
          title="Solicitar reenvio"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-all disabled:opacity-40 cursor-pointer"
        >
          {loading === 'resend_required'
            ? <span className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>
    </>
  )
}
