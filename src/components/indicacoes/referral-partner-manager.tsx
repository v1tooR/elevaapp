'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Edit2, Plus, Save, UserRoundCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MaskedInput } from '@/components/ui/masked-input'
import { Input } from '@/components/ui/input'
import { cn, formatPhone } from '@/lib/utils'
import {
  REFERRAL_PARTNER_TYPE_OPTIONS,
  REFERRAL_PARTNER_TYPE_LABELS,
} from '@/lib/referral-partners'
import type { ReferralPartner, ReferralPartnerType } from '@/types/database'

const EMPTY_FORM = {
  name: '',
  phone: '',
  partner_types: ['vendedor'] as ReferralPartnerType[],
}

export function ReferralPartnerManager({
  partners,
  canManage,
  currentProfileId,
}: {
  partners: ReferralPartner[]
  canManage: boolean
  currentProfileId: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState(partners)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!canManage) return null

  const toggleType = (type: ReferralPartnerType) => {
    setForm(current => ({
      ...current,
      partner_types: current.partner_types.includes(type)
        ? current.partner_types.filter(item => item !== type)
        : [...current.partner_types, type],
    }))
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setOpen(false)
    setError('')
  }

  const startEdit = (partner: ReferralPartner) => {
    setForm({
      name: partner.name,
      phone: partner.phone,
      partner_types: [...partner.partner_types],
    })
    setEditingId(partner.id)
    setOpen(true)
    setError('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Informe nome e telefone.')
      return
    }
    if (form.partner_types.length === 0) {
      setError('Selecione vendedor, indicador ou ambos.')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      partner_types: [...new Set(form.partner_types)],
    }

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from('referral_partners')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()

      if (updateError || !data) {
        setError(updateError?.message ?? 'Não foi possível atualizar o parceiro.')
        setLoading(false)
        return
      }
      setRows(current => current.map(row => (
        row.id === editingId ? data as ReferralPartner : row
      )))
    } else {
      const { data, error: insertError } = await supabase
        .from('referral_partners')
        .insert({ ...payload, created_by: currentProfileId })
        .select()
        .single()

      if (insertError || !data) {
        setError(insertError?.message ?? 'Não foi possível cadastrar o parceiro.')
        setLoading(false)
        return
      }
      setRows(current => [...current, data as ReferralPartner].sort((a, b) => (
        a.name.localeCompare(b.name, 'pt-BR')
      )))
    }

    setLoading(false)
    reset()
    router.refresh()
  }

  const toggleActive = async (partner: ReferralPartner) => {
    const supabase = createClient()
    const nextActive = !partner.is_active
    const { error: updateError } = await supabase
      .from('referral_partners')
      .update({ is_active: nextActive })
      .eq('id', partner.id)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setRows(current => current.map(row => (
      row.id === partner.id ? { ...row, is_active: nextActive } : row
    )))
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="dash font-bold text-foreground">Cadastro de parceiros</h2>
          <p className="dash mt-0.5 text-xs text-muted-foreground">
            Cadastro único para vendedores, indicadores ou pessoas que exercem as duas funções.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(current => !current)
            setEditingId(null)
            setForm(EMPTY_FORM)
            setError('')
          }}
          className="dash inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
        >
          {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {open ? 'Fechar' : 'Novo parceiro'}
        </button>
      </div>

      {open && (
        <form onSubmit={save} className="space-y-4 border-b border-border bg-muted/30 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nome *"
              value={form.name}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              required
            />
            <MaskedInput
              mask="phone"
              label="Telefone *"
              value={form.phone}
              onChange={phone => setForm(current => ({ ...current, phone }))}
              placeholder="(00) 00000-0000"
              required
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="dash text-sm font-medium text-foreground">Atuação *</legend>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_PARTNER_TYPE_OPTIONS.map(option => {
                const selected = form.partner_types.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'dash inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
                      selected
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleType(option.value)}
                      className="accent-primary"
                    />
                    {option.label}
                  </label>
                )
              })}
            </div>
          </fieldset>
          {error && <p className="dash text-xs font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="dash inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {loading ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="dash rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && !open && (
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="dash text-xs font-medium">{error}</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {rows.map(partner => (
          <div key={partner.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <UserRoundCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="dash truncate text-sm font-semibold text-foreground">{partner.name}</p>
              <p className="dash text-xs text-muted-foreground">{formatPhone(partner.phone)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {partner.partner_types.map(type => (
                <span key={type} className="dash rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  {REFERRAL_PARTNER_TYPE_LABELS[type]}
                </span>
              ))}
            </div>
            <span className={cn(
              'dash rounded-full px-2 py-1 text-[10px] font-semibold',
              partner.is_active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500',
            )}>
              {partner.is_active ? 'Ativo' : 'Inativo'}
            </span>
            <button
              type="button"
              onClick={() => startEdit(partner)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Editar ${partner.name}`}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleActive(partner)}
              className="dash rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
            >
              {partner.is_active ? 'Desativar' : 'Reativar'}
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="flex items-center gap-3 px-5 py-6 text-muted-foreground">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <UserRoundCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="dash text-sm font-semibold text-foreground">Nenhum parceiro cadastrado</p>
              <p className="dash mt-0.5 text-xs">
                Use “Novo parceiro” para cadastrar o primeiro vendedor ou indicador.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
