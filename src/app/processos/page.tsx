import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate, PROCESS_STATUS_LABELS } from '@/lib/utils'
import type { ProcessStatus } from '@/types/database'

interface SearchParams { status?: string; type_id?: string; client?: string; page?: string }

export default async function ProcessosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''
  const typeFilter = params.type_id ?? ''
  const clientFilter = params.client ?? ''
  const page = parseInt(params.page ?? '1')
  const perPage = 20

  const supabase = await createClient()

  const [{ data: processTypes }, { data: profiles }] = await Promise.all([
    supabase.from('process_types').select('id, name, slug').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, name').in('role', ['admin', 'analista', 'super_admin']).order('name'),
  ])

  let query = supabase
    .from('processes')
    .select(`
      *,
      clients(id, name, cpf),
      process_types(id, name, color),
      responsible_user:profiles!processes_responsible_user_id_fkey(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (typeFilter) query = query.eq('process_type_id', typeFilter)
  if (clientFilter) query = query.ilike('clients.name', `%${clientFilter}%`)

  const { data: processes, count } = await query
  const totalPages = Math.ceil((count ?? 0) / perPage)

  const statusOptions = Object.entries(PROCESS_STATUS_LABELS).map(([value, label]) => ({ value, label }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Processos</h1>
          <p className="text-slate-500 text-sm mt-1">{count ?? 0} processo(s)</p>
        </div>
        <Link
          href="/processos/novo"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Processo
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <form method="GET" className="flex flex-wrap gap-3">
          <select
            name="status"
            defaultValue={statusFilter}
            className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            name="type_id"
            defaultValue={typeFilter}
            className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os tipos</option>
            {(processTypes ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
              Filtrar
            </button>
            {(statusFilter || typeFilter) && (
              <Link href="/processos" className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                Limpar
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* Table */}
      <Card padding="none">
        {!processes || processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhum processo encontrado</p>
            <Link href="/processos/novo" className="mt-4 text-blue-600 text-sm hover:underline flex items-center gap-1">
              <Plus className="w-4 h-4" /> Criar processo
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden md:table-cell">Protocolo</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processes.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }} />
                        <span className="font-medium text-slate-900">{p.process_types?.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{p.clients?.name}</td>
                    <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell">{p.protocol ?? '-'}</td>
                    <td className="px-5 py-3.5"><ProcessStatusBadge status={p.status} /></td>
                    <td className="px-5 py-3.5 text-slate-400 hidden lg:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/processos/${p.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/processos?status=${statusFilter}&type_id=${typeFilter}&page=${page - 1}`} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Anterior</Link>
          )}
          <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={`/processos?status=${statusFilter}&type_id=${typeFilter}&page=${page + 1}`} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Próxima</Link>
          )}
        </div>
      )}
    </div>
  )
}
