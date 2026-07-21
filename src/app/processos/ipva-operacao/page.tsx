import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowUpRight, BadgeDollarSign, CheckCircle2, Clock3, FileSearch, Stethoscope } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { getIpvaOperationalBucket, IPVA_OPERATIONAL_BUCKETS, type IpvaOperationalBucket } from '@/lib/process-workflow'
import type { ProcessStage } from '@/types/database'

export const metadata = { title: 'Operação IMESC/IPVA — Eleva Isenções' }

interface QueueProcess {
  id: string
  protocol: string | null
  status: string
  created_at: string
  clients: { id: string; name: string } | null
  responsible_user: { id: string; name: string } | null
  stages: ProcessStage[] | null
}

const BUCKET_ICONS = {
  configuracao: AlertTriangle,
  pericia: Stethoscope,
  laudo: FileSearch,
  sefaz: Clock3,
  recurso: AlertTriangle,
  concluido: CheckCircle2,
} satisfies Record<IpvaOperationalBucket, typeof AlertTriangle>

const BUCKET_COLORS: Record<IpvaOperationalBucket, string> = {
  configuracao: '#64748B',
  pericia: '#A14F2A',
  laudo: '#8B5CF6',
  sefaz: '#3B82F6',
  recurso: '#EF4444',
  concluido: '#10B981',
}

export default async function IpvaOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>
}) {
  const { etapa } = await searchParams
  const selectedBucket = Object.hasOwn(IPVA_OPERATIONAL_BUCKETS, etapa ?? '')
    ? etapa as IpvaOperationalBucket
    : null
  const supabase = await createClient()

  const { data: processType } = await supabase
    .from('process_types')
    .select('id')
    .eq('slug', 'processo_ipva')
    .single()

  const { data } = processType
    ? await supabase
        .from('processes')
        .select('id, protocol, status, created_at, clients(id, name), responsible_user:profiles!responsible_user_id(id, name), stages:process_stages(*)')
        .eq('process_type_id', processType.id)
        .not('status', 'in', '(arquivado,cancelado)')
        .order('created_at', { ascending: false })
    : { data: [] }

  const processes = (data ?? []) as unknown as QueueProcess[]
  const rows = processes.map(process => ({
    ...process,
    bucket: getIpvaOperationalBucket(process.stages ?? []),
  }))
  const counts = Object.fromEntries(
    Object.keys(IPVA_OPERATIONAL_BUCKETS).map(key => [key, rows.filter(row => row.bucket === key).length]),
  ) as Record<IpvaOperationalBucket, number>
  const filteredRows = selectedBucket ? rows.filter(row => row.bucket === selectedBucket) : rows

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1A17] via-[#6B3019] to-[#A14F2A] p-6 text-white">
        <Link href="/processos" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Processos
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <BadgeDollarSign className="h-6 w-6 text-pink-200" />
            </div>
            <div>
              <h1 className="dash text-2xl font-bold">Operação IMESC/IPVA</h1>
              <p className="dash mt-1 text-sm text-white/65">Fila por etapa, prazos recursais e responsável</p>
            </div>
          </div>
          <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold">{rows.length} processo(s)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {(Object.keys(IPVA_OPERATIONAL_BUCKETS) as IpvaOperationalBucket[]).map(bucket => {
          const Icon = BUCKET_ICONS[bucket]
          const active = selectedBucket === bucket
          return (
            <Link
              key={bucket}
              href={active ? '/processos/ipva-operacao' : `/processos/ipva-operacao?etapa=${bucket}`}
              className={`rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4" style={{ color: active ? '#fff' : BUCKET_COLORS[bucket] }} />
                <span className="text-xl font-bold">{counts[bucket]}</span>
              </div>
              <p className={`mt-2 text-[11px] font-semibold ${active ? 'text-white/75' : 'text-slate-500'}`}>{IPVA_OPERATIONAL_BUCKETS[bucket]}</p>
            </Link>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="dash font-bold text-slate-900">{selectedBucket ? IPVA_OPERATIONAL_BUCKETS[selectedBucket] : 'Todos os processos IPVA'}</h2>
            <p className="dash mt-0.5 text-xs text-slate-400">{filteredRows.length} item(ns) na fila selecionada</p>
          </div>
          {selectedBucket && <Link href="/processos/ipva-operacao" className="text-xs font-semibold text-blue-600 hover:underline">Limpar filtro</Link>}
        </div>

        {filteredRows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-slate-400">Nenhum processo nesta etapa.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map(process => {
              const stages = [...(process.stages ?? [])].sort((a, b) => a.sort_order - b.sort_order)
              const currentStage = stages.find(stage => stage.status === 'em_andamento')
                ?? stages.find(stage => stage.status === 'pendente')
              const appealStage = stages.find(stage => stage.stage_key === 'ipva_recurso')
              return (
                <Link key={process.id} href={`/processos/${process.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
                  <div className="h-10 w-1 shrink-0 rounded-full" style={{ background: BUCKET_COLORS[process.bucket] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{process.clients?.name ?? 'Cliente não informado'}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{IPVA_OPERATIONAL_BUCKETS[process.bucket]}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{currentStage?.label ?? 'Workflow concluído'} · Resp.: {process.responsible_user?.name ?? 'Não atribuído'}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    {appealStage?.due_date ? (
                      <p className="text-xs font-bold text-red-600">Prazo {formatDate(appealStage.due_date)}</p>
                    ) : (
                      <p className="text-xs text-slate-400">Aberto em {formatDate(process.created_at)}</p>
                    )}
                    {process.protocol && <p className="mt-1 font-mono text-[10px] text-slate-400">{process.protocol}</p>}
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-blue-600" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

