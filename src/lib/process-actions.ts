import type { ProcessStatus } from '@/types/database'

export type OperationalActor = 'equipe' | 'cliente' | 'orgao' | 'terceiro'
export type OperationalActionCategory =
  | 'agendar'
  | 'solicitar'
  | 'dar_entrada'
  | 'consultar'
  | 'encerrar'
  | 'dar_andamento'
export type OperationalSituation =
  | 'nao_iniciado'
  | 'aguardando_dependencia'
  | 'agendado'
  | 'solicitado'
  | 'aguardando_documento'
  | 'em_andamento'
  | 'em_analise'
  | 'finalizado'
  | 'deferido'
  | 'indeferido'
export type OperationalPriority =
  | 'vencido'
  | 'acao_equipe_com_prazo'
  | 'acao_equipe'
  | 'aguardando_externo'
  | 'aguardando_data'
  | 'sem_acao'
  | 'encerrado'

export const OPERATIONAL_ACTOR_LABELS: Record<OperationalActor, string> = {
  equipe: 'Equipe Eleva',
  cliente: 'Cliente',
  orgao: 'Órgão público',
  terceiro: 'Terceiro',
}

export const OPERATIONAL_ACTION_CATALOG: Record<OperationalActionCategory, string> = {
  agendar: 'Agendar',
  solicitar: 'Solicitar',
  dar_entrada: 'Dar entrada',
  consultar: 'Consultar',
  encerrar: 'Encerrar',
  dar_andamento: 'Dar andamento',
}

export const OPERATIONAL_SITUATION_CATALOG: Record<OperationalSituation, string> = {
  nao_iniciado: 'Não iniciado',
  aguardando_dependencia: 'Aguardando serviço anterior',
  agendado: 'Agendado',
  solicitado: 'Solicitado',
  aguardando_documento: 'Aguardando documento/laudo',
  em_andamento: 'Em andamento',
  em_analise: 'Em análise',
  finalizado: 'Finalizado',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
}

export const STAGE_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  aprovado: 'Aprovado',
  reprovado: 'Indeferido',
  nao_aplicavel: 'Não aplicável',
}

export const OPERATIONAL_PRIORITY_ORDER: Record<OperationalPriority, number> = {
  vencido: 0,
  acao_equipe_com_prazo: 1,
  acao_equipe: 2,
  aguardando_externo: 3,
  aguardando_data: 4,
  sem_acao: 5,
  encerrado: 6,
}

