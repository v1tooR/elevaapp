'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, RefreshCw, Clock, User, FileText, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalEvent = {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  event_type: 'normal' | 'renewal' | 'deadline' | 'reminder'
  color: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'canceled'
  visibility: 'admin_only' | 'client_visible'
  clients?: { id: string; name: string } | null
  processes?: { id: string; process_types?: { name: string; color: string } } | null
}

const EVENT_TYPE_CFG = {
  normal:   {
    label: 'Evento',
    pill: 'bg-blue-500',
    dot: '#3b82f6',
    gradient: 'linear-gradient(135deg, #0c1a2e 0%, #1e40af 100%)',
  },
  renewal:  {
    label: 'Renovação',
    pill: 'bg-amber-500',
    dot: '#f59e0b',
    gradient: 'linear-gradient(135deg, #1c0a00 0%, #b45309 100%)',
  },
  deadline: {
    label: 'Prazo',
    pill: 'bg-red-500',
    dot: '#ef4444',
    gradient: 'linear-gradient(135deg, #450a0a 0%, #dc2626 100%)',
  },
  reminder: {
    label: 'Lembrete',
    pill: 'bg-purple-500',
    dot: '#a855f7',
    gradient: 'linear-gradient(135deg, #1e0845 0%, #7c3aed 100%)',
  },
}

