import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  FileSearch,
  HeartPulse,
  KeyRound,
  ListTodo,
  TimerOff,
  UserRoundX,
} from 'lucide-react'
import { getStaffOperations, type RoutineCategory } from '@/lib/staff-operations'
import { formatDate } from '@/lib/utils'

const CATEGORY_CONFIG: Record<RoutineCategory, { label: string; icon: typeof AlertTriangle; color: string }> = {
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
  searchParams: Promise<{ tipo?: RoutineCategory }>
}) {
  const { tipo } = await searchParams
  const operations = await getStaffOperations()
  const items = tipo
    ? operations.routineItems.filter(item => item.category === tipo)
    : operations.routineItems

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da fila">
        {(Object.entries(CATEGORY_CONFIG) as Array<[RoutineCategory, (typeof CATEGORY_CONFIG)[RoutineCategory]]>).map(([key, config]) => {
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

      <section className="eleva-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="dash font-bold text-foreground">Fila priorizada</h2>
            <p className="dash mt-0.5 text-xs text-muted-foreground">Vencidos primeiro, depois riscos e acompanhamentos</p>
          </div>
          {tipo && <Link href="/rotina" className="dash text-xs font-semibold text-primary">Limpar filtro</Link>}
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
                    </div>
                    <p className="dash mt-0.5 text-xs text-muted-foreground">{item.clientName} · {item.detail}</p>
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
