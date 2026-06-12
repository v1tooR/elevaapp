import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { DocumentStatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import { FileText } from 'lucide-react'

export default async function ClienteDocumentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', profile!.id).single()

  if (!client) redirect('/minha-area')

  const { data: documents } = await supabase
    .from('documents')
    .select('*, processes(id, process_types(name))')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Meus Documentos</h1>
      <Card padding="none">
        {!documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-400">Nenhum documento enviado</p>
            <p className="text-sm text-slate-400 mt-1">Envie documentos dentro de cada processo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Arquivo</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden md:table-cell">Processo</th>
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
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-900 truncate max-w-[160px]">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell">
                      {doc.processes?.process_types?.name ?? '-'}
                    </td>
                    <td className="px-5 py-3.5"><DocumentStatusBadge status={doc.status} /></td>
                    <td className="px-5 py-3.5 text-slate-400 hidden lg:table-cell">{formatDate(doc.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Ver</a>
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
