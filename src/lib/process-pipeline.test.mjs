import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOperationalProcessPhase,
  getPhaseFromSituation,
  getProcessPhase,
  PROCESS_PHASE_LABELS,
  resolveProcessStatusFromStages,
} from './process-pipeline.ts'

const icmsStages = (overrides = {}) => ([
  { stage_key: 'pre_requisitos_icms', status: 'pendente', data: {}, ...(overrides.checklist ?? {}) },
  { stage_key: 'protocolo_sivei_icms', status: 'pendente', data: {}, ...(overrides.entry ?? {}) },
  { stage_key: 'nota_fiscal_icms', status: 'nao_aplicavel', data: {} },
  { stage_key: 'recurso_icms', status: 'nao_aplicavel', data: {} },
])

test('checklist aberto mantem o processo em aguardando documentos', () => {
  const phase = getOperationalProcessPhase('processo_icms', icmsStages())
  assert.equal(phase, 'aguardando_documentos')
  assert.equal(resolveProcessStatusFromStages('processo_icms', icmsStages()), 'aguardando_documentos')
})

test('checklist finalizado leva o processo para dar entrada', () => {
  const stages = icmsStages({ checklist: { status: 'concluido' } })
  assert.equal(getOperationalProcessPhase('processo_icms', stages), 'dar_entrada')
  assert.equal(resolveProcessStatusFromStages('processo_icms', stages), 'em_andamento')
})

test('protocolo registrado equivale a em analise', () => {
  const stages = icmsStages({
    checklist: { status: 'concluido' },
    entry: { status: 'em_andamento', data: { protocol: 'SIVEI-123' } },
  })
  assert.equal(getOperationalProcessPhase('processo_icms', stages), 'em_analise')
  assert.equal(resolveProcessStatusFromStages('processo_icms', stages), 'em_analise')
})

test('decisao aprovada vira deferido e reprovada vira indeferido', () => {
  const approved = icmsStages({
    checklist: { status: 'concluido' },
    entry: { status: 'aprovado', data: { protocol: 'SIVEI-123' } },
  })
  const rejected = icmsStages({
    checklist: { status: 'concluido' },
    entry: { status: 'reprovado', data: { protocol: 'SIVEI-123' } },
  })
  assert.equal(getOperationalProcessPhase('processo_icms', approved), 'deferido')
  assert.equal(getOperationalProcessPhase('processo_icms', rejected), 'indeferido')
})

test('ipva espera placa e marca antes de permitir dar entrada', () => {
  const stages = [
    { stage_key: 'veiculo_ipva', status: 'pendente', data: {} },
    { stage_key: 'documentos_ipva', status: 'concluido', data: {} },
    { stage_key: 'sivei_protocolo', status: 'pendente', data: {} },
    { stage_key: 'sefaz_decisao', status: 'pendente', data: {} },
    { stage_key: 'ipva_recurso', status: 'nao_aplicavel', data: {} },
    { stage_key: 'ipva_conclusao', status: 'pendente', data: {} },
  ]
  assert.equal(getOperationalProcessPhase('processo_ipva', stages), 'aguardando_documentos')

  stages[0].status = 'concluido'
  assert.equal(getOperationalProcessPhase('processo_ipva', stages), 'dar_entrada')
})

test('processo na fila ignora o status interno', () => {
  const phase = getProcessPhase({
    status: 'em_andamento',
    processTypeSlug: 'processo_icms',
    stages: icmsStages({ checklist: { status: 'concluido' } }),
    queuedBehind: true,
  })
  assert.equal(phase, 'na_fila')
  assert.equal(PROCESS_PHASE_LABELS[phase], 'Na fila')
})

test('dependencia de servico anterior tambem aparece como fila', () => {
  assert.equal(
    getProcessPhase({ status: 'aberto', blockedReason: 'Aguardando deferimento do IPI' }),
    'na_fila',
  )
})

test('tipos sem workflow operacional caem no status gravado', () => {
  assert.equal(getOperationalProcessPhase('cnh_especial', [{ stage_key: 'pericia_medica', status: 'pendente' }]), null)
  assert.equal(getProcessPhase({ status: 'aguardando_documentos', processTypeSlug: 'cnh_especial' }), 'aguardando_documentos')
  assert.equal(getProcessPhase({ status: 'concluido', processTypeSlug: 'cnh_especial' }), 'deferido')
})

test('situacao da carteira operacional traduz deferido e indeferido', () => {
  assert.equal(getPhaseFromSituation('em_andamento', 'indeferido'), 'indeferido')
  assert.equal(getPhaseFromSituation('concluido', 'deferido'), 'deferido')
  assert.equal(getPhaseFromSituation('aberto', 'aguardando_dependencia'), 'na_fila')
  assert.equal(getPhaseFromSituation('cancelado', 'deferido'), 'cancelado')
})
