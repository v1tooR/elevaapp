import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildOperationalStageRows, getOperationalWorkflowDefinition } from '@/lib/operational-workflows'

type ProcessTypeRelation = { slug: string }

function getProcessTypeSlug(relation: unknown) {
  const value = Array.isArray(relation) ? relation[0] : relation
  return value && typeof value === 'object' && 'slug' in value
    ? String((value as ProcessTypeRelation).slug)
    : ''
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data: process, error: processError } = await supabase
    .from('processes')
    .select('id, process_types(slug)')
    .eq('id', id)
    .single()
  if (processError || !process) {
    return NextResponse.json({ error: processError?.message ?? 'Processo não encontrado.' }, { status: 404 })
  }

  const slug = getProcessTypeSlug(process.process_types)
  const workflow = getOperationalWorkflowDefinition(slug)
  if (!workflow) return NextResponse.json({ error: 'Este tipo de processo não possui workflow operacional configurado.' }, { status: 422 })

  const rows = buildOperationalStageRows(id, slug)
  const { error } = await supabase
    .from('process_stages')
    .upsert(rows, { onConflict: 'process_id,stage_key', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: stages, error: stagesError } = await supabase
    .from('process_stages')
    .select('*')
    .eq('process_id', id)
    .order('sort_order')
  if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 400 })

  return NextResponse.json({ workflow: workflow.slug, stages })
}

