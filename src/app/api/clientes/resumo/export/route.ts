import { NextResponse } from 'next/server'
import {
  CLIENT_DOCUMENT_STATE_LABELS,
  csvCell,
  type CompleteClientRow,
} from '@/lib/client-summary'
import { createClient } from '@/lib/supabase/server'
import { formatCPF, formatCurrency, formatDate, formatPhone, PROCESS_STATUS_LABELS } from '@/lib/utils'

const ALLOWED_DOCUMENT_STATES = new Set(Object.keys(CLIENT_DOCUMENT_STATE_LABELS))

function formatProcessStatus(value: CompleteClientRow['cnh_process_status']) {
  return value ? PROCESS_STATUS_LABELS[value] ?? value : ''
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!caller || !['super_admin', 'admin', 'analista'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sem permissao para exportar clientes.' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const filters = {
    q: params.get('q')?.trim() ?? '',
    contrato: params.get('contrato') ?? '',
    servico: params.get('servico') ?? '',
    responsavel: params.get('responsavel') ?? '',
    indicacao: params.get('indicacao') ?? '',
    concessionaria: params.get('concessionaria')?.trim() ?? '',
    cin: params.get('cin') ?? '',
    credencial: params.get('credencial') ?? '',
    de: params.get('de') ?? '',
    ate: params.get('ate') ?? '',
  }

  let query = supabase
    .from('client_complete_rows')
    .select('*')
    .eq('is_active', true)
    .order('client_name')
    .limit(5000)
  if (filters.q) query = query.ilike('search_text', `%${filters.q}%`)
  if (filters.contrato === 'com') query = query.not('contract_id', 'is', null)
  if (filters.contrato === 'sem') query = query.is('contract_id', null)
  if (filters.servico) query = query.contains('service_keys', [filters.servico])
  if (filters.responsavel) query = query.eq('commercial_owner_id', filters.responsavel)
  if (filters.indicacao) query = query.eq('referral_partner_id', filters.indicacao)
  if (filters.concessionaria) query = query.ilike('dealership', `%${filters.concessionaria}%`)
  if (ALLOWED_DOCUMENT_STATES.has(filters.cin)) query = query.eq('cin_document_state', filters.cin)
  if (ALLOWED_DOCUMENT_STATES.has(filters.credencial)) query = query.eq('credential_document_state', filters.credencial)
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.de)) query = query.gte('client_created_at', `${filters.de}T00:00:00`)
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.ate)) query = query.lte('client_created_at', `${filters.ate}T23:59:59`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const header = [
    'Cliente', 'CPF', 'Telefone', 'E-mail', 'Cadastro', 'Servicos',
    'Contrato', 'Situacao do contrato', 'Valor do contrato', 'Responsavel comercial',
    'Indicacao', 'Origem', 'Concessionaria', 'Vendedor da concessionaria',
    'Veiculo', 'Valor do veiculo', 'Data da compra', 'Proxima troca',
    'CNH', 'Vencimento da CNH', 'CIN', 'Validade da CIN',
    'Credencial', 'Validade da credencial',
  ]
  const rows = (data ?? []) as CompleteClientRow[]
  const csv = [
    header.map(csvCell).join(';'),
    ...rows.map(client => [
      client.client_name,
      client.client_cpf ? formatCPF(client.client_cpf) : '',
      client.client_phone ? formatPhone(client.client_phone) : '',
      client.client_email,
      formatDate(client.client_created_at),
      client.service_names?.join(', '),
      client.contract_label,
      client.contract_status,
      client.contract_value == null ? '' : formatCurrency(Number(client.contract_value)),
      client.commercial_owner_name,
      client.indication_name,
      client.lead_source,
      client.dealership,
      client.salesperson,
      client.purchase_vehicle,
      client.vehicle_price == null ? '' : formatCurrency(Number(client.vehicle_price)),
      client.purchase_date ? formatDate(client.purchase_date) : '',
      client.next_vehicle_change_date ? formatDate(client.next_vehicle_change_date) : '',
      formatProcessStatus(client.cnh_process_status) || client.cnh_status,
      client.cnh_expiry_date ? formatDate(client.cnh_expiry_date) : '',
      CLIENT_DOCUMENT_STATE_LABELS[client.cin_document_state],
      client.cin_valid_until ? formatDate(client.cin_valid_until) : '',
      CLIENT_DOCUMENT_STATE_LABELS[client.credential_document_state],
      client.credential_valid_until ? formatDate(client.credential_valid_until) : '',
    ].map(csvCell).join(';')),
  ].join('\r\n')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-resumo-${today}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
