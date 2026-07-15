'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { canHaveCnhEspecial, isNonDriverDisability } from '@/lib/eligibility'
import type { Lead, DisabilityType, LeadSource, LeadStatus } from '@/types/database'

const DISABILITY_OPTIONS: { value: DisabilityType | ''; label: string }[] = [
  { value: '',          label: 'Não informado' },
  { value: 'fisica',    label: 'Física' },
  { value: 'auditiva',  label: 'Auditiva' },
  { value: 'visual',    label: 'Visual' },
  { value: 'monocular', label: 'Monocular' },
  { value: 'autismo',   label: 'Autismo (TEA)' },
  { value: 'mental',    label: 'Mental / Intelectual' },
]

const SOURCE_OPTIONS: { value: LeadSource | ''; label: string }[] = [
  { value: '',          label: 'Não informado' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google',    label: 'Google' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'vendedor',  label: 'Vendedor' },
  { value: 'outros',    label: 'Outros' },
]

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'novo',           label: 'Novo' },
  { value: 'em_atendimento', label: 'Em atendimento' },
  { value: 'convertido',     label: 'Convertido' },
  { value: 'perdido',        label: 'Perdido' },
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

export function EditLeadModal({ lead, staff }: { lead: Lead; staff: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: lead.name ?? '',
    phone: lead.phone ?? '',
    lead_source: (lead.lead_source ?? '') as LeadSource | '',
    assigned_to: lead.assigned_to ?? '',
    status: lead.status,
    notes: lead.notes ?? '',
  })

  const [profile, setProfile] = useState({
    is_driver: lead.is_driver ?? false,
    disability_type: (lead.disability_type ?? '') as DisabilityType | '',
    has_cnh_especial: lead.has_cnh_especial ?? false,
    has_medical_report: lead.has_medical_report ?? false,
    report_valid: lead.report_valid ?? false,
  })

  // Reset form when lead changes
  useEffect(() => {
    setForm({
      name: lead.name ?? '',
      phone: lead.phone ?? '',
      lead_source: (lead.lead_source ?? '') as LeadSource | '',
      assigned_to: lead.assigned_to ?? '',
      status: lead.status,
      notes: lead.notes ?? '',
    })
    setProfile({
      is_driver: lead.is_driver ?? false,
      disability_type: (lead.disability_type ?? '') as DisabilityType | '',
      has_cnh_especial: lead.has_cnh_especial ?? false,
      has_medical_report: lead.has_medical_report ?? false,
      report_valid: lead.report_valid ?? false,
    })
  }, [lead])

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const updateProfile = (key: string, value: boolean | string) =>
    setProfile(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'disability_type' || key === 'is_driver') {
        const d = key === 'disability_type' ? (value as DisabilityType | '') : prev.disability_type
        const drv = key === 'is_driver' ? (value as boolean) : prev.is_driver
        if (!canHaveCnhEspecial(drv ? 'condutor' : 'nao_condutor', d || undefined)) {
          next.has_cnh_especial = false
        }
      }
      if (key === 'has_medical_report' && !value) next.report_valid = false
      return next
    })

  const cnhAllowed = canHaveCnhEspecial(
    profile.is_driver ? 'condutor' : 'nao_condutor',
    profile.disability_type || undefined
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('leads').update({
      name: form.name.trim(),
      phone: form.phone || null,
      lead_source: form.lead_source || null,
      assigned_to: form.assigned_to || null,
      status: form.status,
      notes: form.notes || null,
      is_driver: profile.is_driver,
      disability_type: profile.disability_type || null,
      has_cnh_especial: profile.has_cnh_especial,
      has_medical_report: profile.has_medical_report,
      report_valid: profile.has_medical_report ? profile.report_valid : null,
    }).eq('id', lead.id)

    if (err) { setError(err.message); setLoading(false); return }
    setOpen(false)
    router.refresh()
  }

  const sel = 'block w-full rounded-lg border border-border px-3 py-2 text-sm bg-card transition-all dash focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none'

  return (
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-panel { animation: modalIn 0.2s ease-out both; }
      `}</style>

      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-white/20 bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/20 transition-all dash"
      >
        <Edit className="w-3.5 h-3.5" />
        Editar
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B3019, #A14F2A)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div>
                <h2 className="dash text-white font-bold text-base">Editar Lead</h2>
                <p className="dash text-primary-foreground/70 text-xs mt-0.5">{lead.name}</p>
              </div>
              <button
                onClick={() => { setOpen(false); setError('') }}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* Status + básico */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Input label="Nome *" value={form.name} onChange={e => update('name', e.target.value)} required />
                  </div>
                  <MaskedInput mask="phone" label="Telefone" value={form.phone} onChange={v => update('phone', v)} placeholder="(00) 00000-0000" />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700 dash">Status</label>
                    <select value={form.status} onChange={e => update('status', e.target.value)} className={sel}>
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider dash">Perfil de Deficiência</p>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dash">É habilitado?</p>
                    <Toggle enabled={profile.is_driver} onToggle={() => updateProfile('is_driver', !profile.is_driver)} />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700 dash">Tipo de deficiência</label>
                    <select value={profile.disability_type} onChange={e => updateProfile('disability_type', e.target.value)} className={sel}>
                      {DISABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {profile.disability_type && isNonDriverDisability(profile.disability_type as DisabilityType) && (
                      <p className="text-[11px] text-amber-600 dash">Visual/mental não permite direção.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className={cn('text-sm font-medium dash', cnhAllowed ? 'text-slate-700' : 'text-slate-400')}>Já possui CNH Especial?</p>
                    <Toggle enabled={profile.has_cnh_especial} onToggle={() => updateProfile('has_cnh_especial', !profile.has_cnh_especial)} disabled={!cnhAllowed} />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dash">Possui laudo médico?</p>
                    <Toggle enabled={profile.has_medical_report} onToggle={() => updateProfile('has_medical_report', !profile.has_medical_report)} />
                  </div>

                  {profile.has_medical_report && (
                    <div className="flex items-center justify-between pl-4 border-l-2 border-purple-100">
                      <p className="text-sm font-medium text-slate-700 dash">Laudo válido?</p>
                      <Toggle enabled={profile.report_valid} onToggle={() => updateProfile('report_valid', !profile.report_valid)} />
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <p className="sm:col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider dash">Origem e Atribuição</p>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700 dash">Origem</label>
                    <select value={form.lead_source} onChange={e => update('lead_source', e.target.value)} className={sel}>
                      {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700 dash">Responsável</label>
                    <select value={form.assigned_to} onChange={e => update('assigned_to', e.target.value)} className={sel}>
                      <option value="">Não atribuído</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Observações"
                      value={form.notes}
                      onChange={e => update('notes', e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dash">{error}</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <Button type="submit" loading={loading}>Salvar alterações</Button>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setError('') }}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </>
  )
}
