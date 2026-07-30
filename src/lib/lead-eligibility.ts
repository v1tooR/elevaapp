import type {
  ClientType,
  DisabilityType,
  Lead,
  LeadIntendedService,
} from '@/types/database'

export const LEAD_DISABILITY_OPTIONS: Array<{ value: DisabilityType; label: string }> = [
  { value: 'fisica', label: 'Física' },
  { value: 'auditiva', label: 'Auditiva' },
  { value: 'visual', label: 'Visual' },
  { value: 'monocular', label: 'Monocular' },
  { value: 'autismo', label: 'Autismo (TEA)' },
  { value: 'mental', label: 'Mental / Intelectual' },
]

export const LEAD_DISABILITY_LABELS = Object.fromEntries(
  LEAD_DISABILITY_OPTIONS.map(option => [option.value, option.label]),
) as Record<DisabilityType, string>

export const LEAD_SERVICE_OPTIONS: Array<{
  value: LeadIntendedService
  label: string
  processTypeSlug: string
}> = [
  { value: 'cnh_especial', label: 'CNH Especial', processTypeSlug: 'cnh_especial' },
  { value: 'ipi', label: 'IPI', processTypeSlug: 'processo_ipi' },
  { value: 'icms', label: 'ICMS', processTypeSlug: 'processo_icms' },
  { value: 'ipva', label: 'IPVA', processTypeSlug: 'processo_ipva' },
  { value: 'credencial_estacionamento', label: 'Credencial de estacionamento', processTypeSlug: 'estacionamento' },
  { value: 'cin', label: 'CIN', processTypeSlug: 'cin' },
  { value: 'emplacamento', label: 'Emplacamento', processTypeSlug: 'emplacamento' },
  { value: 'renovacao', label: 'Renovação', processTypeSlug: 'renovacao' },
  { value: 'isencao_ir', label: 'Isenção de IR', processTypeSlug: 'imposto_de_renda' },
  { value: 'aposentadoria', label: 'Aposentadoria', processTypeSlug: 'aposentadoria' },
  { value: 'alvara', label: 'Alvará', processTypeSlug: 'alvara' },
]

export const LEAD_SERVICE_LABELS = Object.fromEntries(
  LEAD_SERVICE_OPTIONS.map(option => [option.value, option.label]),
) as Record<LeadIntendedService, string>

export const LEAD_SERVICE_PROCESS_TYPE_SLUGS = Object.fromEntries(
  LEAD_SERVICE_OPTIONS.map(option => [option.value, option.processTypeSlug]),
) as Record<LeadIntendedService, string>

export interface LeadEligibilityFormValue {
  client_type: ClientType | ''
  disability_types: DisabilityType[]
  has_legal_representative: boolean
  legal_representative_name: string
  has_cnh_especial: boolean
  cnh_restrictions: string
  receives_loas_bpc: boolean
  has_medical_report: boolean
  intended_services: LeadIntendedService[]
}

export const EMPTY_LEAD_ELIGIBILITY: LeadEligibilityFormValue = {
  client_type: '',
  disability_types: [],
  has_legal_representative: false,
  legal_representative_name: '',
  has_cnh_especial: false,
  cnh_restrictions: '',
  receives_loas_bpc: false,
  has_medical_report: false,
  intended_services: [],
}

export function normalizeLeadIntendedServices(
  services: readonly LeadIntendedService[],
): LeadIntendedService[] {
  const uniqueServices = [...new Set(services)]
  if (!uniqueServices.includes('cnh_especial')) return uniqueServices

  return [
    'cnh_especial',
    ...uniqueServices.filter(service => service !== 'cnh_especial'),
  ]
}

export function getLeadIntendedServices(
  lead: Pick<Lead, 'intended_service' | 'intended_services'>,
): LeadIntendedService[] {
  return normalizeLeadIntendedServices([
    ...(lead.intended_services ?? []),
    ...(lead.intended_service ? [lead.intended_service] : []),
  ])
}

export function getLeadDisabilityTypes(
  lead: Pick<Lead, 'disability_type' | 'disability_types'>,
): DisabilityType[] {
  return [...new Set([
    ...(lead.disability_types ?? []),
    ...(lead.disability_type ? [lead.disability_type] : []),
  ])]
}

export function leadEligibilityFromRecord(lead: Partial<Lead>): LeadEligibilityFormValue {
  return {
    client_type: lead.is_driver == null
      ? ''
      : lead.is_driver ? 'condutor' : 'nao_condutor',
    disability_types: getLeadDisabilityTypes(lead),
    has_legal_representative: lead.has_legal_representative ?? false,
    legal_representative_name: lead.legal_representative_name ?? '',
    has_cnh_especial: lead.has_cnh_especial ?? false,
    cnh_restrictions: (lead.cnh_restrictions ?? []).join(', '),
    receives_loas_bpc: lead.receives_loas_bpc ?? false,
    has_medical_report: lead.has_medical_report ?? false,
    intended_services: getLeadIntendedServices(lead),
  }
}

export function leadEligibilityPayload(value: LeadEligibilityFormValue) {
  const disabilityTypes = [...new Set(value.disability_types)]
  const isDriver = value.client_type === ''
    ? null
    : value.client_type === 'condutor'
  const hasCnhEspecial = isDriver === true && value.has_cnh_especial
  const hasRepresentative = isDriver === false && value.has_legal_representative
  const restrictions = hasCnhEspecial
    ? [...new Set(value.cnh_restrictions
        .split(',')
        .map(code => code.trim().toUpperCase())
        .filter(Boolean))]
    : []
  const intendedServices = normalizeLeadIntendedServices(value.intended_services)

  return {
    is_driver: isDriver,
    disability_type: disabilityTypes[0] ?? null,
    disability_types: disabilityTypes,
    has_cnh_especial: hasCnhEspecial,
    cnh_status: isDriver === false
      ? 'nao_possui'
      : hasCnhEspecial ? 'com_restricoes' : null,
    cnh_restrictions: restrictions,
    has_legal_representative: hasRepresentative,
    legal_representative_name: hasRepresentative
      ? value.legal_representative_name.trim() || null
      : null,
    receives_loas_bpc: value.receives_loas_bpc,
    has_medical_report: value.has_medical_report,
    // Compatibilidade com o campo legado: "possui laudo" agora significa
    // que há um laudo válido para o processo.
    report_valid: value.has_medical_report ? true : null,
    intended_service: intendedServices[0] ?? null,
    intended_services: intendedServices,
  }
}
