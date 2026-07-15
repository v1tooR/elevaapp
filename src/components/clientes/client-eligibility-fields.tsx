'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ClientEligibilityFormValue } from '@/lib/client-eligibility'
import type { AuthorizedDriver } from '@/types/database'

interface Props {
  value: ClientEligibilityFormValue
  onChange: (value: ClientEligibilityFormValue) => void
  compact?: boolean
}

const SELECT_CLASS = 'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all dash focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none'
const DISABILITY_CHOICES = [
  { value: 'fisica', label: 'Física' },
  { value: 'auditiva', label: 'Auditiva' },
  { value: 'visual', label: 'Visual' },
  { value: 'monocular', label: 'Monocular' },
  { value: 'autismo', label: 'Autismo (TEA)' },
  { value: 'mental', label: 'Mental / Intelectual' },
] as const

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer',
        enabled ? 'bg-emerald-500' : 'bg-slate-200',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
        enabled ? 'translate-x-4' : 'translate-x-0',
      )} />
    </button>
  )
}

function NullableBooleanSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (value: boolean | null) => void
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dash">{label}</label>
      <select
        value={value === null ? '' : String(value)}
        onChange={event => onChange(event.target.value === '' ? null : event.target.value === 'true')}
        className={SELECT_CLASS}
      >
        <option value="">Aguardando definição</option>
        <option value="true">Sim — determinado</option>
        <option value="false">Não — dispensado</option>
      </select>
    </div>
  )
}

