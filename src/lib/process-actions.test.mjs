import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareOperationalActions,
  deriveProcessAction,
} from './process-actions.ts'

test('ação vencida da equipe recebe prioridade máxima', () => {
  const action = deriveProcessAction({
    processStatus: 'em_andamento',
    nextAction: 'Agendar exame prático',
    actionOwner: 'equipe',
    actionDueDate: '2026-07-31',
    today: '2026-08-01',
  })

  assert.equal(action.priority, 'vencido')
  assert.equal(action.requiresTeamAction, true)
  assert.equal(action.isOverdue, true)
})

test('data agendada vira espera do cliente sem sinalizar ação da equipe', () => {
  const action = deriveProcessAction({
    processStatus: 'em_andamento',
    currentStage: {
      label: 'Exame prático',
      status: 'em_andamento',
      scheduled_date: '2026-08-10',
    },
    today: '2026-08-01',
  })

  assert.equal(action.nextAction, 'Aguardar realização: Exame prático')
  assert.equal(action.actor, 'cliente')
  assert.equal(action.priority, 'aguardando_data')
  assert.equal(action.requiresTeamAction, false)
})

test('processo aberto sem etapas sugere dar entrada', () => {
  const action = deriveProcessAction({
    processStatus: 'aberto',
    today: '2026-08-01',
  })

  assert.equal(action.nextAction, 'Dar entrada no processo')
  assert.equal(action.priority, 'acao_equipe')
})

test('ordenação coloca vencidos e ações da equipe antes de esperas externas', () => {
  const rows = [
    { priorityRank: 3, dueDate: null },
    { priorityRank: 1, dueDate: '2026-08-05' },
    { priorityRank: 0, dueDate: '2026-07-31' },
  ].sort(compareOperationalActions)

  assert.deepEqual(rows.map(row => row.priorityRank), [0, 1, 3])
})
