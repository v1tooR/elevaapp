import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  CLIENT_SUMMARY_COLUMNS,
  csvCell,
  normalizeClientSummaryColumns,
} from './client-summary.ts'

const clientListUrl = new URL('../app/clientes/page.tsx', import.meta.url)
const clientDetailsUrl = new URL('../app/clientes/[id]/page.tsx', import.meta.url)

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
  assert.ok(CLIENT_SUMMARY_COLUMNS.some(([key, label]) => key === 'email' && label === 'E-mail'))
})

test('exportação CSV neutraliza fórmulas e escapa aspas', () => {
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"')
  assert.equal(csvCell('Eleva; Isenções'), '"Eleva; Isenções"')
})

test('concessionária e vendedor aparecem nos resumos do cliente', async () => {
  const [clientList, clientDetails] = await Promise.all([
    readFile(clientListUrl, 'utf8'),
    readFile(clientDetailsUrl, 'utf8'),
  ])

  assert.match(clientList, /client\.dealership/)
  assert.match(clientList, /client\.salesperson/)
  assert.match(clientDetails, /Compra e concessionária/)
  assert.match(clientDetails, /purchaseSummary\?\.dealership/)
  assert.match(clientDetails, /purchaseSummary\?\.salesperson/)
})
