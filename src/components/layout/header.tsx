'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Menu, Search } from 'lucide-react'
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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-4 lg:px-6 sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Link
          href={notifHref}
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-700">
              {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-900 leading-tight">{profile?.name}</p>
            <p className="text-xs text-slate-500 capitalize leading-tight">
              {profile?.role === 'super_admin' ? 'Super Admin' :
               profile?.role === 'admin' ? 'Admin' :
               profile?.role === 'analista' ? 'Analista' : 'Cliente'}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
