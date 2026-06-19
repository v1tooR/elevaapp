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
import { maskCurrency, parseCurrency } from '@/lib/masks'
import { syncProcessFinancial } from '@/lib/sync-process-financial'
import Link from 'next/link'
import { ArrowLeft, Sparkles, TrendingUp, Link2 } from 'lucide-react'
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
  const [clientGovPassword, setClientGovPassword] = useState('')

  const [form, setForm] = useState({
    client_id: preClientId,
    process_type_id: '',
    protocol: '',
    status: 'aberto',
    responsible_user_id: '',
    observations: '',
    service_value: '',        // valor formatado em BRL (ex: "R$ 1.200,00")
    payment_method: '',
    payment_status: 'pending',
    expected_payment_date: '',
    financial_notes: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('process_types').select('*').eq('is_active', true).order('name'),
      supabase.from('clients').select('id, name, gov_password_reference').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, name').in('role', ['admin', 'analista', 'super_admin']).order('name'),
    ]).then(([{ data: pt }, { data: cl }, { data: pf }]) => {
      setProcessTypes(pt ?? [])
      setClients(cl ?? [])
      setProfiles(pf ?? [])
      // Se já tem cliente pré-selecionado, carrega a senha dele
      if (preClientId && cl) {
        const found = cl.find((c: any) => c.id === preClientId)
        if (found?.gov_password_reference) setClientGovPassword(found.gov_password_reference)
      }
    })
  }, [])

  const handleClientChange = (clientId: string) => {
    setForm(prev => ({ ...prev, client_id: clientId }))
    const found = clients.find((c: any) => c.id === clientId)
    const govPass = found?.gov_password_reference ?? ''
    setClientGovPassword(govPass)
    // Atualiza senha_gov nos campos customizados se já estiver visível
    if (govPass) {
      setCustomFieldValues(prev => ({ ...prev, senha_gov: govPass }))
    }
  }

  const handleTypeChange = (typeId: string) => {
    setForm(prev => ({ ...prev, process_type_id: typeId }))
    const selectedType = processTypes.find(t => t.id === typeId)
    const slug = selectedType?.slug ?? ''
    setSelectedTypeSlug(slug)
    // Pré-preenche senha_gov se o tipo tiver esse campo e o cliente já estiver selecionado
    const fields = PROCESS_TYPE_CUSTOM_FIELDS[slug] ?? []
    const hasSenhaGov = fields.some(f => f.field_name === 'senha_gov')
    setCustomFieldValues(hasSenhaGov && clientGovPassword ? { senha_gov: clientGovPassword } : {})
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

    // Identifica o tipo de processo selecionado
    const selectedProcessType = processTypes.find(t => t.id === form.process_type_id)

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

    // Insert financial data + sync to finance_entries
    if (form.service_value || form.payment_method || form.financial_notes) {
      const serviceValue = form.service_value ? parseCurrency(form.service_value) : null

      // Sincroniza com o módulo financeiro (cria lançamento de receita)
      const financeEntryId = serviceValue ? await syncProcessFinancial(supabase, {
        processId: process.id,
        clientId: form.client_id,
        processTypeName: selectedProcessType?.name ?? 'Processo',
        processTypeSlug: selectedProcessType?.slug ?? '',
        serviceValue,
        paymentStatus: form.payment_status,
        expectedPaymentDate: form.expected_payment_date || null,
      }) : null

      await supabase.from('process_financials').insert({
        process_id: process.id,
        service_value: serviceValue,
        payment_method: form.payment_method as any || null,
        payment_status: form.payment_status as any,
        expected_payment_date: form.expected_payment_date || null,
        financial_notes: form.financial_notes || null,
        finance_entry_id: financeEntryId,
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
                onChange={e => handleClientChange(e.target.value)}
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
              {customFields.map(field => {
                const isAutoFilled = field.field_name === 'senha_gov' && !!clientGovPassword && customFieldValues['senha_gov'] === clientGovPassword
                return (
                  <div key={field.field_name}>
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
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-slate-700">{field.field_label}</label>
                          {isAutoFilled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                              <Sparkles className="w-2.5 h-2.5" /> Preenchido do cadastro
                            </span>
                          )}
                        </div>
                        <input
                          type={field.field_type === 'date' ? 'date' : field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'}
                          value={customFieldValues[field.field_name] ?? ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                          placeholder={field.field_type === 'currency' ? '0,00' : ''}
                          step={field.field_type === 'currency' ? '0.01' : undefined}
                          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Financial */}
        <Card padding="none">
          {/* Header com badge de integração */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">Financeiro</h2>
              <p className="text-xs text-slate-400 mt-0.5">Opcional — preencha se houver cobrança de serviço</p>
            </div>
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-2.5 py-1.5 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
              Integrado ao Módulo Financeiro
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Valor em destaque */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Valor do serviço</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.service_value}
                  onChange={e => {
                    const masked = maskCurrency(e.target.value)
                    setForm(prev => ({ ...prev, service_value: masked }))
                  }}
                  placeholder="R$ 0,00"
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Input
                label="Data prevista de pagamento"
                type="date"
                value={form.expected_payment_date}
                onChange={e => setForm(prev => ({ ...prev, expected_payment_date: e.target.value }))}
              />
            </div>

            {/* Status com mapeamento visual para o financeiro */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Status do pagamento</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'pending',        label: 'Pendente',     finance: 'Previsto',    color: 'text-slate-600  bg-slate-50  border-slate-200' },
                  { value: 'partially_paid', label: 'Parcial',      finance: 'Previsto',    color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                  { value: 'paid',           label: 'Pago',         finance: 'Confirmado',  color: 'text-green-700  bg-green-50  border-green-200' },
                  { value: 'overdue',        label: 'Em atraso',    finance: 'Em atraso',   color: 'text-red-700    bg-red-50    border-red-200' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, payment_status: opt.value }))}
                    className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      form.payment_status === opt.value
                        ? opt.color + ' ring-2 ring-offset-1 ring-blue-400 shadow-sm'
                        : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    {form.payment_status === opt.value && (
                      <span className="flex items-center gap-0.5 opacity-80">
                        <Link2 className="w-2.5 h-2.5" />{opt.finance}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="Notas financeiras"
              value={form.financial_notes}
              onChange={e => setForm(prev => ({ ...prev, financial_notes: e.target.value }))}
              rows={2}
              placeholder="Observações sobre pagamento, parcelamento, etc."
            />

            {/* Aviso de integração quando há valor */}
            {form.service_value && parseCurrency(form.service_value) > 0 && (
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">{form.service_value}</span> será registrado como{' '}
                  <span className="font-semibold">receita</span> no Módulo Financeiro
                  {form.payment_status === 'paid' ? ' com status Confirmado' : ' com status Previsto'}.
                </p>
              </div>
            )}
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
