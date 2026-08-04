import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const prioritySchema = z.object({
  processId: z.string().uuid(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = prioritySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Processo inválido.' }, { status: 422 })
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
    return NextResponse.json(
      { error: 'Sem permissão para ordenar os processos.' },
      { status: 403 },
    )
  }

  const { id: clientId } = await params
  const { error } = await supabase.rpc('prioritize_client_service_process_audited', {
    p_client_id: clientId,
    p_process_id: parsed.data.processId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  revalidatePath(`/clientes/${clientId}`)
  revalidatePath('/processos')
  revalidatePath('/processos/lista')

  return NextResponse.json({
    clientId,
    processId: parsed.data.processId,
  })
}
