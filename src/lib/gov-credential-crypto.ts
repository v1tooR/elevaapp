import 'server-only'

import {
  decodeGovCredentialKey,
  encryptGovCredentialEnvelope,
} from '@/lib/gov-credential-envelope'

export class GovCredentialConfigurationError extends Error {
  constructor() {
    super('A proteção da credencial Gov.br não está configurada.')
    this.name = 'GovCredentialConfigurationError'
  }
}

export function encryptGovCredential(password: string, clientId: string) {
  const encodedKey = process.env.GOV_CREDENTIAL_ENCRYPTION_KEY
  const keyVersion = process.env.GOV_CREDENTIAL_KEY_VERSION ?? 'v1'

  if (!encodedKey) {
    throw new GovCredentialConfigurationError()
  }

  let key: Buffer | null = null
  try {
    key = decodeGovCredentialKey(encodedKey)
    return encryptGovCredentialEnvelope({
      clientId,
      key,
      keyVersion,
      password,
    })
  } catch (error) {
    if (error instanceof GovCredentialConfigurationError) throw error
    throw new GovCredentialConfigurationError()
  } finally {
    key?.fill(0)
  }
}
