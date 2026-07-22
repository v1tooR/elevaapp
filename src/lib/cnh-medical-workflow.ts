export const APPEAL_STATUS_VALUES = [
  'cadastro_sei_pendente',
  'recurso_em_preparacao',
  'recurso_protocolado',
  'aguardando_agendamento',
  'junta_agendada',
  'aguardando_resultado',
  'concluido',
] as const

export type AppealStatus = (typeof APPEAL_STATUS_VALUES)[number]

export const APPEAL_STATUS_OPTIONS: ReadonlyArray<{ value: AppealStatus; label: string }> = [
  { value: 'cadastro_sei_pendente', label: 'Cadastro no SEI pendente' },
  { value: 'recurso_em_preparacao', label: 'Preparando o recurso' },
  { value: 'recurso_protocolado', label: 'Recurso protocolado' },
  { value: 'aguardando_agendamento', label: 'Aguardando agendamento da junta' },
  { value: 'junta_agendada', label: 'Junta médica agendada' },
  { value: 'aguardando_resultado', label: 'Aguardando resultado da junta' },
  { value: 'concluido', label: 'Recurso concluído' },
]

export const APPEAL_STATUS_LABELS = Object.fromEntries(
  APPEAL_STATUS_OPTIONS.map(option => [option.value, option.label]),
) as Record<AppealStatus, string>

export const MEDICAL_REQUIREMENT_TYPE_VALUES = ['exame_complementar', 'exigencia_medica'] as const
export type MedicalRequirementType = (typeof MEDICAL_REQUIREMENT_TYPE_VALUES)[number]

export const MEDICAL_REQUIREMENT_TYPE_OPTIONS: ReadonlyArray<{ value: MedicalRequirementType; label: string }> = [
  { value: 'exame_complementar', label: 'Exame complementar' },
  { value: 'exigencia_medica', label: 'Nova exigência médica' },
]

export const MEDICAL_REQUIREMENT_STATUS_VALUES = [
  'pendente',
  'em_andamento',
  'aguardando_retorno',
  'concluida',
  'cancelada',
] as const

export type MedicalRequirementStatus = (typeof MEDICAL_REQUIREMENT_STATUS_VALUES)[number]

export const MEDICAL_REQUIREMENT_STATUS_OPTIONS: ReadonlyArray<{ value: MedicalRequirementStatus; label: string }> = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_retorno', label: 'Aguardando retorno médico' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
]

export const MEDICAL_REQUIREMENT_STATUS_LABELS = Object.fromEntries(
  MEDICAL_REQUIREMENT_STATUS_OPTIONS.map(option => [option.value, option.label]),
) as Record<MedicalRequirementStatus, string>

export type MedicalRequirementHistoryEvent = {
  id: string
  event: 'created' | 'updated' | 'status_changed' | 'migrated'
  status: MedicalRequirementStatus
  occurred_at: string
}

export type MedicalRequirement = {
  id: string
  type: MedicalRequirementType
  title: string
  details: string
  requested_at: string
  due_date: string
  follow_up_date: string
  status: MedicalRequirementStatus
  result: string
  created_at: string
  updated_at: string
  history: MedicalRequirementHistoryEvent[]
}

type StageSnapshot = {
  id: string
  stage_key: string
  scheduled_date?: string | null
  result?: string | null
  updated_at?: string | null
  data?: Record<string, unknown> | null
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const APPEAL_STATUS_SET = new Set<string>(APPEAL_STATUS_VALUES)
const REQUIREMENT_TYPE_SET = new Set<string>(MEDICAL_REQUIREMENT_TYPE_VALUES)
const REQUIREMENT_STATUS_SET = new Set<string>(MEDICAL_REQUIREMENT_STATUS_VALUES)
const RESOLVED_REQUIREMENT_STATUSES = new Set<MedicalRequirementStatus>(['concluida', 'cancelada'])

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeHistory(value: unknown): MedicalRequirementHistoryEvent[] {
  if (!Array.isArray(value)) return []

  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const entry = item as Record<string, unknown>
    const event = stringValue(entry.event)
    const status = stringValue(entry.status)
    const occurredAt = stringValue(entry.occurred_at)
    if (!['created', 'updated', 'status_changed', 'migrated'].includes(event)) return []
    if (!REQUIREMENT_STATUS_SET.has(status) || !occurredAt) return []

    return [{
      id: stringValue(entry.id) || `${occurredAt}:${event}`,
      event: event as MedicalRequirementHistoryEvent['event'],
      status: status as MedicalRequirementStatus,
      occurred_at: occurredAt,
    }]
  })
}