export const OPERATIONAL_PRIORITY_META: Record<OperationalPriority, {
  label: string
  className: string
}> = {
  vencido: {
    label: 'Ação vencida',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  acao_equipe_com_prazo: {
    label: 'Ação da equipe',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  acao_equipe: {
    label: 'Ação da equipe',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  aguardando_externo: {
    label: 'Aguardando',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  aguardando_data: {
    label: 'Data agendada',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  sem_acao: {
    label: 'Definir ação',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  encerrado: {
    label: 'Encerrado',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  },
}

const TERMINAL_PROCESS_STATUSES = new Set<ProcessStatus>([
  'concluido',
  'arquivado',
  'cancelado',
])

const SERVICE_DEPENDENCY_PREFIXES = [
  'aguardando conclusão',
  'aguardando deferimento',
  'cliente optou por comprar somente',
]

export function isServiceDependencyBlocker(value?: string | null) {
  const normalized = value?.trim().toLocaleLowerCase('pt-BR') ?? ''
  return SERVICE_DEPENDENCY_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

interface StageActionInput {
  label: string
  status: string
  scheduled_date?: string | null
  due_date?: string | null
}

export interface ProcessActionInput {
  processStatus: ProcessStatus
  nextAction?: string | null
  actionOwner?: string | null
  actionDueDate?: string | null
  blockedReason?: string | null
  currentStage?: StageActionInput | null
  today: string
}

export interface ProcessActionSummary {
  nextAction: string
  actor: OperationalActor
  dueDate: string | null
  blocker: string | null
  priority: OperationalPriority
  priorityRank: number
  requiresTeamAction: boolean
  isOverdue: boolean
  category: OperationalActionCategory
}

export function getOperationalActionCategory(
  nextAction: string,
  processStatus: ProcessStatus,
): OperationalActionCategory {
  if (TERMINAL_PROCESS_STATUSES.has(processStatus)) return 'encerrar'
  const normalized = nextAction.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (normalized.includes('agend')) return 'agendar'
  if (normalized.includes('solicit')) return 'solicitar'
  if (normalized.includes('dar entrada') || normalized.includes('protocol') || normalized.includes('iniciar')) return 'dar_entrada'
  if (normalized.includes('consult') || normalized.includes('acompanhar') || normalized.includes('aguardar')) return 'consultar'
  return 'dar_andamento'
}

function validActor(value: string | null | undefined): OperationalActor | null {
  return value && ['equipe', 'cliente', 'orgao', 'terceiro'].includes(value)
    ? value as OperationalActor
    : null
}

function inferredActor(input: ProcessActionInput): OperationalActor {
  const explicit = validActor(input.actionOwner)
  if (explicit) return explicit
  if (input.blockedReason?.trim()) return 'terceiro'
  if (input.processStatus === 'aguardando_documentos') return 'cliente'
  if (input.processStatus === 'aguardando_orgao' || input.processStatus === 'em_analise') {
    return 'orgao'
  }
  if (input.currentStage?.scheduled_date) return 'cliente'
  return 'equipe'
}

function inferredAction(input: ProcessActionInput, actor: OperationalActor): string {
  const explicit = input.nextAction?.trim()
  if (explicit) return explicit
  if (TERMINAL_PROCESS_STATUSES.has(input.processStatus)) return 'Processo encerrado'
  if (input.blockedReason?.trim()) return `Aguardar: ${input.blockedReason.trim()}`

  if (input.processStatus === 'aguardando_documentos') return 'Aguardar documentos do cliente'
  if (input.processStatus === 'aguardando_orgao' || input.processStatus === 'em_analise') {
    return 'Acompanhar retorno do órgão'
  }

  const stage = input.currentStage
  if (stage) {
    if (stage.scheduled_date) return `Aguardar realização: ${stage.label}`
    if (stage.status === 'pendente') return `Iniciar: ${stage.label}`
    if (stage.status === 'em_andamento') return `Dar andamento: ${stage.label}`
    return `Revisar: ${stage.label}`
  }

  if (input.processStatus === 'aberto') return 'Dar entrada no processo'
  return actor === 'equipe' ? 'Definir próxima ação' : 'Aguardar próxima providência'
}

export function deriveProcessAction(input: ProcessActionInput): ProcessActionSummary {
  const actor = inferredActor(input)
  const nextAction = inferredAction(input, actor)
  const dueDate = input.actionDueDate
    ?? input.currentStage?.due_date
    ?? input.currentStage?.scheduled_date
    ?? null
  const closed = TERMINAL_PROCESS_STATUSES.has(input.processStatus)
  const isOverdue = Boolean(!closed && dueDate && dueDate < input.today)
  const isScheduled = Boolean(
    !closed
    && input.currentStage?.scheduled_date
    && !isOverdue,
  )

  let priority: OperationalPriority
  if (closed) priority = 'encerrado'
  else if (isOverdue) priority = 'vencido'
  else if (actor === 'equipe' && dueDate) priority = 'acao_equipe_com_prazo'
  else if (actor === 'equipe' && nextAction !== 'Definir próxima ação') priority = 'acao_equipe'
  else if (isScheduled) priority = 'aguardando_data'
  else if (actor !== 'equipe') priority = 'aguardando_externo'
  else priority = 'sem_acao'

  return {
    nextAction,
    actor,
    dueDate,
    blocker: input.blockedReason?.trim() || null,
    priority,
    priorityRank: OPERATIONAL_PRIORITY_ORDER[priority],
    requiresTeamAction: !closed && actor === 'equipe',
    isOverdue,
    category: getOperationalActionCategory(nextAction, input.processStatus),
  }
}

export function compareOperationalActions(
  left: Pick<ProcessActionSummary, 'priorityRank' | 'dueDate'>,
  right: Pick<ProcessActionSummary, 'priorityRank' | 'dueDate'>,
) {
  const priority = left.priorityRank - right.priorityRank
  if (priority !== 0) return priority
  return (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31')
}
