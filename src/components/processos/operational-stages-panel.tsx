'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import {
  getOperationalStageTemplate,
  getOperationalWorkflowDefinition,
  validateOperationalStage,
  type OperationalFieldDefinition,
  type OperationalStageStatus,
} from '@/lib/operational-workflows'
import type { ProcessStage } from '@/types/database'

interface Props {
  processId: string
  processTypeSlug: string
  stages: ProcessStage[]
  jurisdictionState?: string | null
}

type EditState = {
  status: OperationalStageStatus
  scheduledDate: string
  attended: boolean | null
  result: string
  notes: string
  data: Record<string, unknown>
  notifyClient: boolean
}

const STATUS_LABELS: Record<OperationalStageStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  nao_aplicavel: 'Não aplicável',
}

const STATUS_STYLES: Record<OperationalStageStatus, string> = {
  pendente: 'border-slate-200 bg-slate-50 text-slate-600',
  em_andamento: 'border-amber-200 bg-amber-50 text-amber-700',
  concluido: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  aprovado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  reprovado: 'border-red-200 bg-red-50 text-red-700',
  nao_aplicavel: 'border-slate-100 bg-slate-50 text-slate-400',
}

const DEFAULT_STATUSES: OperationalStageStatus[] = ['pendente', 'em_andamento', 'concluido', 'nao_aplicavel']
const RESOLVED_STATUSES = new Set<OperationalStageStatus>(['concluido', 'aprovado', 'reprovado', 'nao_aplicavel'])

