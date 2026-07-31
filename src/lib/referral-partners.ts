import type {
  LeadSource,
  LeadStatus,
  ReferralPartner,
  ReferralPartnerType,
} from '@/types/database'

export const REFERRAL_PARTNER_TYPE_OPTIONS: ReadonlyArray<{
  value: ReferralPartnerType
  label: string
}> = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'indicador', label: 'Indicador' },
]

export const REFERRAL_PARTNER_TYPE_LABELS: Record<ReferralPartnerType, string> = {
  vendedor: 'Vendedor',
  indicador: 'Indicador',
}

export function referralTypeForSource(
  source: LeadSource | '' | null | undefined,
): ReferralPartnerType | null {
  if (source === 'vendedor') return 'vendedor'
  if (source === 'indicacao') return 'indicador'
  return null
}

export function partnerSupportsSource(
  partner: Pick<ReferralPartner, 'partner_types'>,
  source: LeadSource | '' | null | undefined,
) {
  const requiredType = referralTypeForSource(source)
  return requiredType ? partner.partner_types.includes(requiredType) : false
}

export function normalizeReferralMonth(value?: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : ''
}

export function referralMonthBounds(month: string) {
  const normalizedMonth = normalizeReferralMonth(month)
  if (!normalizedMonth) return null

  const [year, monthNumber] = normalizedMonth.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1

  return {
    start: `${normalizedMonth}-01T00:00:00-03:00`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00-03:00`,
  }
}

export function referralLeadBucket(status: LeadStatus) {
  if (status === 'convertido') return 'convertidos' as const
  if (status === 'perdido') return 'perdidos' as const
  return 'em_andamento' as const
}
