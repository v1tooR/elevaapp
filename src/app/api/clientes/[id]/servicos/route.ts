import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  LEAD_SERVICE_PROCESS_TYPE_SLUGS,
  normalizeLeadIntendedServices,
} from '@/lib/lead-eligibility'
import { getServicePrerequisite } from '@/lib/service-plan'
import type { LeadIntendedService } from '@/types/database'

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
    .select('id, client_type, commercial_owner_id')
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
  const existingInEngagement = new Map(allCurrentItems.map(item => [item.service_key as LeadIntendedService, item.id]))
  for (const service of newServices) {
    const prerequisite = getServicePrerequisite(service, mergedServices)
    const prerequisiteId = prerequisite
      ? existingInEngagement.get(prerequisite) ?? inserted.get(prerequisite) ?? null
      : null
    const processTypeId = processTypeBySlug.get(LEAD_SERVICE_PROCESS_TYPE_SLUGS[service])
    if (!processTypeId) continue
    const { data: item, error } = await supabase
      .from('client_service_plan_items')
      .insert({
        engagement_id: engagementId,
        process_type_id: processTypeId,
        service_key: service,
        sort_order: mergedServices.indexOf(service) + 1,
        status: prerequisiteId ? 'planejado' : 'pronto_para_iniciar',
        prerequisite_item_id: prerequisiteId,
        ready_at: prerequisiteId ? null : new Date().toISOString(),
        wait_reason: prerequisiteId ? 'Aguardando a conclusao do servico anterior' : null,
      })
      .select('id')
      .single()
    if (error || !item) return NextResponse.json({ error: error?.message ?? 'Nao foi possivel adicionar o servico.' }, { status: 400 })
    inserted.set(service, item.id)
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

  revalidatePath(`/clientes/${clientId.data}`)
  return NextResponse.json({ added: [...inserted.keys()] }, { status: 201 })
}
