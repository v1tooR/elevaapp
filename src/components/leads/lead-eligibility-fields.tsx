'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  LEAD_DISABILITY_OPTIONS,
  LEAD_SERVICE_OPTIONS,
  type LeadEligibilityFormValue,
} from '@/lib/lead-eligibility'
import type { ClientType, DisabilityType } from '@/types/database'

interface Props {
  value: LeadEligibilityFormValue
  onChange: (value: LeadEligibilityFormValue) => void
  compact?: boolean
}

function BinaryChoice({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="dash text-sm font-medium text-slate-700">{label}</p>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {[
          { value: true, label: 'Sim' },
          { value: false, label: 'Não' },
        ].map(option => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'dash rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
              value === option.value
                ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200'
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LeadEligibilityFields({ value, onChange, compact = false }: Props) {
  const update = <K extends keyof LeadEligibilityFormValue>(
    key: K,
    next: LeadEligibilityFormValue[K],
  ) => onChange({ ...value, [key]: next })

  const updateClientType = (clientType: ClientType) => {
    onChange({
      ...value,
      client_type: clientType,
      has_cnh_especial: clientType === 'condutor' ? value.has_cnh_especial : false,
      cnh_restrictions: clientType === 'condutor' ? value.cnh_restrictions : '',
      has_legal_representative: clientType === 'nao_condutor'
        ? value.has_legal_representative
        : false,
      legal_representative_name: clientType === 'nao_condutor'
        ? value.legal_representative_name
        : '',
    })
  }

  const toggleDisability = (disability: DisabilityType) => {
    update(
      'disability_types',
      value.disability_types.includes(disability)
        ? value.disability_types.filter(item => item !== disability)
        : [...value.disability_types, disability],
    )
  }

  const toggleService = (service: LeadEligibilityFormValue['intended_services'][number]) => {
    update(
      'intended_services',
      value.intended_services.includes(service)
        ? value.intended_services.filter(item => item !== service)
        : [...value.intended_services, service],
    )
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <fieldset className="space-y-2">
        <legend className="dash text-sm font-medium text-slate-700">Condições associadas</legend>
        <p className="dash mt-0.5 text-[11px] text-slate-400">
          Marque outras condições quando houver mais de uma caracterização no caso.
        </p>
        <div className="flex flex-wrap gap-2">
          {LEAD_DISABILITY_OPTIONS.map(option => {
            const selected = value.disability_types.includes(option.value)
            return (
              <label
                key={option.value}
                className={cn(
                  'dash inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  selected
                    ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleDisability(option.value)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 accent-blue-600"
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-t border-slate-100 pt-4">
        <legend className="dash text-sm font-medium text-slate-700">Perfil do lead</legend>
        <p className="dash mt-0.5 text-[11px] text-slate-400">
          Selecione uma opção para abrir somente os campos correspondentes.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { value: 'condutor' as const, label: 'Condutor', helper: 'Possui ou deseja obter CNH' },
            { value: 'nao_condutor' as const, label: 'Não condutor', helper: 'Processo sem CNH do beneficiário' },
          ].map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value.client_type === option.value}
              onClick={() => updateClientType(option.value)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                value.client_type === option.value
                  ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <span className={cn(
                'dash block text-sm font-semibold',
                value.client_type === option.value ? 'text-primary' : 'text-slate-700',
              )}>
                {option.label}
              </span>
              <span className="dash mt-0.5 block text-[11px] text-slate-400">{option.helper}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {value.client_type === 'condutor' && (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <BinaryChoice
            label="Possui CNH especial?"
            value={value.has_cnh_especial}
            onChange={hasCnh => onChange({
              ...value,
              has_cnh_especial: hasCnh,
              cnh_restrictions: hasCnh ? value.cnh_restrictions : '',
            })}
          />
          {value.has_cnh_especial && (
            <Input
              label="Restrições da CNH"
              value={value.cnh_restrictions}
              onChange={event => update('cnh_restrictions', event.target.value)}
              placeholder="Ex.: B, D, X"
              helperText="Separe as restrições por vírgulas."
            />
          )}
        </div>
      )}

      {value.client_type === 'nao_condutor' && (
        <div className="space-y-4 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <BinaryChoice
            label="Possui representante legal?"
            value={value.has_legal_representative}
            onChange={hasRepresentative => onChange({
              ...value,
              has_legal_representative: hasRepresentative,
              legal_representative_name: hasRepresentative
                ? value.legal_representative_name
                : '',
            })}
          />
          {value.has_legal_representative && (
            <Input
              label="Nome do representante"
              value={value.legal_representative_name}
              onChange={event => update('legal_representative_name', event.target.value)}
              placeholder="Nome completo, se já estiver disponível"
              helperText="Opcional no lead. O CPF será informado no cadastro completo do cliente."
            />
          )}
        </div>
      )}

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <BinaryChoice
          label="Recebe LOAS/BPC?"
          value={value.receives_loas_bpc}
          onChange={next => update('receives_loas_bpc', next)}
        />
        <BinaryChoice
          label="Possui laudo médico válido para o processo?"
          value={value.has_medical_report}
          onChange={next => update('has_medical_report', next)}
        />
      </div>

      <fieldset className="space-y-2 border-t border-slate-100 pt-4">
        <legend className="dash text-sm font-medium text-slate-700">
          Contratos/serviços pretendidos
        </legend>
        <p className="dash mt-0.5 text-[11px] text-slate-400">
          Selecione um ou mais serviços. Quando houver CNH Especial, ela será a primeira da fila.
        </p>
        <div className="flex flex-wrap gap-2">
          {LEAD_SERVICE_OPTIONS.map(option => {
            const selected = value.intended_services.includes(option.value)
            return (
              <label
                key={option.value}
                className={cn(
                  'dash inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  selected
                    ? 'border-primary/50 bg-primary/5 text-primary shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleService(option.value)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary accent-primary"
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
