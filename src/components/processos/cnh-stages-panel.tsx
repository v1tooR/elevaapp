'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronUp, AlertCircle, Calendar,
  CheckCircle2, XCircle, Clock, FileCheck, Car,
  Stethoscope, ClipboardList, BadgeCheck, Bell,
  CalendarCheck, CalendarPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MedicalRequirementsEditor } from '@/components/processos/medical-requirements-editor'
import type { ProcessStage } from '@/types/database'
import { formatDate } from '@/lib/utils'
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_OPTIONS,
  getMedicalRequirements,
  getMedicalRequirementsSummary,
  inferAppealStatus,
  isMedicalStage,
  validateAppealWorkflow,
  type AppealStatus,
  type MedicalRequirement,
} from '@/lib/cnh-medical-workflow'

interface Props {
  stages: ProcessStage[]
  processId: string
  clientId: string
  clientName: string
  responsibleUserId: string | null
}

type EditState = {
  status: string
  scheduled_date: string
  attended: boolean
  result: string
  notes: string
  data: Record<string, unknown>
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; border: string; leftBorder: string; ring: string }> = {
  pendente:      { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8', border: '#E2E8F0',  leftBorder: '#CBD5E1', ring: '#CBD5E1' },
  em_andamento:  { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', border: '#FDE68A',  leftBorder: '#F59E0B', ring: '#F59E0B' },
  concluido:     { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0',  leftBorder: '#22C55E', ring: '#22C55E' },
  aprovado:      { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0',  leftBorder: '#22C55E', ring: '#22C55E' },
  reprovado:     { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444', border: '#FECACA',  leftBorder: '#EF4444', ring: '#EF4444' },
  nao_aplicavel: { bg: '#F8FAFC', text: '#94A3B8', dot: '#CBD5E1', border: '#E2E8F0',  leftBorder: '#E2E8F0', ring: '#E2E8F0' },
}

const STATUS_LABEL: Record<string, string> = {
  pendente:      'Pendente',
  em_andamento:  'Em andamento',
  concluido:     'Concluído',
  aprovado:      'Aprovado',
  reprovado:     'Reprovado',
  nao_aplicavel: 'N/A',
}

const STATUS_OPTIONS_BY_KEY: Record<string, string[]> = {
  checklist_documentos:   ['pendente', 'em_andamento', 'concluido'],
  agendamento_poupatempo: ['pendente', 'em_andamento', 'concluido'],
  pericia_medica:         ['pendente', 'em_andamento', 'aprovado', 'reprovado'],
  recurso_junta_medica:   ['pendente', 'em_andamento', 'aprovado', 'reprovado'],
  exame_pratico:          ['pendente', 'em_andamento', 'aprovado', 'reprovado', 'nao_aplicavel'],
  emissao_cnh:            ['pendente', 'em_andamento', 'concluido'],
  liberado_isencoes:      ['pendente', 'concluido'],
  cnh_regularizada:       ['pendente', 'concluido'],
}

const HAS_SCHEDULED_DATE = new Set([
  'agendamento_poupatempo', 'pericia_medica', 'recurso_junta_medica', 'exame_pratico',
])
const HAS_ATTENDED = new Set(['agendamento_poupatempo', 'pericia_medica', 'recurso_junta_medica', 'exame_pratico'])

const CHECKLIST_FIELDS = ['cnh', 'laudo_medico', 'acesso_gov_validado', 'comprovante_endereco', 'email'] as const
const CHECKLIST_LABELS: Record<string, string> = {
  cnh:                  'CNH atual',
  laudo_medico:         'Laudo Médico',
  acesso_gov_validado:  'Acesso Gov.br validado com o cliente',
  comprovante_endereco: 'Comprovante de Endereço',
  email:                'E-mail',
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  checklist_documentos:   ClipboardList,
  agendamento_poupatempo: Calendar,
  pericia_medica:         Stethoscope,
  recurso_junta_medica:   AlertCircle,
  exame_pratico:          Car,
  emissao_cnh:            FileCheck,
  liberado_isencoes:      BadgeCheck,
  cnh_regularizada:       BadgeCheck,
}

function initEdit(stage: ProcessStage): EditState {
  const data = { ...(stage.data as Record<string, unknown>) }
  if (isMedicalStage(stage.stage_key)) {
    data.medical_requirements = getMedicalRequirements(stage)
  }
  if (stage.stage_key === 'recurso_junta_medica') {
    data.appeal_status = inferAppealStatus(stage)
  }
  return {
    status:         stage.status,
    scheduled_date: stage.scheduled_date ?? '',
    attended:       stage.attended ?? false,
    result:         stage.result ?? '',
    notes:          stage.notes ?? '',
    data,
  }
}

function isComplete(status: string) {
  return ['concluido', 'aprovado', 'nao_aplicavel'].includes(status)
}

function isResolved(status: string) {
  return isComplete(status) || status === 'reprovado'
}

export function CnhStagesPanel({ stages, processId }: Props) {
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadingCalId, setLoadingCalId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [calSuccess, setCalSuccess] = useState<Record<string, string>>({})
  const [edits, setEdits] = useState<Record<string, EditState>>({})

  const getEdit = (stage: ProcessStage): EditState => edits[stage.id] ?? initEdit(stage)

  const updateEdit = (stage: ProcessStage, key: keyof EditState, value: unknown) =>
    setEdits(prev => ({
      ...prev,
      [stage.id]: { ...(prev[stage.id] ?? initEdit(stage)), [key]: value },
    }))

  const updateData = (stage: ProcessStage, dataKey: string, value: unknown) =>
    setEdits(prev => {
      const cur = prev[stage.id] ?? initEdit(stage)
      return { ...prev, [stage.id]: { ...cur, data: { ...cur.data, [dataKey]: value } } }
    })

  const updateNestedData = (stage: ProcessStage, parentKey: string, childKey: string, value: unknown) =>
    setEdits(prev => {
      const cur = prev[stage.id] ?? initEdit(stage)
      const parentObj = (cur.data[parentKey] as Record<string, unknown>) ?? {}
      return {
        ...prev,
        [stage.id]: { ...cur, data: { ...cur.data, [parentKey]: { ...parentObj, [childKey]: value } } },
      }
    })

  // ── Calendar quick-save ────────────────────────────────────────────────────
  const saveCalendarEvent = async (stage: ProcessStage, type: 'internal' | 'client') => {
    const edit = getEdit(stage)
    if (!edit.scheduled_date) return

    const key = `${stage.id}-${type}`
    setLoadingCalId(key)
    setErrors(prev => ({ ...prev, [stage.id]: '' }))
    setCalSuccess(prev => ({ ...prev, [stage.id]: '' }))
    try {
      const response = await fetch(`/api/processos/${processId}/stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: edit.status,
          scheduledDate: edit.scheduled_date,
          attended: edit.attended,
          result: edit.result || null,
          notes: edit.notes || null,
          data: edit.data,
          notifyClient: type === 'client',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível salvar o agendamento.')

      setCalSuccess(prev => ({
        ...prev,
        [stage.id]: type === 'client'
          ? 'Cliente notificado; evento visível nas duas agendas'
          : 'Agendamento salvo na agenda da equipe',
      }))
      setTimeout(() => setCalSuccess(prev => ({ ...prev, [stage.id]: '' })), 3000)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o agendamento.'
      setErrors(prev => ({ ...prev, [stage.id]: message }))
    } finally {
      setLoadingCalId(null)
    }
  }

  // ── Main stage save ────────────────────────────────────────────────────────
  const saveStage = async (stage: ProcessStage) => {
    const edit = getEdit(stage)
    if (
      ['pericia_medica', 'recurso_junta_medica'].includes(stage.stage_key) &&
      (edit.result === 'aprovado' || edit.status === 'aprovado') &&
      typeof edit.data.requires_practical_exam !== 'boolean'
    ) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: 'Informe se o exame prático foi determinado antes de registrar a aprovação médica.',
      }))
      return
    }
    if (
      stage.stage_key === 'pericia_medica' &&
      (edit.result === 'reprovado' || edit.status === 'reprovado') &&
      !edit.data.decision_notified_at
    ) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: 'Informe a data da ciência da reprovação para calcular o prazo recursal.',
      }))
      return
    }
    const medicalRequirements = Array.isArray(edit.data.medical_requirements)
      ? edit.data.medical_requirements as MedicalRequirement[]
      : []
    const invalidMedicalRequirement = medicalRequirements.find(requirement => (
      !requirement.title.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requirement.requested_at) ||
      (['concluida', 'cancelada'].includes(requirement.status) && !requirement.result.trim())
    ))
    if (isMedicalStage(stage.stage_key) && invalidMedicalRequirement) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: !invalidMedicalRequirement.title.trim()
          ? 'Informe qual exame ou exigência médica foi solicitado.'
          : !invalidMedicalRequirement.requested_at
            ? 'Informe a data da solicitação médica.'
            : 'Informe o resultado ou motivo para encerrar a exigência médica.',
      }))
      return
    }
    const hasOpenMedicalRequirement = medicalRequirements.some(requirement => (
      !['concluida', 'cancelada'].includes(requirement.status)
    ))
    if (
      isMedicalStage(stage.stage_key) &&
      hasOpenMedicalRequirement &&
      (['aprovado', 'reprovado'].includes(edit.status) || ['aprovado', 'reprovado'].includes(edit.result))
    ) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: 'Conclua ou cancele todas as exigências médicas antes de registrar o resultado definitivo.',
      }))
      return
    }
    if (stage.stage_key === 'recurso_junta_medica') {
      const appealError = validateAppealWorkflow({
        data: edit.data,
        scheduledDate: edit.scheduled_date || null,
        result: edit.result || null,
        stageStatus: edit.status,
      })
      if (appealError) {
        setErrors(prev => ({ ...prev, [stage.id]: appealError }))
        return
      }
    }
    if (
      stage.stage_key === 'emissao_cnh' &&
      edit.status === 'concluido' &&
      !edit.data.vencimento_cnh
    ) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: 'Informe o vencimento impresso na CNH antes de concluir a emissão.',
      }))
      return
    }
    setLoadingId(stage.id)
    setErrors(prev => ({ ...prev, [stage.id]: '' }))
    try {
      const response = await fetch(`/api/processos/${processId}/stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: edit.status,
          scheduledDate: edit.scheduled_date || null,
          attended: edit.attended,
          result: edit.result || null,
          notes: edit.notes || null,
          data: edit.data,
          notifyClient: true,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível salvar a etapa.')

      setActiveId(null)
      router.refresh()
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: error instanceof Error ? error.message : 'Não foi possível salvar a etapa.',
      }))
    } finally {
      setLoadingId(null)
    }
  }

  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  const doneCount = sorted.filter(s => isResolved(s.status)).length
  const pct = sorted.length > 0 ? Math.round((doneCount / sorted.length) * 100) : 0
  const currentStage = sorted.find(s => s.status === 'em_andamento') ?? sorted.find(s => s.status === 'pendente')
  const currentStageDetail = currentStage ? getMedicalRequirementsSummary(currentStage) : null

  return (
    <div className="space-y-5">

      {/* ── Progress header ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, #1E1A17 0%, #2D2420 100%)',
          border: '1px solid rgba(161,79,42,0.25)',
        }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold text-amber-300/60 uppercase tracking-widest mb-1">Progresso CNH Especial</p>
            <p className="text-2xl font-bold text-white">
              {doneCount}
              <span className="text-base text-white/40 font-normal">/{sorted.length} etapas</span>
            </p>
          </div>
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                stroke={pct === 100 ? '#22C55E' : '#C97A52'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{pct}%</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                : 'linear-gradient(90deg, #A14F2A, #C97A52)',
            }}
          />
        </div>

        {/* Stage dots */}
        <div className="flex items-center gap-0">
          {sorted.map((stage, idx) => {
            const done = isComplete(stage.status)
            const active = stage.status === 'em_andamento'
            const failed = stage.status === 'reprovado'
            const Icon = STAGE_ICONS[stage.stage_key] ?? Clock
            const isLast = idx === sorted.length - 1

            return (
              <div key={stage.id} className="flex items-center" style={{ flex: isLast ? 'none' : 1 }}>
                <button
                  type="button"
                  onClick={() => setActiveId(activeId === stage.id ? null : stage.id)}
                  title={stage.label}
                  className="relative flex flex-col items-center gap-1 group"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                    style={{
                      background: done ? '#22C55E' : active ? '#C97A52' : failed ? '#EF4444' : 'rgba(255,255,255,0.1)',
                      border: activeId === stage.id ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                      boxShadow: active ? '0 0 0 3px rgba(201,122,82,0.3)' : 'none',
                    }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : failed ? (
                      <XCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                    )}
                  </div>
                  <span
                    className="text-[9px] font-semibold leading-tight text-center max-w-13 truncate"
                    style={{ color: done || active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}
                  >
                    {stage.label.split(' ')[0]}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className="flex-1 h-px mx-1 -mt-2.5"
                    style={{ background: done ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Current stage label */}
        {currentStage && pct < 100 && (
          <div className="mt-4 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div>
              <p className="text-xs text-white/70">
                Em andamento: <span className="font-semibold text-white/90">{currentStage.label}</span>
              </p>
              {currentStageDetail && <p className="mt-0.5 text-[11px] font-medium text-amber-200">{currentStageDetail}</p>}
            </div>
          </div>
        )}
        {pct === 100 && (
          <div className="mt-4 flex items-center gap-2 bg-emerald-500/20 rounded-xl px-3 py-2.5 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold text-emerald-300">Processo CNH Especial concluído</p>
          </div>
        )}
      </div>

      {/* ── Stage cards ─────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {sorted.map((stage, idx) => {
          const edit = getEdit(stage)
          const st = STATUS_STYLE[stage.status] ?? STATUS_STYLE.pendente
          const isActive = activeId === stage.id
          const isLoading = loadingId === stage.id
          const err = errors[stage.id]
          const calMsg = calSuccess[stage.id]
          const isLast = idx === sorted.length - 1
          const done = isComplete(stage.status)
          const Icon = STAGE_ICONS[stage.stage_key] ?? Clock
          const medicalFollowUpSummary = getMedicalRequirementsSummary(stage)
          const appealStatus = stage.stage_key === 'recurso_junta_medica' ? inferAppealStatus(stage) : null

          return (
            <div key={stage.id} className="relative">
              {!isLast && (
                <div
                  className="absolute left-4.75 top-11 -bottom-2.5 w-0.5 z-0"
                  style={{ background: done ? '#BBF7D0' : '#E2E8F0' }}
                />
              )}

              <div
                className="relative z-10 bg-white rounded-xl overflow-hidden transition-shadow"
                style={{
                  border: `1px solid ${st.border}`,
                  borderLeft: `3px solid ${st.leftBorder}`,
                  boxShadow: isActive
                    ? `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px ${st.ring}40`
                    : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* Stage header */}
                <button
                  type="button"
                  onClick={() => setActiveId(isActive ? null : stage.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: st.bg, border: `1.5px solid ${st.border}` }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: st.dot }} />
                    ) : stage.status === 'reprovado' ? (
                      <XCircle className="w-4 h-4" style={{ color: st.dot }} />
                    ) : (
                      <Icon className="w-3.5 h-3.5" style={{ color: st.dot }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{stage.label}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {stage.scheduled_date && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(stage.scheduled_date)}
                          {stage.attended !== null && stage.attended !== undefined && (
                            <span className={cn('ml-1 font-medium', stage.attended ? 'text-emerald-600' : 'text-red-400')}>
                              · {stage.attended ? 'compareceu' : 'não compareceu'}
                            </span>
                          )}
                        </p>
                      )}
                      {stage.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-30" title={stage.notes}>
                          {stage.notes}
                        </p>
                      )}
                      {medicalFollowUpSummary && (
                        <p className="text-[10px] font-semibold text-amber-700">{medicalFollowUpSummary}</p>
                      )}
                      {appealStatus && (
                        <p className="text-[10px] font-semibold text-sky-700">{APPEAL_STATUS_LABELS[appealStatus]}</p>
                      )}
                    </div>
                  </div>

                  <span
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                    {STATUS_LABEL[stage.status]}
                  </span>

                  {isActive ? (
                    <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </button>

                {/* ── Edit panel ──────────────────────────────────── */}
                {isActive && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/40">

                    {/* Status selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600">Status da etapa</p>
                      <div className="flex flex-wrap gap-2">
                        {(STATUS_OPTIONS_BY_KEY[stage.stage_key] ?? ['pendente', 'em_andamento', 'concluido']).map(s => {
                          const ss = STATUS_STYLE[s] ?? STATUS_STYLE.pendente
                          const isSel = edit.status === s
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateEdit(stage, 'status', s)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={isSel
                                ? { background: ss.bg, color: ss.text, border: `1.5px solid ${ss.border}`, boxShadow: `0 0 0 2px ${ss.dot}30` }
                                : { background: '#fff', color: '#94A3B8', border: '1px solid #E2E8F0' }
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? ss.dot : '#CBD5E1' }} />
                              {STATUS_LABEL[s]}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Scheduled date + calendar buttons ─────── */}
                    {HAS_SCHEDULED_DATE.has(stage.stage_key) && (
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-slate-600">Data agendada</p>
                        <input
                          type="date"
                          value={edit.scheduled_date}
                          onChange={e => updateEdit(stage, 'scheduled_date', e.target.value)}
                          className="block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                        />

                        {edit.scheduled_date && (
                          <div className="flex flex-wrap gap-2">
                            {/* Internal calendar button */}
                            <button
                              type="button"
                              onClick={() => saveCalendarEvent(stage, 'internal')}
                              disabled={!!loadingCalId}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                            >
                              {loadingCalId === `${stage.id}-internal` ? (
                                <Clock className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                              ) : (
                                <CalendarPlus className="w-3.5 h-3.5 text-slate-500" />
                              )}
                              {loadingCalId === `${stage.id}-internal` ? 'Salvando...' : 'Agenda interna'}
                            </button>

                            {/* Client notification + calendar button */}
                            <button
                              type="button"
                              onClick={() => saveCalendarEvent(stage, 'client')}
                              disabled={!!loadingCalId}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all disabled:opacity-50"
                            >
                              {loadingCalId === `${stage.id}-client` ? (
                                <Clock className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Bell className="w-3.5 h-3.5" />
                              )}
                              {loadingCalId === `${stage.id}-client` ? 'Enviando...' : 'Notificar cliente'}
                            </button>
                          </div>
                        )}

                        {/* Calendar success feedback */}
                        {calMsg && (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <p className="text-xs font-medium text-emerald-700">{calMsg}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attended toggle */}
                    {HAS_ATTENDED.has(stage.stage_key) && (
                      <div className="flex items-center justify-between py-0.5">
                        <p className="text-xs font-semibold text-slate-600">Compareceu?</p>
                        <button
                          type="button"
                          onClick={() => updateEdit(stage, 'attended', !edit.attended)}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                            edit.attended ? 'bg-emerald-500' : 'bg-slate-200'
                          )}
                        >
                          <span className={cn(
                            'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
                            edit.attended ? 'translate-x-4' : 'translate-x-0'
                          )} />
                        </button>
                      </div>
                    )}

                    {/* checklist_documentos */}
                    {stage.stage_key === 'checklist_documentos' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Documentos recebidos</p>
                        <div className="space-y-1.5">
                          {CHECKLIST_FIELDS.map(field => {
                            const checked = !!(edit.data[field])
                            return (
                              <label
                                key={field}
                                className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-amber-200 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => updateData(stage, field, e.target.checked)}
                                  className="w-4 h-4 rounded text-amber-600 shrink-0"
                                />
                                <span className="text-sm text-slate-700 flex-1">{CHECKLIST_LABELS[field]}</span>
                                {checked && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                              </label>
                            )
                          })}
                        </div>
                        {(() => {
                          const total = CHECKLIST_FIELDS.length
                          const checkedCount = CHECKLIST_FIELDS.filter(f => !!(edit.data[f])).length
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                                  style={{ width: `${(checkedCount / total) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">{checkedCount}/{total}</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Result buttons — pericia, recurso, exame */}
                    {['pericia_medica', 'recurso_junta_medica', 'exame_pratico'].includes(stage.stage_key) && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Resultado</p>
                        <div className="flex gap-2">
                          {['aprovado', 'reprovado'].map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                const newResult = edit.result === r ? '' : r
                                setEdits(prev => {
                                  const cur = prev[stage.id] ?? initEdit(stage)
                                  return {
                                    ...prev,
                                    [stage.id]: {
                                      ...cur,
                                      result: newResult,
                                      status: newResult || cur.status,
                                      data: stage.stage_key === 'recurso_junta_medica' && newResult
                                        ? { ...cur.data, appeal_status: 'concluido' }
                                        : cur.data,
                                    },
                                  }
                                })
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border"
                              style={edit.result === r
                                ? r === 'aprovado'
                                  ? { background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }
                                  : { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                                : { background: '#fff', color: '#94A3B8', borderColor: '#E2E8F0' }
                              }
                            >
                              {r === 'aprovado'
                                ? <CheckCircle2 className="w-3.5 h-3.5" />
                                : <XCircle className="w-3.5 h-3.5" />
                              }
                              {r === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isMedicalStage(stage.stage_key) && (
                      <MedicalRequirementsEditor
                        requirements={(edit.data.medical_requirements as MedicalRequirement[]) ?? []}
                        onChange={requirements => updateData(stage, 'medical_requirements', requirements)}
                      />
                    )}

                    {/* pericia_medica: observacoes */}
                    {stage.stage_key === 'pericia_medica' && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Restrições determinadas</p>
                          <input
                            type="text"
                            value={(edit.data.restricoes as string) ?? ''}
                            onChange={e => updateData(stage, 'restricoes', e.target.value)}
                            placeholder="Códigos do laudo/RENACH, ex.: B, X"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-400">Informe somente os códigos emitidos; não os deduza pelo tipo de deficiência.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: 'requires_practical_exam', label: 'Exame prático determinado?' },
                            { key: 'requires_adapted_vehicle', label: 'Veículo adaptado determinado?' },
                          ].map(field => (
                            <div key={field.key} className="space-y-1.5">
                              <p className="text-xs font-semibold text-slate-600">{field.label}</p>
                              <select
                                value={typeof edit.data[field.key] === 'boolean' ? String(edit.data[field.key]) : ''}
                                onChange={e => updateData(stage, field.key, e.target.value === '' ? null : e.target.value === 'true')}
                                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                              >
                                <option value="">Aguardando definição</option>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                              </select>
                            </div>
                          ))}
                        </div>
                        {(edit.result === 'reprovado' || edit.status === 'reprovado') && (
                          <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-900">Data da ciência da reprovação *</p>
                            <input
                              type="date"
                              value={(edit.data.decision_notified_at as string) ?? ''}
                              onChange={e => updateData(stage, 'decision_notified_at', e.target.value)}
                              className="block w-full rounded-lg border border-amber-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                            />
                            <p className="text-[10px] text-amber-700">O prazo de 30 dias e os alertas serão calculados a partir desta data.</p>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Observações da perícia</p>
                          <textarea
                            value={(edit.data.observacoes as string) ?? ''}
                            onChange={e => updateData(stage, 'observacoes', e.target.value)}
                            placeholder="Notas do médico perito..."
                            rows={2}
                            className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* recurso_junta_medica */}
                    {stage.stage_key === 'recurso_junta_medica' && (
                      <div className="space-y-3">
                        <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50 p-3">
                          <p className="text-xs font-semibold text-sky-900">Situação operacional do recurso</p>
                          <select
                            value={(edit.data.appeal_status as AppealStatus) ?? inferAppealStatus(stage)}
                            onChange={event => {
                              updateData(stage, 'appeal_status', event.target.value)
                              if (event.target.value !== 'concluido') updateEdit(stage, 'status', 'em_andamento')
                            }}
                            className="block w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                          >
                            {APPEAL_STATUS_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-sky-700">Use esta situação para acompanhar o caminho entre o cadastro no SEI e o resultado da junta.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-600">E-mail do cadastro SEI</p>
                            <input
                              type="email"
                              value={(edit.data.cadastro_sei as string) ?? ''}
                              onChange={e => updateData(stage, 'cadastro_sei', e.target.value)}
                              placeholder="email@exemplo.com"
                              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-600">Protocolo</p>
                            <input
                              type="text"
                              value={(edit.data.protocolo as string) ?? ''}
                              onChange={e => updateData(stage, 'protocolo', e.target.value)}
                              placeholder="Nº do protocolo SEI"
                              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-600">Data do protocolo</p>
                            <input
                              type="date"
                              value={(edit.data.appeal_filed_at as string) ?? ''}
                              onChange={e => updateData(stage, 'appeal_filed_at', e.target.value)}
                              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Restrições determinadas pela junta</p>
                          <input
                            type="text"
                            value={(edit.data.restricoes as string) ?? ''}
                            onChange={e => updateData(stage, 'restricoes', e.target.value)}
                            placeholder="Códigos registrados, ex.: A, D, F"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-400">Copie os códigos do resultado; não os deduza pela deficiência.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: 'requires_practical_exam', label: 'Exame prático determinado?' },
                            { key: 'requires_adapted_vehicle', label: 'Veículo adaptado determinado?' },
                          ].map(field => (
                            <div key={field.key} className="space-y-1.5">
                              <p className="text-xs font-semibold text-slate-600">{field.label}</p>
                              <select
                                value={typeof edit.data[field.key] === 'boolean' ? String(edit.data[field.key]) : ''}
                                onChange={e => updateData(stage, field.key, e.target.value === '' ? null : e.target.value === 'true')}
                                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                              >
                                <option value="">Aguardando definição</option>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* exame_pratico */}
                    {stage.stage_key === 'exame_pratico' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600">Modalidade</p>
                          <div className="flex gap-2">
                            {[
                              { value: 'autoescola',      label: 'Autoescola' },
                              { value: 'veiculo_proprio', label: 'Veículo Próprio' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateData(stage, 'modalidade', edit.data.modalidade === opt.value ? null : opt.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                                style={edit.data.modalidade === opt.value
                                  ? { background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' }
                                  : { background: '#fff', color: '#94A3B8', borderColor: '#E2E8F0' }
                                }
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {edit.data.modalidade === 'veiculo_proprio' && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-600">Checklist veículo próprio</p>
                            {[
                              { key: 'cadastro_sei', label: 'Cadastro SEI' },
                              { key: 'anexo_renach', label: 'RENACH' },
                              { key: 'anexo_cnh', label: 'CNH' },
                              { key: 'comprovante_pagamento_exame', legacyKey: 'comprovante_pagamento_35', label: 'Comprovante de pagamento do exame' },
                              { key: 'crlv', label: 'CRLV do veículo' },
                              { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
                            ].map(({ key, legacyKey, label }) => {
                              const checklist = (edit.data.checklist_veiculo_proprio as Record<string, boolean>) ?? {}
                              const checked = !!(checklist[key] || (legacyKey && checklist[legacyKey]))
                              return (
                                <label key={key} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-amber-200 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      updateNestedData(stage, 'checklist_veiculo_proprio', key, e.target.checked)
                                      if (legacyKey) updateNestedData(stage, 'checklist_veiculo_proprio', legacyKey, false)
                                    }}
                                    className="w-4 h-4 rounded text-amber-600 shrink-0"
                                  />
                                  <span className="text-sm text-slate-700">{label}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* emissao_cnh */}
                    {stage.stage_key === 'emissao_cnh' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Restrições (código)</p>
                          <input
                            type="text"
                            value={(edit.data.restricoes as string) ?? ''}
                            onChange={e => updateData(stage, 'restricoes', e.target.value)}
                            placeholder="Códigos emitidos, ex.: B, X, D"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Vencimento da CNH</p>
                          <input
                            type="date"
                            value={(edit.data.vencimento_cnh as string) ?? ''}
                            onChange={e => updateData(stage, 'vencimento_cnh', e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-600">Observações internas</p>
                      <textarea
                        value={edit.notes}
                        onChange={e => updateEdit(stage, 'notes', e.target.value)}
                        placeholder="Notas sobre esta etapa..."
                        rows={2}
                        className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none resize-none"
                      />
                    </div>

                    {/* ── Contextual warnings ──────────────────────── */}
                    {stage.stage_key === 'pericia_medica' && (edit.result === 'reprovado' || edit.status === 'reprovado') && (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          Ao salvar, a etapa <strong>Recurso — Junta Médica</strong> será inserida automaticamente e um prazo de 30 dias será criado no calendário.
                        </p>
                      </div>
                    )}

                    {stage.stage_key === 'emissao_cnh' && edit.status === 'concluido' && (
                      <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800">
                          Ao salvar, o processo será marcado como <strong>Concluído</strong> e o cliente receberá uma notificação sobre a CNH emitida.
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {err && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700">{err}</p>
                      </div>
                    )}

                    {/* ── Actions ──────────────────────────────────── */}
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                      <Button
                        size="sm"
                        loading={isLoading}
                        onClick={() => saveStage(stage)}
                      >
                        Salvar etapa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setActiveId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
