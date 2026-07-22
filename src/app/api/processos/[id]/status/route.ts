import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const statusSchema = z.object({
  status: z.enum([
    'aberto',
    'em_andamento',
    'aguardando_documentos',
    'em_analise',
    'aguardando_orgao',
    'concluido',
    'arquivado',
    'cancelado',
  ]),
  note: z.string().trim().max(500).nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = statusSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase.rpc('transition_process_status', {
    p_process_id: id,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
