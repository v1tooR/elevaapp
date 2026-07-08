'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell, Menu, Info, AlertTriangle, CheckCircle, XCircle,
  FileText, Activity, ArrowRight, CheckCheck, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface HeaderProps {
  onMenuClick: () => void
  profile?: Profile | null
}

const TYPE_CFG: Record<string, { icon: React.ElementType; dot: string; bg: string }> = {
  info:     { icon: Info,          dot: '#3b82f6', bg: '#eff6ff' },
  warning:  { icon: AlertTriangle, dot: '#f59e0b', bg: '#fffbeb' },
  success:  { icon: CheckCircle,   dot: '#10b981', bg: '#ecfdf5' },
  error:    { icon: XCircle,       dot: '#ef4444', bg: '#fef2f2' },
  document: { icon: FileText,      dot: '#a855f7', bg: '#faf5ff' },
  status:   { icon: Activity,      dot: '#6366f1', bg: '#eef2ff' },
}

function relativeTime(dateStr: string) {
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

export function Header({ onMenuClick, profile }: HeaderProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [markingAll, setMarkingAll] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef  = useRef<HTMLButtonElement>(null)

  const notifHref = profile?.role === 'cliente' ? '/minha-area/notificacoes' : '/notificacoes'
  const unread    = notifications.filter(n => !n.is_read)

  const fetchNotifs = useCallback(async () => {
    if (!profile) return
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(8)
    setNotifications(data ?? [])
  }, [profile])

  useEffect(() => {
    fetchNotifs()
  }, [fetchNotifs])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current  && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [open])

  const markRead = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    if (!profile || unread.length === 0) return
    setMarkingAll(true)
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setMarkingAll(false)
    router.refresh()
  }

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open) fetchNotifs()
  }

  return (
    <header
      className="h-14 flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-30"
      style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 rgba(161,79,42,0.04)',
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg transition-colors cursor-pointer"
        style={{ color: 'var(--muted-foreground)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Bell button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleOpen}
          aria-label="Notificações"
          className="relative p-2 rounded-lg transition-all duration-150 cursor-pointer"
          style={{
            color: open ? 'var(--terracotta)' : 'var(--muted-foreground)',
            background: open ? 'rgba(161,79,42,0.08)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (!open) {
              e.currentTarget.style.background = 'var(--muted)'
              e.currentTarget.style.color = 'var(--foreground)'
            }
          }}
          onMouseLeave={e => {
            if (!open) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }
          }}
        >
          <Bell className="w-5 h-5" />
          {unread.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* Popover */}
        {open && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl overflow-hidden z-50"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Notificações</h3>
                {unread.length > 0 && (
                  <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">
                    {unread.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread.length > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={markingAll}
                    title="Marcar todas como lidas"
                    className="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    style={{ color: 'var(--muted-foreground)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.color = 'var(--foreground)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
                  >
                    {markingAll
                      ? <span className="w-3.5 h-3.5 block rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                      : <CheckCheck className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.color = 'var(--foreground)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-slate-200" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Sem notificações</p>
                  <p className="text-xs text-slate-300 mt-1">Você está em dia!</p>
                </div>
              ) : (
                notifications.map(n => {
                  const cfg = TYPE_CFG[n.type] ?? { icon: Bell, dot: '#64748b', bg: '#f8fafc' }
                  const Icon = cfg.icon
                  const isUnread = !n.is_read

                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        markRead(n.id)
                        setOpen(false)
                      }}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isUnread ? 'bg-[#A14F2A]/4' : ''
                      }`}
                    >
                      {/* Unread indicator */}
                      <div className="relative shrink-0 mt-0.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: cfg.bg, border: `1px solid ${cfg.dot}20` }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: cfg.dot }} />
                        </div>
                        {isUnread && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white"
                            style={{ background: cfg.dot }}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs leading-snug ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                        {n.message && (
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
              <Link
                href={notifHref}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold transition-opacity hover:opacity-75"
                style={{ color: 'var(--primary)' }}
              >
                Ver todas as notificações
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
