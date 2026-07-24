import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const statusSchema = z.object({
  status: z.enum(['novo', 'em_atendimento', 'convertido', 'perdido']),
})

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
    .select('id, status, converted_client_id')
    .eq('id', id)
    .maybeSingle()

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 400 })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 })

  let convertedClientId = lead.converted_client_id as string | null

  if (parsed.data.status === 'convertido') {
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
  }

  return NextResponse.json({
    leadId: id,
    status: parsed.data.status,
    convertedClientId,
  })
}
