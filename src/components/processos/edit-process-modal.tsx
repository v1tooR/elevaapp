'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X, TrendingUp, Link2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { PROCESS_STATUS_LABELS, PROCESS_TYPE_CUSTOM_FIELDS } from '@/lib/utils'
import { maskCurrency, parseCurrency } from '@/lib/masks'
import { syncProcessFinancial } from '@/lib/sync-process-financial'
import type { Process } from '@/types/database'

const STATUS_OPTIONS = Object.entries(PROCESS_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

export function EditProcessModal({ process }: { process: Process & { process_types?: any; custom_fields?: any[]; financials?: any } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    protocol: process.protocol ?? '',
    status: process.status,
    observations: process.observations ?? '',
  })
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    ;(process.custom_fields ?? []).forEach((f: any) => {
      vals[f.field_name] = f.field_value ?? ''
    })
    return vals
  })
  const initValue = process.financials?.service_value
    ? (process.financials.service_value as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : ''

  const [financial, setFinancial] = useState({
    service_value: initValue,   // formatado em BRL
    payment_method: process.financials?.payment_method ?? '',
    payment_status: process.financials?.payment_status ?? 'pending',
    expected_payment_date: process.financials?.expected_payment_date ?? '',
    financial_notes: process.financials?.financial_notes ?? '',
  })

  const slug = process.process_types?.slug ?? ''
  const customFields = PROCESS_TYPE_CUSTOM_FIELDS[slug] ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const oldStatus = process.status
    const { error: err } = await supabase.from('processes').update({
      protocol: form.protocol || null,
      status: form.status as any,
      observations: form.observations || null,
    }).eq('id', process.id)

    if (err) { setError(err.message); setLoading(false); return }

    // Update custom fields
    for (const field of customFields) {
      const val = customFieldValues[field.field_name]
      const existing = (process.custom_fields ?? []).find((f: any) => f.field_name === field.field_name)
      if (existing) {
        await supabase.from('process_custom_fields').update({ field_value: val || null }).eq('id', existing.id)
      } else if (val) {
        await supabase.from('process_custom_fields').insert({
          process_id: process.id,
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          field_value: val,
          sort_order: customFields.indexOf(field),
        })
      }
    }

    // Upsert financial + sync ao módulo financeiro
    if (financial.service_value || financial.payment_method || financial.financial_notes) {
      const serviceValue = financial.service_value ? parseCurrency(financial.service_value) : null

      const financeEntryId = await syncProcessFinancial(supabase, {
        processId: process.id,
        clientId: (process as any).clients?.id ?? process.client_id,
        processTypeName: process.process_types?.name ?? 'Processo',
        processTypeSlug: process.process_types?.slug ?? '',
        serviceValue,
        paymentStatus: financial.payment_status,
        expectedPaymentDate: financial.expected_payment_date || null,
        existingFinanceEntryId: process.financials?.finance_entry_id ?? null,
      })

      if (process.financials?.id) {
        await supabase.from('process_financials').update({
          service_value: serviceValue,
          payment_method: financial.payment_method as any || null,
          payment_status: financial.payment_status as any,
          expected_payment_date: financial.expected_payment_date || null,
          financial_notes: financial.financial_notes || null,
          finance_entry_id: financeEntryId,
        }).eq('id', process.financials.id)
      } else {
        await supabase.from('process_financials').insert({
          process_id: process.id,
          service_value: serviceValue,
          payment_method: financial.payment_method as any || null,
          payment_status: financial.payment_status as any,
          expected_payment_date: financial.expected_payment_date || null,
          financial_notes: financial.financial_notes || null,
          finance_entry_id: financeEntryId,
        })
      }
    }

    // History entry
    if (oldStatus !== form.status) {
      await supabase.from('process_history').insert({
        process_id: process.id,
        action_type: 'status_changed',
        old_value: oldStatus,
        new_value: form.status,
      })
    } else {
      await supabase.from('process_history').insert({
        process_id: process.id,
        action_type: 'updated',
        note: 'Processo atualizado',
      })
    }

    // Auto-renovação: quando o processo é concluído, criar evento de renovação
    if (oldStatus !== 'concluido' && form.status === 'concluido') {
      const renewalMonths = process.process_types?.renewal_period_months
      if (renewalMonths) {
        const completedAt = new Date()
        const renewalDate = new Date(completedAt)
        renewalDate.setMonth(renewalDate.getMonth() + renewalMonths)
        const renewalIso = renewalDate.toISOString().split('T')[0]

        const eventTitle = `Renovar ${process.process_types?.name ?? 'Processo'} — ${((process as any).clients as any)?.name ?? ''}`

        const { data: calEvent } = await supabase.from('calendar_events').insert({
          title: eventTitle,
          description: process.process_types?.renewal_notes ?? null,
          event_date: renewalIso,
          event_type: 'renewal',
          color: process.process_types?.color ?? null,
          client_id: ((process as any).clients as any)?.id ?? null,
          process_id: process.id,
          visibility: 'admin_only',
          status: 'pending',
        }).select('id').single()

        if (calEvent?.id) {
          await supabase.from('processes').update({
            renewal_date: renewalIso,
            renewal_calendar_event_id: calEvent.id,
          }).eq('id', process.id)
        }
      }
    }

    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        <Edit className="w-4 h-4" /> Editar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">Editar Processo</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Status" options={STATUS_OPTIONS} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} />
                <Input label="Protocolo" value={form.protocol} onChange={e => setForm(p => ({ ...p, protocol: e.target.value }))} />
                <div className="col-span-2">
                  <Textarea label="Observações" value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} />
                </div>
              </div>

              {customFields.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-700 mb-3 text-sm">Campos Específicos</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {customFields.map(field => (
                      <div key={field.field_name}>
                        {field.field_type === 'boolean' ? (
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={customFieldValues[field.field_name] === 'true'} onChange={e => setCustomFieldValues(p => ({ ...p, [field.field_name]: e.target.checked ? 'true' : 'false' }))} className="w-4 h-4" />
                            <span className="text-sm font-medium text-slate-700">{field.field_label}</span>
                          </label>
                        ) : (
                          <Input
                            label={field.field_label}
                            type={field.field_type === 'date' ? 'date' : field.field_type === 'currency' ? 'number' : 'text'}
                            value={customFieldValues[field.field_name] ?? ''}
                            onChange={e => setCustomFieldValues(p => ({ ...p, [field.field_name]: e.target.value }))}
                            step={field.field_type === 'currency' ? '0.01' : undefined}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">Financeiro</h3>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-2.5 h-2.5" /> Módulo Financeiro
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Valor do serviço</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={financial.service_value}
                      onChange={e => setFinancial(p => ({ ...p, service_value: maskCurrency(e.target.value) }))}
                      placeholder="R$ 0,00"
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'pending',        label: 'Pendente',  color: 'text-slate-600  bg-slate-50  border-slate-300' },
                      { value: 'partially_paid', label: 'Parcial',   color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
                      { value: 'paid',           label: 'Pago',      color: 'text-green-700  bg-green-50  border-green-300' },
                      { value: 'overdue',        label: 'Em atraso', color: 'text-red-700    bg-red-50    border-red-300' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFinancial(p => ({ ...p, payment_status: opt.value }))}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                          financial.payment_status === opt.value
                            ? opt.color + ' ring-2 ring-offset-1 ring-blue-400'
                            : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {financial.service_value && parseCurrency(financial.service_value) > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                      <Link2 className="w-3 h-3 shrink-0" />
                      <span>
                        <b>{financial.service_value}</b> → receita{' '}
                        {financial.payment_status === 'paid' ? 'confirmada' : 'prevista'} no Financeiro
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={loading}>Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
