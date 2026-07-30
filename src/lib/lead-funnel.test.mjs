import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isLeadStatus,
  LEAD_FUNNEL_STATUSES,
  LEAD_STATUS_META,
  OPEN_LEAD_STATUSES,
} from './lead-funnel.ts'

test('funil comercial mantém a ordem operacional definida', () => {
  assert.deepEqual(
    LEAD_FUNNEL_STATUSES,
    ['novo', 'frio', 'quente', 'convertido', 'perdido'],
  )
})

test('contadores de leads em aberto incluem novo, frio e quente', () => {
  assert.deepEqual(OPEN_LEAD_STATUSES, ['novo', 'frio', 'quente'])
  assert.equal(OPEN_LEAD_STATUSES.includes('convertido'), false)
  assert.equal(OPEN_LEAD_STATUSES.includes('perdido'), false)
})

test('status antigo não é mais aceito pelo funil', () => {
  assert.equal(isLeadStatus('em_atendimento'), false)
  assert.equal(isLeadStatus('frio'), true)
  assert.equal(isLeadStatus('quente'), true)
  assert.match(LEAD_STATUS_META.frio.description, /baixo interesse/i)
  assert.match(LEAD_STATUS_META.quente.description, /aguarda/i)
})
