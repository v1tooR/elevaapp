import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  buildAppealSchedule,
  calculateProcessRenewalDate,
  getIpvaOperationalBucket,
  getIpvaStageLabel,
  getIpvaStageStatusLabel,
  IPVA_STAGE_KEYS,
} from './process-workflow.ts'

const ipvaPresentationMigration = new URL('../../supabase/migrations/035_ipva_vehicle_and_stage_presentation.sql', import.meta.url)

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
    { stage_key: 'sivei_protocolo', status: 'concluido' },
    { stage_key: 'ipva_recurso', status: 'pendente' },
    { stage_key: 'ipva_conclusao', status: 'pendente' },
  ]), 'recurso')
})

test('fila IPVA distingue veículo, documentos, entrada, SEFAZ, recurso e conclusão sem depender do IMESC', () => {
  assert.deepEqual(IPVA_STAGE_KEYS, [
    'veiculo_ipva',
    'documentos_ipva',
    'sivei_protocolo',
    'sefaz_decisao',
    'ipva_recurso',
    'ipva_conclusao',
  ])
  assert.equal(getIpvaOperationalBucket([]), 'configuracao')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'veiculo_ipva', status: 'pendente' },
    { stage_key: 'sivei_protocolo', status: 'pendente' },
  ]), 'documentos')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'imesc_pericia', status: 'pendente' },
    { stage_key: 'imesc_laudo', status: 'pendente' },
    { stage_key: 'sivei_protocolo', status: 'pendente' },
  ]), 'protocolo')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'sivei_protocolo', status: 'concluido' },
    { stage_key: 'ipva_recurso', status: 'nao_aplicavel' },
    { stage_key: 'ipva_conclusao', status: 'pendente' },
  ]), 'sefaz')
  assert.equal(getIpvaOperationalBucket([
    { stage_key: 'ipva_recurso', status: 'nao_aplicavel' },
    { stage_key: 'ipva_conclusao', status: 'concluido' },
  ]), 'concluido')
})

test('IPVA apresenta etapas e situações no vocabulário da planilha', () => {
  assert.equal(getIpvaStageLabel('sivei_protocolo', 'legado'), 'Protocolo do IPVA')
  assert.equal(getIpvaStageLabel('sefaz_decisao', 'legado'), 'Análise da SEFAZ')
  assert.equal(getIpvaStageStatusLabel('veiculo_ipva', 'pendente'), 'Aguardando placa e marca')
  assert.equal(getIpvaStageStatusLabel('documentos_ipva', 'em_andamento'), 'Aguardando documentos')
  assert.equal(getIpvaStageStatusLabel('sivei_protocolo', 'pendente'), 'Dar entrada')
  assert.equal(getIpvaStageStatusLabel('sivei_protocolo', 'concluido'), 'Protocolado — em análise')
  assert.equal(getIpvaStageStatusLabel('sefaz_decisao', 'em_andamento'), 'Em análise')
  assert.equal(getIpvaStageStatusLabel('sefaz_decisao', 'aprovado'), 'Deferido')
  assert.equal(getIpvaStageStatusLabel('sefaz_decisao', 'reprovado'), 'Indeferido')
  assert.equal(getIpvaStageStatusLabel('ipva_conclusao', 'concluido'), 'Finalizado')
})

test('migration preserva documentos antigos fora da operação principal do IPVA', async () => {
  const sql = await readFile(ipvaPresentationMigration, 'utf8')

  assert.match(sql, /Documentos legados do IPVA/)
  assert.match(sql, /normalize_ipva_stage_presentation/)
  assert.match(sql, /NEW\.status := 'nao_aplicavel'/)
})