function initEdit(stage: ProcessStage): EditState {
  return {
    status: stage.status,
    scheduledDate: stage.scheduled_date ?? '',
    attended: typeof stage.attended === 'boolean' ? stage.attended : null,
    result: stage.result ?? '',
    notes: stage.notes ?? '',
    data: { ...(stage.data ?? {}) },
    notifyClient: false,
  }
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: OperationalFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-xs font-semibold text-slate-700">{field.label}</span>
        <input
          type="checkbox"
          checked={value === true}
          onChange={event => onChange(event.target.checked)}
          className="h-4 w-4 rounded text-amber-600"
        />
      </label>
    )
  }

  const sharedClass = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none'
  return (
    <label className={cn('space-y-1.5', field.type === 'textarea' && 'sm:col-span-2')}>
      <span className="block text-xs font-semibold text-slate-600">
        {field.label}{(field.requiredOnResolve || field.mustBeTrueOnResolve) ? ' *' : ''}
      </span>
      {field.type === 'select' ? (
        <select value={String(value ?? '')} onChange={event => onChange(event.target.value)} className={sharedClass}>
          <option value="">Selecione...</option>
          {(field.options ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={String(value ?? '')}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={3}
          maxLength={5000}
          className={cn(sharedClass, 'resize-none')}
        />
      ) : (
        <input
          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={sharedClass}
        />
      )}
      {field.help && <span className="block text-[10px] leading-relaxed text-slate-400">{field.help}</span>}
    </label>
  )
}

export function OperationalStagesPanel({ processId, processTypeSlug, stages, jurisdictionState }: Props) {
  const router = useRouter()
  const workflow = getOperationalWorkflowDefinition(processTypeSlug)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!workflow) return null

  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  const completed = sortedStages.filter(stage => RESOLVED_STATUSES.has(stage.status)).length
  const progress = sortedStages.length > 0 ? Math.round((completed / sortedStages.length) * 100) : 0

  const getEdit = (stage: ProcessStage) => edits[stage.id] ?? initEdit(stage)
  const updateEdit = <K extends keyof EditState>(stage: ProcessStage, key: K, value: EditState[K]) => {
    setEdits(previous => ({
      ...previous,
      [stage.id]: { ...(previous[stage.id] ?? initEdit(stage)), [key]: value },
    }))
  }
  const updateData = (stage: ProcessStage, key: string, value: unknown) => {
    setEdits(previous => {
      const current = previous[stage.id] ?? initEdit(stage)
      return { ...previous, [stage.id]: { ...current, data: { ...current.data, [key]: value } } }
    })
  }
  const updateChecklist = (stage: ProcessStage, key: string, checked: boolean) => {
    setEdits(previous => {
      const current = previous[stage.id] ?? initEdit(stage)
      const checklist = current.data.checklist && typeof current.data.checklist === 'object'
        ? current.data.checklist as Record<string, boolean>
        : {}
      return {
        ...previous,
        [stage.id]: { ...current, data: { ...current.data, checklist: { ...checklist, [key]: checked } } },
      }
    })
  }

  const initialize = async () => {
    setInitializing(true)
    setErrors(previous => ({ ...previous, initialize: '' }))
    try {
      const response = await fetch(`/api/processos/${processId}/operational-workflow`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível criar as etapas.')
      router.refresh()
    } catch (error) {
      setErrors(previous => ({ ...previous, initialize: error instanceof Error ? error.message : 'Não foi possível criar as etapas.' }))
    } finally {
      setInitializing(false)
    }
  }

  const saveStage = async (stage: ProcessStage) => {
    const template = getOperationalStageTemplate(processTypeSlug, stage.stage_key)
    const edit = getEdit(stage)
    if (!template) return

    const validationError = validateOperationalStage({
      template,
      status: edit.status,
      scheduledDate: edit.scheduledDate || null,
      attended: edit.attended,
      result: edit.result || null,
      data: edit.data,
    })
    if (validationError) {
      setErrors(previous => ({ ...previous, [stage.id]: validationError }))
      return
    }

    setLoadingId(stage.id)
    setErrors(previous => ({ ...previous, [stage.id]: '' }))
    try {
      const response = await fetch(`/api/processos/${processId}/stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: edit.status,
          scheduledDate: edit.scheduledDate || null,
          attended: edit.attended,
          result: edit.result || null,
          notes: edit.notes || null,
          data: edit.data,
          notifyClient: edit.notifyClient,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível salvar a etapa.')
      setActiveId(null)
      router.refresh()
    } catch (error) {
      setErrors(previous => ({ ...previous, [stage.id]: error instanceof Error ? error.message : 'Não foi possível salvar a etapa.' }))
    } finally {
      setLoadingId(null)
    }
  }

  if (sortedStages.length === 0) {
    return (
      <div className="space-y-3 p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Workflow operacional ainda não inicializado</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">Serão criadas {workflow.stages.length} etapas com checklists próprios para {workflow.title}.</p>
        </div>
        {errors.initialize && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errors.initialize}</p>}
        <Button onClick={initialize} loading={initializing} className="w-full">Inicializar etapas</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
        <p className="text-xs font-bold text-sky-900">{workflow.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-sky-700">{workflow.scopeNote}</p>
        {jurisdictionState && <p className="mt-1 text-[10px] font-semibold text-sky-600">Jurisdição cadastrada: {jurisdictionState}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-40 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Progresso operacional</span>
            <span className="font-bold text-slate-900">{completed}/{sortedStages.length} · {progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={initialize} disabled={initializing}>
          {initializing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar
        </Button>
      </div>

      <div className="space-y-2.5">
        {sortedStages.map((stage, index) => {
          const template = getOperationalStageTemplate(processTypeSlug, stage.stage_key)
          const edit = getEdit(stage)
          const isActive = activeId === stage.id
          const isResolved = RESOLVED_STATUSES.has(stage.status)
          const checklist = edit.data.checklist && typeof edit.data.checklist === 'object'
            ? edit.data.checklist as Record<string, boolean>
            : {}
          const checklistDone = (template?.checklist ?? []).filter(item => checklist[item.key]).length

          return (
            <div key={stage.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setActiveId(isActive ? null : stage.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isResolved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
                )}>
                  {isResolved ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-slate-400">
                    {stage.scheduled_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(stage.scheduled_date)}</span>}
                    {(template?.checklist?.length ?? 0) > 0 && <span>{checklistDone}/{template?.checklist?.length} itens</span>}
                    {stage.notes && <span className="max-w-48 truncate">{stage.notes}</span>}
                  </div>
                </div>
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-bold', STATUS_STYLES[stage.status])}>{STATUS_LABELS[stage.status]}</span>
                {isActive ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {isActive && template && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-4">
                  <div>
                    <p className="text-xs leading-relaxed text-slate-500">{template.description}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Status da etapa</p>
                    <div className="flex flex-wrap gap-2">
                      {(template.allowedStatuses ?? DEFAULT_STATUSES).map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateEdit(stage, 'status', status)}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                            edit.status === status ? STATUS_STYLES[status] : 'border-slate-200 bg-white text-slate-400',
                          )}
                        >
                          {STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {template.hasScheduledDate && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="block text-xs font-semibold text-slate-600">Data agendada</span>
                        <input
                          type="date"
                          value={edit.scheduledDate}
                          onChange={event => updateEdit(stage, 'scheduledDate', event.target.value)}
                          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </label>
                      {template.hasAttendance && (
                        <label className="space-y-1.5">
                          <span className="block text-xs font-semibold text-slate-600">Comparecimento</span>
                          <select
                            value={edit.attended === null ? '' : edit.attended ? 'sim' : 'nao'}
                            onChange={event => updateEdit(stage, 'attended', event.target.value === '' ? null : event.target.value === 'sim')}
                            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                          >
                            <option value="">Aguardando registro</option>
                            <option value="sim">Compareceu</option>
                            <option value="nao">Não compareceu</option>
                          </select>
                        </label>
                      )}
                    </div>
                  )}

                  {(template.fields?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {template.fields?.map(field => (
                        <FieldControl
                          key={field.key}
                          field={field}
                          value={edit.data[field.key]}
                          onChange={value => updateData(stage, field.key, value)}
                        />
                      ))}
                    </div>
                  )}

                  {(template.checklist?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-amber-700" />
                        <p className="text-xs font-semibold text-slate-700">Checklist</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {template.checklist?.map(item => (
                          <label key={item.key} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                            <input
                              type="checkbox"
                              checked={checklist[item.key] === true}
                              onChange={event => updateChecklist(stage, item.key, event.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded text-amber-600"
                            />
                            <span className="text-xs leading-relaxed text-slate-700">
                              {item.label}{item.requiredOnResolve === false ? <span className="text-slate-400"> · quando aplicável</span> : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {(template.resultOptions?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600">Resultado</p>
                      <div className="flex flex-wrap gap-2">
                        {template.resultOptions?.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              updateEdit(stage, 'result', option.value)
                              updateEdit(stage, 'status', option.stageStatus)
                            }}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
                              edit.result === option.value
                                ? option.stageStatus === 'reprovado' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-400',
                            )}
                          >
                            {option.stageStatus === 'reprovado' ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-600">Observações internas</span>
                    <textarea
                      value={edit.notes}
                      onChange={event => updateEdit(stage, 'notes', event.target.value)}
                      rows={2}
                      maxLength={5000}
                      className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={edit.notifyClient}
                      onChange={event => updateEdit(stage, 'notifyClient', event.target.checked)}
                      className="h-4 w-4 rounded text-amber-600"
                    />
                    <Bell className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-600">Notificar o cliente sobre esta atualização</span>
                  </label>

                  {errors[stage.id] && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <p className="text-xs text-red-700">{errors[stage.id]}</p>
                    </div>
                  )}

                  <div className="flex gap-2 border-t border-slate-100 pt-3">
                    <Button size="sm" loading={loadingId === stage.id} onClick={() => saveStage(stage)}>Salvar etapa</Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {workflow.sources.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <Scale className="h-3.5 w-3.5" /> Referências oficiais usadas na base
          </summary>
          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            {workflow.sources.map(source => (
              <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-700 hover:underline">
                <ExternalLink className="h-3 w-3" /> {source.title}
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

