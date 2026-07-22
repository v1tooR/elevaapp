import { ClipboardPlus, History, Plus, X } from 'lucide-react'
import {
  MEDICAL_REQUIREMENT_STATUS_LABELS,
  MEDICAL_REQUIREMENT_STATUS_OPTIONS,
  MEDICAL_REQUIREMENT_TYPE_OPTIONS,
  type MedicalRequirement,
  type MedicalRequirementType,
} from '@/lib/cnh-medical-workflow'
import { formatDate, formatDateTime } from '@/lib/utils'

interface Props {
  requirements: MedicalRequirement[]
  onChange: (requirements: MedicalRequirement[]) => void
}

function todayLocal() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

const EVENT_LABELS = {
  created: 'Registro criado',
  updated: 'Informações atualizadas',
  status_changed: 'Situação alterada',
  migrated: 'Registro anterior convertido',
} as const

export function MedicalRequirementsEditor({ requirements, onChange }: Props) {
  const updateRequirement = (id: string, field: keyof MedicalRequirement, value: unknown) => {
    onChange(requirements.map(requirement => (
      requirement.id === id ? { ...requirement, [field]: value } : requirement
    )))
  }

  const addRequirement = (type: MedicalRequirementType) => {
    onChange([
      ...requirements,
      {
        id: crypto.randomUUID(),
        type,
        title: '',
        details: '',
        requested_at: todayLocal(),
        due_date: '',
        follow_up_date: '',
        status: 'pendente',
        result: '',
        created_at: '',
        updated_at: '',
        history: [],
      },
    ])
  }

  const removeUnsavedRequirement = (id: string) => {
    onChange(requirements.filter(requirement => requirement.id !== id))
  }

  const openCount = requirements.filter(requirement => !['concluida', 'cancelada'].includes(requirement.status)).length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardPlus className="h-4 w-4 text-amber-700" />
            <p className="text-xs font-semibold text-amber-950">Exigências e exames complementares</p>
          </div>
          <p className="mt-1 text-[11px] text-amber-800">
            {openCount > 0
              ? `${openCount} registro${openCount === 1 ? '' : 's'} em aberto. Cada alteração fica no histórico.`
              : 'Nenhuma exigência médica em aberto.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MEDICAL_REQUIREMENT_TYPE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => addRequirement(option.value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100"
            >
              <Plus className="h-3 w-3" />
              {option.value === 'exame_complementar' ? 'Adicionar exame' : 'Adicionar exigência'}
            </button>
          ))}
        </div>
      </div>

      {requirements.length > 0 && (
        <div className="space-y-3">
          {requirements.map((requirement, index) => (
            <div key={requirement.id} className="rounded-xl border border-amber-200 bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-700">Registro {index + 1}</p>
                {!requirement.created_at && (
                  <button
                    type="button"
                    onClick={() => removeUnsavedRequirement(requirement.id)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                    Descartar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">Tipo</span>
                  <select
                    value={requirement.type}
                    onChange={event => updateRequirement(requirement.id, 'type', event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  >
                    {MEDICAL_REQUIREMENT_TYPE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">Situação</span>
                  <select
                    value={requirement.status}
                    onChange={event => updateRequirement(requirement.id, 'status', event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  >
                    {MEDICAL_REQUIREMENT_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-slate-600">Exame ou exigência *</span>
                <input
                  type="text"
                  value={requirement.title}
                  onChange={event => updateRequirement(requirement.id, 'title', event.target.value)}
                  placeholder={requirement.type === 'exame_complementar' ? 'Ex.: tomografia da coluna' : 'Ex.: apresentar novo laudo médico'}
                  maxLength={200}
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">Solicitado em *</span>
                  <input
                    type="date"
                    value={requirement.requested_at}
                    onChange={event => updateRequirement(requirement.id, 'requested_at', event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">Prazo, se houver</span>
                  <input
                    type="date"
                    value={requirement.due_date}
                    onChange={event => updateRequirement(requirement.id, 'due_date', event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">Retorno médico</span>
                  <input
                    type="date"
                    value={requirement.follow_up_date}
                    onChange={event => updateRequirement(requirement.id, 'follow_up_date', event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-slate-600">Detalhes</span>
                <textarea
                  value={requirement.details}
                  onChange={event => updateRequirement(requirement.id, 'details', event.target.value)}
                  placeholder="Orientações médicas, documentos necessários ou observações..."
                  maxLength={5000}
                  rows={2}
                  className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </label>

              {['concluida', 'cancelada'].includes(requirement.status) && (
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">Resultado ou motivo</span>
                  <textarea
                    value={requirement.result}
                    onChange={event => updateRequirement(requirement.id, 'result', event.target.value)}
                    placeholder="Registre o resultado apresentado ou o motivo do encerramento."
                    maxLength={5000}
                    rows={2}
                    className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </label>
              )}

              {requirement.history.length > 0 && (
                <details className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <History className="h-3.5 w-3.5" />
                    Histórico ({requirement.history.length})
                  </summary>
                  <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
                    {[...requirement.history].reverse().map(event => (
                      <p key={event.id} className="text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-600">{EVENT_LABELS[event.event]}</span>
                        {' · '}{MEDICAL_REQUIREMENT_STATUS_LABELS[event.status]}
                        {' · '}{formatDateTime(event.occurred_at)}
                      </p>
                    ))}
                    {requirement.follow_up_date && (
                      <p className="text-[10px] font-medium text-amber-700">Retorno previsto: {formatDate(requirement.follow_up_date)}</p>
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
