'use client'

import { useState } from 'react'
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { GovAccessFormValue, GovCredentialMetadata } from '@/lib/gov-access'
import { formatDateTime } from '@/lib/utils'

interface Props {
  value: GovAccessFormValue
  onChange: (value: GovAccessFormValue) => void
  credentialPassword: string
  onCredentialPasswordChange: (password: string) => void
  credentialMetadata?: GovCredentialMetadata
  onDeleteCredential?: () => void
  deletingCredential?: boolean
  compact?: boolean
}

const STATUS_OPTIONS = [
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'validado', label: 'Acesso validado' },
  { value: 'nao_informou', label: 'Não informou' },
]

export function GovAccessFields({
  value,
  onChange,
  credentialPassword,
  onCredentialPasswordChange,
  credentialMetadata,
  onDeleteCredential,
  deletingCredential = false,
  compact = false,
}: Props) {
  const expiry = credentialMetadata?.purgeAfter ?? credentialMetadata?.hardExpiresAt
  // "Tem senha?" decide se o campo de gravação aparece. Começa em "Sim" quando
  // já existe credencial guardada, e em "Não" quando nunca houve nenhuma.
  const [hasPassword, setHasPassword] = useState(credentialMetadata?.exists === true)

  const chooseHasPassword = (value: boolean) => {
    setHasPassword(value)
    if (!value) onCredentialPasswordChange('')
  }

  return (
    <div className="space-y-4">
      <Select
        label="Situação do acesso Gov.br"
        value={value.status}
        onChange={event => onChange({
          ...value,
          status: event.target.value as GovAccessFormValue['status'],
        })}
        options={STATUS_OPTIONS}
      />

      <Textarea
        label="Observação de acesso"
        value={value.pending_note}
        onChange={event => onChange({ ...value, pending_note: event.target.value })}
        placeholder="Ex.: cliente precisa recuperar a conta. Nunca informe senha ou código de verificação aqui."
        rows={compact ? 3 : 4}
        maxLength={500}
      />

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="dash text-xs font-semibold text-blue-900">Credencial protegida e somente para gravação</p>
            <p className="dash mt-1 text-[11px] leading-relaxed text-blue-700">
              A senha é criptografada antes de chegar ao banco. O app não possui opção de visualizar ou copiar.
              Códigos de verificação continuam proibidos e nunca devem ser registrados.
            </p>
          </div>
        </div>
      </div>

      {credentialMetadata?.exists && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="dash text-xs font-semibold text-emerald-900">Senha protegida armazenada</p>
              <p className="dash mt-1 text-[11px] leading-relaxed text-emerald-700">
                {credentialMetadata.storedAt && `Gravada em ${formatDateTime(credentialMetadata.storedAt)}. `}
                {expiry && `Exclusão automática prevista para ${formatDateTime(expiry)}.`}
              </p>
            </div>
            {onDeleteCredential && (
              <button
                type="button"
                onClick={onDeleteCredential}
                disabled={deletingCredential}
                className="dash inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {deletingCredential ? 'Excluindo...' : 'Excluir agora'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="mb-3 flex items-start gap-2.5">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <div>
            <p className="dash text-xs font-semibold text-slate-800">Tem senha?</p>
            <p className="dash mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Marque “Não” quando o cliente ainda não tem ou não autorizou informar a senha do Gov.br.
            </p>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          {[
            { value: true, label: 'Sim' },
            { value: false, label: 'Não' },
          ].map(option => (
            <button
              key={option.label}
              type="button"
              aria-pressed={hasPassword === option.value}
              onClick={() => chooseHasPassword(option.value)}
              className={`dash rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
                hasPassword === option.value
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {hasPassword ? (
          <>
            <p className="dash mb-2 text-[11px] leading-relaxed text-slate-500">
              {credentialMetadata?.exists
                ? 'O campo sempre aparece vazio. Ao salvar, a senha anterior é substituída e o conteúdo sai da tela.'
                : 'O campo sempre aparece vazio e a senha não pode ser visualizada depois de salva.'}
            </p>
            <Input
              label={credentialMetadata?.exists ? 'Substituir a senha do Gov.br' : 'Senha do Gov.br'}
              type="password"
              name="gov-credential-write-only"
              value={credentialPassword}
              onChange={event => onCredentialPasswordChange(event.target.value)}
              onCopy={event => event.preventDefault()}
              onCut={event => event.preventDefault()}
              autoComplete="off"
              spellCheck={false}
              minLength={1}
              maxLength={256}
              placeholder="Digite ou cole apenas se houver autorização"
              helperText="Sem botão de visualizar ou copiar. Retenção: 7 dias após todos os processos terminarem, com limite máximo de 180 dias."
            />
          </>
        ) : (
          <p className="dash text-[11px] leading-relaxed text-slate-500">
            Nenhuma senha será gravada.
            {credentialMetadata?.exists ? ' A senha já armazenada continua guardada até ser excluída acima.' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
