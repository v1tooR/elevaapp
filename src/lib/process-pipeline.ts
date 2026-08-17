// Importes relativos com extensão para que o runner de testes do Node
// (`--experimental-strip-types`) consiga resolver os módulos.
import { getOperationalWorkflowDefinition, isEntryStage } from './operational-workflows.ts'
import { isServiceDependencyBlocker } from './process-actions.ts'
import type { ProcessStatus } from '@/types/database'

/**
 * Vocabulário único de acompanhamento usado em toda a operação.
 * "Protocolado" e "em análise" são a mesma coisa e aparecem como `em_analise`.
 */
export type ProcessPhase =
  | 'na_fila'
  | 'aguardando_documentos'
  | 'dar_entrada'
  | 'em_analise'
  | 'deferido'
  | 'indeferido'
  | 'arquivado'
  | 'cancelado'

export const PROCESS_PHASE_LABELS: Record<ProcessPhase, string> = {
  na_fila: 'Na fila',
  aguardando_documentos: 'Aguardando documentos',
  dar_entrada: 'Dar entrada',
  em_analise: 'Em análise',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
  arquivado: 'Arquivado',
  cancelado: 'Cancelado',
}

export const PROCESS_PHASE_COLORS: Record<ProcessPhase, string> = {
  na_fila: 'bg-slate-100 text-slate-600',
  aguardando_documentos: 'bg-orange-100 text-orange-800',
  dar_entrada: 'bg-amber-100 text-amber-900',
  em_analise: 'bg-purple-100 text-purple-800',
  deferido: 'bg-green-100 text-green-800',
  indeferido: 'bg-red-100 text-red-800',
  arquivado: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-800',
}

/**
 * Filtros rápidos na ordem do fluxo. Deferido e indeferido vêm da situação
 * derivada das etapas, porque o banco só guarda "concluído".
 */
export const PROCESS_PHASE_FILTERS: Array<{
  phase: ProcessPhase
  statuses?: ProcessStatus[]
  situation?: string
}> = [
  { phase: 'aguardando_documentos', statuses: ['aguardando_documentos'] },
  { phase: 'dar_entrada', statuses: ['aberto', 'em_andamento'] },
  { phase: 'em_analise', statuses: ['em_analise', 'aguardando_orgao'] },
  { phase: 'deferido', situation: 'deferido' },
  { phase: 'indeferido', situation: 'indeferido' },
]

const RESOLVED_STAGE_STATUSES = new Set(['concluido', 'aprovado', 'reprovado', 'nao_aplicavel'])

export interface PhaseStageInput {
  stage_key: string
  status: string
  data?: Record<string, unknown> | null
}

function hasProtocol(data?: Record<string, unknown> | null) {
  const protocol = data?.protocol
  return typeof protocol === 'string' && protocol.trim().length > 0
}

/**
 * Fase derivada das etapas operacionais. Retorna `null` quando o tipo de
 * processo não usa o workflow operacional (ex.: CNH Especial).
 */
export function getOperationalProcessPhase(
  processTypeSlug: string,
  stages: readonly PhaseStageInput[],
): ProcessPhase | null {
  const workflow = getOperationalWorkflowDefinition(processTypeSlug)
  if (!workflow) return null

  const byKey = new Map(stages.map(stage => [stage.stage_key, stage]))
  const isResolved = (stageKey: string) => {
    const stage = byKey.get(stageKey)
    return Boolean(stage && RESOLVED_STAGE_STATUSES.has(stage.status))
  }

  const decisionTemplates = workflow.stages.filter(template => (template.resultOptions?.length ?? 0) > 0)
  if (decisionTemplates.some(template => byKey.get(template.stage_key)?.status === 'aprovado')) return 'deferido'
  if (decisionTemplates.some(template => byKey.get(template.stage_key)?.status === 'reprovado')) return 'indeferido'

  const entryTemplates = workflow.stages.filter(isEntryStage)
  const firstEntryOrder = entryTemplates.length > 0
    ? Math.min(...entryTemplates.map(template => template.sort_order))
    : Number.POSITIVE_INFINITY

  // Tudo que vem antes do protocolo (veículo, checklists, laudos) é recebimento
  // de documentos: enquanto houver etapa aberta ali, ainda não dá para dar entrada.
  const pendingBeforeEntry = workflow.stages
    .filter(template => template.sort_order < firstEntryOrder)
    .some(template => !isResolved(template.stage_key))
  if (pendingBeforeEntry) return 'aguardando_documentos'

  const protocolled = entryTemplates.some(template => (
    isResolved(template.stage_key) || hasProtocol(byKey.get(template.stage_key)?.data)
  ))
  if (protocolled) return 'em_analise'

  return entryTemplates.length > 0 ? 'dar_entrada' : 'em_analise'
}

