import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export function normalizeClientEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase() || null
}

/**
 * Procura outro cliente que já use o mesmo e-mail. É uma verificação de
 * cortesia, para mostrar de quem é o cadastro conflitante — a garantia real
 * é o índice único `uq_clients_email_normalized` (migration 036).
 */
export async function findClientWithEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
  ignoreClientId?: string,
): Promise<{ id: string; name: string } | null> {
  const normalized = normalizeClientEmail(email)
  if (!normalized) return null

  // `ilike` trata `_` e `%` como curingas, então o filtro pode trazer resultados
  // a mais — a comparação exata é refeita abaixo.
  let query = supabase.from('clients').select('id, name, email').ilike('email', normalized).limit(20)
  if (ignoreClientId) query = query.neq('id', ignoreClientId)

  const { data, error } = await query
  if (error) return null

  const match = (data ?? []).find(row => normalizeClientEmail(row.email) === normalized)
  return match ? { id: match.id, name: match.name } : null
}

/**
 * Traduz a violação de índice único de `clients` para uma mensagem legível.
 * Retorna null quando o erro não é de duplicidade.
 */
export function duplicateClientMessage(
  error: Pick<PostgrestError, 'code' | 'message' | 'details'> | null | undefined,
  mode: 'create' | 'update',
) {
  if (error?.code !== '23505') return null

  const detail = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  const other = mode === 'update' ? 'outro ' : ''

  if (detail.includes('email')) return `Já existe ${other}cliente cadastrado com este e-mail.`
  if (detail.includes('cpf')) return `Já existe ${other}cliente cadastrado com este CPF.`
  return `Já existe ${other}cliente cadastrado com estes dados.`
}
