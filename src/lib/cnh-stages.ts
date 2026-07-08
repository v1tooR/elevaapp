import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisabilityType, StageStatus } from '@/types/database'
import { getCnhSubflow } from './eligibility'

// ─── Stage templates ──────────────────────────────────────────────────────────
// sort_order em múltiplos de 10 para permitir inserção condicional sem shifts

interface StageTemplate {
  stage_key: string
  label: string
  sort_order: number
  data: Record<string, unknown>
}

const STAGE_CHECKLIST: StageTemplate = {
  stage_key: 'checklist_documentos',
  label: 'Checklist de documentos',
  sort_order: 10,
  data: { cnh: false, laudo_medico: false, senha_gov: false, comprovante_endereco: false, email: false },
}

const STAGE_AGENDAMENTO: StageTemplate = {
  stage_key: 'agendamento_poupatempo',
  label: 'Agendamento no Poupatempo',
  sort_order: 20,
  data: {},
}

const STAGE_PERICIA: StageTemplate = {
  stage_key: 'pericia_medica',
  label: 'Perícia Médica (RENACH)',
  sort_order: 30,
  data: { observacoes: '' },
}

// sort_order 35 ← inserido condicionalmente entre perícia (30) e o próximo (40)
const STAGE_RECURSO: StageTemplate = {
  stage_key: 'recurso_junta_medica',
  label: 'Recurso — Junta Médica (3 médicos)',
  sort_order: 35,
  data: { cadastro_sei: '', protocolo: '' },
}

const STAGE_EXAME_PRATICO: StageTemplate = {
  stage_key: 'exame_pratico',
  label: 'Exame Prático',
  sort_order: 40,
  data: {
    modalidade: null, // 'autoescola' | 'veiculo_proprio'
    checklist_veiculo_proprio: {
      cadastro_sei: false,
      anexo_renach: false,
      anexo_cnh: false,
      comprovante_pagamento_35: false,
      crlv: false,
    },
  },
}

const STAGE_EMISSAO: StageTemplate = {
  stage_key: 'emissao_cnh',
  label: 'Emissão da CNH Especial',
  sort_order: 50,
  data: { restricoes: '', vencimento_cnh: '' },
}

// sort_order 50 para sem_exame, 60 para com_exame — ajustado abaixo
const STAGE_LIBERADO: StageTemplate = {
  stage_key: 'liberado_isencoes',
  label: 'Liberado para iniciar isenções',
  sort_order: 60,
  data: {},
}

const STAGES_COM_EXAME: StageTemplate[] = [
  STAGE_CHECKLIST,
  STAGE_AGENDAMENTO,
  STAGE_PERICIA,
  STAGE_EXAME_PRATICO,                           // sort_order 40
  STAGE_EMISSAO,                                 // sort_order 50
  { ...STAGE_LIBERADO, sort_order: 60 },
]

const STAGES_SEM_EXAME: StageTemplate[] = [
  STAGE_CHECKLIST,
  STAGE_AGENDAMENTO,
  STAGE_PERICIA,
  { ...STAGE_EMISSAO, sort_order: 40 },          // sobe uma posição
  { ...STAGE_LIBERADO, sort_order: 50 },
]

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCnhStageTemplates(disability: DisabilityType): StageTemplate[] | null {
  const subflow = getCnhSubflow(disability)
  if (!subflow) return null
  return subflow === 'com_exame_pratico' ? STAGES_COM_EXAME : STAGES_SEM_EXAME
}

/** Insere todas as etapas iniciais de um processo CNH Especial recém-criado. */
export async function createCnhProcessStages(
  supabase: SupabaseClient,
  processId: string,
  disability: DisabilityType,
): Promise<void> {
  const templates = getCnhStageTemplates(disability)
  if (!templates) {
    throw new Error(`Deficiência '${disability}' não permite CNH Especial`)
  }

  const rows = templates.map(t => ({
    process_id: processId,
    stage_key: t.stage_key,
    label: t.label,
    sort_order: t.sort_order,
    status: 'pendente' as StageStatus,
    data: t.data,
  }))

  const { error } = await supabase.from('process_stages').insert(rows)
  if (error) throw error
}

/**
 * Chamado quando perícia_medica.result é definido como 'reprovado'.
 * Insere a etapa de recurso (sort_order 35), cria evento de prazo no calendário
 * e envia notificações ao responsável e ao cliente (se tiver portal).
 * Idempotente: não duplica se chamado mais de uma vez.
 */