const STATUS_CFG = {
  pending:     { label: 'Pendente',     cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Concluído',    cls: 'bg-emerald-100 text-emerald-700' },
  canceled:    { label: 'Cancelado',    cls: 'bg-red-100 text-red-700' },
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const inputCls = "block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all dash"
const labelCls = "block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 dash"

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function addMonths(date: Date, n: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

interface Props {
  clients: { id: string; name: string }[]
  profileId: string
}

export function CalendarGridClient({ clients, profileId }: Props) {
  const router = useRouter()
  const today = new Date()
  const [view, setView] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null)

  const year = view.getFullYear()
  const month = view.getMonth() + 1

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/calendario?year=${year}&month=${month}`)
    const json = await res.json()
    setEvents(json.events ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayIso = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay: Record<string, CalEvent[]> = {}
  events.forEach(ev => {
    if (!eventsByDay[ev.event_date]) eventsByDay[ev.event_date] = []
    eventsByDay[ev.event_date].push(ev)
  })

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : []

  return (
    <>
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>

      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* ── Calendar grid ── */}
        <div className="flex-1 min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(v => addMonths(v, -1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="dash text-base font-bold text-slate-900 w-44 text-center">
                {MONTHS_PT[month - 1]} {year}
              </h2>
              <button
                onClick={() => setView(v => addMonths(v, 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="dash ml-1 px-3 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                Hoje
              </button>
              {loading && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
            </div>
            <button
              onClick={() => { setSelectedDay(todayIso); setCreateOpen(true) }}
              className="dash inline-flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Novo Evento
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-slate-50/60 border-b border-slate-100">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className="py-2.5 text-center">
                <span className={cn(
                  'dash text-[11px] font-bold uppercase tracking-widest',
                  (i === 0 || i === 6) ? 'text-slate-300' : 'text-slate-400'
                )}>{d}</span>
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const iso = day ? isoDate(year, month, day) : null
              const dayEvs = iso ? (eventsByDay[iso] ?? []) : []
              const isToday = iso === todayIso
              const isSelected = iso === selectedDay
              const isWeekend = i % 7 === 0 || i % 7 === 6

              return (
                <div
                  key={i}
                  onClick={() => iso && setSelectedDay(prev => prev === iso ? null : iso)}
                  className={cn(
                    'min-h-24 p-1.5 border-b border-r border-slate-100 transition-colors',
                    day ? 'cursor-pointer' : '',
                    day && !isSelected && 'hover:bg-slate-50/80',
                    !day && 'bg-slate-50/30',
                    isSelected && 'bg-blue-50',
                    isWeekend && day && !isSelected && 'bg-slate-50/40',
                  )}
                >
                  {day && (
                    <>
                      <div className="mb-1">
                        <span className={cn(
                          'dash inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full transition-all',
                          isToday
                            ? 'bg-blue-600 text-white shadow-sm'
                            : isSelected
                            ? 'bg-blue-200 text-blue-800'
                            : 'text-slate-500 hover:text-slate-800',
                        )}>
                          {day}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {dayEvs.slice(0, 3).map(ev => {
                          const cfg = EVENT_TYPE_CFG[ev.event_type ?? 'normal']
                          return (
                            <div
                              key={ev.id}
                              onClick={e => { e.stopPropagation(); setDetailEvent(ev) }}
                              className={cn(
                                'dash truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity text-white',
                                cfg.pill
                              )}
                              title={ev.title}
                            >
                              {ev.title}
                            </div>
                          )
                        })}
                        {dayEvs.length > 3 && (
                          <div className="dash text-[10px] text-slate-400 font-semibold px-1.5">+{dayEvs.length - 3}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/40">
            {Object.entries(EVENT_TYPE_CFG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', cfg.pill)} />
                <span className="dash text-xs text-slate-500">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Side panel — selected day ── */}
        {selectedDay && (
          <div className="w-72 border-l border-slate-100 flex flex-col">
            <div className="px-4 py-3.5 border-b border-slate-100" style={{ background: 'linear-gradient(to bottom, #f8fafc, #ffffff)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="dash text-sm font-bold text-slate-900 capitalize leading-snug">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <p className="dash text-xs text-slate-400 mt-0.5">
                    {selectedDayEvents.length === 0 ? 'Sem eventos' : `${selectedDayEvents.length} evento(s)`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                    <Calendar className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="dash text-sm font-semibold text-slate-500">Nenhum evento</p>
                  <p className="dash text-xs text-slate-400 mt-0.5">Que tal criar um?</p>
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="dash mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors"
                  >
                    + Criar evento
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {selectedDayEvents.map(ev => {
                    const cfg = EVENT_TYPE_CFG[ev.event_type ?? 'normal']
                    const stCfg = STATUS_CFG[ev.status]
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setDetailEvent(ev)}
                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: cfg.dot }} />
                          <div className="flex-1 min-w-0">
                            <p className="dash text-sm font-semibold text-slate-800 leading-snug group-hover:text-slate-900">{ev.title}</p>
                            {ev.event_time && (
                              <p className="dash text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {ev.event_time.slice(0, 5)}
                              </p>
                            )}
                            {ev.clients?.name && (
                              <p className="dash text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" />
                                {ev.clients.name}
                              </p>
                            )}
                            {(ev.processes as any)?.process_types?.name && (
                              <p className="dash text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <FileText className="w-3 h-3" />
                                {(ev.processes as any).process_types.name}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="dash text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.dot + '18', color: cfg.dot }}>
                                {cfg.label}
                              </span>
                              <span className={cn('dash text-[10px] font-semibold px-2 py-0.5 rounded-full', stCfg.cls)}>
                                {stCfg.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => setCreateOpen(true)}
                className="dash w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Novo evento neste dia
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create event modal */}
      {createOpen && (
        <CreateEventModal
          clients={clients}
          profileId={profileId}
          defaultDate={selectedDay ?? todayIso}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); fetchEvents(); router.refresh() }}
        />
      )}

      {/* Detail modal */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onDeleted={() => { setDetailEvent(null); fetchEvents(); router.refresh() }}
          onStatusChanged={(id, status) => {
            setEvents(prev => prev.map(e => e.id === id ? { ...e, status } : e))
            setDetailEvent(prev => prev?.id === id ? { ...prev, status } : prev)
          }}
        />
      )}
    </>
  )
}

// ─── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventModal({
  clients, profileId, defaultDate, onClose, onCreated,
}: {
  clients: { id: string; name: string }[]
  profileId: string
  defaultDate: string
  onClose: () => void
  onCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [processes, setProcesses] = useState<{ id: string; process_types?: { name: string } | null }[]>([])
  const [form, setForm] = useState({
    title: '', description: '', event_date: defaultDate, event_time: '',
    event_type: 'normal', client_id: '', process_id: '',
    visibility: 'admin_only', status: 'pending',
  })

  const cfg = EVENT_TYPE_CFG[form.event_type as keyof typeof EVENT_TYPE_CFG] ?? EVENT_TYPE_CFG.normal

  useEffect(() => {
    if (!form.client_id) { setProcesses([]); return }
    const supabase = createClient()
    supabase.from('processes').select('id, process_types(name)').eq('client_id', form.client_id)
      .then(({ data }) => setProcesses(
        (data ?? []).map(p => ({
          id: String(p.id),
          process_types: Array.isArray(p.process_types) ? (p.process_types[0] ?? null) : p.process_types,
        }))
      ))
  }, [form.client_id])

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.event_date) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('calendar_events').insert({
      title: form.title, description: form.description || null,
      event_date: form.event_date, event_time: form.event_time || null,
      event_type: form.event_type as any,
      client_id: form.client_id || null, process_id: form.process_id || null,
      responsible_user_id: profileId,
      visibility: form.visibility as any, status: form.status as any,
    })
    setLoading(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.18s ease-out both' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: cfg.gradient, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div>
            <p className="dash text-xs font-bold uppercase tracking-widest text-white/50 mb-0.5">{cfg.label}</p>
            <h2 className="dash text-base font-bold text-white">Novo Evento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col">
          <div className="p-5 space-y-4 flex-1">

            {/* Type selector */}
            <div>
              <label className={labelCls}>Tipo de Evento</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(EVENT_TYPE_CFG) as [string, typeof EVENT_TYPE_CFG[keyof typeof EVENT_TYPE_CFG]][]).map(([type, c]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('event_type', type)}
                    className="dash py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5"
                    style={form.event_type === type ? {
                      background: c.dot + '18',
                      border: `2px solid ${c.dot}`,
                      color: c.dot,
                    } : {
                      background: '#f8fafc',
                      border: '2px solid #e2e8f0',
                      color: '#64748b',
                    }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                required
                autoFocus
                className={inputCls}
                placeholder="Ex: Renovação do processo de isenção"
              />
            </div>

            <div>
              <label className={labelCls}>Descrição</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className={inputCls + ' resize-none'}
                placeholder="Detalhes adicionais (opcional)..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data *</label>
                <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Horário</label>
                <input type="time" value={form.event_time} onChange={e => set('event_time', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Cliente</label>
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                <option value="">Selecione (opcional)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {processes.length > 0 && (
              <div>
                <label className={labelCls}>Processo</label>
                <select value={form.process_id} onChange={e => set('process_id', e.target.value)} className={inputCls}>
                  <option value="">Selecione</option>
                  {processes.map(p => <option key={p.id} value={p.id}>{(p.process_types as any)?.name ?? p.id}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Visibilidade</label>
                <select value={form.visibility} onChange={e => set('visibility', e.target.value)} className={inputCls}>
                  <option value="admin_only">Somente equipe</option>
                  <option value="client_visible">Visível ao cliente</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status inicial</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-3 shrink-0">
            <button
              type="submit"
              disabled={loading}
              className="dash flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 cursor-pointer"
              style={{ background: cfg.gradient }}
            >
              {loading ? 'Criando...' : 'Criar Evento'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="dash px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({
  event, onClose, onDeleted, onStatusChanged,
}: {
  event: CalEvent
  onClose: () => void
  onDeleted: () => void
  onStatusChanged: (id: string, status: CalEvent['status']) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [statusLoading, setStatusLoading] = useState<string | null>(null)
  const cfg = EVENT_TYPE_CFG[event.event_type ?? 'normal']
  const evDate = new Date(event.event_date + 'T00:00:00')

  const handleDelete = async () => {
    if (!confirm('Excluir este evento?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('calendar_events').delete().eq('id', event.id)
    setDeleting(false)
    onDeleted()
  }

  const handleStatus = async (status: CalEvent['status']) => {
    setStatusLoading(status)
    const supabase = createClient()
    await supabase.from('calendar_events').update({ status }).eq('id', event.id)
    setStatusLoading(null)
    onStatusChanged(event.id, status)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'modalIn 0.18s ease-out both' }}
      >
        {/* Header */}
        <div className="px-5 py-5" style={{ background: cfg.gradient, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="dash text-xs font-bold uppercase tracking-widest text-white/50">{cfg.label}</span>
              <h2 className="dash text-lg font-bold text-white leading-snug mt-0.5">{event.title}</h2>
              <div className="dash flex items-center gap-2 text-sm text-white/60 mt-1.5 flex-wrap">
                <span>
                  {evDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {event.event_time && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.event_time.slice(0, 5)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {event.description && (
            <p className="dash text-sm text-slate-600 leading-relaxed">{event.description}</p>
          )}

          {(event.clients?.name || (event.processes as any)?.process_types?.name) && (
            <div className="space-y-2 py-3 border-y border-slate-100">
              {event.clients?.name && (
                <div className="dash flex items-center gap-2.5 text-sm text-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <span className="font-semibold">{event.clients.name}</span>
                </div>
              )}
              {(event.processes as any)?.process_types?.name && (
                <div className="dash flex items-center gap-2.5 text-sm text-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className="font-semibold">{(event.processes as any).process_types.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Status switcher */}
          <div>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Status do Evento</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(STATUS_CFG) as [CalEvent['status'], typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([s, c]) => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  disabled={statusLoading !== null}
                  className={cn(
                    'dash text-xs font-semibold px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left',
                    event.status === s
                      ? c.cls + ' ring-2 ring-offset-1 ring-blue-300'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                  )}
                >
                  {statusLoading === s ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                      {c.label}
                    </span>
                  ) : c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="dash text-sm text-red-500 hover:text-red-700 font-semibold disabled:opacity-50 cursor-pointer transition-colors"
            >
              {deleting ? 'Excluindo...' : 'Excluir evento'}
            </button>
            <button
              onClick={onClose}
              className="dash px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
