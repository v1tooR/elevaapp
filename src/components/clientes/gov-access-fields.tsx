'use client'

import { ExternalLink, ShieldCheck, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { GovAccessFormValue } from '@/lib/gov-access'

interface Props {
  value: GovAccessFormValue
  onChange: (value: GovAccessFormValue) => void
  compact?: boolean
}

const STATUS_OPTIONS = [
  { value: 'nao_validado', label: 'Não validado' },
  { value: 'aguardando_cliente', label: 'Aguardando o cliente' },
  { value: 'validado', label: 'Acesso validado' },
  { value: 'com_pendencia', label: 'Acesso com pendência' },
]

const LEVEL_OPTIONS = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'prata', label: 'Prata' },
  { value: 'ouro', label: 'Ouro' },
]

const SUFFICIENCY_OPTIONS = [
  { value: 'nao_avaliado', label: 'Ainda não avaliado' },
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
]

export function GovAccessFields({ value, onChange, compact = false }: Props) {
  const update = <K extends keyof GovAccessFormValue>(key: K, nextValue: GovAccessFormValue[K]) => {
    onChange({ ...value, [key]: nextValue })
  }

  const updateStatus = (status: GovAccessFormValue['status']) => {
    onChange({
      ...value,
      status,
      auth_by_client: status === 'validado' ? true : value.auth_by_client,
      last_validated_at: status === 'validado' && !value.last_validated_at
        ? new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
        : value.last_validated_at,
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="dash text-xs font-semibold text-blue-900">Acesso assistido, sem guardar senha</p>
            <p className="dash mt-1 text-[11px] leading-relaxed text-blue-700">
              O cliente informa a senha e o código de verificação somente durante o atendimento. Registre aqui apenas a situação do acesso.
            </p>
            <a
              href="https://www.gov.br/governodigital/pt-br/identidade/conta-gov-br/seguranca-da-conta"
              target="_blank"
              rel="noopener noreferrer"
              className="dash mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
            >
              Orientações oficiais de segurança <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <Select
          label="Situação do acesso Gov.br"
          value={value.status}
          onChange={event => updateStatus(event.target.value as GovAccessFormValue['status'])}
          options={STATUS_OPTIONS}
        />
        <Select
          label="Nível atual da conta"
          value={value.account_level}
          onChange={event => update('account_level', event.target.value as GovAccessFormValue['account_level'])}
          options={LEVEL_OPTIONS}
          placeholder="Não informado"
        />
        <Select
          label="Possui o nível necessário?"
          value={value.level_sufficiency}
          onChange={event => update('level_sufficiency', event.target.value as GovAccessFormValue['level_sufficiency'])}
          options={SUFFICIENCY_OPTIONS}
        />
        <Input
          label="Data da última validação"
          type="datetime-local"
          value={value.last_validated_at}
          onChange={event => update('last_validated_at', event.target.value)}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <input
          type="checkbox"
          checked={value.auth_by_client}
          onChange={event => update('auth_by_client', event.target.checked)}
          disabled={value.status === 'validado'}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
        <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <span>
          <span className="dash block text-xs font-semibold text-slate-800">Autenticação realizada pelo cliente</span>
          <span className="dash mt-0.5 block text-[11px] leading-relaxed text-slate-500">
            Confirma que a equipe não recebeu nem armazenou a senha ou o código de verificação.
          </span>
        </span>
      </label>

      <Textarea
        label="Pendência de acesso"
        value={value.pending_note}
        onChange={event => update('pending_note', event.target.value)}
        placeholder="Ex.: cliente precisa recuperar a conta ou elevar o nível. Nunca informe senha ou código."
        rows={compact ? 3 : 4}
        maxLength={500}
      />
    </div>
  )
}
