'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import type { Profile, UserRole } from '@/types/database'

type UserView = 'funcionarios' | 'clientes'
type EmployeeRole = Extract<UserRole, 'admin' | 'analista'>

const ROLE_CFG: Record<UserRole, { label: string; description: string; badge: string }> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Acesso total ao sistema',
    badge: 'border-primary/20 bg-primary/10 text-primary',
  },
  admin: {
    label: 'Administrador',
    description: 'Gerencia a operação e as configurações',
    badge: 'border-info/20 bg-info-bg text-info',
  },
  analista: {
    label: 'Analista',
    description: 'Atende clientes e conduz processos',
    badge: 'border-success/20 bg-success-bg text-success',
  },
  cliente: {
    label: 'Cliente',
    description: 'Acesso ao portal do cliente',
    badge: 'border-border bg-muted text-muted-foreground',
  },
}

const AVATAR_CLASSES = [
  'border-primary/20 bg-primary/10 text-primary',
  'border-success/20 bg-success-bg text-success',
  'border-info/20 bg-info-bg text-info',
  'border-warning/20 bg-warning-bg text-warning',
  'border-border bg-secondary text-secondary-foreground',
]

const EMPLOYEE_ROLE_OPTIONS: Array<{ value: EmployeeRole; label: string; description: string }> = [
  {
    value: 'analista',
    label: 'Analista',
    description: 'Atende clientes e conduz processos.',
  },
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Gerencia a operação e as configurações.',
  },
]

function avatarClass(name: string) {
  const index = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0)
  return AVATAR_CLASSES[index % AVATAR_CLASSES.length]
}

function userInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

async function readApiError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : fallback
}

interface UserManagerProps {
  profiles: Profile[]
  canManageEmployees: boolean
  currentProfileId: string
}

interface EditingEmployee {
  id: string
  name: string
  email: string
  password: string
  role: EmployeeRole
}

