import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Target, ArrowUpRight, ChevronLeft, ChevronRight, Filter, LayoutList, Columns3 } from 'lucide-react'
import { formatPhone } from '@/lib/utils'
import { LeadKanbanBoard, type LeadKanbanItem } from '@/components/leads/lead-kanban-board'

interface SearchParams { q?: string; status?: string; assigned_to?: string; page?: string; view?: string }

const STATUS_LABEL: Record<string, string> = {
  novo:            'Novo',
  em_atendimento:  'Em atendimento',
  convertido:      'Convertido',
  perdido:         'Perdido',
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  novo:           { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  em_atendimento: { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  convertido:     { bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
  perdido:        { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
}

const SOURCE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  google:    'Google',
  indicacao: 'Indicação',
  vendedor:  'Vendedor',
  outros:    'Outros',
}

const SOURCE_STYLE: Record<string, { bg: string; text: string }> = {
  instagram: { bg: '#FAF5FF', text: '#9333EA' },
  google:    { bg: '#EFF6FF', text: '#2563EB' },
  indicacao: { bg: '#F0FDF4', text: '#15803D' },
  vendedor:  { bg: '#FFF7ED', text: '#EA580C' },
  outros:    { bg: '#F8FAFC', text: '#64748B' },
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const view = params.view === 'kanban' ? 'kanban' : 'lista'
  const q = params.q ?? ''
  const filterStatus = view === 'lista' ? (params.status ?? '') : ''
  const filterAssigned = params.assigned_to ?? ''
  const page = parseInt(params.page ?? '1')
  const perPage = 20

  const supabase = await createClient()

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['super_admin', 'admin', 'analista'])
    .eq('is_active', true)
    .order('name')

  let query = supabase
    .from('leads')
    .select('*, assignee:assigned_to(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  query = view === 'kanban'
    ? query.limit(500)
    : query.range((page - 1) * perPage, page * perPage - 1)

  if (q)              query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  if (filterStatus)   query = query.eq('status', filterStatus)
  if (filterAssigned) query = query.eq('assigned_to', filterAssigned)

  const { data: leads, count } = await query
  const leadList = (leads ?? []) as LeadKanbanItem[]
  const totalPages = Math.ceil((count ?? 0) / perPage)

  const buildUrl = (overrides: Record<string, string>) => {
    const p = { q, status: filterStatus, assigned_to: filterAssigned, page: '1', view, ...overrides }
    const s = new URLSearchParams()
    if (p.q)            s.set('q', p.q)
    if (p.status)       s.set('status', p.status)
    if (p.assigned_to)  s.set('assigned_to', p.assigned_to)
    if (p.page !== '1') s.set('page', p.page)
    if (p.view === 'kanban') s.set('view', 'kanban')
    const str = s.toString()
    return str ? `/leads?${str}` : '/leads'
  }

  const listUrl = buildUrl({ view: 'lista' })
  const kanbanUrl = buildUrl({ view: 'kanban', status: '', page: '1' })

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .lead-row { transition: background 0.12s; }
        .lead-row:hover { background: #F8FAFC; }
        .lead-row:hover .lead-name { color: #2563EB; }
        .lead-row:hover .row-arrow { opacity: 1; transform: translate(0,0); }
        .row-arrow { opacity: 0; transform: translate(-4px,4px); transition: opacity 0.15s, transform 0.15s; }
        .search-input:focus { box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        .filter-select:focus { outline: none; border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
      `}</style>

      <div className="space-y-5">

        {/* ── Banner ─────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative flex flex-wrap items-center justify-between gap-4 p-6 lg:p-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Target className="w-6 h-6 text-primary-foreground/75" />
              </div>
              <div>
                <h1 className="dash text-white text-2xl lg:text-3xl font-bold leading-tight">Leads</h1>
                <p className="dash text-primary-foreground/65 text-sm mt-0.5">
                  {count ?? 0} lead{count !== 1 ? 's' : ''} {filterStatus ? `com status "${STATUS_LABEL[filterStatus]}"` : 'no total'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1" role="group" aria-label="Modo de visualização">
                <Link
                  href={listUrl}
                  aria-current={view === 'lista' ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all dash ${view === 'lista' ? 'bg-white text-foreground' : 'text-white/70 hover:text-white'}`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Lista
                </Link>
                <Link
                  href={kanbanUrl}
                  aria-current={view === 'kanban' ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all dash ${view === 'kanban' ? 'bg-white text-foreground' : 'text-white/70 hover:text-white'}`}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Kanban
                </Link>
              </div>

              <Link
                href="/leads/novo"
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/20 dash"
              >
                <Plus className="w-4 h-4" />
                Novo Lead
              </Link>
            </div>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div
          className="anim anim-1 bg-white rounded-2xl p-4 space-y-3"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <form method="GET" className="flex flex-wrap gap-3">
            {view === 'kanban' && <input type="hidden" name="view" value="kanban" />}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome ou telefone..."
                className="search-input w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm bg-muted focus:bg-card focus:border-primary focus:outline-none transition-all dash"
              />
            </div>

            {view === 'lista' && (
              <select
                name="status"
                defaultValue={filterStatus}
                className="filter-select border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 dash transition-all"
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            )}

            <select
              name="assigned_to"
              defaultValue={filterAssigned}
              className="filter-select border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 dash transition-all"
            >
              <option value="">Todos os responsáveis</option>
              {(staff ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors dash"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtrar
            </button>

            {(q || filterStatus || filterAssigned) && (
              <Link
                href={buildUrl({ q: '', status: '', assigned_to: '', page: '1' })}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors dash"
              >
                Limpar
              </Link>
            )}
          </form>

          {/* Status pills */}
          {view === 'lista' && <div className="flex flex-wrap gap-2">
            <Link
              href={buildUrl({ status: '' })}
              className="px-3 py-1 rounded-full text-xs font-semibold dash transition-all"
              style={!filterStatus
                ? { background: '#1E293B', color: '#fff' }
                : { background: '#F1F5F9', color: '#64748B' }}
            >
              Todos
            </Link>
            {Object.entries(STATUS_LABEL).map(([v, l]) => {
              const s = STATUS_STYLE[v]
              return (
                <Link
                  key={v}
                  href={buildUrl({ status: v })}
                  className="px-3 py-1 rounded-full text-xs font-semibold dash transition-all"
                  style={filterStatus === v
                    ? { background: s.dot, color: '#fff' }
                    : { background: s.bg, color: s.text }}
                >
                  {l}
                </Link>
              )
            })}
          </div>}
        </div>

        {/* ── Table ────────────────────────────────────────────────── */}
        {view === 'kanban' ? (
          <div className="anim anim-2 rounded-2xl border border-border bg-card p-3 shadow-soft lg:p-4">
            <LeadKanbanBoard leads={leadList} />
          </div>
        ) : <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {!leads || leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Target className="w-7 h-7 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="dash font-semibold text-slate-700">
                  {q || filterStatus || filterAssigned ? 'Nenhum resultado encontrado' : 'Nenhum lead cadastrado'}
                </p>
                <p className="text-sm text-slate-400 mt-1 dash">
                  {q || filterStatus || filterAssigned ? 'Tente ajustar os filtros' : 'Comece adicionando o primeiro lead'}
                </p>
              </div>
              {!q && !filterStatus && !filterAssigned && (
                <Link
                  href="/leads/novo"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors dash"
                >
                  <Plus className="w-4 h-4" /> Novo lead
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Nome</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Telefone</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Origem</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Responsável</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {leadList.map(lead => {
                    const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE.novo
                    const src = lead.lead_source ? SOURCE_STYLE[lead.lead_source] : null
                    return (
                      <tr key={lead.id} className="lead-row border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3.5">
                          <p className="lead-name font-semibold text-slate-900 transition-colors dash">{lead.name}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell dash">
                          {lead.phone ? formatPhone(lead.phone) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          {lead.lead_source && src ? (
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold dash"
                              style={{ background: src.bg, color: src.text }}
                            >
                              {SOURCE_LABEL[lead.lead_source]}
                            </span>
                          ) : <span className="text-slate-300 dash">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell dash">
                          {lead.assignee?.name ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold dash"
                            style={{ background: st.bg, color: st.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
                            {STATUS_LABEL[lead.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="flex items-center justify-end gap-1 text-blue-600 text-xs font-semibold dash hover:text-blue-700"
                          >
                            <span className="hidden sm:inline">Ver</span>
                            <ArrowUpRight className="row-arrow w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>}

        {/* ── Pagination ─────────────────────────────────────────── */}
        {view === 'lista' && totalPages > 1 && (
          <div className="anim anim-3 flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dash"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Link>
            ) : (
              <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-300 dash cursor-not-allowed">
                <ChevronLeft className="w-4 h-4 inline" /> Anterior
              </div>
            )}
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl">
              <span className="text-sm text-slate-500 dash">
                <span className="font-bold text-slate-900">{page}</span> de <span className="font-bold text-slate-900">{totalPages}</span>
              </span>
            </div>
            {page < totalPages ? (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dash"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-300 dash cursor-not-allowed">
                Próxima <ChevronRight className="w-4 h-4 inline" />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
