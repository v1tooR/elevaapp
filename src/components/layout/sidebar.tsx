'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, Target, FolderOpen, FileText,
  Calendar, Bell, Settings, LogOut, Banknote, X, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ElevaIcon } from '@/components/brand/eleva-icon'
import type { Profile, UserRole } from '@/types/database'

interface SidebarProps {
  profile: Profile | null
  onClose?: () => void
  isMobile?: boolean
}

const adminNav = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, group: 'main'    },
  { href: '/clientes',     label: 'Clientes',     icon: Users,           group: 'main'    },
  { href: '/leads',        label: 'Leads',        icon: Target,          group: 'main'    },
  { href: '/processos',    label: 'Processos',    icon: FolderOpen,      group: 'main'    },
  { href: '/documentos',   label: 'Documentos',   icon: FileText,        group: 'main'    },
  { href: '/calendario',   label: 'Calendário',   icon: Calendar,        group: 'comms'   },
  { href: '/notificacoes', label: 'Notificações', icon: Bell,            group: 'comms',  badge: true },
]

const superAdminNav = [
  ...adminNav,
  { href: '/financeiro',    label: 'Financeiro',    icon: Banknote, group: 'finance' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, group: 'system'  },
]

const clientNav = [
  { href: '/minha-area',              label: 'Minha Área',     icon: LayoutDashboard, group: 'main'  },
  { href: '/minha-area/processos',    label: 'Meus Processos', icon: FolderOpen,      group: 'main'  },
  { href: '/minha-area/documentos',   label: 'Documentos',     icon: FileText,        group: 'main'  },
  { href: '/minha-area/notificacoes', label: 'Notificações',   icon: Bell,            group: 'comms', badge: true },
  { href: '/minha-area/calendario',   label: 'Agenda',         icon: Calendar,        group: 'comms' },
]

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  analista: 'Analista',
  cliente: 'Cliente',
}

export function Sidebar({ profile, onClose, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const role: UserRole = profile?.role ?? 'analista'
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    const supabase = createClient()
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .eq('is_canceled', false)
      .lte('available_at', new Date().toISOString())
      .then(({ count }) => setUnreadCount(count ?? 0))
  }, [profile?.id])

  const navItems = role === 'cliente'
    ? clientNav
    : role === 'super_admin'
      ? superAdminNav
      : adminNav

  const initials = profile?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <aside
      className="flex flex-col h-full w-64 shrink-0"
      style={{ background: '#1E1A17', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* ── Brand header ── */}
      <div
        className="flex items-center justify-between px-4 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 p-1.5"
            style={{ background: 'rgba(239,227,214,0.1)', border: '1px solid rgba(239,227,214,0.15)' }}
          >
            <ElevaIcon className="w-full h-full" fill="#efe3d6" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white tracking-widest leading-tight">ELEVA</p>
            <p className="sb text-[10px] leading-tight text-white/40" style={{ letterSpacing: '0.04em' }}>Isenções</p>
          </div>
        </div>

        {isMobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item, i) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' &&
              item.href !== '/minha-area' &&
              pathname.startsWith(item.href))

          const prev = navItems[i - 1]
          const showDivider = i > 0 && prev?.group !== item.group

          return (
            <div key={item.href}>
              {showDivider && <div className="my-2 mx-1 h-px bg-white/6" />}

              <Link
                href={item.href}
                onClick={onClose}
                className={cn(
                  'sb group flex items-center gap-3 py-2.5 pl-2.5 pr-3 rounded-xl text-sm',
                  'border-l-2 transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-[#A14F2A]/15 border-[#A14F2A] font-semibold'
                    : 'border-transparent font-medium hover:bg-white/6 hover:border-white/20'
                )}
              >
                {/* Icon */}
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors duration-200',
                    isActive
                      ? ''
                      : 'text-white/35 group-hover:text-[#C97A52]'
                  )}
                  style={isActive ? { color: '#C97A52' } : {}}
                />

                {/* Label */}
                <span
                  className={cn(
                    'sb flex-1 transition-colors duration-200',
                    isActive
                      ? 'text-white'
                      : 'text-white/50 group-hover:text-white'
                  )}
                >
                  {item.label}
                </span>

                {/* Notification badge */}
                {item.badge && unreadCount > 0 && (
                  <span className="sb text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white min-w-4.5 text-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}

                {/* Chevron — slides in on hover, always visible when active */}
                <ChevronRight
                  className={cn(
                    'w-3 h-3 shrink-0 transition-all duration-200',
                    isActive
                      ? 'opacity-100 translate-x-0'
                      : 'text-white/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'
                  )}
                  style={isActive ? { color: 'rgba(201,122,82,0.5)' } : {}}
                />
              </Link>
            </div>
          )
        })}
      </nav>

      {/* ── User card + logout ── */}
      <div className="p-3 space-y-1.5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* User info */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold sb"
            style={{ background: 'rgba(161,79,42,0.15)', color: '#C97A52', border: '1px solid rgba(161,79,42,0.25)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="sb text-xs font-semibold text-white truncate leading-tight">{profile?.name ?? 'Usuário'}</p>
            <p className="sb text-[10px] leading-tight truncate text-white/40">
              {ROLE_LABEL[role] ?? role}
            </p>
          </div>
        </div>

        {/* Logout — explicit, full-width */}
        <form action="/api/auth/logout" method="POST" className="w-full">
          <button
            type="submit"
            className={cn(
              'sb group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium',
              'text-white/40 hover:text-red-400 hover:bg-red-500/10',
              'border border-transparent hover:border-red-500/15',
              'transition-all duration-200 cursor-pointer'
            )}
          >
            <LogOut className="w-4 h-4 shrink-0 transition-colors duration-200 group-hover:text-red-400" />
            <span className="transition-colors duration-200">Sair da conta</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
