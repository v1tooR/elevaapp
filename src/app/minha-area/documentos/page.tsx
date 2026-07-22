import { getClientPortalDocuments } from '@/lib/client-portal'
import { DocumentStatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import {
  FileText, ArrowLeft, ExternalLink,
  CheckCircle2, Clock, AlertTriangle, FileCheck, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'

type DocFilter = 'todos' | 'pendentes' | 'em_analise' | 'aprovados' | 'atencao'

const PENDING_STATUSES   = ['pending', 'received']
const REVIEW_STATUSES    = ['under_review']
const APPROVED_STATUSES  = ['approved']
const ATTENTION_STATUSES = ['rejected', 'resend_required']

function getFileExt(name: string) {
  return name?.split('.').pop()?.toLowerCase() ?? ''
}

function FileIcon({ name }: { name: string }) {
  const ext = getFileExt(name)
  const map: Record<string, { bg: string; color: string }> = {
    pdf:  { bg: 'bg-red-50',     color: 'text-red-500'    },
    doc:  { bg: 'bg-blue-50',    color: 'text-blue-500'   },
    docx: { bg: 'bg-blue-50',    color: 'text-blue-500'   },
    png:  { bg: 'bg-violet-50',  color: 'text-violet-500' },
    jpg:  { bg: 'bg-violet-50',  color: 'text-violet-500' },
    jpeg: { bg: 'bg-violet-50',  color: 'text-violet-500' },
    xls:  { bg: 'bg-emerald-50', color: 'text-emerald-500'},
    xlsx: { bg: 'bg-emerald-50', color: 'text-emerald-500'},
  }
  const style = map[ext] ?? { bg: 'bg-slate-50', color: 'text-slate-400' }
  return (
    <div className={`w-9 h-9 rounded-xl ${style.bg} flex flex-col items-center justify-center shrink-0`}>
      <FileText className={`w-4 h-4 ${style.color}`} />
    </div>
  )
}

export default async function ClienteDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const { filtro = 'todos' } = await searchParams

  const docs = await getClientPortalDocuments()

  const counts = {
    todos:      docs.length,
    pendentes:  docs.filter((d: any) => PENDING_STATUSES.includes(d.status)).length,
    em_analise: docs.filter((d: any) => REVIEW_STATUSES.includes(d.status)).length,
    aprovados:  docs.filter((d: any) => APPROVED_STATUSES.includes(d.status)).length,
    atencao:    docs.filter((d: any) => ATTENTION_STATUSES.includes(d.status)).length,
  }

  const filtered =
    filtro === 'pendentes'  ? docs.filter((d: any) => PENDING_STATUSES.includes(d.status))   :
    filtro === 'em_analise' ? docs.filter((d: any) => REVIEW_STATUSES.includes(d.status))    :
    filtro === 'aprovados'  ? docs.filter((d: any) => APPROVED_STATUSES.includes(d.status))  :
    filtro === 'atencao'    ? docs.filter((d: any) => ATTENTION_STATUSES.includes(d.status)) :
    docs

  const filters: { key: DocFilter; label: string; icon: any; activeClass: string }[] = [
    { key: 'todos',      label: 'Todos',      icon: LayoutGrid,    activeClass: 'border-[#1E1A17] bg-[#1E1A17] text-white' },
    { key: 'pendentes',  label: 'Pendentes',  icon: Clock,         activeClass: 'border-amber-500  bg-amber-500  text-white' },
    { key: 'em_analise', label: 'Em análise', icon: FileCheck,     activeClass: 'border-violet-600 bg-violet-600 text-white' },
    { key: 'aprovados',  label: 'Aprovados',  icon: CheckCircle2,  activeClass: 'border-emerald-600 bg-emerald-600 text-white' },
    { key: 'atencao',    label: 'Atenção',    icon: AlertTriangle, activeClass: 'border-red-500    bg-red-500    text-white' },
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
        .drow:hover { background: #FBF8F6; }
      `}</style>

      <div className="dash space-y-5">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-10 -left-10 w-44 h-44 rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, #A14F2A, transparent 70%)' }} />

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
                    <FileText style={{ width: 18, height: 18, color: '#C97A52' }} />
                  </div>
                  <h1 className="text-white text-2xl font-bold">Meus Documentos</h1>
                </div>
                <p className="text-sm" style={{ color: 'rgba(201,122,82,0.6)' }}>Gerencie os arquivos dos seus processos</p>
              </div>

              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-white text-lg font-bold leading-none">{counts.todos}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>total</p>
                </div>
                {counts.atencao > 0 && (
                  <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-1.5 text-center">
                    <p className="text-red-300 text-lg font-bold leading-none">{counts.atencao}</p>
                    <p className="text-red-300/70 text-[10px] mt-0.5">atenção</p>
                  </div>
                )}
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-center">
                  <p className="text-emerald-300 text-lg font-bold leading-none">{counts.aprovados}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>aprovado</p>
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
                href={`/minha-area/documentos?filtro=${f.key}`}
                className={`
                  inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all
                  ${active ? f.activeClass : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
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

        {/* ── Document list ────────────────────────────────────────── */}
        <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-sm font-semibold text-slate-400">Nenhum documento encontrado</p>
              <p className="text-xs text-slate-300 mt-1.5 max-w-xs">
                {filtro === 'todos'
                  ? 'Os documentos dos seus processos aparecerão aqui'
                  : 'Sem documentos com esse status no momento'}
              </p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <span className="col-span-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arquivo</span>
                <span className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:block">Processo</span>
                <span className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <span className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden lg:block">Data</span>
              </div>

              {filtered.map((doc: any) => {
                const ext = getFileExt(doc.file_name ?? '')
                const needsAttention = ATTENTION_STATUSES.includes(doc.status)

                return (
                  <div
                    key={doc.id}
                    className={`drow grid grid-cols-12 gap-3 items-center px-5 py-4 border-b border-slate-50 last:border-0 transition-colors ${needsAttention ? 'bg-red-50/30' : ''}`}
                  >
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <FileIcon name={doc.file_name ?? ''} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{doc.file_name ?? 'Arquivo'}</p>
                        <span className="text-[10px] font-bold uppercase text-slate-300 tracking-wider">{ext || '—'}</span>
                      </div>
                    </div>

                    <div className="col-span-3 hidden md:block min-w-0">
                      <p className="text-xs text-slate-500 truncate">
                        {doc.processes?.process_types?.name ?? <span className="text-slate-300">—</span>}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <DocumentStatusBadge status={doc.status} />
                    </div>

                    <div className="col-span-2 hidden lg:flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-[#A14F2A]/10 text-slate-300 hover:text-[#A14F2A] transition-colors cursor-pointer"
                          title="Visualizar"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="anim anim-3 text-center text-xs text-slate-400">
            {filtered.length} documento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </>
  )
}
