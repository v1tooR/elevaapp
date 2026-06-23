'use client'
import { useState } from 'react'
import { KeyRound, UserCheck, UserX, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react'
import type { Client } from '@/types/database'

interface PortalAccessCardProps {
  client: Client
  hasAccess: boolean
  profileEmail?: string
  callerRole?: string
}

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'

export function PortalAccessCard({ client, hasAccess: initial, profileEmail, callerRole }: PortalAccessCardProps) {
  const [hasAccess, setHasAccess] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState(client.email ?? '')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState('')
  const [createdEmail, setCreatedEmail] = useState('')

  const generate = () => {
    setPassword(Array.from({ length: 12 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join(''))
    setShowPw(true)
  }

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/clientes/${client.id}/portal-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error ?? 'Erro ao criar acesso')
      return
    }
    setCreatedEmail(email)
    setHasAccess(true)
    setShowForm(false)
  }

  const handleRevoke = async () => {
    if (!confirm('Revogar o acesso ao portal deste cliente? Esta ação não pode ser desfeita.')) return
    setRevoking(true)
    const res = await fetch(`/api/clientes/${client.id}/portal-access`, { method: 'DELETE' })
    setRevoking(false)
    if (res.ok) {
      setHasAccess(false)
      setCreatedEmail('')
    }
  }

  const displayEmail = profileEmail ?? createdEmail

  return (
    <div
      className="bg-white rounded-2xl p-5"
      style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasAccess ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            <KeyRound className={`w-3.5 h-3.5 ${hasAccess ? 'text-emerald-500' : 'text-slate-400'}`} />
          </div>
          <h2 className="dash font-bold text-slate-900 text-sm">Acesso ao Portal</h2>
        </div>
        {hasAccess ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <UserCheck className="w-3 h-3" /> Com acesso
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
            <UserX className="w-3 h-3" /> Sem acesso
          </span>
        )}
      </div>

      {hasAccess ? (
        <div className="space-y-2">
          {displayEmail && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-400 dash">Login</p>
              <p className="text-sm font-medium text-slate-800 dash break-all">{displayEmail}</p>
            </div>
          )}
          {createdEmail && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-700 dash">Acesso criado com sucesso!</p>
              <p className="text-xs text-emerald-600 dash mt-0.5">Compartilhe o e-mail e a senha com o cliente.</p>
            </div>
          )}
          {callerRole === 'super_admin' && (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="w-full mt-1 py-1.5 text-xs text-red-500 border border-red-100 rounded-xl hover:bg-red-50 transition-colors dash flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              {revoking ? 'Revogando...' : 'Revogar acesso'}
            </button>
          )}
        </div>
      ) : (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors dash"
            >
              + Criar acesso ao portal
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dash mb-1">E-mail de acesso</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dash"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600 dash">Senha temporária</label>
                  <button
                    type="button"
                    onClick={generate}
                    className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 dash cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Gerar
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none dash"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 dash">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading || !email || !password}
                  className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors dash cursor-pointer"
                >
                  {loading ? 'Criando...' : 'Criar acesso'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError('') }}
                  className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors dash cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
