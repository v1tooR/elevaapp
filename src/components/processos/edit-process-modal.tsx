'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { PROCESS_STATUS_LABELS, PROCESS_TYPE_CUSTOM_FIELDS } from '@/lib/utils'
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
  const [financial, setFinancial] = useState({
    service_value: process.financials?.service_value?.toString() ?? '',
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

    // Upsert financial
    if (financial.service_value || financial.payment_method || financial.financial_notes) {
      if (process.financials?.id) {
        await supabase.from('process_financials').update({
          service_value: financial.service_value ? parseFloat(financial.service_value) : null,
          payment_method: financial.payment_method as any || null,
          payment_status: financial.payment_status as any,
          expected_payment_date: financial.expected_payment_date || null,
          financial_notes: financial.financial_notes || null,
        }).eq('id', process.financials.id)
      } else {
        await supabase.from('process_financials').insert({
          process_id: process.id,
          service_value: financial.service_value ? parseFloat(financial.service_value) : null,
          payment_method: financial.payment_method as any || null,
          payment_status: financial.payment_status as any,
          expected_payment_date: financial.expected_payment_date || null,
          financial_notes: financial.financial_notes || null,
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

              <div>
                <h3 className="font-medium text-slate-700 mb-3 text-sm">Financeiro</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Valor" type="number" step="0.01" value={financial.service_value} onChange={e => setFinancial(p => ({ ...p, service_value: e.target.value }))} />
                  <Select label="Status Pag." options={[{value:'pending',label:'Pendente'},{value:'partially_paid',label:'Parcial'},{value:'paid',label:'Pago'},{value:'overdue',label:'Atraso'}]} value={financial.payment_status} onChange={e => setFinancial(p => ({ ...p, payment_status: e.target.value }))} />
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
