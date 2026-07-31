import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPERATIONAL_WORKFLOW_SLUGS,
  buildOperationalStageRows,
  getIpiDetranReportStatus,
  getIpiDetranStageStatus,
  getOperationalWorkflowDefinition,
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

test('Laudo DETRAN inicia a solicitar e bloqueia os documentos do IPI', () => {
  const rows = buildOperationalStageRows('process-1', 'processo_ipi')
  const report = rows.find(row => row.stage_key === 'laudo_ipi')
  const documents = rows.find(row => row.stage_key === 'documentos_ipi')

  assert.equal(getIpiDetranReportStatus(report.data, report.status), 'nao_solicitado')
  assert.equal(getIpiDetranStageStatus('pronto'), 'concluido')
  assert.equal(getIpiDetranStageStatus('nao_aplicavel'), 'nao_aplicavel')
  assert.equal(isOperationalStageBlocked(documents.data), true)
})

test('Laudo DETRAN pronto exige identificação do documento', () => {
  const workflow = getOperationalWorkflowDefinition('processo_ipi')
  const template = workflow.stages.find(stage => stage.stage_key === 'laudo_ipi')
  assert.match(validateOperationalStage({
    template,
    status: 'concluido',
    data: { report_status: 'pronto' },
  }), /Órgão emissor/)
  assert.equal(validateOperationalStage({
    template,
    status: 'nao_aplicavel',
    data: { report_status: 'nao_aplicavel' },
  }), null)
})

test('checklist obrigatório impede conclusão incompleta', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const template = workflow.stages.find(stage => stage.stage_key === 'documentos_icms')
  assert.match(validateOperationalStage({
    template,
    status: 'concluido',
    data: { checklist: {} },
  }), /Anexo II/)
})

test('campo opcional não impede conclusão do checklist', () => {
  const workflow = getOperationalWorkflowDefinition('processo_icms')
  const template = workflow.stages.find(stage => stage.stage_key === 'documentos_icms')
  assert.equal(validateOperationalStage({
    template,
    status: 'concluido',
    data: { checklist: {
      anexo_ii: true,
      comprovante_renda: true,
      forma_pagamento: true,
      comprovante_endereco: true,
      procuracao: false,
    } },
  }), null)
})
