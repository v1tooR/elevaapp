import Link from 'next/link'
import { ArrowUpRight, FileSearch, FileText, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DocumentStatusBadge } from '@/components/shared/status-badge'
import { DocumentActions } from '@/components/documentos/document-actions'
import { formatDate } from '@/lib/utils'
import type { Document, Profile } from '@/types/database'

const PAGE_SIZE = 25
const DOC_TYPE_LABELS: Record<string, string> = {
  laudo: 'Laudo Médico', rg: 'RG / CNH', cpf: 'CPF', residencia: 'Comp. Residência',
  nota_fiscal: 'Nota Fiscal', contrato: 'Contrato', procuracao: 'Procuração',
  certidao: 'Certidão', protocolo: 'Protocolo', formulario: 'Formulário', outros: 'Outros',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', received: 'Recebido', under_review: 'Em revisão', approved: 'Aprovado',
  rejected: 'Reprovado', resend_required: 'Reenvio solicitado',
}

interface SearchParams {
  q?: string
  status?: string
  type?: string
  client_id?: string
  reviewer?: string
  visibility?: string
  requested?: string
  page?: string
}

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const supabase = await createClient()

  const [
    { data: clients },
    { data: reviewerRows },
    { count: totalCount },
    { count: receivedCount },
    { count: reviewCount },
    { count: approvedCount },
    { count: rejectedCount },
  ] = await Promise.all([
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, name').in('role', ['super_admin', 'admin', 'analista']).eq('is_active', true).order('name'),
    supabase.from('documents').select('id', { count: 'exact', head: true }),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'received'),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ])

  let query = supabase
    .from('documents')
    .select(`
      *,
      clients(id, name),
      processes(id, process_types(name)),
      review_responsible:profiles!documents_review_responsible_id_fkey(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  const cleanSearch = (params.q ?? '').trim().replace(/[,()%]/g, ' ')
  if (cleanSearch) query = query.or(`file_name.ilike.%${cleanSearch}%,document_type.ilike.%${cleanSearch}%`)
  if (params.status) query = query.eq('status', params.status)
  if (params.type) query = query.eq('document_type', params.type)
  if (params.client_id) query = query.eq('client_id', params.client_id)
  if (params.reviewer === 'none') query = query.is('review_responsible_id', null)
  else if (params.reviewer) query = query.eq('review_responsible_id', params.reviewer)
  if (params.visibility) query = query.eq('visibility', params.visibility)
  if (params.requested === 'yes') query = query.not('requested_at', 'is', null)
  if (params.requested === 'no') query = query.is('requested_at', null)

  const from = (page - 1) * PAGE_SIZE
  const { data: documents, count: filteredCount, error } = await query.range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error('Não foi possível carregar a central de documentos.')

  const pageCount = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const reviewers = (reviewerRows ?? []) as Pick<Profile, 'id' | 'name'>[]
  const currentParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value)) as Record<string, string>
  const href = (overrides: Record<string, string>) => {
    const values = { ...currentParams, ...overrides }
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (value) search.set(key, value)
    return `/documentos${search.size ? `?${search.toString()}` : ''}`
  }

  const statCards = [
    ['Todos', totalCount ?? 0, ''], ['Recebidos', receivedCount ?? 0, 'received'],
    ['Em revisão', reviewCount ?? 0, 'under_review'], ['Aprovados', approvedCount ?? 0, 'approved'],
    ['Reprovados', rejectedCount ?? 0, 'rejected'],
  ] as const

  return (
    <div className="space-y-5">
      <section className="eleva-gradient-deep overflow-hidden rounded-2xl p-6 lg:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><FileSearch className="h-6 w-6 text-white" /></div>
          <div><h1 className="dash text-3xl font-bold text-white">Central de documentos</h1><p className="dash mt-1 text-sm text-white/60">Busca, revisão, responsabilidade e visibilidade em um único lugar.</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {statCards.map(([label, count, status]) => <Link key={label} href={href({ status, page: '' })} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${params.status === status || (!params.status && !status) ? 'border-white/30 bg-white/20 text-white' : 'border-white/10 bg-white/5 text-white/65'}`}>{label} <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5">{count}</span></Link>)}
        </div>
      </section>

      <section className="eleva-surface p-4">
        <form method="get" className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={params.q} placeholder="Nome ou tipo do documento" className="w-full rounded-xl border border-input py-2.5 pl-9 pr-3 text-sm" /></label>
          <select name="status" defaultValue={params.status} className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos os status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="type" defaultValue={params.type} className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos os tipos</option>{Object.entries(DOC_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="client_id" defaultValue={params.client_id} className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos os clientes</option>{(clients ?? []).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          <select name="reviewer" defaultValue={params.reviewer} className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos os revisores</option><option value="none">Sem revisor</option>{reviewers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="visibility" defaultValue={params.visibility} className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Toda visibilidade</option><option value="admin_only">Somente equipe</option><option value="client_visible">Visível ao cliente</option></select>
          <select name="requested" defaultValue={params.requested} className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Solicitados ou não</option><option value="yes">Documento solicitado</option><option value="no">Não solicitado</option></select>
          <div className="flex gap-2 xl:col-span-7"><button className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white">Aplicar filtros</button><Link href="/documentos" className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">Limpar</Link></div>
        </form>
      </section>

      <section className="eleva-surface overflow-hidden">
        {!documents?.length ? (
          <div className="py-20 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-semibold text-foreground">Nenhum documento encontrado</p><p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou adicione um documento dentro do processo.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-300 text-sm">
              <thead className="border-b border-border bg-muted/40"><tr>{['Documento', 'Cliente / processo', 'Status', 'Solicitado', 'Revisor', 'Visibilidade', 'Recebido em', 'Ações'].map(label => <th key={label} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{(documents as unknown as Array<Document & { clients?: { id: string; name: string }; processes?: { id: string; process_types?: { name: string } }; review_responsible?: { id: string; name: string } }>).map(doc => (
                <tr key={doc.id} className="align-top hover:bg-muted/20">
                  <td className="px-5 py-4"><a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-60 items-center gap-1 font-semibold text-primary hover:underline"><span className="truncate">{doc.file_name}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></a><p className="mt-1 text-[11px] text-muted-foreground">{DOC_TYPE_LABELS[doc.document_type ?? ''] ?? doc.document_type ?? 'Sem tipo'}</p></td>
                  <td className="px-5 py-4"><Link href={`/clientes/${doc.clients?.id}`} className="font-semibold text-foreground hover:text-primary">{doc.clients?.name ?? 'Cliente não informado'}</Link>{doc.process_id && <Link href={`/processos/${doc.process_id}`} className="mt-1 block text-xs text-muted-foreground hover:text-primary">{doc.processes?.process_types?.name ?? 'Abrir processo'}</Link>}</td>
                  <td className="px-5 py-4"><DocumentStatusBadge status={doc.status} /></td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{doc.requested_at ? <><span className="font-semibold text-amber-700">Sim</span><br />{formatDate(doc.requested_at)}</> : 'Não'}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{doc.review_responsible?.name ?? 'Não definido'}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${doc.visibility === 'client_visible' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{doc.visibility === 'client_visible' ? 'Cliente' : 'Somente equipe'}</span></td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(doc.created_at)}</td>
                  <td className="px-5 py-4"><DocumentActions document={doc} reviewers={reviewers} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>{filteredCount ?? 0} resultado{filteredCount === 1 ? '' : 's'} · página {currentPage} de {pageCount}</span><div className="flex gap-2"><Link aria-disabled={currentPage <= 1} href={href({ page: String(Math.max(1, currentPage - 1)) })} className={`rounded-lg border px-3 py-1.5 ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}>Anterior</Link><Link aria-disabled={currentPage >= pageCount} href={href({ page: String(Math.min(pageCount, currentPage + 1)) })} className={`rounded-lg border px-3 py-1.5 ${currentPage >= pageCount ? 'pointer-events-none opacity-40' : ''}`}>Próxima</Link></div></div>
      </section>
    </div>
  )
}
