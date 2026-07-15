import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeEligibility, getCnhSubflow } from './eligibility.ts'

const driver = { name: 'Maria Condutora', cpf: '000.000.000-00', cnh: '12345678900' }

test('CNH aguarda perícia quando exame prático ainda não foi definido', () => {
  assert.equal(getCnhSubflow({ clientType: 'condutor', requiresPracticalExam: null }), 'aguardando_pericia')
})

test('CNH usa exame prático somente quando ele foi determinado', () => {
  assert.equal(getCnhSubflow({ clientType: 'condutor', requiresPracticalExam: true }), 'com_exame_pratico')
  assert.equal(getCnhSubflow({ clientType: 'condutor', requiresPracticalExam: false }), 'sem_exame_pratico')
})

test('tipo de deficiência não bloqueia automaticamente a análise de CNH do condutor', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'cnh_especial',
    clientType: 'condutor',
    disabilityType: 'visual',
    requiresPracticalExam: null,
  })
  assert.equal(analysis?.status, 'requer_validacao')
})

test('beneficiário não condutor não inicia CNH própria', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'cnh_especial',
    clientType: 'nao_condutor',
    disabilityType: 'fisica',
  })
  assert.equal(analysis?.status, 'provavelmente_nao_elegivel')
})

test('IPI admite triagem de não condutor com condutor autorizado', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_ipi',
    clientType: 'nao_condutor',
    disabilityType: 'fisica',
    vehicleCondition: 'zero_km',
    hasMedicalReport: true,
    authorizedDrivers: [driver],
  })
  assert.equal(analysis?.status, 'pre_elegivel')
})

test('visão monocular exige validação específica no IPI', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_ipi',
    clientType: 'condutor',
    disabilityType: 'monocular',
    vehicleCondition: 'zero_km',
    hasMedicalReport: true,
    cnhStatus: 'com_restricoes',
    cnhRestrictions: ['X'],
  })
  assert.equal(analysis?.status, 'requer_validacao')
})

test('IOF aponta impedimento inicial para deficiência não física', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_iof',
    clientType: 'condutor',
    disabilityType: 'auditiva',
    vehicleCondition: 'zero_km',
    hasMedicalReport: true,
    cnhStatus: 'com_restricoes',
    cnhRestrictions: ['B'],
  })
  assert.equal(analysis?.status, 'provavelmente_nao_elegivel')
})

test('IOF físico com CNH restrita pode seguir para conferência', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_iof',
    clientType: 'condutor',
    disabilityType: 'fisica',
    vehicleCondition: 'zero_km',
    hasMedicalReport: true,
    cnhStatus: 'com_restricoes',
    cnhRestrictions: ['D'],
  })
  assert.equal(analysis?.status, 'pre_elegivel')
})

test('caso com múltiplas condições reconhece a deficiência física no IOF', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_iof',
    clientType: 'condutor',
    disabilityType: 'auditiva',
    disabilityTypes: ['auditiva', 'fisica'],
    vehicleCondition: 'zero_km',
    hasMedicalReport: true,
    cnhStatus: 'com_restricoes',
    cnhRestrictions: ['B', 'D'],
  })
  assert.equal(analysis?.status, 'pre_elegivel')
})

test('ICMS não condutor segue para validação da UF', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_icms',
    state: 'SP',
    clientType: 'nao_condutor',
    disabilityType: 'fisica',
    vehicleCondition: 'zero_km',
    hasMedicalReport: true,
    authorizedDrivers: [driver],
  })
  assert.equal(analysis?.status, 'requer_validacao')
})

test('IPVA-SP de veículo usado registra a particularidade do ano do pedido', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_ipva',
    state: 'SP',
    clientType: 'condutor',
    disabilityType: 'fisica',
    disabilitySeverity: 'moderada',
    vehicleCondition: 'usado',
    hasMedicalReport: true,
    cnhStatus: 'comum',
  })
  assert.equal(analysis?.status, 'requer_validacao')
  assert.ok(analysis?.reasons.some(reason => reason.includes('ano do pedido')))
})

test('IPVA sem grau funcional permanece pendente', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_ipva',
    state: 'SP',
    clientType: 'condutor',
    disabilityType: 'fisica',
    vehicleCondition: 'usado',
    hasMedicalReport: true,
    cnhStatus: 'comum',
  })
  assert.equal(analysis?.status, 'pendente_informacoes')
})

test('benefício de aquisição não é presumido para veículo usado', () => {
  const analysis = analyzeEligibility({
    processTypeSlug: 'processo_ipi',
    clientType: 'condutor',
    disabilityType: 'fisica',
    vehicleCondition: 'usado',
    hasMedicalReport: true,
    cnhStatus: 'com_restricoes',
    cnhRestrictions: ['D'],
  })
  assert.equal(analysis?.status, 'provavelmente_nao_elegivel')
})

test('processo sem regra de elegibilidade não recebe análise fiscal', () => {
  assert.equal(analyzeEligibility({ processTypeSlug: 'laudo' }), null)
})
