import 'server-only'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  DocumentStatus,
  EventStatus,
  EventType,
  HistoryActionType,
  NotificationType,
  ProcessStatus,
  StageStatus,
} from '@/types/database'

export interface ClientPortalProfile {
  id: string
  name: string
}

export interface ClientPortalClient {
  id: string
  name: string
  cpf: string | null
  phone: string | null
  email: string | null
}

export interface ClientPortalProcessType {
  id?: string
  name: string
  slug: string
  color: string | null
}

export interface ClientPortalProcess {
  id: string
  title: string | null
  protocol: string | null
  status: ProcessStatus
  started_at: string | null
  completed_at: string | null
  renewal_date: string | null
  created_at: string
  updated_at: string
  process_types: ClientPortalProcessType | null
  custom_fields?: ClientPortalCustomField[]
}

export interface ClientPortalCustomField {
  id: string
  field_name: string
  field_label: string
  field_type: string
  field_value: string | null
  sort_order: number
}

export interface ClientPortalStage {
  id: string
  process_id: string
  stage_key: string
  label: string
  sort_order: number
  status: StageStatus
  scheduled_date: string | null
  due_date: string | null
  result: string | null
  completed_at: string | null
  updated_at: string
  data: Record<string, unknown>
}

export interface ClientPortalDocument {
  id: string
  process_id: string | null
  process_stage_id: string | null
  document_type: string | null
  file_name: string
  file_url: string
  status: DocumentStatus
  rejection_reason: string | null
  created_at: string
  processes?: {
    id: string
    process_types: { name: string } | null
  } | null
}

export interface ClientPortalHistory {
  id: string
  action_type: HistoryActionType
  created_at: string
}

export interface ClientPortalEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  event_type: EventType
  status: EventStatus
  process_id: string | null
  processes?: {
    id: string
    process_types: { name: string; color: string | null } | null
  } | null
}

export interface ClientPortalNotification {
  id: string
  user_id: string
  client_id: string | null
  process_id: string | null
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  source_key: string | null
  available_at: string
  is_canceled: boolean
  created_at: string
  clients?: { name: string } | null
  processes?: { id: string; process_types: { name: string } | null } | null
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function relationValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function sanitizeMedicalRequirements(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.flatMap(item => {
    const requirement = recordValue(item)
    if (typeof requirement.id !== 'string' || typeof requirement.status !== 'string') return []

    return [{
      id: requirement.id,
      type: typeof requirement.type === 'string' ? requirement.type : 'exigencia_medica',
      title: typeof requirement.title === 'string' ? requirement.title : 'Exigência médica',
      status: requirement.status,
      requested_at: typeof requirement.requested_at === 'string' ? requirement.requested_at : null,
      follow_up_date: typeof requirement.follow_up_date === 'string' ? requirement.follow_up_date : null,
      completed_at: typeof requirement.completed_at === 'string' ? requirement.completed_at : null,
    }]
  })
}

function sanitizeStageData(stageKey: string, value: unknown): Record<string, unknown> {
  const data = recordValue(value)

  if (stageKey === 'checklist_documentos') {
    const safeKeys = ['cnh', 'laudo_medico', 'acesso_gov_validado', 'comprovante_endereco', 'email']
    return Object.fromEntries(safeKeys.map(key => [key, data[key] === true]))
  }

  if (stageKey === 'pericia_medica' || stageKey === 'recurso_junta_medica') {
    const safe: Record<string, unknown> = {
      medical_requirements: sanitizeMedicalRequirements(data.medical_requirements),
    }
    if (stageKey === 'recurso_junta_medica' && typeof data.appeal_status === 'string') {
      safe.appeal_status = data.appeal_status
    }
    return safe
  }

  return {}
}

function normalizeProcess(row: Record<string, unknown>): ClientPortalProcess {
  const processType = relationValue(row.process_types as ClientPortalProcessType | ClientPortalProcessType[] | null)
  return {
    id: String(row.id),
    title: typeof row.title === 'string' ? row.title : null,
    protocol: typeof row.protocol === 'string' ? row.protocol : null,
    status: row.status as ProcessStatus,
    started_at: typeof row.started_at === 'string' ? row.started_at : null,
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    renewal_date: typeof row.renewal_date === 'string' ? row.renewal_date : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    process_types: processType,
  }
}

export async function requireClientPortalContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .eq('role', 'cliente')
    .eq('is_active', true)
    .maybeSingle()

  if (!profile) redirect('/login?error=acesso_inativo')

  const { data: client } = await admin
    .from('clients')
    .select('id, name, cpf, phone, email')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!client) redirect('/login?error=acesso_inativo')

  return {
    admin,
    profile: profile as ClientPortalProfile,
    client: client as ClientPortalClient,
  }
}

export async function getClientPortalHome() {
  const { admin, profile, client } = await requireClientPortalContext()
  const now = new Date().toISOString()

  const [recent, total, concluded, inProgress, notifications, unread] = await Promise.all([
    admin.from('processes')
      .select('id, title, protocol, status, started_at, completed_at, renewal_date, created_at, updated_at, process_types(id, name, slug, color)')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('processes').select('*', { count: 'exact', head: true }).eq('client_id', client.id),
    admin.from('processes').select('*', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'concluido'),
    admin.from('processes').select('*', { count: 'exact', head: true }).eq('client_id', client.id).not('status', 'in', '(concluido,cancelado)'),
    admin.from('notifications')
      .select('id, user_id, client_id, process_id, title, message, type, is_read, source_key, available_at, is_canceled, created_at')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .eq('is_canceled', false)
      .lte('available_at', now)
      .order('available_at', { ascending: false })
      .limit(5),
    admin.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .eq('is_canceled', false)
      .lte('available_at', now),
  ])

  if (recent.error || total.error || concluded.error || inProgress.error || notifications.error || unread.error) {
    throw new Error('Não foi possível carregar o portal do cliente.')
  }

  return {
    profile,
    client,
    processes: (recent.data ?? []).map(row => normalizeProcess(row as unknown as Record<string, unknown>)),
    notifications: (notifications.data ?? []) as ClientPortalNotification[],
    counts: {
      total: total.count ?? 0,
      concluded: concluded.count ?? 0,
      inProgress: inProgress.count ?? 0,
      unread: unread.count ?? 0,
    },
  }
}

