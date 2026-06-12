import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { DocumentStatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { DocumentActions } from '@/components/documentos/document-actions'

interface SearchParams { status?: string; client_id?: string }

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''
  const clientFilter = params.client_id ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('documents')
    .select('*, clients(id, name), processes(id, process_types(name))')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)
  if (clientFilter) query = query.eq('client_id', clientFilter)

  const { data: documents } = await query

  const statuses = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendente' },
    { value: 'received', label: 'Recebido' },
    { value: 'under_review', label: 'Em Revisão' },
    { value: 'approved', label: 'Aprovado' },
    { value: 'rejected', label: 'Reprovado' },
    { value: 'resend_required', label: 'Reenvio Necessário' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
        <p className="text-slate-500 text-sm mt-1">{documents?.length ?? 0} documento(s)</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {statuses.map(s => (
          <Link
            key={s.value}
            href={`/documentos?status=${s.value}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <Card padding="none">
        {!documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhum documento encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Arquivo</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden md:table-cell">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden lg:table-cell">Processo</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[180px]">
                          {doc.file_name}
                        </a>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">
                      <Link href={`/clientes/${doc.clients?.id}`} className="hover:underline">{doc.clients?.name}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell">
                      {doc.processes?.process_types?.name ?? '-'}
                    </td>
                    <td className="px-5 py-3.5"><DocumentStatusBadge status={doc.status} /></td>
                    <td className="px-5 py-3.5 text-slate-400 hidden lg:table-cell">{formatDate(doc.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <DocumentActions document={doc} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
