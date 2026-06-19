'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, RefreshCw, Clock, User, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'

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
  normal:   { label: 'Evento',      bg: 'bg-blue-500',   text: 'text-blue-700',   light: 'bg-blue-50' },
  renewal:  { label: 'Renovação',   bg: 'bg-amber-500',  text: 'text-amber-700',  light: 'bg-amber-50' },
  deadline: { label: 'Prazo',       bg: 'bg-red-500',    text: 'text-red-700',    light: 'bg-red-50' },
  reminder: { label: 'Lembrete',    bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50' },
}

const STATUS_CFG = {
  pending:     { label: 'Pendente',      cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Em andamento',  cls: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Concluído',     cls: 'bg-green-100 text-green-700' },
  canceled:    { label: 'Cancelado',     cls: 'bg-red-100 text-red-700' },
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

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

  // Build calendar grid
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayIso = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay: Record<string, CalEvent[]> = {}
  events.forEach(ev => {
    if (!eventsByDay[ev.event_date]) eventsByDay[ev.event_date] = []
    eventsByDay[ev.event_date].push(ev)
  })

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : []

  return (
    <div className="flex gap-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView(v => addMonths(v, -1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-slate-900 w-40 text-center">
              {MONTHS_PT[month - 1]} {year}
            </h2>
            <button
              onClick={() => setView(v => addMonths(v, 1))}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="ml-2 px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
            >
              Hoje
            </button>
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
            <button
              onClick={() => { setSelectedDay(todayIso); setCreateOpen(true) }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Evento
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {d}
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

            return (
              <div
                key={i}
                onClick={() => iso && setSelectedDay(prev => prev === iso ? null : iso)}
                className={cn(
                  'min-h-22 p-1.5 border-b border-r border-slate-100 transition-colors',
                  day ? 'cursor-pointer hover:bg-slate-50' : 'bg-slate-50/50',
                  isSelected && 'bg-blue-50 hover:bg-blue-50',
                  i % 7 === 0 && 'border-l-0',
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      'inline-flex items-center justify-center w-6 h-6 text-sm font-medium rounded-full mb-1',
                      isToday ? 'bg-blue-600 text-white' : 'text-slate-700',
                      isSelected && !isToday && 'bg-blue-200 text-blue-800',
                    )}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 3).map(ev => {
                        const cfg = EVENT_TYPE_CFG[ev.event_type ?? 'normal']
                        return (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); setDetailEvent(ev) }}
                            className={cn(
                              'truncate text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer hover:opacity-80',
                              cfg.bg, 'text-white'
                            )}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        )
                      })}
                      {dayEvs.length > 3 && (
                        <div className="text-[10px] text-slate-400 px-1">+{dayEvs.length - 3} mais</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          {Object.entries(EVENT_TYPE_CFG).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', cfg.bg)} />
              <span className="text-xs text-slate-500">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel — selected day */}
      {selectedDay && (
        <div className="w-72 border-l border-slate-100 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="text-xs text-slate-400">{selectedDayEvents.length} evento(s)</p>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selectedDayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-sm text-slate-400">Nenhum evento neste dia</p>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 text-xs text-blue-600 hover:underline"
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
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.bg)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 leading-snug">{ev.title}</p>
                          {ev.event_time && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {ev.event_time.slice(0, 5)}
                            </p>
                          )}
                          {ev.clients?.name && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3" />
                              {ev.clients.name}
                            </p>
                          )}
                          {(ev.processes as any)?.process_types?.name && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <FileText className="w-3 h-3" />
                              {(ev.processes as any).process_types.name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.light, cfg.text)}>
                              {cfg.label}
                            </span>
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', stCfg.cls)}>
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
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo evento neste dia
            </button>
          </div>
        </div>
      )}

      {/* Create event modal */}
      {createOpen && (
        <CreateEventInline
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
    </div>
  )
}

// ─── Create Event Modal ──────────────────────────────────────────────────────

