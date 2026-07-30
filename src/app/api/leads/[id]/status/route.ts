import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { LEAD_FUNNEL_STATUSES } from '@/lib/lead-funnel'
import {
  getLeadIntendedServices,
  LEAD_SERVICE_PROCESS_TYPE_SLUGS,
} from '@/lib/lead-eligibility'
import { getCnhStageTemplates } from '@/lib/cnh-stages'
import { buildOperationalStageRows } from '@/lib/operational-workflows'
import { analyzeEligibility } from '@/lib/eligibility'
import type { Client, Lead } from '@/types/database'

const statusSchema = z.object({
  status: z.enum(LEAD_FUNNEL_STATUSES),
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
  | 'requires_adapted_vehicle'
  | 'requires_practical_exam'
  | 'has_medical_report'
  | 'authorized_drivers'
>

interface QueueProcess {
  id: string
  process_type_id: string
  origin_lead_id: string | null
}

interface QueueProcessType {
  id: string
  slug: string
}

async function ensureLeadServiceQueue(
  supabase: SupabaseClient,
  lead: QueueLead,
  clientId: string,
) {
  const services = getLeadIntendedServices(lead)
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
      .eq('is_active', true),
    supabase
      .from('clients')
      .select(`
        id, state, client_type, disability_type, disability_types,
        disability_severity, cnh_status, cnh_restrictions,
        medical_assessment_status, requires_adapted_vehicle,
        requires_practical_exam, has_medical_report, authorized_drivers
      `)
      .eq('id', clientId)
      .single(),
    supabase
      .from('processes')
      .select('id, process_type_id, origin_lead_id')
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

  for (const [index, service] of services.entries()) {
    const processTypeSlug = LEAD_SERVICE_PROCESS_TYPE_SLUGS[service]
    const processType = processTypeBySlug.get(processTypeSlug)
    if (!processType) continue

    const existingProcess = existingRows.find(row => (
      row.process_type_id === processType.id
    ))
    const serviceOrder = index + 1

    if (existingProcess) {
      const { error } = await supabase
        .from('processes')
        .update({
          service_order: serviceOrder,
          origin_lead_id: existingProcess.origin_lead_id ?? lead.id,
        })
        .eq('id', existingProcess.id)

      if (error) throw error
      processIds.push(existingProcess.id)
      continue
    }

    const cnhStages = processTypeSlug === 'cnh_especial'
      ? getCnhStageTemplates({
          clientType: clientRecord.client_type,
          medicalAssessmentStatus: clientRecord.medical_assessment_status,
          requiresPracticalExam: clientRecord.requires_practical_exam,
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
      requiresAdaptedVehicle: clientRecord.requires_adapted_vehicle,
      requiresPracticalExam: clientRecord.requires_practical_exam,
      hasMedicalReport: clientRecord.has_medical_report,
      authorizedDrivers: clientRecord.authorized_drivers,
    })

    const { data: processId, error: processError } = await supabase.rpc(
      'create_process_atomic',
      {
        p_client_id: clientId,
        p_process_type_id: processType.id,
        p_protocol: null,
        p_status: index === 0 ? 'em_andamento' : 'aberto',
        p_responsible_user_id: lead.assigned_to ?? null,
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
      })
      .eq('id', processId)

    if (queueError) throw queueError
    processIds.push(processId as string)
    existingRows.push({
      id: processId as string,
      process_type_id: processType.id,
      origin_lead_id: lead.id,
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
    .select('role')
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
    const intendedServices = getLeadIntendedServices(lead)
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
