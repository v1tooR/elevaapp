import { createClient } from '@/lib/supabase/server'
import { CalendarGridClient } from '@/components/calendario/calendar-grid-client'
import { Calendar, RefreshCw } from 'lucide-react'

export const metadata = { title: 'Calendário — Eleva Isenções' }

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const start = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

  const [{ data: clients }, { data: upcoming }, { data: monthEvents }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    supabase.from('calendar_events')
      .select('*, clients(id, name), processes:processes!calendar_events_process_id_fkey(id, process_types(name, color))')
      .eq('event_type', 'renewal')
      .eq('status', 'pending')
      .gte('event_date', today.toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5),
    supabase.from('calendar_events')
      .select('id, event_type, status')
      .gte('event_date', start)
      .lte('event_date', end)
      .neq('status', 'canceled'),
  ])

  const stats = {
    total:     monthEvents?.length ?? 0,
    renewals:  monthEvents?.filter(e => e.event_type === 'renewal').length ?? 0,
    deadlines: monthEvents?.filter(e => e.event_type === 'deadline').length ?? 0,
    reminders: monthEvents?.filter(e => e.event_type === 'reminder').length ?? 0,
    pending:   monthEvents?.filter(e => e.status === 'pending').length ?? 0,
  }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-1 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
        .anim-2 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.08s both; }
        .anim-3 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.16s both; }
      `}</style>

      {/* Dark banner */}
      <div className="anim-1 rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, #3b82f6 0%, transparent 60%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="dash text-2xl font-bold text-white">Calendário</h1>
              <p className="dash text-slate-400 text-sm mt-0.5">Eventos, prazos e renovações de isenções</p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex gap-2 flex-wrap mt-4">
            {[
              { label: 'Este mês',   value: stats.total,     bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' },
              { label: 'Renovações', value: stats.renewals,  bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
              { label: 'Prazos',     value: stats.deadlines, bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
              { label: 'Lembretes',  value: stats.reminders, bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
              { label: 'Pendentes',  value: stats.pending,   bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
            ].map(chip => (
              <div
                key={chip.label}
                className="dash flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: chip.bg, border: '1px solid rgba(255,255,255,0.08)', color: chip.color }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{chip.value}</span>
                {chip.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Próximas renovações */}
      {upcoming && upcoming.length > 0 && (
        <div className="anim-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <h2 className="dash text-sm font-bold text-slate-900">Próximas Renovações</h2>
            <span className="dash ml-auto text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full">
              {upcoming.length} pendente(s)
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {upcoming.map((ev: any) => {
              const daysLeft = Math.ceil(
                (new Date(ev.event_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0))
                / (1000 * 60 * 60 * 24)
              )
              const urgent = daysLeft <= 30
              const evDate = new Date(ev.event_date + 'T00:00:00')
              return (
                <div key={ev.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div
                    className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{
                      background: urgent ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
                      border: urgent ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    <span className="dash text-[9px] font-bold uppercase tracking-wide" style={{ color: urgent ? '#ef4444' : '#d97706' }}>
                      {evDate.toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                    <span className="dash text-base font-bold leading-none" style={{ color: urgent ? '#dc2626' : '#b45309' }}>
                      {evDate.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="dash text-sm font-semibold text-slate-800 truncate">{ev.title}</p>
                    {ev.clients?.name && (
                      <p className="dash text-xs text-slate-500 mt-0.5">{ev.clients.name}</p>
                    )}
                  </div>
                  <span
                    className="dash text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      color: urgent ? '#dc2626' : '#b45309',
                      border: urgent ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    {daysLeft === 0 ? 'Hoje' : daysLeft === 1 ? 'Amanhã' : `${daysLeft}d`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="anim-3">
        <CalendarGridClient clients={clients ?? []} profileId={profile!.id} />
      </div>
    </div>
  )
}
