import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

export default async function ClienteCalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', profile!.id).single()

  if (!client) redirect('/minha-area')

  const { data: events } = await supabase
    .from('calendar_events')
    .select('*, processes(id, process_types(name))')
    .eq('client_id', client.id)
    .eq('visibility', 'client_visible')
    .order('event_date', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Minha Agenda</h1>
      <Card padding="none">
        {!events || events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-400">Nenhum evento agendado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {events.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-4 p-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-medium text-blue-500 uppercase">
                    {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold text-blue-600 leading-none">
                    {new Date(ev.event_date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{ev.title}</p>
                  {ev.description && <p className="text-sm text-slate-500 mt-0.5">{ev.description}</p>}
                  {ev.event_time && <p className="text-xs text-slate-400 mt-1">Horário: {ev.event_time.slice(0, 5)}</p>}
                  {ev.processes?.process_types?.name && (
                    <p className="text-xs text-slate-400">Processo: {ev.processes.process_types.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
