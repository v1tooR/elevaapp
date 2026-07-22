'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X, User, MapPin, Lock, AlertCircle, Stethoscope, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ClientEligibilityFields } from '@/components/clientes/client-eligibility-fields'
import { clientEligibilityFromRecord, clientEligibilityPayload } from '@/lib/client-eligibility'
import type { Client } from '@/types/database'
import { GovAccessFields } from '@/components/clientes/gov-access-fields'
import { govAccessFromRecord, govAccessPayload } from '@/lib/gov-access'

const BRAZIL_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

type Tab = 'pessoal' | 'endereco' | 'acesso' | 'interno' | 'elegibilidade'

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pessoal',       label: 'Dados Pessoais', icon: <User className="w-3.5 h-3.5" /> },
  { key: 'endereco',      label: 'Endereço',        icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: 'acesso',        label: 'Gov.br',          icon: <ShieldCheck className="w-3.5 h-3.5" /> },
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
    internal_notes: client.internal_notes ?? '',
  })
  const [govAccess, setGovAccess] = useState(() => govAccessFromRecord(client))

  const [eligi, setEligi] = useState(() => clientEligibilityFromRecord(client))

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
      internal_notes: form.internal_notes || null,
      ...govAccessPayload(govAccess),
      ...clientEligibilityPayload(eligi),
    }).eq('id', client.id)

    if (err) { setError(err.code === '23505' ? 'Já existe outro cliente cadastrado com este CPF.' : err.message); setLoading(false); return }
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
                    <Textarea
                      label="Observações internas"
                      value={form.internal_notes}
                      onChange={e => update('internal_notes', e.target.value)}
                      placeholder="Visível apenas para a equipe..."
                      rows={4}
                    />
                  </div>
                )}

                {tab === 'acesso' && (
                  <GovAccessFields value={govAccess} onChange={setGovAccess} compact />
                )}

                {tab === 'elegibilidade' && (
                  <ClientEligibilityFields value={eligi} onChange={setEligi} compact />
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
