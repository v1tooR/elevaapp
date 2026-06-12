'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

export default function NovoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', cpf: '', rg: '', birth_date: '', phone: '', email: '',
    address: '', city: '', state: '', gov_password_reference: '', internal_notes: ''
  })

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase.from('clients').insert({
      name: form.name,
      cpf: form.cpf || null,
      rg: form.rg || null,
      birth_date: form.birth_date || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      gov_password_reference: form.gov_password_reference || null,
      internal_notes: form.internal_notes || null,
    }).select().single()

    if (err) {
      setError('Erro ao cadastrar cliente: ' + err.message)
      setLoading(false)
      return
    }

    router.push(`/clientes/${data.id}`)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/clientes" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Cliente</h1>
          <p className="text-slate-500 text-sm mt-0.5">Preencha os dados do cliente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <h2 className="font-semibold text-slate-800 mb-4">Dados Pessoais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Nome completo *" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="Nome do cliente" />
            </div>
            <Input label="CPF" value={form.cpf} onChange={e => update('cpf', e.target.value)} placeholder="000.000.000-00" />
            <Input label="RG" value={form.rg} onChange={e => update('rg', e.target.value)} placeholder="00.000.000-0" />
            <Input label="Data de nascimento" type="date" value={form.birth_date} onChange={e => update('birth_date', e.target.value)} />
            <Input label="Telefone" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(00) 00000-0000" />
            <div className="sm:col-span-2">
              <Input label="E-mail" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-800 mb-4">Endereço</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Endereço" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Rua, número, bairro" />
            </div>
            <Input label="Cidade" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Cidade" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Estado</label>
              <select
                value={form.state}
                onChange={e => update('state', e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-800 mb-4">Informações Internas</h2>
          <div className="space-y-4">
            <Input
              label="Referência Senha Gov.br"
              value={form.gov_password_reference}
              onChange={e => update('gov_password_reference', e.target.value)}
              placeholder="Referência ou dica (não armazene a senha real)"
              helperText="Use apenas referências ou dicas. Nunca armazene senhas reais."
            />
            <Textarea
              label="Observações internas"
              value={form.internal_notes}
              onChange={e => update('internal_notes', e.target.value)}
              placeholder="Observações visíveis apenas para a equipe..."
              rows={3}
            />
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" loading={loading}>Cadastrar Cliente</Button>
          <Link href="/clientes">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
