import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareOperationalActions,
  deriveProcessAction,
  getOperationalActionCategory,
  isServiceDependencyBlocker,
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

test('processo materializado mas bloqueado não gera ação para a equipe', () => {
  const action = deriveProcessAction({
    processStatus: 'aberto',
    blockedReason: 'Aguardando deferimento do IPI',
    today: '2026-08-03',
  })

  assert.equal(action.nextAction, 'Aguardar: Aguardando deferimento do IPI')
  assert.equal(action.requiresTeamAction, false)
  assert.equal(action.priority, 'aguardando_externo')
})

test('dependências automáticas são reconhecidas sem confundir espera externa', () => {
  assert.equal(isServiceDependencyBlocker('Aguardando conclusão da CNH Especial'), true)
  assert.equal(isServiceDependencyBlocker('Aguardando deferimento do IPI'), true)
  assert.equal(isServiceDependencyBlocker('Cliente optou por comprar somente com IPI'), true)
  assert.equal(isServiceDependencyBlocker('Aguardando documento do cliente'), false)
})

test('catálogo central classifica ações sugeridas', () => {
  assert.equal(getOperationalActionCategory('Agendar perícia', 'em_andamento'), 'agendar')
  assert.equal(getOperationalActionCategory('Solicitar laudo', 'em_andamento'), 'solicitar')
  assert.equal(getOperationalActionCategory('Dar entrada no processo', 'aberto'), 'dar_entrada')
  assert.equal(getOperationalActionCategory('Consultar retorno do órgão', 'aguardando_orgao'), 'consultar')
  assert.equal(getOperationalActionCategory('Qualquer texto', 'concluido'), 'encerrar')
})

test('ordenação coloca vencidos e ações da equipe antes de esperas externas', () => {
  const rows = [
    { priorityRank: 3, dueDate: null },
    { priorityRank: 1, dueDate: '2026-08-05' },
    { priorityRank: 0, dueDate: '2026-07-31' },
  ].sort(compareOperationalActions)

  assert.deepEqual(rows.map(row => row.priorityRank), [0, 1, 3])
})
