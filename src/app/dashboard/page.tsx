import { createClient } from '@/lib/supabase/server'
import {
  Users, FolderOpen, FileText, Calendar,
  CheckCircle2, Clock, AlertCircle, TrendingUp
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDateTime, formatDate, PROCESS_STATUS_LABELS } from '@/lib/utils'
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
      .limit(5),
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

  const statusCards = [
    { key: 'aberto', label: 'Abertos', color: 'text-blue-600 bg-blue-50', icon: FolderOpen },
    { key: 'em_andamento', label: 'Em Andamento', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
    { key: 'aguardando_documentos', label: 'Aguard. Doc.', color: 'text-orange-600 bg-orange-50', icon: AlertCircle },
    { key: 'concluido', label: 'Concluídos', color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Visão geral do sistema</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.totalClients}</p>
            <p className="text-sm text-slate-500">Clientes</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.totalProcesses}</p>
            <p className="text-sm text-slate-500">Processos</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.pendingDocs}</p>
            <p className="text-sm text-slate-500">Docs Pendentes</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.statusCounts['concluido'] ?? 0}</p>
            <p className="text-sm text-slate-500">Concluídos</p>
          </div>
        </Card>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statusCards.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.key} padding="sm">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{stats.statusCounts[s.key] ?? 0}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent processes */}
        <Card padding="none">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Processos Recentes</h2>
            <Link href="/processos" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recentProcesses.length === 0 ? (
              <p className="p-5 text-sm text-slate-400 text-center">Nenhum processo cadastrado</p>
            ) : (
              stats.recentProcesses.map((p: any) => (
                <Link key={p.id} href={`/processos/${p.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {p.clients?.name}
                    </p>
                    <p className="text-xs text-slate-500">{p.process_types?.name}</p>
                  </div>
                  <ProcessStatusBadge status={p.status} />
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Upcoming events */}
        <Card padding="none">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Próximos Eventos</h2>
            <Link href="/calendario" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.upcomingEvents.length === 0 ? (
              <p className="p-5 text-sm text-slate-400 text-center">Nenhum evento próximo</p>
            ) : (
              stats.upcomingEvents.map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-3 p-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-medium text-blue-600 uppercase">
                      {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold text-blue-600 leading-none">
                      {new Date(ev.event_date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{ev.title}</p>
                    {ev.clients?.name && (
                      <p className="text-xs text-slate-500">{ev.clients.name}</p>
                    )}
                    {ev.event_time && (
                      <p className="text-xs text-slate-400">{ev.event_time.slice(0, 5)}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
