import type { ProcessStage } from '@/types/database'

export const IPVA_STAGE_KEYS = [
  'ipva_documentos',
  'imesc_agendamento',
  'imesc_pericia',
  'imesc_laudo',
  'sivei_protocolo',
  'sefaz_decisao',
  'ipva_recurso',
  'ipva_conclusao',
] as const

export type IpvaStageKey = (typeof IPVA_STAGE_KEYS)[number]
export type IpvaOperationalBucket =
  | 'configuracao'
  | 'pericia'
  | 'laudo'
  | 'sefaz'
  | 'recurso'
  | 'concluido'

export const IPVA_OPERATIONAL_BUCKETS: Record<IpvaOperationalBucket, string> = {
  configuracao: 'Inicializar workflow',
  pericia: 'Aguardando perícia',
  laudo: 'Aguardando laudo',
  sefaz: 'Aguardando SEFAZ',
  recurso: 'Recurso',
  concluido: 'Concluído',
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

  const report = byKey.get('imesc_laudo')
  if (!isFinished(report)) {
    const examination = byKey.get('imesc_pericia')
    return isFinished(examination) ? 'laudo' : 'pericia'
  }

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

