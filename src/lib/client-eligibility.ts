import type {
  AuthorizedDriver,
  Client,
  ClientType,
  CnhStatus,
  DisabilitySeverity,
  DisabilityType,
  MedicalAssessmentStatus,
} from '@/types/database'

export interface ClientEligibilityFormValue {
  client_type: ClientType | ''
  disability_type: DisabilityType | ''
  disability_types: DisabilityType[]
  disability_severity: DisabilitySeverity | ''
  disability_details: string
  cnh_status: CnhStatus | ''
  cnh_restrictions: string
  medical_assessment_status: MedicalAssessmentStatus | ''
  requires_adapted_vehicle: boolean | null
  requires_practical_exam: boolean | null
  authorized_drivers: AuthorizedDriver[]
  receives_loas_bpc: boolean
  has_medical_report: boolean
  report_valid_until: string
  eligibility_notes: string
}

export const EMPTY_CLIENT_ELIGIBILITY: ClientEligibilityFormValue = {
  client_type: '',
  disability_type: '',
  disability_types: [],
  disability_severity: '',
  disability_details: '',
  cnh_status: '',
  cnh_restrictions: '',
  medical_assessment_status: 'nao_realizada',
  requires_adapted_vehicle: null,
  requires_practical_exam: null,
  authorized_drivers: [],
  receives_loas_bpc: false,
  has_medical_report: false,
  report_valid_until: '',
  eligibility_notes: '',
}

export function clientEligibilityFromRecord(client: Partial<Client>): ClientEligibilityFormValue {
  return {
    client_type: client.client_type ?? '',
    disability_type: client.disability_type ?? '',
    disability_types: client.disability_types ?? (client.disability_type ? [client.disability_type] : []),
    disability_severity: client.disability_severity ?? '',
    disability_details: client.disability_details ?? '',
    cnh_status: client.cnh_status ?? (client.has_cnh_especial ? 'com_restricoes' : ''),
    cnh_restrictions: (client.cnh_restrictions ?? []).join(', '),
    medical_assessment_status: client.medical_assessment_status ?? 'nao_realizada',
    requires_adapted_vehicle: client.requires_adapted_vehicle ?? null,
    requires_practical_exam: client.requires_practical_exam ?? null,
    authorized_drivers: client.authorized_drivers ?? [],
    receives_loas_bpc: client.receives_loas_bpc ?? false,
    has_medical_report: client.has_medical_report ?? false,
    report_valid_until: client.report_valid_until ?? '',
    eligibility_notes: client.eligibility_notes ?? '',
  }
}

export function clientEligibilityPayload(value: ClientEligibilityFormValue) {
  const restrictions = value.cnh_restrictions
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(Boolean)

  const disabilityTypes = [...new Set([
    ...(value.disability_type ? [value.disability_type] : []),
    ...value.disability_types,
  ])]

  return {
    client_type: value.client_type || null,
    disability_type: value.disability_type || null,
    disability_types: disabilityTypes,
    disability_severity: value.disability_severity || null,
    disability_details: value.disability_details.trim() || null,
    cnh_status: value.cnh_status || null,
    cnh_restrictions: restrictions,
    medical_assessment_status: value.medical_assessment_status || null,
    requires_adapted_vehicle: value.requires_adapted_vehicle,
    requires_practical_exam: value.requires_practical_exam,
    authorized_drivers: value.authorized_drivers.filter(driver => driver.name.trim() || driver.cnh.trim()),
    eligibility_notes: value.eligibility_notes.trim() || null,
    has_cnh_especial: value.cnh_status === 'com_restricoes',
    receives_loas_bpc: value.receives_loas_bpc,
    has_medical_report: value.has_medical_report,
    report_valid_until: value.has_medical_report && value.report_valid_until ? value.report_valid_until : null,
  }
}
