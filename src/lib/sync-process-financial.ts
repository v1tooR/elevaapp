import type { SupabaseClient } from '@supabase/supabase-js'

// Mapeia slug do tipo de processo → nome da categoria financeira
const SLUG_TO_CATEGORY: Record<string, string> = {
  processo_ipi:    'IPI',
  processo_iof:    'IOF',
  processo_icms:   'ICMS',
  processo_ipva:   'IPVA',
  cnh_especial:    'CNH Especial',
  estacionamento:  'Estacionamento',
  laudo:           'Laudo Médico',
  emplacamento:    'Emplacamento',
  imposto_de_renda:'Imposto de Renda',
}

// Mapeia payment_status → finance status
const PAYMENT_TO_FINANCE: Record<string, string | null> = {
  pending:         'PREDICTED',
  partially_paid:  'PREDICTED',
  paid:            'CONFIRMED',
  overdue:         'OVERDUE',
  canceled:        null, // não cria lançamento
}

interface SyncInput {
  processId: string
  clientId: string
  processTypeName: string
  processTypeSlug: string
  serviceValue: number | null
  paymentStatus: string
  expectedPaymentDate?: string | null
  existingFinanceEntryId?: string | null
  createdByProfileId?: string | null
}

/**
 * Cria ou atualiza o lançamento de receita em finance_entries
 * correspondente ao financeiro de um processo.
 * Retorna o finance_entry_id resultante (ou null se cancelado/sem valor).
 */
export async function syncProcessFinancial(
  supabase: SupabaseClient,
  input: SyncInput,
): Promise<string | null> {
  const {
    processId, clientId, processTypeName, processTypeSlug,
    serviceValue, paymentStatus, expectedPaymentDate,
    existingFinanceEntryId, createdByProfileId,
  } = input

  const financeStatus = PAYMENT_TO_FINANCE[paymentStatus]

  // Se cancelado ou sem valor, remove o lançamento existente e encerra
  if (!financeStatus || !serviceValue || serviceValue <= 0) {
    if (existingFinanceEntryId) {
      await supabase.from('finance_entries').delete().eq('id', existingFinanceEntryId)
    }
    return null
  }

  // Encontra a categoria certa
  const categoryName = SLUG_TO_CATEGORY[processTypeSlug] ?? 'Honorários'
  const { data: categoryRow } = await supabase
    .from('finance_categories')
    .select('id')
    .eq('name', categoryName)
    .maybeSingle()

  const categoryId = categoryRow?.id ?? null

  const entryDate = expectedPaymentDate || new Date().toISOString().split('T')[0]
  const title = `${processTypeName} — Honorários`

  if (existingFinanceEntryId) {
    // Atualiza o lançamento existente
    await supabase.from('finance_entries').update({
      title,
      amount: serviceValue,
      occurred_at: entryDate,
      status: financeStatus,
      category_id: categoryId,
      client_id: clientId,
      process_id: processId,
    }).eq('id', existingFinanceEntryId)
    return existingFinanceEntryId
  } else {
    // Cria novo lançamento
    const { data } = await supabase.from('finance_entries').insert({
      type: 'INCOME',
      title,
      amount: serviceValue,
      occurred_at: entryDate,
      status: financeStatus,
      category_id: categoryId,
      client_id: clientId,
      process_id: processId,
      recurrence: 'NONE',
      created_by: createdByProfileId ?? null,
    }).select('id').single()
    return data?.id ?? null
  }
}
