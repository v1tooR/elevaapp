import test from 'node:test'
import assert from 'node:assert/strict'
import { createDecipheriv } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  decodeGovCredentialKey,
  encryptGovCredentialEnvelope,
  GOV_CREDENTIAL_ALGORITHM,
} from './gov-credential-envelope.ts'

const CLIENT_ID = 'a82b4dd6-1793-4d88-88d1-4ae74eabfd42'
const KEY_VERSION = 'v1'
const KEY_BASE64 = Buffer.alloc(32, 7).toString('base64')

function decryptForTest(envelope, clientId = CLIENT_ID) {
  const key = decodeGovCredentialKey(KEY_BASE64)
  const decipher = createDecipheriv(
    GOV_CREDENTIAL_ALGORITHM,
    key,
    Buffer.from(envelope.initializationVector, 'base64'),
  )
  decipher.setAAD(Buffer.from(`eleva:gov.br:${clientId}:${KEY_VERSION}`, 'utf8'))
  decipher.setAuthTag(Buffer.from(envelope.authenticationTag, 'base64'))

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } finally {
    key.fill(0)
  }
}

test('AES-256-GCM protege a senha e permite validar a autenticidade', () => {
  const key = decodeGovCredentialKey(KEY_BASE64)
  const password = 'Senha Gov.br única #2026'
  const envelope = encryptGovCredentialEnvelope({
    clientId: CLIENT_ID,
    key,
    keyVersion: KEY_VERSION,
    password,
  })
  key.fill(0)

  assert.equal(envelope.algorithm, 'aes-256-gcm')
  assert.notEqual(envelope.ciphertext, Buffer.from(password).toString('base64'))
  assert.equal(decryptForTest(envelope), password)
})

test('cada gravação usa IV aleatório e o cliente faz parte da autenticação', () => {
  const key = decodeGovCredentialKey(KEY_BASE64)
  const first = encryptGovCredentialEnvelope({
    clientId: CLIENT_ID,
    key,
    keyVersion: KEY_VERSION,
    password: 'mesma-senha',
  })
  const second = encryptGovCredentialEnvelope({
    clientId: CLIENT_ID,
    key,
    keyVersion: KEY_VERSION,
    password: 'mesma-senha',
  })
  key.fill(0)

  assert.notEqual(first.initializationVector, second.initializationVector)
  assert.notEqual(first.ciphertext, second.ciphertext)
  assert.throws(
    () => decryptForTest(first, 'f2d4a4c7-6d98-49bc-aa0e-83adf8f9e76a'),
    /authenticate|bad decrypt|Unsupported state/i,
  )
})

test('somente uma chave Base64 de 32 bytes é aceita', () => {
  assert.throws(() => decodeGovCredentialKey('fraca'), /32 bytes|Base64/)
  const key = decodeGovCredentialKey(KEY_BASE64)
  assert.equal(key.length, 32)
  key.fill(0)
})

test('API e banco mantêm a custódia write-only e sem logs da senha', async () => {
  const [route, migration] = await Promise.all([
    readFile(new URL('../app/api/clientes/[id]/gov-credential/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../supabase/migrations/023_secure_gov_credential_escrow.sql', import.meta.url), 'utf8'),
  ])

  assert.doesNotMatch(route, /export\s+async\s+function\s+GET/)
  assert.doesNotMatch(route, /console\.(log|info|warn|error)/)
  assert.match(route, /Cache-Control': 'no-store/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.client_gov_credentials/)
  assert.match(migration, /INTERVAL '7 days'/)
  assert.match(migration, /INTERVAL '180 days'/)
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_cron/)
  assert.doesNotMatch(migration, /decrypted_secret|decrypt_gov/i)
})
