import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const documentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Use um link HTTP ou HTTPS.'),
  type: z.string().trim().max(100).nullable().optional(),
  stageId: z.string().uuid().nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = documentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabase.rpc('add_process_document', {
    p_process_id: id,
    p_file_name: parsed.data.title,
    p_file_url: parsed.data.url,
    p_document_type: parsed.data.type ?? null,
    p_process_stage_id: parsed.data.stageId ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ documentId: data }, { status: 201 })
}

