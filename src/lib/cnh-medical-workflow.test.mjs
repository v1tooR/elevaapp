import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inferAppealStatus,
  validateAppealWorkflow,
} from './cnh-medical-workflow.ts'

const stage = {
  id: 'stage-1',
  stage_key: 'pericia_medica',
  scheduled_date: '2026-07-10',
  updated_at: '2026-07-10T18:00:00.000Z',
  data: {},
}

test('infere a situação de recursos antigos', () => {
  assert.equal(inferAppealStatus({ ...stage, scheduled_date: null, stage_key: 'recurso_junta_medica', data: { protocolo: 'SEI-123' } }), 'aguardando_agendamento')
  assert.equal(inferAppealStatus({ ...stage, stage_key: 'recurso_junta_medica', result: 'aprovado' }), 'concluido')
})

test('recurso protocolado exige protocolo e data de protocolo', () => {
  assert.match(validateAppealWorkflow({
    data: { appeal_status: 'recurso_protocolado' },
  }), /protocolo SEI/)

  assert.equal(validateAppealWorkflow({
    data: { appeal_status: 'recurso_protocolado', protocolo: 'SEI-123', appeal_filed_at: '2026-07-22' },
  }), null)
})

test('conclusão do recurso exige data e resultado da junta', () => {
  assert.match(validateAppealWorkflow({
    data: { appeal_status: 'concluido', protocolo: 'SEI-123', appeal_filed_at: '2026-07-01' },
    result: 'aprovado',
  }), /data da Junta/)

  assert.match(validateAppealWorkflow({
    data: { appeal_status: 'concluido', protocolo: 'SEI-123', appeal_filed_at: '2026-07-01' },
    scheduledDate: '2026-07-21',
  }), /“Aprovado”.*“Reprovado”/)

  assert.equal(validateAppealWorkflow({
    data: { appeal_status: 'concluido', protocolo: 'SEI-123', appeal_filed_at: '2026-07-01' },
    scheduledDate: '2026-07-21',
    result: 'aprovado',
  }), null)
})

test('resultado final exige situação operacional concluída', () => {
  assert.match(validateAppealWorkflow({
    data: { appeal_status: 'aguardando_resultado', protocolo: 'SEI-123', appeal_filed_at: '2026-07-01' },
    scheduledDate: '2026-07-21',
    stageStatus: 'aprovado',
    result: 'aprovado',
  }), /Recurso concluído/)
})
