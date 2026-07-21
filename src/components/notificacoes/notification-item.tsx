'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, FileText, Activity } from 'lucide-react'
import Link from 'next/link'
import type { NotificationType } from '@/types/database'

const TYPE_CFG: Record<NotificationType, {
  label:     string
  icon:      React.ElementType
  dot:       string
  iconBg:    string
  border:    string
}> = {
  info:     { label: 'Info',       icon: Info,          dot: '#3b82f6', iconBg: '#eff6ff', border: '#3b82f6' },
  warning:  { label: 'Aviso',      icon: AlertTriangle, dot: '#f59e0b', iconBg: '#fffbeb', border: '#f59e0b' },
  success:  { label: 'Sucesso',    icon: CheckCircle,   dot: '#10b981', iconBg: '#ecfdf5', border: '#10b981' },
  error:    { label: 'Erro',       icon: XCircle,       dot: '#ef4444', iconBg: '#fef2f2', border: '#ef4444' },
  document: { label: 'Documento',  icon: FileText,      dot: '#a855f7', iconBg: '#faf5ff', border: '#a855f7' },
  status:   { label: 'Status',     icon: Activity,      dot: '#6366f1', iconBg: '#eef2ff', border: '#6366f1' },
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'agora'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `${h}h`
  const d = Math.floor(h / 24)
  if (d === 1)   return 'ontem'
  if (d < 7)     return `${d}d`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

export function NotificationItem({ notification }: { notification: any }) {
  const router = useRouter()
  const cfg = TYPE_CFG[notification.type as NotificationType] ?? { label: 'Info', icon: Bell, dot: '#64748b', iconBg: '#f8fafc', border: '#64748b' }
  const Icon = cfg.icon
  const unread = !notification.is_read

  const markRead = async () => {
    if (notification.is_read) return
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
    router.refresh()
  }

  const href = notification.process_id
    ? `/processos/${notification.process_id}`
    : notification.client_id
    ? `/clientes/${notification.client_id}`
    : null

  const inner = (
    <div
      onClick={markRead}
      className="flex gap-3.5 px-4 py-4 cursor-pointer transition-colors hover:bg-slate-50/80 group relative"
      style={unread ? { borderLeft: `3px solid ${cfg.border}` } : { borderLeft: '3px solid transparent' }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: cfg.iconBg, border: `1px solid ${cfg.dot}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: cfg.dot }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`dash text-sm leading-snug ${unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
            {notification.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="dash text-[11px] text-slate-400 whitespace-nowrap">
              {relativeTime(notification.available_at ?? notification.created_at)}
            </span>
            {unread && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
            )}
          </div>
        </div>

        {notification.message && (
          <p className="dash text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
            {notification.message}
          </p>
        )}

        {/* Meta tags */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className="dash text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: cfg.dot + '15', color: cfg.dot }}
          >
            {cfg.label}
          </span>
          {notification.clients?.name && (
            <span className="dash text-[11px] text-slate-500 font-medium">
              · {notification.clients.name}
            </span>
          )}
          {notification.processes?.process_types?.name && (
            <span className="dash text-[11px] text-slate-400">
              {notification.processes.process_types.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : inner
}
