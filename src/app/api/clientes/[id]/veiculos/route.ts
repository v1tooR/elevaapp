import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const clientIdSchema = z.string().uuid()
const optionalText = z.string().trim().max(120).optional().nullable()
const vehicleSchema = z.object({
  vehicleCondition: z.enum(['zero_km', 'usado']),
  plate: z.string().trim().max(10).optional().nullable(),
  renavam: z.string().trim().max(20).optional().nullable(),
  brand: optionalText,
  model: optionalText,
  modelYear: z.number().int().min(1900).max(2200).optional().nullable(),
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

  revalidatePath(`/clientes/${parsedClientId.data}`)
  revalidatePath('/processos/novo')

  return NextResponse.json({ vehicle }, { status: 201 })
}
