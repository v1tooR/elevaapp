'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  ClipboardPlus,
  Edit3,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Search,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import {
  IMESC_ADDITIONAL_COLUMNS,
  IMESC_BOARD_LABELS,
  IMESC_OPERATIONAL_LABELS,
  IMESC_PRIMARY_COLUMNS,
} from '@/lib/imesc-workflow'
import { cn, formatDate } from '@/lib/utils'
import type { ImescBoardStatus, ImescOperationalStatus } from '@/types/database'
import type {
  ImescBoardRow,
  ImescClientOption,
  ImescProcessOption,
  ImescStaffOption,
} from '@/app/processos/imesc-operacao/page'

const BOARD_COLORS: Record<ImescBoardStatus, {
  accent: string
  badge: string
  surface: string
}> = {
  aguardando: {
    accent: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700',
    surface: 'border-slate-200 bg-slate-50/70',
  },
  leve: {
    accent: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700',
    surface: 'border-sky-100 bg-sky-50/40',
  },
  moderado: {
    accent: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
    surface: 'border-amber-100 bg-amber-50/40',
  },
  grave: {
    accent: 'bg-red-500',
    badge: 'bg-red-50 text-red-700',
    surface: 'border-red-100 bg-red-50/40',
  },
  nao_compareceu: {
    accent: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-700',
    surface: 'border-orange-100 bg-orange-50/40',
  },
  sem_deficiencia: {
    accent: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700',
    surface: 'border-violet-100 bg-violet-50/40',
  },
  indeferido: {
    accent: 'bg-rose-700',
    badge: 'bg-rose-50 text-rose-700',
    surface: 'border-rose-100 bg-rose-50/40',
  },
  cancelado: {
    accent: 'bg-zinc-500',
    badge: 'bg-zinc-100 text-zinc-600',
    surface: 'border-zinc-200 bg-zinc-50/70',
  },
}

const OPERATIONAL_OPTIONS = Object.entries(IMESC_OPERATIONAL_LABELS) as Array<
  [ImescOperationalStatus, string]
>
const BOARD_OPTIONS = Object.entries(IMESC_BOARD_LABELS) as Array<
  [ImescBoardStatus, string]
>
const OPERATIONAL_ORDER: ImescOperationalStatus[] = [
  'nao_iniciado',
  'solicitacao_em_preparo',
  'agendado',
  'pericia_realizada',
  'laudo_disponivel',
  'encerrado',
]

interface FormState {
  clientId: string
  boardStatus: ImescBoardStatus
  operationalStatus: ImescOperationalStatus
  responsibleUserId: string
  ipiProcessId: string
  ipvaProcessId: string
  protocol: string
  scheduledDate: string
  examinationDate: string
  reportIssuedAt: string
  reportValidUntil: string
  sourceClassification: '' | 'grave' | 'gravissima'
  notes: string
}

const EMPTY_FORM: FormState = {
  clientId: '',
  boardStatus: 'aguardando',
  operationalStatus: 'nao_iniciado',
  responsibleUserId: '',
  ipiProcessId: '',
  ipvaProcessId: '',
  protocol: '',
  scheduledDate: '',
  examinationDate: '',
  reportIssuedAt: '',
  reportValidUntil: '',
  sourceClassification: '',
  notes: '',
}

function processLabel(process: ImescProcessOption) {
  const type = process.slug === 'processo_ipi' ? 'IPI' : 'IPVA'
  return `${type}${process.protocol ? ` · ${process.protocol}` : ''} · ${process.status.replaceAll('_', ' ')}`
}

function rowToForm(row: ImescBoardRow): FormState {
  return {
    clientId: row.client_id,
    boardStatus: row.board_status,
    operationalStatus: row.operational_status,
    responsibleUserId: row.responsible_user_id ?? '',
    ipiProcessId: row.ipi_process_id ?? '',
    ipvaProcessId: row.ipva_process_id ?? '',
    protocol: row.protocol ?? '',
    scheduledDate: row.scheduled_date ?? '',
    examinationDate: row.examination_date ?? '',
    reportIssuedAt: row.report_issued_at ?? '',
    reportValidUntil: row.report_valid_until ?? '',
    sourceClassification: row.source_classification === 'gravissima'
      ? 'gravissima'
      : row.board_status === 'grave'
        ? 'grave'
        : '',
    notes: row.notes ?? '',
  }
}

