import type {
  DisabilitySeverity,
  ImescBoardStatus,
  ImescOperationalStatus,
} from '@/types/database'

export const IMESC_PRIMARY_COLUMNS = [
  'aguardando',
  'leve',
  'moderado',
  'grave',
] as const satisfies readonly ImescBoardStatus[]

export const IMESC_ADDITIONAL_COLUMNS = [
  'nao_compareceu',
  'sem_deficiencia',
  'indeferido',
  'cancelado',
] as const satisfies readonly ImescBoardStatus[]

export const IMESC_BOARD_LABELS: Record<ImescBoardStatus, string> = {
  aguardando: 'Aguardando',
  leve: 'Leve',
  moderado: 'Moderado',
  grave: 'Grave',
  nao_compareceu: 'Não compareceu',
  sem_deficiencia: 'Sem deficiência',
  indeferido: 'Indeferido',
  cancelado: 'Cancelado',
}

export const IMESC_OPERATIONAL_LABELS: Record<ImescOperationalStatus, string> = {
  nao_iniciado: 'Não iniciado',
  solicitacao_em_preparo: 'Solicitação em preparo',
  agendado: 'Agendado',
  pericia_realizada: 'Perícia realizada',
  laudo_disponivel: 'Laudo disponível',
  encerrado: 'Encerrado',
}

export interface ImescPayload {
  board_status: ImescBoardStatus
  operational_status: ImescOperationalStatus
  responsible_user_id?: string | null
  ipi_process_id?: string | null
  ipva_process_id?: string | null
  protocol?: string | null
  scheduled_date?: string | null
  examination_date?: string | null
  report_issued_at?: string | null
  report_valid_until?: string | null
  source_classification?: DisabilitySeverity | 'sem_deficiencia' | null
  notes?: string | null
  completed_at?: string | null
}

function emptyToNull(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function normalizeLegacyImescClassification(
  classification: string | null | undefined,
): Pick<ImescPayload, 'board_status' | 'source_classification'> {
  switch (classification) {
    case 'leve':
      return { board_status: 'leve', source_classification: 'leve' }
    case 'moderada':
    case 'moderado':
      return { board_status: 'moderado', source_classification: 'moderada' }
    case 'grave':
      return { board_status: 'grave', source_classification: 'grave' }
    case 'gravissima':
      return { board_status: 'grave', source_classification: 'gravissima' }
    case 'sem_deficiencia':
      return { board_status: 'sem_deficiencia', source_classification: 'sem_deficiencia' }
    default:
      return { board_status: 'aguardando', source_classification: null }
  }
}

export function normalizeImescPayload(input: ImescPayload): ImescPayload {
  const output: ImescPayload = {
    ...input,
    responsible_user_id: emptyToNull(input.responsible_user_id),
    ipi_process_id: emptyToNull(input.ipi_process_id),
    ipva_process_id: emptyToNull(input.ipva_process_id),
    protocol: emptyToNull(input.protocol),
    scheduled_date: emptyToNull(input.scheduled_date),
    examination_date: emptyToNull(input.examination_date),
    report_issued_at: emptyToNull(input.report_issued_at),
    report_valid_until: emptyToNull(input.report_valid_until),
    notes: emptyToNull(input.notes),
  }

  if (['nao_iniciado', 'solicitacao_em_preparo'].includes(output.operational_status)) {
    output.scheduled_date = null
    output.examination_date = null
    output.report_issued_at = null
    output.report_valid_until = null
  } else if (output.operational_status === 'agendado') {
    output.examination_date = null
    output.report_issued_at = null
    output.report_valid_until = null
  } else if (output.operational_status === 'pericia_realizada') {
    output.report_issued_at = null
    output.report_valid_until = null
  }

  if (output.board_status === 'leve') output.source_classification = 'leve'
  else if (output.board_status === 'moderado') output.source_classification = 'moderada'
  else if (output.board_status === 'grave') {
    output.source_classification = output.source_classification === 'gravissima'
      ? 'gravissima'
      : 'grave'
  } else if (output.board_status === 'sem_deficiencia') {
    output.source_classification = 'sem_deficiencia'
  } else {
    output.source_classification = null
  }

  const isClosed = ['sem_deficiencia', 'indeferido', 'cancelado'].includes(output.board_status)
    || output.operational_status === 'encerrado'
  output.completed_at = isClosed ? (input.completed_at ?? new Date().toISOString()) : null

  return output
}

export function mapFollowupToEligibility(
  followup: Pick<ImescPayload, 'board_status' | 'operational_status' | 'report_issued_at' | 'source_classification'> | null,
): {
  imescStatus: 'nao_iniciado' | 'agendado' | 'pericia_realizada' | 'laudo_disponivel' | null
  imescReportIssuedAt: string | null
  imescSeverity: DisabilitySeverity | 'sem_deficiencia' | null
} {
  if (!followup) {
    return { imescStatus: null, imescReportIssuedAt: null, imescSeverity: null }
  }

  const imescStatus = followup.operational_status === 'agendado'
    ? 'agendado'
    : followup.operational_status === 'pericia_realizada'
      ? 'pericia_realizada'
      : followup.operational_status === 'laudo_disponivel'
        ? 'laudo_disponivel'
        : 'nao_iniciado'

  const imescSeverity = followup.board_status === 'moderado'
    ? 'moderada'
    : ['leve', 'grave', 'sem_deficiencia'].includes(followup.board_status)
      ? followup.board_status as DisabilitySeverity | 'sem_deficiencia'
      : null

  return {
    imescStatus,
    imescReportIssuedAt: followup.report_issued_at ?? null,
    imescSeverity: followup.source_classification ?? imescSeverity,
  }
}
