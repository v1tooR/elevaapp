'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, X, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { LeadEligibilityFields } from '@/components/leads/lead-eligibility-fields'
import {
  leadEligibilityFromRecord,
  leadEligibilityPayload,
} from '@/lib/lead-eligibility'
import { LEAD_STATUS_META } from '@/lib/lead-funnel'
import type { Lead, LeadSource, LeadStatus } from '@/types/database'

const SOURCE_OPTIONS: { value: LeadSource | ''; label: string }[] = [
  { value: '',          label: 'Não informado' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google',    label: 'Google' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'vendedor',  label: 'Vendedor' },
  { value: 'outros',    label: 'Outros' },
]

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'novo', label: LEAD_STATUS_META.novo.label },
  { value: 'frio', label: LEAD_STATUS_META.frio.label },
  { value: 'quente', label: LEAD_STATUS_META.quente.label },
  { value: 'perdido', label: LEAD_STATUS_META.perdido.label },
]

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

  const [profile, setProfile] = useState(() => leadEligibilityFromRecord(lead))

  const openEditor = () => {
    setForm({
      name: lead.name ?? '',
      phone: lead.phone ?? '',
      lead_source: (lead.lead_source ?? '') as LeadSource | '',
      assigned_to: lead.assigned_to ?? '',
      status: lead.status,
      notes: lead.notes ?? '',
    })
    setProfile(leadEligibilityFromRecord(lead))
    setError('')
    setOpen(true)
  }

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

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
      ...leadEligibilityPayload(profile),
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
        onClick={openEditor}
        className="inline-flex items-center gap-2 border border-white/20 bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/20 transition-all dash"
      >
        <Edit className="w-3.5 h-3.5" />
        Editar
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

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
                    <select
                      value={form.status}
                      onChange={e => update('status', e.target.value)}
                      className={sel}
                      disabled={lead.status === 'convertido'}
                    >
                      {lead.status === 'convertido' && <option value="convertido">Convertido</option>}
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {lead.status !== 'convertido' && (
                      <>
                        <p className="mt-1 text-[11px] text-slate-500 dash">
                          {LEAD_STATUS_META[form.status].description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400 dash">
                          Para converter, use o botão “Converter em Cliente” ou arraste o card no kanban.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider dash">Perfil de Deficiência</p>
                  <LeadEligibilityFields value={profile} onChange={setProfile} compact />
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
