import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('finance_entries')
    .select('*, category:finance_categories(id,name,color), process:processes(id,title), client:clients(id,name)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ entry: data })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, any> = {}

  if (body.type !== undefined)        updates.type = body.type
  if (body.title !== undefined)       updates.title = body.title
  if (body.description !== undefined) updates.description = body.description || null
  if (body.amount !== undefined)      updates.amount = Number(body.amount)
  if (body.occurred_at !== undefined) updates.occurred_at = body.occurred_at
  if (body.category_id !== undefined) updates.category_id = body.category_id || null
  if (body.process_id !== undefined)  updates.process_id = body.process_id || null
  if (body.client_id !== undefined)   updates.client_id = body.client_id || null
  if (body.status !== undefined)      updates.status = body.status
  if (body.recurrence !== undefined)  updates.recurrence = body.recurrence

  const { data, error } = await supabase
    .from('finance_entries')
    .update(updates)
    .eq('id', id)
    .select('*, category:finance_categories(id,name,color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
