'use client'

import { AlertCircle, CheckCircle2, ClipboardCheck, HelpCircle, ShieldCheck } from 'lucide-react'
import type { EligibilityAnalysis } from '@/lib/eligibility'
import type { VehicleCondition } from '@/types/database'

const BRAZIL_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const STATUS_STYLE = {
  pre_elegivel: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', icon: CheckCircle2 },
  pendente_informacoes: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: HelpCircle },
  requer_validacao: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: ClipboardCheck },
  provavelmente_nao_elegivel: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: AlertCircle },
  elegibilidade_confirmada: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', icon: ShieldCheck },
} as const

interface Props {
  analysis: EligibilityAnalysis
  state: string
  vehicleCondition: VehicleCondition | ''
  onStateChange: (state: string) => void
  onVehicleConditionChange: (condition: VehicleCondition | '') => void
  showState: boolean
  showVehicleCondition: boolean
}

export function EligibilityAnalysisCard({
  analysis,
  state,
  vehicleCondition,
  onStateChange,
  onVehicleConditionChange,
  showState,
  showVehicleCondition,
}: Props) {
  const style = STATUS_STYLE[analysis.status]
  const Icon = style.icon

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Assistente de elegibilidade</p>
          <p className="text-[11px] text-slate-500">Triagem explicável; a confirmação continua sendo humana.</p>
        </div>
      </div>

      {(showState || showVehicleCondition) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showState && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">UF do processo</label>
              <select value={state} onChange={event => onStateChange(event.target.value)} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="">Selecione</option>
                {BRAZIL_STATES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          )}
          {showVehicleCondition && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Condição do veículo</label>
              <select value={vehicleCondition} onChange={event => onVehicleConditionChange(event.target.value as VehicleCondition | '')} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="">Selecione</option>
                <option value="zero_km">Zero-quilômetro</option>
                <option value="usado">Usado</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl px-3.5 py-3" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: style.text }} />
          <div>
            <p className="text-xs font-bold" style={{ color: style.text }}>{analysis.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: style.text }}>{analysis.summary}</p>
          </div>
        </div>
      </div>

      {analysis.missingInformation.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Informações pendentes</p>
          <ul className="space-y-1">
            {analysis.missingInformation.map(item => <li key={item} className="text-[11px] leading-relaxed text-slate-600">• {item}</li>)}
          </ul>
        </div>
      )}

      {analysis.reasons.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Motivos considerados</p>
          <ul className="space-y-1">
            {analysis.reasons.map(item => <li key={item} className="text-[11px] leading-relaxed text-slate-600">• {item}</li>)}
          </ul>
        </div>
      )}

      {analysis.recommendations.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">Próximas verificações</p>
          <ul className="space-y-1">
            {analysis.recommendations.map(item => <li key={item} className="text-[11px] leading-relaxed text-slate-600">• {item}</li>)}
          </ul>
        </div>
      )}

      <p className="border-t border-slate-200 pt-2 text-[10px] text-slate-400">Regras de triagem: {analysis.rulesVersion}. Não substitui perícia nem conferência da legislação vigente.</p>
    </div>
  )
}
