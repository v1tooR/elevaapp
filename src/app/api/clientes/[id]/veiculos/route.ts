import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildOperationalStageRows } from '@/lib/operational-workflows'
import { buildIpvaVehicleStage, canReleaseIpva, IPVA_RELEASE_NOTE } from '@/lib/ipva-release'

const clientIdSchema = z.string().uuid()
const optionalText = z.string().trim().max(120).optional().nullable()
const vehicleSchema = z.object({
  vehicleCondition: z.enum(['zero_km', 'usado']),
  plate: z.string().trim().max(10).optional().nullable(),
  renavam: z.string().trim().max(20).optional().nullable(),
  brand: optionalText,
  model: optionalText,
  modelYear: z.number().int().min(1900).max(2200).optional().nullable(),
  invoiceIssuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
}).superRefine((value, context) => {
  const hasBrandAndModel = Boolean(value.brand?.trim() && value.model?.trim())
  const hasOfficialIdentifier = Boolean(value.plate?.trim() || value.renavam?.trim())

  if (!hasBrandAndModel && !hasOfficialIdentifier) {
    context.addIssue({
      code: 'custom',
      path: ['brand'],
      message: 'Informe marca e modelo, placa ou RENAVAM.',
    })
  }
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsedClientId = clientIdSchema.safeParse(id)
  const parsedBody = vehicleSchema.safeParse(await request.json().catch(() => null))

  if (!parsedClientId.success || !parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error?.issues[0]?.message ?? 'Dados do veículo inválidos.' },
      { status: 422 },
    )
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
    return NextResponse.json({ error: 'Sem permissão para cadastrar veículos.' }, { status: 403 })
  }

  const value = parsedBody.data
  const { data: vehicle, error } = await supabase
    .from('client_vehicles')
    .insert({
      client_id: parsedClientId.data,
      description: null,
      vehicle_condition: value.vehicleCondition,
      plate: value.plate || null,
      renavam: value.renavam || null,
      chassis: null,
      brand: value.brand || null,
      model: value.model || null,
      model_year: value.modelYear ?? null,
      created_by: caller.id,
    })
    .select('*')
    .single()

  if (error || !vehicle) {
    return NextResponse.json(
      { error: error?.message ?? 'Não foi possível cadastrar o veículo.' },
      { status: error?.code === '23505' ? 409 : 400 },
    )
  }

  const ipvaRelease = canReleaseIpva(value)
    ? await releaseIpvaProcess(supabase, parsedClientId.data, value, vehicle.id as string)
    : null

  revalidatePath(`/clientes/${parsedClientId.data}`)
  revalidatePath('/processos/novo')
  revalidatePath('/processos/lista')

  return NextResponse.json({ vehicle, ipvaRelease }, { status: 201 })
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Placa e marca liberam o IPVA imediatamente: o processo deixa de esperar
 * qualquer outro serviço e a etapa de veículo já nasce preenchida.
 */
async function releaseIpvaProcess(
  supabase: SupabaseServerClient,
  clientId: string,
  vehicle: z.infer<typeof vehicleSchema>,
  vehicleId: string,
) {
  const { data: ipvaType } = await supabase
    .from('process_types')
    .select('id')
    .eq('slug', 'processo_ipva')
    .maybeSingle()
  if (!ipvaType) return null

  const { data: process } = await supabase
    .from('processes')
    .select('id, status, blocked_reason, started_at, service_plan_item_id')
    .eq('client_id', clientId)
    .eq('process_type_id', ipvaType.id)
    .not('status', 'in', '(concluido,arquivado,cancelado)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!process) return null

  // As etapas podem ainda não existir em processos antigos.
  await supabase
    .from('process_stages')
    .upsert(buildOperationalStageRows(process.id, 'processo_ipva'), {
      onConflict: 'process_id,stage_key',
      ignoreDuplicates: true,
    })

  const vehicleStage = buildIpvaVehicleStage({
    plate: vehicle.plate,
    renavam: vehicle.renavam,
    brand: vehicle.brand,
    model: vehicle.model,
    vehicleCondition: vehicle.vehicleCondition,
    invoiceIssuedAt: vehicle.invoiceIssuedAt,
  })

  const { data: existingStage } = await supabase
    .from('process_stages')
    .select('id, data')
    .eq('process_id', process.id)
    .eq('stage_key', 'veiculo_ipva')
    .maybeSingle()

  if (existingStage) {
    await supabase
      .from('process_stages')
      .update({
        status: vehicleStage.status,
        data: { ...(existingStage.data as Record<string, unknown> ?? {}), ...vehicleStage.data },
      })
      .eq('id', existingStage.id)
  }

  const { error: processError } = await supabase
    .from('processes')
    .update({
      status: process.status === 'aberto' ? 'aguardando_documentos' : process.status,
      blocked_reason: null,
      started_at: process.started_at ?? new Date().toISOString(),
      next_action: 'Aguardar documentos do cliente',
      action_owner: 'cliente',
      vehicle_id: vehicleId,
      vehicle_condition: vehicle.vehicleCondition,
    })
    .eq('id', process.id)
  if (processError) return { processId: process.id, released: false, error: processError.message }

  if (process.service_plan_item_id) {
    await supabase
      .from('client_service_plan_items')
      .update({
        status: 'iniciado',
        wait_reason: null,
        ready_at: new Date().toISOString(),
      })
      .eq('id', process.service_plan_item_id)
      .in('status', ['planejado', 'pronto_para_iniciar'])
  }

  return { processId: process.id, released: true, note: IPVA_RELEASE_NOTE }
}
