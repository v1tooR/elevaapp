import test from 'node:test'
import assert from 'node:assert/strict'
import { govAccessPayload } from './gov-access.ts'

test('acesso Gov.br validado exige autenticação do cliente e não produz credenciais', () => {
  const payload = govAccessPayload({
    status: 'validado',
    auth_by_client: false,
    account_level: 'prata',
    level_sufficiency: 'sim',
    last_validated_at: '2026-07-21T16:30',
    pending_note: '',
  })

  assert.equal(payload.gov_auth_by_client, true)
  assert.equal(payload.gov_account_level, 'prata')
  assert.equal(payload.gov_account_level_sufficient, true)
  assert.ok(payload.gov_access_last_validated_at?.startsWith('2026-07-21T'))
  assert.equal('password' in payload, false)
  assert.equal('senha' in payload, false)
})

test('situação não avaliada permanece nula no banco', () => {
  const payload = govAccessPayload({
    status: 'aguardando_cliente',
    auth_by_client: false,
    account_level: '',
    level_sufficiency: 'nao_avaliado',
    last_validated_at: '',
    pending_note: 'Cliente precisa recuperar a conta',
  })

  assert.equal(payload.gov_account_level, null)
  assert.equal(payload.gov_account_level_sufficient, null)
  assert.equal(payload.gov_access_last_validated_at, null)
  assert.equal(payload.gov_access_pending_note, 'Cliente precisa recuperar a conta')
})
