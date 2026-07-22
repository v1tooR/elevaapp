'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, X, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Lead } from '@/types/database'

export function ConvertLeadModal({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConvert = async () => {
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data: clientId, error: clientErr } = await supabase.rpc('convert_lead_to_client', {
      p_lead_id: lead.id,
    })

    if (clientErr || !clientId) {
      setError('Erro ao criar cliente: ' + (clientErr?.message ?? 'Erro desconhecido'))
      setLoading(false)
      return
    }

    router.push(`/clientes/${clientId}`)
  }

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-panel { animation: modalIn 0.2s ease-out both; }
      `}</style>

      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors dash"
      >
        <UserPlus className="w-4 h-4" />
        Converter em Cliente
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div
              className="px-6 py-4"
              style={{ background: 'linear-gradient(135deg, #6B3019, #A14F2A)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <UserPlus className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="dash text-white font-bold text-base">Converter em Cliente</h2>
                    <p className="dash text-emerald-200/80 text-xs mt-0.5">Esta ação é irreversível</p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); setError('') }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2" style={{ border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider dash">Dados que serão copiados</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dash">Nome</span>
                    <span className="font-semibold text-slate-900 dash">{lead.name}</span>
                  </div>
                  {lead.phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dash">Telefone</span>
                      <span className="font-semibold text-slate-900 dash">{lead.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dash">Perfil</span>
                    <span className="font-semibold text-slate-900 dash">
                      {lead.is_driver ? 'Condutor' : 'Não condutor'}
                    </span>
                  </div>
                  {lead.disability_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dash">Deficiência</span>
                      <span className="font-semibold text-slate-900 dash capitalize">{lead.disability_type}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800 dash leading-snug">
                  Um novo cadastro de cliente será criado com os dados acima. O lead será marcado como <strong>Convertido</strong> e você será redirecionado para a página do cliente.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dash">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button onClick={handleConvert} loading={loading} className="flex-1">
                  Confirmar conversão
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); setError('') }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
