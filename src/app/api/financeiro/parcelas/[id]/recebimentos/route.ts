import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const receiptSchema = z.object({
  amount: z.number().positive().max(100000000),
  paidAt: z.string().datetime().optional(),
  paymentMethod: z.enum(['pix', 'cartao', 'boleto', 'dinheiro', 'transferencia']).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedId = z.uuid().safeParse((await params).id)
  const parsed = receiptSchema.safeParse(await request.json().catch(() => null))
  if (!parsedId.success || !parsed.success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? 'Recebimento invalido.' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 })
  }

  const { data: receiptId, error } = await supabase.rpc('record_financial_receipt', {
    p_installment_id: parsedId.data,
    p_amount: parsed.data.amount,
    p_paid_at: parsed.data.paidAt ?? new Date().toISOString(),
    p_payment_method: parsed.data.paymentMethod ?? null,
    p_note: parsed.data.note ?? null,
  })
  if (error || !receiptId) return NextResponse.json({ error: error?.message ?? 'Nao foi possivel registrar.' }, { status: 400 })
  return NextResponse.json({ receiptId }, { status: 201 })
}
