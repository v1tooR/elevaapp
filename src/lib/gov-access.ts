import type { Client, GovAccessStatus } from '@/types/database'

export interface GovAccessFormValue {
  status: GovAccessStatus
  pending_note: string
}

export interface GovCredentialMetadata {
  exists: boolean
  storedAt: string | null
  purgeAfter: string | null
  hardExpiresAt: string | null
}

export const EMPTY_GOV_ACCESS: GovAccessFormValue = {
  status: 'nao_informou',
  pending_note: '',
}

const LEGACY_STATUS_MAP: Record<string, GovAccessStatus> = {
  nao_validado: 'aguardando',
  aguardando_cliente: 'aguardando',
  com_pendencia: 'aguardando',
  aguardando: 'aguardando',
  validado: 'validado',
  nao_informou: 'nao_informou',
}

export function normalizeGovAccessStatus(status?: string | null): GovAccessStatus {
  return status ? LEGACY_STATUS_MAP[status] ?? 'nao_informou' : 'nao_informou'
}

export function govAccessFromRecord(client: Partial<Client>): GovAccessFormValue {
  return {
    status: normalizeGovAccessStatus(client.gov_access_status),
    pending_note: client.gov_access_pending_note ?? '',
  }
}

export function govAccessPayload(value: GovAccessFormValue) {
  return {
    gov_access_status: value.status,
    gov_access_pending_note: value.pending_note.trim() || null,
  }
}

export function normalizeGovCredentialMetadata(value: unknown): GovCredentialMetadata {
  if (!value || typeof value !== 'object') {
    return { exists: false, storedAt: null, purgeAfter: null, hardExpiresAt: null }
  }

  const metadata = value as Record<string, unknown>
  return {
    exists: metadata.exists === true,
    storedAt: typeof metadata.stored_at === 'string' ? metadata.stored_at : null,
    purgeAfter: typeof metadata.purge_after === 'string' ? metadata.purge_after : null,
    hardExpiresAt: typeof metadata.hard_expires_at === 'string' ? metadata.hard_expires_at : null,
  }
}
