import type { SupabaseClient } from '@supabase/supabase-js'
import type { StageStatus } from '@/types/database'
import { getCnhSubflow, type CnhAssessmentInput } from './eligibility'

// ─── Stage templates ──────────────────────────────────────────────────────────
// sort_order em múltiplos de 10 para permitir inserção condicional sem shifts

interface StageTemplate {
  stage_key: string
  label: string
  sort_order: number
  status?: StageStatus
  data: Record<string, unknown>
}

const STAGE_CHECKLIST: StageTemplate = {
  stage_key: 'checklist_documentos',
  label: 'Checklist de documentos',
  sort_order: 10,
  data: { cnh: false, laudo_medico: false, acesso_gov_validado: false, comprovante_endereco: false, email: false },
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
  data: {
    observacoes: '',
    restricoes: '',
    requires_practical_exam: null,
    requires_adapted_vehicle: null,
    medical_requirements: [],
  },
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
      comprovante_pagamento_exame: false,
      crlv: false,
      comprovante_endereco: false,
    },
  },
}

const STAGE_EMISSAO: StageTemplate = {
  stage_key: 'emissao_cnh',
  label: 'Emissão da CNH Especial',
  sort_order: 50,
  data: { restricoes: '', vencimento_cnh: '' },
}

const STAGE_REGULARIZADA: StageTemplate = {
  stage_key: 'cnh_regularizada',
  label: 'CNH regularizada — revisar benefícios',
  sort_order: 60,
  data: {},
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCnhStageTemplates(assessment: CnhAssessmentInput): StageTemplate[] | null {
  const subflow = getCnhSubflow(assessment)
  if (!subflow) return null

  const practicalExam: StageTemplate = {
    ...STAGE_EXAME_PRATICO,
    label: subflow === 'aguardando_pericia' ? 'Exame Prático (se determinado)' : STAGE_EXAME_PRATICO.label,
    status: subflow === 'sem_exame_pratico' ? 'nao_aplicavel' : 'pendente',
  }

  return [
    STAGE_CHECKLIST,
    STAGE_AGENDAMENTO,
    {
      ...STAGE_PERICIA,
      data: {
        ...STAGE_PERICIA.data,
        requires_practical_exam: assessment.requiresPracticalExam ?? null,
      },
    },
    practicalExam,
    STAGE_EMISSAO,
    STAGE_REGULARIZADA,
  ]
}

/** Insere todas as etapas iniciais de um processo CNH Especial recém-criado. */
export async function createCnhProcessStages(
  supabase: SupabaseClient,
  processId: string,
  assessment: CnhAssessmentInput,
): Promise<void> {
  const templates = getCnhStageTemplates(assessment)
  if (!templates) {
    throw new Error('O cliente está cadastrado como não condutor. Revise o perfil antes de iniciar a CNH.')
  }

  const rows = templates.map(t => ({
    process_id: processId,
    stage_key: t.stage_key,
    label: t.label,
    sort_order: t.sort_order,
    status: t.status ?? 'pendente' as StageStatus,
    data: t.data,
  }))

  const { error } = await supabase
    .from('process_stages')
    .upsert(rows, { onConflict: 'process_id,stage_key', ignoreDuplicates: true })
  if (error) throw error
}
