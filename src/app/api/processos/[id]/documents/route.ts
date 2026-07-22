import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isAllowedDocumentUrl } from '@/lib/document-security'

const documentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().url().refine(isAllowedDocumentUrl, 'Use um link HTTPS do Google Drive.'),
  type: z.string().trim().max(100).nullable().optional(),
  stageId: z.string().uuid().nullable().optional(),
  visibility: z.enum(['admin_only', 'client_visible']).optional(),
  requested: z.boolean().optional(),
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile?.is_active) return NextResponse.json({ error: 'Acesso inativo.' }, { status: 403 })

  const rpcName = profile.role === 'cliente'
    ? 'add_client_process_document'
    : ['super_admin', 'admin', 'analista'].includes(profile.role)
      ? 'add_staff_process_document'
      : null
  if (!rpcName) return NextResponse.json({ error: 'Sem permissão para enviar documentos.' }, { status: 403 })

  const args: Record<string, string | boolean | null> = {
    p_process_id: id,
    p_file_name: parsed.data.title,
    p_file_url: parsed.data.url,
    p_document_type: parsed.data.type ?? null,
    p_process_stage_id: parsed.data.stageId ?? null,
  }
  if (rpcName === 'add_staff_process_document') {
    args.p_visibility = parsed.data.visibility ?? 'admin_only'
    args.p_requested = parsed.data.requested ?? false
  }

  const { data, error } = await supabase.rpc(rpcName, args)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ documentId: data }, { status: 201 })
}
