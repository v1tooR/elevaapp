import type { ProcessStage } from '@/types/database'

export const IPVA_STAGE_KEYS = [
  'veiculo_ipva',
  'documentos_ipva',
  'sivei_protocolo',
  'sefaz_decisao',
  'ipva_recurso',
  'ipva_conclusao',
] as const

export type IpvaStageKey = (typeof IPVA_STAGE_KEYS)[number]
export type IpvaOperationalBucket =
  | 'configuracao'
  | 'documentos'
  | 'protocolo'
  | 'sefaz'
  | 'recurso'
  | 'concluido'

export const IPVA_OPERATIONAL_BUCKETS: Record<IpvaOperationalBucket, string> = {
  configuracao: 'Não iniciado',
  documentos: 'Aguardando documentos',
  protocolo: 'Dar entrada',
  sefaz: 'Em análise',
  recurso: 'Recurso',
  concluido: 'Deferido',
}

const IPVA_STAGE_LABELS: Record<IpvaStageKey, string> = {
  veiculo_ipva: 'Veículo do pedido',
  documentos_ipva: 'Checklist do IPVA',
  sivei_protocolo: 'Protocolo do IPVA',
  sefaz_decisao: 'Análise da SEFAZ',
  ipva_recurso: 'Recurso',
  ipva_conclusao: 'Conclusão do IPVA',
}

const DEFAULT_IPVA_STATUS_LABELS: Record<string, string> = {
  pendente: 'Não iniciado',
  em_andamento: 'Em análise',
  concluido: 'Finalizado',
  aprovado: 'Deferido',
  reprovado: 'Indeferido',
  nao_aplicavel: 'Não necessário',
}

export function getIpvaStageLabel(stageKey: string, fallback: string) {
  return IPVA_STAGE_LABELS[stageKey as IpvaStageKey] ?? fallback
}

export function getIpvaStageStatusLabel(stageKey: string, status: string) {
  if (stageKey === 'veiculo_ipva' && status !== 'concluido') return 'Aguardando placa e marca'
  if (stageKey === 'documentos_ipva' && status === 'em_andamento') return 'Aguardando documentos'
  if (stageKey === 'sivei_protocolo' && status === 'pendente') return 'Dar entrada'
  if (stageKey === 'sivei_protocolo' && status === 'concluido') return 'Protocolado — em análise'
  if (stageKey === 'ipva_recurso' && status === 'pendente') return 'Aguardando documento'
  return DEFAULT_IPVA_STATUS_LABELS[status] ?? status
}

function isFinished(stage?: Pick<ProcessStage, 'status'>): boolean {
  return Boolean(stage && ['concluido', 'aprovado', 'nao_aplicavel'].includes(stage.status))
}

export function getIpvaOperationalBucket(
  stages: Array<Pick<ProcessStage, 'stage_key' | 'status'>>,
): IpvaOperationalBucket {
  if (stages.length === 0) return 'configuracao'

  const byKey = new Map(stages.map(stage => [stage.stage_key, stage]))
  const appeal = byKey.get('ipva_recurso')
  const conclusion = byKey.get('ipva_conclusao')
  if (appeal && ['pendente', 'em_andamento', 'reprovado'].includes(appeal.status)) return 'recurso'
  if (isFinished(conclusion)) return 'concluido'

  // Veículo e checklist vêm antes da entrada: enquanto estiverem abertos, o
  // pedido ainda está reunindo documentos.
  const vehicle = byKey.get('veiculo_ipva')
  const documents = byKey.get('documentos_ipva')
  if ((vehicle && !isFinished(vehicle)) || (documents && !isFinished(documents))) return 'documentos'

  const protocol = byKey.get('sivei_protocolo')
  if (!isFinished(protocol)) return 'protocolo'

  return 'sefaz'
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida; use AAAA-MM-DD.')
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error('Data inválida; use AAAA-MM-DD.')
  return parsed
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export interface AppealSchedule {
  noticeDate: string
  dueDate: string
  reminders: Array<{ daysBefore: 10 | 3 | 1; date: string }>
}

export function buildAppealSchedule(noticeDate: string): AppealSchedule {
  const notice = parseDateOnly(noticeDate)
  const due = addUtcDays(notice, 30)
  return {
    noticeDate,
    dueDate: formatDateOnly(due),
    reminders: ([10, 3, 1] as const).map(daysBefore => ({
      daysBefore,
      date: formatDateOnly(addUtcDays(due, -daysBefore)),
    })),
  }
}

export interface RenewalRuleInput {
  processTypeSlug: string
  completedAt: string
  configuredMonths?: number | null
  cnhExpiresAt?: string | null
}

export function calculateProcessRenewalDate(input: RenewalRuleInput): string | null {
  if (input.processTypeSlug === 'processo_ipva') return null
  if (input.processTypeSlug === 'cnh_especial') {
    return input.cnhExpiresAt ? formatDateOnly(parseDateOnly(input.cnhExpiresAt)) : null
  }
  if (!input.configuredMonths) return null

  const completed = parseDateOnly(input.completedAt.slice(0, 10))
  completed.setUTCMonth(completed.getUTCMonth() + input.configuredMonths)
  return formatDateOnly(completed)
}
