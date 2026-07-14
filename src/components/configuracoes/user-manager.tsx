'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, X, Loader2 } from 'lucide-react'

const ROLE_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  super_admin: { label: 'Super Admin', bg: 'rgba(139,92,246,0.1)',  color: '#7c3aed', border: 'rgba(139,92,246,0.25)' },
  admin:       { label: 'Admin',       bg: 'rgba(99,102,241,0.1)',  color: '#4338ca', border: 'rgba(99,102,241,0.25)' },
  analista:    { label: 'Analista',    bg: 'rgba(34,197,94,0.1)',   color: '#15803d', border: 'rgba(34,197,94,0.25)'  },
  cliente:     { label: 'Cliente',     bg: 'rgba(148,163,184,0.1)', color: '#475569', border: 'rgba(148,163,184,0.2)' },
}

const AVATAR_COLORS = [
  { bg: 'rgba(99,102,241,0.15)',  color: '#6366f1' },
  { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  { bg: 'rgba(245,158,11,0.15)',  color: '#d97706' },
  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  { bg: 'rgba(139,92,246,0.15)',  color: '#7c3aed' },
  { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
]

const inpCls = 'dash block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 focus:border-indigo-300 transition-all'
const selCls = 'dash block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300/40 focus:border-indigo-300 transition-all cursor-pointer'

export function UserManager({ profiles }: { profiles: any[] }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'analista' })

  const updateRole = async (id: string, role: string) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ role }).eq('id', id)
    router.refresh()
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: { data: { name: newUser.name, role: newUser.role } },
    })
    if (err) {
      setError(err.message)
    } else {
      setShowCreate(false)
      setNewUser({ email: '', name: '', password: '', role: 'analista' })
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Users className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <h2 className="dash text-base font-bold text-slate-800">Usuários</h2>
          <p className="dash text-xs text-slate-400">{profiles.length} usuário{profiles.length !== 1 ? 's' : ''} cadastrado{profiles.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* List card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {profiles.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-200">
              <Users className="w-5 h-5 text-slate-300" />
            </div>
            <p className="dash text-sm text-slate-400">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {profiles.map((p, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length]
              const cfg = ROLE_CFG[p.role] ?? ROLE_CFG.cliente
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: av.bg, color: av.color, border: `1px solid ${av.color}30` }}
                  >
                    {p.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="dash text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="dash text-xs text-slate-400 truncate">{p.email}</p>
                  </div>

                  {/* Role select */}
                  <select
                    value={p.role}
                    onChange={e => updateRole(p.id, e.target.value)}
                    className="dash text-[11px] px-2.5 py-1 rounded-full font-bold border focus:outline-none cursor-pointer transition-all appearance-none text-center"
                    style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                  >
                    {Object.entries(ROLE_CFG).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {/* Add user trigger */}
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={() => { setShowCreate(v => !v); setError(null) }}
            className="dash flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreate ? 'Cancelar' : 'Adicionar usuário'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
          {/* Form header */}
          <div
            className="px-5 py-3.5 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #6B3019 0%, #A14F2A 100%)' }}
          >
            <div>
              <p className="dash text-sm font-bold text-white">Novo Usuário</p>
              <p className="dash text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Preencha os dados para criar a conta</p>
            </div>
            <button
              onClick={() => { setShowCreate(false); setError(null) }}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          <form onSubmit={createUser} className="px-5 py-4 space-y-3">
            <div>
              <label className="dash block text-xs font-semibold text-slate-600 mb-1.5">Nome</label>
              <input
                className={inpCls}
                placeholder="Nome completo"
                value={newUser.name}
                onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="dash block text-xs font-semibold text-slate-600 mb-1.5">E-mail</label>
              <input
                className={inpCls}
                type="email"
                placeholder="email@exemplo.com"
                value={newUser.email}
                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="dash block text-xs font-semibold text-slate-600 mb-1.5">Senha</label>
              <input
                className={inpCls}
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newUser.password}
                onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="dash block text-xs font-semibold text-slate-600 mb-1.5">Perfil</label>
              <select
                className={selCls}
                value={newUser.role}
                onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="analista">Analista</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>

            {error && (
              <p className="dash text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-100">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="dash w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #A14F2A 0%, #C97A52 100%)', boxShadow: '0 4px 14px rgba(161,79,42,0.28)' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'Criando...' : 'Criar usuário'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
