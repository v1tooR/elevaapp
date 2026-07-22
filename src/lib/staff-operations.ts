import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { ProcessStatus, UserRole } from '@/types/database'

const ACTIVE_STATUSES = new Set<ProcessStatus>([
  'aberto',
  'em_andamento',
  'aguardando_documentos',
  'em_analise',
  'aguardando_orgao',
])

const CLOSED_STAGE_STATUSES = new Set(['concluido', 'aprovado', 'reprovado', 'nao_aplicavel'])
const OPEN_MEDICAL_STATUSES = new Set(['pendente', 'aguardando_exame', 'aguardando_retorno', 'em_andamento'])

export type RoutineCategory =
  | 'etapa_vencida'
  | 'prazo_proximo'
  | 'documento_analise'
  | 'sem_responsavel'
  | 'autenticacao_cliente'
  | 'exigencia_medica'
  | 'processo_parado'

export interface RoutineItem {
  id: string
  category: RoutineCategory
  severity: 'critical' | 'high' | 'medium'
  title: string
  detail: string
  href: string
  dueDate: string | null
  processId: string | null
  clientName: string
  responsibleName: string | null
}

export interface OperationalStageSummary {
  id: string
  stage_key: string
  label: string
  sort_order: number
  status: string
  scheduled_date: string | null
  due_date: string | null
  updated_at: string
  data: Record<string, unknown>
}

export interface OperationalProcessSummary {
  id: string
  status: ProcessStatus
  protocol: string | null
  responsible_user_id: string | null
  action_due_date: string | null
  next_action: string | null
  action_owner: string | null
  blocked_reason: string | null
  last_client_update_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  clients: { id: string; name: string; cpf: string | null; gov_access_status: string } | null
  process_types: { id: string; name: string; slug: string; color: string | null } | null
  responsible_user: { id: string; name: string } | null
}

interface ProcessOperationalContext {
  process: OperationalProcessSummary
  stages: OperationalStageSummary[]
  lastActivityAt?: string | null
}

function dateKeyInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function maxDate(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
}

export function getProcessOperationalSummary({ process, stages, lastActivityAt }: ProcessOperationalContext) {
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  const currentStage = sortedStages.find(stage => !CLOSED_STAGE_STATUSES.has(stage.status)) ?? null
  const data = asRecord(currentStage?.data)
  const medicalRequirements = Array.isArray(data.medical_requirements) ? data.medical_requirements : []
  const openMedicalRequirement = medicalRequirements
    .map(asRecord)
    .find(requirement => OPEN_MEDICAL_STATUSES.has(String(requirement.status ?? 'pendente')))
  const actor = process.action_owner
    ?? (process.status === 'aguardando_documentos'
      ? 'cliente'
      : process.status === 'aguardando_orgao'
        ? 'orgao'
        : 'equipe')
  const dueDate = process.action_due_date ?? currentStage?.due_date ?? currentStage?.scheduled_date ?? null
  const lastActivity = maxDate(
    process.updated_at,
    lastActivityAt,
    ...sortedStages.map(stage => stage.updated_at),
  )

  return {
    currentStage,
    nextAction: process.next_action ?? currentStage?.label ?? (ACTIVE_STATUSES.has(process.status) ? 'Definir próxima ação' : 'Processo finalizado'),
    actor,
    dueDate,
    blocker: process.blocked_reason
      ?? (openMedicalRequirement ? String(openMedicalRequirement.title ?? 'Exigência médica aberta') : null),
    lastActivity,
  }
}

function normalizeProcess(row: Record<string, unknown>): OperationalProcessSummary {
  return {
    id: String(row.id),
    status: row.status as ProcessStatus,
    protocol: typeof row.protocol === 'string' ? row.protocol : null,
    responsible_user_id: typeof row.responsible_user_id === 'string' ? row.responsible_user_id : null,
    action_due_date: typeof row.action_due_date === 'string' ? row.action_due_date : null,
    next_action: typeof row.next_action === 'string' ? row.next_action : null,
    action_owner: typeof row.action_owner === 'string' ? row.action_owner : null,
    blocked_reason: typeof row.blocked_reason === 'string' ? row.blocked_reason : null,
    last_client_update_at: typeof row.last_client_update_at === 'string' ? row.last_client_update_at : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    clients: relationOne(row.clients as OperationalProcessSummary['clients'] | OperationalProcessSummary['clients'][]),
    process_types: relationOne(row.process_types as OperationalProcessSummary['process_types'] | OperationalProcessSummary['process_types'][]),
    responsible_user: relationOne(row.responsible_user as OperationalProcessSummary['responsible_user'] | OperationalProcessSummary['responsible_user'][]),
  }
}

