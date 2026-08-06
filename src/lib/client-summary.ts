import type { ProcessStatus } from '@/types/database'

export interface CompleteClientRow {
  client_id: string
  client_name: string
  client_cpf: string | null
  client_phone: string | null
  client_email: string | null
  client_city: string | null
  client_state: string | null
  cnh_status: string | null
  cnh_expiry_date: string | null
  contract_id: string | null
  contract_label: string | null
  contract_status: string | null
  contract_value: number | string | null
  contracted_at: string | null
  lead_source: string | null
  referral_partner_id: string | null
  indication_name: string | null
  dealership: string | null
  salesperson: string | null
  purchase_vehicle: string | null
  vehicle_price: number | string | null
  purchase_date: string | null
  next_vehicle_change_date: string | null
  cnh_process_status: ProcessStatus | null
  cnh_stage_label: string | null
  cin_process_status: ProcessStatus | null
  cin_stage_label: string | null
  cin_valid_until: string | null
  credential_process_status: ProcessStatus | null
  credential_stage_label: string | null
  credential_valid_until: string | null
  client_created_at: string
  commercial_owner_id: string | null
  commercial_owner_name: string | null
  service_names: string[] | null
  service_keys: string[] | null
  has_valid_cin: boolean
  has_valid_credential: boolean
  cin_document_state: ClientDocumentState
  credential_document_state: ClientDocumentState
}

export type ClientDocumentState = 'vigente' | 'em_andamento' | 'vencido' | 'nao_possui'

export const CLIENT_DOCUMENT_STATE_LABELS: Record<ClientDocumentState, string> = {
  vigente: 'Possui documento vigente',
  em_andamento: 'Em andamento',
  vencido: 'Documento vencido',
  nao_possui: 'Não possui',
}

export const CLIENT_SUMMARY_COLUMNS = [
  ['email', 'E-mail'],
  ['cadastro', 'Cadastro'],
  ['servicos', 'Serviços'],
  ['contrato', 'Contrato'],
  ['valor', 'Valor'],
  ['responsavel', 'Responsável comercial'],
  ['indicacao', 'Indicação'],
  ['concessionaria', 'Concessionária'],
  ['vendedor', 'Vendedor da concessionária'],
  ['compra', 'Compra'],
  ['troca', 'Próxima troca'],
  ['cnh', 'CNH'],
  ['cin', 'CIN'],
  ['credencial', 'Credencial'],
] as const

export type ClientSummaryColumn = typeof CLIENT_SUMMARY_COLUMNS[number][0]

const VALID_COLUMNS = new Set<ClientSummaryColumn>(CLIENT_SUMMARY_COLUMNS.map(([key]) => key))

export function normalizeClientSummaryColumns(value?: string | string[]) {
  const raw = Array.isArray(value) ? value : value?.split(',') ?? []
  const selected = raw.filter((key): key is ClientSummaryColumn => VALID_COLUMNS.has(key as ClientSummaryColumn))
  return selected.length > 0 ? [...new Set(selected)] : CLIENT_SUMMARY_COLUMNS.map(([key]) => key)
}

export function csvCell(value: unknown) {
  const raw = value == null ? '' : String(value)
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}
