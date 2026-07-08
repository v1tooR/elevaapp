import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Plus, FolderOpen, ArrowUpRight, ChevronLeft, ChevronRight, ArrowLeft,
} from 'lucide-react'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate, PROCESS_STATUS_LABELS } from '@/lib/utils'

interface SearchParams { status?: string; page?: string }
interface Params { slug: string }

const STATUS_COLORS: Record<string, { dot: string; pill: string; active: string }> = {
  aberto:                  { dot: '#3B82F6', pill: 'bg-blue-50 text-blue-700 border-blue-200',     active: 'bg-blue-600 text-white border-blue-600' },
  em_andamento:            { dot: '#F59E0B', pill: 'bg-amber-50 text-amber-700 border-amber-200',   active: 'bg-amber-500 text-white border-amber-500' },
  aguardando_documentos:   { dot: '#F97316', pill: 'bg-orange-50 text-orange-700 border-orange-200',active: 'bg-orange-500 text-white border-orange-500' },
  em_analise:              { dot: '#8B5CF6', pill: 'bg-purple-50 text-purple-700 border-purple-200',active: 'bg-purple-600 text-white border-purple-600' },
  aguardando_orgao:        { dot: '#6366F1', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',active: 'bg-indigo-600 text-white border-indigo-600' },
  concluido:               { dot: '#10B981', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  arquivado:               { dot: '#94A3B8', pill: 'bg-slate-50 text-slate-600 border-slate-200',   active: 'bg-slate-500 text-white border-slate-500' },
  cancelado:               { dot: '#EF4444', pill: 'bg-red-50 text-red-700 border-red-200',         active: 'bg-red-600 text-white border-red-600' },
}

const quickStatuses = ['aberto', 'em_andamento', 'aguardando_documentos', 'aguardando_orgao', 'concluido']

export default async function ProcessosPorTipoPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  const sp = await searchParams
  const statusFilter = sp.status ?? ''
  const page = parseInt(sp.page ?? '1')
  const perPage = 20

  const supabase = await createClient()

  // Fetch the process type first
  const { data: processType } = await supabase
    .from('process_types')
    .select('id, name, slug, color')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!processType) notFound()

  const color = (processType as any).color ?? '#3B82F6'

  let query = supabase
    .from('processes')
    .select('*, clients(id, name)', { count: 'exact' })
    .eq('process_type_id', (processType as any).id)
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: processes, count } = await query
  const totalPages = Math.ceil((count ?? 0) / perPage)

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
        .proc-row { transition: background 0.12s; }
        .proc-row:hover { background: #F8FAFC; }
        .status-pill { transition: all 0.15s; }
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

          <div className="relative p-6 lg:p-8">
            {/* Breadcrumb */}
            <Link
              href="/processos"
              className="dash inline-flex items-center gap-1.5 text-blue-300/70 text-xs font-medium hover:text-blue-200 transition-colors mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Todos os processos
            </Link>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/20"
                  style={{ backgroundColor: `${color}30` }}
                >
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
                </div>
                <div>
                  <h1 className="dash text-white text-2xl lg:text-3xl font-bold leading-tight">
                    {(processType as any).name}
                  </h1>
                  <p className="dash text-blue-300/70 text-sm mt-0.5">
                    {count ?? 0} processo{count !== 1 ? 's' : ''}
                    {statusFilter ? ` · ${PROCESS_STATUS_LABELS[statusFilter as keyof typeof PROCESS_STATUS_LABELS] ?? statusFilter}` : ''}
                  </p>
                </div>
              </div>

              <Link
                href={`/processos/novo?type_id=${(processType as any).id}`}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 transition-all dash"
              >
                <Plus className="w-4 h-4" />
                Novo {(processType as any).name}
              </Link>
            </div>
          </div>
        </div>

        {/* ── Filtros de status ──────────────────────────────────── */}
        <div
          className="anim anim-1 bg-white rounded-2xl p-4"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/processos/tipo/${slug}`}
              className={`status-pill dash text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${!statusFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}
            >
              Todos
            </Link>
            {quickStatuses.map(s => {
              const c = STATUS_COLORS[s]
              return (
                <Link
                  key={s}
                  href={`/processos/tipo/${slug}?status=${s}`}
                  className={`status-pill dash text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${statusFilter === s ? c.active : c.pill}`}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: statusFilter === s ? 'currentColor' : c.dot, opacity: statusFilter === s ? 0.8 : 1 }}
                  />
                  {PROCESS_STATUS_LABELS[s as keyof typeof PROCESS_STATUS_LABELS]}
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Tabela ─────────────────────────────────────────────── */}
        <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
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
                  {statusFilter ? 'Tente ajustar o filtro de status' : `Crie o primeiro processo de ${(processType as any).name}`}
                </p>
              </div>
              <Link
                href={`/processos/novo?type_id=${(processType as any).id}`}
                className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-colors dash"
                style={{ backgroundColor: color }}
              >
                <Plus className="w-4 h-4" /> Criar processo
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
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
                        <Link
                          href={`/clientes/${p.clients?.id}`}
                          className="dash text-slate-800 font-semibold hover:text-blue-600 transition-colors"
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
                      <td className="px-5 py-4 text-slate-400 hidden lg:table-cell dash text-xs">
                        {formatDate(p.created_at)}
                      </td>
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
                href={`/processos/tipo/${slug}?status=${statusFilter}&page=${page - 1}`}
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
                href={`/processos/tipo/${slug}?status=${statusFilter}&page=${page + 1}`}
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
