import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const workflowSchema = z.object({
  status: z.enum(['pending', 'received', 'under_review', 'approved', 'rejected', 'resend_required']),
  visibility: z.enum(['admin_only', 'client_visible']),
  reviewResponsibleId: z.string().uuid().nullable(),
  rejectionReason: z.string().trim().max(1000).nullable().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = workflowSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revise o fluxo do documento.' }, { status: 422 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.rpc('update_document_workflow', {
    p_document_id: id,
    p_status: parsed.data.status,
    p_visibility: parsed.data.visibility,
    p_review_responsible_id: parsed.data.reviewResponsibleId,
    p_rejection_reason: parsed.data.rejectionReason ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
