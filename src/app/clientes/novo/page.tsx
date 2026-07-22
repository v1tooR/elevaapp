'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { ArrowLeft, User, MapPin, Lock, AlertCircle, KeyRound, Eye, EyeOff, RefreshCw, Stethoscope, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientEligibilityFields } from '@/components/clientes/client-eligibility-fields'
import { EMPTY_CLIENT_ELIGIBILITY, clientEligibilityPayload, type ClientEligibilityFormValue } from '@/lib/client-eligibility'
import { GovAccessFields } from '@/components/clientes/gov-access-fields'
import { EMPTY_GOV_ACCESS, govAccessPayload, type GovAccessFormValue } from '@/lib/gov-access'

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'

const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

const sectionCard = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
} as const

export default function NovoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', cpf: '', rg: '', birth_date: '', phone: '', email: '',
    address: '', city: '', state: '', internal_notes: ''
  })
  const [govAccess, setGovAccess] = useState<GovAccessFormValue>(EMPTY_GOV_ACCESS)
  const [criarAcesso, setCriarAcesso] = useState(false)
  const [portalEmail, setPortalEmail] = useState('')
  const [portalPassword, setPortalPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [eligi, setEligi] = useState<ClientEligibilityFormValue>(() => ({
    ...EMPTY_CLIENT_ELIGIBILITY,
    authorized_drivers: [],
  }))

  const generatePassword = () => {
    setPortalPassword(Array.from({ length: 12 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join(''))
    setShowPw(true)
  }

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase.from('clients').insert({
      name: form.name,
      cpf: form.cpf || null,
      rg: form.rg || null,
      birth_date: form.birth_date || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      internal_notes: form.internal_notes || null,
      ...govAccessPayload(govAccess),
      ...clientEligibilityPayload(eligi),
    }).select().single()

    if (err) {
      setError(err.code === '23505' ? 'Já existe um cliente cadastrado com este CPF.' : 'Erro ao cadastrar cliente: ' + err.message)
      setLoading(false)
      return
    }

    if (criarAcesso && portalEmail && portalPassword) {
      const res = await fetch(`/api/clientes/${data.id}/portal-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: portalEmail, password: portalPassword }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(`Cliente cadastrado, mas erro ao criar acesso: ${json.error ?? 'Erro desconhecido'}`)
        setLoading(false)
        router.push(`/clientes/${data.id}`)
        return
      }
    }

    router.push(`/clientes/${data.id}`)
  }

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
        .state-select:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); outline: none; }
      `}</style>

      <div className="max-w-2xl space-y-5">

        {/* ── Banner ─────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="relative p-6">
            <Link
              href="/clientes"
              className="inline-flex items-center gap-1.5 text-primary-foreground/75 hover:text-white text-xs font-medium mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar a Clientes
            </Link>
            <h1 className="dash text-white text-2xl font-bold">Novo Cliente</h1>
            <p className="dash text-primary-foreground/65 text-sm mt-1">Preencha os dados para cadastrar o cliente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Dados Pessoais ─────────────────────────────────────── */}
          <div className="anim anim-1 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Dados Pessoais</h2>
                <p className="text-[11px] text-slate-400 dash">Informações de identificação</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input label="Nome completo *" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="Nome do cliente" />
              </div>
              <MaskedInput mask="cpf" label="CPF" value={form.cpf} onChange={v => update('cpf', v)} placeholder="000.000.000-00" />
              <MaskedInput mask="rg" label="RG" value={form.rg} onChange={v => update('rg', v)} placeholder="00.000.000-0" />
              <Input label="Data de nascimento" type="date" value={form.birth_date} onChange={e => update('birth_date', e.target.value)} />
              <MaskedInput mask="phone" label="Telefone" value={form.phone} onChange={v => update('phone', v)} placeholder="(00) 00000-0000" />
              <div className="sm:col-span-2">
                <Input label="E-mail" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
          </div>

          {/* ── Endereço ───────────────────────────────────────────── */}
          <div className="anim anim-2 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Endereço</h2>
                <p className="text-[11px] text-slate-400 dash">Localização do cliente</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input label="Endereço" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Rua, número, bairro" />
              </div>
              <Input label="Cidade" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Cidade" />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700 dash">Estado</label>
                <select
                  value={form.state}
                  onChange={e => update('state', e.target.value)}
                  className="state-select block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                >
                  <option value="">Selecione o estado</option>
                  {BRAZIL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Informações Internas ────────────────────────────────── */}
          <div className="anim anim-3 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Informações Internas</h2>
                <p className="text-[11px] text-slate-400 dash">Visível apenas para a equipe</p>
              </div>
            </div>
            <div className="space-y-4">
              <Textarea
                label="Observações internas"
                value={form.internal_notes}
                onChange={e => update('internal_notes', e.target.value)}
                placeholder="Observações visíveis apenas para a equipe..."
                rows={3}
              />
            </div>
          </div>

          <div className="anim anim-4 rounded-2xl p-6" style={sectionCard}>
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h2 className="dash text-sm font-bold text-slate-900">Acesso assistido ao Gov.br</h2>
                <p className="dash text-[11px] text-slate-400">Controle operacional sem armazenar credenciais</p>
              </div>
            </div>
            <GovAccessFields value={govAccess} onChange={setGovAccess} />
          </div>

          {/* ── Elegibilidade ─────────────────────────────────────── */}
          <div className="anim anim-4 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Elegibilidade</h2>
                <p className="text-[11px] text-slate-400 dash">Perfil para isenções PCD</p>
              </div>
            </div>
            <ClientEligibilityFields value={eligi} onChange={setEligi} />
          </div>

          {/* ── Acesso ao Portal ───────────────────────────────────── */}
          <div className="anim anim-4 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Portal do cliente Eleva</h2>
                  <p className="text-[11px] text-slate-400 dash">Login exclusivo para o cliente acompanhar os processos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCriarAcesso(v => !v)
                  if (!criarAcesso && !portalEmail) setPortalEmail(form.email)
                }}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer',
                  criarAcesso ? 'bg-primary' : 'bg-slate-200'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
                  criarAcesso ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
            </div>

            {criarAcesso && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dash mb-1">E-mail de acesso</label>
                  <input
                    type="email"
                    value={portalEmail}
                    onChange={e => setPortalEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none dash transition-all"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700 dash">Senha temporária</label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 dash cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Gerar senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={portalPassword}
                      onChange={e => setPortalPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-border px-3 py-2 pr-10 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none dash transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {portalPassword && showPw && (
                    <p className="mt-1.5 text-[11px] text-amber-600 dash">Senha temporária exclusiva do Eleva. Nunca reutilize a senha Gov.br.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Error ──────────────────────────────────────────────── */}
          {error && (
            <div className="anim flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dash">{error}</p>
            </div>
          )}

          {/* ── Actions ────────────────────────────────────────────── */}
          <div className="flex gap-3 pb-2">
            <Button type="submit" loading={loading} size="md">
              Cadastrar Cliente
            </Button>
            <Link href="/clientes">
              <Button variant="outline" type="button" size="md">Cancelar</Button>
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
