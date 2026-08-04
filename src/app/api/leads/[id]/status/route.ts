import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LEAD_FUNNEL_STATUSES } from '@/lib/lead-funnel'
import {
  getLeadIntendedServices,
  LEAD_SERVICE_PROCESS_TYPE_SLUGS,
  normalizeLeadIntendedServices,
} from '@/lib/lead-eligibility'
import { getCnhStageTemplates } from '@/lib/cnh-stages'
import { buildOperationalStageRows } from '@/lib/operational-workflows'
import { buildServicePlanDefinitions, getServicePrerequisite } from '@/lib/service-plan'
import { analyzeEligibility } from '@/lib/eligibility'
import type { Client, Lead, LeadIntendedService, ProcessStatus } from '@/types/database'

const intendedServiceValues = [
  'cnh_especial',
  'ipi',
  'icms',
  'ipva',
  'credencial_estacionamento',
  'cin',
  'emplacamento',
  'renovacao',
  'isencao_ir',
  'aposentadoria',
  'alvara',
] as const

const statusSchema = z.object({
  status: z.enum(LEAD_FUNNEL_STATUSES),
  selectedServices: z.array(z.enum(intendedServiceValues)).min(1).max(11).optional(),
})

type QueueLead = Pick<
  Lead,
  'id' | 'name' | 'assigned_to' | 'intended_service' | 'intended_services'
>

type QueueClient = Pick<
  Client,
  | 'id'
  | 'state'
  | 'client_type'
  | 'disability_type'
  | 'disability_types'
  | 'disability_severity'
  | 'cnh_status'
  | 'cnh_restrictions'
  | 'medical_assessment_status'
  | 'has_medical_report'
  | 'authorized_drivers'
>

interface QueueProcess {
  id: string
  process_type_id: string
  origin_lead_id: string | null
  status: ProcessStatus
}

interface QueueProcessType {
  id: string
  slug: string
}

interface ServicePlanItemRow {
  id: string
  process_type_id: string
  service_key: LeadIntendedService
  process_id: string | null
}

const TERMINAL_PROCESS_STATUSES = new Set<ProcessStatus>([
  'concluido',
  'arquivado',
  'cancelado',
])

