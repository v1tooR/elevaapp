'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X, User, MapPin, Lock, AlertCircle, Stethoscope } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { canHaveCnhEspecial, isNonDriverDisability } from '@/lib/eligibility'
import type { Client, DisabilityType, ClientType } from '@/types/database'

const BRAZIL_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const DISABILITY_OPTIONS: { value: DisabilityType | ''; label: string }[] = [
  { value: '',          label: 'Não informado' },
  { value: 'fisica',    label: 'Física' },
  { value: 'auditiva',  label: 'Auditiva' },
  { value: 'visual',    label: 'Visual' },
  { value: 'monocular', label: 'Monocular' },
  { value: 'autismo',   label: 'Autismo (TEA)' },
  { value: 'mental',    label: 'Mental / Intelectual' },
]

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        enabled ? 'bg-emerald-500' : 'bg-slate-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
        enabled ? 'translate-x-4' : 'translate-x-0'
      )} />
    </button>
  )
}

type Tab = 'pessoal' | 'endereco' | 'interno' | 'elegibilidade'

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pessoal',       label: 'Dados Pessoais', icon: <User className="w-3.5 h-3.5" /> },
  { key: 'endereco',      label: 'Endereço',        icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: 'interno',       label: 'Interno',         icon: <Lock className="w-3.5 h-3.5" /> },
  { key: 'elegibilidade', label: 'Elegibilidade',   icon: <Stethoscope className="w-3.5 h-3.5" /> },
]

export function EditClientModal({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('pessoal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: client.name ?? '',
    cpf: client.cpf ?? '',
    rg: client.rg ?? '',
    birth_date: client.birth_date ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    gov_password_reference: client.gov_password_reference ?? '',
    internal_notes: client.internal_notes ?? '',
  })

  const [eligi, setEligi] = useState({
    client_type: (client.client_type ?? '') as ClientType | '',
    disability_type: (client.disability_type ?? '') as DisabilityType | '',
    has_cnh_especial: client.has_cnh_especial ?? false,
    receives_loas_bpc: client.receives_loas_bpc ?? false,
    has_medical_report: client.has_medical_report ?? false,
    report_valid_until: client.report_valid_until ?? '',
  })

  const updateEligi = (key: string, value: boolean | string) =>
    setEligi(prev => {
      const next = { ...prev, [key]: value }
      if ((key === 'client_type' || key === 'disability_type') &&
        !canHaveCnhEspecial(
          key === 'client_type' ? (value as ClientType | '') || undefined : prev.client_type || undefined,
          key === 'disability_type' ? (value as DisabilityType | '') || undefined : prev.disability_type || undefined,
        )) {
        next.has_cnh_especial = false
      }
      return next
    })

  const cnhAllowed = canHaveCnhEspecial(eligi.client_type || undefined, eligi.disability_type || undefined)

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('clients').update({
      ...form,
      birth_date: form.birth_date || null,
      cpf: form.cpf || null,
      rg: form.rg || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      gov_password_reference: form.gov_password_reference || null,
      internal_notes: form.internal_notes || null,
      client_type: eligi.client_type || null,
      disability_type: eligi.disability_type || null,
      has_cnh_especial: eligi.has_cnh_especial,
      receives_loas_bpc: eligi.receives_loas_bpc,
      has_medical_report: eligi.has_medical_report,
      report_valid_until: eligi.report_valid_until || null,
    }).eq('id', client.id)

    if (err) { setError(err.message); setLoading(false); return }
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
        .state-select:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); outline: none; }
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

            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B3019, #A14F2A)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <h2 className="dash text-white font-bold text-base">Editar Cliente</h2>
                <p className="dash text-primary-foreground/70 text-xs mt-0.5">{client.name}</p>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 shrink-0 px-4 pt-3 gap-1">
              {tabs.map(t => (
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
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">

                {tab === 'pessoal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Input label="Nome completo *" value={form.name} onChange={e => update('name', e.target.value)} required />
                    </div>
                    <MaskedInput mask="cpf" label="CPF" value={form.cpf} onChange={v => update('cpf', v)} placeholder="000.000.000-00" />
                    <MaskedInput mask="rg" label="RG" value={form.rg} onChange={v => update('rg', v)} placeholder="00.000.000-0" />
                    <Input label="Data de nascimento" type="date" value={form.birth_date} onChange={e => update('birth_date', e.target.value)} />
                    <MaskedInput mask="phone" label="Telefone" value={form.phone} onChange={v => update('phone', v)} placeholder="(00) 00000-0000" />
                    <div className="sm:col-span-2">
                      <Input label="E-mail" type="email" value={form.email} onChange={e => update('email', e.target.value)} />
                    </div>
                  </div>
                )}

                {tab === 'endereco' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Input label="Endereço" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Rua, número, bairro" />
                    </div>
                    <Input label="Cidade" value={form.city} onChange={e => update('city', e.target.value)} />
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700 dash">Estado</label>
                      <select
                        value={form.state}
                        onChange={e => update('state', e.target.value)}
                        className="state-select block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                      >
                        <option value="">Selecione</option>
                        {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {tab === 'interno' && (
                  <div className="space-y-4">
                    <Input
                      label="Referência Gov.br"
                      value={form.gov_password_reference}
                      onChange={e => update('gov_password_reference', e.target.value)}
                      placeholder="Referência ou dica (nunca a senha real)"
                      helperText="Nunca armazene senhas reais."
                    />
                    <Textarea
                      label="Observações internas"
                      value={form.internal_notes}
                      onChange={e => update('internal_notes', e.target.value)}
                      placeholder="Visível apenas para a equipe..."
                      rows={4}
                    />
                  </div>
                )}

                {tab === 'elegibilidade' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 dash">Perfil do cliente</label>
                        <select
                          value={eligi.client_type}
                          onChange={e => updateEligi('client_type', e.target.value)}
                          className="state-select block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                        >
                          <option value="">Não informado</option>
                          <option value="condutor">Condutor (motorista)</option>
                          <option value="nao_condutor">Não condutor</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 dash">Tipo de deficiência</label>
                        <select
                          value={eligi.disability_type}
                          onChange={e => updateEligi('disability_type', e.target.value)}
                          className="state-select block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                        >
                          {DISABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {eligi.disability_type && isNonDriverDisability(eligi.disability_type as DisabilityType) && (
                          <p className="text-[11px] text-amber-600 dash">Visual/mental não permite direção.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {[
                        { key: 'has_cnh_especial',  label: 'Possui CNH Especial',  disabled: !cnhAllowed },
                        { key: 'receives_loas_bpc', label: 'Recebe LOAS/BPC',      disabled: false },
                        { key: 'has_medical_report',label: 'Possui laudo médico',  disabled: false },
                      ].map(({ key, label, disabled }) => (
                        <div key={key} className="flex items-center justify-between py-0.5">
                          <p className={cn('text-sm font-medium dash', disabled ? 'text-slate-400' : 'text-slate-700')}>{label}</p>
                          <Toggle
                            enabled={eligi[key as keyof typeof eligi] as boolean}
                            onToggle={() => updateEligi(key, !(eligi[key as keyof typeof eligi] as boolean))}
                            disabled={disabled}
                          />
                        </div>
                      ))}

                      {eligi.has_medical_report && (
                        <div className="pl-4 border-l-2 border-purple-100">
                          <Input
                            label="Validade do laudo"
                            type="date"
                            value={eligi.report_valid_until}
                            onChange={e => updateEligi('report_valid_until', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dash">{error}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
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
