import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import {
  CLIENT_DOCUMENT_STATE_LABELS,
  CLIENT_SUMMARY_COLUMNS,
  normalizeClientSummaryColumns,
  type ClientDocumentState,
  type CompleteClientRow,
} from '@/lib/client-summary'
import { LEAD_SERVICE_OPTIONS } from '@/lib/lead-eligibility'
import { createClient } from '@/lib/supabase/server'
import { cn, formatCPF, formatCurrency, formatDate, formatPhone } from '@/lib/utils'
import type { ProcessStatus } from '@/types/database'

type ParamValue = string | string[] | undefined
interface SearchParams {
  q?: ParamValue
  page?: ParamValue
  contrato?: ParamValue
  servico?: ParamValue
  responsavel?: ParamValue
  indicacao?: ParamValue
  concessionaria?: ParamValue
  cin?: ParamValue
  credencial?: ParamValue
  de?: ParamValue
  ate?: ParamValue
  cols?: ParamValue
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  google: 'Google',
  indicacao: 'Indicação',
  vendedor: 'Vendedor/indicador',
  outros: 'Outros',
}

function first(value: ParamValue) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function EmptyValue({ children = '—' }: { children?: ReactNode }) {
  return <span className="text-slate-300">{children}</span>
}

function ServiceCell({ status, stage, fallback, validUntil }: {
  status: ProcessStatus | null
  stage: string | null
  fallback?: string | null
  validUntil?: string | null
}) {
  if (!status) {
    if (!fallback && !validUntil) return <EmptyValue />
    return <div className="space-y-1">{fallback && <p className="text-xs font-medium text-slate-600">{fallback}</p>}{validUntil && <p className="text-[11px] font-medium text-amber-700">Válido até {formatDate(validUntil)}</p>}</div>
  }
  return <div className="space-y-1.5"><ProcessStatusBadge status={status} />{stage && <p className="max-w-40 text-[11px] leading-snug text-slate-500">{stage}</p>}{validUntil && <p className="text-[11px] font-medium text-amber-700">Válido até {formatDate(validUntil)}</p>}</div>
}

function DocumentCell({ state, status, stage, validUntil }: {
  state: ClientDocumentState
  status: ProcessStatus | null
  stage: string | null
  validUntil: string | null
}) {
  if (state === 'em_andamento' && status) return <ServiceCell status={status} stage={stage} validUntil={validUntil} />
  const styles: Record<ClientDocumentState, string> = {
    vigente: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    em_andamento: 'border-blue-200 bg-blue-50 text-blue-700',
    vencido: 'border-red-200 bg-red-50 text-red-700',
    nao_possui: 'border-slate-200 bg-slate-50 text-slate-500',
  }
  return <div className="space-y-1.5"><span className={cn('inline-flex rounded-full border px-2 py-1 text-[10px] font-bold', styles[state])}>{CLIENT_DOCUMENT_STATE_LABELS[state]}</span>{validUntil && <p className="text-[11px] text-slate-500">Validade: {formatDate(validUntil)}</p>}</div>
}

