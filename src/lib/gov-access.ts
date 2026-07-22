import type { Client, GovAccessStatus, GovAccountLevel } from '@/types/database'

export type GovLevelSufficiency = 'nao_avaliado' | 'sim' | 'nao'

export interface GovAccessFormValue {
  status: GovAccessStatus
  auth_by_client: boolean
  account_level: GovAccountLevel | ''
  level_sufficiency: GovLevelSufficiency
  last_validated_at: string
  pending_note: string
}

export const EMPTY_GOV_ACCESS: GovAccessFormValue = {
  status: 'nao_validado',
  auth_by_client: false,
  account_level: '',
  level_sufficiency: 'nao_avaliado',
  last_validated_at: '',
  pending_note: '',
}

function toLocalDateTimeInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function govAccessFromRecord(client: Partial<Client>): GovAccessFormValue {
  return {
    status: client.gov_access_status ?? 'nao_validado',
    auth_by_client: client.gov_auth_by_client ?? false,
    account_level: client.gov_account_level ?? '',
    level_sufficiency: client.gov_account_level_sufficient == null
      ? 'nao_avaliado'
      : client.gov_account_level_sufficient ? 'sim' : 'nao',
    last_validated_at: toLocalDateTimeInput(client.gov_access_last_validated_at),
    pending_note: client.gov_access_pending_note ?? '',
  }
}

export function govAccessPayload(value: GovAccessFormValue) {
  const isValidated = value.status === 'validado'
  const validatedAt = value.last_validated_at
    ? new Date(value.last_validated_at).toISOString()
    : isValidated ? new Date().toISOString() : null

  return {
    gov_access_status: value.status,
    gov_auth_by_client: isValidated ? true : value.auth_by_client,
    gov_account_level: value.account_level || null,
    gov_account_level_sufficient: value.level_sufficiency === 'nao_avaliado'
      ? null
      : value.level_sufficiency === 'sim',
    gov_access_last_validated_at: validatedAt,
    gov_access_pending_note: value.pending_note.trim() || null,
  }
}
