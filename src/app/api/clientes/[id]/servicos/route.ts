import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  LEAD_SERVICE_PROCESS_TYPE_SLUGS,
  normalizeLeadIntendedServices,
} from '@/lib/lead-eligibility'
import { getCnhStageTemplates } from '@/lib/cnh-stages'
import { buildOperationalStageRows } from '@/lib/operational-workflows'
import { getServicePrerequisite } from '@/lib/service-plan'
import type { LeadIntendedService, ProcessStatus } from '@/types/database'

const serviceValues = [
  'cnh_especial', 'ipi', 'icms', 'ipva', 'credencial_estacionamento',
  'cin', 'emplacamento', 'renovacao', 'isencao_ir', 'aposentadoria', 'alvara',
] as const
const bodySchema = z.object({ services: z.array(z.enum(serviceValues)).min(1).max(11) })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const clientId = z.uuid().safeParse((await params).id)
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!clientId.success || !parsed.success) {
    return NextResponse.json({ error: 'Selecione ao menos um servico valido.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  const { data: caller } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!caller || !['super_admin', 'admin', 'analista'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sem permissao para alterar o plano de servicos.' }, { status: 403 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select(`
      id, state, client_type, commercial_owner_id, disability_type,
      disability_types, disability_severity, cnh_status, cnh_restrictions,
      medical_assessment_status, has_medical_report, authorized_drivers
    `)
    .eq('id', clientId.data)
    .eq('is_active', true)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliente ativo nao encontrado.' }, { status: 404 })

  const services = normalizeLeadIntendedServices(parsed.data.services)
  if (services.includes('cnh_especial') && client.client_type !== 'condutor') {
    return NextResponse.json({ error: 'A CNH Especial exige um cliente condutor.' }, { status: 422 })
  }

  const { data: engagements, error: engagementsError } = await supabase
    .from('client_service_engagements')
    .select('id, status')
    .eq('client_id', clientId.data)
    .order('created_at', { ascending: false })
  if (engagementsError) return NextResponse.json({ error: engagementsError.message }, { status: 400 })

  const engagementIds = (engagements ?? []).map(item => item.id)
  const { data: existingItems, error: existingItemsError } = engagementIds.length
    ? await supabase
        .from('client_service_plan_items')
        .select('id, engagement_id, service_key, sort_order, status')
        .in('engagement_id', engagementIds)
    : { data: [], error: null }
  if (existingItemsError) return NextResponse.json({ error: existingItemsError.message }, { status: 400 })

  const existingKeys = new Set((existingItems ?? []).map(item => item.service_key as LeadIntendedService))
  const newServices = services.filter(service => !existingKeys.has(service))
  if (newServices.length === 0) return NextResponse.json({ added: [] })

  let engagementId = engagements?.find(item => item.status === 'ativo')?.id
  if (!engagementId) {
    const { data: engagement, error } = await supabase
      .from('client_service_engagements')
      .insert({
        client_id: clientId.data,
        commercial_owner_id: client.commercial_owner_id ?? null,
        created_by: caller.id,
      })
      .select('id')
      .single()
    if (error || !engagement) return NextResponse.json({ error: error?.message ?? 'Nao foi possivel criar o plano.' }, { status: 400 })
    engagementId = engagement.id
  }

  const allCurrentItems = (existingItems ?? []).filter(item => item.engagement_id === engagementId)
  const currentKeys = allCurrentItems.map(item => item.service_key as LeadIntendedService)
  const mergedServices = normalizeLeadIntendedServices([...currentKeys, ...newServices])
  const slugs = newServices.map(service => LEAD_SERVICE_PROCESS_TYPE_SLUGS[service])
  const { data: processTypes, error: processTypesError } = await supabase
    .from('process_types')
    .select('id, slug')
    .in('slug', slugs)
    .eq('is_active', true)
    .eq('accepts_new_processes', true)
  if (processTypesError) return NextResponse.json({ error: processTypesError.message }, { status: 400 })
  const processTypeBySlug = new Map((processTypes ?? []).map(type => [type.slug, type.id]))
  if (processTypeBySlug.size !== newServices.length) {
    return NextResponse.json({ error: 'Um dos tipos de processo nao esta disponivel.' }, { status: 409 })
  }

  const inserted = new Map<LeadIntendedService, string>()
  const blockedServices = new Set<LeadIntendedService>()
  const existingInEngagement = new Map(allCurrentItems.map(item => [item.service_key as LeadIntendedService, item.id]))
  for (const service of newServices) {
    const prerequisite = getServicePrerequisite(service, mergedServices)
    const existingPrerequisite = prerequisite
      ? allCurrentItems.find(item => item.service_key === prerequisite)
      : null
    const prerequisiteId = prerequisite
      ? existingInEngagement.get(prerequisite) ?? inserted.get(prerequisite) ?? null
      : null
    const prerequisiteBlocks = Boolean(
      prerequisiteId
      && (!existingPrerequisite || existingPrerequisite.status !== 'concluido'),
    )
    const processTypeId = processTypeBySlug.get(LEAD_SERVICE_PROCESS_TYPE_SLUGS[service])
    if (!processTypeId) continue
    const { data: item, error } = await supabase
      .from('client_service_plan_items')
      .insert({
        engagement_id: engagementId,
        process_type_id: processTypeId,
        service_key: service,
        sort_order: mergedServices.indexOf(service) + 1,
        status: prerequisiteBlocks ? 'planejado' : 'pronto_para_iniciar',
        prerequisite_item_id: prerequisiteId,
        ready_at: prerequisiteBlocks ? null : new Date().toISOString(),
        wait_reason: prerequisiteBlocks ? 'Aguardando a conclusão do serviço anterior' : null,
      })
      .select('id')
      .single()
    if (error || !item) return NextResponse.json({ error: error?.message ?? 'Nao foi possivel adicionar o servico.' }, { status: 400 })
    inserted.set(service, item.id)
    if (prerequisiteBlocks) blockedServices.add(service)
  }

  for (const [index, service] of mergedServices.entries()) {
    const itemId = existingInEngagement.get(service) ?? inserted.get(service)
    if (!itemId) continue
    const { error } = await supabase
      .from('client_service_plan_items')
      .update({ sort_order: index + 1 })
      .eq('id', itemId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const processIds: string[] = []
  for (const service of newServices) {
    const processTypeSlug = LEAD_SERVICE_PROCESS_TYPE_SLUGS[service]
    const processTypeId = processTypeBySlug.get(processTypeSlug)
    const planItemId = inserted.get(service)
    if (!processTypeId || !planItemId) continue

    const prerequisite = getServicePrerequisite(service, mergedServices)
    const isBlocked = blockedServices.has(service)
    const processStatus: ProcessStatus = isBlocked ? 'aberto' : 'em_andamento'
    const blockedReason = isBlocked && prerequisite === 'cnh_especial'
      ? 'Aguardando conclusão da CNH Especial'
      : isBlocked && prerequisite === 'ipi'
        ? 'Aguardando deferimento do IPI'
        : null
    const { data: existingProcess, error: existingProcessError } = await supabase
      .from('processes')
      .select('id')
      .eq('client_id', clientId.data)
      .eq('process_type_id', processTypeId)
      .not('status', 'in', '(concluido,arquivado,cancelado)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingProcessError) {
      return NextResponse.json({ error: existingProcessError.message }, { status: 400 })
    }
    if (existingProcess) {
      const { error: existingLinkError } = await supabase
        .from('processes')
        .update({
          service_order: mergedServices.indexOf(service) + 1,
          service_engagement_id: engagementId,
          service_plan_item_id: planItemId,
        })
        .eq('id', existingProcess.id)
      if (existingLinkError) return NextResponse.json({ error: existingLinkError.message }, { status: 400 })
      processIds.push(existingProcess.id)
      continue
    }
    const cnhStages = processTypeSlug === 'cnh_especial'
      ? getCnhStageTemplates({
          clientType: client.client_type,
          medicalAssessmentStatus: client.medical_assessment_status,
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
      : buildOperationalStageRows('', processTypeSlug).map(({ process_id: _processId, ...stage }) => {
          void _processId
          return stage
        })
    const { data: processId, error: processError } = await supabase.rpc('create_process_atomic', {
      p_client_id: clientId.data,
      p_process_type_id: processTypeId,
      p_protocol: null,
      p_status: processStatus,
      p_responsible_user_id: null,
      p_observations: 'Processo criado a partir do plano de serviços do cliente.',
      p_jurisdiction_state: client.state ?? null,
      p_vehicle_condition: null,
      p_eligibility_status: null,
      p_eligibility_analysis: null,
      p_custom_fields: [],
      p_stages: stages,
      p_financial: null,
    })
    if (processError || !processId) {
      return NextResponse.json({
        error: processError?.message ?? `O serviço ${service} foi adicionado, mas o processo não pôde ser criado.`,
      }, { status: 400 })
    }

    const { error: linkError } = await supabase
      .from('processes')
      .update({
        service_order: mergedServices.indexOf(service) + 1,
        service_engagement_id: engagementId,
        service_plan_item_id: planItemId,
        next_action: isBlocked ? null : 'Iniciar atendimento',
        action_owner: isBlocked ? null : 'equipe',
        blocked_reason: blockedReason,
        started_at: isBlocked ? null : new Date().toISOString(),
      })
      .eq('id', processId)
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 })
    processIds.push(processId as string)
  }

  revalidatePath(`/clientes/${clientId.data}`)
  revalidatePath('/processos')
  revalidatePath('/processos/lista')
  return NextResponse.json({ added: [...inserted.keys()], processIds }, { status: 201 })
}
