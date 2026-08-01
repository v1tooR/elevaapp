import assert from 'node:assert/strict'
import test from 'node:test'
import { buildServicePlanDefinitions } from './service-plan.ts'

test('CNH Especial assume a primeira posicao e bloqueia o IPI', () => {
  const plan = buildServicePlanDefinitions(['ipi', 'cnh_especial', 'icms'])

  assert.deepEqual(plan.map(item => item.service), ['cnh_especial', 'ipi', 'icms'])
  assert.equal(plan[0].startsOnConversion, true)
  assert.equal(plan[1].prerequisite, 'cnh_especial')
  assert.equal(plan[2].prerequisite, 'ipi')
})

test('IPVA permanece independente das dependencias de IPI e ICMS', () => {
  const plan = buildServicePlanDefinitions(['ipi', 'icms', 'ipva'])
  const ipva = plan.find(item => item.service === 'ipva')

  assert.equal(ipva?.prerequisite, null)
  assert.equal(ipva?.availableToStart, true)
})

test('somente o primeiro servico apto e iniciado durante a conversao', () => {
  const plan = buildServicePlanDefinitions(['cin', 'ipva', 'aposentadoria'])

  assert.deepEqual(
    plan.filter(item => item.startsOnConversion).map(item => item.service),
    ['cin'],
  )
  assert.equal(plan.every(item => item.availableToStart), true)
})

test('IPVA e ICMS aguardam a identificacao do veiculo antes de iniciar', () => {
  const plan = buildServicePlanDefinitions(['ipva', 'icms'])

  assert.equal(plan.some(item => item.startsOnConversion), false)
  assert.equal(plan.every(item => item.requiresVehicleBeforeStart), true)
})
