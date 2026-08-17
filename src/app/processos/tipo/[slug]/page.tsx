import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FolderOpen,
  LayoutList,
  Plus,
  Search,
} from 'lucide-react'
import { KanbanBoard } from '@/components/processos/kanban-board'
import { ProcessPhaseBadge } from '@/components/shared/status-badge'
import {
  getPhaseFromSituation,
  PROCESS_PHASE_FILTERS,
  PROCESS_PHASE_LABELS,
} from '@/lib/process-pipeline'
import {
  deriveProcessAction,
  OPERATIONAL_ACTION_CATALOG,
  OPERATIONAL_ACTOR_LABELS,
  OPERATIONAL_PRIORITY_META,
  OPERATIONAL_SITUATION_CATALOG,
  STAGE_STATUS_LABELS,
} from '@/lib/process-actions'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCPF, formatDate, formatPhone } from '@/lib/utils'
import type { ProcessStatus } from '@/types/database'

interface SearchParams {
  fase?: string
  situacao?: string
  etapa?: string
  acao?: string
  responsavel?: string
  de?: string
  ate?: string
  q?: string
  page?: string
  view?: string
}

interface ProcessRow {
  id: string
  status: ProcessStatus
  protocol: string | null
  created_at: string
  clients: { id: string; name: string } | null
}

interface WalletRow {
  process_id: string
  client_id: string
  client_name: string
  client_cpf: string | null
  client_phone: string | null
  protocol: string | null
  process_status: ProcessStatus
  next_action: string | null
  action_owner: string | null
  action_due_date: string | null
  blocked_reason: string | null
  process_observations: string | null
  stage_key: string | null
  stage_label: string | null
  stage_status: string | null
  scheduled_date: string | null
  stage_notes: string | null
  stage_data: Record<string, unknown> | null
  last_updated_at: string
  action_category: string
  operational_priority_rank: number
  operational_situation: string
  responsible_user_id: string | null
  responsible_name: string | null
}

interface WalletFilterOption {
  stage_key: string | null
  stage_label: string | null
}

const PHASE_FILTER_BY_KEY = new Map(PROCESS_PHASE_FILTERS.map(filter => [filter.phase as string, filter]))

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

