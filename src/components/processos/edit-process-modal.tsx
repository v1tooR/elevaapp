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
import { calculateProcessRenewalDate } from '@/lib/process-workflow'
import type { Process } from '@/types/database'

const STATUS_OPTIONS = Object.entries(PROCESS_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
const ACTION_OWNER_OPTIONS = [
  { value: '', label: 'Não definido' },
  { value: 'equipe', label: 'Equipe Eleva' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'orgao', label: 'Órgão público' },
  { value: 'terceiro', label: 'Terceiro' },
]

type Tab = 'info' | 'campos' | 'financeiro'

export function EditProcessModal({
  process,
  isSuperAdmin = false,
  canAssign = false,
  staff = [],
}: {
  process: Process & { process_types?: any; custom_fields?: any[]; financials?: any }
  isSuperAdmin?: boolean
  canAssign?: boolean
  staff?: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    protocol: process.protocol ?? '',
    status: process.status,
    observations: process.observations ?? '',
    next_action: process.next_action ?? '',
    action_owner: process.action_owner ?? '',
    action_due_date: process.action_due_date ?? '',
    blocked_reason: process.blocked_reason ?? '',
    responsible_user_id: process.responsible_user_id ?? '',
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
    { key: 'info',      label: 'Informações', icon: <Settings className="w-3.5 h-3.5" /> },
    { key: 'campos',    label: 'Campos',      icon: <Layers className="w-3.5 h-3.5" /> },
    ...(isSuperAdmin ? [{ key: 'financeiro' as Tab, label: 'Financeiro', icon: <DollarSign className="w-3.5 h-3.5" /> }] : []),
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const oldStatus = process.status

    const { error: err } = await supabase.from('processes').update({
      protocol: form.protocol || null,
      observations: form.observations || null,
      next_action: form.next_action || null,
      action_owner: form.action_owner || null,
      action_due_date: form.action_due_date || null,
      blocked_reason: form.blocked_reason || null,
      ...(canAssign ? { responsible_user_id: form.responsible_user_id || null } : {}),
    }).eq('id', process.id)

    if (err) { setError(err.message); setLoading(false); return }

    if (customFields.length > 0) {
      const { error: customFieldsError } = await supabase.from('process_custom_fields').upsert(
        customFields.map((field, index) => ({
          process_id: process.id,
          field_name: field.field_name,
          field_label: field.field_label,
          field_type: field.field_type,
          field_value: customFieldValues[field.field_name] || null,
          sort_order: index,
        })),
        { onConflict: 'process_id,field_name' },
      )
      if (customFieldsError) {
        setError(customFieldsError.message)
        setLoading(false)
        return
      }
    }

    if (
      process.process_types?.slug === 'processo_ipva' &&
      (process.jurisdiction_state || (process as any).clients?.state)?.toUpperCase() === 'SP'
    ) {
      const workflowResponse = await fetch(`/api/processos/${process.id}/workflow`, { method: 'POST' })
      const workflowResult = await workflowResponse.json()
      if (!workflowResponse.ok) {
        setError(workflowResult.error ?? 'Não foi possível sincronizar o workflow IMESC/IPVA.')
        setLoading(false)
        return
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
      const statusResponse = await fetch(`/api/processos/${process.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: form.status }),
      })
      if (!statusResponse.ok) {
        const result = await statusResponse.json().catch(() => ({}))
        setError(result.error ?? 'Não foi possível atualizar o status do processo.')
        setLoading(false)
        return
      }
    } else {
      await supabase.from('process_history').insert({
        process_id: process.id,
        action_type: 'updated',
        note: 'Processo atualizado',
      })
    }

    if (oldStatus !== 'concluido' && form.status === 'concluido') {
      const processTypeSlug = process.process_types?.slug ?? ''
      const renewalIso = calculateProcessRenewalDate({
        processTypeSlug,
        completedAt: new Date().toISOString(),
        configuredMonths: process.process_types?.renewal_period_months,
      })
      if (renewalIso) {
        const eventTitle = `Renovar ${process.process_types?.name ?? 'Processo'} — ${((process as any).clients as any)?.name ?? ''}`
        const { data: calEvent } = await supabase.from('calendar_events').upsert({
          title: eventTitle,
          description: process.process_types?.renewal_notes ?? null,
          event_date: renewalIso,
          event_type: 'renewal',
          source_key: `renewal:${processTypeSlug}`,
          color: process.process_types?.color ?? null,
          client_id: ((process as any).clients as any)?.id ?? null,
          process_id: process.id,
          visibility: 'admin_only',
          status: 'pending',
        }, { onConflict: 'process_id,source_key' }).select('id').single()
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
                    {canAssign && (
                      <div className="col-span-2">
                        <Select label="Responsável" options={staff.map(item => ({ value: item.id, label: item.name }))} placeholder="Sem responsável" value={form.responsible_user_id} onChange={e => setForm(p => ({ ...p, responsible_user_id: e.target.value }))} />
                      </div>
                    )}
                    <div className="col-span-2">
                      <Input label="Próxima ação" value={form.next_action} onChange={e => setForm(p => ({ ...p, next_action: e.target.value }))} placeholder="Ex.: agendar exame prático" />
                    </div>
                    <Select label="Quem deve agir" options={ACTION_OWNER_OPTIONS} value={form.action_owner} onChange={e => setForm(p => ({ ...p, action_owner: e.target.value as typeof form.action_owner }))} />
                    <Input label="Prazo da próxima ação" type="date" value={form.action_due_date} onChange={e => setForm(p => ({ ...p, action_due_date: e.target.value }))} />
                    <div className="col-span-2">
                      <Textarea label="Bloqueio atual" value={form.blocked_reason} onChange={e => setForm(p => ({ ...p, blocked_reason: e.target.value }))} rows={2} placeholder="Deixe vazio quando não houver bloqueio" />
                    </div>
                    <div className="col-span-2">
                      <Textarea label="Observação interna fixa" value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} rows={3} />
                      <p className="mt-1 text-[11px] text-amber-700">Visível somente para a equipe. Use “Mensagem para o cliente” no processo para atualizar o cliente.</p>
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
                        ) : field.field_type === 'select' ? (
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-700 dash">{field.field_label}</label>
                            <select
                              value={customFieldValues[field.field_name] ?? ''}
                              onChange={e => setCustomFieldValues(p => ({ ...p, [field.field_name]: e.target.value }))}
                              className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none"
                            >
                              <option value="">Selecione</option>
                              {(field.options ?? []).map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            {field.help_text && <p className="text-[10px] leading-relaxed text-slate-400">{field.help_text}</p>}
                          </div>
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
