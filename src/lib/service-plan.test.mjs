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

test('todos os servicos independentes iniciam durante a conversao', () => {
  const plan = buildServicePlanDefinitions(['cin', 'ipva', 'aposentadoria'])

  assert.deepEqual(
    plan.filter(item => item.startsOnConversion).map(item => item.service),
    ['cin', 'ipva', 'aposentadoria'],
  )
  assert.equal(plan.every(item => item.availableToStart), true)
})

test('veiculo nao bloqueia a abertura de IPVA ou ICMS', () => {
  const plan = buildServicePlanDefinitions(['ipva', 'icms'])

  assert.deepEqual(
    plan.filter(item => item.startsOnConversion).map(item => item.service),
    ['ipva', 'icms'],
  )
})
