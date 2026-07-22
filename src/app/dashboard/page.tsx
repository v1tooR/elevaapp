import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  HeartPulse,
  ListTodo,
  Plus,
  Target,
  UserRoundX,
  UsersRound,
} from 'lucide-react'
import { getStaffOperations } from '@/lib/staff-operations'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const operations = await getStaffOperations()
  const { profile, metrics } = operations
  const isSuperAdmin = profile.role === 'super_admin'
  const isAdmin = profile.role === 'admin'
  const roleTitle = isSuperAdmin
    ? 'Visão da equipe'
    : isAdmin
      ? 'Operação e distribuição'
      : 'Minhas prioridades'
  const roleDescription = isSuperAdmin
    ? 'Capacidade, riscos e entregas de toda a equipe.'
    : isAdmin
      ? 'Distribua a operação e elimine gargalos.'
      : 'Somente seus processos e ações que exigem atenção.'

  const kpis = isSuperAdmin
    ? [
        { label: 'Processos ativos', value: metrics.activeProcesses, hint: `${metrics.clientsInService} clientes em atendimento`, href: '/processos/lista', icon: Activity, tone: 'text-primary bg-primary/10 border-primary/20' },
        { label: 'Pendências críticas', value: metrics.overdue, hint: 'etapas ou prazos vencidos', href: '/rotina', icon: AlertTriangle, tone: 'text-red-700 bg-red-50 border-red-200' },
        { label: 'Documentos para revisar', value: metrics.documentsForReview, hint: 'recebidos ou em análise', href: '/documentos?status=received', icon: FileSearch, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
        { label: 'Concluídos em 30 dias', value: metrics.completedLast30Days, hint: 'ritmo de entrega da equipe', href: '/processos/lista?status=concluido', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      ]
    : isAdmin
      ? [
          { label: 'Sem responsável', value: metrics.unassigned, hint: 'precisam ser distribuídos', href: '/processos/lista?pendencia=sem_responsavel', icon: UserRoundX, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
          { label: 'Prazos críticos', value: metrics.overdue, hint: 'vencidos e exigindo ação', href: '/rotina', icon: AlertTriangle, tone: 'text-red-700 bg-red-50 border-red-200' },
          { label: 'Documentos para revisar', value: metrics.documentsForReview, hint: 'fila documental da operação', href: '/documentos', icon: FileSearch, tone: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Leads em aberto', value: metrics.openLeads, hint: 'novos ou em atendimento', href: '/leads', icon: Target, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
        ]
      : [
          { label: 'Meus processos ativos', value: metrics.activeProcesses, hint: `${metrics.clientsInService} clientes sob sua responsabilidade`, href: '/processos/lista', icon: Activity, tone: 'text-primary bg-primary/10 border-primary/20' },
          { label: 'Vencidos', value: metrics.overdue, hint: 'ações que precisam ser resolvidas hoje', href: '/rotina', icon: AlertTriangle, tone: 'text-red-700 bg-red-50 border-red-200' },
          { label: 'Próximos 7 dias', value: metrics.dueSoon, hint: 'prazos e compromissos', href: '/rotina?tipo=prazo_proximo', icon: Clock3, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'Exigências médicas', value: metrics.medicalRequirements, hint: 'acompanhamentos em aberto', href: '/rotina?tipo=exigencia_medica', icon: HeartPulse, tone: 'text-rose-700 bg-rose-50 border-rose-200' },
        ]

  const maxWorkload = Math.max(1, ...operations.workload.map(item => item.activeProcesses))
  const priorityItems = operations.routineItems.slice(0, 7)

  return (
    <div className="space-y-5">
      <section className="eleva-gradient-deep relative overflow-hidden rounded-2xl p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="dash text-xs font-semibold uppercase tracking-[0.16em] text-accent">{roleTitle}</p>
            <h1 className="dash mt-1 text-3xl font-bold text-white">Painel de Controle</h1>
            <p className="dash mt-2 text-sm text-white/60">{roleDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rotina" className="dash inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">
              <ListTodo className="h-4 w-4" /> Minha rotina
            </Link>
            <Link href="/processos/novo" className="dash inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-white/90">
              <Plus className="h-4 w-4" /> Novo processo
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Indicadores para ${roleTitle}`}>
        {kpis.map(({ label, value, hint, href, icon: Icon, tone }) => (
          <Link key={label} href={href} className={`group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tone.split(' ').at(-1)}`}>
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.split(' ').slice(0, 2).join(' ')}`}>
                <Icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <p className="dash mt-4 text-3xl font-bold text-foreground">{value}</p>
            <p className="dash mt-1 text-sm font-semibold text-foreground">{label}</p>
            <p className="dash mt-1 text-[11px] text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </section>

      <div className={`grid gap-5 ${profile.role === 'analista' ? '' : 'lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]'}`}>
        {profile.role !== 'analista' && (
          <section className="eleva-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="dash font-bold text-foreground">Distribuição da equipe</h2>
                <p className="dash mt-0.5 text-xs text-muted-foreground">Processos ativos e itens urgentes por responsável</p>
              </div>
              <UsersRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-4 p-5">
              {operations.workload.map(member => (
                <div key={member.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="dash font-semibold text-foreground">{member.name}</span>
                    <span className="dash text-muted-foreground">{member.activeProcesses} ativos · {member.urgentItems} urgentes</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (member.activeProcesses / maxWorkload) * 100)}%` }} />
                  </div>
                </div>
              ))}
              {operations.workload.length === 0 && <p className="dash py-8 text-center text-sm text-muted-foreground">Nenhum funcionário ativo.</p>}
            </div>
          </section>
        )}

        <section className="eleva-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="dash font-bold text-foreground">Próximas ações</h2>
              <p className="dash mt-0.5 text-xs text-muted-foreground">Fila ordenada por risco e prazo</p>
            </div>
            <Link href="/rotina" className="dash text-xs font-semibold text-primary">Ver fila completa</Link>
          </div>
          {priorityItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="dash text-sm font-semibold text-foreground">Rotina em dia</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {priorityItems.map(item => (
                <Link key={item.id} href={item.href} className="group flex items-start gap-3 px-5 py-3.5 hover:bg-muted/40">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.severity === 'critical' ? 'bg-red-500' : item.severity === 'high' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="dash truncate text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="dash mt-0.5 truncate text-xs text-muted-foreground">{item.clientName}{item.dueDate ? ` · ${formatDate(item.dueDate)}` : ''}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
