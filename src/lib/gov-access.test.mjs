import test from 'node:test'
import assert from 'node:assert/strict'
import {
  govAccessPayload,
  normalizeGovAccessStatus,
  normalizeGovCredentialMetadata,
} from './gov-access.ts'

test('situação do Gov.br usa somente os três estados operacionais', () => {
  assert.equal(normalizeGovAccessStatus('aguardando'), 'aguardando')
  assert.equal(normalizeGovAccessStatus('validado'), 'validado')
  assert.equal(normalizeGovAccessStatus('nao_informou'), 'nao_informou')
})

test('estados legados são normalizados sem perder a intenção operacional', () => {
  assert.equal(normalizeGovAccessStatus('nao_validado'), 'aguardando')
  assert.equal(normalizeGovAccessStatus('aguardando_cliente'), 'aguardando')
  assert.equal(normalizeGovAccessStatus('com_pendencia'), 'aguardando')
  assert.equal(normalizeGovAccessStatus(undefined), 'nao_informou')
})

test('payload operacional não mistura senha nem campos legados', () => {
  const payload = govAccessPayload({
    status: 'validado',
    pending_note: '  Acesso confirmado  ',
  })

  assert.deepEqual(payload, {
    gov_access_status: 'validado',
    gov_access_pending_note: 'Acesso confirmado',
  })
  assert.equal('password' in payload, false)
  assert.equal('senha' in payload, false)
  assert.equal('gov_account_level' in payload, false)
  assert.equal('gov_auth_by_client' in payload, false)
  assert.equal('gov_access_last_validated_at' in payload, false)
})

test('metadados seguros não aceitam conteúdo inesperado como credencial', () => {
  const metadata = normalizeGovCredentialMetadata({
    exists: true,
    stored_at: '2026-07-30T10:00:00.000Z',
    purge_after: null,
    hard_expires_at: '2027-01-26T10:00:00.000Z',
    ciphertext: 'não deve ser propagado',
  })

  assert.deepEqual(metadata, {
    exists: true,
    storedAt: '2026-07-30T10:00:00.000Z',
    purgeAfter: null,
    hardExpiresAt: '2027-01-26T10:00:00.000Z',
  })
  assert.equal('ciphertext' in metadata, false)
})
