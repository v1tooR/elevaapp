import { getClientPortalEvents } from '@/lib/client-portal'
import {
  CalendarDays, ArrowLeft, Clock, Tag, ChevronRight,
  CalendarCheck, CalendarX, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'

const MONTH_NAMES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEKDAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default async function ClienteCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro = 'proximos' } = await searchParams

  const allEvents = await getClientPortalEvents()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const events   = allEvents
  const upcoming = events.filter((e: any) => e.event_date >= todayStr)
  const past     = events.filter((e: any) => e.event_date <  todayStr).reverse()

  const counts = { todos: events.length, proximos: upcoming.length, passados: past.length }

  const filtered =
    filtro === 'proximos' ? upcoming :
    filtro === 'passados' ? past     :
    events

  const grouped: Record<string, any[]> = {}
  for (const ev of filtered) {
    const d = parseLocalDate(ev.event_date)
    const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ev)
  }

  const cy = today.getFullYear()
  const cm = today.getMonth()
  const daysInMonth  = getDaysInMonth(cy, cm)
  const firstWeekday = getFirstWeekday(cy, cm)
  const eventDays = new Set(
    events
      .filter((e: any) => {
        const d = parseLocalDate(e.event_date)
        return d.getFullYear() === cy && d.getMonth() === cm
      })
      .map((e: any) => parseLocalDate(e.event_date).getDate())
  )

  const filters = [
    { key: 'proximos', label: 'Próximos', icon: CalendarCheck, activeClass: 'border-[#A14F2A] bg-[#A14F2A] text-white' },
    { key: 'passados', label: 'Passados', icon: CalendarX,     activeClass: 'border-slate-500 bg-slate-500 text-white' },
    { key: 'todos',    label: 'Todos',    icon: LayoutGrid,    activeClass: 'border-[#1E1A17] bg-[#1E1A17] text-white' },
  ]

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.12s; }
        .anim-3 { animation-delay: 0.19s; }
        .anim-4 { animation-delay: 0.26s; }
      `}</style>

      <div className="dash space-y-5">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />

          <div className="relative p-6 sm:p-8">
            <Link
              href="/minha-area"
              className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors hover:text-white"
              style={{ color: 'rgba(201,122,82,0.75)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao início
            </Link>

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <CalendarDays style={{ width: 18, height: 18, color: '#C97A52' }} />
                  </div>
                  <h1 className="text-white text-2xl font-bold">Minha Agenda</h1>
                </div>
                <p className="text-sm" style={{ color: 'rgba(201,122,82,0.6)' }}>
                  {upcoming.length > 0
                    ? `${upcoming.length} evento${upcoming.length !== 1 ? 's' : ''} próximo${upcoming.length !== 1 ? 's' : ''}`
                    : 'Nenhum evento agendado em breve'}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-white text-lg font-bold leading-none">{counts.todos}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>total</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-lg font-bold leading-none" style={{ color: '#C97A52' }}>{counts.proximos}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>próximos</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Grid: mini-cal + list ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Mini calendar */}
          <div
            className="anim anim-1 bg-white rounded-2xl p-5"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">
                {MONTH_NAMES[cm]} {cy}
              </h2>
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 border" style={{ color: '#A14F2A', background: 'rgba(161,79,42,0.08)', borderColor: 'rgba(161,79,42,0.2)' }}>
                Hoje
              </span>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-300 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const isToday  = day === today.getDate()
                const hasEvent = eventDays.has(day)
                return (
                  <div key={day} className="flex flex-col items-center py-0.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${isToday ? 'text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                      style={isToday ? { background: '#A14F2A' } : {}}
                    >
                      {day}
                    </span>
                    {hasEvent && (
                      <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: isToday ? 'rgba(201,122,82,0.7)' : '#C97A52' }} />
                    )}
                  </div>
                )
              })}
            </div>

            {eventDays.size > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#C97A52' }} />
                <span className="text-[11px] text-slate-400">{eventDays.size} dia{eventDays.size !== 1 ? 's' : ''} com evento este mês</span>
              </div>
            )}
          </div>

          {/* Event list */}
          <div className="lg:col-span-2 space-y-4">

            <div className="anim anim-2 flex items-center gap-2">
              {filters.map(f => {
                const active = filtro === f.key
                return (
                  <Link
                    key={f.key}
                    href={`/minha-area/calendario?filtro=${f.key}`}
                    className={`
                      inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all
                      ${active ? f.activeClass : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                    `}
                  >
                    <f.icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} style={{ width: 14, height: 14 }} />
                    {f.label}
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {counts[f.key as keyof typeof counts]}
                    </span>
                  </Link>
                )
              })}
            </div>

            {filtered.length === 0 ? (
              <div
                className="anim anim-3 bg-white rounded-2xl py-20 flex flex-col items-center text-center"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  <CalendarDays className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  {filtro === 'proximos' ? 'Nenhum evento próximo' :
                   filtro === 'passados' ? 'Nenhum evento passado' :
                   'Nenhum evento agendado'}
                </p>
                <p className="text-xs text-slate-300 mt-1.5 max-w-xs">
                  {filtro === 'proximos'
                    ? 'Eventos agendados pelo seu assessor aparecerão aqui'
                    : 'Tente outro filtro'}
                </p>
              </div>
            ) : (
              <div className="anim anim-3 space-y-5">
                {Object.entries(grouped).map(([monthLabel, monthEvents]) => (
                  <div key={monthLabel}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{monthLabel}</span>
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] text-slate-400">{monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div
                      className="bg-white rounded-2xl overflow-hidden"
                      style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                    >
                      {monthEvents.map((ev: any) => {
                        const d = parseLocalDate(ev.event_date)
                        const dayNum       = d.getDate()
                        const weekday      = WEEKDAY_SHORT[d.getDay()]
                        const monthAbb     = MONTH_NAMES[d.getMonth()].slice(0, 3)
                        const isToday      = ev.event_date === todayStr
                        const isPast       = ev.event_date < todayStr
                        const processColor = ev.processes?.process_types?.color ?? '#A14F2A'

                        return (
                          <div
                            key={ev.id}
                            className={`flex items-start gap-4 p-4 border-b border-slate-50 last:border-0 ${isPast ? 'opacity-60' : ''}`}
                          >
                            <div
                              className="w-14 shrink-0 rounded-xl flex flex-col items-center justify-center py-2.5"
                              style={isToday
                                ? { background: '#A14F2A' }
                                : { background: '#f8fafc', border: '1px solid #e2e8f0' }
                              }
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: isToday ? 'rgba(201,122,82,0.8)' : '#94a3b8' }}>
                                {weekday}
                              </span>
                              <span className="text-2xl font-bold leading-none mt-0.5" style={{ color: isToday ? '#fff' : '#1e293b' }}>
                                {dayNum}
                              </span>
                              <span className="text-[10px] font-medium mt-0.5" style={{ color: isToday ? 'rgba(201,122,82,0.8)' : '#94a3b8' }}>
                                {monthAbb}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-bold leading-tight ${isPast ? 'text-slate-500' : 'text-slate-900'}`}>
                                  {ev.title}
                                </p>
                                {isToday && (
                                  <span
                                    className="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 border"
                                    style={{ color: '#A14F2A', background: 'rgba(161,79,42,0.08)', borderColor: 'rgba(161,79,42,0.2)' }}
                                  >
                                    Hoje
                                  </span>
                                )}
                              </div>

                              {ev.description && (
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{ev.description}</p>
                              )}

                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {ev.event_time && (
                                  <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {ev.event_time.slice(0, 5)}
                                  </span>
                                )}
                                {ev.processes?.process_types?.name && (
                                  <span
                                    className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5"
                                    style={{ background: processColor + '15', color: processColor }}
                                  >
                                    <Tag className="w-2.5 h-2.5" />
                                    {ev.processes.process_types.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
