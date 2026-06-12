import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { CalendarDays, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { CreateEventModal } from '@/components/calendario/create-event-modal'
import { EventCard } from '@/components/calendario/event-card'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: upcoming }, { data: past }, { data: clients }] = await Promise.all([
    supabase.from('calendar_events')
      .select('*, clients(id, name), processes(id, process_types(name)), responsible_user:profiles!calendar_events_responsible_user_id_fkey(id, name)')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true })
      .limit(30),
    supabase.from('calendar_events')
      .select('*, clients(id, name), processes(id, process_types(name))')
      .lt('event_date', today)
      .order('event_date', { ascending: false })
      .limit(10),
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário</h1>
          <p className="text-slate-500 text-sm mt-1">{upcoming?.length ?? 0} evento(s) próximo(s)</p>
        </div>
        <CreateEventModal clients={clients ?? []} profileId={profile!.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Próximos Eventos</h2>
            </div>
            {!upcoming || upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CalendarDays className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-400">Nenhum evento próximo</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {upcoming.map((ev: any) => <EventCard key={ev.id} event={ev} />)}
              </div>
            )}
          </Card>
        </div>

        {/* Past events */}
        <div>
          <Card padding="none">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Eventos Passados</h2>
            </div>
            {!past || past.length === 0 ? (
              <p className="p-5 text-sm text-slate-400 text-center">Nenhum</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {past.map((ev: any) => (
                  <div key={ev.id} className="p-4">
                    <p className="text-sm font-medium text-slate-500 line-through">{ev.title}</p>
                    <p className="text-xs text-slate-400">{formatDate(ev.event_date)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
