import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  APPEAL_STATUS_VALUES,
  MEDICAL_REQUIREMENT_STATUS_VALUES,
  MEDICAL_REQUIREMENT_TYPE_VALUES,
  getMedicalRequirements,
  inferAppealStatus,
  isMedicalStage,
  mergeMedicalRequirementAudit,
  validateAppealWorkflow,
  type MedicalRequirement,
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

type ProcessTypeRelation = { slug: string }

function getProcessTypeSlug(relation: unknown) {
  const value = Array.isArray(relation) ? relation[0] : relation
  return value && typeof value === 'object' && 'slug' in value
    ? String((value as ProcessTypeRelation).slug)
    : ''
}

const dateOrEmptySchema = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])

const medicalRequirementSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(MEDICAL_REQUIREMENT_TYPE_VALUES),
  title: z.string().trim().min(1).max(200),
  details: z.string().max(5000).default(''),
  requested_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: dateOrEmptySchema.default(''),
  follow_up_date: dateOrEmptySchema.default(''),
  status: z.enum(MEDICAL_REQUIREMENT_STATUS_VALUES),
  result: z.string().max(5000).default(''),
  created_at: z.string().max(50).default(''),
  updated_at: z.string().max(50).default(''),
  history: z.array(z.object({
    id: z.string().min(1).max(200),
    event: z.enum(['created', 'updated', 'status_changed', 'migrated']),
    status: z.enum(MEDICAL_REQUIREMENT_STATUS_VALUES),
    occurred_at: z.string().max(50),
  })).max(200).default([]),
})

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
    .select('client_id, status, completed_at, vehicle_id, process_types(slug)')
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

  if (isMedicalStage(stage.stage_key)) {
    const parsedRequirements = z.array(medicalRequirementSchema).max(50).safeParse(stageData.medical_requirements ?? [])
    if (!parsedRequirements.success) {
      return NextResponse.json({
        error: 'Revise os dados das exigências e exames complementares.',
        details: parsedRequirements.error.flatten(),
      }, { status: 422 })
    }

    const requirementIds = new Set(parsedRequirements.data.map(requirement => requirement.id))
    if (requirementIds.size !== parsedRequirements.data.length) {
      return NextResponse.json({ error: 'Existem exigências médicas duplicadas. Atualize a página e tente novamente.' }, { status: 422 })
    }

    const resolvedStatuses = new Set(['concluida', 'cancelada'])
    const unresolved = parsedRequirements.data.some(requirement => !resolvedStatuses.has(requirement.status))
    const hasFinalMedicalResult = ['aprovado', 'reprovado'].includes(values.status)
      || ['aprovado', 'reprovado'].includes(values.result ?? '')
    if (unresolved && hasFinalMedicalResult) {
      return NextResponse.json({
        error: 'Conclua ou cancele todas as exigências médicas antes de registrar o resultado definitivo.',
      }, { status: 422 })
    }

    const missingResolution = parsedRequirements.data.some(requirement => (
      resolvedStatuses.has(requirement.status) && !requirement.result.trim()
    ))
    if (missingResolution) {
      return NextResponse.json({ error: 'Informe o resultado ou motivo das exigências encerradas.' }, { status: 422 })
    }

    const existingRequirements = getMedicalRequirements(stage)
    stageData.medical_requirements = mergeMedicalRequirementAudit(
      existingRequirements,
      parsedRequirements.data as MedicalRequirement[],
      new Date().toISOString(),
    )
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

  const isIcmsProtocol = processTypeSlug === 'processo_icms'
    && stage.stage_key === 'protocolo_sivei_icms'
  const isIpvaProtocol = processTypeSlug === 'processo_ipva'
    && stage.stage_key === 'sivei_protocolo'
  const hasProtocolValue = typeof stageData.protocol === 'string' && stageData.protocol.trim().length > 0
  const isResolvingVehicleProtocol = ['concluido', 'aprovado', 'reprovado'].includes(values.status)
  if ((isIcmsProtocol || isIpvaProtocol) && (hasProtocolValue || isResolvingVehicleProtocol)) {
    let hasMinimumVehicle = Boolean(processRecord.vehicle_id)
    if (!hasMinimumVehicle && isIcmsProtocol) {
      let purchaseData = stageData
      const hasCurrentPurchaseData = ['vehicle', 'brand', 'model'].some(key => (
        typeof purchaseData[key] === 'string' && purchaseData[key].trim()
      ))
      if (!hasCurrentPurchaseData) {
        const { data: purchaseStage } = await supabase
          .from('process_stages')
          .select('data')
          .eq('process_id', id)
          .eq('stage_key', 'dados_compra_icms')
          .maybeSingle()
        purchaseData = purchaseStage?.data as Record<string, unknown> ?? {}
      }
      hasMinimumVehicle = Boolean(
        typeof purchaseData.vehicle === 'string' && purchaseData.vehicle.trim()
        || (
          typeof purchaseData.brand === 'string' && purchaseData.brand.trim()
          && typeof purchaseData.model === 'string' && purchaseData.model.trim()
        ),
      )
    }
    if (!hasMinimumVehicle) {
      return NextResponse.json({
        error: isIpvaProtocol
          ? 'Vincule o veículo ao processo antes de concluir o protocolo do IPVA.'
          : 'Informe ao menos a marca e o modelo no Protocolo de ICMS antes de concluir.',
      }, { status: 422 })
    }
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

    if (operationalTemplate.activateOnRejected) {
      if (effectiveStatus === 'reprovado' || effectiveStatus === 'aprovado') {
        const { error: conditionalStageError } = await supabase
          .from('process_stages')
          .update({ status: effectiveStatus === 'reprovado' ? 'pendente' : 'nao_aplicavel', completed_at: null })
          .eq('process_id', id)
          .eq('stage_key', operationalTemplate.activateOnRejected)
        if (conditionalStageError) {
          return NextResponse.json({ error: `Etapa salva, mas não foi possível sincronizar a etapa condicional: ${conditionalStageError.message}` }, { status: 400 })
        }
      }
    }

    const workflowKeys = new Set(operationalWorkflow.stages.map(item => item.stage_key))
    const { data: workflowStages, error: workflowStagesError } = await supabase
      .from('process_stages')
      .select('stage_key, status')
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
      const { error: processSyncError } = await supabase
        .from('processes')
        .update({
          status: allResolved ? 'concluido' : 'em_andamento',
          completed_at: allResolved ? processRecord.completed_at ?? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (processSyncError) {
        return NextResponse.json({ error: `Etapa salva, mas não foi possível atualizar o processo: ${processSyncError.message}` }, { status: 400 })
      }
    }
  }

  return NextResponse.json({ stage: data })
}
