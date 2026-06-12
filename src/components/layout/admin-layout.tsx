'use client'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface AdminLayoutProps {
  children: React.ReactNode
  profile: Profile | null
}

export function AdminLayout({ children, profile }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar role={profile?.role ?? 'analista'} />
      </div>

      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Sidebar
          role={profile?.role ?? 'analista'}
          isMobile
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          profile={profile}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
