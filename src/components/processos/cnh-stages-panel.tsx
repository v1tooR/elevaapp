'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown, ChevronUp, AlertCircle, Calendar,
  CheckCircle2, XCircle, Clock, FileCheck, Car,
  Stethoscope, ClipboardList, BadgeCheck, Bell,
  CalendarCheck, CalendarPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  syncProcessMacroStatus,
  handlePericiaReprovada,
  handleEmissaoConcluida,
} from '@/lib/cnh-stages'
import type { ProcessStage, StageStatus } from '@/types/database'
import { formatDate } from '@/lib/utils'

interface Props {
  stages: ProcessStage[]
  processId: string
  clientId: string
  clientName: string
  responsibleUserId: string | null
}

type EditState = {
  status: string
  scheduled_date: string
  attended: boolean
  result: string
  notes: string
  data: Record<string, unknown>
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; border: string; leftBorder: string; ring: string }> = {
  pendente:      { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8', border: '#E2E8F0',  leftBorder: '#CBD5E1', ring: '#CBD5E1' },
  em_andamento:  { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B', border: '#FDE68A',  leftBorder: '#F59E0B', ring: '#F59E0B' },
  concluido:     { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0',  leftBorder: '#22C55E', ring: '#22C55E' },
  aprovado:      { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', border: '#BBF7D0',  leftBorder: '#22C55E', ring: '#22C55E' },
  reprovado:     { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444', border: '#FECACA',  leftBorder: '#EF4444', ring: '#EF4444' },
  nao_aplicavel: { bg: '#F8FAFC', text: '#94A3B8', dot: '#CBD5E1', border: '#E2E8F0',  leftBorder: '#E2E8F0', ring: '#E2E8F0' },
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
  exame_pratico:          ['pendente', 'em_andamento', 'aprovado', 'reprovado', 'nao_aplicavel'],
  emissao_cnh:            ['pendente', 'em_andamento', 'concluido'],
  liberado_isencoes:      ['pendente', 'concluido'],
  cnh_regularizada:       ['pendente', 'concluido'],
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

const STAGE_ICONS: Record<string, React.ElementType> = {
  checklist_documentos:   ClipboardList,
  agendamento_poupatempo: Calendar,
  pericia_medica:         Stethoscope,
  recurso_junta_medica:   AlertCircle,
  exame_pratico:          Car,
  emissao_cnh:            FileCheck,
  liberado_isencoes:      BadgeCheck,
  cnh_regularizada:       BadgeCheck,
}

function initEdit(stage: ProcessStage): EditState {
  const data = { ...(stage.data as Record<string, unknown>) }
  return {
    status:         stage.status,
    scheduled_date: stage.scheduled_date ?? '',
    attended:       stage.attended ?? false,
    result:         stage.result ?? '',
    notes:          stage.notes ?? '',
    data,
  }
}

function isComplete(status: string) {
  return ['concluido', 'aprovado', 'nao_aplicavel'].includes(status)
}

export function CnhStagesPanel({ stages, processId, clientId, clientName, responsibleUserId }: Props) {
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadingCalId, setLoadingCalId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [calSuccess, setCalSuccess] = useState<Record<string, string>>({})
  const [edits, setEdits] = useState<Record<string, EditState>>({})

  const getEdit = (stage: ProcessStage): EditState => edits[stage.id] ?? initEdit(stage)

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

  // ── Calendar quick-save ────────────────────────────────────────────────────
  const saveCalendarEvent = async (stage: ProcessStage, type: 'internal' | 'client') => {
    const edit = getEdit(stage)
    if (!edit.scheduled_date) return

    const key = `${stage.id}-${type}`
    setLoadingCalId(key)
    setErrors(prev => ({ ...prev, [stage.id]: '' }))
    setCalSuccess(prev => ({ ...prev, [stage.id]: '' }))
    const supabase = createClient()
    const eventTitle = `${stage.label} — ${clientName}`

    try {
      // A data da etapa e o evento precisam falhar de forma visível, nunca simular sucesso.
      const { error: stageError } = await supabase
        .from('process_stages')
        .update({ scheduled_date: edit.scheduled_date })
        .eq('id', stage.id)

      if (stageError) throw stageError

      // Uma etapa representa um único compromisso. "Notificar cliente" compartilha
      // esse mesmo evento com o cliente, em vez de criar uma cópia para a equipe.
      const { data: existingEvents, error: lookupError } = await supabase
        .from('calendar_events')
        .select('id, visibility')
        .eq('process_id', processId)
        .eq('client_id', clientId)
        .eq('title', eventTitle)
        .order('created_at', { ascending: true })

      if (lookupError) throw lookupError

      const existingEvent = existingEvents?.[0]
      const visibility =
        type === 'client' || existingEvent?.visibility === 'client_visible'
          ? 'client_visible'
          : 'admin_only'

      const eventValues = {
        title:               eventTitle,
        event_date:          edit.scheduled_date,
        event_type:          'normal' as const,
        client_id:           clientId,
        process_id:          processId,
        responsible_user_id: responsibleUserId ?? null,
        visibility,
        status:              'pending' as const,
      }

      if (existingEvent) {
        const { error: eventError } = await supabase
          .from('calendar_events')
          .update(eventValues)
          .eq('id', existingEvent.id)

        if (eventError) throw eventError

        const duplicateIds = existingEvents.slice(1).map(event => event.id)
        if (duplicateIds.length > 0) {
          const { error: dedupeError } = await supabase
            .from('calendar_events')
            .delete()
            .in('id', duplicateIds)

          if (dedupeError) throw dedupeError
        }
      } else {
        const { error: eventError } = await supabase
          .from('calendar_events')
          .insert(eventValues)

        if (eventError) throw eventError
      }

      if (type === 'client') {
        const { data: clientRecord, error: clientError } = await supabase
          .from('clients')
          .select('profile_id')
          .eq('id', clientId)
          .single()

        if (clientError) throw clientError
        if (!clientRecord.profile_id) {
          throw new Error('O cliente ainda não possui acesso ao portal para receber a notificação.')
        }

        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id:    clientRecord.profile_id,
          client_id:  clientId,
          process_id: processId,
          title:      `Agendamento — ${stage.label}`,
          message:    `Você tem ${stage.label.toLowerCase()} agendado para ${formatDate(edit.scheduled_date)}.`,
          type:       'info' as const,
        })

        if (notificationError) throw notificationError
      }

      setCalSuccess(prev => ({
        ...prev,
        [stage.id]: type === 'client'
          ? 'Cliente notificado; evento visível nas duas agendas'
          : 'Agendamento salvo na agenda da equipe',
      }))
      setTimeout(() => setCalSuccess(prev => ({ ...prev, [stage.id]: '' })), 3000)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o agendamento.'
      setErrors(prev => ({ ...prev, [stage.id]: message }))
    } finally {
      setLoadingCalId(null)
    }
  }

  // ── Main stage save ────────────────────────────────────────────────────────
  const saveStage = async (stage: ProcessStage) => {
    const edit = getEdit(stage)
    if (
      stage.stage_key === 'pericia_medica' &&
      (edit.result === 'aprovado' || edit.status === 'aprovado') &&
      typeof edit.data.requires_practical_exam !== 'boolean'
    ) {
      setErrors(prev => ({
        ...prev,
        [stage.id]: 'Informe se o exame prático foi determinado antes de aprovar a perícia.',
      }))
      return
    }
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

    await syncProcessMacroStatus(supabase, processId, stage.stage_key, edit.status as StageStatus)

    if (stage.stage_key === 'pericia_medica' && (edit.result === 'reprovado' || edit.status === 'reprovado')) {
      await handlePericiaReprovada(supabase, processId)
    }
    if (stage.stage_key === 'pericia_medica' && (edit.result === 'aprovado' || edit.status === 'aprovado')) {
      const requiresPracticalExam = edit.data.requires_practical_exam
      const requiresAdaptedVehicle = edit.data.requires_adapted_vehicle
      const restrictions = String(edit.data.restricoes ?? '')
        .split(',')
        .map(value => value.trim().toUpperCase())
        .filter(Boolean)

      await supabase.from('clients').update({
        medical_assessment_status: restrictions.length > 0 ? 'apto_com_restricoes' : 'apto',
        requires_practical_exam: typeof requiresPracticalExam === 'boolean' ? requiresPracticalExam : null,
        requires_adapted_vehicle: typeof requiresAdaptedVehicle === 'boolean' ? requiresAdaptedVehicle : null,
        cnh_restrictions: restrictions,
      }).eq('id', clientId)

      if (typeof requiresPracticalExam === 'boolean') {
        await supabase.from('process_stages').update({
          status: requiresPracticalExam ? 'pendente' : 'nao_aplicavel',
          label: 'Exame Prático',
        }).eq('process_id', processId).eq('stage_key', 'exame_pratico')
      }

      if (restrictions.length > 0) {
        const { data: issuanceStage } = await supabase
          .from('process_stages')
          .select('id, data')
          .eq('process_id', processId)
          .eq('stage_key', 'emissao_cnh')
          .maybeSingle()
        if (issuanceStage) {
          await supabase.from('process_stages').update({
            data: { ...(issuanceStage.data as Record<string, unknown>), restricoes: restrictions.join(', ') },
          }).eq('id', issuanceStage.id)
        }
      }
    }
    if (stage.stage_key === 'emissao_cnh' && edit.status === 'concluido') {
      const restrictions = String(edit.data.restricoes ?? '')
        .split(',')
        .map(value => value.trim().toUpperCase())
        .filter(Boolean)
      await supabase.from('clients').update({
        has_cnh_especial: true,
        cnh_status: 'com_restricoes',
        cnh_restrictions: restrictions,
      }).eq('id', clientId)
      await handleEmissaoConcluida(supabase, processId)
    }

    await supabase.from('process_history').insert({
      process_id:  processId,
      action_type: 'updated',
      new_value:   edit.status,
      note:        `Etapa "${stage.label}" → ${STATUS_LABEL[edit.status] ?? edit.status}`,
    })

    // ── Auto calendar + notification when scheduled date is set or changed ───
    const dateChanged =
      HAS_SCHEDULED_DATE.has(stage.stage_key) &&
      edit.scheduled_date &&
      edit.scheduled_date !== (stage.scheduled_date ?? '')

    if (dateChanged) {
      // Remove eventos client_visible anteriores desta etapa (evita duplicatas)
      await supabase
        .from('calendar_events')
        .delete()
        .eq('process_id', processId)
        .eq('client_id', clientId)
        .eq('visibility', 'client_visible')
        .ilike('title', `%${stage.label}%`)

      // Cria evento na agenda do cliente
      await supabase.from('calendar_events').insert({
        title:               `${stage.label} — ${clientName}`,
        event_date:          edit.scheduled_date,
        event_type:          'normal' as const,
        client_id:           clientId,
        process_id:          processId,
        responsible_user_id: responsibleUserId ?? null,
        visibility:          'client_visible',
        status:              'pending',
      })

      // Busca profile_id do cliente (pode ser reaproveitado abaixo)
      const { data: clientRecord } = await supabase
        .from('clients')
        .select('profile_id')
        .eq('id', clientId)
        .single()

      if (clientRecord?.profile_id) {
        await supabase.from('notifications').insert({
          user_id:    clientRecord.profile_id,
          client_id:  clientId,
          process_id: processId,
          title:      `Agendamento confirmado — ${stage.label}`,
          message:    `Sua ${stage.label.toLowerCase()} está agendada para ${formatDate(edit.scheduled_date)}. Fique atento ao dia e horário.`,
          type:       'info' as const,
        })
      }
    }

    // ── Status change notification ───────────────────────────────────────────
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
  const doneCount = sorted.filter(s => isComplete(s.status)).length
  const pct = sorted.length > 0 ? Math.round((doneCount / sorted.length) * 100) : 0
  const currentStage = sorted.find(s => s.status === 'em_andamento') ?? sorted.find(s => s.status === 'pendente')

  return (
    <div className="space-y-5">

      {/* ── Progress header ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, #1E1A17 0%, #2D2420 100%)',
          border: '1px solid rgba(161,79,42,0.25)',
        }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold text-amber-300/60 uppercase tracking-widest mb-1">Progresso CNH Especial</p>
            <p className="text-2xl font-bold text-white">
              {doneCount}
              <span className="text-base text-white/40 font-normal">/{sorted.length} etapas</span>
            </p>
          </div>
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                stroke={pct === 100 ? '#22C55E' : '#C97A52'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{pct}%</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                : 'linear-gradient(90deg, #A14F2A, #C97A52)',
            }}
          />
        </div>

        {/* Stage dots */}
        <div className="flex items-center gap-0">
          {sorted.map((stage, idx) => {
            const done = isComplete(stage.status)
            const active = stage.status === 'em_andamento'
            const failed = stage.status === 'reprovado'
            const Icon = STAGE_ICONS[stage.stage_key] ?? Clock
            const isLast = idx === sorted.length - 1

            return (
              <div key={stage.id} className="flex items-center" style={{ flex: isLast ? 'none' : 1 }}>
                <button
                  type="button"
                  onClick={() => setActiveId(activeId === stage.id ? null : stage.id)}
                  title={stage.label}
                  className="relative flex flex-col items-center gap-1 group"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                    style={{
                      background: done ? '#22C55E' : active ? '#C97A52' : failed ? '#EF4444' : 'rgba(255,255,255,0.1)',
                      border: activeId === stage.id ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                      boxShadow: active ? '0 0 0 3px rgba(201,122,82,0.3)' : 'none',
                    }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : failed ? (
                      <XCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                    )}
                  </div>
                  <span
                    className="text-[9px] font-semibold leading-tight text-center max-w-13 truncate"
                    style={{ color: done || active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}
                  >
                    {stage.label.split(' ')[0]}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className="flex-1 h-px mx-1 -mt-2.5"
                    style={{ background: done ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Current stage label */}
        {currentStage && pct < 100 && (
          <div className="mt-4 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <p className="text-xs text-white/70">
              Em andamento: <span className="font-semibold text-white/90">{currentStage.label}</span>
            </p>
          </div>
        )}
        {pct === 100 && (
          <div className="mt-4 flex items-center gap-2 bg-emerald-500/20 rounded-xl px-3 py-2.5 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold text-emerald-300">Processo CNH Especial concluído</p>
          </div>
        )}
      </div>

      {/* ── Stage cards ─────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {sorted.map((stage, idx) => {
          const edit = getEdit(stage)
          const st = STATUS_STYLE[stage.status] ?? STATUS_STYLE.pendente
          const isActive = activeId === stage.id
          const isLoading = loadingId === stage.id
          const err = errors[stage.id]
          const calMsg = calSuccess[stage.id]
          const isLast = idx === sorted.length - 1
          const done = isComplete(stage.status)
          const Icon = STAGE_ICONS[stage.stage_key] ?? Clock

          return (
            <div key={stage.id} className="relative">
              {!isLast && (
                <div
                  className="absolute left-4.75 top-11 -bottom-2.5 w-0.5 z-0"
                  style={{ background: done ? '#BBF7D0' : '#E2E8F0' }}
                />
              )}

              <div
                className="relative z-10 bg-white rounded-xl overflow-hidden transition-shadow"
                style={{
                  border: `1px solid ${st.border}`,
                  borderLeft: `3px solid ${st.leftBorder}`,
                  boxShadow: isActive
                    ? `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px ${st.ring}40`
                    : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* Stage header */}
                <button
                  type="button"
                  onClick={() => setActiveId(isActive ? null : stage.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: st.bg, border: `1.5px solid ${st.border}` }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: st.dot }} />
                    ) : stage.status === 'reprovado' ? (
                      <XCircle className="w-4 h-4" style={{ color: st.dot }} />
                    ) : (
                      <Icon className="w-3.5 h-3.5" style={{ color: st.dot }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{stage.label}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {stage.scheduled_date && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(stage.scheduled_date)}
                          {stage.attended !== null && stage.attended !== undefined && (
                            <span className={cn('ml-1 font-medium', stage.attended ? 'text-emerald-600' : 'text-red-400')}>
                              · {stage.attended ? 'compareceu' : 'não compareceu'}
                            </span>
                          )}
                        </p>
                      )}
                      {stage.notes && (
                        <p className="text-[10px] text-slate-400 truncate max-w-30" title={stage.notes}>
                          {stage.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
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

                {/* ── Edit panel ──────────────────────────────────── */}
                {isActive && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/40">

                    {/* Status selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600">Status da etapa</p>
                      <div className="flex flex-wrap gap-2">
                        {(STATUS_OPTIONS_BY_KEY[stage.stage_key] ?? ['pendente', 'em_andamento', 'concluido']).map(s => {
                          const ss = STATUS_STYLE[s] ?? STATUS_STYLE.pendente
                          const isSel = edit.status === s
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateEdit(stage, 'status', s)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
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

                    {/* ── Scheduled date + calendar buttons ─────── */}
                    {HAS_SCHEDULED_DATE.has(stage.stage_key) && (
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-slate-600">Data agendada</p>
                        <input
                          type="date"
                          value={edit.scheduled_date}
                          onChange={e => updateEdit(stage, 'scheduled_date', e.target.value)}
                          className="block rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                        />

                        {edit.scheduled_date && (
                          <div className="flex flex-wrap gap-2">
                            {/* Internal calendar button */}
                            <button
                              type="button"
                              onClick={() => saveCalendarEvent(stage, 'internal')}
                              disabled={!!loadingCalId}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                            >
                              {loadingCalId === `${stage.id}-internal` ? (
                                <Clock className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                              ) : (
                                <CalendarPlus className="w-3.5 h-3.5 text-slate-500" />
                              )}
                              {loadingCalId === `${stage.id}-internal` ? 'Salvando...' : 'Agenda interna'}
                            </button>

                            {/* Client notification + calendar button */}
                            <button
                              type="button"
                              onClick={() => saveCalendarEvent(stage, 'client')}
                              disabled={!!loadingCalId}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all disabled:opacity-50"
                            >
                              {loadingCalId === `${stage.id}-client` ? (
                                <Clock className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Bell className="w-3.5 h-3.5" />
                              )}
                              {loadingCalId === `${stage.id}-client` ? 'Enviando...' : 'Notificar cliente'}
                            </button>
                          </div>
                        )}

                        {/* Calendar success feedback */}
                        {calMsg && (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <p className="text-xs font-medium text-emerald-700">{calMsg}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attended toggle */}
                    {HAS_ATTENDED.has(stage.stage_key) && (
                      <div className="flex items-center justify-between py-0.5">
                        <p className="text-xs font-semibold text-slate-600">Compareceu?</p>
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

                    {/* checklist_documentos */}
                    {stage.stage_key === 'checklist_documentos' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Documentos recebidos</p>
                        <div className="space-y-1.5">
                          {CHECKLIST_FIELDS.map(field => {
                            const checked = !!(edit.data[field])
                            return (
                              <label
                                key={field}
                                className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-amber-200 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => updateData(stage, field, e.target.checked)}
                                  className="w-4 h-4 rounded text-amber-600 shrink-0"
                                />
                                <span className="text-sm text-slate-700 flex-1">{CHECKLIST_LABELS[field]}</span>
                                {checked && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                              </label>
                            )
                          })}
                        </div>
                        {(() => {
                          const total = CHECKLIST_FIELDS.length
                          const checkedCount = CHECKLIST_FIELDS.filter(f => !!(edit.data[f])).length
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                                  style={{ width: `${(checkedCount / total) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">{checkedCount}/{total}</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Result buttons — pericia, recurso, exame */}
                    {['pericia_medica', 'recurso_junta_medica', 'exame_pratico'].includes(stage.stage_key) && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Resultado</p>
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
                                    [stage.id]: { ...cur, result: newResult, status: newResult || cur.status },
                                  }
                                })
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border"
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
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Restrições determinadas</p>
                          <input
                            type="text"
                            value={(edit.data.restricoes as string) ?? ''}
                            onChange={e => updateData(stage, 'restricoes', e.target.value)}
                            placeholder="Códigos do laudo/RENACH, ex.: B, X"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-400">Informe somente os códigos emitidos; não os deduza pelo tipo de deficiência.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { key: 'requires_practical_exam', label: 'Exame prático determinado?' },
                            { key: 'requires_adapted_vehicle', label: 'Veículo adaptado determinado?' },
                          ].map(field => (
                            <div key={field.key} className="space-y-1.5">
                              <p className="text-xs font-semibold text-slate-600">{field.label}</p>
                              <select
                                value={typeof edit.data[field.key] === 'boolean' ? String(edit.data[field.key]) : ''}
                                onChange={e => updateData(stage, field.key, e.target.value === '' ? null : e.target.value === 'true')}
                                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                              >
                                <option value="">Aguardando definição</option>
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                              </select>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Observações da perícia</p>
                          <textarea
                            value={(edit.data.observacoes as string) ?? ''}
                            onChange={e => updateData(stage, 'observacoes', e.target.value)}
                            placeholder="Notas do médico perito..."
                            rows={2}
                            className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* recurso_junta_medica */}
                    {stage.stage_key === 'recurso_junta_medica' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Cadastro SEI</p>
                          <input
                            type="text"
                            value={(edit.data.cadastro_sei as string) ?? ''}
                            onChange={e => updateData(stage, 'cadastro_sei', e.target.value)}
                            placeholder="Nº SEI"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Protocolo</p>
                          <input
                            type="text"
                            value={(edit.data.protocolo as string) ?? ''}
                            onChange={e => updateData(stage, 'protocolo', e.target.value)}
                            placeholder="Nº protocolo"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* exame_pratico */}
                    {stage.stage_key === 'exame_pratico' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600">Modalidade</p>
                          <div className="flex gap-2">
                            {[
                              { value: 'autoescola',      label: 'Autoescola' },
                              { value: 'veiculo_proprio', label: 'Veículo Próprio' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateData(stage, 'modalidade', edit.data.modalidade === opt.value ? null : opt.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                                style={edit.data.modalidade === opt.value
                                  ? { background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' }
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
                            <p className="text-xs font-semibold text-slate-600">Checklist veículo próprio</p>
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
                                <label key={key} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-amber-200 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => updateNestedData(stage, 'checklist_veiculo_proprio', key, e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-600 shrink-0"
                                  />
                                  <span className="text-sm text-slate-700">{label}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* emissao_cnh */}
                    {stage.stage_key === 'emissao_cnh' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Restrições (código)</p>
                          <input
                            type="text"
                            value={(edit.data.restricoes as string) ?? ''}
                            onChange={e => updateData(stage, 'restricoes', e.target.value)}
                            placeholder="Códigos emitidos, ex.: B, X, D"
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">Vencimento da CNH</p>
                          <input
                            type="date"
                            value={(edit.data.vencimento_cnh as string) ?? ''}
                            onChange={e => updateData(stage, 'vencimento_cnh', e.target.value)}
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-600">Observações internas</p>
                      <textarea
                        value={edit.notes}
                        onChange={e => updateEdit(stage, 'notes', e.target.value)}
                        placeholder="Notas sobre esta etapa..."
                        rows={2}
                        className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-amber-400 focus:outline-none resize-none"
                      />
                    </div>

                    {/* ── Contextual warnings ──────────────────────── */}
                    {stage.stage_key === 'pericia_medica' && (edit.result === 'reprovado' || edit.status === 'reprovado') && (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          Ao salvar, a etapa <strong>Recurso — Junta Médica</strong> será inserida automaticamente e um prazo de 30 dias será criado no calendário.
                        </p>
                      </div>
                    )}

                    {stage.stage_key === 'emissao_cnh' && edit.status === 'concluido' && (
                      <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800">
                          Ao salvar, o processo será marcado como <strong>Concluído</strong> e o cliente receberá uma notificação sobre a CNH emitida.
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {err && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700">{err}</p>
                      </div>
                    )}

                    {/* ── Actions ──────────────────────────────────── */}
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
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
    </div>
  )
}