function hiddenInputs(values: Record<string, string>) {
  return Object.entries(values).filter(([, value]) => value).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const filters = {
    q: first(params.q).trim(),
    contrato: first(params.contrato),
    servico: first(params.servico),
    responsavel: first(params.responsavel),
    indicacao: first(params.indicacao),
    concessionaria: first(params.concessionaria).trim(),
    cin: first(params.cin),
    credencial: first(params.credencial),
    de: first(params.de),
    ate: first(params.ate),
  }
  const selectedColumns = normalizeClientSummaryColumns(params.cols)
  const visible = new Set(selectedColumns)
  const page = Math.max(1, Number.parseInt(first(params.page) || '1', 10) || 1)
  const perPage = 25
  const supabase = await createClient()

  let query = supabase
    .from('client_complete_rows')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('client_name')
    .range((page - 1) * perPage, page * perPage - 1)
  if (filters.q) query = query.ilike('search_text', `%${filters.q}%`)
  if (filters.contrato === 'com') query = query.not('contract_id', 'is', null)
  if (filters.contrato === 'sem') query = query.is('contract_id', null)
  if (filters.servico) query = query.contains('service_keys', [filters.servico])
  if (filters.responsavel) query = query.eq('commercial_owner_id', filters.responsavel)
  if (filters.indicacao) query = query.eq('referral_partner_id', filters.indicacao)
  if (filters.concessionaria) query = query.ilike('dealership', `%${filters.concessionaria}%`)
  if (filters.cin) query = query.eq('cin_document_state', filters.cin)
  if (filters.credencial) query = query.eq('credential_document_state', filters.credencial)
  if (filters.de) query = query.gte('client_created_at', `${filters.de}T00:00:00`)
  if (filters.ate) query = query.lte('client_created_at', `${filters.ate}T23:59:59`)

  const [clientResult, ownerResult, partnerResult] = await Promise.all([
    query,
    supabase.from('profiles').select('id, name').in('role', ['super_admin', 'admin']).eq('is_active', true).order('name'),
    supabase.from('referral_partners').select('id, name').eq('is_active', true).order('name'),
  ])
  if (clientResult.error) throw new Error(`Não foi possível carregar a visão completa de clientes: ${clientResult.error.message}`)
  const clients = (clientResult.data ?? []) as CompleteClientRow[]
  const count = clientResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / perPage))

  const appendParams = (overrides: Record<string, string | null> = {}) => {
    const values = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) values.set(key, value)
    for (const column of selectedColumns) values.append('cols', column)
    for (const [key, value] of Object.entries(overrides)) {
      values.delete(key)
      if (value) values.set(key, value)
    }
    return values
  }
  const pageUrl = (nextPage: number) => `/clientes?${appendParams({ page: String(nextPage) }).toString()}`
  const exportParams = appendParams()
  exportParams.delete('page')
  const hasAdvancedFilters = Object.entries(filters).some(([key, value]) => key !== 'q' && Boolean(value))

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl p-6 text-white lg:p-8" style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><Users className="h-6 w-6 text-white/80" /></span><div><h1 className="text-2xl font-bold lg:text-3xl">Visão completa de clientes</h1><p className="mt-0.5 text-sm text-white/65">{count} cliente{count === 1 ? '' : 's'} · comercial, compra e documentos</p></div></div>
          <div className="flex flex-wrap gap-2"><a href={`/api/clientes/resumo/export?${exportParams.toString()}`} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"><Download className="h-4 w-4" /> Exportar CSV</a><Link href="/clientes/novo" className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20"><Plus className="h-4 w-4" /> Novo cliente</Link></div>
        </div>
      </section>

      <form method="get" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={filters.q} placeholder="Cliente, CPF, e-mail, serviço, indicação ou compra" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-amber-500 focus:bg-white" /></label>
          <select name="servico" defaultValue={filters.servico} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"><option value="">Todos os serviços</option>{LEAD_SERVICE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <button className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800">Consultar</button>
          <Link href="/clientes" className="flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600">Limpar</Link>
        </div>
        <details open={hasAdvancedFilters} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Filtros avançados</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <select name="contrato" defaultValue={filters.contrato} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Com ou sem contrato</option><option value="com">Com contrato</option><option value="sem">Sem contrato</option></select>
            <select name="responsavel" defaultValue={filters.responsavel} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Todos os responsáveis</option>{(ownerResult.data ?? []).map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select>
            <select name="indicacao" defaultValue={filters.indicacao} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Todas as indicações</option>{(partnerResult.data ?? []).map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select>
            <input name="concessionaria" defaultValue={filters.concessionaria} placeholder="Concessionária" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
            <select name="cin" defaultValue={filters.cin} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Qualquer situação da CIN</option>{Object.entries(CLIENT_DOCUMENT_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select name="credencial" defaultValue={filters.credencial} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Qualquer situação da Credencial</option>{Object.entries(CLIENT_DOCUMENT_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Cadastro de<input type="date" name="de" defaultValue={filters.de} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700" /></label>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Cadastro até<input type="date" name="ate" defaultValue={filters.ate} className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700" /></label>
          </div>
        </details>
        {selectedColumns.map(column => <input key={column} type="hidden" name="cols" value={column} />)}
      </form>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><Columns3 className="h-4 w-4" /> Escolher colunas</summary>
        <form method="get" className="mt-3 border-t border-slate-100 pt-3">
          {hiddenInputs(filters)}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{CLIENT_SUMMARY_COLUMNS.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-600"><input type="checkbox" name="cols" value={key} defaultChecked={visible.has(key)} /> {label}</label>)}</div>
          <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Aplicar colunas</button>
        </form>
      </details>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {clients.length === 0 ? <div className="flex flex-col items-center justify-center gap-3 py-20 text-center"><Users className="h-8 w-8 text-slate-300" /><div><p className="font-semibold text-slate-700">Nenhum cliente encontrado</p><p className="mt-1 text-sm text-slate-400">Ajuste os filtros ou cadastre um novo cliente.</p></div></div> : <>
          <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[2050px] text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="sticky left-0 z-10 min-w-64 bg-slate-50 px-4 py-3">Cliente</th>{visible.has('email') && <th className="min-w-56 px-4 py-3">E-mail</th>}{visible.has('cadastro') && <th className="px-4 py-3">Cadastro</th>}{visible.has('servicos') && <th className="min-w-56 px-4 py-3">Serviços</th>}{visible.has('contrato') && <th className="px-4 py-3">Contrato</th>}{visible.has('valor') && <th className="px-4 py-3">Valor</th>}{visible.has('responsavel') && <th className="px-4 py-3">Responsável</th>}{visible.has('indicacao') && <th className="px-4 py-3">Indicação</th>}{visible.has('concessionaria') && <th className="px-4 py-3">Concessionária</th>}{visible.has('vendedor') && <th className="px-4 py-3">Vendedor da concessionária</th>}{visible.has('compra') && <th className="px-4 py-3">Compra</th>}{visible.has('troca') && <th className="px-4 py-3">Próxima troca</th>}{visible.has('cnh') && <th className="px-4 py-3">CNH</th>}{visible.has('cin') && <th className="px-4 py-3">CIN</th>}{visible.has('credencial') && <th className="px-4 py-3">Credencial</th>}<th /></tr></thead>
            <tbody className="divide-y divide-slate-100">{clients.map(client => <tr key={client.client_id} className="align-top hover:bg-slate-50/70"><td className="sticky left-0 z-10 bg-white px-4 py-4"><Link href={`/clientes/${client.client_id}`} className="font-semibold text-slate-900 hover:text-amber-700">{client.client_name}</Link><p className="mt-1 text-xs text-slate-400">{client.client_cpf ? formatCPF(client.client_cpf) : 'CPF não informado'}</p>{client.client_phone && <p className="mt-0.5 text-xs text-slate-500">{formatPhone(client.client_phone)}</p>}</td>
              {visible.has('email') && <td className="max-w-64 break-words px-4 py-4 text-xs text-slate-700">{client.client_email ? <a href={`mailto:${client.client_email}`} className="hover:text-amber-700 hover:underline">{client.client_email}</a> : <EmptyValue>E-mail não informado</EmptyValue>}</td>}
              {visible.has('cadastro') && <td className="px-4 py-4 text-xs text-slate-500">{formatDate(client.client_created_at)}</td>}
              {visible.has('servicos') && <td className="px-4 py-4 text-xs text-slate-700">{client.service_names?.join(', ') || <EmptyValue />}</td>}
              {visible.has('contrato') && <td className="px-4 py-4">{client.contract_label ? <div><p className="font-medium text-slate-800">{client.contract_label}</p><p className="mt-1 text-[11px] text-slate-400">{client.contracted_at ? formatDate(client.contracted_at) : ''}{client.contract_status ? ` · ${client.contract_status}` : ''}</p></div> : <EmptyValue>Sem contrato</EmptyValue>}</td>}
              {visible.has('valor') && <td className="px-4 py-4 font-semibold text-slate-800">{client.contract_value != null ? formatCurrency(Number(client.contract_value)) : <EmptyValue />}</td>}
              {visible.has('responsavel') && <td className="px-4 py-4 text-slate-700">{client.commercial_owner_name ?? <EmptyValue />}</td>}
              {visible.has('indicacao') && <td className="px-4 py-4">{client.indication_name ? <div><p className="font-medium text-slate-800">{client.indication_name}</p><p className="mt-1 text-[11px] text-slate-400">{SOURCE_LABELS[client.lead_source ?? ''] ?? client.lead_source}</p></div> : client.lead_source ? SOURCE_LABELS[client.lead_source] ?? client.lead_source : <EmptyValue />}</td>}
              {visible.has('concessionaria') && <td className="px-4 py-4 text-slate-700">{client.dealership ?? <EmptyValue />}</td>}
              {visible.has('vendedor') && <td className="px-4 py-4 text-slate-700">{client.salesperson ?? <EmptyValue />}</td>}
              {visible.has('compra') && <td className="px-4 py-4">{client.purchase_vehicle ? <div><p className="font-medium text-slate-800">{client.purchase_vehicle}</p>{client.vehicle_price != null && <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(Number(client.vehicle_price))}</p>}{client.purchase_date && <p className="mt-1 text-[11px] text-slate-400">Compra: {formatDate(client.purchase_date)}</p>}</div> : <EmptyValue />}</td>}
              {visible.has('troca') && <td className="px-4 py-4 text-slate-700">{client.next_vehicle_change_date ? formatDate(client.next_vehicle_change_date) : <EmptyValue />}</td>}
              {visible.has('cnh') && <td className="px-4 py-4"><ServiceCell status={client.cnh_process_status} stage={client.cnh_stage_label} fallback={client.cnh_expiry_date ? `Vence ${formatDate(client.cnh_expiry_date)}` : client.cnh_status} validUntil={client.cnh_process_status ? client.cnh_expiry_date : null} /></td>}
              {visible.has('cin') && <td className="px-4 py-4"><DocumentCell state={client.cin_document_state} status={client.cin_process_status} stage={client.cin_stage_label} validUntil={client.cin_valid_until} /></td>}
              {visible.has('credencial') && <td className="px-4 py-4"><DocumentCell state={client.credential_document_state} status={client.credential_process_status} stage={client.credential_stage_label} validUntil={client.credential_valid_until} /></td>}
              <td className="px-4 py-4"><Link href={`/clientes/${client.client_id}`} aria-label={`Abrir ${client.client_name}`} className="text-amber-700"><ArrowUpRight className="h-4 w-4" /></Link></td></tr>)}</tbody></table></div>

          <div className="divide-y divide-slate-100 xl:hidden">{clients.map(client => <article key={client.client_id} className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/clientes/${client.client_id}`} className="font-semibold text-slate-900">{client.client_name}</Link><p className="mt-1 text-xs text-slate-400">{client.client_cpf ? formatCPF(client.client_cpf) : 'CPF não informado'}{client.client_phone ? ` · ${formatPhone(client.client_phone)}` : ''}</p><p className="mt-1 break-all text-xs text-slate-500">{client.client_email ?? 'E-mail não informado'}</p><p className="mt-1 text-[11px] text-slate-400">Cadastro: {formatDate(client.client_created_at)}{client.commercial_owner_name ? ` · ${client.commercial_owner_name}` : ''}</p></div><Link href={`/clientes/${client.client_id}`} className="shrink-0 text-amber-700"><ArrowUpRight className="h-4 w-4" /></Link></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400"><FileText className="h-3 w-3" /> Contrato e serviços</span><p className="mt-1.5 text-sm font-semibold text-slate-800">{client.contract_label ?? 'Sem contrato'}</p><p className="mt-1 text-xs text-slate-500">{client.contract_value != null ? formatCurrency(Number(client.contract_value)) : 'Valor não informado'}</p><p className="mt-1 text-xs text-slate-500">{client.service_names?.join(', ') || 'Sem serviços'}</p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><span className="text-[10px] font-semibold uppercase text-slate-400">Indicação</span><p className="mt-1.5 text-sm font-semibold text-slate-800">{client.indication_name ?? (client.lead_source ? SOURCE_LABELS[client.lead_source] ?? client.lead_source : 'Não informada')}</p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:col-span-2"><span className="text-[10px] font-semibold uppercase text-slate-400">Compra</span><p className="mt-1.5 text-sm font-semibold text-slate-800">{client.purchase_vehicle ?? 'Veículo não definido'}</p><p className="mt-1 text-xs text-slate-500">{[client.dealership, client.salesperson].filter(Boolean).join(' · ') || 'Concessionária e vendedor não informados'}</p>{client.next_vehicle_change_date && <p className="mt-1 text-xs text-amber-700">Próxima troca: {formatDate(client.next_vehicle_change_date)}</p>}</div></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><div className="rounded-xl border border-slate-100 p-2.5"><p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-400">CNH</p><ServiceCell status={client.cnh_process_status} stage={client.cnh_stage_label} fallback={client.cnh_status} validUntil={client.cnh_expiry_date} /></div><div className="rounded-xl border border-slate-100 p-2.5"><p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-400">CIN</p><DocumentCell state={client.cin_document_state} status={client.cin_process_status} stage={client.cin_stage_label} validUntil={client.cin_valid_until} /></div><div className="rounded-xl border border-slate-100 p-2.5"><p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-400">Credencial</p><DocumentCell state={client.credential_document_state} status={client.credential_process_status} stage={client.credential_stage_label} validUntil={client.credential_valid_until} /></div></div></article>)}</div>
        </>}
      </section>

      {totalPages > 1 && <nav className="flex items-center justify-center gap-2"><Link href={pageUrl(Math.max(1, page - 1))} aria-disabled={page <= 1} className={cn('flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium', page <= 1 ? 'pointer-events-none border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white text-slate-700')}><ChevronLeft className="h-4 w-4" /> Anterior</Link><span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500"><strong className="text-slate-900">{page}</strong> de {totalPages}</span><Link href={pageUrl(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className={cn('flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium', page >= totalPages ? 'pointer-events-none border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white text-slate-700')}>Próxima <ChevronRight className="h-4 w-4" /></Link></nav>}
    </div>
  )
}
