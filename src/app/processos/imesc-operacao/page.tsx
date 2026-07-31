import { AlertTriangle, Stethoscope } from 'lucide-react'
import { ImescKanbanBoard } from '@/components/processos/imesc-kanban-board'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type {
  ImescBoardStatus,
  ImescOperationalStatus,
  DisabilitySeverity,
} from '@/types/database'

export const metadata = { title: 'Operação IMESC — Eleva Isenções' }

export interface ImescBoardRow {
  id: string
  client_id: string
  board_status: ImescBoardStatus
  operational_status: ImescOperationalStatus
  responsible_user_id: string | null
  ipi_process_id: string | null
  ipva_process_id: string | null
  protocol: string | null
  scheduled_date: string | null
  examination_date: string | null
  report_issued_at: string | null
  report_valid_until: string | null
  source_classification: DisabilitySeverity | 'sem_deficiencia' | null
  notes: string | null
  started_at: string
  completed_at: string | null
  updated_at: string
  client: { id: string; name: string; cpf: string | null; phone: string | null } | null
  responsible: { id: string; name: string } | null
  ipi_process: { id: string; protocol: string | null; status: string } | null
  ipva_process: { id: string; protocol: string | null; status: string } | null
}

export interface ImescClientOption {
  id: string
  name: string
  cpf: string | null
}

export interface ImescStaffOption {
  id: string
  name: string
}

export interface ImescProcessOption {
  id: string
  client_id: string
  slug: 'processo_ipi' | 'processo_ipva'
  protocol: string | null
  status: string
}

type ProcessTypeRelation = { slug: string } | { slug: string }[] | null

function relationSlug(relation: ProcessTypeRelation) {
  return Array.isArray(relation) ? relation[0]?.slug : relation?.slug
}

export default async function ImescOperationsPage() {
  await requireAuth(['super_admin', 'admin', 'analista'])
  const supabase = await createClient()

  const [followupsResult, clientsResult, staffResult, processesResult] = await Promise.all([
    supabase
      .from('imesc_followups')
      .select(`
        *,
        client:clients!client_id(id, name, cpf, phone),
        responsible:profiles!responsible_user_id(id, name),
        ipi_process:processes!ipi_process_id(id, protocol, status),
        ipva_process:processes!ipva_process_id(id, protocol, status)
      `)
      .order('updated_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, name, cpf')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, name')
      .in('role', ['super_admin', 'admin', 'analista'])
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('processes')
      .select('id, client_id, protocol, status, process_types!inner(slug)')
      .in('process_types.slug', ['processo_ipi', 'processo_ipva'])
      .not('status', 'in', '(arquivado,cancelado)')
      .order('created_at', { ascending: false }),
  ])

  const processOptions = (processesResult.data ?? [])
    .map(process => ({
      id: process.id,
      client_id: process.client_id,
      protocol: process.protocol,
      status: process.status,
      slug: relationSlug(process.process_types as ProcessTypeRelation),
    }))
    .filter((process): process is ImescProcessOption => (
      process.slug === 'processo_ipi' || process.slug === 'processo_ipva'
    ))

  const loadError = followupsResult.error
    || clientsResult.error
    || staffResult.error
    || processesResult.error

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1A17] via-[#6B3019] to-[#A14F2A] p-5 text-white lg:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/[0.04]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Stethoscope className="h-5 w-5 text-white/85" />
            </div>
            <div className="min-w-0">
              <h1 className="dash text-xl font-bold sm:text-2xl">Operação IMESC</h1>
              <p className="dash mt-1 text-xs text-white/65 sm:text-sm">
                Classificação e acompanhamento independentes do IPI e do IPVA.
              </p>
            </div>
          </div>
          <span className="dash rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold">
            {(followupsResult.data ?? []).length} acompanhamento(s)
          </span>
        </div>
      </section>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="dash text-sm font-semibold">Não foi possível carregar a operação IMESC.</p>
            <p className="dash mt-0.5 text-xs text-red-700">
              Verifique se a migration 025 foi aplicada e tente novamente.
            </p>
          </div>
        </div>
      )}

      <ImescKanbanBoard
        initialRows={(followupsResult.data ?? []) as unknown as ImescBoardRow[]}
        clients={(clientsResult.data ?? []) as ImescClientOption[]}
        staff={(staffResult.data ?? []) as ImescStaffOption[]}
        processes={processOptions}
      />
    </div>
  )
}
