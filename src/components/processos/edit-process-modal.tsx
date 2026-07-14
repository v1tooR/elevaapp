'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X, TrendingUp, Link2, Settings, Layers, DollarSign } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { PROCESS_STATUS_LABELS, PROCESS_TYPE_CUSTOM_FIELDS } from '@/lib/utils'
import { maskCurrency, parseCurrency } from '@/lib/masks'
import { syncProcessFinancial } from '@/lib/sync-process-financial'
import type { Process } from '@/types/database'

const STATUS_OPTIONS = Object.entries(PROCESS_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

type Tab = 'info' | 'campos' | 'financeiro'

export function EditProcessModal({ process }: { process: Process & { process_types?: any; custom_fields?: any[]; financials?: any } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    protocol: process.protocol ?? '',
    status: process.status,
    observations: process.observations ?? '',
  })

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    ;(process.custom_fields ?? []).forEach((f: any) => { vals[f.field_name] = f.field_value ?? '' })
    return vals
  })

  const initValue = process.financials?.service_value
    ? (process.financials.service_value as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : ''

  const [financial, setFinancial] = useState({
    service_value: initValue,
    payment_method: process.financials?.payment_method ?? '',
    payment_status: process.financials?.payment_status ?? 'pending',
    expected_payment_date: process.financials?.expected_payment_date ?? '',
    financial_notes: process.financials?.financial_notes ?? '',
  })

  const slug = process.process_types?.slug ?? ''
  const customFields = PROCESS_TYPE_CUSTOM_FIELDS[slug] ?? []
  const typeColor = process.process_types?.color ?? '#3B82F6'

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'info',      label: 'Informações',    icon: <Settings className="w-3.5 h-3.5" /> },
    { key: 'campos',    label: 'Campos',          icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'financeiro',label: 'Financeiro',      icon: <DollarSign className="w-3.5 h-3.5" /> },
  ]

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

    if (oldStatus !== 'concluido' && form.status === 'concluido') {
      const renewalMonths = process.process_types?.renewal_period_months
      if (renewalMonths) {
        const renewalDate = new Date()
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
          await supabase.from('processes').update({ renewal_date: renewalIso, renewal_calendar_event_id: calEvent.id }).eq('id', process.id)
        }
      }
    }

    setOpen(false)
    router.refresh()
  }

  const close = () => { setOpen(false); setError('') }

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-panel { animation: modalIn 0.2s ease-out both; }
      `}</style>

      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-white/20 bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/20 transition-all dash"
      >
        <Edit className="w-3.5 h-3.5" />
        Editar
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B3019, #A14F2A)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${typeColor}30`, border: `1px solid ${typeColor}50` }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: typeColor }} />
                </div>
                <div>
                  <h2 className="dash text-white font-bold text-base">Editar Processo</h2>
                  <p className="dash text-primary-foreground/70 text-xs mt-0.5">{process.process_types?.name}</p>
                </div>
              </div>
              <button onClick={close} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 shrink-0 px-4 pt-3 gap-1">
              {tabs.map(t => (
                (!customFields.length && t.key === 'campos') ? null :
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all dash"
                  style={tab === t.key
                    ? { color: '#2563EB', borderBottom: '2px solid #2563EB', background: '#EFF6FF' }
                    : { color: '#94A3B8', borderBottom: '2px solid transparent' }
                  }
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">

                {tab === 'info' && (
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Status" options={STATUS_OPTIONS} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} />
                    <Input label="Protocolo" value={form.protocol} onChange={e => setForm(p => ({ ...p, protocol: e.target.value }))} placeholder="Nº do protocolo" />
                    <div className="col-span-2">
                      <Textarea label="Observações" value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} rows={3} />
                    </div>
                  </div>
                )}

                {tab === 'campos' && customFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {customFields.map(field => (
                      <div key={field.field_name}>
                        {field.field_type === 'boolean' ? (
                          <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={customFieldValues[field.field_name] === 'true'}
                              onChange={e => setCustomFieldValues(p => ({ ...p, [field.field_name]: e.target.checked ? 'true' : 'false' }))}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-medium text-slate-700 dash">{field.field_label}</span>
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
                )}

                {tab === 'financeiro' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700 dash">Valor do serviço</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={financial.service_value}
                        onChange={e => setFinancial(p => ({ ...p, service_value: maskCurrency(e.target.value) }))}
                        placeholder="R$ 0,00"
                        className="block w-full rounded-xl border border-border px-4 py-3 text-base font-bold text-foreground placeholder:text-muted-foreground placeholder:font-normal bg-muted focus:bg-card focus:border-primary focus:outline-none transition-all dash"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'pending',        label: 'Pendente',  bg: '#F8FAFC', border: '#CBD5E1', active: '#1E293B' },
                        { value: 'partially_paid', label: 'Parcial',   bg: '#FFFBEB', border: '#FDE68A', active: '#B45309' },
                        { value: 'paid',           label: 'Pago',      bg: '#ECFDF5', border: '#A7F3D0', active: '#065F46' },
                        { value: 'overdue',        label: 'Em atraso', bg: '#FEF2F2', border: '#FECACA', active: '#991B1B' },
                      ].map(opt => {
                        const isActive = financial.payment_status === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFinancial(p => ({ ...p, payment_status: opt.value }))}
                            className="px-3 py-2.5 rounded-xl border text-xs font-bold transition-all dash"
                            style={isActive
                              ? { background: opt.bg, borderColor: opt.active, color: opt.active, boxShadow: `0 0 0 2px ${opt.active}20` }
                              : { background: '#fff', borderColor: '#E2E8F0', color: '#94A3B8' }
                            }
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>

                    {financial.service_value && parseCurrency(financial.service_value) > 0 && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                        <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs text-blue-700 dash">
                          <b>{financial.service_value}</b> → receita {financial.payment_status === 'paid' ? 'confirmada' : 'prevista'} no Financeiro
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold bg-green-50 border border-green-200 px-3 py-2 rounded-xl dash">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Integrado ao Módulo Financeiro
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 dash">{error}</p>}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <Button type="submit" loading={loading}>Salvar alterações</Button>
                <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </>
  )
}
