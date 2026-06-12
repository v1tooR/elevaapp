'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime, NOTIFICATION_TYPE_COLORS } from '@/lib/utils'
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, FileText, Activity } from 'lucide-react'
import Link from 'next/link'
import type { NotificationType } from '@/types/database'

const icons: Record<NotificationType, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
  document: FileText,
  status: Activity,
}

export function NotificationItem({ notification }: { notification: any }) {
  const router = useRouter()
  const Icon = icons[notification.type as NotificationType] ?? Bell

  const markRead = async () => {
    if (notification.is_read) return
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
    router.refresh()
  }

  const href = notification.process_id ? `/processos/${notification.process_id}` : notification.clients ? `/clientes/${notification.client_id}` : null

  const content = (
    <div
      onClick={markRead}
      className={cn(
        'flex gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors',
        !notification.is_read && 'bg-blue-50/40'
      )}
    >
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100', NOTIFICATION_TYPE_COLORS[notification.type as NotificationType])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', !notification.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{notification.message}</p>
        <p className="text-xs text-slate-400 mt-1">{formatDateTime(notification.created_at)}</p>
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
