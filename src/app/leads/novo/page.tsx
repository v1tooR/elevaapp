'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { ArrowLeft, Target, User, Stethoscope, Tag, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canHaveCnhEspecial } from '@/lib/eligibility'
import type { DisabilityType, LeadSource } from '@/types/database'

const sectionCard = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
} as const

const DISABILITY_OPTIONS: { value: DisabilityType | ''; label: string }[] = [
  { value: '',         label: 'Não informado' },
  { value: 'fisica',   label: 'Física' },
  { value: 'auditiva', label: 'Auditiva' },
  { value: 'visual',   label: 'Visual' },
  { value: 'monocular',label: 'Monocular' },
  { value: 'autismo',  label: 'Autismo (TEA)' },
  { value: 'mental',   label: 'Mental / Intelectual' },
]

const SOURCE_OPTIONS: { value: LeadSource | ''; label: string }[] = [
  { value: '',          label: 'Não informado' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google',    label: 'Google' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'vendedor',  label: 'Vendedor' },
  { value: 'outros',    label: 'Outros' },
]

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        enabled ? 'bg-emerald-500' : 'bg-slate-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
        enabled ? 'translate-x-4' : 'translate-x-0'
      )} />
    </button>
  )
}

export default function NovoLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState({
    name: '',
    phone: '',
    lead_source: '' as LeadSource | '',
    assigned_to: '',
    notes: '',
  })

  const [profile, setProfile] = useState({
    is_driver: false,
    disability_type: '' as DisabilityType | '',
    has_cnh_especial: false,
    has_medical_report: false,
    report_valid: false,
  })

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, name')
      .in('role', ['super_admin', 'admin', 'analista'])
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [])

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const updateProfile = (key: string, value: boolean | string) =>
    setProfile(prev => {
      const next = { ...prev, [key]: value }
      // Se mudou disability ou is_driver, recalcula has_cnh_especial
      if (key === 'disability_type' || key === 'is_driver') {
        const disabilityVal = key === 'disability_type' ? (value as DisabilityType | '') : prev.disability_type
        const isDriver = key === 'is_driver' ? (value as boolean) : prev.is_driver
        if (!canHaveCnhEspecial(
          isDriver ? 'condutor' : 'nao_condutor',
          disabilityVal || undefined
        )) {
          next.has_cnh_especial = false
        }
      }
      // Se desmarcou laudo, remove validade
      if (key === 'has_medical_report' && !value) {
        next.report_valid = false
      }
      return next
    })

  const cnhAllowed = canHaveCnhEspecial(
    profile.is_driver ? 'condutor' : 'nao_condutor',
    profile.disability_type || undefined
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.from('leads').insert({
      name: form.name.trim(),
      phone: form.phone || null,
      lead_source: form.lead_source || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
      is_driver: profile.is_driver,
      disability_type: profile.disability_type || null,
      has_cnh_especial: profile.has_cnh_especial,
      cnh_status: profile.has_cnh_especial ? 'com_restricoes' : profile.is_driver ? null : 'nao_possui',
      has_medical_report: profile.has_medical_report,
      report_valid: profile.has_medical_report ? profile.report_valid : null,
      status: 'novo',
    })

    if (err) { setError('Erro ao cadastrar lead: ' + err.message); setLoading(false); return }
    router.push('/leads')
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
        .fsel:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); outline: none; }
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
            <Link href="/leads" className="inline-flex items-center gap-1.5 text-primary-foreground/75 hover:text-white text-xs font-medium mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar a Leads
            </Link>
            <h1 className="dash text-white text-2xl font-bold">Novo Lead</h1>
            <p className="dash text-primary-foreground/65 text-sm mt-1">Cadastre um novo potencial cliente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Dados do Lead ───────────────────────────────────────── */}
          <div className="anim anim-1 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Dados do Lead</h2>
                <p className="text-[11px] text-slate-400 dash">Informações de contato</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Nome completo *"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  required
                  placeholder="Nome do lead"
                />
              </div>
              <div className="sm:col-span-2">
                <MaskedInput mask="phone" label="Telefone" value={form.phone} onChange={v => update('phone', v)} placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>

          {/* ── Perfil de Deficiência ───────────────────────────────── */}
          <div className="anim anim-2 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Perfil de Deficiência</h2>
                <p className="text-[11px] text-slate-400 dash">Elegibilidade para isenções</p>
              </div>
            </div>
            <div className="space-y-4">
              {/* is_driver toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-slate-700 dash">É habilitado (motorista)?</p>
                  <p className="text-[11px] text-slate-400 dash">Possui ou deseja obter CNH</p>
                </div>
                <Toggle enabled={profile.is_driver} onToggle={() => updateProfile('is_driver', !profile.is_driver)} />
              </div>

              {/* disability_type */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700 dash">Tipo de deficiência</label>
                <select
                  value={profile.disability_type}
                  onChange={e => updateProfile('disability_type', e.target.value as DisabilityType | '')}
                  className="fsel block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                >
                  {DISABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {profile.disability_type && profile.is_driver && (
                  <p className="text-[11px] text-blue-600 dash">A aptidão e eventuais restrições serão definidas pela avaliação médico-pericial.</p>
                )}
              </div>

              {/* has_cnh_especial */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className={cn('text-sm font-medium dash', cnhAllowed ? 'text-slate-700' : 'text-slate-400')}>Já possui CNH com restrições?</p>
                  {!cnhAllowed && (
                    <p className="text-[11px] text-slate-400 dash">Informe o perfil condutor e a condição para registrar esta informação.</p>
                  )}
                </div>
                <Toggle
                  enabled={profile.has_cnh_especial}
                  onToggle={() => updateProfile('has_cnh_especial', !profile.has_cnh_especial)}
                  disabled={!cnhAllowed}
                />
              </div>

              {/* has_medical_report */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-slate-700 dash">Possui laudo médico?</p>
                </div>
                <Toggle enabled={profile.has_medical_report} onToggle={() => updateProfile('has_medical_report', !profile.has_medical_report)} />
              </div>

              {/* report_valid (conditional) */}
              {profile.has_medical_report && (
                <div className="flex items-center justify-between py-1 pl-4 border-l-2 border-purple-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dash">Laudo dentro da validade?</p>
                  </div>
                  <Toggle enabled={profile.report_valid} onToggle={() => updateProfile('report_valid', !profile.report_valid)} />
                </div>
              )}
            </div>
          </div>

          {/* ── Origem e Atribuição ─────────────────────────────────── */}
          <div className="anim anim-3 rounded-2xl p-6" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Origem e Atribuição</h2>
                <p className="text-[11px] text-slate-400 dash">Como chegou e quem está tratando</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700 dash">Origem</label>
                <select
                  value={form.lead_source}
                  onChange={e => update('lead_source', e.target.value)}
                  className="fsel block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                >
                  {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700 dash">Quem está tratando</label>
                <select
                  value={form.assigned_to}
                  onChange={e => update('assigned_to', e.target.value)}
                  className="fsel block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash"
                >
                  <option value="">Não atribuído</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Observações"
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  placeholder="Anotações sobre o lead..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* ── Target ─────────────────────────────────────────────── */}
          {error && (
            <div className="anim flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dash">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pb-2">
            <Button type="submit" loading={loading} size="md">
              <Target className="w-4 h-4" />
              Cadastrar Lead
            </Button>
            <Link href="/leads">
              <Button variant="outline" type="button" size="md">Cancelar</Button>
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
