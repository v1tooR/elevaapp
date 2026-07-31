import test from 'node:test'
import assert from 'node:assert/strict'
import {
  IMESC_ADDITIONAL_COLUMNS,
  IMESC_PRIMARY_COLUMNS,
  mapFollowupToEligibility,
  normalizeImescPayload,
  normalizeLegacyImescClassification,
} from './imesc-workflow.ts'

test('IMESC mantém quatro colunas principais e situações excepcionais separadas', () => {
  assert.deepEqual(IMESC_PRIMARY_COLUMNS, ['aguardando', 'leve', 'moderado', 'grave'])
  assert.deepEqual(IMESC_ADDITIONAL_COLUMNS, [
    'nao_compareceu',
    'sem_deficiencia',
    'indeferido',
    'cancelado',
  ])
})

test('backfill preserva a classificação original e normaliza o quadro', () => {
  assert.deepEqual(normalizeLegacyImescClassification('moderada'), {
    board_status: 'moderado',
    source_classification: 'moderada',
  })
  assert.deepEqual(normalizeLegacyImescClassification('gravissima'), {
    board_status: 'grave',
    source_classification: 'gravissima',
  })
})

test('acompanhamento IMESC funciona sem processo IPI ou IPVA vinculado', () => {
  const payload = normalizeImescPayload({
    board_status: 'aguardando',
    operational_status: 'solicitacao_em_preparo',
    ipi_process_id: null,
    ipva_process_id: null,
    scheduled_date: '2026-08-12',
    examination_date: '2026-08-20',
  })

  assert.equal(payload.ipi_process_id, null)
  assert.equal(payload.ipva_process_id, null)
  assert.equal(payload.scheduled_date, null)
  assert.equal(payload.examination_date, null)
})

test('campos condicionais ocultos não mantêm datas incompatíveis', () => {
  const payload = normalizeImescPayload({
    board_status: 'leve',
    operational_status: 'agendado',
    scheduled_date: '2026-08-12',
    examination_date: '2026-08-20',
    report_issued_at: '2026-08-22',
    report_valid_until: '2028-08-22',
  })

  assert.equal(payload.scheduled_date, '2026-08-12')
  assert.equal(payload.examination_date, null)
  assert.equal(payload.report_issued_at, null)
  assert.equal(payload.report_valid_until, null)
  assert.equal(payload.source_classification, 'leve')
})

test('elegibilidade do IPVA lê o acompanhamento independente do IMESC', () => {
  assert.deepEqual(mapFollowupToEligibility({
    board_status: 'moderado',
    operational_status: 'laudo_disponivel',
    report_issued_at: '2026-07-30',
    source_classification: 'moderada',
  }), {
    imescStatus: 'laudo_disponivel',
    imescReportIssuedAt: '2026-07-30',
    imescSeverity: 'moderada',
  })
  assert.deepEqual(mapFollowupToEligibility(null), {
    imescStatus: null,
    imescReportIssuedAt: null,
    imescSeverity: null,
  })
})
