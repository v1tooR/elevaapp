'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown, ChevronUp, AlertCircle, Calendar,
  CheckCircle2, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  syncProcessMacroStatus,
  handlePericiaReprovada,
  handleEmissaoConcluida,
} from '@/lib/cnh-stages'
import { getSuggestedCnhRestriction } from '@/lib/eligibility'
import type { ProcessStage, StageStatus, DisabilityType } from '@/types/database'
import { formatDate } from '@/lib/utils'

interface Props {
  stages: ProcessStage[]
  processId: string
  clientId: string
  clientName: string
  responsibleUserId: string | null
  disability?: string
}

type EditState = {
  status: string
  scheduled_date: string
  attended: boolean
  result: string
  notes: string
  data: Record<string, unknown>
  createCalEvent: boolean
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; border: string; leftBorder: string }> = {
  pendente:      { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8', border: '#E2E8F0',  leftBorder: '#CBD5E1' },
  em_andamento:  { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', border: '#FDE68A',  leftBorder: '#F59E0B' },
  concluido:     { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0',  leftBorder: '#22C55E' },
  aprovado:      { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0',  leftBorder: '#22C55E' },
  reprovado:     { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444', border: '#FECACA',  leftBorder: '#EF4444' },
  nao_aplicavel: { bg: '#F8FAFC', text: '#94A3B8', dot: '#CBD5E1', border: '#E2E8F0',  leftBorder: '#E2E8F0' },
}

const STATUS_LABEL: Record<string, string> = {
  pendente:      'Pendente',
  em_andamento:  'Em andamento',
  concluido:     'Concluído',
  aprovado:      'Aprovado',
  reprovado:     'Reprovado',
  nao_aplicavel: 'N/A',
}

const STATUS_OPTIONS_BY_KEY: Record<string, string[]> = {
  checklist_documentos:   ['pendente', 'em_andamento', 'concluido'],
  agendamento_poupatempo: ['pendente', 'em_andamento', 'concluido'],
  pericia_medica:         ['pendente', 'em_andamento', 'aprovado', 'reprovado'],
  recurso_junta_medica:   ['pendente', 'em_andamento', 'aprovado', 'reprovado'],
  exame_pratico:          ['pendente', 'em_andamento', 'aprovado', 'reprovado'],
  emissao_cnh:            ['pendente', 'em_andamento', 'concluido'],
  liberado_isencoes:      ['pendente', 'concluido'],
}

const HAS_SCHEDULED_DATE = new Set([
  'agendamento_poupatempo', 'pericia_medica', 'recurso_junta_medica', 'exame_pratico',
])
const HAS_ATTENDED = new Set(['agendamento_poupatempo', 'pericia_medica', 'exame_pratico'])

const CHECKLIST_FIELDS = ['cnh', 'laudo_medico', 'senha_gov', 'comprovante_endereco', 'email'] as const
const CHECKLIST_LABELS: Record<string, string> = {
  cnh:                  'CNH atual',
  laudo_medico:         'Laudo Médico',
  senha_gov:            'Senha Gov.br',
  comprovante_endereco: 'Comprovante de Endereço',
  email:                'E-mail',
}

function initEdit(stage: ProcessStage, disability?: string): EditState {
  const data = { ...(stage.data as Record<string, unknown>) }
  if (stage.stage_key === 'emissao_cnh' && !data.restricoes && disability) {
    const suggested = getSuggestedCnhRestriction(disability as DisabilityType)
    if (suggested) data.restricoes = suggested
  }
  return {
    status:         stage.status,
    scheduled_date: stage.scheduled_date ?? '',
    attended:       stage.attended ?? false,
    result:         stage.result ?? '',
    notes:          stage.notes ?? '',
    data,
    createCalEvent: false,
  }
}

export function CnhStagesPanel({ stages, processId, clientId, clientName, responsibleUserId, disability }: Props) {
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [edits, setEdits] = useState<Record<string, EditState>>({})

  const getEdit = (stage: ProcessStage): EditState => edits[stage.id] ?? initEdit(stage, disability)

  const updateEdit = (stage: ProcessStage, key: keyof EditState, value: unknown) =>
    setEdits(prev => ({
      ...prev,
      [stage.id]: { ...(prev[stage.id] ?? initEdit(stage)), [key]: value },
    }))

  const updateData = (stage: ProcessStage, dataKey: string, value: unknown) =>
    setEdits(prev => {
      const cur = prev[stage.id] ?? initEdit(stage)
      return { ...prev, [stage.id]: { ...cur, data: { ...cur.data, [dataKey]: value } } }
    })

  const updateNestedData = (stage: ProcessStage, parentKey: string, childKey: string, value: unknown) =>
    setEdits(prev => {
      const cur = prev[stage.id] ?? initEdit(stage)
      const parentObj = (cur.data[parentKey] as Record<string, unknown>) ?? {}
      return {
        ...prev,
        [stage.id]: { ...cur, data: { ...cur.data, [parentKey]: { ...parentObj, [childKey]: value } } },
      }
    })

  const saveStage = async (stage: ProcessStage) => {
    const edit = getEdit(stage)
    setLoadingId(stage.id)
    setErrors(prev => ({ ...prev, [stage.id]: '' }))
    const supabase = createClient()

    const isTerminal = ['concluido', 'aprovado', 'reprovado'].includes(edit.status)
    const { error: updateErr } = await supabase
      .from('process_stages')
      .update({
        status:         edit.status,
        scheduled_date: edit.scheduled_date || null,
        attended:       edit.attended,
        result:         edit.result || null,
        notes:          edit.notes || null,
        data:           edit.data,
        ...(isTerminal && !stage.completed_at ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', stage.id)

    if (updateErr) {
      setErrors(prev => ({ ...prev, [stage.id]: updateErr.message }))
      setLoadingId(null)
      return
    }

    // Calendar event
    if (edit.createCalEvent && edit.scheduled_date) {
      await supabase.from('calendar_events').insert({
        title:               `${stage.label} — ${clientName}`,
        event_date:          edit.scheduled_date,
        event_type:          'normal',
        client_id:           clientId,
        process_id:          processId,
        responsible_user_id: responsibleUserId ?? null,
        visibility:          'admin_only',
        status:              'pending',
      })
    }

    // Sync process macro status
    await syncProcessMacroStatus(supabase, processId, stage.stage_key, edit.status as StageStatus)

    // Special handlers
    if (stage.stage_key === 'pericia_medica' && (edit.result === 'reprovado' || edit.status === 'reprovado')) {
      await handlePericiaReprovada(supabase, processId)
    }
    if (stage.stage_key === 'emissao_cnh' && edit.status === 'concluido') {
      await handleEmissaoConcluida(supabase, processId)
    }

    // History
    await supabase.from('process_history').insert({
      process_id:  processId,
      action_type: 'updated',
      new_value:   edit.status,
      note:        `Etapa "${stage.label}" → ${STATUS_LABEL[edit.status] ?? edit.status}`,
    })

    // Notify client on meaningful stage transitions (skip: handlePericiaReprovada / handleEmissaoConcluida já notificam)
    const statusChanged = stage.status !== (edit.status as StageStatus)
    const alreadyHandled =
      (stage.stage_key === 'pericia_medica' && edit.result === 'reprovado') ||
      (stage.stage_key === 'emissao_cnh' && edit.status === 'concluido')
    if (statusChanged && !alreadyHandled && ['em_andamento', 'aprovado', 'reprovado', 'concluido'].includes(edit.status)) {
      const { data: clientRecord } = await supabase
        .from('clients').select('profile_id').eq('id', clientId).single()
      if (clientRecord?.profile_id) {
        const msgMap: Record<string, string> = {
          em_andamento: `A etapa "${stage.label}" entrou em andamento no seu processo CNH Especial.`,
          aprovado:     `Boa notícia! A etapa "${stage.label}" foi aprovada.`,
          reprovado:    `A etapa "${stage.label}" não foi aprovada. Entraremos em contato em breve.`,
          concluido:    `A etapa "${stage.label}" foi concluída com sucesso.`,
        }
        await supabase.from('notifications').insert({
          user_id:    clientRecord.profile_id,
          client_id:  clientId,
          process_id: processId,
          title:      `CNH Especial — ${stage.label}`,
          message:    msgMap[edit.status] ?? `Etapa "${stage.label}" atualizada.`,
          type:       edit.status === 'reprovado' ? 'warning' : 'success',
        })
      }
    }

    setLoadingId(null)
    setActiveId(null)
    router.refresh()
  }

  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-2.5">
      {sorted.map((stage, idx) => {
        const edit = getEdit(stage)
        const st = STATUS_STYLE[stage.status] ?? STATUS_STYLE.pendente
        const isActive = activeId === stage.id
        const isLoading = loadingId === stage.id
        const err = errors[stage.id]
        const isLast = idx === sorted.length - 1

        return (
          <div key={stage.id} className="relative">
            {/* Timeline connector */}
            {!isLast && (
              <div
                className="absolute left-[19px] top-[42px] bottom-[-10px] w-0.5 z-0"
                style={{ background: '#E2E8F0' }}
              />
            )}

            <div
              className="relative z-10 bg-white rounded-xl overflow-hidden"
              style={{
                border:     '1px solid #E2E8F0',
                borderLeft: `3px solid ${st.leftBorder}`,
                boxShadow:  '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* Stage header (click to expand) */}
              <button
                type="button"
                onClick={() => setActiveId(isActive ? null : stage.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="dash text-sm font-semibold text-slate-900 leading-tight">{stage.label}</p>
                  {stage.scheduled_date && (
                    <p className="text-[11px] text-slate-400 dash mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(stage.scheduled_date)}
                      {stage.attended !== null && stage.attended !== undefined && (
                        <span className={cn('ml-1 font-medium', stage.attended ? 'text-emerald-600' : 'text-slate-400')}>
                          · {stage.attended ? 'compareceu' : 'não compareceu'}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <span
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold dash"
                  style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                  {STATUS_LABEL[stage.status]}
                </span>

                {isActive ? (
                  <ChevronUp className="w-4 h-4 text-slate-300 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </button>

              {/* Edit panel */}
              {isActive && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/30">

                  {/* Status selector */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600 dash">Status da etapa</p>
                    <div className="flex flex-wrap gap-2">
                      {(STATUS_OPTIONS_BY_KEY[stage.stage_key] ?? ['pendente', 'em_andamento', 'concluido']).map(s => {
                        const ss = STATUS_STYLE[s] ?? STATUS_STYLE.pendente
                        const isSel = edit.status === s
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateEdit(stage, 'status', s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all dash"
                            style={isSel
                              ? { background: ss.bg, color: ss.text, border: `1.5px solid ${ss.border}`, boxShadow: `0 0 0 2px ${ss.dot}30` }
                              : { background: '#fff', color: '#94A3B8', border: '1px solid #E2E8F0' }
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? ss.dot : '#CBD5E1' }} />
                            {STATUS_LABEL[s]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Scheduled date */}
                  {HAS_SCHEDULED_DATE.has(stage.stage_key) && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 dash">Data agendada</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="date"
                          value={edit.scheduled_date}
                          onChange={e => updateEdit(stage, 'scheduled_date', e.target.value)}
                          className="block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash"
                        />
                        {edit.scheduled_date && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edit.createCalEvent}
                              onChange={e => updateEdit(stage, 'createCalEvent', e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <span className="text-xs text-slate-600 dash">Criar evento no calendário</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Attended toggle */}
                  {HAS_ATTENDED.has(stage.stage_key) && (
                    <div className="flex items-center justify-between py-0.5">
                      <p className="text-xs font-semibold text-slate-600 dash">Compareceu?</p>
                      <button
                        type="button"
                        onClick={() => updateEdit(stage, 'attended', !edit.attended)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                          edit.attended ? 'bg-emerald-500' : 'bg-slate-200'
                        )}
                      >
                        <span className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
                          edit.attended ? 'translate-x-4' : 'translate-x-0'
                        )} />
                      </button>
                    </div>
                  )}

                  {/* ── Stage-specific fields ── */}

                  {/* checklist_documentos */}
                  {stage.stage_key === 'checklist_documentos' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 dash">Documentos recebidos</p>
                      <div className="space-y-1.5">
                        {CHECKLIST_FIELDS.map(field => {
                          const checked = !!(edit.data[field])
                          return (
                            <label
                              key={field}
                              className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-200 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => updateData(stage, field, e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 shrink-0"
                              />
                              <span className="text-sm text-slate-700 dash flex-1">{CHECKLIST_LABELS[field]}</span>
                              {checked && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Result: pericia, recurso, exame */}
                  {['pericia_medica', 'recurso_junta_medica', 'exame_pratico'].includes(stage.stage_key) && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 dash">Resultado</p>
                      <div className="flex gap-2">
                        {['aprovado', 'reprovado'].map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              const newResult = edit.result === r ? '' : r
                              setEdits(prev => {
                                const cur = prev[stage.id] ?? initEdit(stage)
                                return {
                                  ...prev,
                                  [stage.id]: {
                                    ...cur,
                                    result: newResult,
                                    status: newResult || cur.status,
                                  },
                                }
                              })
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all dash border"
                            style={edit.result === r
                              ? r === 'aprovado'
                                ? { background: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }
                                : { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }
                              : { background: '#fff', color: '#94A3B8', borderColor: '#E2E8F0' }
                            }
                          >
                            {r === 'aprovado'
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <XCircle className="w-3.5 h-3.5" />
                            }
                            {r === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* pericia_medica: observacoes */}
                  {stage.stage_key === 'pericia_medica' && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-600 dash">Observações da perícia</p>
                      <textarea
                        value={(edit.data.observacoes as string) ?? ''}
                        onChange={e => updateData(stage, 'observacoes', e.target.value)}
                        placeholder="Notas do médico perito..."
                        rows={2}
                        className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash resize-none"
                      />
                    </div>
                  )}

                  {/* recurso_junta_medica: SEI + protocolo */}
                  {stage.stage_key === 'recurso_junta_medica' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-600 dash">Cadastro SEI</p>
                        <input
                          type="text"
                          value={(edit.data.cadastro_sei as string) ?? ''}
                          onChange={e => updateData(stage, 'cadastro_sei', e.target.value)}
                          placeholder="Nº SEI"
                          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-600 dash">Protocolo</p>
                        <input
                          type="text"
                          value={(edit.data.protocolo as string) ?? ''}
                          onChange={e => updateData(stage, 'protocolo', e.target.value)}
                          placeholder="Nº protocolo"
                          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash"
                        />
                      </div>
                    </div>
                  )}

                  {/* exame_pratico: modalidade + checklist veículo próprio */}
                  {stage.stage_key === 'exame_pratico' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 dash">Modalidade</p>
                        <div className="flex gap-2">
                          {[
                            { value: 'autoescola',     label: 'Autoescola' },
                            { value: 'veiculo_proprio', label: 'Veículo Próprio' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateData(stage, 'modalidade', edit.data.modalidade === opt.value ? null : opt.value)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold dash border transition-all"
                              style={edit.data.modalidade === opt.value
                                ? { background: '#EFF6FF', color: '#2563EB', borderColor: '#93C5FD' }
                                : { background: '#fff', color: '#94A3B8', borderColor: '#E2E8F0' }
                              }
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {edit.data.modalidade === 'veiculo_proprio' && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600 dash">Checklist veículo próprio</p>
                          {Object.entries({
                            cadastro_sei:             'Cadastro SEI',
                            anexo_renach:             'Anexo RENACH',
                            anexo_cnh:                'Anexo CNH',
                            comprovante_pagamento_35: 'Comprovante Pag. R$35',
                            crlv:                     'CRLV do veículo',
                          }).map(([key, label]) => {
                            const checklist = (edit.data.checklist_veiculo_proprio as Record<string, boolean>) ?? {}
                            const checked = !!checklist[key]
                            return (
                              <label key={key} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-200 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => updateNestedData(stage, 'checklist_veiculo_proprio', key, e.target.checked)}
                                  className="w-4 h-4 rounded text-blue-600 shrink-0"
                                />
                                <span className="text-sm text-slate-700 dash">{label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* emissao_cnh: restricoes + vencimento */}
                  {stage.stage_key === 'emissao_cnh' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-600 dash">Restrições (código)</p>
                        <input
                          type="text"
                          value={(edit.data.restricoes as string) ?? ''}
                          onChange={e => updateData(stage, 'restricoes', e.target.value)}
                          placeholder="ex: B, X, C a L"
                          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-600 dash">Vencimento da CNH</p>
                        <input
                          type="date"
                          value={(edit.data.vencimento_cnh as string) ?? ''}
                          onChange={e => updateData(stage, 'vencimento_cnh', e.target.value)}
                          className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-600 dash">Observações internas</p>
                    <textarea
                      value={edit.notes}
                      onChange={e => updateEdit(stage, 'notes', e.target.value)}
                      placeholder="Notas sobre esta etapa..."
                      rows={2}
                      className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:outline-none dash resize-none"
                    />
                  </div>

                  {/* Contextual warnings */}
                  {stage.stage_key === 'pericia_medica' && (edit.result === 'reprovado' || edit.status === 'reprovado') && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dash">
                        Ao salvar, a etapa <strong>Recurso — Junta Médica</strong> será inserida automaticamente e um prazo de 30 dias será criado no calendário.
                      </p>
                    </div>
                  )}

                  {stage.stage_key === 'emissao_cnh' && edit.status === 'concluido' && (
                    <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800 dash">
                        Ao salvar, o processo será marcado como <strong>Concluído</strong> e o cliente receberá uma notificação sobre a CNH emitida.
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {err && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-700 dash">{err}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      loading={isLoading}
                      onClick={() => saveStage(stage)}
                    >
                      Salvar etapa
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setActiveId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
