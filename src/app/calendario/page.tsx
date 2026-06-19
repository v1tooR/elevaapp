import { createClient } from '@/lib/supabase/server'
import { CalendarGridClient } from '@/components/calendario/calendar-grid-client'
import { Card } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

export const metadata = { title: 'Calendário — Eleva Isenções' }

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()

  const [{ data: clients }, { data: upcoming }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    // Next 5 renewals across all processes
    supabase.from('calendar_events')
      .select('*, clients(id, name), processes(id, process_types(name, color))')
      .eq('event_type', 'renewal')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
          <p className="text-slate-500 text-sm mt-1">Eventos, prazos e renovações de isenções</p>
        </div>
      </div>

      {/* Próximas renovações */}
      {upcoming && upcoming.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-900">Próximas Renovações</h2>
            <span className="ml-auto text-xs text-slate-400">{upcoming.length} pendente(s)</span>
          </div>
          <div className="divide-y divide-slate-50">
            {upcoming.map((ev: any) => {
              const daysLeft = Math.ceil(
                (new Date(ev.event_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0))
                / (1000 * 60 * 60 * 24)
              )
              const urgent = daysLeft <= 30
              return (
                <div key={ev.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${urgent ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <span className={`text-[10px] font-semibold uppercase ${urgent ? 'text-red-500' : 'text-amber-600'}`}>
                      {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                    <span className={`text-base font-bold leading-none ${urgent ? 'text-red-600' : 'text-amber-700'}`}>
                      {new Date(ev.event_date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{ev.title}</p>
                    {ev.clients?.name && (
                      <p className="text-xs text-slate-500">{ev.clients.name}</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {daysLeft === 0 ? 'Hoje' : daysLeft === 1 ? 'Amanhã' : `${daysLeft}d`}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Calendar grid */}
      <CalendarGridClient
        clients={clients ?? []}
        profileId={profile!.id}
      />
    </div>
  )
}
