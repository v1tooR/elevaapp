import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const communicationSchema = z.object({
  audience: z.enum(['internal', 'client']),
  message: z.string().trim().min(2).max(2000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = communicationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escreva uma mensagem válida.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase.rpc('add_process_communication', {
    p_process_id: id,
    p_message: parsed.data.message,
    p_audience: parsed.data.audience,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data }, { status: 201 })
}
