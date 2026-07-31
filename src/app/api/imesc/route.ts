import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeImescPayload } from '@/lib/imesc-workflow'
import { createClient } from '@/lib/supabase/server'

const nullableUuid = z.uuid().nullable().optional()
const nullableDate = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.literal(''),
  z.null(),
]).optional()

const createFollowupSchema = z.object({
  clientId: z.uuid(),
  boardStatus: z.enum([
    'aguardando',
    'leve',
    'moderado',
    'grave',
    'nao_compareceu',
    'sem_deficiencia',
    'indeferido',
    'cancelado',
  ]).default('aguardando'),
  operationalStatus: z.enum([
    'nao_iniciado',
    'solicitacao_em_preparo',
    'agendado',
    'pericia_realizada',
    'laudo_disponivel',
    'encerrado',
  ]).default('nao_iniciado'),
  responsibleUserId: nullableUuid,
  ipiProcessId: nullableUuid,
  ipvaProcessId: nullableUuid,
  protocol: z.string().trim().max(160).nullable().optional(),
  scheduledDate: nullableDate,
  examinationDate: nullableDate,
  reportIssuedAt: nullableDate,
  reportValidUntil: nullableDate,
  sourceClassification: z.enum([
    'leve',
    'moderada',
    'grave',
    'gravissima',
    'sem_deficiencia',
  ]).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado.', status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin', 'analista'].includes(profile.role)) {
    return { error: 'Você não tem permissão para operar o IMESC.', status: 403 as const }
  }

  return { supabase, profile }
}

export async function POST(request: Request) {
  const auth = await requireStaff()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const parsed = createFollowupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revise os dados do acompanhamento IMESC.' },
      { status: 400 },
    )
  }

  const { data: client } = await auth.supabase
    .from('clients')
    .select('id')
    .eq('id', parsed.data.clientId)
    .eq('is_active', true)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: 'Cliente ativo não encontrado.' }, { status: 404 })
  }

  const normalized = normalizeImescPayload({
    board_status: parsed.data.boardStatus,
    operational_status: parsed.data.operationalStatus,
    responsible_user_id: parsed.data.responsibleUserId,
    ipi_process_id: parsed.data.ipiProcessId,
    ipva_process_id: parsed.data.ipvaProcessId,
    protocol: parsed.data.protocol,
    scheduled_date: parsed.data.scheduledDate,
    examination_date: parsed.data.examinationDate,
    report_issued_at: parsed.data.reportIssuedAt,
    report_valid_until: parsed.data.reportValidUntil,
    source_classification: parsed.data.sourceClassification,
    notes: parsed.data.notes,
  })

  const { data, error } = await auth.supabase
    .from('imesc_followups')
    .insert({
      client_id: parsed.data.clientId,
      ...normalized,
      created_by: auth.profile.id,
    })
    .select('*')
    .single()

  if (error) {
    const conflict = error.code === '23505'
    return NextResponse.json(
      {
        error: conflict
          ? 'Este cliente já possui acompanhamento IMESC.'
          : error.message,
      },
      { status: conflict ? 409 : 400 },
    )
  }

  return NextResponse.json({ followup: data }, { status: 201 })
}