/**
 * Situação derivada pela view `process_wallet_rows` traduzida para a fase.
 * A view já sabe se a etapa atual foi aprovada, reprovada ou está bloqueada.
 */
const SITUATION_PHASES: Record<string, ProcessPhase> = {
  aguardando_dependencia: 'na_fila',
  deferido: 'deferido',
  indeferido: 'indeferido',
  aguardando_documento: 'aguardando_documentos',
  em_analise: 'em_analise',
  nao_iniciado: 'aguardando_documentos',
}

export function getPhaseFromSituation(
  status: ProcessStatus,
  situation: string | null | undefined,
  blockedReason?: string | null,
): ProcessPhase {
  if (status === 'cancelado') return 'cancelado'
  if (status === 'arquivado') return 'arquivado'
  const mapped = situation ? SITUATION_PHASES[situation] : undefined
  return mapped ?? getProcessPhaseFromStatus(status, blockedReason)
}

/** Fase aproximada quando só existe o status gravado no processo. */
export function getProcessPhaseFromStatus(
  status: ProcessStatus,
  blockedReason?: string | null,
): ProcessPhase {
  if (status === 'cancelado') return 'cancelado'
  if (status === 'arquivado') return 'arquivado'
  if (status === 'concluido') return 'deferido'
  if (status === 'aberto' && isServiceDependencyBlocker(blockedReason)) return 'na_fila'
  if (status === 'aguardando_documentos') return 'aguardando_documentos'
  if (status === 'em_analise' || status === 'aguardando_orgao') return 'em_analise'
  return 'dar_entrada'
}

export interface ProcessPhaseInput {
  status: ProcessStatus
  processTypeSlug?: string | null
  blockedReason?: string | null
  stages?: readonly PhaseStageInput[] | null
  /** Verdadeiro quando o processo está numa fila de serviços e ainda não é a vez dele. */
  queuedBehind?: boolean
}

export function getProcessPhase(input: ProcessPhaseInput): ProcessPhase {
  if (input.status === 'cancelado') return 'cancelado'
  if (input.status === 'arquivado') return 'arquivado'
  if (input.queuedBehind || (input.status === 'aberto' && isServiceDependencyBlocker(input.blockedReason))) {
    return 'na_fila'
  }

  const fromStages = input.stages?.length
    ? getOperationalProcessPhase(input.processTypeSlug ?? '', input.stages)
    : null
  if (fromStages) return fromStages

  return getProcessPhaseFromStatus(input.status, input.blockedReason)
}

/**
 * Status a gravar em `processes.status` a partir das etapas operacionais.
 * Mantém o vocabulário do banco, mas espelha a fase real do atendimento.
 */
export function resolveProcessStatusFromStages(
  processTypeSlug: string,
  stages: readonly PhaseStageInput[],
): ProcessStatus {
  const phase = getOperationalProcessPhase(processTypeSlug, stages)
  if (phase === 'aguardando_documentos') return 'aguardando_documentos'
  if (phase === 'em_analise') return 'em_analise'
  return 'em_andamento'
}

export interface PhaseAction {
  nextAction: string
  actionOwner: 'equipe' | 'cliente' | 'orgao'
}

/** Próxima ação padrão de cada fase, usada quando a etapa muda de estado. */
export const PHASE_ACTIONS: Record<'aguardando_documentos' | 'dar_entrada' | 'em_analise', PhaseAction> = {
  aguardando_documentos: { nextAction: 'Aguardar documentos do cliente', actionOwner: 'cliente' },
  dar_entrada: { nextAction: 'Dar entrada no processo', actionOwner: 'equipe' },
  em_analise: { nextAction: 'Acompanhar análise do órgão', actionOwner: 'orgao' },
}
