import { createCipheriv, randomBytes } from 'node:crypto'

export const GOV_CREDENTIAL_ALGORITHM = 'aes-256-gcm' as const

export interface GovCredentialEnvelope {
  algorithm: typeof GOV_CREDENTIAL_ALGORITHM
  keyVersion: string
  ciphertext: string
  initializationVector: string
  authenticationTag: string
}

export function decodeGovCredentialKey(encodedKey: string): Buffer {
  const normalized = encodedKey.trim()
  if (
    normalized.length !== 44
    || !/^[A-Za-z0-9+/]{43}=$/.test(normalized)
  ) {
    throw new Error('A chave de criptografia Gov.br deve ser Base64 válida com 32 bytes.')
  }

  const key = Buffer.from(normalized, 'base64')
  if (key.length !== 32) {
    key.fill(0)
    throw new Error('A chave de criptografia Gov.br deve ter 32 bytes.')
  }

  return key
}

export function encryptGovCredentialEnvelope({
  clientId,
  key,
  keyVersion,
  password,
}: {
  clientId: string
  key: Buffer
  keyVersion: string
  password: string
}): GovCredentialEnvelope {
  if (key.length !== 32) {
    throw new Error('Chave de criptografia Gov.br inválida.')
  }
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(keyVersion)) {
    throw new Error('Versão da chave de criptografia Gov.br inválida.')
  }
  if (!password || password.length > 256) {
    throw new Error('Senha Gov.br inválida.')
  }

  const initializationVector = randomBytes(12)
  const passwordBuffer = Buffer.from(password, 'utf8')
  const cipher = createCipheriv(GOV_CREDENTIAL_ALGORITHM, key, initializationVector)
  cipher.setAAD(Buffer.from(`eleva:gov.br:${clientId}:${keyVersion}`, 'utf8'))

  try {
    const ciphertext = Buffer.concat([
      cipher.update(passwordBuffer),
      cipher.final(),
    ])

    return {
      algorithm: GOV_CREDENTIAL_ALGORITHM,
      keyVersion,
      ciphertext: ciphertext.toString('base64'),
      initializationVector: initializationVector.toString('base64'),
      authenticationTag: cipher.getAuthTag().toString('base64'),
    }
  } finally {
    passwordBuffer.fill(0)
  }
}