export function UserManager({ profiles, canManageEmployees, currentProfileId }: UserManagerProps) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<UserView>('funcionarios')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [roleOverrides, setRoleOverrides] = useState<Partial<Record<string, EmployeeRole>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<EditingEmployee | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'analista' as EmployeeRole,
  })

  const employees = profiles.filter(profile => profile.role !== 'cliente')
  const clients = profiles.filter(profile => profile.role === 'cliente')
  const visibleProfiles = activeView === 'funcionarios' ? employees : clients
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const filteredProfiles = normalizedSearch
    ? visibleProfiles.filter(profile =>
        `${profile.name} ${profile.email}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      )
    : visibleProfiles

  const setView = (view: UserView) => {
    setActiveView(view)
    setSearch('')
    setListError(null)
    if (view === 'clientes') {
      setShowCreate(false)
      setFormError(null)
    }
  }

  const updateRole = async (profile: Profile, role: EmployeeRole) => {
    const previousRole = (roleOverrides[profile.id] ?? profile.role) as EmployeeRole
    if (previousRole === role) return

    setRoleOverrides(current => ({ ...current, [profile.id]: role }))
    setUpdatingId(profile.id)
    setListError(null)

    try {
      const response = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, role }),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível alterar a função.'))
      }

      router.refresh()
    } catch (error) {
      setRoleOverrides(current => ({ ...current, [profile.id]: previousRole }))
      setListError(error instanceof Error ? error.message : 'Não foi possível alterar a função.')
    } finally {
      setUpdatingId(null)
    }
  }

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    setFormError(null)

    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível criar o funcionário.'))
      }

      setShowCreate(false)
      setNewUser({ email: '', name: '', password: '', role: 'analista' })
      router.refresh()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível criar o funcionário.')
    } finally {
      setCreating(false)
    }
  }

  const openEditor = (profile: Profile) => {
    if (profile.role !== 'admin' && profile.role !== 'analista') return

    setEditingUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      password: '',
      role: (roleOverrides[profile.id] ?? profile.role) as EmployeeRole,
    })
    setEditError(null)
    setConfirmDelete(false)
  }

  const closeEditor = () => {
    if (savingEdit || deleting) return
    setEditingUser(null)
    setEditError(null)
    setConfirmDelete(false)
  }

  const saveEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser || confirmDelete) return

    setSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível atualizar o funcionário.'))
      }

      setRoleOverrides(current => ({ ...current, [editingUser.id]: editingUser.role }))
      setEditingUser(null)
      setConfirmDelete(false)
      router.refresh()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Não foi possível atualizar o funcionário.')
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteEmployee = async () => {
    if (!editingUser) return

    setDeleting(true)
    setEditError(null)

    try {
      const response = await fetch('/api/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingUser.id }),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível excluir o funcionário.'))
      }

      setEditingUser(null)
      setConfirmDelete(false)
      router.refresh()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Não foi possível excluir o funcionário.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="usuarios-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 id="usuarios-title" className="dash text-base font-bold text-foreground">
              Usuários e acessos
            </h2>
            <p className="dash text-xs text-muted-foreground">
              {employees.length} funcionário{employees.length !== 1 ? 's' : ''} e {clients.length}{' '}
              cliente{clients.length !== 1 ? 's' : ''} com acesso
            </p>
          </div>
        </div>

        {canManageEmployees && activeView === 'funcionarios' && (
          <button
            type="button"
            onClick={() => {
              setShowCreate(current => !current)
              setFormError(null)
            }}
            className="dash inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            aria-expanded={showCreate}
          >
            {showCreate ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {showCreate ? 'Cancelar' : 'Novo funcionário'}
          </button>
        )}
      </div>

      <div className="eleva-surface overflow-hidden">
        <div className="border-b border-border p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Tipo de usuário">
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'funcionarios'}
                onClick={() => setView('funcionarios')}
                className={`dash flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  activeView === 'funcionarios'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                <span>Funcionários</span>
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] leading-none text-secondary-foreground">
                  {employees.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'clientes'}
                onClick={() => setView('clientes')}
                className={`dash flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  activeView === 'clientes'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                <span>Clientes</span>
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] leading-none text-secondary-foreground">
                  {clients.length}
                </span>
              </button>
            </div>

            <div className="relative w-full lg:max-w-xs">
              <label htmlFor="user-search" className="sr-only">Buscar usuário</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="user-search"
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={`Buscar ${activeView === 'funcionarios' ? 'funcionário' : 'cliente'}...`}
                className="dash block w-full rounded-xl border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <p className="dash mt-3 text-xs text-muted-foreground">
            {activeView === 'funcionarios'
              ? 'Equipe interna e nível de acesso de cada funcionário.'
              : 'Clientes que já possuem acesso à área do cliente.'}
          </p>
        </div>

        {showCreate && activeView === 'funcionarios' && canManageEmployees && (
          <form onSubmit={createUser} className="border-b border-border bg-muted/40 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="dash text-sm font-bold text-foreground">Cadastrar funcionário</h3>
                <p className="dash mt-0.5 text-xs text-muted-foreground">
                  A conta será criada pronta para acessar o sistema.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="employee-name" className="dash mb-1.5 block text-xs font-semibold text-foreground">Nome completo</label>
                <input
                  id="employee-name"
                  value={newUser.name}
                  onChange={event => setNewUser(current => ({ ...current, name: event.target.value }))}
                  className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Nome do funcionário"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label htmlFor="employee-email" className="dash mb-1.5 block text-xs font-semibold text-foreground">E-mail</label>
                <input
                  id="employee-email"
                  type="email"
                  value={newUser.email}
                  onChange={event => setNewUser(current => ({ ...current, email: event.target.value }))}
                  className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="nome@empresa.com.br"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label htmlFor="employee-password" className="dash mb-1.5 block text-xs font-semibold text-foreground">Senha provisória</label>
                <input
                  id="employee-password"
                  type="password"
                  value={newUser.password}
                  onChange={event => setNewUser(current => ({ ...current, password: event.target.value }))}
                  className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <fieldset>
                <legend className="dash mb-1.5 block text-xs font-semibold text-foreground">Função</legend>
                <div className="grid grid-cols-2 gap-2">
                  {EMPLOYEE_ROLE_OPTIONS.map(option => (
                    <label
                      key={option.value}
                      className={`relative cursor-pointer rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring ${
                        newUser.role === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-input bg-card hover:bg-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="employee-role"
                        value={option.value}
                        checked={newUser.role === option.value}
                        onChange={() => setNewUser(current => ({ ...current, role: option.value }))}
                        className="sr-only"
                      />
                      <span className="dash flex items-center gap-1.5 text-xs font-bold text-foreground">
                        {newUser.role === option.value && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                        {option.label}
                      </span>
                      <span className="dash mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {formError && (
              <p role="alert" className="dash mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="dash inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {creating ? 'Criando conta...' : 'Criar funcionário'}
              </button>
            </div>
          </form>
        )}

        {listError && (
          <p role="alert" className="dash m-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {listError}
          </p>
        )}

        {filteredProfiles.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
              {search ? (
                <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              ) : activeView === 'funcionarios' ? (
                <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <p className="dash text-sm font-semibold text-foreground">
              {search
                ? 'Nenhum resultado encontrado'
                : activeView === 'funcionarios'
                  ? 'Nenhum funcionário cadastrado'
                  : 'Nenhum cliente com acesso'}
            </p>
            <p className="dash mt-1 text-xs text-muted-foreground">
              {search
                ? 'Tente buscar por outro nome ou e-mail.'
                : activeView === 'clientes'
                  ? 'O acesso é liberado no cadastro de cada cliente.'
                  : 'Cadastre o primeiro funcionário para começar.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border" role="tabpanel">
            {filteredProfiles.map(profile => {
              const effectiveRole = roleOverrides[profile.id] ?? profile.role
              const roleConfig = ROLE_CFG[effectiveRole]
              const isEditableEmployee =
                canManageEmployees &&
                profile.id !== currentProfileId &&
                (profile.role === 'admin' || profile.role === 'analista')

              return (
                <div key={profile.id} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${avatarClass(profile.name)}`}>
                      {userInitial(profile.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="dash truncate text-sm font-semibold text-foreground">{profile.name}</p>
                        {profile.id === currentProfileId && (
                          <span className="dash rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-secondary-foreground">
                            Você
                          </span>
                        )}
                        {profile.is_active === false && (
                          <span className="dash rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="dash truncate text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:min-w-64 sm:justify-end sm:pl-0">
                    <p className="dash hidden text-right text-[10px] leading-tight text-muted-foreground md:block">
                      {roleConfig.description}
                    </p>
                    {isEditableEmployee ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="relative">
                          <select
                            value={effectiveRole}
                            onChange={event => updateRole(profile, event.target.value as EmployeeRole)}
                            disabled={updatingId !== null}
                            aria-label={`Função de ${profile.name}`}
                            className={`dash min-w-32 appearance-none rounded-full border py-1.5 pl-3 pr-8 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-wait disabled:opacity-60 ${roleConfig.badge}`}
                          >
                            <option value="admin">Administrador</option>
                            <option value="analista">Analista</option>
                          </select>
                          {updatingId === profile.id && (
                            <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin" aria-hidden="true" />
                          )}
                          {updatingId !== profile.id && (
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" aria-hidden="true" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditor(profile)}
                          disabled={updatingId !== null}
                          aria-label={`Editar ${profile.name}`}
                          title="Editar funcionário"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className={`dash shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${roleConfig.badge}`}>
                        {roleConfig.label}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5">
          <p className="dash text-[11px] text-muted-foreground">
            Exibindo {filteredProfiles.length} de {visibleProfiles.length}
          </p>
          {activeView === 'clientes' && (
            <p className="dash text-[11px] font-medium text-primary">Acessos do portal</p>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-employee-title"
            className="eleva-surface max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="dash text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Gestão de acesso</p>
                <h3 id="edit-employee-title" className="dash mt-0.5 text-lg font-bold text-foreground">
                  Editar funcionário
                </h3>
                <p className="dash mt-1 text-xs text-muted-foreground">
                  Atualize os dados usados para entrar no sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={savingEdit || deleting}
                aria-label="Fechar edição"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={saveEmployee} className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="edit-employee-name" className="dash mb-1.5 block text-xs font-semibold text-foreground">Nome completo</label>
                  <input
                    id="edit-employee-name"
                    value={editingUser.name}
                    onChange={event => setEditingUser(current => current ? { ...current, name: event.target.value } : current)}
                    className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-employee-email" className="dash mb-1.5 block text-xs font-semibold text-foreground">E-mail de acesso</label>
                  <input
                    id="edit-employee-email"
                    type="email"
                    value={editingUser.email}
                    onChange={event => setEditingUser(current => current ? { ...current, email: event.target.value } : current)}
                    className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    autoComplete="email"
                    required
                  />
                  <p className="dash mt-1 text-[10px] text-muted-foreground">Este também será o novo e-mail usado no login.</p>
                </div>

                <div>
                  <label htmlFor="edit-employee-password" className="dash mb-1.5 block text-xs font-semibold text-foreground">Nova senha</label>
                  <input
                    id="edit-employee-password"
                    type="password"
                    value={editingUser.password}
                    onChange={event => setEditingUser(current => current ? { ...current, password: event.target.value } : current)}
                    className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Mínimo de 6 caracteres"
                    autoComplete="new-password"
                    minLength={6}
                  />
                  <p className="dash mt-1 text-[10px] text-muted-foreground">Deixe em branco para manter a senha atual.</p>
                </div>

                <div>
                  <label htmlFor="edit-employee-role" className="dash mb-1.5 block text-xs font-semibold text-foreground">Função</label>
                  <div className="relative">
                    <select
                      id="edit-employee-role"
                      value={editingUser.role}
                      onChange={event => setEditingUser(current => current ? { ...current, role: event.target.value as EmployeeRole } : current)}
                      className="dash block w-full appearance-none rounded-xl border border-input bg-card px-3.5 py-2.5 pr-9 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="analista">Analista</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="dash mt-1 text-[10px] text-muted-foreground">Define as áreas que o funcionário poderá acessar.</p>
                </div>
              </div>

              {editError && (
                <p role="alert" className="dash mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {editError}
                </p>
              )}

              {confirmDelete && (
                <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                    <div>
                      <p className="dash text-xs font-bold text-destructive">Excluir este funcionário definitivamente?</p>
                      <p className="dash mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        O acesso será removido imediatamente. Processos e eventos existentes continuarão no histórico e ficarão sem responsável quando necessário.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="dash rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      Manter funcionário
                    </button>
                    <button
                      type="button"
                      onClick={deleteEmployee}
                      disabled={deleting}
                      className="dash inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={savingEdit || deleting || confirmDelete}
                  className="dash inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Excluir funcionário
                </button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={savingEdit || deleting}
                    className="dash rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || deleting || confirmDelete}
                    className="dash inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                    {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
