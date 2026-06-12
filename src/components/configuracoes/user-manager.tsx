'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  analista: 'Analista',
  cliente: 'Cliente',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  analista: 'bg-green-100 text-green-800',
  cliente: 'bg-gray-100 text-gray-600',
}

export function UserManager({ profiles }: { profiles: any[] }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'analista' })

  const updateRole = async (id: string, role: string) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ role }).eq('id', id)
    router.refresh()
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: {
        data: { name: newUser.name, role: newUser.role }
      }
    })
    if (!error) {
      setShowCreate(false)
      setNewUser({ email: '', name: '', password: '', role: 'analista' })
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <Card padding="none">
        <div className="divide-y divide-slate-100">
          {profiles.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-blue-700">{p.name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 truncate">{p.email}</p>
              </div>
              <select
                value={p.role}
                onChange={e => updateRole(p.id, e.target.value)}
                className={`text-xs px-2 py-1 rounded-full font-medium border-0 focus:outline-none cursor-pointer ${ROLE_COLORS[p.role] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Card>

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <Plus className="w-4 h-4" /> Criar novo usuário
        </button>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-800 text-sm">Novo Usuário</h3>
            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={createUser} className="space-y-3">
            <Input label="Nome" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} required />
            <Input label="E-mail" type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} required />
            <Input label="Senha" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Perfil</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="admin">Admin</option>
                <option value="analista">Analista</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
            <Button type="submit" loading={loading} size="sm">Criar</Button>
          </form>
        </Card>
      )}
    </div>
  )
}
