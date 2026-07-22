import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getMedicalRequirements,
  inferAppealStatus,
  mergeMedicalRequirementAudit,
  validateAppealWorkflow,
} from './cnh-medical-workflow.ts'

const stage = {
  id: 'stage-1',
  stage_key: 'pericia_medica',
  scheduled_date: '2026-07-10',
  updated_at: '2026-07-10T18:00:00.000Z',
  data: {},
}

test('converte o acompanhamento médico antigo sem perder o registro', () => {
  const requirements = getMedicalRequirements({
    ...stage,
    data: {
      medical_follow_up_status: 'complementary_exam_requested',
      complementary_exam_name: 'Tomografia da coluna',
    },
  })

  assert.equal(requirements.length, 1)
  assert.equal(requirements[0].title, 'Tomografia da coluna')
  assert.equal(requirements[0].status, 'pendente')
  assert.equal(requirements[0].history[0].event, 'migrated')
})

test('mantém várias exigências e registra mudança de status no histórico', () => {
  const existing = [{
    id: 'req-1',
    type: 'exame_complementar',
    title: 'Tomografia',
    details: '',
    requested_at: '2026-07-10',
    due_date: '',
    follow_up_date: '',
    status: 'pendente',
    result: '',
    created_at: '2026-07-10T18:00:00.000Z',
    updated_at: '2026-07-10T18:00:00.000Z',
    history: [],
  }]
  const incoming = [
    { ...existing[0], status: 'concluida', result: 'Entregue à médica' },
    { ...existing[0], id: 'req-2', title: 'Novo laudo', type: 'exigencia_medica' },
  ]

  const merged = mergeMedicalRequirementAudit(existing, incoming, '2026-07-22T12:00:00.000Z')
  assert.equal(merged.length, 2)
  assert.equal(merged[0].history[0].event, 'status_changed')
  assert.equal(merged[1].history[0].event, 'created')
})

test('registro omitido no envio é preservado para auditoria', () => {
  const existing = [{
    id: 'req-1', type: 'exigencia_medica', title: 'Novo laudo', details: '',
    requested_at: '2026-07-10', due_date: '', follow_up_date: '', status: 'pendente', result: '',
    created_at: '', updated_at: '', history: [],
  }]
  assert.equal(mergeMedicalRequirementAudit(existing, [], '2026-07-22T12:00:00.000Z').length, 1)
})

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
