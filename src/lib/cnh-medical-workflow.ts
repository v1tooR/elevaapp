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

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
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
    return 'Selecione “Aprovado” ou “Reprovado” como resultado da Junta Médica antes de concluir o recurso.'
  }

  return null
}
