import { createClient } from '@/lib/supabase/server'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import { FolderOpen, ArrowLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, LayoutGrid } from 'lucide-react'
import Link from 'next/link'

type FilterKey = 'todos' | 'ativos' | 'aguardando' | 'concluidos'

const ACTIVE_STATUSES  = ['aberto', 'em_andamento', 'em_analise']
const WAITING_STATUSES = ['aguardando_documentos', 'aguardando_orgao']
const DONE_STATUSES    = ['concluido', 'arquivado', 'cancelado']

export default async function ClienteProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro = 'todos' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()
  const { data: client }  = await supabase.from('clients').select('id').eq('profile_id', profile!.id).single()

  const { data: allProcesses } = client ? await supabase
    .from('processes')
    .select('*, process_types(name, color, slug)')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false }) : { data: [] }

  const processes = allProcesses ?? []

  const counts = {
    todos:      processes.length,
    ativos:     processes.filter((p: any) => ACTIVE_STATUSES.includes(p.status)).length,
    aguardando: processes.filter((p: any) => WAITING_STATUSES.includes(p.status)).length,
    concluidos: processes.filter((p: any) => DONE_STATUSES.includes(p.status)).length,
  }

  const filtered =
    filtro === 'ativos'     ? processes.filter((p: any) => ACTIVE_STATUSES.includes(p.status))  :
    filtro === 'aguardando' ? processes.filter((p: any) => WAITING_STATUSES.includes(p.status)) :
    filtro === 'concluidos' ? processes.filter((p: any) => DONE_STATUSES.includes(p.status))    :
    processes

  const filters: { key: FilterKey; label: string; icon: any; accent: string }[] = [
    { key: 'todos',      label: 'Todos',        icon: LayoutGrid,   accent: 'border-[#1E1A17] bg-[#1E1A17] text-white' },
    { key: 'ativos',     label: 'Em andamento', icon: Clock,        accent: 'border-[#A14F2A] bg-[#A14F2A] text-white' },
    { key: 'aguardando', label: 'Aguardando',   icon: AlertCircle,  accent: 'border-amber-500  bg-amber-500  text-white' },
    { key: 'concluidos', label: 'Concluídos',   icon: CheckCircle2, accent: 'border-emerald-600 bg-emerald-600 text-white' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        .dash { font-family: 'DM Sans', sans-serif; }
        .dash h1, .dash h2, .dash h3 { font-family: 'Raleway', sans-serif; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.12s; }
        .anim-3 { animation-delay: 0.19s; }
        .prow:hover { background: #FBF8F6; }
      `}</style>

      <div className="dash space-y-5">

        {/* ── Hero banner ─────────────────────────────────────────── */}
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
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                    <FolderOpen style={{ width: 18, height: 18, color: '#C97A52' }} />
                  </div>
                  <h1 className="text-white text-2xl font-bold">Meus Processos</h1>
                </div>
                <p className="text-sm" style={{ color: 'rgba(201,122,82,0.6)' }}>Acompanhe o status de cada solicitação</p>
              </div>

              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-white text-lg font-bold leading-none">{counts.todos}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>total</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-amber-300 text-lg font-bold leading-none">{counts.aguardando}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>aguard.</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-emerald-300 text-lg font-bold leading-none">{counts.concluidos}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>concluído</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────── */}
        <div className="anim anim-1 flex items-center gap-2 flex-wrap">
          {filters.map(f => {
            const active = filtro === f.key
            return (
              <Link
                key={f.key}
                href={`/minha-area/processos?filtro=${f.key}`}
                className={`
                  inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all
                  ${active ? f.accent : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                `}
              >
                <f.icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} style={{ width: 14, height: 14 }} />
                {f.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {counts[f.key]}
                </span>
              </Link>
            )
          })}
        </div>

        {/* ── Process list ────────────────────────────────────────── */}
        <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-sm font-semibold text-slate-400">Nenhum processo encontrado</p>
              <p className="text-xs text-slate-300 mt-1">Tente outro filtro ou aguarde novos processos</p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <span className="col-span-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo / Protocolo</span>
                <span className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</span>
                <span className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <span className="col-span-1" />
              </div>

              {filtered.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/minha-area/processos/${p.id}`}
                  className="prow grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-slate-50 last:border-0 transition-colors cursor-pointer group"
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div
                      className="w-1.5 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: p.process_types?.color ?? '#A14F2A' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{p.process_types?.name ?? 'Processo'}</p>
                      {p.protocol
                        ? <p className="text-[11px] text-slate-400 mt-0.5 truncate"><span className="font-medium text-slate-500">#{p.protocol}</span></p>
                        : <p className="text-[11px] text-slate-300 mt-0.5">Sem protocolo</p>
                      }
                    </div>
                  </div>

                  <div className="col-span-3">
                    <p className="text-xs text-slate-500">{formatDate(p.created_at)}</p>
                  </div>

                  <div className="col-span-3">
                    <ProcessStatusBadge status={p.status} />
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="anim anim-3 text-center text-xs text-slate-400">
            {filtered.length} processo{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </>
  )
}