function normalizeRequirement(value: unknown): MedicalRequirement | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const id = stringValue(item.id)
  const type = stringValue(item.type)
  const status = stringValue(item.status)
  if (!id || !REQUIREMENT_TYPE_SET.has(type) || !REQUIREMENT_STATUS_SET.has(status)) return null

  return {
    id,
    type: type as MedicalRequirementType,
    title: stringValue(item.title),
    details: stringValue(item.details),
    requested_at: stringValue(item.requested_at),
    due_date: stringValue(item.due_date),
    follow_up_date: stringValue(item.follow_up_date),
    status: status as MedicalRequirementStatus,
    result: stringValue(item.result),
    created_at: stringValue(item.created_at),
    updated_at: stringValue(item.updated_at),
    history: normalizeHistory(item.history),
  }
}

function buildLegacyRequirement(stage: StageSnapshot): MedicalRequirement | null {
  const data = stage.data ?? {}
  const legacyStatus = stringValue(data.medical_follow_up_status)
  if (!legacyStatus) return null

  const statusMap: Record<string, MedicalRequirementStatus> = {
    complementary_exam_requested: 'pendente',
    complementary_exam_completed: 'aguardando_retorno',
    follow_up_scheduled: 'aguardando_retorno',
    decision_pending: 'em_andamento',
  }
  const status = statusMap[legacyStatus]
  if (!status) return null

  const occurredAt = stage.updated_at || new Date(0).toISOString()
  const examName = stringValue(data.complementary_exam_name).trim()
  const isExam = legacyStatus.startsWith('complementary_exam') || Boolean(examName)

  return {
    id: `legacy-${stage.id}`,
    type: isExam ? 'exame_complementar' : 'exigencia_medica',
    title: examName || (isExam ? 'Exame complementar' : 'Acompanhamento médico'),
    details: 'Registro convertido do acompanhamento médico anterior.',
    requested_at: stringValue(stage.scheduled_date) || occurredAt.slice(0, 10),
    due_date: '',
    follow_up_date: stringValue(data.follow_up_date),
    status,
    result: '',
    created_at: occurredAt,
    updated_at: occurredAt,
    history: [{
      id: `legacy-${stage.id}:migrated`,
      event: 'migrated',
      status,
      occurred_at: occurredAt,
    }],
  }
}

export function isMedicalStage(stageKey: string) {
  return stageKey === 'pericia_medica' || stageKey === 'recurso_junta_medica'
}

export function getMedicalRequirements(stage: StageSnapshot): MedicalRequirement[] {
  const raw = stage.data?.medical_requirements
  if (Array.isArray(raw)) {
    return raw.map(normalizeRequirement).filter((item): item is MedicalRequirement => Boolean(item))
  }

  const legacy = buildLegacyRequirement(stage)
  return legacy ? [legacy] : []
}

export function getOpenMedicalRequirements(stage: StageSnapshot) {
  return getMedicalRequirements(stage).filter(item => !RESOLVED_REQUIREMENT_STATUSES.has(item.status))
}

