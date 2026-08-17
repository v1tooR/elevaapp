import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  APPEAL_STATUS_VALUES,
  inferAppealStatus,
  validateAppealWorkflow,
} from '@/lib/cnh-medical-workflow'
import {
  getIpiDetranReportStatus,
  getIpiDetranStageStatus,
  getOperationalStageTemplate,
  getOperationalWorkflowDefinition,
  IPI_DETRAN_REPORT_STATUS_VALUES,
  isOperationalStageBlocked,
  validateOperationalStage,
} from '@/lib/operational-workflows'
import {
  getOperationalProcessPhase,
  PHASE_ACTIONS,
  resolveProcessStatusFromStages,
} from '@/lib/process-pipeline'

type ProcessTypeRelation = { slug: string }

function getProcessTypeSlug(relation: unknown) {
  const value = Array.isArray(relation) ? relation[0] : relation
  return value && typeof value === 'object' && 'slug' in value
    ? String((value as ProcessTypeRelation).slug)
    : ''
}

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
    .select('id, process_id, stage_key, scheduled_date, result, data, updated_at')
    .eq('id', stageId)
    .single()
  if (lookupError || !stage || stage.process_id !== id) {
    return NextResponse.json({ error: 'Etapa não encontrada neste processo.' }, { status: 404 })
  }

  const { data: processRecord, error: processError } = await supabase
    .from('processes')
    .select('client_id, status, completed_at, process_types(slug)')
    .eq('id', id)
    .single()
  if (processError || !processRecord) {
    return NextResponse.json({ error: processError?.message ?? 'Processo não encontrado.' }, { status: 404 })
  }

  const processTypeSlug = getProcessTypeSlug(processRecord.process_types)
  const operationalWorkflow = getOperationalWorkflowDefinition(processTypeSlug)
  const operationalTemplate = getOperationalStageTemplate(processTypeSlug, stage.stage_key)

  if (isOperationalStageBlocked(stage.data as Record<string, unknown>)) {
    return NextResponse.json({
      error: 'Esta etapa ainda está bloqueada. Conclua o Laudo DETRAN antes de continuar.',
    }, { status: 409 })
  }

  const values = { ...parsed.data }
  const stageData = { ...values.data }

  if (
    ['pericia_medica', 'recurso_junta_medica', 'exame_pratico'].includes(stage.stage_key)
    && ['aprovado', 'reprovado'].includes(values.status)
  ) {
    values.result = values.status
    values.attended = values.attended === false ? false : true
  }

  if (processTypeSlug === 'processo_ipi' && stage.stage_key === 'laudo_ipi') {
    const rawReportStatus = stageData.report_status
    if (
      typeof rawReportStatus !== 'string'
      || !IPI_DETRAN_REPORT_STATUS_VALUES.includes(
        rawReportStatus as typeof IPI_DETRAN_REPORT_STATUS_VALUES[number],
      )
    ) {
      return NextResponse.json({ error: 'Selecione uma situação válida para o Laudo DETRAN.' }, { status: 422 })
    }
    const reportStatus = getIpiDetranReportStatus(stageData)
    stageData.report_status = reportStatus
    values.status = getIpiDetranStageStatus(reportStatus)
    if (reportStatus === 'pronto') values.notifyClient = true
  }

  if (stage.stage_key === 'recurso_junta_medica') {
    const appealStatus = typeof stageData.appeal_status === 'string' && APPEAL_STATUS_VALUES.includes(stageData.appeal_status as typeof APPEAL_STATUS_VALUES[number])
      ? stageData.appeal_status
      : inferAppealStatus({
          ...stage,
          scheduled_date: values.scheduledDate ?? stage.scheduled_date,
          result: values.result ?? stage.result,
          data: stageData,
        })
    stageData.appeal_status = appealStatus

    const appealError = validateAppealWorkflow({
      data: stageData,
      scheduledDate: values.scheduledDate ?? null,
      result: values.result ?? null,
      stageStatus: values.status,
    })
    if (appealError) return NextResponse.json({ error: appealError }, { status: 422 })
  }

  if (operationalTemplate) {
    const operationalError = validateOperationalStage({
      template: operationalTemplate,
      status: values.status,
      scheduledDate: values.scheduledDate ?? null,
      attended: values.attended ?? null,
      result: values.result ?? null,
      data: stageData,
    })
    if (operationalError) return NextResponse.json({ error: operationalError }, { status: 422 })
  }

  const isApprovedMedicalAppeal = stage.stage_key === 'recurso_junta_medica'
    && (values.status === 'aprovado' || values.result === 'aprovado')

  const { data: clientMedicalSnapshot } = ['pericia_medica', 'recurso_junta_medica'].includes(stage.stage_key)
    ? await supabase
        .from('clients')
        .select('cnh_restrictions')
        .eq('id', processRecord.client_id)
        .maybeSingle()
    : { data: null }

  const { data, error } = await supabase.rpc('save_process_stage', {
    p_stage_id: stageId,
    p_status: values.status,
    p_scheduled_date: values.scheduledDate ?? null,
    p_attended: values.attended ?? null,
    p_result: values.result ?? null,
    p_notes: values.notes ?? null,
    p_data: stageData,
    p_notify_client: values.notifyClient,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (clientMedicalSnapshot) {
    const { error: restoreError } = await supabase
      .from('clients')
      .update({ cnh_restrictions: clientMedicalSnapshot.cnh_restrictions ?? [] })
      .eq('id', processRecord.client_id)
    if (restoreError) {
      return NextResponse.json({
        error: `Etapa salva, mas não foi possível preservar as restrições até a emissão final: ${restoreError.message}`,
      }, { status: 400 })
    }
  }

  const isCompletedCnhIssuance = stage.stage_key === 'emissao_cnh'
    && values.status === 'concluido'
    && typeof stageData.vencimento_cnh === 'string'
  if (isCompletedCnhIssuance) {
    const restrictions = typeof stageData.restricoes === 'string'
      ? stageData.restricoes.split(',').map(value => value.trim().toUpperCase()).filter(Boolean)
      : []
    const { error: expiryError } = await supabase
      .from('clients')
      .update({
        has_cnh_especial: true,
        cnh_status: 'com_restricoes',
        cnh_restrictions: restrictions,
        cnh_expiry_date: stageData.vencimento_cnh,
      })
      .eq('id', processRecord.client_id)

    if (expiryError) {
      return NextResponse.json(
        { error: `Etapa salva, mas não foi possível atualizar o vencimento da CNH: ${expiryError.message}` },
        { status: 400 },
      )
    }
  }

  if (isApprovedMedicalAppeal) {
    const restrictions = typeof stageData.restricoes === 'string'
      ? stageData.restricoes.split(',').map(value => value.trim().toUpperCase()).filter(Boolean)
      : []
    const { data: medicalStage } = await supabase
      .from('process_stages')
      .select('data')
      .eq('process_id', id)
      .eq('stage_key', 'pericia_medica')
      .maybeSingle()
    const medicalData = medicalStage?.data as Record<string, unknown> | undefined
    const requiresPracticalExam = medicalData?.requires_practical_exam === true

    const [practicalStageUpdate, issuanceStageUpdate] = await Promise.all([
      supabase.from('process_stages').update({
        status: requiresPracticalExam ? 'pendente' : 'nao_aplicavel',
        label: 'Exame Prático',
      }).eq('process_id', id).eq('stage_key', 'exame_pratico'),
      supabase.from('process_stages').update({
        data: { restricoes: restrictions.join(', '), vencimento_cnh: '' },
      }).eq('process_id', id).eq('stage_key', 'emissao_cnh'),
    ])
    const syncError = practicalStageUpdate.error ?? issuanceStageUpdate.error
    if (syncError) {
      return NextResponse.json({ error: `Etapa salva, mas não foi possível sincronizar o resultado da junta: ${syncError.message}` }, { status: 400 })
    }
  }

  if (operationalWorkflow && operationalTemplate) {
    const selectedResult = operationalTemplate.resultOptions?.find(option => option.value === values.result)
    const effectiveStatus = selectedResult?.stageStatus ?? values.status
    const isApprovedIpiDecision = processTypeSlug === 'processo_ipi'
      && stage.stage_key === 'protocolo_sisen_ipi'
      && effectiveStatus === 'aprovado'

    const conditionalTargets: Array<{ stageKey: string; activate: boolean }> = []
    if (operationalTemplate.activateOnRejected && (effectiveStatus === 'reprovado' || effectiveStatus === 'aprovado')) {
      conditionalTargets.push({ stageKey: operationalTemplate.activateOnRejected, activate: effectiveStatus === 'reprovado' })
    }
    if (operationalTemplate.activateOnApproved && (effectiveStatus === 'reprovado' || effectiveStatus === 'aprovado')) {
      conditionalTargets.push({ stageKey: operationalTemplate.activateOnApproved, activate: effectiveStatus === 'aprovado' })
    }
    for (const target of conditionalTargets) {
      const { error: conditionalStageError } = await supabase
        .from('process_stages')
        .update({ status: target.activate ? 'pendente' : 'nao_aplicavel', completed_at: null })
        .eq('process_id', id)
        .eq('stage_key', target.stageKey)
      if (conditionalStageError) {
        return NextResponse.json({ error: `Etapa salva, mas não foi possível sincronizar a etapa condicional: ${conditionalStageError.message}` }, { status: 400 })
      }
    }

    const workflowKeys = new Set(operationalWorkflow.stages.map(item => item.stage_key))
    const { data: workflowStages, error: workflowStagesError } = await supabase
      .from('process_stages')
      .select('stage_key, status, data')
      .eq('process_id', id)
    if (workflowStagesError) {
      return NextResponse.json({ error: `Etapa salva, mas não foi possível recalcular o processo: ${workflowStagesError.message}` }, { status: 400 })
    }

    const relevantStages = (workflowStages ?? []).filter(item => workflowKeys.has(item.stage_key))
    const allStagesExist = relevantStages.length === operationalWorkflow.stages.length
    const allResolved = isApprovedIpiDecision || (
      allStagesExist
      && relevantStages.every(item => ['concluido', 'aprovado', 'reprovado', 'nao_aplicavel'].includes(item.status))
    )
    if (!['arquivado', 'cancelado'].includes(processRecord.status)) {
      // Espelha a fase real do atendimento: aguardando documentos -> dar entrada
      // -> em análise (protocolado) -> concluído.
      const phase = getOperationalProcessPhase(processTypeSlug, relevantStages)
      const nextStatus = allResolved
        ? 'concluido'
        : resolveProcessStatusFromStages(processTypeSlug, relevantStages)
      const phaseAction = !allResolved && phase && phase in PHASE_ACTIONS
        ? PHASE_ACTIONS[phase as keyof typeof PHASE_ACTIONS]
        : null
      const { error: processSyncError } = await supabase
        .from('processes')
        .update({
          status: nextStatus,
          completed_at: allResolved ? processRecord.completed_at ?? new Date().toISOString() : null,
          // A próxima ação só é reescrita quando a fase muda, para não apagar
          // um ajuste manual da equipe a cada salvamento de etapa.
          ...(phaseAction && nextStatus !== processRecord.status
            ? { next_action: phaseAction.nextAction, action_owner: phaseAction.actionOwner }
            : {}),
        })
        .eq('id', id)
      if (processSyncError) {
        return NextResponse.json({ error: `Etapa salva, mas não foi possível atualizar o processo: ${processSyncError.message}` }, { status: 400 })
      }
    }
  }

  return NextResponse.json({ stage: data })
}
