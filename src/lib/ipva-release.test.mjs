import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIpvaVehicleStage, canReleaseIpva, requiresInvoiceDate } from './ipva-release.ts'

test('placa e marca liberam o ipva', () => {
  assert.equal(canReleaseIpva({ plate: 'ABC1D23', brand: 'Fiat', vehicleCondition: 'usado' }), true)
  assert.equal(canReleaseIpva({ plate: 'ABC1D23', brand: '  ', vehicleCondition: 'usado' }), false)
  assert.equal(canReleaseIpva({ plate: '', brand: 'Fiat', vehicleCondition: 'usado' }), false)
})

test('carro zero exige data de emissao da nota fiscal', () => {
  assert.equal(requiresInvoiceDate({ plate: 'ABC1D23', brand: 'Fiat', vehicleCondition: 'zero_km' }), true)
  assert.equal(
    requiresInvoiceDate({ plate: 'ABC1D23', brand: 'Fiat', vehicleCondition: 'zero_km', invoiceIssuedAt: '2026-08-01' }),
    false,
  )
  assert.equal(requiresInvoiceDate({ plate: 'ABC1D23', brand: 'Fiat', vehicleCondition: 'usado' }), false)
})

test('etapa de veiculo so fecha com os dados completos', () => {
  const usado = buildIpvaVehicleStage({ plate: 'ABC1D23', brand: 'Fiat', model: 'Mobi', vehicleCondition: 'usado' })
  assert.equal(usado.status, 'concluido')
  assert.equal(usado.data.license_plate, 'ABC1D23')

  const zeroSemNota = buildIpvaVehicleStage({ plate: 'ABC1D23', brand: 'Fiat', vehicleCondition: 'zero_km' })
  assert.equal(zeroSemNota.status, 'em_andamento')

  const zeroComNota = buildIpvaVehicleStage({
    plate: 'ABC1D23', brand: 'Fiat', vehicleCondition: 'zero_km', invoiceIssuedAt: '2026-08-01',
  })
  assert.equal(zeroComNota.status, 'concluido')
  assert.equal(zeroComNota.data.invoice_issued_at, '2026-08-01')
})
