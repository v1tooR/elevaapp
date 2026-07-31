import test from 'node:test'
import assert from 'node:assert/strict'
import {
  partnerSupportsSource,
  referralLeadBucket,
  referralMonthBounds,
  referralTypeForSource,
} from './referral-partners.ts'

test('origens de vendedor e indicação usam categorias do mesmo cadastro', () => {
  const partner = { partner_types: ['vendedor', 'indicador'] }

  assert.equal(referralTypeForSource('vendedor'), 'vendedor')
  assert.equal(referralTypeForSource('indicacao'), 'indicador')
  assert.equal(referralTypeForSource('google'), null)
  assert.equal(partnerSupportsSource(partner, 'vendedor'), true)
  assert.equal(partnerSupportsSource(partner, 'indicacao'), true)
})

test('filtro mensal usa os limites do mês no fuso de São Paulo', () => {
  assert.deepEqual(referralMonthBounds('2026-12'), {
    start: '2026-12-01T00:00:00-03:00',
    end: '2027-01-01T00:00:00-03:00',
  })
  assert.equal(referralMonthBounds('2026-13'), null)
})

test('resumo separa convertidos, perdidos e leads ainda em andamento', () => {
  assert.equal(referralLeadBucket('convertido'), 'convertidos')
  assert.equal(referralLeadBucket('perdido'), 'perdidos')
  assert.equal(referralLeadBucket('novo'), 'em_andamento')
  assert.equal(referralLeadBucket('frio'), 'em_andamento')
  assert.equal(referralLeadBucket('quente'), 'em_andamento')
})
