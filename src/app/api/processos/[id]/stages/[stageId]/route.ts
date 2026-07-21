import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

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
    .select('process_id')
    .eq('id', stageId)
    .single()
  if (lookupError || !stage || stage.process_id !== id) {
    return NextResponse.json({ error: 'Etapa não encontrada neste processo.' }, { status: 404 })
  }

  const values = parsed.data
  const { data, error } = await supabase.rpc('save_process_stage', {
    p_stage_id: stageId,
    p_status: values.status,
    p_scheduled_date: values.scheduledDate ?? null,
    p_attended: values.attended ?? false,
    p_result: values.result ?? null,
    p_notes: values.notes ?? null,
    p_data: values.data,
    p_notify_client: values.notifyClient,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ stage: data })
}

