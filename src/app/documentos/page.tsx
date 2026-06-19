import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { DocumentStatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import { Link2, FileText } from 'lucide-react'
import Link from 'next/link'
import { DocumentActions } from '@/components/documentos/document-actions'

const DOC_TYPE_LABELS: Record<string, string> = {
  laudo: 'Laudo Médico',
  rg: 'RG / CNH',
  cpf: 'CPF',
  residencia: 'Comprovante Residência',
  nota_fiscal: 'Nota Fiscal',
  contrato: 'Contrato',
  procuracao: 'Procuração',
  certidao: 'Certidão',
  protocolo: 'Protocolo',
  formulario: 'Formulário',
  outros: 'Outros',
}

interface SearchParams { status?: string; client_id?: string }

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('documents')
    .select('*, clients(id, name), processes(id, process_types(name))')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: documents } = await query

  const statuses = [
    { value: '', label: 'Todos' },
    { value: 'received', label: 'Recebido' },
    { value: 'under_review', label: 'Em Revisão' },
    { value: 'approved', label: 'Aprovado' },
    { value: 'rejected', label: 'Reprovado' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
        <p className="text-slate-500 text-sm mt-1">{documents?.length ?? 0} link(s) cadastrado(s)</p>
      </div>

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
            <Link2 className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhum documento cadastrado</p>
            <p className="text-xs text-slate-400 mt-1">Acesse um processo e adicione links do Drive</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Documento</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden md:table-cell">Tipo</th>
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
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline max-w-50 truncate"
                        title={doc.file_name}
                      >
                        <Link2 className="w-4 h-4 shrink-0 text-blue-400" />
                        <span className="truncate">{doc.file_name}</span>
                      </a>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell">
                      {doc.document_type ? (DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">
                      <Link href={`/clientes/${doc.clients?.id}`} className="hover:underline">
                        {doc.clients?.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell">
                      {doc.processes?.process_types?.name ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <DocumentStatusBadge status={doc.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 hidden lg:table-cell">
                      {formatDate(doc.created_at)}
                    </td>
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
