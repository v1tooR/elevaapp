'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  BanknoteArrowDown,
  ChevronDown,
  CircleDollarSign,
  Loader2,
  Plus,
  ReceiptText,
  TrendingUp,
  X,
} from 'lucide-react'

interface Installment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  paid_amount: number
  status: string
  effective_status: string
}

interface ContractCost { id: string; description: string; amount: number; occurred_at: string }
interface Commission {
  id: string
  amount: number
  status: string
  percentage: number | null
  beneficiary_name: string | null
  referral_partners?: { name: string } | null
  profiles?: { name: string } | null
}

interface Contract {
  id: string
  client_id: string
  process_id: string | null
  total_amount: number
  discount_amount: number
  net_amount: number
  contracted_at: string
  status: string
  clients: { id: string; name: string } | null
  processes: { id: string; process_types: { name: string } | null } | null
  installments: Installment[]
  costs: ContractCost[]
  commissions: Commission[]
  summary: {
    received: number
    outstanding: number
    costs: number
    commissions: number
    estimatedProfit: number
    marginPercentage: number
    overdueInstallments: number
  }
}

interface OptionRow { id: string; name: string }
interface ProcessOption { id: string; client_id: string; status: string; process_types: { name: string } | null }
interface EngagementOption { id: string; client_id: string; status: string }
interface ContractPayload {
  contracts: Contract[]
  options: {
    clients: OptionRow[]
    processes: ProcessOption[]
    partners: OptionRow[]
    engagements: EngagementOption[]
  }
}

const EMPTY_DATA: ContractPayload = {
  contracts: [],
  options: { clients: [], processes: [], partners: [], engagements: [] },
}

const today = () => new Date().toISOString().slice(0, 10)
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numberValue = (value: string) => Number(value.replace(',', '.')) || 0

