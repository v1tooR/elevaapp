import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderOpen, ArrowUpRight, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { TypeFilterSelect } from '@/components/processos/type-filter-select'
import { formatDate, PROCESS_STATUS_LABELS } from '@/lib/utils'

interface SearchParams { status?: string; type_id?: string; page?: string }

const STATUS_COLORS: Record<string, { dot: string; pill: string; active: string }> = {
  aberto:                  { dot: '#3B82F6', pill: 'bg-blue-50 text-blue-700 border-blue-200',   active: 'bg-blue-600 text-white border-blue-600' },
  em_andamento:            { dot: '#F59E0B', pill: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-amber-500 text-white border-amber-500' },
  aguardando_documentos:   { dot: '#F97316', pill: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-500 text-white border-orange-500' },
  em_analise:              { dot: '#8B5CF6', pill: 'bg-purple-50 text-purple-700 border-purple-200', active: 'bg-purple-600 text-white border-purple-600' },
  aguardando_orgao:        { dot: '#6366F1', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200', active: 'bg-indigo-600 text-white border-indigo-600' },
  concluido:               { dot: '#10B981', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  arquivado:               { dot: '#94A3B8', pill: 'bg-slate-50 text-slate-600 border-slate-200',  active: 'bg-slate-500 text-white border-slate-500' },
  cancelado:               { dot: '#EF4444', pill: 'bg-red-50 text-red-700 border-red-200',       active: 'bg-red-600 text-white border-red-600' },
}

export default async function ProcessosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''
  const typeFilter = params.type_id ?? ''
  const page = parseInt(params.page ?? '1')
  const perPage = 20

  const supabase = await createClient()

  const [{ data: processTypes }] = await Promise.all([
    supabase.from('process_types').select('id, name, slug, color').eq('is_active', true).order('name'),
  ])

  let query = supabase
    .from('processes')
    .select('*, clients(id, name), process_types(id, name, color)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (typeFilter) query = query.eq('process_type_id', typeFilter)

  const { data: processes, count } = await query
  const totalPages = Math.ceil((count ?? 0) / perPage)

  const quickStatuses = ['aberto', 'em_andamento', 'aguardando_documentos', 'aguardando_orgao', 'concluido']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        .dash { font-family: 'Outfit', sans-serif; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .proc-row { transition: background 0.12s; }
        .proc-row:hover { background: #F8FAFC; }
        .proc-row:hover .proc-type { color: #2563EB; }
        .shortcut-card { transition: all 0.15s; }
        .shortcut-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .status-pill { transition: all 0.15s; }
        .shortcut-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="space-y-5">

        {/* ── Banner ─────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0C1A2E 0%, #1A3055 55%, #1E40AF 100%)' }}
        >
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #60A5FA, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative flex items-center justify-between gap-4 p-6 lg:p-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <FolderOpen className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h1 className="dash text-white text-2xl lg:text-3xl font-bold leading-tight">Processos</h1>
                <p className="dash text-blue-300/70 text-sm mt-0.5">
                  {count ?? 0} processo{count !== 1 ? 's' : ''} {statusFilter ? `· ${PROCESS_STATUS_LABELS[statusFilter as keyof typeof PROCESS_STATUS_LABELS] ?? statusFilter}` : 'no total'}
                </p>
              </div>
            </div>
            <Link
              href="/processos/novo"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 transition-all dash"
            >
              <Plus className="w-4 h-4" />
              Novo Processo
            </Link>
          </div>
        </div>

        {/* ── Atalhos Rápidos ────────────────────────────────────── */}
        {processTypes && processTypes.length > 0 && (
          <div
            className="anim anim-1 bg-white rounded-2xl p-5"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Criar Processo Rápido</h2>
                  <p className="text-[11px] text-slate-400 dash">Clique no tipo para ir direto ao formulário</p>
                </div>
              </div>
              <Link
                href="/processos/novo"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dash flex items-center gap-1"
              >
                Todos os tipos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="shortcut-scroll flex gap-2.5 overflow-x-auto pb-1">
              {(processTypes as any[]).map((type) => (
                <Link
                  key={type.id}
                  href={`/processos/novo?type_id=${type.id}`}
                  className="shortcut-card shrink-0 flex items-center gap-2.5 px-4 py-3 bg-slate-50 hover:bg-white border border-slate-100 rounded-xl cursor-pointer"
                  style={{ minWidth: '140px' }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: type.color ?? '#3B82F6' }}
                  />
                  <span className="dash text-xs font-semibold text-slate-700 truncate">{type.name}</span>
                  <Plus className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Filtros ────────────────────────────────────────────── */}
        <div
          className="anim anim-2 bg-white rounded-2xl p-4"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div>
            {/* Status pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              <Link
                href={`/processos?type_id=${typeFilter}`}
                className={`status-pill dash text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${!statusFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}
              >
                Todos
              </Link>
              {quickStatuses.map(s => {
                const c = STATUS_COLORS[s]
                return (
                  <Link
                    key={s}
                    href={`/processos?status=${s}&type_id=${typeFilter}`}
                    className={`status-pill dash text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${statusFilter === s ? c.active : c.pill}`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusFilter === s ? 'currentColor' : c.dot, opacity: statusFilter === s ? 0.8 : 1 }} />
                    {PROCESS_STATUS_LABELS[s as keyof typeof PROCESS_STATUS_LABELS]}
                  </Link>
                )
              })}
            </div>

            {/* Type + clear row */}
            <div className="flex gap-3 flex-wrap">
              <TypeFilterSelect
                processTypes={(processTypes ?? []) as { id: string; name: string }[]}
                typeFilter={typeFilter}
                statusFilter={statusFilter}
              />
              {(statusFilter || typeFilter) && (
                <Link
                  href="/processos"
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors dash"
                >
                  Limpar filtros
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabela ─────────────────────────────────────────────── */}
        <div
          className="anim anim-3 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {!processes || processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                <FolderOpen className="w-7 h-7 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="dash font-semibold text-slate-700">Nenhum processo encontrado</p>
                <p className="text-sm text-slate-400 mt-1 dash">
                  {statusFilter || typeFilter ? 'Tente ajustar os filtros' : 'Crie o primeiro processo usando os atalhos acima'}
                </p>
              </div>
              <Link
                href="/processos/novo"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors dash"
              >
                <Plus className="w-4 h-4" /> Criar processo
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Tipo de Processo</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Protocolo</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Data</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {(processes as any[]).map((p) => (
                    <tr key={p.id} className="proc-row border-b border-slate-50 last:border-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: `${p.process_types?.color ?? '#3B82F6'}18` }}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }}
                            />
                          </div>
                          <span className="proc-type dash font-semibold text-slate-900 transition-colors">{p.process_types?.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/clientes/${p.clients?.id}`}
                          className="dash text-slate-700 font-medium hover:text-blue-600 transition-colors"
                        >
                          {p.clients?.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-400 hidden md:table-cell dash">
                        {p.protocol ? (
                          <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded-lg">{p.protocol}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4"><ProcessStatusBadge status={p.status} /></td>
                      <td className="px-5 py-4 text-slate-400 hidden lg:table-cell dash text-xs">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/processos/${p.id}`}
                          className="flex items-center justify-end gap-1 text-blue-600 text-xs font-semibold dash hover:text-blue-700"
                        >
                          <span className="hidden sm:inline">Ver</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Paginação ──────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={`/processos?status=${statusFilter}&type_id=${typeFilter}&page=${page - 1}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dash"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Link>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-300 dash cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </div>
            )}
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl">
              <span className="text-sm text-slate-500 dash">
                <span className="font-bold text-slate-900">{page}</span> de <span className="font-bold text-slate-900">{totalPages}</span>
              </span>
            </div>
            {page < totalPages ? (
              <Link
                href={`/processos?status=${statusFilter}&type_id=${typeFilter}&page=${page + 1}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dash"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-300 dash cursor-not-allowed">
                Próxima <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
