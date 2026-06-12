import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Plus, FolderOpen, FileText, Phone, Mail, MapPin, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatCPF, formatPhone, formatDate, formatDateTime } from '@/lib/utils'
import { EditClientModal } from '@/components/clientes/edit-client-modal'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: processes }, { data: documents }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('processes')
      .select('*, process_types(name, color, slug)')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('documents')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/clientes" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            CPF: {client.cpf ? formatCPF(client.cpf) : 'Não informado'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/processos/novo?client_id=${client.id}`}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Processo
          </Link>
          <EditClientModal client={client} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client data */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4">Dados do Cliente</h2>
            <div className="space-y-3">
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700">{formatPhone(client.phone)}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700">{client.email}</span>
                </div>
              )}
              {(client.city || client.state) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700">
                    {[client.city, client.state].filter(Boolean).join(' / ')}
                  </span>
                </div>
              )}
              {client.birth_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700">{formatDate(client.birth_date)}</span>
                </div>
              )}
              {client.rg && (
                <div className="text-sm">
                  <span className="text-slate-500">RG: </span>
                  <span className="text-slate-700">{client.rg}</span>
                </div>
              )}
              {client.address && (
                <div className="text-sm">
                  <span className="text-slate-500">Endereço: </span>
                  <span className="text-slate-700">{client.address}</span>
                </div>
              )}
            </div>
          </Card>

          {client.gov_password_reference && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-2">Gov.br</h2>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                {client.gov_password_reference}
              </p>
            </Card>
          )}

          {client.internal_notes && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-2">Observações Internas</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.internal_notes}</p>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold text-slate-800 mb-2">Informações do Sistema</h2>
            <div className="text-xs text-slate-500 space-y-1">
              <p>Cadastrado: {formatDateTime(client.created_at)}</p>
              <p>Atualizado: {formatDateTime(client.updated_at)}</p>
            </div>
          </Card>
        </div>

        {/* Processes */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="none">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Processos ({processes?.length ?? 0})
              </h2>
              <Link
                href={`/processos/novo?client_id=${client.id}`}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Novo
              </Link>
            </div>
            {!processes || processes.length === 0 ? (
              <div className="p-8 text-center">
                <FolderOpen className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum processo cadastrado</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {processes.map((p: any) => (
                  <Link key={p.id} href={`/processos/${p.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{p.process_types?.name}</p>
                      {p.protocol && <p className="text-xs text-slate-500">Protocolo: {p.protocol}</p>}
                      <p className="text-xs text-slate-400">{formatDate(p.created_at)}</p>
                    </div>
                    <ProcessStatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card padding="none">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Documentos Recentes</h2>
              <Link href={`/documentos?client_id=${client.id}`} className="text-sm text-blue-600 hover:underline">Ver todos</Link>
            </div>
            {!documents || documents.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum documento enviado</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {documents.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-3 p-4">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{d.file_name}</p>
                      <p className="text-xs text-slate-400">{formatDate(d.created_at)}</p>
                    </div>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Ver</a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
