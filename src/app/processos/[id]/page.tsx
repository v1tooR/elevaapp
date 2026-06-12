import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge, PaymentStatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatDateTime, formatCurrency, HISTORY_ACTION_LABELS } from '@/lib/utils'
import { EditProcessModal } from '@/components/processos/edit-process-modal'
import { DocumentUploader } from '@/components/shared/document-uploader'

export default async function ProcessoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: process },
    { data: history },
    { data: documents },
    { data: events },
  ] = await Promise.all([
    supabase.from('processes').select(`
      *,
      clients(id, name, cpf, phone, email),
      process_types(id, name, slug, color),
      responsible_user:profiles!processes_responsible_user_id_fkey(id, name),
      custom_fields:process_custom_fields(*),
      financials:process_financials(*)
    `).eq('id', id).single(),
    supabase.from('process_history').select(`
      *,
      changer:profiles!process_history_changed_by_fkey(id, name)
    `).eq('process_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('documents').select('*').eq('process_id', id).order('created_at', { ascending: false }),
    supabase.from('calendar_events').select('*').eq('process_id', id).order('event_date', { ascending: true }).limit(5),
  ])

  if (!process) notFound()

  const financials = Array.isArray(process.financials) ? process.financials[0] : process.financials
  const customFields = Array.isArray(process.custom_fields) ? process.custom_fields : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/processos" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (process.process_types as any)?.color ?? '#3B82F6' }} />
            <h1 className="text-2xl font-bold text-slate-900">{(process.process_types as any)?.name}</h1>
            <ProcessStatusBadge status={process.status} />
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Cliente: <Link href={`/clientes/${(process.clients as any)?.id}`} className="text-blue-600 hover:underline">
              {(process.clients as any)?.name}
            </Link>
            {process.protocol && <span className="ml-3">· Protocolo: <span className="font-mono">{process.protocol}</span></span>}
          </p>
        </div>
        <EditProcessModal process={process as any} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Process info */}
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4">Informações do Processo</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Tipo:</span>
                <span className="text-slate-900 font-medium">{(process.process_types as any)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <ProcessStatusBadge status={process.status} />
              </div>
              {process.protocol && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Protocolo:</span>
                  <span className="text-slate-900 font-mono text-xs">{process.protocol}</span>
                </div>
              )}
              {(process.responsible_user as any) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Responsável:</span>
                  <span className="text-slate-900">{(process.responsible_user as any)?.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Abertura:</span>
                <span className="text-slate-900">{formatDate(process.created_at)}</span>
              </div>
              {process.completed_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Conclusão:</span>
                  <span className="text-slate-900">{formatDate(process.completed_at)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Observations */}
          {process.observations && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-2">Observações</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{process.observations}</p>
            </Card>
          )}

          {/* Custom fields */}
          {customFields.length > 0 && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-4">Campos Específicos</h2>
              <div className="space-y-3">
                {customFields.sort((a: any, b: any) => a.sort_order - b.sort_order).map((field: any) => (
                  <div key={field.id} className="flex justify-between text-sm">
                    <span className="text-slate-500">{field.field_label}:</span>
                    <span className="text-slate-900 font-medium">
                      {field.field_type === 'boolean'
                        ? field.field_value === 'true' ? 'Sim' : 'Não'
                        : field.field_type === 'currency' && field.field_value
                          ? formatCurrency(parseFloat(field.field_value))
                          : field.field_type === 'date' && field.field_value
                            ? formatDate(field.field_value)
                            : field.field_value ?? '-'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Financial */}
          {financials && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-4">Financeiro</h2>
              <div className="space-y-3 text-sm">
                {financials.service_value && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(financials.service_value)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagamento:</span>
                  <PaymentStatusBadge status={financials.payment_status} />
                </div>
                {financials.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Forma:</span>
                    <span className="text-slate-900 capitalize">{financials.payment_method}</span>
                  </div>
                )}
                {financials.expected_payment_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Previsto:</span>
                    <span className="text-slate-900">{formatDate(financials.expected_payment_date)}</span>
                  </div>
                )}
                {financials.financial_notes && (
                  <p className="text-slate-500 text-xs mt-2">{financials.financial_notes}</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Documents */}
          <Card padding="none">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Documentos</h2>
            </div>
            <DocumentUploader processId={process.id} clientId={(process.clients as any)?.id} />
            {documents && documents.length > 0 && (
              <div className="divide-y divide-slate-50">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-4">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                      Ver
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* History */}
          <Card padding="none">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Histórico</h2>
            </div>
            {!history || history.length === 0 ? (
              <p className="p-5 text-sm text-slate-400 text-center">Sem histórico</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {history.map((h: any) => (
                  <div key={h.id} className="flex gap-3 p-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{HISTORY_ACTION_LABELS[h.action_type] ?? h.action_type}</span>
                        {h.old_value && h.new_value && (
                          <span className="text-slate-500"> · {h.old_value} → {h.new_value}</span>
                        )}
                      </p>
                      {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">{formatDateTime(h.created_at)}</span>
                        {h.changer?.name && (
                          <span className="text-xs text-slate-400">· {h.changer.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Calendar events */}
          {events && events.length > 0 && (
            <Card padding="none">
              <div className="p-5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Eventos Vinculados</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {events.map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-3 p-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-medium text-blue-600 uppercase">
                        {new Date(ev.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                      <span className="text-sm font-bold text-blue-600 leading-none">
                        {new Date(ev.event_date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{ev.title}</p>
                      {ev.description && <p className="text-xs text-slate-500">{ev.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
