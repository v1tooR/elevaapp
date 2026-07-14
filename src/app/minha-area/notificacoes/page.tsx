import { createClient } from '@/lib/supabase/server'
import { Bell, ArrowLeft, LayoutGrid, MailOpen } from 'lucide-react'
import Link from 'next/link'
import { MarkAllReadButton } from '@/components/notificacoes/mark-all-read'
import { NotificationItem } from '@/components/notificacoes/notification-item'

export default async function ClienteNotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro = 'todas' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('auth_user_id', user!.id).single()

  const { data: allNotifs } = await supabase
    .from('notifications')
    .select('*, clients(name), processes(id, process_types(name))')
    .eq('user_id', profile!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = allNotifs ?? []
  const unread = notifications.filter((n: any) => !n.is_read)
  const read   = notifications.filter((n: any) => n.is_read)

  const counts = {
    todas:     notifications.length,
    nao_lidas: unread.length,
    lidas:     read.length,
  }

  const filtered =
    filtro === 'nao_lidas' ? unread :
    filtro === 'lidas'     ? read   :
    notifications

  const filters = [
    { key: 'todas',     label: 'Todas',     icon: LayoutGrid, activeClass: 'border-[#1E1A17]  bg-[#1E1A17]  text-white' },
    { key: 'nao_lidas', label: 'Não lidas', icon: Bell,       activeClass: 'border-[#A14F2A]  bg-[#A14F2A]  text-white' },
    { key: 'lidas',     label: 'Lidas',     icon: MailOpen,   activeClass: 'border-slate-500  bg-slate-500  text-white' },
  ]

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.12s; }
        .anim-3 { animation-delay: 0.19s; }
      `}</style>

      <div className="dash space-y-5 max-w-2xl">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />

          <div className="relative p-6 sm:p-8">
            <Link
              href="/minha-area"
              className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors hover:text-white"
              style={{ color: 'rgba(201,122,82,0.75)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao início
            </Link>

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center relative">
                    <Bell style={{ width: 18, height: 18, color: '#C97A52' }} />
                    {unread.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 border border-white/20 text-white text-[9px] font-bold flex items-center justify-center">
                        {unread.length > 9 ? '9+' : unread.length}
                      </span>
                    )}
                  </div>
                  <h1 className="text-white text-2xl font-bold">Notificações</h1>
                </div>
                <p className="text-sm" style={{ color: 'rgba(201,122,82,0.6)' }}>
                  {unread.length > 0
                    ? `${unread.length} não lida${unread.length !== 1 ? 's' : ''} · ${notifications.length} total`
                    : 'Todas as notificações em dia'}
                </p>
              </div>

              {unread.length > 0 && <MarkAllReadButton profileId={profile!.id} />}
            </div>
          </div>
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────── */}
        <div className="anim anim-1 flex items-center gap-2">
          {filters.map(f => {
            const active = filtro === f.key
            return (
              <Link
                key={f.key}
                href={`/minha-area/notificacoes?filtro=${f.key}`}
                className={`
                  inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all
                  ${active ? f.activeClass : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                `}
              >
                <f.icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} style={{ width: 14, height: 14 }} />
                {f.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {counts[f.key as keyof typeof counts]}
                </span>
              </Link>
            )
          })}
        </div>

        {/* ── Notification list ───────────────────────────────────── */}
        <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                {filtro === 'lidas'
                  ? <MailOpen className="w-8 h-8 text-slate-200" />
                  : <Bell className="w-8 h-8 text-slate-200" />
                }
              </div>
              <p className="text-sm font-semibold text-slate-400">
                {filtro === 'nao_lidas' ? 'Nenhuma notificação não lida' :
                 filtro === 'lidas'     ? 'Nenhuma notificação lida ainda' :
                 'Nenhuma notificação'}
              </p>
              <p className="text-xs text-slate-300 mt-1.5">
                {filtro === 'todas'
                  ? 'Você será avisado sobre atualizações nos seus processos'
                  : 'Tente outro filtro'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((n: any) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="anim anim-3 text-center text-xs text-slate-400">
            {filtered.length} notificaç{filtered.length !== 1 ? 'ões' : 'ão'} · clique em cada uma para marcar como lida
          </p>
        )}
      </div>
    </>
  )
}
