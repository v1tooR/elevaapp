import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Bell } from 'lucide-react'
import { MarkAllReadButton } from '@/components/notificacoes/mark-all-read'
import { NotificationItem } from '@/components/notificacoes/notification-item'

export default async function ClienteNotificacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*, clients(name), processes(id, process_types(name))')
    .eq('user_id', profile!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const unread = (notifications ?? []).filter((n: any) => !n.is_read).length

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
          <p className="text-slate-500 text-sm mt-1">{unread} não lida{unread !== 1 ? 's' : ''}</p>
        </div>
        {unread > 0 && <MarkAllReadButton profileId={profile!.id} />}
      </div>
      <Card padding="none">
        {!notifications || notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Bell className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-400">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifications.map((n: any) => <NotificationItem key={n.id} notification={n} />)}
          </div>
        )}
      </Card>
    </div>
  )
}
