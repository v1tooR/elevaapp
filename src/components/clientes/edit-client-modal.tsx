'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Client } from '@/types/database'

const BRAZIL_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export function EditClientModal({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
    }).eq('id', client.id)

    if (err) { setError(err.message); setLoading(false); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        <Edit className="w-4 h-4" />
        Editar
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Editar Cliente</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input label="Nome completo *" value={form.name} onChange={e => update('name', e.target.value)} required />
                </div>
                <MaskedInput mask="cpf" label="CPF" value={form.cpf} onChange={v => update('cpf', v)} placeholder="000.000.000-00" />
                <MaskedInput mask="rg" label="RG" value={form.rg} onChange={v => update('rg', v)} placeholder="00.000.000-0" />
                <Input label="Nascimento" type="date" value={form.birth_date} onChange={e => update('birth_date', e.target.value)} />
                <MaskedInput mask="phone" label="Telefone" value={form.phone} onChange={v => update('phone', v)} placeholder="(00) 00000-0000" />
                <div className="sm:col-span-2">
                  <Input label="E-mail" type="email" value={form.email} onChange={e => update('email', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Input label="Endereço" value={form.address} onChange={e => update('address', e.target.value)} />
                </div>
                <Input label="Cidade" value={form.city} onChange={e => update('city', e.target.value)} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Estado</label>
                  <select value={form.state} onChange={e => update('state', e.target.value)} className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Selecione</option>
                    {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Input label="Referência Gov.br" value={form.gov_password_reference} onChange={e => update('gov_password_reference', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Textarea label="Obs. internas" value={form.internal_notes} onChange={e => update('internal_notes', e.target.value)} />
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
