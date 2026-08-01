'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { UserPlus, X, AlertCircle, CheckCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getLeadDisabilityTypes,
  getLeadIntendedServices,
  LEAD_DISABILITY_LABELS,
  LEAD_SERVICE_LABELS,
  LEAD_SERVICE_OPTIONS,
  normalizeLeadIntendedServices,
} from '@/lib/lead-eligibility'
import type { Lead, LeadIntendedService } from '@/types/database'

export function ConvertLeadModal({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const disabilityTypes = getLeadDisabilityTypes(lead)
  const intendedServices = getLeadIntendedServices(lead)
  const [selectedServices, setSelectedServices] = useState<LeadIntendedService[]>(
    () => intendedServices,
  )

  const toggleService = (service: LeadIntendedService) => {
    setSelectedServices(current => normalizeLeadIntendedServices(
      current.includes(service)
        ? current.filter(item => item !== service)
        : [...current, service],
    ))
  }

  const handleConvert = async () => {
    if (selectedServices.length === 0) {
      setError('Selecione pelo menos um servico contratado antes de converter.')
      return
    }
    setLoading(true)
    setError('')

    const response = await fetch(`/api/leads/${lead.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'convertido', selectedServices }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok || !result.convertedClientId) {
      setError(result.error ?? 'Não foi possível criar o cliente.')
      setLoading(false)
      return
    }

    router.push(`/clientes/${result.convertedClientId}`)
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
        {lead.status === 'convertido' ? 'Concluir conversão' : 'Converter em Cliente'}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-panel max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">

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
                    <h2 className="dash text-white font-bold text-base">
                      {lead.status === 'convertido' ? 'Concluir conversão' : 'Converter em Cliente'}
                    </h2>
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
                  {lead.email && (
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-slate-500 dash">E-mail</span>
                      <span className="truncate font-semibold text-slate-900 dash">{lead.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dash">Perfil</span>
                    <span className="font-semibold text-slate-900 dash">
                      {lead.is_driver == null
                        ? 'Não informado'
                        : lead.is_driver ? 'Condutor' : 'Não condutor'}
                    </span>
                  </div>
                  {disabilityTypes.length > 0 && (
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-slate-500 dash">Condições</span>
                      <span className="text-right font-semibold text-slate-900 dash">
                        {disabilityTypes.map(type => LEAD_DISABILITY_LABELS[type]).join(', ')}
                      </span>
                    </div>
                  )}
                  {intendedServices.length > 0 && (
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-slate-500 dash">Serviços</span>
                      <span className="text-right font-semibold text-slate-900 dash">
                        {intendedServices
                          .map((service, index) => `${index + 1}. ${LEAD_SERVICE_LABELS[service]}`)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <fieldset className="space-y-2.5">
                <div>
                  <legend className="dash text-sm font-bold text-slate-900">
                    Confirme os servicos contratados
                  </legend>
                  <p className="dash mt-0.5 text-xs text-slate-500">
                    Marque todos os servicos que devem entrar no plano deste cliente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {LEAD_SERVICE_OPTIONS.map(option => {
                    const checked = selectedServices.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`dash inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                          checked
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(option.value)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
                {selectedServices.includes('cnh_especial') && (
                  <p className="dash rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">
                    A CNH Especial sera iniciada primeiro. IPI e ICMS permanecem organizados conforme suas dependencias.
                  </p>
                )}
              </fieldset>

              {!lead.email && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="dash text-sm leading-snug text-amber-800">
                    O e-mail ainda não foi informado. A conversão pode continuar, mas alguns processos precisarão desse dado depois.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800 dash leading-snug">
                  <span>O primeiro servico sera iniciado. Os demais ficarao visiveis no plano para a equipe escolher o proximo sem criar processos indevidos.</span>
                  <span className="hidden">
                  Um novo cliente será criado e os serviços selecionados já aparecerão como processos. A CNH Especial terá prioridade; os demais ficarão organizados na fila do cliente.
                  </span>
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
