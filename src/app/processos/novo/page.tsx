'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { PROCESS_TYPE_CUSTOM_FIELDS, PROCESS_STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ProcessType, Client, Profile } from '@/types/database'
import { Suspense } from 'react'

const STATUS_OPTIONS = Object.entries(PROCESS_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

function NovoProcessoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preClientId = searchParams.get('client_id') ?? ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [processTypes, setProcessTypes] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedTypeSlug, setSelectedTypeSlug] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    client_id: preClientId,
    process_type_id: '',
    protocol: '',
    status: 'aberto',
    responsible_user_id: '',
    observations: '',
    service_value: '',
    payment_method: '',
    payment_status: 'pending',
    expected_payment_date: '',
    financial_notes: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('process_types').select('*').eq('is_active', true).order('name'),
      supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, name').in('role', ['admin', 'analista', 'super_admin']).order('name'),
    ]).then(([{ data: pt }, { data: cl }, { data: pf }]) => {
      setProcessTypes(pt ?? [])
      setClients(cl ?? [])
      setProfiles(pf ?? [])
    })
  }, [])

  const handleTypeChange = (typeId: string) => {
    setForm(prev => ({ ...prev, process_type_id: typeId }))
    const selectedType = processTypes.find(t => t.id === typeId)
    setSelectedTypeSlug(selectedType?.slug ?? '')
    setCustomFieldValues({})
  }

  const customFields = PROCESS_TYPE_CUSTOM_FIELDS[selectedTypeSlug] ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id || !form.process_type_id) {
      setError('Selecione o cliente e o tipo de processo.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data: process, error: procErr } = await supabase.from('processes').insert({
      client_id: form.client_id,
      process_type_id: form.process_type_id,
      protocol: form.protocol || null,
      status: form.status as any,
      responsible_user_id: form.responsible_user_id || null,
      observations: form.observations || null,
    }).select().single()

    if (procErr || !process) {
      setError('Erro ao criar processo: ' + (procErr?.message ?? 'Erro desconhecido'))
      setLoading(false)
      return
    }

    // Insert custom fields
    const customFieldInserts = customFields
      .filter(f => customFieldValues[f.field_name])
      .map((f, idx) => ({
        process_id: process.id,
        field_name: f.field_name,
        field_label: f.field_label,
        field_type: f.field_type,
        field_value: customFieldValues[f.field_name],
        sort_order: idx,
      }))

    if (customFieldInserts.length > 0) {
      await supabase.from('process_custom_fields').insert(customFieldInserts)
    }

    // Insert financial data if provided
    if (form.service_value || form.payment_method || form.financial_notes) {
      await supabase.from('process_financials').insert({
        process_id: process.id,
        service_value: form.service_value ? parseFloat(form.service_value) : null,
        payment_method: form.payment_method as any || null,
        payment_status: form.payment_status as any,
        expected_payment_date: form.expected_payment_date || null,
        financial_notes: form.financial_notes || null,
      })
    }

    // Insert history
    await supabase.from('process_history').insert({
      process_id: process.id,
      action_type: 'created',
      new_value: form.status,
      note: 'Processo criado',
    })

    router.push(`/processos/${process.id}`)
  }

  const typeOptions = processTypes.map(t => ({ value: t.id, label: t.name }))
  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const profileOptions = profiles.map(p => ({ value: p.id, label: p.name }))

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/processos" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Processo</h1>
          <p className="text-slate-500 text-sm mt-0.5">Preencha as informações do processo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <h2 className="font-semibold text-slate-800 mb-4">Informações Principais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Select
                label="Cliente *"
                options={clientOptions}
                placeholder="Selecione o cliente"
                value={form.client_id}
                onChange={e => setForm(prev => ({ ...prev, client_id: e.target.value }))}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Select
                label="Tipo de Processo *"
                options={typeOptions}
                placeholder="Selecione o tipo"
                value={form.process_type_id}
                onChange={e => handleTypeChange(e.target.value)}
                required
              />
            </div>
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
            />
            <Input
              label="Protocolo"
              value={form.protocol}
              onChange={e => setForm(prev => ({ ...prev, protocol: e.target.value }))}
              placeholder="Número do protocolo"
            />
            <div className="sm:col-span-2">
              <Select
                label="Responsável"
                options={profileOptions}
                placeholder="Selecione o responsável"
                value={form.responsible_user_id}
                onChange={e => setForm(prev => ({ ...prev, responsible_user_id: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Observações"
                value={form.observations}
                onChange={e => setForm(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Observações sobre o processo..."
              />
            </div>
          </div>
        </Card>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4">Campos Específicos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customFields.map(field => (
                <div key={field.field_name} className={field.field_type === 'boolean' ? '' : ''}>
                  {field.field_type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customFieldValues[field.field_name] === 'true'}
                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.checked ? 'true' : 'false' }))}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span className="text-sm font-medium text-slate-700">{field.field_label}</span>
                    </label>
                  ) : (
                    <Input
                      label={field.field_label}
                      type={field.field_type === 'date' ? 'date' : field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'}
                      value={customFieldValues[field.field_name] ?? ''}
                      onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                      placeholder={field.field_type === 'currency' ? '0,00' : ''}
                      step={field.field_type === 'currency' ? '0.01' : undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Financial */}
        <Card>
          <h2 className="font-semibold text-slate-800 mb-4">Financeiro (opcional)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Valor do serviço"
              type="number"
              step="0.01"
              value={form.service_value}
              onChange={e => setForm(prev => ({ ...prev, service_value: e.target.value }))}
              placeholder="0,00"
            />
            <Select
              label="Forma de pagamento"
              options={[
                { value: 'pix', label: 'PIX' },
                { value: 'cartao', label: 'Cartão' },
                { value: 'boleto', label: 'Boleto' },
                { value: 'dinheiro', label: 'Dinheiro' },
                { value: 'transferencia', label: 'Transferência' },
              ]}
              placeholder="Selecione"
              value={form.payment_method}
              onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
            />
            <Select
              label="Status do pagamento"
              options={[
                { value: 'pending', label: 'Pendente' },
                { value: 'partially_paid', label: 'Parcialmente pago' },
                { value: 'paid', label: 'Pago' },
                { value: 'overdue', label: 'Em atraso' },
              ]}
              value={form.payment_status}
              onChange={e => setForm(prev => ({ ...prev, payment_status: e.target.value }))}
            />
            <Input
              label="Data prevista de pagamento"
              type="date"
              value={form.expected_payment_date}
              onChange={e => setForm(prev => ({ ...prev, expected_payment_date: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Notas financeiras"
                value={form.financial_notes}
                onChange={e => setForm(prev => ({ ...prev, financial_notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" loading={loading}>Criar Processo</Button>
          <Link href="/processos"><Button variant="outline" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}

export default function NovoProcessoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando...</div>}>
      <NovoProcessoForm />
    </Suspense>
  )
}
