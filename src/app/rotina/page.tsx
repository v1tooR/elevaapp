import { redirect } from 'next/navigation'

/**
 * "Minha rotina" foi substituída pela Lista geral. A rota continua existindo
 * apenas para não quebrar links antigos e atalhos salvos.
 */
const CATEGORY_REDIRECTS: Record<string, Record<string, string>> = {
  acao_equipe: { acao: 'equipe' },
  sem_proxima_acao: { acao: 'sem_acao' },
  aguardando_cliente: { ator: 'cliente' },
  aguardando_orgao: { ator: 'orgao' },
  aguardando_dependencia: { ator: 'terceiro' },
  prazo_proximo: { prazo: 'sete_dias' },
  etapa_vencida: { pendencia: 'etapa_vencida' },
  documento_analise: { pendencia: 'documento_analise' },
  sem_responsavel: { pendencia: 'sem_responsavel' },
  autenticacao_cliente: { pendencia: 'autenticacao_cliente' },
  processo_parado: { pendencia: 'processo_parado' },
}

export default async function RotinaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; responsavel?: string; servico?: string; ator?: string; prazo?: string }>
}) {
  const filters = await searchParams
  const query = new URLSearchParams({
    ...(filters.tipo ? CATEGORY_REDIRECTS[filters.tipo] ?? {} : {}),
    ...(filters.responsavel ? { responsavel: filters.responsavel } : {}),
    ...(filters.servico ? { tipo: filters.servico } : {}),
    ...(filters.ator ? { ator: filters.ator } : {}),
    ...(filters.prazo ? { prazo: filters.prazo } : {}),
  })

  redirect(`/processos/lista${query.size ? `?${query.toString()}` : ''}`)
}