export default async function ProcessosPorTipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { slug } = await params
  if (slug === 'resumo') notFound()

  const sp = await searchParams
  const phaseFilter = PHASE_FILTER_BY_KEY.has(sp.fase ?? '') ? sp.fase ?? '' : ''
  const phaseFilterConfig = phaseFilter ? PHASE_FILTER_BY_KEY.get(phaseFilter) : undefined
  const situationFilter = sp.situacao ?? ''
  const stageFilter = sp.etapa ?? ''
  const actionFilter = sp.acao ?? ''
  const responsibleFilter = sp.responsavel ?? ''
  const fromFilter = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? '') ? sp.de ?? '' : ''
  const toFilter = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? '') ? sp.ate ?? '' : ''
  const search = sp.q?.trim() ?? ''
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const view = sp.view === 'kanban' ? 'kanban' : 'lista'
  const perPage = 25
  const supabase = await createClient()

  const { data: processType } = await supabase
    .from('process_types')
    .select('id, name, slug, color, accepts_new_processes')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!processType) notFound()

  let kanbanProcesses: ProcessRow[] = []
  let walletRows: WalletRow[] = []
  let stageOptions: WalletFilterOption[] = []
  let responsibleOptions: { id: string; name: string }[] = []
  let count = 0

  if (view === 'kanban') {
    const { data } = await supabase
      .from('processes')
      .select('id, status, protocol, created_at, clients(id, name)')
      .eq('process_type_id', processType.id)
      .not('status', 'in', '(arquivado,cancelado)')
      .order('updated_at', { ascending: false })
      .limit(200)
    kanbanProcesses = (data ?? []) as unknown as ProcessRow[]
    count = kanbanProcesses.length
  } else {
    let query = supabase
      .from('process_wallet_rows')
      .select('*', { count: 'exact' })
      .eq('process_type_id', processType.id)
      .order('operational_priority_rank', { ascending: true })
      .order('action_due_date', { ascending: true, nullsFirst: false })
      .order('last_updated_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (phaseFilterConfig?.statuses) query = query.in('process_status', phaseFilterConfig.statuses)
    if (phaseFilterConfig?.situation) query = query.eq('operational_situation', phaseFilterConfig.situation)
    if (situationFilter) query = query.eq('operational_situation', situationFilter)
    if (stageFilter) query = query.eq('stage_key', stageFilter)
    if (actionFilter) query = query.eq('action_category', actionFilter)
    if (responsibleFilter) query = query.eq('responsible_user_id', responsibleFilter)
    if (fromFilter) query = query.gte('last_updated_at', `${fromFilter}T00:00:00`)
    if (toFilter) query = query.lte('last_updated_at', `${toFilter}T23:59:59`)
    if (search) query = query.ilike('search_text', `%${search}%`)

    const [walletResult, stageResult, responsibleResult] = await Promise.all([
      query,
      supabase
        .from('process_wallet_rows')
        .select('stage_key, stage_label')
        .eq('process_type_id', processType.id)
        .not('stage_key', 'is', null)
        .order('stage_label')
        .limit(1000),
      supabase
        .from('profiles')
        .select('id, name')
        .in('role', ['super_admin', 'admin', 'analista'])
        .eq('is_active', true)
        .order('name'),
    ])
    const { data, count: total, error } = walletResult
    if (error) throw new Error(`Não foi possível carregar a carteira operacional: ${error.message}`)
    walletRows = (data ?? []) as WalletRow[]
    const stagesByKey = new Map<string, WalletFilterOption>()
    for (const option of (stageResult.data ?? []) as WalletFilterOption[]) {
      if (option.stage_key && !stagesByKey.has(option.stage_key)) stagesByKey.set(option.stage_key, option)
    }
    stageOptions = [...stagesByKey.values()]
    responsibleOptions = responsibleResult.data ?? []
    count = total ?? 0
  }

  const color = processType.color ?? '#A14F2A'
  const canCreate = processType.accepts_new_processes !== false
  const totalPages = Math.max(1, Math.ceil(count / perPage))
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

  const makeUrl = (overrides: Record<string, string | null>) => {
    const values: Record<string, string> = {
      ...(search ? { q: search } : {}),
      ...(phaseFilter ? { fase: phaseFilter } : {}),
      ...(situationFilter ? { situacao: situationFilter } : {}),
      ...(stageFilter ? { etapa: stageFilter } : {}),
      ...(actionFilter ? { acao: actionFilter } : {}),
      ...(responsibleFilter ? { responsavel: responsibleFilter } : {}),
      ...(fromFilter ? { de: fromFilter } : {}),
      ...(toFilter ? { ate: toFilter } : {}),
      ...(view === 'kanban' ? { view } : {}),
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value) values[key] = value
      else delete values[key]
    }
    const query = new URLSearchParams(values).toString()
    return `/processos/tipo/${slug}${query ? `?${query}` : ''}`
  }

  return (
    <div className="space-y-5">
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white lg:p-8"
        style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
      >
        <Link href="/processos" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Todos os processos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20" style={{ backgroundColor: `${color}35` }}>
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
            </span>
            <div>
              <h1 className="text-2xl font-bold lg:text-3xl">{processType.name}</h1>
              <p className="mt-0.5 text-sm text-white/65">{count} processo{count === 1 ? '' : 's'} na carteira</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-white/10 p-1">
              <Link href={makeUrl({ view: null, page: null })} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold', view === 'lista' ? 'bg-white text-slate-800' : 'text-white/70')}>
                <LayoutList className="h-3.5 w-3.5" /> Lista
              </Link>
              <Link href={makeUrl({ view: 'kanban', page: null })} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold', view === 'kanban' ? 'bg-white text-slate-800' : 'text-white/70')}>
                <Columns3 className="h-3.5 w-3.5" /> Kanban
              </Link>
            </div>
            {canCreate && (
              <Link href={`/processos/novo?type_id=${processType.id}`} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
                <Plus className="h-4 w-4" /> Novo
              </Link>
            )}
          </div>
        </div>
      </section>

      {view === 'kanban' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <KanbanBoard initialProcesses={kanbanProcesses} />
        </section>
      ) : (
        <>
          <form method="get" className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={search} placeholder="Cliente, CPF, telefone ou protocolo" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-amber-500 focus:bg-white" />
            </label>
            <select name="situacao" defaultValue={situationFilter} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-500">
              <option value="">Todas as situações</option>
              {Object.entries(OPERATIONAL_SITUATION_CATALOG).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="etapa" defaultValue={stageFilter} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-500">
              <option value="">Todas as etapas</option>
              {stageOptions.map(option => <option key={option.stage_key} value={option.stage_key ?? ''}>{option.stage_label}</option>)}
            </select>
            <select name="acao" defaultValue={actionFilter} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-500">
              <option value="">Todas as próximas ações</option>
              {Object.entries(OPERATIONAL_ACTION_CATALOG).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="responsavel" defaultValue={responsibleFilter} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-500">
              <option value="">Todos os responsáveis</option>
              {responsibleOptions.map(responsible => <option key={responsible.id} value={responsible.id}>{responsible.name}</option>)}
            </select>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Atualizado de<input type="date" name="de" defaultValue={fromFilter} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-700" /></label>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Atualizado até<input type="date" name="ate" defaultValue={toFilter} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-700" /></label>
            <div className="flex gap-2 md:items-end">
              <button className="h-10 flex-1 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800">Consultar</button>
              <Link href={`/processos/tipo/${slug}`} className="flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600">Limpar</Link>
            </div>
            {phaseFilter && <input type="hidden" name="fase" value={phaseFilter} />}
          </form>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fase</span>
            <Link href={makeUrl({ fase: null, page: null })} className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', !phaseFilter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600')}>Todos</Link>
            {PROCESS_PHASE_FILTERS.map(filter => (
              <Link key={filter.phase} href={makeUrl({ fase: filter.phase, page: null })} className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold', phaseFilter === filter.phase ? 'border-amber-700 bg-amber-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                {PROCESS_PHASE_LABELS[filter.phase]}
              </Link>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {walletRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <FolderOpen className="h-8 w-8 text-slate-300" />
                <div><p className="font-semibold text-slate-700">Nenhum processo encontrado</p><p className="mt-1 text-sm text-slate-400">Ajuste os filtros ou inicie um novo atendimento.</p></div>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1180px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Etapa</th>
                        <th className="px-4 py-3">Situação</th>
                        <th className="px-4 py-3">Próxima ação</th>
                        <th className="px-4 py-3">Observações</th>
                        <th className="px-4 py-3">Última atualização</th>
                        <th className="w-12 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {walletRows.map(row => {
                        const action = deriveProcessAction({
                          processStatus: row.process_status,
                          nextAction: row.next_action,
                          actionOwner: row.action_owner,
                          actionDueDate: row.action_due_date,
                          blockedReason: row.blocked_reason,
                          currentStage: row.stage_label ? {
                            label: row.stage_label,
                            status: row.stage_status ?? 'pendente',
                            scheduled_date: row.scheduled_date,
                            due_date: stringValue(row.stage_data?.due_date),
                          } : null,
                          today,
                        })
                        const observation = row.stage_notes || row.blocked_reason || row.process_observations
                        return (
                          <tr key={row.process_id} className="align-top hover:bg-slate-50/70">
                            <td className="px-4 py-4">
                              <Link href={`/clientes/${row.client_id}`} className="font-semibold text-slate-900 hover:text-amber-700">{row.client_name}</Link>
                              <p className="mt-1 text-xs text-slate-400">{row.client_cpf ? formatCPF(row.client_cpf) : 'CPF não informado'}{row.client_phone ? ` · ${formatPhone(row.client_phone)}` : ''}</p>
                            </td>
                            <td className="px-4 py-4"><p className="font-medium text-slate-800">{row.stage_label ?? 'Etapas não iniciadas'}</p>{row.protocol && <p className="mt-1 font-mono text-[11px] text-slate-400">{row.protocol}</p>}</td>
                            <td className="space-y-1.5 px-4 py-4"><ProcessPhaseBadge phase={getPhaseFromSituation(row.process_status, row.operational_situation, row.blocked_reason)} /><p className="text-xs text-slate-500">{OPERATIONAL_SITUATION_CATALOG[row.operational_situation as keyof typeof OPERATIONAL_SITUATION_CATALOG] ?? STAGE_STATUS_LABELS[row.stage_status ?? ''] ?? row.stage_status}</p></td>
                            <td className="px-4 py-4">
                              <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold', OPERATIONAL_PRIORITY_META[action.priority].className)}>{OPERATIONAL_PRIORITY_META[action.priority].label}</span>
                              <p className="mt-1.5 max-w-56 font-medium text-slate-800">{action.nextAction}</p>
                              <p className="mt-1 text-xs text-slate-400">{OPERATIONAL_ACTOR_LABELS[action.actor]}{action.dueDate ? ` · ${formatDate(action.dueDate)}` : ''}</p>
                            </td>
                            <td className="px-4 py-4"><p className="max-w-72 line-clamp-3 text-xs leading-relaxed text-slate-600">{observation || 'Sem observações'}</p></td>
                            <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{formatDateTime(row.last_updated_at)}</td>
                            <td className="px-4 py-4"><Link href={`/processos/${row.process_id}`} aria-label={`Abrir processo de ${row.client_name}`} className="text-amber-700 hover:text-amber-900"><ArrowUpRight className="h-4 w-4" /></Link></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 lg:hidden">
                  {walletRows.map(row => {
                    const action = deriveProcessAction({
                      processStatus: row.process_status,
                      nextAction: row.next_action,
                      actionOwner: row.action_owner,
                      actionDueDate: row.action_due_date,
                      blockedReason: row.blocked_reason,
                      currentStage: row.stage_label ? { label: row.stage_label, status: row.stage_status ?? 'pendente', scheduled_date: row.scheduled_date } : null,
                      today,
                    })
                    return (
                      <article key={row.process_id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3"><div><Link href={`/clientes/${row.client_id}`} className="font-semibold text-slate-900">{row.client_name}</Link><p className="mt-1 text-xs text-slate-400">{row.client_cpf ? formatCPF(row.client_cpf) : 'CPF não informado'}{row.client_phone ? ` · ${formatPhone(row.client_phone)}` : ''}</p></div><ProcessPhaseBadge phase={getPhaseFromSituation(row.process_status, row.operational_situation, row.blocked_reason)} /></div>
                        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><span className="text-slate-400">Etapa</span><p className="mt-1 font-semibold text-slate-700">{row.stage_label ?? 'Não iniciada'}</p></div><div><span className="text-slate-400">Situação</span><p className="mt-1 font-semibold text-slate-700">{OPERATIONAL_SITUATION_CATALOG[row.operational_situation as keyof typeof OPERATIONAL_SITUATION_CATALOG] ?? STAGE_STATUS_LABELS[row.stage_status ?? ''] ?? 'Aguardando'}</p></div></div>
                        <div><span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold', OPERATIONAL_PRIORITY_META[action.priority].className)}>{OPERATIONAL_PRIORITY_META[action.priority].label}</span><p className="mt-1.5 text-sm font-medium text-slate-800">{action.nextAction}</p></div>
                        {(row.stage_notes || row.blocked_reason || row.process_observations) && <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{row.stage_notes || row.blocked_reason || row.process_observations}</p>}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400"><span>Atualizado {formatDateTime(row.last_updated_at)}</span><Link href={`/processos/${row.process_id}`} className="inline-flex items-center gap-1 font-semibold text-amber-700">Abrir <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2">
              <Link aria-disabled={page <= 1} href={page <= 1 ? makeUrl({ page: '1' }) : makeUrl({ page: String(page - 1) })} className={cn('flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium', page <= 1 ? 'pointer-events-none border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white text-slate-700')}><ChevronLeft className="h-4 w-4" /> Anterior</Link>
              <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500"><strong className="text-slate-900">{page}</strong> de {totalPages}</span>
              <Link aria-disabled={page >= totalPages} href={page >= totalPages ? makeUrl({ page: String(totalPages) }) : makeUrl({ page: String(page + 1) })} className={cn('flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium', page >= totalPages ? 'pointer-events-none border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white text-slate-700')}>Próxima <ChevronRight className="h-4 w-4" /></Link>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
