import type { ProcessStatus } from '@/types/database'

export type OperationalActor = 'equipe' | 'cliente' | 'orgao' | 'terceiro'
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
}

function validActor(value: string | null | undefined): OperationalActor | null {
  return value && ['equipe', 'cliente', 'orgao', 'terceiro'].includes(value)
    ? value as OperationalActor
    : null
}

function inferredActor(input: ProcessActionInput): OperationalActor {
  const explicit = validActor(input.actionOwner)
  if (explicit) return explicit
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