export function ImescKanbanBoard({
  initialRows,
  clients,
  staff,
  processes,
}: {
  initialRows: ImescBoardRow[]
  clients: ImescClientOption[]
  staff: ImescStaffOption[]
  processes: ImescProcessOption[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [showAdditional, setShowAdditional] = useState(false)
  const [query, setQuery] = useState('')
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const availableClients = useMemo(() => {
    const existingClientIds = new Set(rows.map(row => row.client_id))
    return clients.filter(client => !existingClientIds.has(client.id) || client.id === form.clientId)
  }, [clients, form.clientId, rows])

  const selectedClientProcesses = processes.filter(process => process.client_id === form.clientId)
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const queryDigits = normalizedQuery.replace(/\D/g, '')
  const filteredRows = rows.filter(row => {
    const matchesQuery = !normalizedQuery
      || row.client?.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
      || (Boolean(queryDigits) && row.client?.cpf?.replace(/\D/g, '').includes(queryDigits))
      || row.protocol?.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
    const matchesResponsible = !responsibleFilter
      || row.responsible_user_id === responsibleFilter
    return matchesQuery && matchesResponsible
  })
  const additionalCount = rows.filter(row => (
    (IMESC_ADDITIONAL_COLUMNS as readonly ImescBoardStatus[]).includes(row.board_status)
  )).length
  const visibleColumns: ImescBoardStatus[] = showAdditional
    ? [...IMESC_PRIMARY_COLUMNS, ...IMESC_ADDITIONAL_COLUMNS]
    : [...IMESC_PRIMARY_COLUMNS]

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (row: ImescBoardRow) => {
    setEditingId(row.id)
    setForm(rowToForm(row))
    setError('')
    setModalOpen(true)
  }

  const moveCard = async (id: string, boardStatus: ImescBoardStatus) => {
    const current = rows.find(row => row.id === id)
    if (!current || current.board_status === boardStatus) return

    setError('')
    setRows(items => items.map(item => (
      item.id === id ? { ...item, board_status: boardStatus } : item
    )))

    const response = await fetch(`/api/imesc/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardStatus }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      setRows(items => items.map(item => (
        item.id === id ? current : item
      )))
      setError(result?.error ?? 'Não foi possível movimentar o acompanhamento.')
      return
    }

    router.refresh()
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.clientId) {
      setError('Selecione o cliente.')
      return
    }

    setLoading(true)
    setError('')
    const payload = {
      clientId: form.clientId,
      boardStatus: form.boardStatus,
      operationalStatus: form.operationalStatus,
      responsibleUserId: form.responsibleUserId || null,
      ipiProcessId: form.ipiProcessId || null,
      ipvaProcessId: form.ipvaProcessId || null,
      protocol: form.protocol || null,
      scheduledDate: form.scheduledDate || null,
      examinationDate: form.examinationDate || null,
      reportIssuedAt: form.reportIssuedAt || null,
      reportValidUntil: form.reportValidUntil || null,
      sourceClassification: form.sourceClassification || null,
      notes: form.notes || null,
    }

    const response = await fetch(editingId ? `/api/imesc/${editingId}` : '/api/imesc', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingId
        ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'clientId'))
        : payload),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      setError(result?.error ?? 'Não foi possível salvar o acompanhamento.')
      setLoading(false)
      return
    }

    const saved = result?.followup
    if (saved) {
      const existing = editingId ? rows.find(row => row.id === editingId) : null
      const relatedClient = clients.find(client => client.id === saved.client_id)
      const relatedResponsible = staff.find(profile => profile.id === saved.responsible_user_id)
      const savedRow: ImescBoardRow = {
        ...(existing ?? {
          client: relatedClient
            ? { ...relatedClient, phone: null }
            : null,
          responsible: relatedResponsible ?? null,
          ipi_process: null,
          ipva_process: null,
        }),
        ...saved,
        client: existing?.client ?? (relatedClient
          ? { ...relatedClient, phone: null }
          : null),
        responsible: relatedResponsible ?? null,
        ipi_process: saved.ipi_process_id
          ? (() => {
              const process = processes.find(item => item.id === saved.ipi_process_id)
              return process
                ? { id: process.id, protocol: process.protocol, status: process.status }
                : null
            })()
          : null,
        ipva_process: saved.ipva_process_id
          ? (() => {
              const process = processes.find(item => item.id === saved.ipva_process_id)
              return process
                ? { id: process.id, protocol: process.protocol, status: process.status }
                : null
            })()
          : null,
      }
      setRows(items => editingId
        ? items.map(item => item.id === editingId ? savedRow : item)
        : [savedRow, ...items])
    }

    setLoading(false)
    closeModal()
    router.refresh()
  }

  const operationalIndex = OPERATIONAL_ORDER.indexOf(form.operationalStatus)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div>
          <h2 className="dash text-sm font-bold text-foreground">Carteira de acompanhamento</h2>
          <p className="dash mt-0.5 text-xs text-muted-foreground">
            Arraste os cards no computador ou altere a coluna pelo seletor no celular.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdditional(value => !value)}
            className="dash inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdditional && 'rotate-180')} />
            {showAdditional
              ? 'Ocultar situações adicionais'
              : `Situações adicionais${additionalCount ? ` (${additionalCount})` : ''}`}
          </button>
          <button
            type="button"
            onClick={openNew}
            className="dash inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Iniciar acompanhamento
          </button>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(220px,1fr)_220px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar cliente, CPF ou protocolo"
              className="dash h-9 w-full rounded-xl border border-border bg-muted/40 pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary focus:bg-card"
            />
          </label>
          <select
            value={responsibleFilter}
            onChange={event => setResponsibleFilter(event.target.value)}
            className="dash h-9 w-full rounded-xl border border-border bg-muted/40 px-3 text-xs text-foreground outline-none focus:border-primary focus:bg-card"
          >
            <option value="">Todos os responsáveis</option>
            {staff.map(profile => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
          <span className="dash inline-flex h-9 items-center justify-center rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground">
            {filteredRows.length} resultado(s)
          </span>
        </div>
      </div>

      {error && !modalOpen && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="dash text-xs font-medium">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div
          className="grid min-w-max gap-3"
          style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(270px, 310px))` }}
        >
          {visibleColumns.map(status => {
            const columnRows = filteredRows.filter(row => row.board_status === status)
            const colors = BOARD_COLORS[status]
            return (
              <div
                key={status}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (draggingId) void moveCard(draggingId, status)
                  setDraggingId(null)
                }}
                className={cn('min-h-[260px] rounded-2xl border p-3', colors.surface)}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', colors.accent)} />
                    <h3 className="dash text-xs font-bold text-foreground">
                      {IMESC_BOARD_LABELS[status]}
                    </h3>
                  </div>
                  <span className="dash rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-sm">
                    {columnRows.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {columnRows.map(row => (
                    <article
                      key={row.id}
                      draggable
                      onDragStart={() => setDraggingId(row.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={cn(
                        'group rounded-xl border border-border bg-card p-3 shadow-sm transition-all',
                        draggingId === row.id && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 sm:block" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="dash truncate text-sm font-bold text-foreground">
                                {row.client?.name ?? 'Cliente não encontrado'}
                              </p>
                              <p className="dash mt-0.5 text-[10px] text-muted-foreground">
                                {row.responsible?.name ?? 'Sem responsável'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                              aria-label={`Editar acompanhamento de ${row.client?.name ?? 'cliente'}`}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <span className={cn(
                            'dash mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold',
                            colors.badge,
                          )}>
                            {IMESC_OPERATIONAL_LABELS[row.operational_status]}
                          </span>

                          <div className="mt-2.5 space-y-1 text-[10px] text-muted-foreground">
                            {row.scheduled_date && (
                              <p className="dash flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                Agendado: {formatDate(row.scheduled_date)}
                              </p>
                            )}
                            {row.protocol && (
                              <p className="dash flex items-center gap-1 truncate">
                                <FileText className="h-3 w-3" />
                                {row.protocol}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                            <Link
                              href={`/clientes/${row.client_id}`}
                              className="dash inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-primary"
                            >
                              <UserRound className="h-3 w-3" /> Cliente
                            </Link>
                            {row.ipi_process_id && (
                              <Link
                                href={`/processos/${row.ipi_process_id}`}
                                className="dash inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"
                              >
                                IPI <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            )}
                            {row.ipva_process_id && (
                              <Link
                                href={`/processos/${row.ipva_process_id}`}
                                className="dash inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                              >
                                IPVA <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            )}
                          </div>

                          <label className="dash mt-2.5 block text-[10px] font-semibold text-muted-foreground sm:hidden">
                            Mover para
                            <select
                              value={row.board_status}
                              onChange={event => void moveCard(
                                row.id,
                                event.target.value as ImescBoardStatus,
                              )}
                              className="mt-1 h-8 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground"
                            >
                              {BOARD_OPTIONS.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </article>
                  ))}

                  {columnRows.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/80 bg-card/50 px-3 py-8 text-center">
                      <Stethoscope className="mx-auto h-5 w-5 text-muted-foreground/40" />
                      <p className="dash mt-2 text-[11px] text-muted-foreground">Nenhum cliente</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-3xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <ClipboardPlus className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="dash text-sm font-bold text-foreground">
                    {editingId ? 'Editar acompanhamento IMESC' : 'Iniciar acompanhamento IMESC'}
                  </h2>
                  <p className="dash mt-0.5 text-xs text-muted-foreground">
                    IPI e IPVA são vínculos opcionais.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={save} className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="dash space-y-1 text-xs font-semibold text-muted-foreground sm:col-span-2">
                  Cliente *
                  <select
                    value={form.clientId}
                    disabled={Boolean(editingId)}
                    onChange={event => setForm(current => ({
                      ...current,
                      clientId: event.target.value,
                      ipiProcessId: '',
                      ipvaProcessId: '',
                    }))}
                    required
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground disabled:bg-muted"
                  >
                    <option value="">Selecione o cliente</option>
                    {availableClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}{client.cpf ? ` · ${client.cpf}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                  Coluna do quadro
                  <select
                    value={form.boardStatus}
                    onChange={event => setForm(current => ({
                      ...current,
                      boardStatus: event.target.value as ImescBoardStatus,
                    }))}
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                  >
                    {BOARD_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                  Etapa operacional
                  <select
                    value={form.operationalStatus}
                    onChange={event => setForm(current => ({
                      ...current,
                      operationalStatus: event.target.value as ImescOperationalStatus,
                    }))}
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                  >
                    {OPERATIONAL_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                  Responsável
                  <select
                    value={form.responsibleUserId}
                    onChange={event => setForm(current => ({
                      ...current,
                      responsibleUserId: event.target.value,
                    }))}
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                  >
                    <option value="">Sem responsável</option>
                    {staff.map(profile => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </label>

                <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                  Protocolo IMESC
                  <input
                    value={form.protocol}
                    onChange={event => setForm(current => ({
                      ...current,
                      protocol: event.target.value,
                    }))}
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                  />
                </label>
              </div>

              <fieldset className="rounded-xl border border-border bg-muted/25 p-4">
                <legend className="dash px-1 text-xs font-bold text-foreground">Processos relacionados</legend>
                <p className="dash mb-3 text-[11px] text-muted-foreground">
                  O acompanhamento pode existir sem qualquer processo vinculado.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                    Processo IPI
                    <select
                      value={form.ipiProcessId}
                      disabled={!form.clientId}
                      onChange={event => setForm(current => ({
                        ...current,
                        ipiProcessId: event.target.value,
                      }))}
                      className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground disabled:bg-muted"
                    >
                      <option value="">Não vinculado</option>
                      {selectedClientProcesses
                        .filter(process => process.slug === 'processo_ipi')
                        .map(process => (
                          <option key={process.id} value={process.id}>{processLabel(process)}</option>
                        ))}
                    </select>
                  </label>
                  <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                    Processo IPVA
                    <select
                      value={form.ipvaProcessId}
                      disabled={!form.clientId}
                      onChange={event => setForm(current => ({
                        ...current,
                        ipvaProcessId: event.target.value,
                      }))}
                      className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground disabled:bg-muted"
                    >
                      <option value="">Não vinculado</option>
                      {selectedClientProcesses
                        .filter(process => process.slug === 'processo_ipva')
                        .map(process => (
                          <option key={process.id} value={process.id}>{processLabel(process)}</option>
                        ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {operationalIndex >= 2 && (
                  <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                    Data agendada
                    <input
                      type="date"
                      value={form.scheduledDate}
                      onChange={event => setForm(current => ({
                        ...current,
                        scheduledDate: event.target.value,
                      }))}
                      className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                    />
                  </label>
                )}
                {operationalIndex >= 3 && (
                  <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                    Data da perícia
                    <input
                      type="date"
                      value={form.examinationDate}
                      onChange={event => setForm(current => ({
                        ...current,
                        examinationDate: event.target.value,
                      }))}
                      className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                    />
                  </label>
                )}
                {operationalIndex >= 4 && (
                  <>
                    <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                      Emissão do laudo
                      <input
                        type="date"
                        value={form.reportIssuedAt}
                        onChange={event => setForm(current => ({
                          ...current,
                          reportIssuedAt: event.target.value,
                        }))}
                        className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                      />
                    </label>
                    <label className="dash space-y-1 text-xs font-semibold text-muted-foreground">
                      Validade do laudo
                      <input
                        type="date"
                        value={form.reportValidUntil}
                        onChange={event => setForm(current => ({
                          ...current,
                          reportValidUntil: event.target.value,
                        }))}
                        className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                      />
                    </label>
                  </>
                )}
                {form.boardStatus === 'grave' && (
                  <label className="dash space-y-1 text-xs font-semibold text-muted-foreground sm:col-span-2">
                    Classificação original do laudo
                    <select
                      value={form.sourceClassification || 'grave'}
                      onChange={event => setForm(current => ({
                        ...current,
                        sourceClassification: event.target.value as 'grave' | 'gravissima',
                      }))}
                      className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal text-foreground"
                    >
                      <option value="grave">Grave</option>
                      <option value="gravissima">Gravíssima (mantida no histórico)</option>
                    </select>
                  </label>
                )}
              </div>

              <label className="dash block space-y-1 text-xs font-semibold text-muted-foreground">
                Observações internas
                <textarea
                  value={form.notes}
                  onChange={event => setForm(current => ({
                    ...current,
                    notes: event.target.value,
                  }))}
                  rows={3}
                  maxLength={4000}
                  className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal text-foreground"
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="dash text-xs font-medium">{error}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="dash h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="dash inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {loading ? 'Salvando...' : 'Salvar acompanhamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