export async function getClientPortalProcesses() {
  const { admin, client } = await requireClientPortalContext()
  const { data, error } = await admin
    .from('processes')
    .select('id, title, protocol, status, started_at, completed_at, renewal_date, created_at, updated_at, process_types(id, name, slug, color)')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Não foi possível carregar os processos.')
  const processes = (data ?? []).map(row => normalizeProcess(row as unknown as Record<string, unknown>))
  const cnhIds = processes.filter(process => process.process_types?.slug === 'cnh_especial').map(process => process.id)

  const { data: stageRows, error: stageError } = cnhIds.length > 0
    ? await admin.from('process_stages')
        .select('process_id, stage_key, label, sort_order, status')
        .in('process_id', cnhIds)
        .order('sort_order')
    : { data: [], error: null }

  if (stageError) throw new Error('Não foi possível carregar o andamento dos processos.')
  return { processes, stages: stageRows ?? [] }
}

export async function getClientPortalProcess(processId: string) {
  const { admin, client } = await requireClientPortalContext()
  const { data: processRow, error: processError } = await admin
    .from('processes')
    .select('id, title, protocol, status, started_at, completed_at, renewal_date, created_at, updated_at, process_types(id, name, slug, color)')
    .eq('id', processId)
    .eq('client_id', client.id)
    .maybeSingle()

  if (processError) throw new Error('Não foi possível carregar o processo.')
  if (!processRow) return null

  const [customFields, history, documents, events, stages] = await Promise.all([
    admin.from('process_custom_fields')
      .select('id, field_name, field_label, field_type, field_value, sort_order')
      .eq('process_id', processId)
      .eq('client_visible', true)
      .order('sort_order'),
    admin.from('process_history')
      .select('id, action_type, created_at')
      .eq('process_id', processId)
      .eq('client_visible', true)
      .order('created_at', { ascending: false })
      .limit(15),
    admin.from('documents')
      .select('id, process_id, process_stage_id, document_type, file_name, file_url, status, rejection_reason, created_at')
      .eq('process_id', processId)
      .eq('visibility', 'client_visible')
      .order('created_at', { ascending: false }),
    admin.from('calendar_events')
      .select('id, title, description, event_date, event_time, event_type, status, process_id')
      .eq('process_id', processId)
      .eq('visibility', 'client_visible')
      .neq('status', 'canceled')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
      .limit(5),
    admin.from('process_stages')
      .select('id, process_id, stage_key, label, sort_order, status, scheduled_date, due_date, result, completed_at, updated_at, data')
      .eq('process_id', processId)
      .order('sort_order'),
  ])

  if (customFields.error || history.error || documents.error || events.error || stages.error) {
    throw new Error('Não foi possível carregar todos os dados do processo.')
  }

  const process = normalizeProcess(processRow as unknown as Record<string, unknown>)
  process.custom_fields = (customFields.data ?? []) as ClientPortalCustomField[]

  return {
    client,
    process,
    history: (history.data ?? []) as ClientPortalHistory[],
    documents: (documents.data ?? []) as ClientPortalDocument[],
    events: (events.data ?? []) as ClientPortalEvent[],
    stages: (stages.data ?? []).map(stage => ({
      ...stage,
      data: sanitizeStageData(stage.stage_key, stage.data),
    })) as ClientPortalStage[],
  }
}

export async function getClientPortalDocuments() {
  const { admin, client } = await requireClientPortalContext()
  const { data, error } = await admin
    .from('documents')
    .select('id, process_id, process_stage_id, document_type, file_name, file_url, status, rejection_reason, created_at, processes(id, process_types(name))')
    .eq('client_id', client.id)
    .eq('visibility', 'client_visible')
    .order('created_at', { ascending: false })

  if (error) throw new Error('Não foi possível carregar os documentos.')
  return (data ?? []) as unknown as ClientPortalDocument[]
}

export async function getClientPortalEvents() {
  const { admin, client } = await requireClientPortalContext()
  const { data, error } = await admin
    .from('calendar_events')
    .select('id, title, description, event_date, event_time, event_type, status, process_id, processes:processes!calendar_events_process_id_fkey(id, process_types(name, color))')
    .eq('client_id', client.id)
    .eq('visibility', 'client_visible')
    .neq('status', 'canceled')
    .order('event_date', { ascending: true })

  if (error) throw new Error('Não foi possível carregar a agenda.')
  return (data ?? []) as unknown as ClientPortalEvent[]
}

export async function getClientPortalNotifications() {
  const { admin, profile } = await requireClientPortalContext()
  const { data, error } = await admin
    .from('notifications')
    .select('id, user_id, client_id, process_id, title, message, type, is_read, source_key, available_at, is_canceled, created_at, clients(name), processes(id, process_types(name))')
    .eq('user_id', profile.id)
    .eq('is_canceled', false)
    .lte('available_at', new Date().toISOString())
    .order('available_at', { ascending: false })
    .limit(50)

  if (error) throw new Error('Não foi possível carregar as notificações.')
  return { profile, notifications: (data ?? []) as unknown as ClientPortalNotification[] }
}
