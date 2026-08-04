import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleDotDashed,
  FileSearch,
  Filter,
  HeartPulse,
  GitBranch,
  KeyRound,
  ListTodo,
  TimerOff,
  UserRound,
  UserRoundX,
} from 'lucide-react'
import { getStaffOperations, type RoutineCategory } from '@/lib/staff-operations'
import { formatDate } from '@/lib/utils'
import {
  OPERATIONAL_ACTOR_LABELS,
  OPERATIONAL_PRIORITY_META,
  STAGE_STATUS_LABELS,
  type OperationalActor,
} from '@/lib/process-actions'

const CATEGORY_CONFIG: Record<RoutineCategory, { label: string; icon: typeof AlertTriangle; color: string }> = {
  acao_equipe: { label: 'Ação da equipe', icon: ListTodo, color: 'text-red-700 bg-red-50 border-red-200' },
  aguardando_dependencia: { label: 'Aguardando serviço anterior', icon: GitBranch, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  aguardando_cliente: { label: 'Aguardando cliente', icon: UserRound, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  aguardando_orgao: { label: 'Aguardando órgão', icon: Building2, color: 'text-violet-700 bg-violet-50 border-violet-200' },
  sem_proxima_acao: { label: 'Sem próxima ação', icon: CircleDotDashed, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  etapa_vencida: { label: 'Etapas vencidas', icon: TimerOff, color: 'text-red-700 bg-red-50 border-red-200' },
  prazo_proximo: { label: 'Prazos próximos', icon: CalendarClock, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  documento_analise: { label: 'Documentos para análise', icon: FileSearch, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  sem_responsavel: { label: 'Sem responsável', icon: UserRoundX, color: 'text-violet-700 bg-violet-50 border-violet-200' },
  autenticacao_cliente: { label: 'Autenticação do cliente', icon: KeyRound, color: 'text-orange-700 bg-orange-50 border-orange-200' },
  exigencia_medica: { label: 'Exigências médicas', icon: HeartPulse, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  processo_parado: { label: 'Processos parados', icon: AlertTriangle, color: 'text-slate-700 bg-slate-50 border-slate-200' },
}

export default async function RotinaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: RoutineCategory
    responsavel?: string
    servico?: string
    ator?: OperationalActor
    prazo?: 'vencido' | 'sete_dias' | 'sem_prazo'
  }>
}) {
  const filters = await searchParams
  const { tipo } = filters
  const operations = await getStaffOperations()
  const inSevenDays = new Date(`${operations.today}T12:00:00Z`)
  inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7)
  const sevenDayKey = inSevenDays.toISOString().slice(0, 10)
  const items = operations.routineItems.filter(item => {
    if (tipo && item.category !== tipo) return false
    if (filters.responsavel === 'sem_responsavel' && item.responsibleId) return false
    if (filters.responsavel && filters.responsavel !== 'sem_responsavel' && item.responsibleId !== filters.responsavel) return false
    if (filters.servico && item.serviceSlug !== filters.servico) return false
    if (filters.ator && item.actor !== filters.ator) return false
    if (filters.prazo === 'vencido' && (!item.dueDate || item.dueDate >= operations.today)) return false
    if (filters.prazo === 'sete_dias' && (!item.dueDate || item.dueDate < operations.today || item.dueDate > sevenDayKey)) return false
    if (filters.prazo === 'sem_prazo' && item.dueDate) return false
    return true
  })
  const serviceOptions = [...new Map(
    operations.routineItems
      .filter(item => item.serviceSlug && item.serviceName)
      .map(item => [item.serviceSlug!, item.serviceName!]),
  ).entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'))
  const hasFilters = Boolean(
    tipo || filters.responsavel || filters.servico || filters.ator || filters.prazo,
  )

  const summaryCategories: RoutineCategory[] = [
    'acao_equipe',
    'etapa_vencida',
    'aguardando_dependencia',
    'aguardando_cliente',
    'aguardando_orgao',
  ]

  return (
    <div className="space-y-5">
      <section className="eleva-gradient-deep relative overflow-hidden rounded-2xl p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <ListTodo className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="dash text-xs font-semibold uppercase tracking-[0.16em] text-accent">Prioridades do dia</p>
            <h1 className="dash mt-1 text-3xl font-bold text-white">Minha rotina</h1>
            <p className="dash mt-1 text-sm text-white/60">
              {operations.profile.role === 'analista' ? 'Somente processos sob sua responsabilidade' : 'Pendências de toda a operação'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo da fila">
        {summaryCategories.map(key => {
          const config = CATEGORY_CONFIG[key]
          const count = operations.routineItems.filter(item => item.category === key).length
          const Icon = config.icon
          return (
            <Link
              key={key}
              href={tipo === key ? '/rotina' : `/rotina?tipo=${key}`}
              className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${config.color} ${tipo === key ? 'ring-2 ring-current/20' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-5 w-5" />
                <span className="dash text-2xl font-bold">{count}</span>
              </div>
              <p className="dash mt-3 text-xs font-semibold">{config.label}</p>
            </Link>
          )
        })}
      </section>

      <section className="eleva-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="dash text-sm font-bold text-foreground">Organizar rotina</h2>
        </div>
        <form method="get" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <select name="tipo" defaultValue={tipo ?? ''} className="dash h-10 rounded-xl border border-input bg-card px-3 text-xs text-foreground">
            <option value="">Todas as situações</option>
            {(Object.entries(CATEGORY_CONFIG) as Array<[RoutineCategory, (typeof CATEGORY_CONFIG)[RoutineCategory]]>).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select name="responsavel" defaultValue={filters.responsavel ?? ''} className="dash h-10 rounded-xl border border-input bg-card px-3 text-xs text-foreground">
            <option value="">Todos os responsáveis</option>
            <option value="sem_responsavel">Sem responsável</option>
            {operations.workload.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
          <select name="servico" defaultValue={filters.servico ?? ''} className="dash h-10 rounded-xl border border-input bg-card px-3 text-xs text-foreground">
            <option value="">Todos os serviços</option>
            {serviceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="ator" defaultValue={filters.ator ?? ''} className="dash h-10 rounded-xl border border-input bg-card px-3 text-xs text-foreground">
            <option value="">Quem deve agir</option>
            {(Object.entries(OPERATIONAL_ACTOR_LABELS) as Array<[OperationalActor, string]>).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select name="prazo" defaultValue={filters.prazo ?? ''} className="dash h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-xs text-foreground">
              <option value="">Todos os prazos</option>
              <option value="vencido">Vencidos</option>
              <option value="sete_dias">Próximos 7 dias</option>
              <option value="sem_prazo">Sem prazo</option>
            </select>
            <button className="dash h-10 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground">Aplicar</button>
          </div>
        </form>
        {hasFilters && <Link href="/rotina" className="dash mt-3 inline-flex text-xs font-semibold text-primary hover:underline">Limpar todos os filtros</Link>}
      </section>

      <section className="eleva-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="dash font-bold text-foreground">Fila priorizada</h2>
            <p className="dash mt-0.5 text-xs text-muted-foreground">Vencidos primeiro, depois riscos e acompanhamentos</p>
          </div>
          <span className="dash rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{items.length} item(ns)</span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ListTodo className="h-5 w-5" />
            </div>
            <p className="dash text-sm font-semibold text-foreground">Nenhuma pendência nesta fila</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(item => {
              const config = CATEGORY_CONFIG[item.category]
              const Icon = config.icon
              return (
                <Link key={item.id} href={item.href} className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${config.color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="dash font-semibold text-foreground">{item.title}</p>
                      {item.severity === 'critical' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Crítico</span>}
                      {item.priority && (
                        <span className={`dash rounded-full border px-2 py-0.5 text-[10px] font-bold ${OPERATIONAL_PRIORITY_META[item.priority].className}`}>
                          {OPERATIONAL_PRIORITY_META[item.priority].label}
                        </span>
                      )}
                    </div>
                    <p className="dash mt-0.5 text-xs text-muted-foreground">{item.clientName} · {item.serviceName ?? item.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.stageName && <span className="dash rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-foreground">Etapa: {item.stageName}</span>}
                      {item.stageStatus && <span className="dash rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">{STAGE_STATUS_LABELS[item.stageStatus] ?? item.stageStatus}</span>}
                      {item.actor && <span className="dash rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">Ação: {OPERATIONAL_ACTOR_LABELS[item.actor]}</span>}
                    </div>
                    {item.blocker && <p className="dash mt-2 text-[11px] font-semibold text-red-700">Motivo: {item.blocker}</p>}
                    {(item.reasons?.length ?? 0) > 1 && (
                      <details className="mt-2">
                        <summary className="dash cursor-pointer text-[10px] font-semibold text-muted-foreground">Ver {item.reasons!.length} sinais consolidados</summary>
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] text-muted-foreground">
                          {item.reasons!.map(reason => <li key={reason}>{reason}</li>)}
                        </ul>
                      </details>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{item.responsibleName ? `Responsável: ${item.responsibleName}` : 'Sem responsável'}</span>
                      {item.dueDate && <span>Prazo: {formatDate(item.dueDate)}</span>}
                    </div>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
