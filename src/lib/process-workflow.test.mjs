import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAppealSchedule,
  calculateProcessRenewalDate,
  getIpvaOperationalBucket,
} from './process-workflow.ts'

test('prazo recursal usa a ciência e cria alertas D-10, D-3 e D-1', () => {
  assert.deepEqual(buildAppealSchedule('2026-07-20'), {
    noticeDate: '2026-07-20',
    dueDate: '2026-08-19',
    reminders: [
      { daysBefore: 10, date: '2026-08-09' },
      { daysBefore: 3, date: '2026-08-16' },
      { daysBefore: 1, date: '2026-08-18' },
    ],
  })
})

test('IPVA do mesmo veículo não cria renovação anual automática', () => {
  assert.equal(calculateProcessRenewalDate({
    processTypeSlug: 'processo_ipva',
    completedAt: '2026-07-20T12:00:00.000Z',
    configuredMonths: 12,
  }), null)
})

test('CNH usa exatamente o vencimento informado no documento', () => {
  assert.equal(calculateProcessRenewalDate({
    processTypeSlug: 'cnh_especial',
    completedAt: '2026-07-20T12:00:00.000Z',
    configuredMonths: 60,
    cnhExpiresAt: '2029-02-17',
  }), '2029-02-17')
})

test('outros processos continuam usando a recorrência configurada', () => {
  assert.equal(calculateProcessRenewalDate({
    processTypeSlug: 'processo_ipi',
    completedAt: '2026-01-15T12:00:00.000Z',
    configuredMonths: 24,
  }), '2028-01-15')
})

test('fila IPVA prioriza recurso aberto', () => {
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'imesc_laudo', status: 'concluido' },
    { stage_key: 'ipva_recurso', status: 'pendente' },
    { stage_key: 'ipva_conclusao', status: 'pendente' },
  ]), 'recurso')
})

test('fila IPVA distingue perícia, laudo, SEFAZ e conclusão', () => {
  assert.equal(getIpvaOperationalBucket([]), 'configuracao')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'imesc_pericia', status: 'pendente' },
    { stage_key: 'imesc_laudo', status: 'pendente' },
  ]), 'pericia')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'imesc_pericia', status: 'concluido' },
    { stage_key: 'imesc_laudo', status: 'em_andamento' },
  ]), 'laudo')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'imesc_laudo', status: 'concluido' },
    { stage_key: 'ipva_recurso', status: 'nao_aplicavel' },
    { stage_key: 'ipva_conclusao', status: 'pendente' },
  ]), 'sefaz')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'ipva_recurso', status: 'nao_aplicavel' },
    { stage_key: 'ipva_conclusao', status: 'concluido' },
  ]), 'concluido')
})

