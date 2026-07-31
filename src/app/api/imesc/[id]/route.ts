import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeImescPayload } from '@/lib/imesc-workflow'
import { createClient } from '@/lib/supabase/server'
import type { ImescFollowup } from '@/types/database'

const boardStatus = z.enum([
  'aguardando',
  'leve',
  'moderado',
  'grave',
  'nao_compareceu',
  'sem_deficiencia',
  'indeferido',
  'cancelado',
])
const operationalStatus = z.enum([
  'nao_iniciado',
  'solicitacao_em_preparo',
  'agendado',
  'pericia_realizada',
  'laudo_disponivel',
  'encerrado',
])
const nullableUuid = z.uuid().nullable()
const nullableDate = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.literal(''),
  z.null(),
])

const updateFollowupSchema = z.object({
  boardStatus: boardStatus.optional(),
  operationalStatus: operationalStatus.optional(),
  responsibleUserId: nullableUuid.optional(),
  ipiProcessId: nullableUuid.optional(),
  ipvaProcessId: nullableUuid.optional(),
  protocol: z.string().trim().max(160).nullable().optional(),
  scheduledDate: nullableDate.optional(),
  examinationDate: nullableDate.optional(),
  reportIssuedAt: nullableDate.optional(),
  reportValidUntil: nullableDate.optional(),
  sourceClassification: z.enum([
    'leve',
    'moderada',
    'grave',
    'gravissima',
    'sem_deficiencia',
  ]).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
}).refine(payload => Object.keys(payload).length > 0)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedId = z.uuid().safeParse((await params).id)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Acompanhamento inválido.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()
  if (!profile || !['super_admin', 'admin', 'analista'].includes(profile.role)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para operar o IMESC.' },
      { status: 403 },
    )
  }

  const parsed = updateFollowupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revise os dados do acompanhamento IMESC.' },
      { status: 400 },
    )
  }

  const { data: current, error: currentError } = await supabase
    .from('imesc_followups')
    .select('*')
    .eq('id', parsedId.data)
    .single()
  if (currentError || !current) {
    return NextResponse.json(
      { error: currentError?.message ?? 'Acompanhamento não encontrado.' },
      { status: 404 },
    )
  }

  const row = current as ImescFollowup
  const normalized = normalizeImescPayload({
    board_status: parsed.data.boardStatus ?? row.board_status,
    operational_status: parsed.data.operationalStatus ?? row.operational_status,
    responsible_user_id: parsed.data.responsibleUserId === undefined
      ? row.responsible_user_id
      : parsed.data.responsibleUserId,
    ipi_process_id: parsed.data.ipiProcessId === undefined
      ? row.ipi_process_id
      : parsed.data.ipiProcessId,
    ipva_process_id: parsed.data.ipvaProcessId === undefined
      ? row.ipva_process_id
      : parsed.data.ipvaProcessId,
    protocol: parsed.data.protocol === undefined ? row.protocol : parsed.data.protocol,
    scheduled_date: parsed.data.scheduledDate === undefined
      ? row.scheduled_date
      : parsed.data.scheduledDate,
    examination_date: parsed.data.examinationDate === undefined
      ? row.examination_date
      : parsed.data.examinationDate,
    report_issued_at: parsed.data.reportIssuedAt === undefined
      ? row.report_issued_at
      : parsed.data.reportIssuedAt,
    report_valid_until: parsed.data.reportValidUntil === undefined
      ? row.report_valid_until
      : parsed.data.reportValidUntil,
    source_classification: parsed.data.sourceClassification === undefined
      ? row.source_classification
      : parsed.data.sourceClassification,
    notes: parsed.data.notes === undefined ? row.notes : parsed.data.notes,
    completed_at: row.completed_at,
  })

  const { data, error } = await supabase
    .from('imesc_followups')
    .update(normalized)
    .eq('id', parsedId.data)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ followup: data })
}
