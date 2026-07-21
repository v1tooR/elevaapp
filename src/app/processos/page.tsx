import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Accessibility, ArrowRight, BadgeDollarSign, Car, CarFront,
  CheckCircle2, Clock, FileBadge2, FolderKanban, FolderOpen,
  IdCard, Layers3, Plus, ReceiptText, RotateCcw, Stethoscope, TrendingUp,
  AlertTriangle, ListChecks,
  type LucideIcon,
} from 'lucide-react'
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

interface ProcessTypeSummary {
  id: string
  name: string
  slug: string
  description: string | null
}

const PROCESS_TYPE_ICONS: Record<string, LucideIcon> = {
  cin: IdCard,
  estacionamento: Accessibility,
  cnh_especial: CarFront,
  processo_ipi: ReceiptText,
  processo_iof: ReceiptText,
  processo_icms: FileBadge2,
  processo_ipva: BadgeDollarSign,
  imposto_de_renda: BadgeDollarSign,
  laudo: Stethoscope,
  emplacamento: Car,
  rodizio: RotateCcw,
}

const TYPE_ACCENTS = [
  { color: '#A14F2A', soft: 'rgba(161,79,42,0.10)' },
  { color: '#6B3019', soft: 'rgba(107,48,25,0.09)' },
  { color: '#C97A52', soft: 'rgba(201,122,82,0.12)' },
  { color: '#425438', soft: 'rgba(66,84,56,0.10)' },
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
    supabase.from('process_types').select('id, name, slug, description').eq('is_active', true).neq('slug', 'resumo').order('name'),
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

  // Per-type counts for the active operation
  const typeCountMap: Record<string, number> = {}
  for (const p of procs) {
    if ([...ACTIVE_STATUSES, ...WAITING_STATUSES].includes(p.status)) {
      typeCountMap[p.process_type_id] = (typeCountMap[p.process_type_id] ?? 0) + 1
    }
  }

  const processTypeList = (processTypes ?? []) as ProcessTypeSummary[]
  const portfolioCount = Object.values(typeCountMap).reduce((total, count) => total + count, 0)

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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
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

          <div className="relative flex items-center justify-between gap-4 p-6 lg:p-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <FolderOpen className="w-6 h-6 text-primary-foreground/75" />
              </div>
              <div>
                <h1 className="dash text-white text-2xl lg:text-3xl font-bold leading-tight">Processos</h1>
                <p className="dash text-primary-foreground/65 text-sm mt-0.5">
                  {procs.length} processo{procs.length !== 1 ? 's' : ''} no total
                  {processTypes ? ` · ${processTypes.length} tipo${processTypes.length !== 1 ? 's' : ''} ativo${processTypes.length !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href="/processos/ipva-operacao"
                className="dash flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/20"
              >
                <ListChecks className="h-4 w-4" /> Operação IPVA
              </Link>
              <Link
                href="/processos/novo"
                className="dash flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/20"
              >
                <Plus className="w-4 h-4" />
                Novo Processo
              </Link>
            </div>
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
        {processTypeList.length > 0 && (
          <section
            className="anim anim-3 relative overflow-hidden rounded-3xl border border-border bg-card"
            style={{ boxShadow: '0 10px 35px rgba(107,48,25,0.06)' }}
          >
            <div
              className="relative flex flex-col gap-5 border-b border-border px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-7"
              style={{ background: 'linear-gradient(135deg, #FFFDFC 0%, #F8F1EB 100%)' }}
            >
              <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-primary/5" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(161,79,42,0.22)]">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="dash mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    Central de serviços
                  </p>
                  <h2 className="dash text-xl font-bold text-foreground">Carteiras de processos</h2>
                  <p className="dash mt-1 max-w-xl text-sm text-muted-foreground">
                    Acompanhe cada frente de atendimento ou inicie uma nova solicitação.
                  </p>
                </div>
              </div>

              <div className="relative flex items-center gap-2 self-start sm:self-auto">
                <div className="rounded-xl border border-border bg-card/80 px-3.5 py-2 text-right backdrop-blur-sm">
                  <p className="dash text-base font-bold leading-none text-foreground">{portfolioCount}</p>
                  <p className="dash mt-1 text-[10px] text-muted-foreground">
                    em andamento
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/80 px-3.5 py-2 text-right backdrop-blur-sm">
                  <p className="dash text-base font-bold leading-none text-foreground">{processTypeList.length}</p>
                  <p className="dash mt-1 text-[10px] text-muted-foreground">
                    carteiras
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5 xl:grid-cols-4">
              {processTypeList.map((type, index) => {
                const count = typeCountMap[type.id] ?? 0
                const Icon = PROCESS_TYPE_ICONS[type.slug] ?? FolderKanban
                const accent = TYPE_ACCENTS[index % TYPE_ACCENTS.length]
                const description = type.description ?? 'Atendimento e acompanhamento especializado.'
                return (
                  <article
                    key={type.id}
                    className="group relative flex min-h-52 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_rgba(107,48,25,0.10)]"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-0.5 opacity-70 transition-all group-hover:h-1 group-hover:opacity-100"
                      style={{ backgroundColor: accent.color }}
                    />
                    <span className="font-display pointer-events-none absolute -right-1 top-2 text-7xl font-black leading-none text-foreground/[0.035]">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <Link
                      href={`/processos/tipo/${type.slug}`}
                      className="relative flex flex-1 flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
                          style={{ backgroundColor: accent.soft, color: accent.color }}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.8} />
                        </div>
                        <span className={`dash rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          count > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {count > 0 ? `${count} ativo${count !== 1 ? 's' : ''}` : 'Disponível'}
                        </span>
                      </div>

                      <div className="relative mt-auto">
                        <h3 className="dash text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                          {type.name}
                        </h3>
                        <p className="dash mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </Link>

                    <div className="relative flex items-center gap-2 border-t border-border bg-muted/35 p-3">
                      <Link
                        href={`/processos/tipo/${type.slug}`}
                        className="dash flex flex-1 items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                      >
                        Abrir carteira <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/processos/novo?type_id=${type.id}`}
                        className="dash flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
                      >
                        <Plus className="h-3.5 w-3.5" /> Novo
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* Estado vazio */}
        {processTypeList.length === 0 && (
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
