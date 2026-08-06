import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sourceUrls = {
  newProcess: new URL('../app/processos/novo/page.tsx', import.meta.url),
  addServices: new URL('../app/api/clientes/[id]/servicos/route.ts', import.meta.url),
  convertLead: new URL('../app/api/leads/[id]/status/route.ts', import.meta.url),
  processDetails: new URL('../app/processos/[id]/page.tsx', import.meta.url),
}

test('novos processos nao executam nem exibem pesquisa de elegibilidade', async () => {
  const sources = await Promise.all(Object.values(sourceUrls).map(url => readFile(url, 'utf8')))
  const [newProcess, addServices, convertLead, processDetails] = sources

  for (const source of [newProcess, addServices, convertLead]) {
    assert.doesNotMatch(source, /analyzeEligibility|EligibilityAnalysisCard|eligibilityAnalysis/)
    assert.match(source, /p_eligibility_status:\s*null/)
    assert.match(source, /p_eligibility_analysis:\s*null/)
  }

  assert.doesNotMatch(newProcess, /Assistente de elegibilidade|Revisao de elegibilidade/i)
  assert.doesNotMatch(processDetails, /Revisao de elegibilidade/i)
})

test('resumo do processo reproduz os controles operacionais da planilha', async () => {
  const processDetails = await readFile(sourceUrls.processDetails, 'utf8')

  for (const label of [
    'Etapa atual',
    'Situação',
    'Próxima ação',
    'Observações',
    'Última movimentação',
  ]) {
    assert.match(processDetails, new RegExp(`label: '${label}'`))
  }

  assert.match(processDetails, /STAGE_STATUS_LABELS\[operational\.stageStatus\]/)
  assert.match(processDetails, /operational\.currentStage\?\.notes/)
})
