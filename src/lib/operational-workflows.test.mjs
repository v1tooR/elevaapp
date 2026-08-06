import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPERATIONAL_WORKFLOW_SLUGS,
  buildOperationalStageRows,
  getIpiDetranReportStatus,
  getIpiDetranStageStatus,
  getOperationalWorkflowDefinition,
  isOperationalFieldVisible,
  isOperationalStageBlocked,
  validateOperationalStage,
} from './operational-workflows.ts'

test('todos os processos internos do PDF possuem workflow base', () => {
  for (const slug of ['processo_ipi', 'processo_icms', 'emplacamento', 'estacionamento', 'cin', 'rodizio', 'imposto_de_renda', 'laudo']) {
    assert.ok(OPERATIONAL_WORKFLOW_SLUGS.includes(slug), `${slug} sem workflow`)
  }
})

test('etapas têm chaves e ordens únicas dentro de cada processo', () => {
  for (const slug of OPERATIONAL_WORKFLOW_SLUGS) {
    const workflow = getOperationalWorkflowDefinition(slug)
    const keys = workflow.stages.map(stage => stage.stage_key)
    const orders = workflow.stages.map(stage => stage.sort_order)
    assert.equal(new Set(keys).size, keys.length, `${slug} tem chave duplicada`)
    assert.equal(new Set(orders).size, orders.length, `${slug} tem ordem duplicada`)
  }
})

test('etapas condicionais iniciam como não aplicáveis', () => {
  const rows = buildOperationalStageRows('process-1', 'processo_ipi')
  assert.equal(rows.find(row => row.stage_key === 'recurso_ipi').status, 'nao_aplicavel')
})

test('IPI usa apenas laudo, checklist, protocolo/decisão e recurso', () => {
  const workflow = getOperationalWorkflowDefinition('processo_ipi')
  assert.deepEqual(
    workflow.stages.map(stage => stage.stage_key),
    ['laudo_ipi', 'documentos_ipi', 'protocolo_sisen_ipi', 'recurso_ipi'],
  )
})

test('decisao do IPI exige a escolha que controla a liberacao do ICMS', () => {
  const workflow = getOperationalWorkflowDefinition('processo_ipi')
  const template = workflow.stages.find(stage => stage.stage_key === 'protocolo_sisen_ipi')
  const baseData = {
    protocol: 'IPI-123',
    protocol_date: '2026-08-04',
    request_scope: 'ipi',
  }

  assert.match(validateOperationalStage({
    template,
    status: 'aprovado',
    result: 'deferido',
    data: baseData,
  }), /somente com IPI/)
  assert.equal(validateOperationalStage({
    template,
    status: 'aprovado',
    result: 'deferido',
    data: { ...baseData, purchase_only_with_ipi: 'nao' },
  }), null)
})

test('ICMS concentra compra, protocolo e decisão em uma única etapa', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  assert.deepEqual(
    workflow.stages.map(stage => stage.stage_key),
    ['pre_requisitos_icms', 'protocolo_sivei_icms', 'recurso_icms'],
  )
})

test('compra do ICMS registra datas para a visão completa do cliente', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const purchase = workflow.stages.find(stage => stage.stage_key === 'protocolo_sivei_icms')
  const fieldKeys = purchase.fields.map(field => field.key)

  assert.ok(fieldKeys.includes('purchase_date'))
  assert.ok(fieldKeys.includes('next_vehicle_change_date'))
  assert.ok(fieldKeys.includes('chassis'))
  assert.ok(fieldKeys.includes('license_plate'))
  assert.ok(fieldKeys.includes('renavam'))
  assert.equal(purchase.fields.find(field => field.key === 'vehicle').requiredOnResolve, undefined)
})