export function getMedicalRequirementsSummary(stage: StageSnapshot) {
  if (!isMedicalStage(stage.stage_key)) return null
  const open = getOpenMedicalRequirements(stage)
  if (open.length === 0) return null
  if (open.length === 1) return `${open[0].title || 'Exigência médica'} — ${MEDICAL_REQUIREMENT_STATUS_LABELS[open[0].status].toLowerCase()}`
  return `${open.length} exigências médicas em aberto`
}

export function inferAppealStatus(stage: StageSnapshot): AppealStatus {
  const stored = stringValue(stage.data?.appeal_status)
  if (APPEAL_STATUS_SET.has(stored)) return stored as AppealStatus
  if (stage.result === 'aprovado' || stage.result === 'reprovado') return 'concluido'
  if (stage.scheduled_date) return 'junta_agendada'
  if (stringValue(stage.data?.protocolo).trim()) return 'aguardando_agendamento'
  if (stringValue(stage.data?.cadastro_sei).trim()) return 'recurso_em_preparacao'
  return 'cadastro_sei_pendente'
}

export function validateAppealWorkflow(input: {
  data: Record<string, unknown>
  scheduledDate?: string | null
  result?: string | null
  stageStatus?: string | null
}) {
  const status = stringValue(input.data.appeal_status)
  if (!APPEAL_STATUS_SET.has(status)) return 'Informe a situação operacional do recurso.'

  const hasFinalResult = ['aprovado', 'reprovado'].includes(input.result ?? '')
    || ['aprovado', 'reprovado'].includes(input.stageStatus ?? '')
  if (hasFinalResult && status !== 'concluido') {
    return 'Marque a situação operacional como “Recurso concluído” antes de registrar o resultado da junta.'
  }

  const requiresProtocol = [
    'recurso_protocolado',
    'aguardando_agendamento',
    'junta_agendada',
    'aguardando_resultado',
    'concluido',
  ].includes(status)
  if (requiresProtocol && !stringValue(input.data.protocolo).trim()) {
    return 'Informe o número do protocolo SEI para esta situação do recurso.'
  }
  if (requiresProtocol && !DATE_PATTERN.test(stringValue(input.data.appeal_filed_at))) {
    return 'Informe a data em que o recurso foi protocolado no SEI.'
  }

  if (['junta_agendada', 'aguardando_resultado', 'concluido'].includes(status) && !input.scheduledDate) {
    return 'Informe a data da Junta Médica para esta situação do recurso.'
  }
  if (status === 'concluido' && !['aprovado', 'reprovado'].includes(input.result ?? '')) {
    return 'Informe o resultado da Junta Médica antes de concluir o recurso.'
  }

  return null
}

function requirementContent(requirement: MedicalRequirement) {
  return JSON.stringify({
    type: requirement.type,
    title: requirement.title,
    details: requirement.details,
    requested_at: requirement.requested_at,
    due_date: requirement.due_date,
    follow_up_date: requirement.follow_up_date,
    status: requirement.status,
    result: requirement.result,
  })
}

export function mergeMedicalRequirementAudit(
  existing: MedicalRequirement[],
  incoming: MedicalRequirement[],
  occurredAt: string,
) {
  const existingById = new Map(existing.map(item => [item.id, item]))
  const incomingIds = new Set(incoming.map(item => item.id))

  const merged = incoming.map(item => {
    const previous = existingById.get(item.id)
    const changed = !previous || requirementContent(previous) !== requirementContent(item)
    if (!changed && previous) return previous

    const event: MedicalRequirementHistoryEvent = {
      id: `${item.id}:${occurredAt}:${previous ? 'change' : 'created'}`,
      event: !previous ? 'created' : previous.status !== item.status ? 'status_changed' : 'updated',
      status: item.status,
      occurred_at: occurredAt,
    }

    return {
      ...item,
      created_at: previous?.created_at || item.created_at || occurredAt,
      updated_at: occurredAt,
      history: [...(previous?.history ?? []), event],
    }
  })

  // Registros não enviados não são apagados: ficam preservados para auditoria.
  return [...merged, ...existing.filter(item => !incomingIds.has(item.id))]
}