function CreateEventInline({
  clients, profileId, defaultDate, onClose, onCreated
}: {
  clients: { id: string; name: string }[]
  profileId: string
  defaultDate: string
  onClose: () => void
  onCreated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [processes, setProcesses] = useState<{ id: string; process_types?: { name: string } | { name: string }[] | null }[]>([])
  const [form, setForm] = useState({
    title: '', description: '', event_date: defaultDate, event_time: '',
    event_type: 'normal', client_id: '', process_id: '',
    visibility: 'admin_only', status: 'pending',
  })

  useEffect(() => {
    if (!form.client_id) { setProcesses([]); return }
    const supabase = createClient()
    supabase.from('processes').select('id, process_types(name)').eq('client_id', form.client_id)
      .then(({ data }) => setProcesses(data ?? []))
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

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const processOptions = processes.map(p => ({ value: p.id, label: (p.process_types as any)?.name ?? p.id }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold">Novo Evento</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input label="Título *" value={form.title} onChange={e => set('title', e.target.value)} required autoFocus />
          <Textarea label="Descrição" value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data *" type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} required />
            <Input label="Horário" type="time" value={form.event_time} onChange={e => set('event_time', e.target.value)} />
          </div>
          <Select
            label="Tipo"
            options={[
              { value: 'normal', label: 'Evento' },
              { value: 'renewal', label: 'Renovação' },
              { value: 'deadline', label: 'Prazo' },
              { value: 'reminder', label: 'Lembrete' },
            ]}
            value={form.event_type}
            onChange={e => set('event_type', e.target.value)}
          />
          <Select label="Cliente" options={clientOptions} placeholder="Selecione (opcional)" value={form.client_id} onChange={e => set('client_id', e.target.value)} />
          {processOptions.length > 0 && (
            <Select label="Processo" options={processOptions} placeholder="Selecione" value={form.process_id} onChange={e => set('process_id', e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Visibilidade"
              options={[{ value: 'admin_only', label: 'Somente equipe' }, { value: 'client_visible', label: 'Visível para cliente' }]}
              value={form.visibility} onChange={e => set('visibility', e.target.value)}
            />
            <Select
              label="Status"
              options={[{ value: 'pending', label: 'Pendente' }, { value: 'in_progress', label: 'Em Andamento' }, { value: 'completed', label: 'Concluído' }]}
              value={form.status} onChange={e => set('status', e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={loading}>Criar Evento</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Event Detail Modal ──────────────────────────────────────────────────────

function EventDetailModal({
  event, onClose, onDeleted, onStatusChanged
}: {
  event: CalEvent
  onClose: () => void
  onDeleted: () => void
  onStatusChanged: (id: string, status: CalEvent['status']) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const cfg = EVENT_TYPE_CFG[event.event_type ?? 'normal']

  const handleDelete = async () => {
    if (!confirm('Excluir este evento?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('calendar_events').delete().eq('id', event.id)
    setDeleting(false)
    onDeleted()
  }

  const handleStatus = async (status: CalEvent['status']) => {
    const supabase = createClient()
    await supabase.from('calendar_events').update({ status }).eq('id', event.id)
    onStatusChanged(event.id, status)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Colored header */}
        <div className={cn('flex items-start justify-between p-5 rounded-t-xl', cfg.light)}>
          <div>
            <div className={cn('text-xs font-semibold uppercase tracking-wide mb-1', cfg.text)}>
              {cfg.label}
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{event.title}</h2>
            <p className={cn('text-sm mt-1', cfg.text)}>
              {new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {event.event_time && ` · ${event.event_time.slice(0, 5)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/50 text-slate-500 ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {event.description && (
            <p className="text-sm text-slate-600">{event.description}</p>
          )}

          {(event.clients?.name || (event.processes as any)?.process_types?.name) && (
            <div className="space-y-2">
              {event.clients?.name && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  {event.clients.name}
                </div>
              )}
              {(event.processes as any)?.process_types?.name && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {(event.processes as any).process_types.name}
                </div>
              )}
            </div>
          )}

          {/* Status switcher */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Status</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(STATUS_CFG) as [CalEvent['status'], typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([s, c]) => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  className={cn(
                    'text-xs font-medium px-3 py-1 rounded-full transition-colors',
                    event.status === s ? c.cls + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {deleting ? 'Excluindo...' : 'Excluir evento'}
            </button>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
