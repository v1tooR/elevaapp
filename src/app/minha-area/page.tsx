import { getClientPortalHome } from '@/lib/client-portal'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatCPF, formatPhone } from '@/lib/utils'
import { FolderOpen, FileText, Bell, Phone, Mail, User, ChevronRight, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function MinhaAreaPage() {
  const { profile, client, processes, notifications, counts } = await getClientPortalHome()

  const firstName = profile?.name?.split(' ')[0] ?? 'Cliente'
  const initials = profile?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'
  const totalProcesses = counts.total
  const concluded = counts.concluded
  const unreadNotifs = counts.unread
  const inProgress = counts.inProgress

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.45s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.12s; }
        .anim-3 { animation-delay: 0.19s; }
        .anim-4 { animation-delay: 0.26s; }
        .anim-5 { animation-delay: 0.33s; }
        .process-row:hover { background: #FBF8F6; }
      `}</style>

      <div className="dash space-y-5">

        {/* ── Hero Banner ────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.08]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #A14F2A, transparent 70%)' }} />

          <div className="relative p-6 sm:p-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide uppercase mb-0.5" style={{ color: 'rgba(201,122,82,0.75)' }}>Portal do Cliente</p>
                <h1 className="text-white text-2xl font-bold leading-tight">Olá, {firstName}!</h1>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>Acompanhe seus processos em tempo real</p>
              </div>
            </div>
            {unreadNotifs > 0 && (
              <Link
                href="/minha-area/notificacoes"
                className="shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-3 py-2 transition-colors"
              >
                <Bell className="w-4 h-4 text-amber-300" />
                <span className="text-white text-xs font-semibold">{unreadNotifs} nova{unreadNotifs > 1 ? 's' : ''}</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────── */}
        <div className="anim anim-1 grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(161,79,42,0.1)' }}>
              <FolderOpen style={{ width: 18, height: 18, color: '#A14F2A' }} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalProcesses}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total de processos</p>
          </div>

          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <Clock style={{ width: 18, height: 18 }} className="text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{inProgress}</p>
            <p className="text-xs text-slate-500 mt-0.5">Em andamento</p>
          </div>

          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <CheckCircle2 style={{ width: 18, height: 18 }} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{concluded}</p>
            <p className="text-xs text-slate-500 mt-0.5">Concluídos</p>
          </div>

          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center mb-3">
              <Bell style={{ width: 18, height: 18 }} className="text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{unreadNotifs}</p>
            <p className="text-xs text-slate-500 mt-0.5">Notificações</p>
          </div>
        </div>

        {/* ── Main Grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Processos */}
          <div className="anim anim-2 lg:col-span-2 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(161,79,42,0.1)' }}>
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: '#A14F2A' }} />
                </div>
                <h2 className="font-bold text-slate-900 text-sm">Meus Processos</h2>
              </div>
              <Link
                href="/minha-area/processos"
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-75"
                style={{ color: '#A14F2A' }}
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {!processes || processes.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <FolderOpen className="w-7 h-7 text-slate-200" />
                </div>
                <p className="text-sm font-medium text-slate-400">Nenhum processo cadastrado</p>
                <p className="text-xs text-slate-300 mt-1">Seus processos aparecerão aqui</p>
              </div>
            ) : (
              <div>
                {processes.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/minha-area/processos/${p.id}`}
                    className="process-row flex items-center gap-4 px-5 py-3.5 border-b border-slate-50 last:border-0 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-2 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: p.process_types?.color ?? '#A14F2A' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.process_types?.name ?? 'Processo'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.protocol && <span className="text-[11px] text-slate-400">Protocolo: {p.protocol}</span>}
                        <span className="text-[11px] text-slate-300">{formatDate(p.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ProcessStatusBadge status={p.status} />
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {unreadNotifs > 0 && (
              <div className="anim anim-3 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center">
                      <Bell className="w-3 h-3 text-rose-500" />
                    </div>
                    <h2 className="font-bold text-slate-900 text-xs">Notificações</h2>
                  </div>
                  <Link href="/minha-area/notificacoes" className="text-[10px] font-medium transition-colors hover:opacity-75" style={{ color: '#A14F2A' }}>
                    Ver todas
                  </Link>
                </div>
                <div>
                  {notifications!.slice(0, 3).map((n: any) => (
                    <div key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 leading-tight">{n.title}</p>
                          {n.message && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {client && (
              <div className="anim anim-4 bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm">Meus Dados</h2>
                </div>

                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6B3019, #A14F2A)' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{client.name}</p>
                    <p className="text-[11px] text-slate-400">Cliente</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {client.cpf && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-8 shrink-0">CPF</span>
                      <span className="text-xs text-slate-700 font-medium">{formatCPF(client.cpf)}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="text-xs text-slate-700">{formatPhone(client.phone)}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="text-xs text-slate-700 truncate">{client.email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="anim anim-5 bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 className="font-bold text-slate-900 text-xs mb-3">Acesso rápido</h2>
              <div className="space-y-1.5">
                {[
                  { href: '/minha-area/processos',   label: 'Meus processos', icon: FolderOpen, color: '#A14F2A', bg: 'rgba(161,79,42,0.1)' },
                  { href: '/minha-area/documentos',  label: 'Documentos',     icon: FileText,  color: '#425438', bg: 'rgba(66,84,56,0.1)'  },
                  { href: '/minha-area/notificacoes',label: 'Notificações',   icon: Bell,      color: '#C97A52', bg: 'rgba(201,122,82,0.1)' },
                ].map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: item.bg }}>
                      <item.icon style={{ width: 14, height: 14, color: item.color }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors flex-1">{item.label}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
