import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  FileText,
  FolderOpen,
  Plus,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import type { ProcessStatus } from '@/types/database'

const ACTIVE_STATUSES = [
  'aberto',
  'em_andamento',
  'aguardando_documentos',
  'em_analise',
  'aguardando_orgao',
] as const

const PROCESS_STATUS_CONFIG = [
  { key: 'aberto', label: 'Abertos', bar: 'bg-info' },
  { key: 'em_andamento', label: 'Em andamento', bar: 'bg-warning' },
  { key: 'aguardando_documentos', label: 'Aguardando documentos', bar: 'bg-accent' },
  { key: 'em_analise', label: 'Em análise', bar: 'bg-primary' },
  { key: 'aguardando_orgao', label: 'Aguardando órgão', bar: 'bg-secondary-foreground' },
] as const

const EVENT_TYPE_LABEL: Record<string, string> = {
  normal: 'Compromisso',
  renewal: 'Renovação',
  deadline: 'Prazo',
  reminder: 'Lembrete',
}

interface ProcessSummary {
  id: string
  status: ProcessStatus
  client_id: string
  responsible_user_id: string | null
  created_at: string
  completed_at: string | null
}

interface RecentProcess {
  id: string
  status: ProcessStatus
  clients: { name: string } | null
  process_types: { name: string; color: string | null } | null
}

interface PriorityEvent {
  id: string
  title: string
  event_date: string
  event_time: string | null
  event_type: string
  clients: { name: string } | null
}

function dateKeyInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function clientInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const now = new Date()
  const today = dateKeyInSaoPaulo(now)
  const nextSevenDays = addDaysToDateKey(today, 7)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: processRows, error: processesError },
    { count: documentsForReview, error: documentsError },
    { count: openLeads, error: leadsError },
    { count: overdueEvents, error: overdueEventsError },
    { data: priorityEventRows, error: priorityEventsError },
    { data: recentProcessRows, error: recentProcessesError },
  ] = await Promise.all([
    supabase
      .from('processes')
      .select('id, status, client_id, responsible_user_id, created_at, completed_at'),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .in('status', ['received', 'under_review']),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['novo', 'em_atendimento']),
    supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress'])
      .lt('event_date', today),
    supabase
      .from('calendar_events')
      .select('id, title, event_date, event_time, event_type, clients(name)')
      .in('status', ['pending', 'in_progress'])
      .lte('event_date', nextSevenDays)
      .order('event_date', { ascending: true })
      .limit(6),
    supabase
      .from('processes')
      .select('id, status, clients(name), process_types(name, color)')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const queryError = [
    processesError,
    documentsError,
    leadsError,
    overdueEventsError,
    priorityEventsError,
    recentProcessesError,
  ].find(Boolean)

  if (queryError) throw queryError

  const processes = (processRows ?? []) as ProcessSummary[]
  const activeProcesses = processes.filter(process => ACTIVE_STATUSES.includes(process.status as typeof ACTIVE_STATUSES[number]))
  const statusCounts = activeProcesses.reduce<Record<string, number>>((counts, process) => {
    counts[process.status] = (counts[process.status] ?? 0) + 1
    return counts
  }, {})

  return {
    today,
    activeProcessCount: activeProcesses.length,
    clientsInService: new Set(activeProcesses.map(process => process.client_id)).size,
    unassignedActiveProcesses: activeProcesses.filter(process => !process.responsible_user_id).length,
    newProcessesLast30Days: processes.filter(process => new Date(process.created_at) >= thirtyDaysAgo).length,
    completedLast30Days: processes.filter(
      process => process.status === 'concluido' && process.completed_at && new Date(process.completed_at) >= thirtyDaysAgo
    ).length,
    documentsForReview: documentsForReview ?? 0,
    openLeads: openLeads ?? 0,
    overdueEvents: overdueEvents ?? 0,
    statusCounts,
    priorityEvents: (priorityEventRows ?? []) as unknown as PriorityEvent[],
    recentProcesses: (recentProcessRows ?? []) as unknown as RecentProcess[],
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const stats = await getDashboardStats(supabase)

  const now = new Date()
  const todayLabel = now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const updatedAt = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })

  const activeStatusRows = PROCESS_STATUS_CONFIG
    .map(status => ({ ...status, count: stats.statusCounts[status.key] ?? 0 }))
    .filter(status => status.count > 0)

  const kpis = [
    {
      label: 'Processos ativos',
      value: stats.activeProcessCount,
      hint: `${stats.clientsInService} cliente${stats.clientsInService !== 1 ? 's' : ''} em atendimento`,
      href: '/processos',
      icon: Activity,
      iconClass: 'bg-primary/10 text-primary',
      borderClass: 'border-primary/20',
    },
    {
      label: 'Compromissos vencidos',
      value: stats.overdueEvents,
      hint: stats.overdueEvents > 0 ? 'exigem reagendamento ou conclusão' : 'agenda operacional em dia',
      href: '/calendario',
      icon: AlertCircle,
      iconClass: stats.overdueEvents > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success-bg text-success',
      borderClass: stats.overdueEvents > 0 ? 'border-destructive/25' : 'border-success/20',
    },
    {
      label: 'Documentos para revisar',
      value: stats.documentsForReview,
      hint: 'recebidos ou em revisão',
      href: '/documentos',
      icon: FileText,
      iconClass: 'bg-info-bg text-info',
      borderClass: 'border-info/20',
    },
    {
      label: 'Leads em aberto',
      value: stats.openLeads,
      hint: 'novos ou em atendimento',
      href: '/leads',
      icon: Target,
      iconClass: 'bg-warning-bg text-warning',
      borderClass: 'border-warning/25',
    },
  ]

  return (
    <div className="space-y-5">
      <section className="anim eleva-gradient-deep relative overflow-hidden rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <div>
            <p className="dash mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              {todayLabel}
            </p>
            <h1 className="dash text-3xl font-bold leading-tight text-primary-foreground lg:text-4xl">
              Painel de Controle
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="dash text-sm text-primary-foreground/65">
                Prioridades operacionais e próximos compromissos
              </p>
              <span className="hidden h-1 w-1 rounded-full bg-primary-foreground/35 sm:block" />
              <p className="dash text-xs text-primary-foreground/45">Atualizado às {updatedAt}</p>
            </div>
          </div>
          <Link
            href="/processos/novo"
            className="dash inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20 sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo processo
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores operacionais">
        {kpis.map(({ label, value, hint, href, icon: Icon, iconClass, borderClass }, index) => (
          <Link
            key={label}
            href={href}
            className={`anim anim-${index + 1} group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${borderClass}`}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="dash text-3xl font-bold text-foreground">{value}</p>
            <p className="dash mt-1 text-sm font-semibold text-foreground">{label}</p>
            <p className="dash mt-1 text-[11px] text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </section>

      <section className="anim anim-5 eleva-surface overflow-hidden" aria-labelledby="operation-title">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="operation-title" className="dash text-base font-bold text-foreground">Distribuição dos processos ativos</h2>
            <p className="dash mt-0.5 text-xs text-muted-foreground">Onde cada processo está na operação</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="p-5 sm:p-6">
            {activeStatusRows.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-success-bg text-success">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="dash text-sm font-semibold text-foreground">Nenhum processo ativo</p>
                <p className="dash mt-1 text-xs text-muted-foreground">A operação não possui processos em andamento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeStatusRows.map(status => {
                  const percentage = Math.round((status.count / stats.activeProcessCount) * 100)
                  return (
                    <div key={status.key}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <p className="dash truncate text-xs font-medium text-foreground">{status.label}</p>
                        <p className="dash shrink-0 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">{status.count}</span> · {percentage}%
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`bar-fill h-full rounded-full ${status.bar}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-muted/35 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="dash mb-4 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
              Ritmo dos últimos 30 dias
            </p>
            <div className="space-y-3">
              {[
                { label: 'Novos processos', value: stats.newProcessesLast30Days, icon: Plus, tone: 'text-primary bg-primary/10' },
                { label: 'Processos concluídos', value: stats.completedLast30Days, icon: CheckCircle2, tone: 'text-success bg-success-bg' },
                { label: 'Ativos sem responsável', value: stats.unassignedActiveProcesses, icon: AlertCircle, tone: 'text-warning bg-warning-bg' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="dash min-w-0 flex-1 text-xs text-muted-foreground">{item.label}</p>
                  <p className="dash text-lg font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="anim anim-5 eleva-surface overflow-hidden" aria-labelledby="recent-processes-title">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 id="recent-processes-title" className="dash font-bold text-foreground">Processos recentes</h2>
              <p className="dash mt-0.5 text-xs text-muted-foreground">Últimas entradas cadastradas</p>
            </div>
            <Link href="/processos" className="view-all dash flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/75">
              Ver todos <ArrowUpRight className="link-arrow h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {stats.recentProcesses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <FolderOpen className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
              </div>
              <p className="dash text-sm text-muted-foreground">Nenhum processo cadastrado</p>
            </div>
          ) : (
            <div>
              {stats.recentProcesses.map(process => {
                const clientName = process.clients?.name ?? 'Cliente não informado'
                return (
                  <Link
                    key={process.id}
                    href={`/processos/${process.id}`}
                    className="process-row flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0 sm:px-6"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                      {clientInitials(clientName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="row-name dash truncate text-sm font-semibold text-foreground transition-colors">{clientName}</p>
                      <p className="dash truncate text-xs text-muted-foreground">{process.process_types?.name ?? 'Processo'}</p>
                    </div>
                    <ProcessStatusBadge status={process.status} />
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section className="anim anim-6 eleva-surface overflow-hidden" aria-labelledby="priority-calendar-title">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 id="priority-calendar-title" className="dash font-bold text-foreground">Agenda prioritária</h2>
              <p className="dash mt-0.5 text-xs text-muted-foreground">Atrasados e próximos 7 dias</p>
            </div>
            <Link href="/calendario" className="view-all dash flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/75">
              Ver agenda <ArrowUpRight className="link-arrow h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {stats.priorityEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-bg text-success">
                <Calendar className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="dash text-sm font-semibold text-foreground">Agenda em dia</p>
                <p className="dash mt-1 text-xs text-muted-foreground">Nenhuma pendência ou compromisso nos próximos 7 dias.</p>
              </div>
            </div>
          ) : (
            <div>
              {stats.priorityEvents.map(event => {
                const isOverdue = event.event_date < stats.today
                const isToday = event.event_date === stats.today
                const eventDate = new Date(`${event.event_date}T12:00:00`)
                const day = eventDate.getDate()
                const month = eventDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
                const urgencyLabel = isOverdue ? 'Atrasado' : isToday ? 'Hoje' : EVENT_TYPE_LABEL[event.event_type] ?? 'Agenda'

                return (
                  <Link
                    key={event.id}
                    href="/calendario"
                    className="flex items-start gap-4 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-muted/40 sm:px-6"
                  >
                    <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${
                      isOverdue ? 'bg-destructive/10 text-destructive' : isToday ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      <span className="dash text-[9px] font-bold uppercase leading-none">{month}</span>
                      <span className="dash mt-0.5 text-sm font-bold leading-tight">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p className="dash truncate text-sm font-semibold text-foreground">{event.title}</p>
                        <span className={`dash shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          isOverdue ? 'bg-destructive/10 text-destructive' : isToday ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {urgencyLabel}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {event.clients?.name && <p className="dash truncate text-xs text-muted-foreground">{event.clients.name}</p>}
                        {event.clients?.name && event.event_time && <span className="text-xs text-border">·</span>}
                        {event.event_time && <p className="dash text-xs text-muted-foreground">{event.event_time.slice(0, 5)}</p>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
