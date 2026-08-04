import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLIENT_SUMMARY_COLUMNS,
  csvCell,
  normalizeClientSummaryColumns,
} from './client-summary.ts'

test('normaliza colunas repetidas e ignora valores desconhecidos', () => {
  assert.deepEqual(
    normalizeClientSummaryColumns(['contrato', 'contrato', 'inexistente', 'cin']),
    ['contrato', 'cin'],
  )
})

test('usa todas as colunas quando nenhuma seleção válida foi recebida', () => {
  assert.deepEqual(
    normalizeClientSummaryColumns(),
    CLIENT_SUMMARY_COLUMNS.map(([key]) => key),
  )
})

test('exportação CSV neutraliza fórmulas e escapa aspas', () => {
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"')
  assert.equal(csvCell('Eleva; Isenções'), '"Eleva; Isenções"')
})
