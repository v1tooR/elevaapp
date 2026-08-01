import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Renovações - Eleva Isenções' }

interface RenewalRow {
  id: string
  title: string
  event_date: string
  status: string
  description: string | null
  client_id: string | null
  process_id: string | null
  clients: { id: string; name: string; cpf: string | null } | null
  processes: {
    id: string
    process_types: { name: string; slug: string } | null
  } | null
}

interface SearchParams {
  q?: string
  from?: string
  to?: string
  status?: string
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  in_progress: { label: 'Em andamento', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  completed: { label: 'Concluída', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
}

function normalize(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function localDateOnly(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

function formatDateOnly(value: string) {
  return parseDateOnly(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function resultLabel(count: number) {
  return `${count} ${count === 1 ? 'renovação encontrada' : 'renovações encontradas'}`
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  let query = supabase
    .from('calendar_events')
    .select(`
      id, title, event_date, status, description, client_id, process_id,
      clients(id, name, cpf),
      processes:processes!calendar_events_process_id_fkey(
        id, process_types(name, slug)
      )
    `)
    .eq('event_type', 'renewal')
    .neq('status', 'canceled')
    .order('event_date', { ascending: true })
    .limit(500)

  if (params.from) query = query.gte('event_date', params.from)
  if (params.to) query = query.lte('event_date', params.to)
  if (params.status) query = query.eq('status', params.status)

  const { data, error } = await query
  const normalizedSearch = normalize(params.q)
  const searchDigits = (params.q ?? '').replace(/\D/g, '')
  const rows = ((data ?? []) as unknown as RenewalRow[]).filter(row => (
    !normalizedSearch
    || normalize(row.title).includes(normalizedSearch)
    || normalize(row.clients?.name).includes(normalizedSearch)
    || normalize(row.processes?.process_types?.name).includes(normalizedSearch)
    || (Boolean(searchDigits) && row.clients?.cpf?.replace(/\D/g, '').includes(searchDigits))
  ))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const inThirtyDays = new Date(today)
  inThirtyDays.setDate(inThirtyDays.getDate() + 30)
  const todayText = localDateOnly(today)
  const thirtyDaysText = localDateOnly(inThirtyDays)
  const overdue = rows.filter(row => row.status === 'pending' && row.event_date < todayText).length
  const dueSoon = rows.filter(row => (
    row.status === 'pending'
    && row.event_date >= todayText
    && row.event_date <= thirtyDaysText
  )).length
  const completed = rows.filter(row => row.status === 'completed').length
  const hasFilters = Boolean(params.q || params.from || params.to || params.status)

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1A17] via-[#6B3019] to-[#A14F2A] p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.05]" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="dash text-xl font-bold sm:text-2xl">Renovações</h1>
              <p className="dash mt-1 text-xs text-white/65 sm:text-sm">
                Consulte vencimentos, antecipe contatos e acompanhe cada renovação.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <div className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-center">
              <p className="dash text-base font-bold">{overdue}</p>
              <p className="dash text-[10px] text-white/70">Vencidas</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-center">
              <p className="dash text-base font-bold">{dueSoon}</p>
              <p className="dash text-[10px] text-white/70">Em 30 dias</p>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-center">
              <p className="dash text-base font-bold">{completed}</p>
              <p className="dash text-[10px] text-white/70">Concluídas</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <div>
            <h2 className="dash text-sm font-bold text-foreground">Filtros da consulta</h2>
            <p className="dash text-[11px] text-muted-foreground">Pesquise por cliente, documento, serviço ou período.</p>
          </div>
        </div>
        <form method="get" className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className="space-y-1 sm:col-span-2 lg:col-span-4">
            <span className="dash block text-xs font-semibold text-muted-foreground">Buscar</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={params.q}
                placeholder="Cliente, CPF ou serviço"
                className="dash h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:bg-card"
              />
            </span>
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="dash block text-xs font-semibold text-muted-foreground">De</span>
            <input name="from" type="date" defaultValue={params.from} className="dash h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="dash block text-xs font-semibold text-muted-foreground">Até</span>
            <input name="to" type="date" defaultValue={params.to} className="dash h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="dash block text-xs font-semibold text-muted-foreground">Situação</span>
            <select name="status" defaultValue={params.status} className="dash h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary">
              <option value="">Todas as situações</option>
              <option value="pending">Pendente</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Concluída</option>
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
            <button className="dash inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
              <Search className="h-3.5 w-3.5" /> Consultar
            </button>
            {hasFilters && (
              <Link href="/renovacoes" aria-label="Limpar filtros" title="Limpar filtros" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted">
                <RotateCcw className="h-4 w-4" />
              </Link>
            )}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="dash font-bold text-foreground">Resultado da consulta</h2>
            <p className="dash mt-0.5 text-xs text-muted-foreground">{resultLabel(rows.length)}</p>
          </div>
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
        </div>

        {error ? (
          <p className="dash p-6 text-sm text-red-700">Não foi possível carregar as renovações: {error.message}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CalendarDays className="h-5 w-5" />
            </span>
            <p className="dash text-sm font-semibold text-foreground">Nenhuma renovação encontrada</p>
            <p className="dash mt-1 max-w-md text-xs text-muted-foreground">Altere os filtros ou limpe a consulta para visualizar outros períodos.</p>
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {rows.map(row => {
              const renewalDate = parseDateOnly(row.event_date)
              const isOverdue = row.status === 'pending' && row.event_date < todayText
              const isDueSoon = row.status === 'pending' && row.event_date >= todayText && row.event_date <= thirtyDaysText
              const status = isOverdue
                ? { label: 'Vencida', className: 'border-red-200 bg-red-50 text-red-700' }
                : isDueSoon
                  ? { label: 'Próximos 30 dias', className: 'border-amber-200 bg-amber-50 text-amber-700' }
                  : STATUS_META[row.status] ?? STATUS_META.pending

              return (
                <article key={row.id} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-muted/10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${status.className}`}>
                      <span className="dash text-[9px] font-bold uppercase tracking-wide">
                        {renewalDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                      </span>
                      <span className="dash text-lg font-bold leading-none">{renewalDate.getDate()}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="dash truncate font-bold text-foreground">{row.clients?.name ?? 'Cliente não identificado'}</p>
                        <span className={`dash inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="dash mt-1 text-sm font-medium text-foreground/80">
                        {row.processes?.process_types?.name ?? row.title}
                      </p>
                      <p className="dash mt-0.5 text-xs text-muted-foreground">
                        Renovação em {formatDateOnly(row.event_date)}
                      </p>
                      {row.description && row.description !== row.title && (
                        <p className="dash mt-1 line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
                      )}
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                      {row.client_id && (
                        <Link href={`/clientes/${row.client_id}`} className="dash inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted">
                          Cliente
                        </Link>
                      )}
                      {row.process_id && (
                        <Link href={`/processos/${row.process_id}`} className="dash inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">
                          Processo <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {!row.client_id && !row.process_id && row.status === 'completed' && (
                        <span className="dash col-span-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> Concluída
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
