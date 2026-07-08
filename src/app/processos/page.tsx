import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderOpen, TrendingUp, Clock, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { ProcessesStatusChart } from '@/components/processos/processes-status-chart'

const ACTIVE_STATUSES = ['aberto', 'em_andamento', 'em_analise']
const WAITING_STATUSES = ['aguardando_documentos', 'aguardando_orgao']

const STATUS_CHART_CONFIG: Record<string, { label: string; color: string }> = {
  aberto:                { label: 'Aberto',       color: '#3B82F6' },
  em_andamento:          { label: 'Em andamento', color: '#F59E0B' },
  aguardando_documentos: { label: 'Ag. documentos',color: '#F97316' },
  em_analise:            { label: 'Em análise',   color: '#8B5CF6' },
  aguardando_orgao:      { label: 'Ag. órgão',    color: '#6366F1' },
  concluido:             { label: 'Concluído',    color: '#10B981' },
  arquivado:             { label: 'Arquivado',    color: '#94A3B8' },
  cancelado:             { label: 'Cancelado',    color: '#EF4444' },
}

const KPI_ORDER = [
  'aberto', 'em_andamento', 'aguardando_documentos', 'em_analise',
  'aguardando_orgao', 'concluido', 'arquivado', 'cancelado',
]

export default async function ProcessosHubPage() {
  const supabase = await createClient()

  const now = new Date()
  const thirtyDays = new Date(now)
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  const today = now.toISOString().split('T')[0]
  const deadlineLimit = thirtyDays.toISOString().split('T')[0]

  const [
    { data: processTypes },
    { data: allProcs },
    { count: deadlineCount },
  ] = await Promise.all([
    supabase.from('process_types').select('id, name, slug, color').eq('is_active', true).order('name'),
    supabase.from('processes').select('process_type_id, status'),
    supabase.from('calendar_events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'deadline')
      .eq('status', 'pending')
      .gte('event_date', today)
      .lte('event_date', deadlineLimit),
  ])

  // Aggregate counts
  const procs = allProcs ?? []
  const activeCount = procs.filter(p => [...ACTIVE_STATUSES, ...WAITING_STATUSES].includes(p.status)).length
  const waitingCount = procs.filter(p => WAITING_STATUSES.includes(p.status)).length
  const concludedCount = procs.filter(p => p.status === 'concluido').length

  // Per-type counts (non-archived/cancelled)
  const typeCountMap: Record<string, number> = {}
  for (const p of procs) {
    if (!['arquivado', 'cancelado'].includes(p.status)) {
      typeCountMap[p.process_type_id] = (typeCountMap[p.process_type_id] ?? 0) + 1
    }
  }

  // Chart data by status
  const statusCountMap: Record<string, number> = {}
  for (const p of procs) {
    statusCountMap[p.status] = (statusCountMap[p.status] ?? 0) + 1
  }
  const chartData = KPI_ORDER
    .filter(s => (statusCountMap[s] ?? 0) > 0)
    .map(s => ({
      label: STATUS_CHART_CONFIG[s]?.label ?? s,
      count: statusCountMap[s] ?? 0,
      color: STATUS_CHART_CONFIG[s]?.color ?? '#94A3B8',
    }))

  const kpiCards = [
    {
      label: 'Em andamento',
      value: activeCount,
      icon: TrendingUp,
      color: '#F59E0B',
      bg: '#FFFBEB',
      hint: 'processos ativos',
    },
    {
      label: 'Aguardando',
      value: waitingCount,
      icon: Clock,
      color: '#F97316',
      bg: '#FFF7ED',
      hint: 'docs / órgão',
    },
    {
      label: 'Concluídos',
      value: concludedCount,
      icon: CheckCircle2,
      color: '#10B981',
      bg: '#ECFDF5',
      hint: 'processos finalizados',
    },
    {
      label: 'Prazos (30 dias)',
      value: deadlineCount ?? 0,
      icon: AlertTriangle,
      color: (deadlineCount ?? 0) > 0 ? '#EF4444' : '#94A3B8',
      bg: (deadlineCount ?? 0) > 0 ? '#FEF2F2' : '#F8FAFC',
      hint: 'deadlines próximos',
    },
  ]

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
        .anim-4 { animation-delay: 0.20s; }
        .type-card { transition: all 0.15s; }
        .type-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.09); }
        .novo-btn { transition: all 0.12s; }
        .novo-btn:hover { filter: brightness(1.08); }
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
                  {procs.length} processo{procs.length !== 1 ? 's' : ''} no total
                  {processTypes ? ` · ${processTypes.length} tipo${processTypes.length !== 1 ? 's' : ''} ativo${processTypes.length !== 1 ? 's' : ''}` : ''}
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

        {/* ── KPI Strip ──────────────────────────────────────────── */}
        <div className="anim anim-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map(({ label, value, icon: Icon, color, bg, hint }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-4 flex flex-col gap-2"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <span className="dash text-xs font-semibold text-slate-500">{label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
              </div>
              <div>
                <span className="dash text-3xl font-bold" style={{ color }}>{value}</span>
                <p className="dash text-[11px] text-slate-400 mt-0.5">{hint}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Mini chart ─────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <div
            className="anim anim-2 bg-white rounded-2xl p-5"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <h2 className="dash font-bold text-slate-900 text-sm">Distribuição por status</h2>
              <span className="dash text-xs text-slate-400 ml-auto">{procs.length} total</span>
            </div>
            <div style={{ height: Math.max(chartData.length * 32, 80) }}>
              <ProcessesStatusChart data={chartData} />
            </div>
          </div>
        )}

        {/* ── Type cards grid ────────────────────────────────────── */}
        {processTypes && processTypes.length > 0 && (
          <div className="anim anim-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="dash font-bold text-slate-800 text-base">Tipos de Processo</h2>
              <span className="dash text-xs text-slate-400">{processTypes.length} ativo{processTypes.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(processTypes as any[]).map((type) => {
                const count = typeCountMap[type.id] ?? 0
                const color = type.color ?? '#3B82F6'
                return (
                  <div
                    key={type.id}
                    className="type-card bg-white rounded-2xl overflow-hidden flex flex-col"
                    style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                  >
                    {/* Thin color accent top */}
                    <div className="h-1 w-full" style={{ backgroundColor: color }} />

                    {/* Main clickable area */}
                    <Link
                      href={`/processos/tipo/${type.slug}`}
                      className="flex-1 p-5 flex flex-col gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="dash font-bold text-slate-900 text-sm leading-tight">{type.name}</p>
                          <p className="dash text-[11px] text-slate-400 mt-0.5 truncate">
                            {count > 0 ? `${count} processo${count !== 1 ? 's' : ''} ativo${count !== 1 ? 's' : ''}` : 'Nenhum processo ainda'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="dash text-4xl font-bold leading-none" style={{ color }}>{count}</span>
                      </div>
                    </Link>

                    {/* Footer actions */}
                    <div
                      className="flex items-center justify-between px-5 py-3"
                      style={{ borderTop: '1px solid #F1F5F9' }}
                    >
                      <Link
                        href={`/processos/tipo/${type.slug}`}
                        className="dash text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 font-medium"
                      >
                        Ver todos <ArrowUpRight className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/processos/novo?type_id=${type.id}`}
                        className="novo-btn flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors dash"
                        style={{ backgroundColor: color }}
                      >
                        <Plus className="w-3 h-3" /> Novo
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {(!processTypes || processTypes.length === 0) && (
          <div
            className="anim anim-2 bg-white rounded-2xl flex flex-col items-center justify-center py-20 gap-4"
            style={{ border: '1px solid #E2E8F0' }}
          >
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="dash font-semibold text-slate-700">Nenhum tipo de processo ativo</p>
              <p className="text-sm text-slate-400 mt-1 dash">Configure tipos de processo nas configurações</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
