import assert from 'node:assert/strict'
import test from 'node:test'
import { applyStartingStage } from './process-start-stage.ts'

test('inicio no meio do fluxo conclui somente etapas anteriores aplicaveis', () => {
  const rows = applyStartingStage([
    { stage_key: 'documentos', sort_order: 10, status: 'pendente', data: {} },
    { stage_key: 'opcional', sort_order: 20, status: 'nao_aplicavel', data: {} },
    { stage_key: 'protocolo', sort_order: 30, status: 'pendente', data: {} },
    { stage_key: 'analise', sort_order: 40, status: 'pendente', data: {} },
  ], 'protocolo')

  assert.equal(rows[0].status, 'concluido')
  assert.equal(rows[0].data.concluida_antes_da_eleva, true)
  assert.equal(rows[1].status, 'nao_aplicavel')
  assert.equal(rows[2].status, 'em_andamento')
  assert.equal(rows[3].status, 'pendente')
})
