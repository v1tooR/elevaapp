import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatCPF, formatPhone } from '@/lib/utils'
import type { Client } from '@/types/database'

interface SearchParams { q?: string; page?: string }

export default async function ClientesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q ?? ''
  const page = parseInt(params.page ?? '1')
  const perPage = 20

  const supabase = await createClient()
  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('name', { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1)

  if (q) {
    query = query.or(`name.ilike.%${q}%,cpf.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: clients, count } = await query
  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">{count ?? 0} cliente(s) cadastrado(s)</p>
        </div>
        <Link
          href="/clientes/novo"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Link>
      </div>

      {/* Search */}
      <Card padding="sm">
        <form method="GET" className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome, CPF, telefone ou e-mail..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
            Buscar
          </button>
          {q && (
            <Link href="/clientes" className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">
              Limpar
            </Link>
          )}
        </form>
      </Card>

      {/* Table */}
      <Card padding="none">
        {!clients || clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhum cliente encontrado</p>
            <p className="text-slate-400 text-sm mt-1">
              {q ? 'Tente ajustar os filtros de busca' : 'Cadastre o primeiro cliente'}
            </p>
            {!q && (
              <Link href="/clientes/novo" className="mt-4 inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline">
                <Plus className="w-4 h-4" /> Cadastrar cliente
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Nome</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden md:table-cell">CPF</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden lg:table-cell">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden lg:table-cell">E-mail</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 hidden xl:table-cell">Cidade/UF</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clients.map((client: Client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-blue-700">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-slate-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">
                      {client.cpf ? formatCPF(client.cpf) : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">
                      {client.phone ? formatPhone(client.phone) : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden lg:table-cell">
                      {client.email ?? '-'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden xl:table-cell">
                      {client.city && client.state ? `${client.city}/${client.state}` : client.city ?? '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/clientes/${client.id}`}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/clientes?q=${q}&page=${page - 1}`} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
              Anterior
            </Link>
          )}
          <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={`/clientes?q=${q}&page=${page + 1}`} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
              Próxima
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
