import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Filter, ListFilter, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProcessOperationalSummary, getStaffOperations } from '@/lib/staff-operations'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { SaveProcessFilter } from '@/components/processos/save-process-filter'
import { formatCPF, formatDate } from '@/lib/utils'

interface SearchParams {
  q?: string
  status?: string
  responsavel?: string
  prazo?: string
  etapa?: string
  pendencia?: string
  pagina?: string
}

function normalize(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export default async function ProcessListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const operations = await getStaffOperations()
  const supabase = await createClient()
  const [{ data: savedFilters }, { data: staff }] = await Promise.all([
    supabase.from('saved_filters').select('id, name, filters').eq('scope', 'processes').order('created_at'),
    supabase.from('profiles').select('id, name').in('role', ['super_admin', 'admin', 'analista']).eq('is_active', true).order('name'),
  ])

  const search = normalize(params.q)
  const pendingProcessIds = new Set(
    operations.routineItems
      .filter(item => !params.pendencia || item.category === params.pendencia)
      .map(item => item.processId)
      .filter((id): id is string => Boolean(id)),
  )
  const today = operations.today
  const inSevenDays = new Date(`${today}T12:00:00Z`)
  inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7)
  const sevenDayKey = inSevenDays.toISOString().slice(0, 10)

  const rows = operations.processes.filter(process => {
    const stages = operations.stagesByProcess.get(process.id) ?? []
    const operational = getProcessOperationalSummary({ process, stages })
    const haystack = normalize([
      process.clients?.name,
      process.clients?.cpf,
      process.protocol,
      process.process_types?.name,
      process.process_types?.slug,
    ].filter(Boolean).join(' '))
    const digits = (params.q ?? '').replace(/\D/g, '')
    if (search && !haystack.includes(search) && (!digits || !haystack.replace(/\D/g, '').includes(digits))) return false
    if (params.status && process.status !== params.status) return false
    if (params.responsavel === 'sem_responsavel' && process.responsible_user_id) return false
    if (params.responsavel && params.responsavel !== 'sem_responsavel' && process.responsible_user_id !== params.responsavel) return false
    if (params.etapa && !stages.some(stage => stage.stage_key === params.etapa && !['concluido', 'aprovado', 'reprovado', 'nao_aplicavel'].includes(stage.status))) return false
    if (params.pendencia && !pendingProcessIds.has(process.id)) return false
    if (params.prazo === 'vencido' && (!operational.dueDate || operational.dueDate >= today)) return false
    if (params.prazo === 'sete_dias' && (!operational.dueDate || operational.dueDate < today || operational.dueDate > sevenDayKey)) return false
    if (params.prazo === 'sem_prazo' && operational.dueDate) return false
    return true
  }).map(process => ({
    process,
    operational: getProcessOperationalSummary({ process, stages: operations.stagesByProcess.get(process.id) ?? [] }),
  }))

  const stageOptions = [...new Map(
    [...operations.stagesByProcess.values()].flat().map(stage => [stage.stage_key, stage.label]),
  ).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const pageSize = 25
  const requestedPage = Math.max(1, Number(params.pagina) || 1)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(requestedPage, pageCount)
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const currentFilters = Object.fromEntries(
    Object.entries(params).filter(([key, value]) => key !== 'pagina' && typeof value === 'string' && value),
  ) as Record<string, string>
  const filterHref = (filters: Record<string, string>) => {
    const query = new URLSearchParams(filters)
    return `/processos/lista${query.size ? `?${query.toString()}` : ''}`
  }
  const pageHref = (page: number) => filterHref({ ...currentFilters, pagina: String(page) })

  return (
    <div className="space-y-5">
      <section className="eleva-gradient-deep rounded-2xl p-6 lg:p-8">
        <Link href="/processos" className="dash inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Carteiras</Link>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><ListFilter className="h-5 w-5 text-white" /></div>
          <div><h1 className="dash text-3xl font-bold text-white">Lista unificada</h1><p className="dash mt-1 text-sm text-white/60">{rows.length} processo{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}</p></div>
        </div>
      </section>

      <section className="eleva-surface p-4">
        <form className="grid gap-3 lg:grid-cols-7" method="get">
          <label className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={params.q} placeholder="Nome, CPF, protocolo ou tipo" className="dash w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
          <select name="status" defaultValue={params.status} className="dash rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos os status</option><option value="aberto">Aberto</option><option value="em_andamento">Em andamento</option><option value="aguardando_documentos">Aguardando documentos</option><option value="em_analise">Em análise</option><option value="aguardando_orgao">Aguardando órgão</option><option value="concluido">Concluído</option><option value="arquivado">Arquivado</option><option value="cancelado">Cancelado</option></select>
          <select name="responsavel" defaultValue={params.responsavel} className="dash rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos responsáveis</option><option value="sem_responsavel">Sem responsável</option>{(staff ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select name="prazo" defaultValue={params.prazo} className="dash rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todos os prazos</option><option value="vencido">Vencidos</option><option value="sete_dias">Próximos 7 dias</option><option value="sem_prazo">Sem prazo</option></select>
          <select name="etapa" defaultValue={params.etapa} className="dash rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todas as etapas</option>{stageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="pendencia" defaultValue={params.pendencia} className="dash rounded-xl border border-input bg-card px-3 py-2.5 text-sm"><option value="">Todas as pendências</option><option value="etapa_vencida">Etapa vencida</option><option value="documento_analise">Documento</option><option value="sem_responsavel">Sem responsável</option><option value="autenticacao_cliente">Autenticação</option><option value="exigencia_medica">Exigência médica</option><option value="processo_parado">Parado</option></select>
          <div className="flex flex-wrap gap-2 lg:col-span-7"><button className="dash inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"><Filter className="h-3.5 w-3.5" /> Aplicar filtros</button><Link href="/processos/lista" className="dash rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground">Limpar</Link><SaveProcessFilter filters={currentFilters} /></div>
        </form>
        {(savedFilters ?? []).length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3"><span className="dash text-[11px] font-semibold text-muted-foreground">Filtros salvos:</span>{(savedFilters ?? []).map(item => <Link key={item.id} href={filterHref(item.filters as Record<string, string>)} className="dash rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-primary/10 hover:text-primary">{item.name}</Link>)}</div>}
      </section>

      <section className="eleva-surface overflow-hidden">
        {pageRows.length === 0 ? <p className="dash py-16 text-center text-sm text-muted-foreground">Nenhum processo encontrado com esses filtros.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/40"><tr><th className="px-5 py-3 text-left text-xs">Cliente / processo</th><th className="px-5 py-3 text-left text-xs">Etapa atual</th><th className="px-5 py-3 text-left text-xs">Próxima ação</th><th className="px-5 py-3 text-left text-xs">Prazo</th><th className="px-5 py-3 text-left text-xs">Responsável</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-border">{pageRows.map(({ process, operational }) => <tr key={process.id} className="hover:bg-muted/30"><td className="px-5 py-4"><p className="dash font-semibold text-foreground">{process.clients?.name}</p><p className="dash mt-0.5 text-xs text-muted-foreground">{process.process_types?.name}{process.clients?.cpf ? ` · ${formatCPF(process.clients.cpf)}` : ''}</p><div className="mt-2"><ProcessStatusBadge status={process.status} /></div></td><td className="px-5 py-4 text-xs text-muted-foreground">{operational.currentStage?.label ?? 'Sem etapa aberta'}</td><td className="px-5 py-4"><p className="dash max-w-56 text-xs font-medium text-foreground">{operational.nextAction}</p><p className="dash mt-1 text-[10px] text-muted-foreground">Ação: {operational.actor}</p>{operational.blocker && <p className="dash mt-1 text-[10px] font-semibold text-red-600">Bloqueio: {operational.blocker}</p>}</td><td className="px-5 py-4 text-xs"><span className={operational.dueDate && operational.dueDate < operations.today ? 'font-bold text-red-600' : 'text-muted-foreground'}>{operational.dueDate ? formatDate(operational.dueDate) : 'Sem prazo'}</span></td><td className="px-5 py-4 text-xs text-muted-foreground">{process.responsible_user?.name ?? 'Sem responsável'}</td><td className="px-5 py-4 text-right"><Link href={`/processos/${process.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Abrir <ArrowUpRight className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody></table></div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>Página {currentPage} de {pageCount}</span><div className="flex gap-2"><Link aria-disabled={currentPage <= 1} href={currentPage <= 1 ? pageHref(1) : pageHref(currentPage - 1)} className={`rounded-lg border px-3 py-1.5 ${currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}`}>Anterior</Link><Link aria-disabled={currentPage >= pageCount} href={currentPage >= pageCount ? pageHref(pageCount) : pageHref(currentPage + 1)} className={`rounded-lg border px-3 py-1.5 ${currentPage >= pageCount ? 'pointer-events-none opacity-40' : ''}`}>Próxima</Link></div></div>
      </section>
    </div>
  )
}
