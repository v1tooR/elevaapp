'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FolderOpen, FileText,
  Calendar, Bell, Settings, LogOut, ChevronRight,
  Building2, X, Banknote
} from 'lucide-react'
import type { UserRole } from '@/types/database'

interface SidebarProps {
  role: UserRole
  onClose?: () => void
  isMobile?: boolean
}

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/processos', label: 'Processos', icon: FolderOpen },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/calendario', label: 'Calendário', icon: Calendar },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/financeiro', label: 'Financeiro', icon: Banknote },
]

const superAdminNav = [
  ...adminNav,
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

const clientNav = [
  { href: '/minha-area', label: 'Minha Área', icon: LayoutDashboard },
  { href: '/minha-area/processos', label: 'Meus Processos', icon: FolderOpen },
  { href: '/minha-area/documentos', label: 'Documentos', icon: FileText },
  { href: '/minha-area/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/minha-area/calendario', label: 'Agenda', icon: Calendar },
]

export function Sidebar({ role, onClose, isMobile }: SidebarProps) {
  const pathname = usePathname()

  const navItems = role === 'cliente'
    ? clientNav
    : role === 'super_admin'
      ? superAdminNav
      : adminNav

  return (
    <aside className="flex flex-col h-full bg-slate-900 text-slate-300 w-64">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Eleva</p>
            <p className="text-xs text-slate-400 leading-tight">Isenções</p>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/minha-area' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
