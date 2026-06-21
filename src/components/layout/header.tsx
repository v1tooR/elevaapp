'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface HeaderProps {
  onMenuClick: () => void
  profile?: Profile | null
}

export function Header({ onMenuClick, profile }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    const supabase = createClient()
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    }
    fetchUnread()
  }, [profile])

  const notifHref = profile?.role === 'cliente' ? '/minha-area/notificacoes' : '/notificacoes'

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Notifications */}
      <Link
        href={notifHref}
        title="Notificações"
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all duration-150 cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        )}
      </Link>
    </header>
  )
}
