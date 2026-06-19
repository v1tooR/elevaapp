import { createClient } from '@/lib/supabase/server'
import {
  Users, FolderOpen, FileText,
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  ArrowUpRight, Plus, Activity, Calendar,
} from 'lucide-react'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import Link from 'next/link'

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [
    { count: totalClients },
    { count: totalProcesses },
    { count: pendingDocs },
    { data: processesByStatus },
    { data: recentProcesses },
    { data: upcomingEvents },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('processes').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
    supabase.from('processes').select('status'),
    supabase.from('processes')
      .select('id, title, status, created_at, clients(name), process_types(name, color)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('calendar_events')
      .select('id, title, event_date, event_time, status, clients(name)')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5),
  ])

  const statusCounts = (processesByStatus ?? []).reduce((acc: Record<string, number>, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  return {
    totalClients: totalClients ?? 0,
    totalProcesses: totalProcesses ?? 0,
    pendingDocs: pendingDocs ?? 0,
    statusCounts,
    recentProcesses: recentProcesses ?? [],
    upcomingEvents: upcomingEvents ?? [],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const stats = await getDashboardStats(supabase)

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const pipeline = [
    { key: 'aberto',                  label: 'Abertos',       color: '#3B82F6' },
    { key: 'em_andamento',            label: 'Em Andamento',  color: '#F59E0B' },
    { key: 'aguardando_documentos',   label: 'Aguard. Doc.',  color: '#F97316' },
    { key: 'aguardando_orgao',        label: 'Aguard. Órgão', color: '#A855F7' },
    { key: 'concluido',               label: 'Concluídos',    color: '#10B981' },
  ]
  const totalWithStatus = pipeline.reduce((s, p) => s + (stats.statusCounts[p.key] ?? 0), 0)

  const statusCards = [
    { key: 'aberto',                label: 'Abertos',       icon: FolderOpen,    color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
    { key: 'em_andamento',          label: 'Em Andamento',  icon: Clock,         color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
    { key: 'aguardando_documentos', label: 'Aguard. Doc.',  icon: AlertCircle,   color: '#F97316', bg: '#FFF7ED', border: '#FDBA74' },
    { key: 'concluido',             label: 'Concluídos',    icon: CheckCircle2,  color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        .dash { font-family: 'Outfit', sans-serif; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim { animation: slideUp 0.45s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
        .anim-5 { animation-delay: 0.25s; }
        .anim-6 { animation-delay: 0.30s; }

        .bar-fill { animation: barGrow 0.9s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes barGrow {
          from { width: 0% !important; }
        }

        .process-row { transition: background 0.15s; }
        .process-row:hover { background: #F8FAFC; }
        .process-row:hover .row-name { color: #2563EB; }

        .link-arrow { transition: transform 0.15s; }
        .view-all:hover .link-arrow { transform: translate(2px, -2px); }
      `}</style>

      <div className="space-y-5">

        {/* ── Welcome Banner ───────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0C1A2E 0%, #1A3055 55%, #1E40AF 100%)' }}
        >
          {/* decorative glows */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #60A5FA, transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 w-96 h-40 opacity-[0.05]"
            style={{ background: 'radial-gradient(ellipse, #93C5FD, transparent 70%)' }} />
          {/* dot grid */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-6 lg:p-8">
            <div>
              <p className="dash text-blue-300/80 text-xs font-medium uppercase tracking-widest mb-2">
                {todayLabel}
              </p>
              <h1 className="dash text-white text-3xl lg:text-4xl font-bold leading-tight">
                Painel de Controle
              </h1>
              <p className="dash text-slate-400 text-sm mt-1">
                Eleva Isenções · Visão geral do sistema
              </p>
            </div>
            <Link
              href="/processos/novo"
              className="self-start sm:self-auto flex items-center gap-2 flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 transition-all dash"
            >
              <Plus className="w-4 h-4" />
              Novo Processo
            </Link>
          </div>

          {/* mini metric strip */}
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2 px-6 lg:px-8 pb-6 lg:pb-8">
            {[
              { value: stats.totalClients,                    label: 'Clientes Ativos',  Icon: Users },
              { value: stats.totalProcesses,                  label: 'Total Processos',  Icon: FolderOpen },
              { value: stats.pendingDocs,                     label: 'Docs Pendentes',   Icon: FileText },
              { value: stats.statusCounts['concluido'] ?? 0,  label: 'Concluídos',       Icon: TrendingUp },
            ].map(({ value, label, Icon }, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <Icon className="w-3.5 h-3.5 text-blue-300/70" />
                </div>
                <p className="dash text-2xl font-bold text-white">{value}</p>
                <p className="text-[11px] text-blue-200/70 mt-0.5 dash">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Status Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statusCards.map((s, i) => {
            const Icon = s.icon
            const count = stats.statusCounts[s.key] ?? 0
            const pct = totalWithStatus > 0 ? Math.round((count / totalWithStatus) * 100) : 0
            return (
              <div
                key={s.key}
                className={`anim anim-${i + 1} bg-white rounded-2xl p-5`}
                style={{
                  border: `1px solid ${s.border}`,
                  boxShadow: `0 1px 4px rgba(0,0,0,0.04), inset 0 0 0 1px ${s.border}40`,
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full dash"
                    style={{ backgroundColor: s.bg, color: s.color }}
                  >
                    {pct}%
                  </span>
                </div>
                <p className="dash text-3xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500 mt-0.5 dash">{s.label}</p>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${s.border}80` }}>
                  <div
                    className="bar-fill h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Pipeline Bar ─────────────────────────────────────────── */}
        {totalWithStatus > 0 && (
          <div
            className="anim anim-5 bg-white rounded-2xl p-6"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="dash font-bold text-slate-900 text-base">Pipeline de Processos</h2>
                <p className="text-xs text-slate-400 mt-0.5 dash">{totalWithStatus} processos distribuídos</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* segmented bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
              {pipeline.map(p => {
                const count = stats.statusCounts[p.key] ?? 0
                if (count === 0) return null
                const pct = (count / totalWithStatus) * 100
                return (
                  <div
                    key={p.key}
                    className="bar-fill h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: p.color, minWidth: '6px' }}
                    title={`${p.label}: ${count}`}
                  />
                )
              })}
            </div>

            {/* legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
              {pipeline.map(p => {
                const count = stats.statusCounts[p.key] ?? 0
                if (count === 0) return null
                const pct = Math.round((count / totalWithStatus) * 100)
                return (
                  <div key={p.key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs text-slate-500 dash">{p.label}</span>
                    <span className="text-xs font-bold text-slate-700 dash">{count}</span>
                    <span className="text-xs text-slate-400 dash">· {pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Bottom Grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Recent Processes */}
          <div
            className="anim anim-5 bg-white rounded-2xl overflow-hidden"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
              <div>
                <h2 className="dash font-bold text-slate-900">Processos Recentes</h2>
                <p className="text-xs text-slate-400 mt-0.5 dash">Últimas entradas</p>
              </div>
              <Link href="/processos" className="view-all flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold dash transition-colors">
                Ver todos <ArrowUpRight className="link-arrow w-3.5 h-3.5" />
              </Link>
            </div>

            {stats.recentProcesses.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 dash">Nenhum processo cadastrado</p>
              </div>
            ) : (
              <div>
                {(stats.recentProcesses as any[]).map((p, i) => {
                  const initials = (p.clients?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <Link
                      key={p.id}
                      href={`/processos/${p.id}`}
                      className="process-row flex items-center gap-4 px-6 py-3.5 border-b border-slate-50 last:border-0"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold dash"
                        style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="row-name text-sm font-semibold text-slate-900 truncate transition-colors dash">
                          {p.clients?.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate dash">{p.process_types?.name}</p>
                      </div>
                      <ProcessStatusBadge status={p.status} />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div
            className="anim anim-6 bg-white rounded-2xl overflow-hidden"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
              <div>
                <h2 className="dash font-bold text-slate-900">Próximos Eventos</h2>
                <p className="text-xs text-slate-400 mt-0.5 dash">Agenda do sistema</p>
              </div>
              <Link href="/calendario" className="view-all flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold dash transition-colors">
                Ver todos <ArrowUpRight className="link-arrow w-3.5 h-3.5" />
              </Link>
            </div>

            {stats.upcomingEvents.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 dash">Nenhum evento próximo</p>
              </div>
            ) : (
              <div>
                {(stats.upcomingEvents as any[]).map(ev => {
                  const evDate = new Date(ev.event_date + 'T00:00:00')
                  const day = evDate.getDate()
                  const month = evDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
                  const nowStr = new Date().toISOString().split('T')[0]
                  const isToday = ev.event_date === nowStr

                  return (
                    <div key={ev.id} className="flex items-start gap-4 px-6 py-4 border-b border-slate-50 last:border-0">
                      <div
                        className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: isToday ? 'linear-gradient(135deg, #1E3A5F, #1E40AF)' : '#EFF6FF' }}
                      >
                        <span className="text-[9px] font-bold uppercase leading-none" style={{ color: isToday ? '#93C5FD' : '#3B82F6' }}>
                          {month}
                        </span>
                        <span className="text-sm font-bold leading-tight mt-0.5" style={{ color: isToday ? '#fff' : '#1D4ED8' }}>
                          {day}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate dash">{ev.title}</p>
                          {isToday && (
                            <span className="flex-shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 dash">
                              Hoje
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {ev.clients?.name && (
                            <p className="text-xs text-slate-400 truncate dash">{ev.clients.name}</p>
                          )}
                          {ev.clients?.name && ev.event_time && (
                            <span className="text-slate-300 text-xs">·</span>
                          )}
                          {ev.event_time && (
                            <p className="text-xs text-slate-400 dash">{ev.event_time.slice(0, 5)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
