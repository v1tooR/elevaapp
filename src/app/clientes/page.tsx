import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Users, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCPF, formatPhone } from '@/lib/utils'
import type { Client } from '@/types/database'

interface SearchParams { q?: string; page?: string }

function avatarGradient(name: string) {
  const g = [
    'linear-gradient(135deg,#1E3A5F,#3B82F6)',
    'linear-gradient(135deg,#064E3B,#10B981)',
    'linear-gradient(135deg,#7C2D12,#F97316)',
    'linear-gradient(135deg,#4C1D95,#8B5CF6)',
    'linear-gradient(135deg,#881337,#F43F5E)',
    'linear-gradient(135deg,#134E4A,#14B8A6)',
  ]
  const n = [...name].reduce((s, c) => s + c.charCodeAt(0), 0)
  return g[n % g.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        .dash { font-family: 'Outfit', sans-serif; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .client-row { transition: background 0.12s; }
        .client-row:hover { background: #F8FAFC; }
        .client-row:hover .client-name { color: #2563EB; }
        .client-row:hover .row-arrow { opacity: 1; transform: translate(0,0); }
        .row-arrow { opacity: 0; transform: translate(-4px, 4px); transition: opacity 0.15s, transform 0.15s; }
        .search-input:focus { box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
      `}</style>

      <div className="space-y-5">

        {/* â”€â”€ Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0C1A2E 0%, #1A3055 55%, #1E40AF 100%)' }}
        >
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #60A5FA, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative flex items-center justify-between gap-4 p-6 lg:p-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h1 className="dash text-white text-2xl lg:text-3xl font-bold leading-tight">Clientes</h1>
                <p className="dash text-blue-300/70 text-sm mt-0.5">
                  {count ?? 0} cliente{count !== 1 ? 's' : ''} cadastrado{count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Link
              href="/clientes/novo"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 transition-all dash"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </Link>
          </div>
        </div>

        {/* â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="anim anim-1 bg-white rounded-2xl p-4"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <form method="GET" className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome, CPF, telefone ou e-mail..."
                className="search-input w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all dash"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors dash"
            >
              Buscar
            </button>
            {q && (
              <Link
                href="/clientes"
                className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors dash"
              >
                Limpar
              </Link>
            )}
          </form>
          {q && (
            <p className="text-xs text-slate-400 mt-2.5 ml-1 dash">
              {count ?? 0} resultado{count !== 1 ? 's' : ''} para &quot;{q}&quot;
            </p>
          )}
        </div>

        {/* â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="anim anim-2 bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {!clients || clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="dash font-semibold text-slate-700">
                  {q ? 'Nenhum resultado encontrado' : 'Nenhum cliente cadastrado'}
                </p>
                <p className="text-sm text-slate-400 mt-1 dash">
                  {q ? `Tente buscar por outro termo` : 'Comece adicionando o primeiro cliente'}
                </p>
              </div>
              {!q && (
                <Link
                  href="/clientes/novo"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors dash"
                >
                  <Plus className="w-4 h-4" /> Cadastrar cliente
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">CPF</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Telefone</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">E-mail</th>
                    <th className="text-left px-5 py-3.5 dash font-semibold text-slate-500 text-xs uppercase tracking-wider hidden xl:table-cell">Cidade/UF</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client: Client) => (
                    <tr key={client.id} className="client-row border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold dash"
                            style={{ background: avatarGradient(client.name) }}
                          >
                            {initials(client.name)}
                          </div>
                          <span className="client-name font-semibold text-slate-900 transition-colors dash">
                            {client.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell dash">
                        {client.cpf ? formatCPF(client.cpf) : <span className="text-slate-300">â€”</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell dash">
                        {client.phone ? formatPhone(client.phone) : <span className="text-slate-300">â€”</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell dash">
                        {client.email ?? <span className="text-slate-300">â€”</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 hidden xl:table-cell dash">
                        {client.city && client.state
                          ? `${client.city} / ${client.state}`
                          : client.city ?? <span className="text-slate-300">â€”</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/clientes/${client.id}`}
                          className="flex items-center justify-end gap-1 text-blue-600 text-xs font-semibold dash hover:text-blue-700"
                        >
                          <span className="hidden sm:inline">Ver</span>
                          <ArrowUpRight className="row-arrow w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* â”€â”€ Pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {totalPages > 1 && (
          <div className="anim anim-3 flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={`/clientes?q=${q}&page=${page - 1}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dash"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Link>
            ) : (
              <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-300 dash cursor-not-allowed">
                <ChevronLeft className="w-4 h-4 inline" /> Anterior
              </div>
            )}

            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl">
              <span className="text-sm text-slate-500 dash">
                <span className="font-bold text-slate-900">{page}</span> de <span className="font-bold text-slate-900">{totalPages}</span>
              </span>
            </div>

            {page < totalPages ? (
              <Link
                href={`/clientes?q=${q}&page=${page + 1}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dash"
              >
                PrÃ³xima <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-300 dash cursor-not-allowed">
                PrÃ³xima <ChevronRight className="w-4 h-4 inline" />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
