import type {
  AuthorizedDriver,
  Client,
  ClientType,
  CnhStatus,
  DisabilityType,
} from '@/types/database'

export interface ClientEligibilityFormValue {
  client_type: ClientType | ''
  disability_types: DisabilityType[]
  cnh_status: CnhStatus | ''
  cnh_restrictions: string
  cnh_expiry_date: string
  authorized_drivers: AuthorizedDriver[]
  has_legal_representative: boolean
  legal_representative_name: string
  legal_representative_cpf: string
  receives_loas_bpc: boolean
  has_medical_report: boolean
  eligibility_notes: string
}

export const EMPTY_CLIENT_ELIGIBILITY: ClientEligibilityFormValue = {
  client_type: '',
  disability_types: [],
  cnh_status: '',
  cnh_restrictions: '',
  cnh_expiry_date: '',
  authorized_drivers: [],
  has_legal_representative: false,
  legal_representative_name: '',
  legal_representative_cpf: '',
  receives_loas_bpc: false,
  has_medical_report: false,
  eligibility_notes: '',
}

export function clientEligibilityFromRecord(client: Partial<Client>): ClientEligibilityFormValue {
  const disabilityTypes = [...new Set([
    ...(client.disability_types ?? []),
    ...(client.disability_type ? [client.disability_type] : []),
  ])]

  return {
    client_type: client.client_type ?? '',
    disability_types: disabilityTypes,
    cnh_status: client.cnh_status ?? (client.has_cnh_especial ? 'com_restricoes' : ''),
    cnh_restrictions: (client.cnh_restrictions ?? []).join(', '),
    cnh_expiry_date: client.cnh_expiry_date ?? '',
    authorized_drivers: client.authorized_drivers ?? [],
    has_legal_representative: client.has_legal_representative ?? false,
    legal_representative_name: client.legal_representative_name ?? '',
    legal_representative_cpf: client.legal_representative_cpf ?? '',
    receives_loas_bpc: client.receives_loas_bpc ?? false,
    has_medical_report: client.has_medical_report ?? false,
    eligibility_notes: client.eligibility_notes ?? '',
  }
}

export function clientEligibilityPayload(value: ClientEligibilityFormValue) {
  const restrictions = value.cnh_restrictions
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(Boolean)

  const disabilityTypes = [...new Set(value.disability_types)]

  return {
    client_type: value.client_type || null,
    // Campo singular mantido somente para compatibilidade com consultas antigas.
    disability_type: disabilityTypes[0] ?? null,
    disability_types: disabilityTypes,
    cnh_status: value.cnh_status || null,
    cnh_restrictions: restrictions,
    cnh_expiry_date: value.cnh_expiry_date || null,
    authorized_drivers: value.authorized_drivers.filter(driver => driver.name.trim() || driver.cnh.trim()),
    has_legal_representative:
      value.client_type === 'nao_condutor' && value.has_legal_representative,
    legal_representative_name:
      value.client_type === 'nao_condutor' && value.has_legal_representative
        ? value.legal_representative_name.trim() || null
        : null,
    legal_representative_cpf:
      value.client_type === 'nao_condutor' && value.has_legal_representative
        ? value.legal_representative_cpf.trim() || null
        : null,
    eligibility_notes: value.eligibility_notes.trim() || null,
    has_cnh_especial: value.cnh_status === 'com_restricoes',
    receives_loas_bpc: value.receives_loas_bpc,
    has_medical_report: value.has_medical_report,
  }
}