export function ClientEligibilityFields({ value, onChange, compact = false }: Props) {
  const update = <K extends keyof ClientEligibilityFormValue>(key: K, next: ClientEligibilityFormValue[K]) => {
    onChange({ ...value, [key]: next })
  }

  const updateDriver = (index: number, patch: Partial<AuthorizedDriver>) => {
    const drivers = value.authorized_drivers.map((driver, driverIndex) =>
      driverIndex === index ? { ...driver, ...patch } : driver,
    )
    update('authorized_drivers', drivers)
  }

  const addDriver = () => update('authorized_drivers', [
    ...value.authorized_drivers,
    { name: '', cpf: '', cnh: '' },
  ])

  const removeDriver = (index: number) => {
    update('authorized_drivers', value.authorized_drivers.filter((_, driverIndex) => driverIndex !== index))
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-xs font-semibold text-blue-800">Triagem, não decisão automática</p>
        <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
          Aptidão, códigos de restrição e exame prático devem reproduzir o laudo, o RENACH ou a CNH. Não são inferidos pelo diagnóstico.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dash">Perfil do cliente</label>
          <select value={value.client_type} onChange={event => update('client_type', event.target.value as ClientEligibilityFormValue['client_type'])} className={SELECT_CLASS}>
            <option value="">Não informado</option>
            <option value="condutor">Condutor</option>
            <option value="nao_condutor">Não condutor</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dash">Tipo de deficiência ou condição</label>
          <select value={value.disability_type} onChange={event => update('disability_type', event.target.value as ClientEligibilityFormValue['disability_type'])} className={SELECT_CLASS}>
            <option value="">Não informado</option>
            {DISABILITY_CHOICES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dash">Grau funcional informado no laudo</label>
          <select value={value.disability_severity} onChange={event => update('disability_severity', event.target.value as ClientEligibilityFormValue['disability_severity'])} className={SELECT_CLASS}>
            <option value="">Não informado</option>
            <option value="leve">Leve</option>
            <option value="moderada">Moderada</option>
            <option value="grave">Grave</option>
            <option value="gravissima">Gravíssima</option>
            <option value="nao_informada">Laudo sem graduação</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dash">Situação da avaliação médico-pericial</label>
          <select value={value.medical_assessment_status} onChange={event => update('medical_assessment_status', event.target.value as ClientEligibilityFormValue['medical_assessment_status'])} className={SELECT_CLASS}>
            <option value="nao_realizada">Não realizada</option>
            <option value="agendada">Agendada</option>
            <option value="apto">Apto</option>
            <option value="apto_com_restricoes">Apto com restrições</option>
            <option value="inapto_temporario">Inapto temporariamente</option>
            <option value="inapto">Inapto</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-slate-700 dash">Condições associadas</p>
          <p className="text-[11px] text-slate-400">Marque outras condições quando houver mais de uma caracterização no caso.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DISABILITY_CHOICES.map(item => {
            const selected = value.disability_types.includes(item.value)
            return (
              <label key={item.value} className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                selected ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500',
              )}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => update(
                    'disability_types',
                    selected
                      ? value.disability_types.filter(type => type !== item.value)
                      : [...value.disability_types, item.value],
                  )}
                  className="h-3.5 w-3.5 rounded text-blue-600"
                />
                {item.label}
              </label>
            )
          })}
        </div>
      </div>

      <Textarea
        label="Caracterização funcional"
        value={value.disability_details}
        onChange={event => update('disability_details', event.target.value)}
        placeholder="Descreva o comprometimento funcional conforme o laudo, sem presumir adaptações."
        rows={compact ? 2 : 3}
      />

      {value.client_type === 'condutor' && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">CNH do beneficiário</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700 dash">Situação da CNH</label>
              <select value={value.cnh_status} onChange={event => update('cnh_status', event.target.value as ClientEligibilityFormValue['cnh_status'])} className={SELECT_CLASS}>
                <option value="">Não informada</option>
                <option value="nao_possui">Não possui</option>
                <option value="comum">CNH sem restrições PCD</option>
                <option value="com_restricoes">CNH com restrições</option>
                <option value="em_regularizacao">Em regularização</option>
                <option value="inapto_temporario">Inapto temporariamente</option>
                <option value="inapto">Inapto</option>
              </select>
            </div>
            <Input
              label="Códigos efetivamente registrados"
              value={value.cnh_restrictions}
              onChange={event => update('cnh_restrictions', event.target.value)}
              placeholder="Ex.: B, X, D"
              helperText="Separe por vírgulas e copie somente do documento oficial."
            />
            <NullableBooleanSelect label="Exame prático determinado?" value={value.requires_practical_exam} onChange={next => update('requires_practical_exam', next)} />
            <NullableBooleanSelect label="Veículo adaptado determinado?" value={value.requires_adapted_vehicle} onChange={next => update('requires_adapted_vehicle', next)} />
          </div>
        </div>
      )}

      {value.client_type === 'nao_condutor' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Condutores autorizados</p>
              <p className="mt-1 text-[11px] text-slate-500">A CNH pertence ao condutor autorizado, não ao beneficiário.</p>
            </div>
            <button type="button" onClick={addDriver} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          {value.authorized_drivers.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">Nenhum condutor autorizado cadastrado.</p>
          )}
          {value.authorized_drivers.map((driver, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_0.8fr_0.8fr_auto] gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <Input label="Nome" value={driver.name} onChange={event => updateDriver(index, { name: event.target.value })} />
              <Input label="CPF" value={driver.cpf} onChange={event => updateDriver(index, { cpf: event.target.value })} />
              <Input label="CNH" value={driver.cnh} onChange={event => updateDriver(index, { cnh: event.target.value })} />
              <button type="button" onClick={() => removeDriver(index)} aria-label="Remover condutor" className="mt-6 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {[
          { key: 'receives_loas_bpc' as const, label: 'Recebe LOAS/BPC' },
          { key: 'has_medical_report' as const, label: 'Possui laudo para análise' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-0.5">
            <p className="text-sm font-medium text-slate-700 dash">{item.label}</p>
            <Toggle enabled={value[item.key]} onToggle={() => update(item.key, !value[item.key])} />
          </div>
        ))}
        {value.has_medical_report && (
          <div className="pl-4 border-l-2 border-purple-100">
            <Input label="Validade do laudo" type="date" value={value.report_valid_until} onChange={event => update('report_valid_until', event.target.value)} />
          </div>
        )}
      </div>

      <Textarea
        label="Observações de elegibilidade"
        value={value.eligibility_notes}
        onChange={event => update('eligibility_notes', event.target.value)}
        placeholder="Pendências, origem da informação e pontos para conferência humana."
        rows={2}
      />
    </div>
  )
}
