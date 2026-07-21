import { createClient } from '@/lib/supabase/server'
import { Bell } from 'lucide-react'
import { MarkAllReadButton } from '@/components/notificacoes/mark-all-read'
import { NotificationItem } from '@/components/notificacoes/notification-item'
import Link from 'next/link'

export const metadata = { title: 'Notificações — Eleva Isenções' }

const TYPE_CFG: Record<string, { label: string; dot: string }> = {
  info:     { label: 'Info',       dot: '#3b82f6' },
  warning:  { label: 'Avisos',     dot: '#f59e0b' },
  success:  { label: 'Sucesso',    dot: '#10b981' },
  error:    { label: 'Erros',      dot: '#ef4444' },
  document: { label: 'Documentos', dot: '#a855f7' },
  status:   { label: 'Status',     dot: '#6366f1' },
}

type SearchParams = { type?: string }

function groupByDate(notifications: any[]) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  return {
    hoje:   notifications.filter(n => new Date(n.available_at ?? n.created_at) >= todayStart),
    semana: notifications.filter(n => new Date(n.available_at ?? n.created_at) >= weekStart && new Date(n.available_at ?? n.created_at) < todayStart),
    antigas:notifications.filter(n => new Date(n.available_at ?? n.created_at) < weekStart),
  }
}

export default async function NotificacoesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const typeFilter = params.type ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const availableNow = new Date().toISOString()

  // Fetch all for stat counts
  const { data: allNotifs } = await supabase
    .from('notifications')
    .select('id, type, is_read, created_at, available_at')
    .eq('user_id', profile!.id)
    .eq('is_canceled', false)
    .lte('available_at', availableNow)
    .order('available_at', { ascending: false })
    .limit(500)

  // Fetch filtered for display
  let query = supabase
    .from('notifications')
    .select('*, clients(id, name), processes(id, process_types(name))')
    .eq('user_id', profile!.id)
    .eq('is_canceled', false)
    .lte('available_at', availableNow)
    .order('available_at', { ascending: false })
    .limit(100)

  if (typeFilter) query = (query as any).eq('type', typeFilter)
  const { data: notifications } = await query

  const all = allNotifs ?? []
  const unreadCount = all.filter(n => !n.is_read).length
  const todayCount  = all.filter(n => new Date(n.available_at ?? n.created_at) >= todayStart).length
  const typeCounts  = all.reduce((acc: Record<string, number>, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1
    return acc
  }, {})

  const groups = groupByDate(notifications ?? [])
  const hasAny  = (notifications ?? []).length > 0

  const pillBase = "dash inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer"
  const pillActive = "bg-slate-900 text-white border-slate-900"
  const pillInactive = "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"

  return (
    <div className="space-y-5 max-w-2xl">
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-1 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
        .anim-2 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.07s both; }
        .anim-3 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.14s both; }
        .anim-4 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.21s both; }
      `}</style>

      {/* ── Dark banner ── */}
      <div className="anim-1 rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(ellipse at 75% 50%, #818cf8 0%, transparent 60%)' }} />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Bell className="w-6 h-6 text-indigo-400" />
                </div>
                {unreadCount > 0 && (
                  <span className="dash absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="dash text-2xl font-bold text-white">Notificações</h1>
                <p className="dash text-slate-400 text-sm mt-0.5">
                  {unreadCount === 0 ? 'Todas lidas' : `${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            {unreadCount > 0 && <MarkAllReadButton profileId={profile!.id} />}
          </div>

          {/* Stat chips */}
          <div className="flex gap-2 flex-wrap mt-4">
            {[
              { label: 'Total',        value: all.length,   bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' },
              { label: 'Não lidas',    value: unreadCount,  bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5' },
              { label: 'Hoje',         value: todayCount,   bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
            ].map(chip => (
              <div
                key={chip.label}
                className="dash flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: chip.bg, border: '1px solid rgba(255,255,255,0.08)', color: chip.color }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{chip.value}</span>
                {chip.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Type filter pills ── */}
      <div className="anim-2 flex gap-2 flex-wrap">
        <Link
          href="/notificacoes"
          className={`${pillBase} ${!typeFilter ? pillActive : pillInactive}`}
        >
          Todas
          <span className="dash text-[10px] font-bold opacity-60">{all.length}</span>
        </Link>
        {Object.entries(TYPE_CFG).map(([type, cfg]) => {
          const count = typeCounts[type] ?? 0
          if (count === 0) return null
          const isActive = typeFilter === type
          return (
            <Link
              key={type}
              href={`/notificacoes?type=${type}`}
              className={`${pillBase} ${isActive ? pillActive : pillInactive}`}
              style={isActive ? {} : {}}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
              {cfg.label}
              <span className="dash text-[10px] font-bold opacity-60">{count}</span>
            </Link>
          )
        })}
      </div>

      {/* ── Empty state ── */}
      {!hasAny && (
        <div className="anim-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-primary" />
            </div>
            <p className="dash text-base font-bold text-slate-700">Nenhuma notificação</p>
            <p className="dash text-sm text-slate-400 mt-1">
              {typeFilter ? `Sem notificações do tipo "${TYPE_CFG[typeFilter]?.label}"` : 'Tudo limpo por aqui'}
            </p>
          </div>
        </div>
      )}

      {/* ── Notification groups ── */}
      {([
        { key: 'hoje',    label: 'Hoje',         items: groups.hoje },
        { key: 'semana',  label: 'Esta semana',  items: groups.semana },
        { key: 'antigas', label: 'Anteriores',   items: groups.antigas },
      ] as const).map(({ key, label, items }, gi) => {
        if (items.length === 0) return null
        return (
          <section key={key} className={`anim-${gi + 3} space-y-2`}>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{label}</p>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-50">
                {items.map((n: any) => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
