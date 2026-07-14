import { createClient } from '@/lib/supabase/server'
import { DocumentStatusBadge } from '@/components/shared/status-badge'
import { DocumentActions } from '@/components/documentos/document-actions'
import { DocFilters } from '@/components/documentos/doc-filters'
import { formatDate } from '@/lib/utils'
import { FileText, Link2, ArrowUpRight, Plus } from 'lucide-react'
import Link from 'next/link'

const DOC_TYPE_LABELS: Record<string, string> = {
  laudo:       'Laudo Médico',
  rg:          'RG / CNH',
  cpf:         'CPF',
  residencia:  'Comp. Residência',
  nota_fiscal: 'Nota Fiscal',
  contrato:    'Contrato',
  procuracao:  'Procuração',
  certidao:    'Certidão',
  protocolo:   'Protocolo',
  formulario:  'Formulário',
  outros:      'Outros',
}

const DOC_TYPES_OPTIONS = Object.entries(DOC_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

const DOC_TYPE_COLORS: Record<string, string> = {
  laudo:       '#8B5CF6',
  rg:          '#3B82F6',
  cpf:         '#06B6D4',
  residencia:  '#10B981',
  nota_fiscal: '#F59E0B',
  contrato:    '#F97316',
  procuracao:  '#EC4899',
  certidao:    '#6366F1',
  protocolo:   '#0EA5E9',
  formulario:  '#14B8A6',
  outros:      '#94A3B8',
}

const STATUS_UI: Record<string, { pill: string; active: string; dot: string; label: string }> = {
  received:        { dot: '#3B82F6', label: 'Recebido',    pill: 'bg-blue-50 text-blue-700 border-blue-200',       active: 'bg-blue-600 text-white border-blue-600' },
  under_review:    { dot: '#F59E0B', label: 'Em Revisão',  pill: 'bg-amber-50 text-amber-700 border-amber-200',    active: 'bg-amber-500 text-white border-amber-500' },
  approved:        { dot: '#10B981', label: 'Aprovado',    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  rejected:        { dot: '#EF4444', label: 'Reprovado',   pill: 'bg-red-50 text-red-700 border-red-200',          active: 'bg-red-600 text-white border-red-600' },
  resend_required: { dot: '#F97316', label: 'Reenvio',     pill: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-500 text-white border-orange-500' },
}

interface SearchParams { status?: string; type?: string; client_id?: string }

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const statusFilter  = params.status    ?? ''
  const typeFilter    = params.type      ?? ''
  const clientFilter  = params.client_id ?? ''

  const supabase = await createClient()

  const [{ data: allDocs }, { data: clients }] = await Promise.all([
    supabase.from('documents').select('id, status'),
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
  ])

  let query = supabase
    .from('documents')
    .select('*, clients(id, name), processes(id, process_types(name))')
    .order('created_at', { ascending: false })

  if (statusFilter)  query = query.eq('status', statusFilter)
  if (typeFilter)    query = query.eq('document_type', typeFilter)
  if (clientFilter)  query = query.eq('client_id', clientFilter)

  const { data: documents } = await query

  const counts = {
    total:        allDocs?.length ?? 0,
    received:     allDocs?.filter(d => d.status === 'received').length ?? 0,
    under_review: allDocs?.filter(d => d.status === 'under_review').length ?? 0,
    approved:     allDocs?.filter(d => d.status === 'approved').length ?? 0,
    rejected:     allDocs?.filter(d => d.status === 'rejected').length ?? 0,
  }

  const activeStatusLabel = statusFilter ? (STATUS_UI[statusFilter]?.label ?? statusFilter) : null

  const quickStatuses = ['received', 'under_review', 'approved', 'rejected', 'resend_required']

  const buildHref = (overrides: Record<string, string>) => {
    const vals = { status: statusFilter, type: typeFilter, client_id: clientFilter, ...overrides }
    const p = new URLSearchParams()
    Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v) })
    return `/documentos?${p.toString()}`
  }

  const hasFilters = !!(statusFilter || typeFilter || clientFilter)

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .doc-row { transition: background 0.12s; }
        .doc-row:hover { background: #F8FAFC; }
        .doc-row:hover .doc-name { color: #2563EB; }
        .stat-chip { transition: all 0.15s; }
        .stat-chip:hover { background: rgba(255,255,255,0.2); }
        .pill { transition: all 0.15s; }
      `}</style>

      <div className="space-y-5">

        {/* ── Banner ──────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative px-6 pt-6 pb-4">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-primary-foreground/75" />
                </div>
                <div>
                  <h1 className="dash text-white text-2xl lg:text-3xl font-bold leading-tight">Documentos</h1>
                  <p className="dash text-primary-foreground/65 text-sm mt-0.5">
                    {counts.total} documento{counts.total !== 1 ? 's' : ''}
                    {activeStatusLabel && <> · <span className="text-white/90">{activeStatusLabel}</span></>}
                  </p>
                </div>
              </div>
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Total',      value: counts.total,        href: buildHref({ status: '' }), active: !statusFilter },
                { label: 'Recebidos',  value: counts.received,     href: buildHref({ status: 'received' }),     active: statusFilter === 'received',     dot: '#3B82F6' },
                { label: 'Em Revisão', value: counts.under_review, href: buildHref({ status: 'under_review' }), active: statusFilter === 'under_review', dot: '#F59E0B' },
                { label: 'Aprovados',  value: counts.approved,     href: buildHref({ status: 'approved' }),     active: statusFilter === 'approved',     dot: '#10B981' },
                { label: 'Reprovados', value: counts.rejected,     href: buildHref({ status: 'rejected' }),     active: statusFilter === 'rejected',     dot: '#EF4444' },
              ].map(chip => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="stat-chip flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold dash"
                  style={chip.active
                    ? { background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }
                  }
                >
                  {chip.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: chip.dot }} />}
                  <span>{chip.label}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                    style={{ background: chip.active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', color: chip.active ? '#fff' : 'rgba(255,255,255,0.7)' }}
                  >
                    {chip.value}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filtros ─────────────────────────────────────────────── */}
        <div
          className="anim anim-1 bg-white rounded-2xl p-4"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {/* Status pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Link
              href={buildHref({ status: '' })}
              className={`pill dash text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${!statusFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}
            >
              Todos
            </Link>
            {quickStatuses.map(s => {
              const c = STATUS_UI[s]
              if (!c) return null
              return (
                <Link
                  key={s}
                  href={buildHref({ status: s })}
                  className={`pill dash text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${statusFilter === s ? c.active : c.pill}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: statusFilter === s ? 'white' : c.dot, opacity: statusFilter === s ? 0.8 : 1 }}
                  />
                  {c.label}
                </Link>
              )
            })}
          </div>

          {/* Type + client selects */}
          <div className="flex gap-3 flex-wrap items-center">
            <DocFilters
              clients={(clients ?? []) as { id: string; name: string }[]}
              docTypes={DOC_TYPES_OPTIONS}
              typeFilter={typeFilter}
              clientFilter={clientFilter}
              statusFilter={statusFilter}
            />
            {hasFilters && (
              <Link
                href="/documentos"
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors dash shrink-0"
              >
                Limpar filtros
              </Link>
            )}
          </div>
        </div>

        {/* ── Tabela ──────────────────────────────────────────────── */}
        <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {!documents || documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Link2 className="w-7 h-7 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="dash font-semibold text-slate-700">Nenhum documento encontrado</p>
                <p className="text-sm text-slate-400 mt-1 dash">
                  {hasFilters ? 'Tente ajustar os filtros acima' : 'Acesse um processo e adicione links do Drive'}
                </p>
              </div>
              {hasFilters && (
                <Link
                  href="/documentos"
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors dash"
                >
                  Limpar filtros
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Documento</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Tipo</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Cliente</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Processo</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Data</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {(documents as any[]).map(doc => {
                    const typeColor = DOC_TYPE_COLORS[doc.document_type] ?? '#94A3B8'
                    return (
                      <tr key={doc.id} className="doc-row border-b border-slate-50 last:border-0">
                        {/* Nome */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: `${typeColor}18` }}
                            >
                              <FileText className="w-4 h-4" style={{ color: typeColor }} />
                            </div>
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="doc-name dash font-semibold text-slate-900 transition-colors truncate max-w-[160px] flex items-center gap-1.5"
                              title={doc.file_name}
                            >
                              <span className="truncate">{doc.file_name}</span>
                              <ArrowUpRight className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100" />
                            </a>
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="px-5 py-4 hidden md:table-cell">
                          {doc.document_type ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold dash"
                              style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor }} />
                              {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                            </span>
                          ) : (
                            <span className="text-slate-300 dash text-xs">—</span>
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="px-5 py-4 hidden md:table-cell">
                          {doc.clients ? (
                            <Link
                              href={`/clientes/${doc.clients.id}`}
                              className="dash text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-1"
                            >
                              {doc.clients.name}
                            </Link>
                          ) : (
                            <span className="text-slate-300 dash text-xs">—</span>
                          )}
                        </td>

                        {/* Processo */}
                        <td className="px-5 py-4 hidden lg:table-cell">
                          {doc.processes?.process_types?.name ? (
                            <Link
                              href={`/processos/${doc.process_id}`}
                              className="dash text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                            >
                              {doc.processes.process_types.name}
                              <ArrowUpRight className="w-3 h-3 opacity-50" />
                            </Link>
                          ) : (
                            <span className="text-slate-300 dash text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <DocumentStatusBadge status={doc.status} />
                        </td>

                        {/* Data */}
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <span className="dash text-xs text-slate-400">{formatDate(doc.created_at)}</span>
                        </td>

                        {/* Ações */}
                        <td className="px-5 py-4 text-right">
                          <DocumentActions document={doc} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        {documents && documents.length > 0 && (
          <p className="text-center text-xs text-slate-400 dash pb-2">
            Exibindo <span className="font-semibold text-slate-600">{documents.length}</span> documento{documents.length !== 1 ? 's' : ''}
            {hasFilters && ' (filtrado)'}
          </p>
        )}
      </div>
    </>
  )
}
