import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const filterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: z.record(z.string(), z.string().max(200)).refine(
    value => Object.keys(value).every(key => ['q', 'status', 'responsavel', 'prazo', 'etapa', 'pendencia'].includes(key)),
    'Filtro inválido.',
  ),
})

export async function POST(request: Request) {
  const parsed = filterSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revise o nome e os filtros.' }, { status: 422 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile?.is_active || !['super_admin', 'admin', 'analista'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { error } = await supabase.from('saved_filters').upsert({
    profile_id: profile.id,
    scope: 'processes',
    name: parsed.data.name,
    filters: parsed.data.filters,
  }, { onConflict: 'profile_id,scope,name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true }, { status: 201 })
}
