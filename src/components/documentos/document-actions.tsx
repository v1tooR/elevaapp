'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react'

type DocStatus = 'pending' | 'received' | 'under_review' | 'approved' | 'rejected' | 'resend_required'

export function DocumentActions({ document }: { document: any }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const updateStatus = async (status: DocStatus, extra: Record<string, any> = {}) => {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('documents').update({ status, ...extra }).eq('id', document.id)

    if (document.process_id) {
      const actionMap: Record<DocStatus, string> = {
        approved: 'document_approved',
        rejected: 'document_rejected',
        resend_required: 'document_rejected',
        pending: 'updated',
        received: 'document_uploaded',
        under_review: 'updated',
      }
      await supabase.from('process_history').insert({
        process_id: document.process_id,
        action_type: actionMap[status] ?? 'updated',
        new_value: status,
        note: extra.rejection_reason ? `Reprovado: ${extra.rejection_reason}` : undefined,
      })
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  if (document.status === 'approved' || document.status === 'rejected') {
    return (
      <span className="text-xs text-slate-400">
        {document.status === 'approved' ? 'Aprovado' : `Reprovado: ${document.rejection_reason ?? ''}`}
      </span>
    )
  }

  return (
    <div className="relative">
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-3">Motivo da reprovação</h3>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descreva o motivo..."
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  updateStatus('rejected', { rejection_reason: rejectionReason })
                }}
                className="flex-1 bg-red-600 text-white text-sm py-2 rounded-lg hover:bg-red-700"
              >
                Reprovar
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 border border-slate-300 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => updateStatus('approved')}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
          title="Aprovar"
        >
          <CheckCircle className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
          title="Reprovar"
        >
          <XCircle className="w-4 h-4" />
        </button>
        <button
          onClick={() => updateStatus('resend_required')}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-500 hover:text-orange-600 transition-colors"
          title="Solicitar reenvio"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
