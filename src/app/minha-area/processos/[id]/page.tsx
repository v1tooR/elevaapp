import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Clock, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatDateTime, formatCurrency, HISTORY_ACTION_LABELS } from '@/lib/utils'
import { DocumentUploader } from '@/components/shared/document-uploader'

export default async function ClienteProcessoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('auth_user_id', user!.id).single()
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', profile!.id).single()

  if (!client) redirect('/minha-area')

  const [{ data: process }, { data: history }, { data: documents }, { data: events }] = await Promise.all([
    supabase.from('processes').select(`
      *,
      process_types(id, name, slug, color),
      custom_fields:process_custom_fields(*)
    `).eq('id', id).eq('client_id', client.id).single(),
    supabase.from('process_history')
      .select('id, action_type, old_value, new_value, note, created_at')
      .eq('process_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('documents').select('*').eq('process_id', id).order('created_at', { ascending: false }),
    supabase.from('calendar_events')
      .select('*')
      .eq('process_id', id)
      .eq('visibility', 'client_visible')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5),
  ])

  if (!process) notFound()

  const customFields = Array.isArray(process.custom_fields)
    ? (process.custom_fields as any[]).filter(f => !['senha_gov', 'gov_password'].includes(f.field_name))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/minha-area/processos" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (process.process_types as any)?.color ?? '#3B82F6' }} />
            <h1 className="text-xl font-bold text-slate-900">{(process.process_types as any)?.name}</h1>
            <ProcessStatusBadge status={process.status} />
          </div>
          {process.protocol && (
            <p className="text-sm text-slate-500 mt-1">Protocolo: <span className="font-mono">{process.protocol}</span></p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4">Detalhes</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <ProcessStatusBadge status={process.status} />
              </div>
              {process.protocol && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Protocolo:</span>
                  <span className="font-mono text-xs text-slate-900">{process.protocol}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Abertura:</span>
                <span className="text-slate-900">{formatDate(process.created_at)}</span>
              </div>
            </div>
          </Card>

          {customFields.length > 0 && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-4">Informações</h2>
              <div className="space-y-3">
                {customFields.sort((a: any, b: any) => a.sort_order - b.sort_order).map((f: any) => (
                  <div key={f.id} className="flex justify-between text-sm">
                    <span className="text-slate-500">{f.field_label}:</span>
                    <span className="text-slate-900 font-medium">
                      {f.field_type === 'boolean'
                        ? f.field_value === 'true' ? 'Sim' : 'Não'
                        : f.field_type === 'currency' && f.field_value
                          ? formatCurrency(parseFloat(f.field_value))
                          : f.field_type === 'date' && f.field_value
                            ? formatDate(f.field_value)
                            : f.field_value ?? '-'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {events && events.length > 0 && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-3">Próximos Compromissos</h2>
              <div className="space-y-3">
                {events.map((ev: any) => (
                  <div key={ev.id} className="text-sm">
                    <p className="font-medium text-slate-800">{ev.title}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Documents */}
          <Card padding="none">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Documentos</h2>
              <p className="text-xs text-slate-400 mt-0.5">Envie documentos relacionados ao seu processo</p>
            </div>
            <DocumentUploader processId={process.id} clientId={client.id} />
            {documents && documents.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-4">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Ver</a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400">Nenhum documento enviado</p>
              </div>
            )}
          </Card>

          {/* History (simplified) */}
          <Card padding="none">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Histórico</h2>
            </div>
            {!history || history.length === 0 ? (
              <p className="p-5 text-sm text-slate-400 text-center">Sem movimentações</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {history.filter((h: any) => !['observation_added'].includes(h.action_type)).map((h: any) => (
                  <div key={h.id} className="flex gap-3 p-4">
                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-2" />
                    <div>
                      <p className="text-sm text-slate-800">{HISTORY_ACTION_LABELS[h.action_type] ?? h.action_type}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(h.created_at)}</p>
                    </div>
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
