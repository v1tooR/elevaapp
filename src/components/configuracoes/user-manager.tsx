'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
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
type AccessMethod = 'password' | 'invite'

const MIN_PASSWORD_LENGTH = 8
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'

function generatePassword() {
  const values = crypto.getRandomValues(new Uint32Array(14))
  return Array.from(values, value => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('')
}

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
  const [offboarding, setOffboarding] = useState({ replacementProfileId: '', reason: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'analista' as EmployeeRole,
    accessMethod: 'password' as AccessMethod,
    password: '',
    confirmPassword: '',
    mustChangePassword: true,
  })
  const [passwordReset, setPasswordReset] = useState({
    open: false,
    password: '',
    confirmPassword: '',
    mustChangePassword: true,
  })
  const [showResetPassword, setShowResetPassword] = useState(false)

  const employees = profiles.filter(profile => profile.role !== 'cliente')
  const activeEmployees = employees.filter(profile => profile.is_active)
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

  const resetCreateForm = () => {
    setNewUser({
      email: '',
      name: '',
      role: 'analista',
      accessMethod: 'password',
      password: '',
      confirmPassword: '',
      mustChangePassword: true,
    })
    setShowPassword(false)
    setCopied(false)
  }

  const fillGeneratedPassword = () => {
    const password = generatePassword()
    setNewUser(current => ({ ...current, password, confirmPassword: password }))
    setShowPassword(true)
    setCopied(false)
  }

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFormError('Não foi possível copiar. Selecione e copie a senha manualmente.')
    }
  }

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const definesPassword = newUser.accessMethod === 'password'
    if (definesPassword) {
      if (newUser.password.length < MIN_PASSWORD_LENGTH) {
        setFormError(`A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`)
        return
      }
      if (newUser.password !== newUser.confirmPassword) {
        setFormError('As senhas não coincidem.')
        return
      }
    }

    setCreating(true)

    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          accessMethod: newUser.accessMethod,
          ...(definesPassword
            ? { password: newUser.password, mustChangePassword: newUser.mustChangePassword }
            : {}),
        }),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível criar o funcionário.'))
      }

      setShowCreate(false)
      resetCreateForm()
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
      role: (roleOverrides[profile.id] ?? profile.role) as EmployeeRole,
    })
    setOffboarding({ replacementProfileId: '', reason: '' })
    setEditError(null)
    setConfirmDelete(false)
    setPasswordReset({ open: false, password: '', confirmPassword: '', mustChangePassword: true })
    setShowResetPassword(false)
  }

  const closeEditor = () => {
    if (savingEdit || deleting) return
    setEditingUser(null)
    setEditError(null)
    setConfirmDelete(false)
    setPasswordReset({ open: false, password: '', confirmPassword: '', mustChangePassword: true })
    setShowResetPassword(false)
  }

  useEffect(() => {
    if (!editingUser) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || savingEdit || deleting) return
      setEditingUser(null)
      setEditError(null)
      setConfirmDelete(false)
      setPasswordReset({ open: false, password: '', confirmPassword: '', mustChangePassword: true })
      setShowResetPassword(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editingUser, savingEdit, deleting])

  const saveEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser || confirmDelete) return

    setEditError(null)

    if (passwordReset.open) {
      if (passwordReset.password.length < MIN_PASSWORD_LENGTH) {
        setEditError(`A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`)
        return
      }
      if (passwordReset.password !== passwordReset.confirmPassword) {
        setEditError('As senhas não coincidem.')
        return
      }
    }

    setSavingEdit(true)

    try {
      const response = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingUser,
          ...(passwordReset.open
            ? { password: passwordReset.password, mustChangePassword: passwordReset.mustChangePassword }
            : {}),
        }),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível atualizar o funcionário.'))
      }

      setRoleOverrides(current => ({ ...current, [editingUser.id]: editingUser.role }))
      setEditingUser(null)
      setConfirmDelete(false)
      setPasswordReset({ open: false, password: '', confirmPassword: '', mustChangePassword: true })
      setShowResetPassword(false)
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
        body: JSON.stringify({
          id: editingUser.id,
          replacementProfileId: offboarding.replacementProfileId,
          reason: offboarding.reason,
        }),
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
              {activeEmployees.length} funcionário{activeEmployees.length !== 1 ? 's' : ''} ativo{activeEmployees.length !== 1 ? 's' : ''} e {clients.length}{' '}
              cliente{clients.length !== 1 ? 's' : ''} com acesso
            </p>
          </div>
        </div>

        {canManageEmployees && activeView === 'funcionarios' && (
          <button
            type="button"
            onClick={() => {
              setShowCreate(current => {
                if (current) resetCreateForm()
                return !current
              })
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
                  {activeEmployees.length}
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
                  {newUser.accessMethod === 'password'
                    ? 'Defina e entregue a senha ao funcionário. O e-mail já será confirmado, sem link de ativação.'
                    : 'Um convite será enviado por e-mail. No primeiro acesso, o funcionário definirá a senha e ativará o MFA.'}
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
              <fieldset className="md:col-span-2">
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

              <fieldset className="md:col-span-2">
                <legend className="dash mb-1.5 block text-xs font-semibold text-foreground">Forma de acesso</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    {
                      value: 'password' as AccessMethod,
                      icon: KeyRound,
                      label: 'Definir senha agora',
                      description: 'Acesso imediato, sem confirmação por e-mail.',
                    },
                    {
                      value: 'invite' as AccessMethod,
                      icon: Mail,
                      label: 'Enviar convite por e-mail',
                      description: 'Depende da entrega do e-mail para o primeiro acesso.',
                    },
                  ]).map(option => (
                    <label
                      key={option.value}
                      className={`relative cursor-pointer rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring ${
                        newUser.accessMethod === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-input bg-card hover:bg-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="employee-access-method"
                        value={option.value}
                        checked={newUser.accessMethod === option.value}
                        onChange={() => {
                          setNewUser(current => ({ ...current, accessMethod: option.value }))
                          setFormError(null)
                        }}
                        className="sr-only"
                      />
                      <span className="dash flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <option.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        {option.label}
                      </span>
                      <span className="dash mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {newUser.accessMethod === 'password' && (
                <div className="md:col-span-2 grid gap-3 rounded-xl border border-input bg-card p-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center justify-between gap-3">
                    <p className="dash text-xs font-semibold text-foreground">Senha de acesso</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={fillGeneratedPassword}
                        className="dash inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        Gerar senha
                      </button>
                      {newUser.password && (
                        <button
                          type="button"
                          onClick={() => copyPassword(newUser.password)}
                          className="dash inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          {copied ? <Check className="h-3 w-3 text-success" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                          {copied ? 'Copiado' : 'Copiar'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="employee-password" className="dash mb-1.5 block text-xs font-semibold text-foreground">Senha</label>
                    <div className="relative">
                      <input
                        id="employee-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newUser.password}
                        onChange={event => setNewUser(current => ({ ...current, password: event.target.value }))}
                        className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                        autoComplete="new-password"
                        minLength={MIN_PASSWORD_LENGTH}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(current => !current)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="employee-password-confirm" className="dash mb-1.5 block text-xs font-semibold text-foreground">Confirmar senha</label>
                    <input
                      id="employee-password-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.confirmPassword}
                      onChange={event => setNewUser(current => ({ ...current, confirmPassword: event.target.value }))}
                      className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                    />
                  </div>

                  <label className="dash sm:col-span-2 flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={newUser.mustChangePassword}
                      onChange={event => setNewUser(current => ({ ...current, mustChangePassword: event.target.checked }))}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input accent-primary"
                    />
                    <span>
                      <span className="font-semibold text-foreground">Exigir troca de senha no primeiro acesso.</span>{' '}
                      Recomendado — o funcionário define uma senha que só ele conhece ao entrar.
                    </span>
                  </label>
                </div>
              )}
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
                {newUser.accessMethod === 'password'
                  ? creating ? 'Criando acesso...' : 'Criar acesso'
                  : creating ? 'Enviando convite...' : 'Enviar convite'}
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
                profile.is_active &&
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

      {editingUser && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeEditor()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-employee-title"
            className="eleva-surface flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-b-none shadow-2xl sm:max-h-[min(90dvh,44rem)] sm:rounded-b-[var(--radius-xl)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
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

            <form onSubmit={saveEmployee} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
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

                  <div className="sm:col-span-2">
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

                  <div className="sm:col-span-2 rounded-xl border border-input bg-muted/30 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="dash flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Senha de acesso
                        </p>
                        <p className="dash mt-0.5 text-[10px] leading-snug text-muted-foreground">
                          Use quando o funcionário não recebeu o convite ou perdeu o acesso.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordReset(current => ({
                            open: !current.open,
                            password: '',
                            confirmPassword: '',
                            mustChangePassword: true,
                          }))
                          setShowResetPassword(false)
                          setEditError(null)
                        }}
                        disabled={savingEdit || deleting}
                        className="dash shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        {passwordReset.open ? 'Cancelar' : 'Redefinir senha'}
                      </button>
                    </div>

                    {passwordReset.open && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const password = generatePassword()
                              setPasswordReset(current => ({ ...current, password, confirmPassword: password }))
                              setShowResetPassword(true)
                            }}
                            className="dash inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            Gerar senha
                          </button>
                        </div>

                        <div>
                          <label htmlFor="reset-employee-password" className="dash mb-1.5 block text-xs font-semibold text-foreground">Nova senha</label>
                          <div className="relative">
                            <input
                              id="reset-employee-password"
                              type={showResetPassword ? 'text' : 'password'}
                              value={passwordReset.password}
                              onChange={event => setPasswordReset(current => ({ ...current, password: event.target.value }))}
                              className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                              autoComplete="new-password"
                              minLength={MIN_PASSWORD_LENGTH}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowResetPassword(current => !current)}
                              aria-label={showResetPassword ? 'Ocultar senha' : 'Mostrar senha'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {showResetPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="reset-employee-password-confirm" className="dash mb-1.5 block text-xs font-semibold text-foreground">Confirmar senha</label>
                          <input
                            id="reset-employee-password-confirm"
                            type={showResetPassword ? 'text' : 'password'}
                            value={passwordReset.confirmPassword}
                            onChange={event => setPasswordReset(current => ({ ...current, confirmPassword: event.target.value }))}
                            className="dash block w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Repita a senha"
                            autoComplete="new-password"
                            minLength={MIN_PASSWORD_LENGTH}
                            required
                          />
                        </div>

                        <label className="dash sm:col-span-2 flex items-start gap-2 text-[11px] leading-snug text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={passwordReset.mustChangePassword}
                            onChange={event => setPasswordReset(current => ({ ...current, mustChangePassword: event.target.checked }))}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input accent-primary"
                          />
                          <span>
                            <span className="font-semibold text-foreground">Exigir troca de senha no próximo acesso.</span>{' '}
                            A senha definida aqui vale como provisória.
                          </span>
                        </label>
                      </div>
                    )}
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
                        <p className="dash text-xs font-bold text-destructive">Desligar este funcionário?</p>
                        <p className="dash mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          O acesso e as sessões serão revogados. A autoria permanecerá no histórico e os itens em aberto serão transferidos.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="dash text-xs font-semibold text-foreground">
                        Transferir operação para
                        <select
                          value={offboarding.replacementProfileId}
                          onChange={event => setOffboarding(current => ({ ...current, replacementProfileId: event.target.value }))}
                          className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3 py-2 text-xs"
                          required
                        >
                          <option value="">Selecione o responsável</option>
                          {activeEmployees.filter(item => item.id !== editingUser.id).map(item => (
                            <option key={item.id} value={item.id}>{item.name} — {ROLE_CFG[item.role].label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="dash text-xs font-semibold text-foreground">
                        Motivo do desligamento
                        <textarea
                          value={offboarding.reason}
                          onChange={event => setOffboarding(current => ({ ...current, reason: event.target.value }))}
                          className="mt-1.5 block min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-xs"
                          maxLength={500}
                          placeholder="Registro interno opcional"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting || !offboarding.replacementProfileId}
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
                        {deleting ? 'Desligando...' : 'Confirmar desligamento'}
                      </button>
                    </div>
                  </div>
                )}

              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={savingEdit || deleting || confirmDelete}
                  className="dash inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Desligar funcionário
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
        </div>,
        document.body,
      )}
    </section>
  )
}
