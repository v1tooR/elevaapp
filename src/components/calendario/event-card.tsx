'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  pending: 'border-l-yellow-400',
  in_progress: 'border-l-blue-400',
  completed: 'border-l-green-400',
  canceled: 'border-l-slate-300',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  canceled: 'Cancelado',
}

export function EventCard({ event }: { event: any }) {
  const router = useRouter()

  const updateStatus = async (status: string) => {
    const supabase = createClient()
    await supabase.from('calendar_events').update({ status }).eq('id', event.id)
    router.refresh()
  }

  return (
    <div className={cn('flex gap-4 p-4 border-l-4 hover:bg-slate-50 transition-colors', statusColors[event.status] ?? 'border-l-slate-200')}>
      <div className="w-14 flex flex-col items-center justify-center bg-slate-50 rounded-lg p-2 flex-shrink-0 text-center">
        <span className="text-[10px] font-medium text-slate-500 uppercase">
          {new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
        </span>
        <span className="text-xl font-bold text-slate-800 leading-none">
          {new Date(event.event_date + 'T00:00:00').getDate()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{event.title}</p>
            {event.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{event.description}</p>}
            <div className="flex flex-wrap gap-x-3 mt-1.5">
              {event.event_time && <span className="text-xs text-slate-400">{event.event_time.slice(0, 5)}</span>}
              {event.clients?.name && (
                <Link href={`/clientes/${event.clients.id}`} className="text-xs text-blue-500 hover:underline">{event.clients.name}</Link>
              )}
              {event.processes?.process_types?.name && (
                <span className="text-xs text-slate-400">{event.processes.process_types.name}</span>
              )}
              {event.responsible_user?.name && (
                <span className="text-xs text-slate-400">· {event.responsible_user.name}</span>
              )}
            </div>
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">{statusLabels[event.status]}</span>
        </div>
      </div>
      {event.status !== 'completed' && event.status !== 'canceled' && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => updateStatus('completed')} className="p-1 rounded hover:bg-green-50 text-green-500" title="Concluir">
            <CheckCircle className="w-4 h-4" />
          </button>
          <button onClick={() => updateStatus('canceled')} className="p-1 rounded hover:bg-red-50 text-red-400" title="Cancelar">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