export async function getStaffOperations() {
  const profile = await requireAuth(['super_admin', 'admin', 'analista'])
  const supabase = await createClient()
  const today = dateKeyInSaoPaulo()
  const nextSevenDays = addDays(today, 7)
  const stalledBefore = new Date()
  stalledBefore.setDate(stalledBefore.getDate() - 7)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let processQuery = supabase
    .from('processes')
    .select(`
      id, status, protocol, responsible_user_id, action_due_date, next_action,
      action_owner, blocked_reason, last_client_update_at, created_at, updated_at, completed_at,
      clients(id, name, cpf, gov_access_status),
      process_types(id, name, slug, color),
      responsible_user:profiles!responsible_user_id(id, name)
    `)
    .order('updated_at', { ascending: false })

  if (profile.role === 'analista') processQuery = processQuery.eq('responsible_user_id', profile.id)

  const [{ data: processRows, error: processError }, { data: staffRows }, { data: leadRows }] = await Promise.all([
    processQuery,
    supabase.from('profiles').select('id, name, role, is_active').in('role', ['super_admin', 'admin', 'analista']).eq('is_active', true).order('name'),
    profile.role === 'analista'
      ? supabase.from('leads').select('id, status, assigned_to').eq('assigned_to', profile.id).in('status', ['novo', 'em_atendimento'])
      : supabase.from('leads').select('id, status, assigned_to').in('status', ['novo', 'em_atendimento']),
  ])

  if (processError) throw new Error('Não foi possível carregar a operação.')
  const processes = (processRows ?? []).map(row => normalizeProcess(row as unknown as Record<string, unknown>))
  const processIds = processes.map(process => process.id)

  const emptyResult = { data: [], error: null }
  const [stageResult, documentResult, eventResult, historyResult] = await Promise.all([
    processIds.length
      ? supabase.from('process_stages').select('id, process_id, stage_key, label, sort_order, status, scheduled_date, due_date, updated_at, data').in('process_id', processIds)
      : emptyResult,
    processIds.length
      ? supabase.from('documents').select('id, process_id, client_id, file_name, status, review_responsible_id, created_at, processes(id, responsible_user_id), clients(name)').in('process_id', processIds).in('status', ['received', 'under_review'])
      : emptyResult,
    processIds.length
      ? supabase.from('calendar_events').select('id, process_id, client_id, title, event_date, event_type, responsible_user_id, clients(name)').in('process_id', processIds).in('status', ['pending', 'in_progress']).lte('event_date', nextSevenDays)
      : emptyResult,
    processIds.length
      ? supabase.from('process_history').select('process_id, created_at').in('process_id', processIds).order('created_at', { ascending: false })
      : emptyResult,
  ])

  const queryError = [stageResult.error, documentResult.error, eventResult.error, historyResult.error].find(Boolean)
  if (queryError) throw new Error('Não foi possível montar a fila operacional.')

  const stages = (stageResult.data ?? []) as Array<OperationalStageSummary & { process_id: string }>
  const stagesByProcess = new Map<string, OperationalStageSummary[]>()
  for (const stage of stages) {
    const list = stagesByProcess.get(stage.process_id) ?? []
    list.push(stage)
    stagesByProcess.set(stage.process_id, list)
  }

  const historyByProcess = new Map<string, string>()
  for (const row of historyResult.data ?? []) {
    if (!historyByProcess.has(row.process_id)) historyByProcess.set(row.process_id, row.created_at)
  }

  const routineItems: RoutineItem[] = []
  const pushItem = (item: RoutineItem) => routineItems.push(item)

  for (const process of processes) {
    if (!ACTIVE_STATUSES.has(process.status)) continue
    const clientName = process.clients?.name ?? 'Cliente não informado'
    const responsibleName = process.responsible_user?.name ?? null
    const processStages = stagesByProcess.get(process.id) ?? []
    const operational = getProcessOperationalSummary({
      process,
      stages: processStages,
      lastActivityAt: historyByProcess.get(process.id),
    })

    for (const stage of processStages) {
      const due = stage.due_date ?? stage.scheduled_date
      if (!CLOSED_STAGE_STATUSES.has(stage.status) && due && due < today) {
        pushItem({
          id: `stage:${stage.id}`,
          category: 'etapa_vencida',
          severity: 'critical',
          title: `Etapa vencida: ${stage.label}`,
          detail: `Prazo em ${due.split('-').reverse().join('/')}`,
          href: `/processos/${process.id}`,
          dueDate: due,
          processId: process.id,
          clientName,
          responsibleName,
        })
      }

      const data = asRecord(stage.data)
      const requirements = Array.isArray(data.medical_requirements) ? data.medical_requirements : []
      for (const requirementValue of requirements) {
        const requirement = asRecord(requirementValue)
        if (!OPEN_MEDICAL_STATUSES.has(String(requirement.status ?? 'pendente'))) continue
        pushItem({
          id: `medical:${stage.id}:${String(requirement.id ?? requirement.title ?? 'open')}`,
          category: 'exigencia_medica',
          severity: 'high',
          title: String(requirement.title ?? 'Exigência médica aberta'),
          detail: stage.label,
          href: `/processos/${process.id}`,
          dueDate: typeof requirement.follow_up_date === 'string' ? requirement.follow_up_date : null,
          processId: process.id,
          clientName,
          responsibleName,
        })
      }
    }

    if (!process.responsible_user_id && profile.role !== 'analista') {
      pushItem({
        id: `unassigned:${process.id}`,
        category: 'sem_responsavel',
        severity: 'high',
        title: 'Processo sem responsável',
        detail: process.process_types?.name ?? 'Processo',
        href: `/processos/${process.id}`,
        dueDate: operational.dueDate,
        processId: process.id,
        clientName,
        responsibleName: null,
      })
    }

    if (process.clients && ['aguardando_cliente', 'com_pendencia'].includes(process.clients.gov_access_status)) {
      pushItem({
        id: `auth:${process.id}`,
        category: 'autenticacao_cliente',
        severity: 'high',
        title: 'Cliente precisa realizar autenticação',
        detail: process.clients.gov_access_status === 'com_pendencia' ? 'Há uma pendência de acesso' : 'Aguardando o cliente acessar',
        href: `/clientes/${process.clients.id}`,
        dueDate: operational.dueDate,
        processId: process.id,
        clientName,
        responsibleName,
      })
    }

    if (operational.lastActivity && new Date(operational.lastActivity) < stalledBefore) {
      pushItem({
        id: `stalled:${process.id}`,
        category: 'processo_parado',
        severity: 'medium',
        title: 'Processo parado há mais de 7 dias',
        detail: operational.nextAction,
        href: `/processos/${process.id}`,
        dueDate: operational.dueDate,
        processId: process.id,
        clientName,
        responsibleName,
      })
    }
  }

  for (const document of documentResult.data ?? []) {
    const processId = document.process_id
    const process = processes.find(item => item.id === processId)
    if (!process) continue
    if (profile.role === 'analista' && document.review_responsible_id && document.review_responsible_id !== profile.id) continue
    pushItem({
      id: `document:${document.id}`,
      category: 'documento_analise',
      severity: document.status === 'received' ? 'high' : 'medium',
      title: `Revisar documento: ${document.file_name}`,
      detail: document.status === 'received' ? 'Documento recebido' : 'Revisão em andamento',
      href: `/documentos?q=${encodeURIComponent(document.file_name)}`,
      dueDate: null,
      processId,
      clientName: process.clients?.name ?? 'Cliente não informado',
      responsibleName: process.responsible_user?.name ?? null,
    })
  }

  for (const event of eventResult.data ?? []) {
    const process = processes.find(item => item.id === event.process_id)
    if (!process) continue
    pushItem({
      id: `event:${event.id}`,
      category: 'prazo_proximo',
      severity: event.event_date < today ? 'critical' : event.event_date === today ? 'high' : 'medium',
      title: event.title,
      detail: event.event_date < today ? 'Prazo vencido' : 'Prazo nos próximos 7 dias',
      href: event.process_id ? `/processos/${event.process_id}` : '/calendario',
      dueDate: event.event_date,
      processId: event.process_id,
      clientName: process.clients?.name ?? 'Cliente não informado',
      responsibleName: process.responsible_user?.name ?? null,
    })
  }

  const severityOrder = { critical: 0, high: 1, medium: 2 }
  routineItems.sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity]
    if (severity !== 0) return severity
    return (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31')
  })

  const activeProcesses = processes.filter(process => ACTIVE_STATUSES.has(process.status))
  const completedLast30Days = processes.filter(process =>
    process.status === 'concluido'
      && process.completed_at
      && new Date(process.completed_at) >= thirtyDaysAgo
  ).length
  const workload = (staffRows ?? []).map(staff => ({
    id: staff.id,
    name: staff.name,
    role: staff.role as UserRole,
    activeProcesses: activeProcesses.filter(process => process.responsible_user_id === staff.id).length,
    urgentItems: routineItems.filter(item => item.responsibleName === staff.name && item.severity !== 'medium').length,
  }))

  return {
    profile,
    today,
    processes,
    stagesByProcess,
    routineItems,
    workload,
    metrics: {
      activeProcesses: activeProcesses.length,
      clientsInService: new Set(activeProcesses.map(process => process.clients?.id).filter(Boolean)).size,
      overdue: routineItems.filter(item => item.severity === 'critical').length,
      dueSoon: routineItems.filter(item => item.category === 'prazo_proximo' && item.severity !== 'critical').length,
      documentsForReview: routineItems.filter(item => item.category === 'documento_analise').length,
      unassigned: routineItems.filter(item => item.category === 'sem_responsavel').length,
      medicalRequirements: routineItems.filter(item => item.category === 'exigencia_medica').length,
      stalled: routineItems.filter(item => item.category === 'processo_parado').length,
      openLeads: leadRows?.length ?? 0,
      completedLast30Days,
    },
  }
}

export function activeProcessStatuses() {
  return [...ACTIVE_STATUSES]
}
