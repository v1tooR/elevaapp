import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildInstallmentSchedule, calculateContractProfit } from '@/lib/financial-contracts'

const createContractSchema = z.object({
  clientId: z.uuid(),
  processId: z.uuid().nullable().optional(),
  serviceEngagementId: z.uuid().nullable().optional(),
  totalAmount: z.number().positive().max(100000000),
  discountAmount: z.number().min(0).max(100000000).default(0),
  installmentCount: z.number().int().min(1).max(60),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(['pix', 'cartao', 'boleto', 'dinheiro', 'transferencia']).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  commission: z.object({
    referralPartnerId: z.uuid().nullable().optional(),
    beneficiaryName: z.string().trim().max(160).nullable().optional(),
    percentage: z.number().min(0).max(100).nullable().optional(),
    amount: z.number().min(0).max(100000000),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).refine(value => (
    value.amount === 0
    || Boolean(value.referralPartnerId || value.beneficiaryName?.trim())
  ), { message: 'Informe o beneficiario da comissao.' }).nullable().optional(),
}).refine(value => value.discountAmount <= value.totalAmount, {
  message: 'O desconto nao pode superar o valor do contrato.',
  path: ['discountAmount'],
})

async function requireFinanceAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nao autorizado.', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
    return { error: 'Acesso restrito a administradores.', status: 403 as const }
  }
  return { supabase, profile }
}

export async function GET() {
  const auth = await requireFinanceAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [contractsResult, clientsResult, processesResult, partnersResult, engagementsResult] = await Promise.all([
    auth.supabase
      .from('financial_contracts')
      .select('*, clients(id, name), processes(id, process_types(name))')
      .neq('status', 'cancelado')
      .order('contracted_at', { ascending: false }),
    auth.supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    auth.supabase
      .from('processes')
      .select('id, client_id, status, process_types(name)')
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false }),
    auth.supabase
      .from('referral_partners')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    auth.supabase
      .from('client_service_engagements')
      .select('id, client_id, status')
      .neq('status', 'cancelado'),
  ])

  const baseError = contractsResult.error || clientsResult.error || processesResult.error || partnersResult.error || engagementsResult.error
  if (baseError) return NextResponse.json({ error: baseError.message }, { status: 400 })

  const contracts = contractsResult.data ?? []
  const contractIds = contracts.map(contract => contract.id)
  const empty = { data: [], error: null }
  const [installmentsResult, costsResult, commissionsResult] = await Promise.all([
    contractIds.length
      ? auth.supabase.from('financial_installments').select('*').in('contract_id', contractIds).order('installment_number')
      : empty,
    contractIds.length
      ? auth.supabase.from('financial_contract_costs').select('*').in('contract_id', contractIds).order('occurred_at', { ascending: false })
      : empty,
    contractIds.length
      ? auth.supabase.from('financial_commissions').select('*, referral_partners(name), profiles(name)').in('contract_id', contractIds)
      : empty,
  ])
  const detailError = installmentsResult.error || costsResult.error || commissionsResult.error
  if (detailError) return NextResponse.json({ error: detailError.message }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const contractsWithSummary = contracts.map(contract => {
    const installments = (installmentsResult.data ?? [])
      .filter(item => item.contract_id === contract.id)
      .map(item => ({
        ...item,
        effective_status: item.status === 'pendente' && item.due_date < today
          ? 'vencido'
          : item.status,
      }))
    const costs = (costsResult.data ?? []).filter(item => item.contract_id === contract.id)
    const commissions = (commissionsResult.data ?? []).filter(item => item.contract_id === contract.id)
    const received = installments.reduce((sum, item) => sum + Number(item.paid_amount), 0)
    const totalCosts = costs.reduce((sum, item) => sum + Number(item.amount), 0)
    const totalCommissions = commissions
      .filter(item => item.status !== 'dispensado')
      .reduce((sum, item) => sum + Number(item.amount), 0)
    const netAmount = Number(contract.net_amount)
    const profitability = calculateContractProfit({
      netAmount,
      received,
      costs: totalCosts,
      commissions: totalCommissions,
    })

    return {
      ...contract,
      installments,
      costs,
      commissions,
      summary: {
        received,
        outstanding: profitability.outstanding,
        costs: totalCosts,
        commissions: totalCommissions,
        estimatedProfit: profitability.estimatedProfit,
        marginPercentage: profitability.marginPercentage,
        overdueInstallments: installments.filter(item => item.effective_status === 'vencido').length,
      },
    }
  })

  return NextResponse.json({
    contracts: contractsWithSummary,
    options: {
      clients: clientsResult.data ?? [],
      processes: processesResult.data ?? [],
      partners: partnersResult.data ?? [],
      engagements: engagementsResult.data ?? [],
    },
  })
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = createContractSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Revise os dados do contrato.' },
      { status: 422 },
    )
  }

  const value = parsed.data
  const installments = buildInstallmentSchedule(
    value.totalAmount - value.discountAmount,
    value.installmentCount,
    value.firstDueDate,
  )
  const commissions = value.commission && value.commission.amount > 0
    ? [{
        referral_partner_id: value.commission.referralPartnerId ?? null,
        profile_id: null,
        beneficiary_name: value.commission.beneficiaryName ?? null,
        percentage: value.commission.percentage ?? null,
        amount: value.commission.amount,
        due_date: value.commission.dueDate ?? null,
      }]
    : []

  const { data: contractId, error } = await auth.supabase.rpc('create_financial_contract', {
    p_client_id: value.clientId,
    p_service_engagement_id: value.serviceEngagementId ?? null,
    p_process_id: value.processId ?? null,
    p_total_amount: value.totalAmount,
    p_discount_amount: value.discountAmount,
    p_contracted_at: value.contractedAt,
    p_payment_method: value.paymentMethod ?? null,
    p_notes: value.notes ?? null,
    p_installments: installments,
    p_commissions: commissions,
  })

  if (error || !contractId) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel criar o contrato.' }, { status: 400 })
  }
  return NextResponse.json({ contractId }, { status: 201 })
}
