import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clientEligibilityFromRecord,
  clientEligibilityPayload,
} from './client-eligibility.ts'

test('cliente usa somente a seleção múltipla de condições', () => {
  const form = clientEligibilityFromRecord({
    disability_type: 'fisica',
    disability_types: ['auditiva', 'fisica'],
  })

  assert.deepEqual(form.disability_types, ['auditiva', 'fisica'])
  assert.equal('disability_type' in form, false)
})

test('triagem preserva compatibilidade sem gravar decisões exclusivas do processo', () => {
  const payload = clientEligibilityPayload({
    client_type: 'condutor',
    disability_types: ['fisica', 'auditiva'],
    cnh_status: 'com_restricoes',
    cnh_restrictions: 'b, d',
    cnh_expiry_date: '2030-07-30',
    medical_assessment_status: 'nao_realizada',
    authorized_drivers: [],
    has_legal_representative: false,
    legal_representative_name: '',
    legal_representative_cpf: '',
    receives_loas_bpc: false,
    has_medical_report: false,
    report_valid_until: '',
    eligibility_notes: '',
  })

  assert.equal(payload.disability_type, 'fisica')
  assert.deepEqual(payload.disability_types, ['fisica', 'auditiva'])
  assert.deepEqual(payload.cnh_restrictions, ['B', 'D'])
  assert.equal(payload.cnh_expiry_date, '2030-07-30')
  assert.equal('requires_practical_exam' in payload, false)
  assert.equal('requires_adapted_vehicle' in payload, false)
  assert.equal('disability_severity' in payload, false)
  assert.equal('disability_details' in payload, false)
})