export function FinancialContractsPanel() {
  const [data, setData] = useState<ContractPayload>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({})
  const [costContractId, setCostContractId] = useState<string | null>(null)
  const [costForm, setCostForm] = useState({ description: '', amount: '', occurredAt: today() })
  const [form, setForm] = useState({
    clientId: '',
    processId: '',
    serviceEngagementId: '',
    totalAmount: '',
    discountAmount: '',
    installmentCount: '1',
    firstDueDate: today(),
    contractedAt: today(),
    paymentMethod: 'pix',
    notes: '',
    commissionPartnerId: '',
    commissionName: '',
    commissionPercentage: '',
    commissionAmount: '',
    commissionDueDate: '',
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/financeiro/contratos', { cache: 'no-store' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error ?? 'Não foi possível carregar os contratos.')
    else {
      setData(result as ContractPayload)
      setError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const summary = useMemo(() => data.contracts.reduce((result, contract) => ({
    contracted: result.contracted + Number(contract.net_amount),
    received: result.received + contract.summary.received,
    outstanding: result.outstanding + contract.summary.outstanding,
    costs: result.costs + contract.summary.costs,
    profit: result.profit + contract.summary.estimatedProfit,
  }), { contracted: 0, received: 0, outstanding: 0, costs: 0, profit: 0 }), [data.contracts])

  const clientProcesses = data.options.processes.filter(process => process.client_id === form.clientId)
  const clientEngagements = data.options.engagements.filter(engagement => engagement.client_id === form.clientId)

  const createContract = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const commissionAmount = numberValue(form.commissionAmount)
    const response = await fetch('/api/financeiro/contratos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: form.clientId,
        processId: form.processId || null,
        serviceEngagementId: form.serviceEngagementId || null,
        totalAmount: numberValue(form.totalAmount),
        discountAmount: numberValue(form.discountAmount),
        installmentCount: Number(form.installmentCount),
        firstDueDate: form.firstDueDate,
        contractedAt: form.contractedAt,
        paymentMethod: form.paymentMethod,
        notes: form.notes || null,
        commission: commissionAmount > 0 ? {
          referralPartnerId: form.commissionPartnerId || null,
          beneficiaryName: form.commissionName || null,
          percentage: form.commissionPercentage ? numberValue(form.commissionPercentage) : null,
          amount: commissionAmount,
          dueDate: form.commissionDueDate || null,
        } : null,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error ?? 'Não foi possível criar o contrato.')
    else {
      setShowForm(false)
      setForm(current => ({
        ...current,
        processId: '', serviceEngagementId: '', totalAmount: '', discountAmount: '',
        installmentCount: '1', notes: '', commissionPartnerId: '', commissionName: '',
        commissionPercentage: '', commissionAmount: '', commissionDueDate: '',
      }))
      await refresh()
    }
    setBusy(false)
  }

  const receive = async (installment: Installment) => {
    const remaining = Number(installment.amount) - Number(installment.paid_amount)
    const amount = numberValue(paymentValues[installment.id] ?? String(remaining))
    if (amount <= 0) return
    setBusy(true)
    setError('')
    const response = await fetch(`/api/financeiro/parcelas/${installment.id}/recebimentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, paidAt: new Date().toISOString(), paymentMethod: 'pix' }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error ?? 'Não foi possível registrar o recebimento.')
    else {
      setPaymentValues(current => ({ ...current, [installment.id]: '' }))
      await refresh()
    }
    setBusy(false)
  }

  const addCost = async (contractId: string) => {
    setBusy(true)
    setError('')
    const response = await fetch(`/api/financeiro/contratos/${contractId}/custos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: costForm.description,
        amount: numberValue(costForm.amount),
        occurredAt: costForm.occurredAt,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error ?? 'Não foi possível registrar o custo.')
    else {
      setCostForm({ description: '', amount: '', occurredAt: today() })
      setCostContractId(null)
      await refresh()
    }
    setBusy(false)
  }

  const inputClass = 'dash h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-primary'
  const labelClass = 'dash space-y-1 text-xs font-semibold text-slate-600'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="dash text-lg font-bold text-slate-900">Contratos e rentabilidade</h2>
          <p className="dash mt-0.5 text-xs text-slate-500">Parcelas, recebimentos parciais, custos e comissões vinculados ao atendimento.</p>
        </div>
        <button type="button" onClick={() => setShowForm(current => !current)} className="dash inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Fechar' : 'Novo contrato'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Contratado', value: summary.contracted, icon: ReceiptText, tone: 'text-blue-700 bg-blue-50' },
          { label: 'Recebido', value: summary.received, icon: CircleDollarSign, tone: 'text-emerald-700 bg-emerald-50' },
          { label: 'A receber', value: summary.outstanding, icon: BanknoteArrowDown, tone: 'text-amber-700 bg-amber-50' },
          { label: 'Custos', value: summary.costs, icon: BadgeDollarSign, tone: 'text-red-700 bg-red-50' },
          { label: 'Lucro estimado', value: summary.profit, icon: TrendingUp, tone: summary.profit >= 0 ? 'text-violet-700 bg-violet-50' : 'text-red-700 bg-red-50' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-xl ${card.tone}`}><card.icon className="h-4 w-4" /></div>
            <p className="dash text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
            <p className="dash mt-1 text-base font-extrabold text-slate-900">{currency(card.value)}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={createContract} className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className={labelClass}>Cliente *
              <select required value={form.clientId} onChange={event => setForm(current => ({ ...current, clientId: event.target.value, processId: '', serviceEngagementId: '' }))} className={inputClass}>
                <option value="">Selecione</option>{data.options.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Processo
              <select value={form.processId} onChange={event => setForm(current => ({ ...current, processId: event.target.value }))} className={inputClass}>
                <option value="">Contrato geral</option>{clientProcesses.map(process => <option key={process.id} value={process.id}>{process.process_types?.name ?? 'Processo'} · {process.status.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className={labelClass}>Plano de serviços
              <select value={form.serviceEngagementId} onChange={event => setForm(current => ({ ...current, serviceEngagementId: event.target.value }))} className={inputClass}>
                <option value="">Sem vínculo</option>{clientEngagements.map(plan => <option key={plan.id} value={plan.id}>Plano {plan.id.slice(0, 8)}</option>)}
              </select>
            </label>
            <label className={labelClass}>Valor contratado *<input required inputMode="decimal" value={form.totalAmount} onChange={event => setForm(current => ({ ...current, totalAmount: event.target.value }))} className={inputClass} placeholder="0,00" /></label>
            <label className={labelClass}>Desconto<input inputMode="decimal" value={form.discountAmount} onChange={event => setForm(current => ({ ...current, discountAmount: event.target.value }))} className={inputClass} placeholder="0,00" /></label>
            <label className={labelClass}>Quantidade de parcelas *<input required type="number" min="1" max="60" value={form.installmentCount} onChange={event => setForm(current => ({ ...current, installmentCount: event.target.value }))} className={inputClass} /></label>
            <label className={labelClass}>Data do contrato *<input required type="date" value={form.contractedAt} onChange={event => setForm(current => ({ ...current, contractedAt: event.target.value }))} className={inputClass} /></label>
            <label className={labelClass}>Primeiro vencimento *<input required type="date" value={form.firstDueDate} onChange={event => setForm(current => ({ ...current, firstDueDate: event.target.value }))} className={inputClass} /></label>
            <label className={labelClass}>Forma prevista
              <select value={form.paymentMethod} onChange={event => setForm(current => ({ ...current, paymentMethod: event.target.value }))} className={inputClass}><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option></select>
            </label>
          </div>
          <fieldset className="rounded-xl border border-slate-200 bg-white/70 p-4">
            <legend className="dash px-1 text-xs font-bold text-slate-700">Comissão opcional</legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className={labelClass}>Parceiro<select value={form.commissionPartnerId} onChange={event => setForm(current => ({ ...current, commissionPartnerId: event.target.value }))} className={inputClass}><option value="">Outro / nenhum</option>{data.options.partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
              <label className={labelClass}>Nome livre<input value={form.commissionName} onChange={event => setForm(current => ({ ...current, commissionName: event.target.value }))} className={inputClass} /></label>
              <label className={labelClass}>Percentual<input inputMode="decimal" value={form.commissionPercentage} onChange={event => setForm(current => ({ ...current, commissionPercentage: event.target.value }))} className={inputClass} placeholder="Opcional" /></label>
              <label className={labelClass}>Valor da comissão<input inputMode="decimal" value={form.commissionAmount} onChange={event => setForm(current => ({ ...current, commissionAmount: event.target.value }))} className={inputClass} placeholder="0,00" /></label>
            </div>
          </fieldset>
          <label className={labelClass}>Observações<textarea rows={2} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className={`${inputClass} h-auto py-2`} /></label>
          <button disabled={busy} className="dash inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Criar contrato e parcelas</button>
        </form>
      )}

      {error && <p className="dash rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos...</div>
        ) : data.contracts.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">Nenhum contrato financeiro cadastrado.</div>
        ) : data.contracts.map(contract => {
          const progress = Number(contract.net_amount) > 0 ? Math.min(100, contract.summary.received / Number(contract.net_amount) * 100) : 0
          const expanded = expandedId === contract.id
          return (
            <article key={contract.id} className="border-b border-slate-100 last:border-0">
              <button type="button" onClick={() => setExpandedId(expanded ? null : contract.id)} className="flex w-full flex-col gap-3 px-5 py-4 text-left hover:bg-slate-50 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="dash font-bold text-slate-900">{contract.clients?.name}</p><span className="dash rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{contract.processes?.process_types?.name ?? 'Contrato geral'}</span>{contract.summary.overdueInstallments > 0 && <span className="dash rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{contract.summary.overdueInstallments} em atraso</span>}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                  <p className="dash mt-1 text-[10px] text-slate-500">{currency(contract.summary.received)} recebidos de {currency(Number(contract.net_amount))}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right sm:grid-cols-3">
                  <div><p className="dash text-[9px] uppercase text-slate-400">A receber</p><p className="dash text-xs font-bold text-amber-700">{currency(contract.summary.outstanding)}</p></div>
                  <div><p className="dash text-[9px] uppercase text-slate-400">Custos + comissão</p><p className="dash text-xs font-bold text-red-700">{currency(contract.summary.costs + contract.summary.commissions)}</p></div>
                  <div><p className="dash text-[9px] uppercase text-slate-400">Margem</p><p className="dash text-xs font-bold text-violet-700">{contract.summary.marginPercentage.toFixed(1)}%</p></div>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-5">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {contract.installments.map(installment => {
                      const remaining = Number(installment.amount) - Number(installment.paid_amount)
                      const paid = installment.status === 'pago'
                      return (
                        <div key={installment.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                          <div className="flex items-start justify-between gap-3"><div><p className="dash text-sm font-bold text-slate-800">Parcela {installment.installment_number}</p><p className="dash mt-0.5 text-xs text-slate-500">Vence em {new Date(`${installment.due_date}T12:00:00`).toLocaleDateString('pt-BR')}</p></div><span className={`dash rounded-full px-2 py-0.5 text-[10px] font-bold ${paid ? 'bg-emerald-100 text-emerald-700' : installment.effective_status === 'vencido' ? 'bg-red-100 text-red-700' : installment.status === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{paid ? 'Pago' : installment.effective_status === 'vencido' ? 'Vencido' : installment.status === 'parcial' ? 'Parcial' : 'Pendente'}</span></div>
                          <p className="dash mt-2 text-xs text-slate-600">{currency(Number(installment.paid_amount))} de {currency(Number(installment.amount))}</p>
                          {!paid && <div className="mt-3 flex gap-2"><input aria-label="Valor recebido" inputMode="decimal" value={paymentValues[installment.id] ?? ''} onChange={event => setPaymentValues(current => ({ ...current, [installment.id]: event.target.value }))} className="dash h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs" placeholder={remaining.toFixed(2).replace('.', ',')} /><button type="button" disabled={busy} onClick={() => void receive(installment)} className="dash rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">Receber</button></div>}
                        </div>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><div><p className="dash text-sm font-bold text-slate-800">Custos do atendimento</p><p className="dash text-xs text-slate-500">{currency(contract.summary.costs)} registrados</p></div><button type="button" onClick={() => setCostContractId(costContractId === contract.id ? null : contract.id)} className="dash text-xs font-semibold text-primary">+ Registrar custo</button></div>{contract.costs.map(cost => <p key={cost.id} className="dash mt-2 flex justify-between border-t border-slate-100 pt-2 text-xs text-slate-600"><span>{cost.description}</span><b>{currency(Number(cost.amount))}</b></p>)}{costContractId === contract.id && <div className="mt-3 grid grid-cols-2 gap-2"><input value={costForm.description} onChange={event => setCostForm(current => ({ ...current, description: event.target.value }))} className="dash col-span-2 h-9 rounded-lg border border-slate-200 px-3 text-xs" placeholder="Descrição do custo" /><input inputMode="decimal" value={costForm.amount} onChange={event => setCostForm(current => ({ ...current, amount: event.target.value }))} className="dash h-9 rounded-lg border border-slate-200 px-3 text-xs" placeholder="Valor" /><button type="button" disabled={busy} onClick={() => void addCost(contract.id)} className="dash rounded-lg bg-red-600 px-3 text-xs font-semibold text-white">Salvar custo</button></div>}</div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="dash text-sm font-bold text-slate-800">Comissões</p><p className="dash text-xs text-slate-500">{currency(contract.summary.commissions)} previstas</p>{contract.commissions.length === 0 ? <p className="dash mt-3 text-xs text-slate-400">Nenhuma comissão vinculada.</p> : contract.commissions.map(commission => <p key={commission.id} className="dash mt-2 flex justify-between border-t border-slate-100 pt-2 text-xs text-slate-600"><span>{commission.referral_partners?.name ?? commission.profiles?.name ?? commission.beneficiary_name ?? 'Beneficiário'}{commission.percentage != null ? ` · ${commission.percentage}%` : ''}</span><b>{currency(Number(commission.amount))}</b></p>)}</div>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
