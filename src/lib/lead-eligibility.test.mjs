import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLeadDisabilityTypes,
  getLeadIntendedServices,
  leadEligibilityFromRecord,
  leadEligibilityPayload,
  LEAD_SERVICE_PROCESS_TYPE_SLUGS,
} from './lead-eligibility.ts'

test('condições associadas preservam múltiplas seleções e o campo legado', () => {
  assert.deepEqual(
    getLeadDisabilityTypes({
      disability_type: 'fisica',
      disability_types: ['auditiva', 'fisica'],
    }),
    ['auditiva', 'fisica'],
  )

  const form = leadEligibilityFromRecord({
    is_driver: true,
    disability_type: 'fisica',
    disability_types: ['fisica', 'auditiva'],
  })

  assert.deepEqual(form.disability_types, ['fisica', 'auditiva'])
  assert.equal(form.client_type, 'condutor')
})

test('lead condutor normaliza restrições e não mantém representante', () => {
  const payload = leadEligibilityPayload({
    client_type: 'condutor',
    disability_types: ['fisica', 'auditiva'],
    has_legal_representative: true,
    legal_representative_name: 'Representante legado',
    has_cnh_especial: true,
    cnh_restrictions: 'b, d, B',
    receives_loas_bpc: true,
    has_medical_report: true,
    intended_services: ['ipva', 'cnh_especial', 'ipi', 'ipi'],
  })

  assert.equal(payload.is_driver, true)
  assert.equal(payload.disability_type, 'fisica')
  assert.deepEqual(payload.disability_types, ['fisica', 'auditiva'])
  assert.deepEqual(payload.cnh_restrictions, ['B', 'D'])
  assert.equal(payload.has_legal_representative, false)
  assert.equal(payload.legal_representative_name, null)
  assert.equal(payload.report_valid, true)
  assert.deepEqual(payload.intended_services, ['cnh_especial', 'ipva', 'ipi'])
  assert.equal(payload.intended_service, 'cnh_especial')
})

test('lead não condutor limpa CNH e mantém somente o nome do representante', () => {
  const payload = leadEligibilityPayload({
    client_type: 'nao_condutor',
    disability_types: ['visual'],
    has_legal_representative: true,
    legal_representative_name: '  Maria da Silva  ',
    has_cnh_especial: true,
    cnh_restrictions: 'X',
    receives_loas_bpc: false,
    has_medical_report: false,
    intended_services: ['ipva'],
  })

  assert.equal(payload.is_driver, false)
  assert.equal(payload.cnh_status, 'nao_possui')
  assert.equal(payload.has_cnh_especial, false)
  assert.deepEqual(payload.cnh_restrictions, [])
  assert.equal(payload.has_legal_representative, true)
  assert.equal(payload.legal_representative_name, 'Maria da Silva')
  assert.equal(payload.report_valid, null)
})

test('serviços pretendidos preservam o legado e priorizam a CNH Especial', () => {
  assert.deepEqual(
    getLeadIntendedServices({
      intended_service: 'ipi',
      intended_services: ['ipva', 'cnh_especial'],
    }),
    ['cnh_especial', 'ipva', 'ipi'],
  )
  assert.equal(LEAD_SERVICE_PROCESS_TYPE_SLUGS.ipi, 'processo_ipi')
  assert.equal(LEAD_SERVICE_PROCESS_TYPE_SLUGS.credencial_estacionamento, 'estacionamento')
})