async function ensureLeadServiceQueue(
  supabase: SupabaseClient,
  lead: QueueLead,
  clientId: string,
  selectedServices: LeadIntendedService[],
  commercialOwnerId: string | null,
) {
  const planDefinitions = buildServicePlanDefinitions(selectedServices)
  const services = planDefinitions.map(item => item.service)
  if (services.length === 0) return [] as string[]

  const slugs = services.map(service => LEAD_SERVICE_PROCESS_TYPE_SLUGS[service])
  const [
    { data: processTypes, error: processTypesError },
    { data: client, error: clientError },
    { data: existingProcesses, error: existingProcessesError },
  ] = await Promise.all([
    supabase
      .from('process_types')
      .select('id, slug')
      .in('slug', slugs)
      .eq('is_active', true)
      .eq('accepts_new_processes', true),
    supabase
      .from('clients')
      .select(`
        id, state, client_type, disability_type, disability_types,
        disability_severity, cnh_status, cnh_restrictions,
        medical_assessment_status, has_medical_report, authorized_drivers
      `)
      .eq('id', clientId)
      .single(),
    supabase
      .from('processes')
      .select('id, process_type_id, origin_lead_id, status')
      .eq('client_id', clientId),
  ])

  if (processTypesError) throw processTypesError
  if (clientError || !client) throw clientError ?? new Error('Cliente convertido não encontrado.')
  if (existingProcessesError) throw existingProcessesError

  const processTypeRows = (processTypes ?? []) as QueueProcessType[]
  const clientRecord = client as QueueClient
  const existingRows = (existingProcesses ?? []) as QueueProcess[]
  const processTypeBySlug = new Map(processTypeRows.map(type => [type.slug, type]))
  const missingServices = services.filter(service => (
    !processTypeBySlug.has(LEAD_SERVICE_PROCESS_TYPE_SLUGS[service])
  ))

  if (missingServices.length > 0) {
    throw new Error('Um ou mais tipos de processo dos serviços selecionados não estão disponíveis.')
  }
  if (services.includes('cnh_especial') && clientRecord.client_type !== 'condutor') {
    throw new Error('A CNH Especial exige que o cliente esteja cadastrado como condutor.')
  }

  const processIds: string[] = []

  if (commercialOwnerId) {
    const { error: ownerError } = await supabase
      .from('clients')
      .update({ commercial_owner_id: commercialOwnerId })
      .eq('id', clientId)

    if (ownerError) throw ownerError
  }

  const { data: existingEngagement, error: engagementLookupError } = await supabase
    .from('client_service_engagements')
    .select('id')
    .eq('origin_lead_id', lead.id)
    .maybeSingle()

  if (engagementLookupError) throw engagementLookupError

  let engagementId = existingEngagement?.id as string | undefined
  if (!engagementId) {
    const { data: engagement, error: engagementError } = await supabase
      .from('client_service_engagements')
      .insert({
        client_id: clientId,
        origin_lead_id: lead.id,
        commercial_owner_id: commercialOwnerId,
      })
      .select('id')
      .single()

    if (engagementError || !engagement) {
      throw engagementError ?? new Error('Nao foi possivel criar o plano de servicos.')
    }
    engagementId = engagement.id as string
  } else if (commercialOwnerId) {
    const { error: engagementOwnerError } = await supabase
      .from('client_service_engagements')
      .update({ commercial_owner_id: commercialOwnerId })
      .eq('id', engagementId)
    if (engagementOwnerError) throw engagementOwnerError
  }

  const { data: currentPlanItems, error: currentPlanError } = await supabase
    .from('client_service_plan_items')
    .select('id, process_type_id, service_key, process_id')
    .eq('engagement_id', engagementId)

  if (currentPlanError) throw currentPlanError

  const planItemsByService = new Map<LeadIntendedService, ServicePlanItemRow>()
  for (const item of (currentPlanItems ?? []) as ServicePlanItemRow[]) {
    planItemsByService.set(item.service_key, item)
  }

  for (const [index, service] of services.entries()) {
    const processType = processTypeBySlug.get(LEAD_SERVICE_PROCESS_TYPE_SLUGS[service])
    if (!processType) continue

    const existingProcess = existingRows.find(row => (
      row.process_type_id === processType.id
      && row.origin_lead_id === lead.id
      && !TERMINAL_PROCESS_STATUSES.has(row.status)
    )) ?? existingRows.find(row => (
      row.process_type_id === processType.id
      && !TERMINAL_PROCESS_STATUSES.has(row.status)
    )) ?? existingRows.find(row => (
      row.process_type_id === processType.id
      && row.origin_lead_id === lead.id
    ))
    const currentItem = planItemsByService.get(service)

    if (currentItem) {
      const { error: itemUpdateError } = await supabase
        .from('client_service_plan_items')
        .update({
          sort_order: index + 1,
          process_id: currentItem.process_id ?? existingProcess?.id ?? null,
        })
        .eq('id', currentItem.id)
      if (itemUpdateError) throw itemUpdateError
      continue
    }

    const prerequisite = getServicePrerequisite(service, services)
    const initialStatus = existingProcess
      ? existingProcess.status === 'concluido'
        ? 'concluido'
        : TERMINAL_PROCESS_STATUSES.has(existingProcess.status)
          ? 'cancelado'
          : 'iniciado'
      : prerequisite
        ? 'planejado'
        : 'pronto_para_iniciar'

    const { data: item, error: itemError } = await supabase
      .from('client_service_plan_items')
      .insert({
        engagement_id: engagementId,
        process_type_id: processType.id,
        service_key: service,
        sort_order: index + 1,
        status: initialStatus,
        process_id: existingProcess?.id ?? null,
        ready_at: initialStatus === 'pronto_para_iniciar' ? new Date().toISOString() : null,
        started_at: initialStatus === 'iniciado' ? new Date().toISOString() : null,
        completed_at: initialStatus === 'concluido' ? new Date().toISOString() : null,
        wait_reason: prerequisite ? 'Aguardando a conclusao do servico anterior' : null,
      })
      .select('id, process_type_id, service_key, process_id')
      .single()

    if (itemError || !item) {
      throw itemError ?? new Error('Nao foi possivel organizar os servicos confirmados.')
    }
    planItemsByService.set(service, item as ServicePlanItemRow)
  }

  for (const service of services) {
    const prerequisite = getServicePrerequisite(service, services)
    if (!prerequisite) continue
    const item = planItemsByService.get(service)
    const prerequisiteItem = planItemsByService.get(prerequisite)
    if (!item || !prerequisiteItem) continue

    const { error: dependencyError } = await supabase
      .from('client_service_plan_items')
      .update({ prerequisite_item_id: prerequisiteItem.id })
      .eq('id', item.id)
    if (dependencyError) throw dependencyError
  }

  for (const [index, service] of services.entries()) {
    const processTypeSlug = LEAD_SERVICE_PROCESS_TYPE_SLUGS[service]
    const processType = processTypeBySlug.get(processTypeSlug)
    if (!processType) continue

    const existingProcess = existingRows.find(row => (
      row.process_type_id === processType.id
      && row.origin_lead_id === lead.id
      && !TERMINAL_PROCESS_STATUSES.has(row.status)
    )) ?? existingRows.find(row => (
      row.process_type_id === processType.id
      && !TERMINAL_PROCESS_STATUSES.has(row.status)
    ))
    const serviceOrder = index + 1
    const planItem = planItemsByService.get(service)

    if (existingProcess) {
      const { error } = await supabase
        .from('processes')
        .update({
          service_order: serviceOrder,
          origin_lead_id: existingProcess.origin_lead_id ?? lead.id,
          service_engagement_id: engagementId,
          service_plan_item_id: planItem?.id ?? null,
        })
        .eq('id', existingProcess.id)

      if (error) throw error
      processIds.push(existingProcess.id)
      continue
    }

    const prerequisite = getServicePrerequisite(service, services)
    const processStatus: ProcessStatus = prerequisite ? 'aberto' : 'em_andamento'
    const blockedReason = prerequisite === 'cnh_especial'
      ? 'Aguardando conclusão da CNH Especial'
      : prerequisite === 'ipi'
        ? 'Aguardando deferimento do IPI'
        : null

    const cnhStages = processTypeSlug === 'cnh_especial'
      ? getCnhStageTemplates({
          clientType: clientRecord.client_type,
          medicalAssessmentStatus: clientRecord.medical_assessment_status,
          requiresPracticalExam: null,
        })
      : null
    const stages = cnhStages
      ? cnhStages.map(stage => ({
          stage_key: stage.stage_key,
          label: stage.label,
          sort_order: stage.sort_order,
          status: stage.status ?? 'pendente',
          data: stage.data,
        }))
      : buildOperationalStageRows('', processTypeSlug).map(({
          process_id: _processId,
          ...stage
        }) => {
          void _processId
          return stage
        })
    const eligibilityAnalysis = analyzeEligibility({
      processTypeSlug,
      state: clientRecord.state,
      clientType: clientRecord.client_type,
      disabilityType: clientRecord.disability_type,
      disabilityTypes: clientRecord.disability_types,
      disabilitySeverity: clientRecord.disability_severity,
      cnhStatus: clientRecord.cnh_status,
      cnhRestrictions: clientRecord.cnh_restrictions,
      medicalAssessmentStatus: clientRecord.medical_assessment_status,
      hasMedicalReport: clientRecord.has_medical_report,
      authorizedDrivers: clientRecord.authorized_drivers,
    })

    const { data: processId, error: processError } = await supabase.rpc(
      'create_process_atomic',
      {
        p_client_id: clientId,
        p_process_type_id: processType.id,
        p_protocol: null,
        p_status: processStatus,
        p_responsible_user_id: null,
        p_observations: `Processo criado na conversão do lead ${lead.name}.`,
        p_jurisdiction_state: clientRecord.state ?? null,
        p_vehicle_condition: null,
        p_eligibility_status: eligibilityAnalysis?.status ?? null,
        p_eligibility_analysis: eligibilityAnalysis ?? null,
        p_custom_fields: [],
        p_stages: stages,
        p_financial: null,
      },
    )

    if (processError || !processId) {
      throw processError ?? new Error(`Não foi possível iniciar o serviço ${service}.`)
    }

    const { error: queueError } = await supabase
      .from('processes')
      .update({
        service_order: serviceOrder,
        origin_lead_id: lead.id,
        service_engagement_id: engagementId,
        service_plan_item_id: planItem?.id ?? null,
        next_action: prerequisite ? null : 'Iniciar atendimento',
        action_owner: prerequisite ? null : 'equipe',
        blocked_reason: blockedReason,
        started_at: prerequisite ? null : new Date().toISOString(),
      })
      .eq('id', processId)

    if (queueError) throw queueError
    processIds.push(processId as string)
    existingRows.push({
      id: processId as string,
      process_type_id: processType.id,
      origin_lead_id: lead.id,
      status: processStatus,
    })
  }

  return processIds
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = statusSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Status do lead inválido.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!caller || !['super_admin', 'admin', 'analista'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sem permissão para atualizar leads.' }, { status: 403 })
  }

  const { id } = await params
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select(`
      id, name, status, converted_client_id, assigned_to,
      intended_service, intended_services, is_driver
    `)
    .eq('id', id)
    .maybeSingle()

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 400 })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })

  let convertedClientId = lead.converted_client_id as string | null
  let serviceProcessIds: string[] = []

  if (parsed.data.status === 'convertido') {
    const intendedServices = normalizeLeadIntendedServices(
      parsed.data.selectedServices ?? getLeadIntendedServices(lead),
    )
    if (
      !convertedClientId
      && intendedServices.includes('cnh_especial')
      && lead.is_driver !== true
    ) {
      return NextResponse.json(
        { error: 'Para iniciar a CNH Especial, classifique o lead como condutor.' },
        { status: 422 },
      )
    }

    const { error: confirmedServicesError } = await supabase
      .from('leads')
      .update({
        intended_service: intendedServices[0] ?? null,
        intended_services: intendedServices,
      })
      .eq('id', id)

    if (confirmedServicesError) {
      return NextResponse.json({ error: confirmedServicesError.message }, { status: 400 })
    }

    const { data: assignedProfile } = lead.assigned_to
      ? await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', lead.assigned_to)
          .maybeSingle()
      : { data: null }
    const commercialOwnerId = assignedProfile
      && ['super_admin', 'admin'].includes(assignedProfile.role)
      ? assignedProfile.id
      : ['super_admin', 'admin'].includes(caller.role)
        ? caller.id
        : null

    if (convertedClientId) {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'convertido' })
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      const { data, error } = await supabase.rpc('convert_lead_to_client', {
        p_lead_id: id,
      })

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? 'Não foi possível criar o cliente.' },
          { status: 400 },
        )
      }
      convertedClientId = data as string
    }

    try {
      serviceProcessIds = await ensureLeadServiceQueue(
        supabase,
        lead as QueueLead,
        convertedClientId,
        intendedServices,
        commercialOwnerId,
      )
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error
            ? error.message
            : 'Cliente criado, mas não foi possível iniciar os serviços selecionados.',
          convertedClientId,
        },
        { status: 400 },
      )
    }
  } else {
    if (convertedClientId) {
      return NextResponse.json(
        { error: 'Um lead já convertido não pode voltar para outra situação.' },
        { status: 409 },
      )
    }

    const { error } = await supabase
      .from('leads')
      .update({ status: parsed.data.status })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  if (convertedClientId) {
    revalidatePath('/clientes')
    revalidatePath(`/clientes/${convertedClientId}`)
    revalidatePath('/processos')
    revalidatePath('/processos/lista')
  }

  return NextResponse.json({
    leadId: id,
    status: parsed.data.status,
    convertedClientId,
    serviceProcessIds,
  })
}
