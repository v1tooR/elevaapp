import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const stageUpdateSchema = z.object({
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'aprovado', 'reprovado', 'nao_aplicavel']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  attended: z.boolean().nullable().optional(),
  result: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  notifyClient: z.boolean().default(true),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> },
) {
  const { id, stageId } = await params
  const parsed = stageUpdateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data: stage, error: lookupError } = await supabase
    .from('process_stages')
    .select('process_id, stage_key')
    .eq('id', stageId)
    .single()
  if (lookupError || !stage || stage.process_id !== id) {
    return NextResponse.json({ error: 'Etapa não encontrada neste processo.' }, { status: 404 })
  }

  const values = parsed.data
  const isApprovedMedicalBoard = stage.stage_key === 'recurso_junta_medica'
    && (values.status === 'aprovado' || values.result === 'aprovado')
  if (isApprovedMedicalBoard && typeof values.data.requires_practical_exam !== 'boolean') {
    return NextResponse.json({ error: 'Informe se a junta determinou exame prático.' }, { status: 422 })
  }

  const { data, error } = await supabase.rpc('save_process_stage', {
    p_stage_id: stageId,
    p_status: values.status,
    p_scheduled_date: values.scheduledDate ?? null,
    p_attended: values.attended ?? false,
    p_result: values.result ?? null,
    p_notes: values.notes ?? null,
    p_data: values.data,
    p_notify_client: values.notifyClient,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (isApprovedMedicalBoard) {
    const restrictions = typeof values.data.restricoes === 'string'
      ? values.data.restricoes.split(',').map(value => value.trim().toUpperCase()).filter(Boolean)
      : []
    const requiresPracticalExam = values.data.requires_practical_exam as boolean
    const requiresAdaptedVehicle = typeof values.data.requires_adapted_vehicle === 'boolean'
      ? values.data.requires_adapted_vehicle
      : null

    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('client_id')
      .eq('id', id)
      .single()
    if (processError || !process) {
      return NextResponse.json({ error: processError?.message ?? 'Processo não encontrado após salvar a etapa.' }, { status: 400 })
    }

    const [clientUpdate, practicalStageUpdate, issuanceStageUpdate] = await Promise.all([
      supabase.from('clients').update({
        medical_assessment_status: restrictions.length > 0 ? 'apto_com_restricoes' : 'apto',
        cnh_restrictions: restrictions,
        requires_practical_exam: requiresPracticalExam,
        requires_adapted_vehicle: requiresAdaptedVehicle,
      }).eq('id', process.client_id),
      supabase.from('process_stages').update({
        status: requiresPracticalExam ? 'pendente' : 'nao_aplicavel',
        label: 'Exame Prático',
      }).eq('process_id', id).eq('stage_key', 'exame_pratico'),
      supabase.from('process_stages').update({
        data: { restricoes: restrictions.join(', '), vencimento_cnh: '' },
      }).eq('process_id', id).eq('stage_key', 'emissao_cnh'),
    ])
    const syncError = clientUpdate.error ?? practicalStageUpdate.error ?? issuanceStageUpdate.error
    if (syncError) {
      return NextResponse.json({ error: `Etapa salva, mas não foi possível sincronizar o resultado da junta: ${syncError.message}` }, { status: 400 })
    }
  }

  return NextResponse.json({ stage: data })
}
