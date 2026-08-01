import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInstallmentSchedule, calculateContractProfit } from './financial-contracts.ts'

test('parcelamento preserva centavos e soma exatamente o valor liquido', () => {
  const installments = buildInstallmentSchedule(100, 3, '2026-08-31')

  assert.deepEqual(installments.map(item => item.amount), [33.33, 33.33, 33.34])
  assert.equal(installments.reduce((sum, item) => sum + item.amount, 0), 100)
})

test('vencimentos mensais respeitam o ultimo dia de cada mes', () => {
  const installments = buildInstallmentSchedule(200, 2, '2028-01-31')

  assert.deepEqual(installments.map(item => item.due_date), ['2028-01-31', '2028-02-29'])
})

test('lucro e margem descontam custos e comissoes sem confundir caixa recebido', () => {
  const result = calculateContractProfit({
    netAmount: 1000,
    received: 250,
    costs: 100,
    commissions: 150,
  })

  assert.deepEqual(result, {
    outstanding: 750,
    estimatedProfit: 750,
    marginPercentage: 75,
  })
})
