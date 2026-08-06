import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sourceUrls = {
  stages: new URL('./cnh-stages.ts', import.meta.url),
  panel: new URL('../components/processos/cnh-stages-panel.tsx', import.meta.url),
  stageApi: new URL('../app/api/processos/[id]/stages/[stageId]/route.ts', import.meta.url),
  portal: new URL('./client-portal.ts', import.meta.url),
  staffOperations: new URL('./staff-operations.ts', import.meta.url),
  migration: new URL('../../supabase/migrations/034_cnh_stage_simplification.sql', import.meta.url),
}

test('CNH segue as seis etapas operacionais da planilha', async () => {
  const source = await readFile(sourceUrls.stages, 'utf8')
  const labels = [
    'Checklist',
    'Poupatempo',
    'Perícia',
    'Recurso',
    'Exame Prático',
    'CNH finalizada',
  ]
  const positions = labels.map(label => source.indexOf(`label: '${label}'`))

  assert.ok(positions.every(position => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  assert.match(source, /stage_key: 'recurso_junta_medica'[\s\S]*?sort_order: 40,[\s\S]*?status: 'nao_aplicavel'/)
  assert.match(source, /STAGE_RECURSO,[\s\S]*practicalExam,[\s\S]*STAGE_EMISSAO/)
})

test('recurso permanece condicional e etapas legadas ficam fora da operação', async () => {
  const [panel, migration] = await Promise.all([
    readFile(sourceUrls.panel, 'utf8'),
    readFile(sourceUrls.migration, 'utf8'),
  ])

  assert.match(panel, /recurso_junta_medica.*nao_aplicavel/)
  assert.match(panel, /cnh_regularizada.*liberado_isencoes/)
  assert.match(migration, /'recurso_junta_medica',[\s\S]*'Recurso',[\s\S]*40/)
  assert.match(migration, /conditional_on'[\s\S]*'pericia_reprovada'/)
  assert.match(migration, /normalize_cnh_stage_presentation/)
})

test('exigencias atipicas usam observacoes sem manter um fluxo paralelo', async () => {
  const sources = await Promise.all([
    sourceUrls.panel,
    sourceUrls.stageApi,
    sourceUrls.portal,
    sourceUrls.staffOperations,
  ].map(url => readFile(url, 'utf8')))

  for (const source of sources) {
    assert.doesNotMatch(source, /MedicalRequirementsEditor|medical_requirements|exigencia_medica|medicalRequirements/)
  }

  const migration = await readFile(sourceUrls.migration, 'utf8')
  assert.match(migration, /legacy_medical_requirements/)
  assert.match(migration, /\[Histórico da perícia\]/)
})