export async function handlePericiaReprovada(
  supabase: SupabaseClient,
  processId: string,
): Promise<void> {
  // Idempotência
  const { data: existing } = await supabase
    .from('process_stages')
    .select('id')
    .eq('process_id', processId)
    .eq('stage_key', 'recurso_junta_medica')
    .maybeSingle()
  if (existing) return

  // Dados do processo
  const { data: proc, error: pErr } = await supabase
    .from('processes')
    .select('client_id, responsible_user_id')
    .eq('id', processId)
    .single()
  if (pErr || !proc) throw pErr ?? new Error('Processo não encontrado')

  // Profile do cliente (portal)
  const { data: client } = await supabase
    .from('clients')
    .select('profile_id')
    .eq('id', proc.client_id)
    .single()

  // Inserir etapa de recurso (sort_order 35 — entre perícia 30 e próxima 40)
  const { error: stageErr } = await supabase.from('process_stages').insert({
    ...STAGE_RECURSO,
    process_id: processId,
    status: 'pendente' as StageStatus,
  })
  if (stageErr) throw stageErr

  // Evento de prazo: hoje + 30 dias
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 30)
  const eventDate = deadline.toISOString().split('T')[0]

  await supabase.from('calendar_events').insert({
    title: 'Prazo recurso CNH (30 dias)',
    event_date: eventDate,
    event_type: 'deadline',
    client_id: proc.client_id,
    process_id: processId,
    responsible_user_id: proc.responsible_user_id ?? null,
    visibility: 'admin_only',
    status: 'pending',
  })

  // Notificações
  const base = {
    client_id: proc.client_id,
    process_id: processId,
    title: 'Perícia reprovada — Recurso necessário',
    message:
      'A perícia médica do processo CNH Especial foi reprovada. ' +
      'É necessário abrir recurso na Junta Médica em até 30 dias.',
    type: 'warning' as const,
  }

  const notifRows: (typeof base & { user_id: string })[] = []
  if (proc.responsible_user_id) {
    notifRows.push({ ...base, user_id: proc.responsible_user_id })
  }
  if (client?.profile_id && client.profile_id !== proc.responsible_user_id) {
    notifRows.push({ ...base, user_id: client.profile_id })
  }

  if (notifRows.length > 0) {
    await supabase.from('notifications').insert(notifRows)
  }
}

/**
 * Chamado quando emissao_cnh é marcada como concluída.
 * Marca liberado_isencoes como concluído, atualiza processo e notifica cliente e responsável.
 */
export async function handleEmissaoConcluida(
  supabase: SupabaseClient,
  processId: string,
): Promise<void> {
  await supabase
    .from('process_stages')
    .update({ status: 'concluido' as StageStatus, completed_at: new Date().toISOString() })
    .eq('process_id', processId)
    .eq('stage_key', 'liberado_isencoes')

  await syncProcessMacroStatus(supabase, processId, 'liberado_isencoes', 'concluido')

  const { data: proc } = await supabase
    .from('processes')
    .select('client_id, responsible_user_id')
    .eq('id', processId)
    .single()
  if (!proc) return

  const { data: client } = await supabase
    .from('clients')
    .select('profile_id')
    .eq('id', proc.client_id)
    .single()

  const base = {
    client_id: proc.client_id,
    process_id: processId,
    title: 'CNH Especial emitida',
    message: 'CNH Especial emitida — você está liberado para iniciar as isenções.',
    type: 'success' as const,
  }

  const rows: (typeof base & { user_id: string })[] = []
  if (client?.profile_id) rows.push({ ...base, user_id: client.profile_id })
  if (proc.responsible_user_id && proc.responsible_user_id !== client?.profile_id) {
    rows.push({ ...base, user_id: proc.responsible_user_id, message: 'CNH Especial emitida — processo concluído.' })
  }
  if (rows.length > 0) await supabase.from('notifications').insert(rows)
}

/**
 * Atualiza o status macro do processo com base na etapa que acabou de mudar.
 * Regras:
 *  - qualquer etapa → em_andamento/concluido/aprovado: processo passa de 'aberto' para 'em_andamento'
 *  - liberado_isencoes → concluido: processo passa para 'concluido'
 */
export async function syncProcessMacroStatus(
  supabase: SupabaseClient,
  processId: string,
  stageKey: string,
  stageStatus: StageStatus,
): Promise<void> {
  if (stageKey === 'liberado_isencoes' && stageStatus === 'concluido') {
    await supabase
      .from('processes')
      .update({ status: 'concluido', completed_at: new Date().toISOString() })
      .eq('id', processId)
    return
  }

  if (['em_andamento', 'concluido', 'aprovado'].includes(stageStatus)) {
    const { data: proc } = await supabase
      .from('processes')
      .select('status')
      .eq('id', processId)
      .single()
    if (proc?.status === 'aberto') {
      await supabase.from('processes').update({ status: 'em_andamento' }).eq('id', processId)
    }
  }
}