test('Laudo DETRAN inicia a solicitar e bloqueia os documentos do IPI', () => {
  const rows = buildOperationalStageRows('process-1', 'processo_ipi')
  const report = rows.find(row => row.stage_key === 'laudo_ipi')
  const documents = rows.find(row => row.stage_key === 'documentos_ipi')

  assert.equal(getIpiDetranReportStatus(report.data, report.status), 'nao_solicitado')
  assert.equal(getIpiDetranStageStatus('pronto'), 'concluido')
  assert.equal(getIpiDetranStageStatus('nao_aplicavel'), 'nao_aplicavel')
  assert.equal(getIpiDetranReportStatus({ report_status: 'em_andamento' }), 'solicitado')
  assert.equal(getIpiDetranReportStatus({ report_status: 'nao_aplicavel' }), 'nao_solicitado')
  assert.equal(isOperationalStageBlocked(documents.data), true)
})

test('Laudo DETRAN recebido aceita identificação progressiva do documento', () => {
  const workflow = getOperationalWorkflowDefinition('processo_ipi')
  const template = workflow.stages.find(stage => stage.stage_key === 'laudo_ipi')
  assert.equal(validateOperationalStage({
    template,
    status: 'concluido',
    data: { report_status: 'pronto' },
  }), null)
})

test('checklist obrigatório impede conclusão incompleta', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const template = workflow.stages.find(stage => stage.stage_key === 'pre_requisitos_icms')
  const checklistKeys = template.checklist.map(item => item.key)

  assert.ok(checklistKeys.includes('autorizacao_ipi'))
  assert.ok(checklistKeys.includes('laudo'))
  assert.equal(template.checklist.find(item => item.key === 'autorizacao_ipi').label, 'Autorização do IPI válida')
  assert.equal(template.checklist.find(item => item.key === 'laudo').label, 'Laudo DETRAN atualizado')
  assert.match(validateOperationalStage({
    template,
    status: 'concluido',
    data: { state_scope: 'sp', state: 'SP', checklist: {} },
  }), /Autorização do IPI/)
})

test('ICMS apresenta as situações operacionais da planilha', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const checklist = workflow.stages.find(stage => stage.stage_key === 'pre_requisitos_icms')
  const protocol = workflow.stages.find(stage => stage.stage_key === 'protocolo_sivei_icms')

  assert.deepEqual(checklist.allowedStatuses, ['pendente', 'em_andamento', 'concluido'])
  assert.deepEqual(checklist.statusLabels, {
    pendente: 'Não iniciado',
    em_andamento: 'Aguardando documento',
    concluido: 'Finalizado',
  })
  assert.equal(protocol.statusLabels.em_andamento, 'Em análise')
  assert.equal(protocol.statusLabels.aprovado, 'Deferido')
  assert.equal(protocol.statusLabels.reprovado, 'Indeferido')
})

test('campo opcional não impede conclusão do checklist', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const template = workflow.stages.find(stage => stage.stage_key === 'pre_requisitos_icms')
  assert.equal(validateOperationalStage({
    template,
    status: 'concluido',
    data: { state_scope: 'sp', state: 'SP', checklist: {
      autorizacao_ipi: true,
      laudo: true,
      anexo_ii: true,
      comprovante_renda: true,
      forma_pagamento: true,
      comprovante_endereco: true,
      procuracao: false,
    } },
  }), null)
})

test('seletor de UF do ICMS aparece apenas para outro estado', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const template = workflow.stages.find(stage => stage.stage_key === 'pre_requisitos_icms')
  const stateField = template.fields.find(field => field.key === 'state')

  assert.equal(isOperationalFieldVisible(stateField, { state_scope: 'sp', state: 'SP' }), false)
  assert.equal(isOperationalFieldVisible(stateField, { state_scope: 'outro' }), true)
})

test('decisão do ICMS exige comunicação e autorização antes de resolver', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const template = workflow.stages.find(stage => stage.stage_key === 'protocolo_sivei_icms')
  assert.match(validateOperationalStage({
    template,
    status: 'aprovado',
    result: 'deferido',
    data: { protocol: '123', protocol_date: '2026-08-03' },
  }), /Cliente comunicado/)
  assert.equal(validateOperationalStage({
    template,
    status: 'aprovado',
    result: 'deferido',
    data: {
      protocol: '123',
      protocol_date: '2026-08-03',
      client_notified: true,
      documents_release_authorized: true,
    },
  }), null)
})
