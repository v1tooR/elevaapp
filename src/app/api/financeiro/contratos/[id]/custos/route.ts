import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const costSchema = z.object({
  description: z.string().trim().min(2).max(300),
  amount: z.number().positive().max(100000000),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedId = z.uuid().safeParse((await params).id)
  const parsed = costSchema.safeParse(await request.json().catch(() => null))
  if (!parsedId.success || !parsed.success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? 'Custo invalido.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 })
  }

  const { data: costId, error } = await supabase.rpc('record_financial_contract_cost', {
    p_contract_id: parsedId.data,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_occurred_at: parsed.data.occurredAt,
  })
  if (error || !costId) return NextResponse.json({ error: error?.message ?? 'Nao foi possivel registrar.' }, { status: 400 })
  return NextResponse.json({ costId }, { status: 201 })
}
