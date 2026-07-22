import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, CheckCircle2, XCircle, Clock, Calendar,
  AlertCircle, ChevronRight, FileWarning, Sparkles,
} from 'lucide-react'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { DocumentUploader } from '@/components/shared/document-uploader'
import { formatDate, formatDateTime, formatCurrency, HISTORY_ACTION_LABELS } from '@/lib/utils'

// ─── Friendly labels for CNH stage keys ─────────────────────────────────────

const STAGE_FRIENDLY: Record<string, { title: string; desc: string; tip: string }> = {
  checklist_documentos:   { title: 'Documentos',           desc: 'Reunião dos documentos necessários',            tip: 'Envie os documentos solicitados pelo escritório' },
  agendamento_poupatempo: { title: 'Agendamento',          desc: 'Agendamento da consulta no Poupatempo',         tip: 'Aguarde a confirmação da data pela equipe' },
  pericia_medica:         { title: 'Perícia Médica',       desc: 'Avaliação médica no DETRAN (RENACH)',           tip: 'Compareça na data agendada com os documentos' },
  recurso_junta_medica:   { title: 'Recurso Médico',       desc: 'Recurso junto à Junta Médica (3 especialistas)', tip: 'Aguarde o resultado do recurso médico' },
  exame_pratico:          { title: 'Exame Prático',        desc: 'Teste de condução para adaptação veicular',     tip: 'Prepare-se para o exame com seu veículo adaptado' },
  emissao_cnh:            { title: 'Emissão da CNH',       desc: 'Emissão da CNH com as restrições determinadas', tip: 'Sua CNH com restrições está sendo processada pelo DETRAN' },
  liberado_isencoes:      { title: 'CNH regularizada',     desc: 'CNH emitida — processo concluído',              tip: 'A equipe revisará separadamente cada benefício' },
  cnh_regularizada:       { title: 'CNH regularizada',     desc: 'CNH emitida — processo concluído',              tip: 'A equipe revisará separadamente cada benefício' },
}

const CHECKLIST_FRIENDLY: Record<string, string> = {
  cnh:                  'CNH atual',
  laudo_medico:         'Laudo Médico',
  acesso_gov_validado:  'Acesso Gov.br validado com o cliente',
  comprovante_endereco: 'Comprovante de Endereço',
  email:                'E-mail confirmado',
}

const STAGE_STATUS_LABEL: Record<string, string> = {
  pendente:      'Aguardando',
  em_andamento:  'Em andamento',
  concluido:     'Concluído',
  aprovado:      'Aprovado',
  reprovado:     'Não aprovado',
  nao_aplicavel: 'Não aplicável',
}

type MedicalFollowUpStage = {
  stage_key?: string
  data?: Record<string, unknown> | null
}

function getMedicalFollowUpCopy(stage?: MedicalFollowUpStage | null) {
  if (!stage || stage.stage_key !== 'pericia_medica') return null

  const data = (stage.data ?? {}) as Record<string, unknown>
  const status = data.medical_follow_up_status
  const examName = typeof data.complementary_exam_name === 'string' && data.complementary_exam_name.trim()
    ? data.complementary_exam_name.trim()
    : 'exame complementar'

  if (status === 'complementary_exam_requested') {
    return {
      title: `Aguardando ${examName}`,
      desc: 'A avaliação médica ainda não foi concluída porque foi solicitado um exame complementar.',
      tip: 'Realize o exame e envie o resultado para a equipe organizar o retorno médico.',
    }
  }
  if (status === 'complementary_exam_completed') {
    return {
      title: 'Aguardando retorno médico',
      desc: `${examName} realizado; falta a conclusão da avaliação médica.`,
      tip: 'Envie o resultado para a equipe confirmar o retorno.',
    }
  }
  if (status === 'follow_up_scheduled') {
    return {
      title: 'Retorno médico agendado',
      desc: 'O exame complementar será reavaliado no retorno médico.',
      tip: 'Leve o resultado do exame e os documentos solicitados.',
    }
  }
  if (status === 'decision_pending') {
    return {
      title: 'Aguardando conclusão médica',
      desc: 'A equipe aguarda o resultado definitivo da avaliação.',
      tip: 'A próxima etapa será definida somente após a conclusão médica.',
    }
  }

  return null
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ClienteProcessoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('auth_user_id', user!.id).single()
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', profile!.id).single()

  if (!client) redirect('/minha-area')

  const [
    { data: process },
    { data: history },
    { data: documents },
    { data: events },
    { data: rawStages },
  ] = await Promise.all([
    supabase.from('processes').select(`
      *,
      process_types(id, name, slug, color),
      custom_fields:process_custom_fields(*)
    `).eq('id', id).eq('client_id', client.id).single(),
    supabase.from('process_history')
      .select('id, action_type, old_value, new_value, note, created_at')
      .eq('process_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('documents').select('*').eq('process_id', id).order('created_at', { ascending: false }),
    supabase.from('calendar_events').select('*')
      .eq('process_id', id)
      .eq('visibility', 'client_visible')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5),
    supabase.from('process_stages').select('*').eq('process_id', id).order('sort_order'),
  ])

  if (!process) notFound()

  const pt = process.process_types as any
  const isCnh = pt?.slug === 'cnh_especial'
  const stages = isCnh ? (rawStages ?? []) : []
  const color: string = pt?.color ?? '#A14F2A'

  // CNH-specific computed values
  const sortedStages = [...stages].sort((a: any, b: any) => a.sort_order - b.sort_order)
  const doneStatuses = new Set(['concluido', 'aprovado', 'nao_aplicavel'])
  const resolvedStatuses = new Set([...doneStatuses, 'reprovado'])
  const doneCount = sortedStages.filter((s: any) => resolvedStatuses.has(s.status)).length
  const currentStage: any = sortedStages.find((s: any) => s.status === 'em_andamento')
    ?? sortedStages.find((s: any) => s.status === 'pendente')
  const currentStageFollowUp = getMedicalFollowUpCopy(currentStage)
  const isAllDone = !currentStage && stages.length > 0

  // Missing docs from checklist stage
  const checklistStage: any = sortedStages.find((s: any) => s.stage_key === 'checklist_documentos')
  const checklistData = (checklistStage?.data ?? {}) as Record<string, boolean>
  const missingChecklist = Object.entries(checklistData)
    .filter(([, v]) => !v)
    .map(([k]) => CHECKLIST_FRIENDLY[k] ?? k)
  const pendingDocs = (documents ?? []).filter((d: any) => ['pending', 'resend_required'].includes(d.status))
  const hasMissingDocs = isCnh && (missingChecklist.length > 0 || pendingDocs.length > 0)

  const customFields = Array.isArray(process.custom_fields)
    ? (process.custom_fields as any[]).filter(f => !['senha_gov', 'gov_password', 'senha_sei', 'senha_email', 'senha_portal'].includes(f.field_name))
    : []

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(161,79,42,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(161,79,42,0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
        .anim-5 { animation-delay: 0.25s; }
        .step-pulse { animation: pulse-ring 2s infinite; }
      `}</style>

      <div className="dash space-y-5">

        {/* ── Banner ─────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />

          <div className="relative p-6 sm:p-8">
            <Link
              href="/minha-area/processos"
              className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors hover:text-white"
              style={{ color: 'rgba(201,122,82,0.75)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Meus Processos
            </Link>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/20 mt-0.5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                >
                  <div className="w-4 h-4 rounded-full bg-white/80" />
                </div>
                <div>
                  <h1 className="text-white text-xl font-bold leading-tight">{pt?.name ?? 'Processo'}</h1>
                  {process.protocol && (
                    <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'rgba(201,122,82,0.7)' }}>
                      #{process.protocol}
                    </p>
                  )}
                  <div className="mt-2">
                    <ProcessStatusBadge status={process.status} />
                  </div>
                </div>
              </div>

              {isCnh && stages.length > 0 && (
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center shrink-0">
                  <p className="text-white text-2xl font-bold leading-none">{doneCount}<span className="text-white/50 text-base font-medium">/{stages.length}</span></p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(201,122,82,0.6)' }}>etapas concluídas</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            CNH ESPECIAL — stepper layout
        ═══════════════════════════════════════════════════════════ */}
        {isCnh && stages.length > 0 && (
          <>
            {/* Status card */}
            <div
              className="anim anim-1 bg-white rounded-2xl p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              {isAllDone ? (
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="dash text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">Processo Concluído</p>
                    <h2 className="dash text-lg font-bold text-slate-900">CNH com restrições emitida!</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      A equipe agora verificará separadamente a elegibilidade de cada benefício solicitado.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#FEF3EC' }}
                  >
                    <Clock className="w-5 h-5" style={{ color: '#A14F2A' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="dash text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#A14F2A' }}>
                      Etapa {Math.min(doneCount + 1, stages.length)} de {stages.length}
                    </p>
                    <h2 className="dash text-lg font-bold text-slate-900 leading-tight">
                      {currentStageFollowUp?.title ?? STAGE_FRIENDLY[currentStage?.stage_key]?.title ?? currentStage?.label ?? '–'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {currentStageFollowUp?.desc ?? STAGE_FRIENDLY[currentStage?.stage_key]?.desc ?? ''}
                    </p>
                    {currentStage?.scheduled_date && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: '#A14F2A' }}>
                        <Calendar className="w-3.5 h-3.5" />
                        {currentStage.attended ? 'Atendimento em' : 'Data agendada'}: {formatDate(currentStage.scheduled_date)}
                      </div>
                    )}
                    {events && events.length > 0 && !currentStage?.scheduled_date && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: '#A14F2A' }}>
                        <Calendar className="w-3.5 h-3.5" />
                        Próximo: {(events[0] as any).title} — {formatDate((events[0] as any).event_date)}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-2 italic">
                      {currentStageFollowUp?.tip ?? STAGE_FRIENDLY[currentStage?.stage_key]?.tip ?? ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Missing docs alert */}
            {hasMissingDocs && (
              <div
                className="anim anim-2 bg-amber-50 rounded-2xl p-5"
                style={{ border: '1px solid #FDE68A' }}
              >
                <div className="flex items-start gap-3">
                  <FileWarning className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="dash font-bold text-amber-900 text-sm mb-2">
                      Documentos que faltam enviar
                    </h3>
                    {missingChecklist.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {missingChecklist.map(item => (
                          <div key={item} className="flex items-center gap-2 text-sm text-amber-800">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                    {pendingDocs.length > 0 && (
                      <div className="space-y-1">
                        {pendingDocs.map((d: any) => (
                          <div key={d.id} className="flex items-center gap-2 text-sm text-amber-800">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {d.file_name} — {d.status === 'resend_required' ? 'Reenvio necessário' : 'Aguardando revisão'}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-amber-700 mt-3 italic">
                      Envie os documentos na seção abaixo para agilizar o processo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stepper */}
            <div
              className="anim anim-2 bg-white rounded-2xl p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <h2 className="dash font-bold text-slate-900 text-sm mb-5">Acompanhamento por etapas</h2>

              <div className="space-y-0">
                {sortedStages.map((stage: any, idx: number) => {
                  const isDone = doneStatuses.has(stage.status)
                  const isReprovado = stage.status === 'reprovado'
                  const isNa = stage.status === 'nao_aplicavel'
                  const isCurrent = currentStage?.id === stage.id
                  const isLast = idx === sortedStages.length - 1
                  const stepNum = idx + 1

                  // Circle style
                  let circleStyle: React.CSSProperties = {}
                  let circleClass = 'w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 relative text-xs font-bold'
                  if (isDone && !isReprovado && !isNa) {
                    circleClass += ' bg-emerald-500 text-white'
                  } else if (isReprovado) {
                    circleClass += ' bg-red-500 text-white'
                  } else if (isNa) {
                    circleClass += ' bg-slate-100 text-slate-400'
                  } else if (isCurrent) {
                    circleClass += ' step-pulse'
                    circleStyle = { backgroundColor: '#A14F2A', color: '#fff' }
                  } else {
                    circleClass += ' bg-white border-2 border-slate-200 text-slate-400'
                  }

                  // Content opacity
                  const isPastCurrent = !isDone && !isReprovado && !isCurrent
                  const opacity = isPastCurrent && !isNa ? 0.5 : 1

                  const friendly = STAGE_FRIENDLY[stage.stage_key]
                  const medicalFollowUp = getMedicalFollowUpCopy(stage)

                  return (
                    <div key={stage.id} className="flex gap-3 relative" style={{ opacity }}>
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className="absolute left-3.5 top-7 w-px z-0"
                          style={{ bottom: 0, backgroundColor: isDone ? '#BBF7D0' : '#E2E8F0' }}
                        />
                      )}

                      {/* Circle */}
                      <div className="pt-0.5 shrink-0 z-10">
                        <div className={circleClass} style={circleStyle}>
                          {(isDone && !isReprovado && !isNa) ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isReprovado ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            stepNum
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className={`dash text-sm font-semibold leading-snug ${isCurrent ? 'text-slate-900' : isDone ? 'text-slate-700' : 'text-slate-500'}`}>
                              {(isCurrent ? medicalFollowUp?.title : null) ?? friendly?.title ?? stage.label}
                            </p>
                            {isCurrent && (medicalFollowUp?.desc || friendly?.desc) && (
                              <p className="text-xs text-slate-500 mt-0.5">{medicalFollowUp?.desc ?? friendly?.desc}</p>
                            )}
                          </div>
                          <span
                            className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor:
                                isDone && !isReprovado ? '#D1FAE5' :
                                isReprovado           ? '#FEE2E2' :
                                isCurrent             ? '#FEF3EC' :
                                '#F1F5F9',
                              color:
                                isDone && !isReprovado ? '#065F46' :
                                isReprovado           ? '#991B1B' :
                                isCurrent             ? '#A14F2A' :
                                '#94A3B8',
                            }}
                          >
                            {STAGE_STATUS_LABEL[stage.status] ?? stage.status}
                          </span>
                        </div>

                        {stage.scheduled_date && (
                          <div className="flex items-center gap-1 text-xs mt-1" style={{ color: '#A14F2A' }}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(stage.scheduled_date)}
                          </div>
                        )}

                        {isCurrent && stage.notes && (
                          <p className="text-xs text-slate-500 mt-1.5 italic border-l-2 border-amber-200 pl-2">
                            {stage.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            NON-CNH — generic details layout
        ═══════════════════════════════════════════════════════════ */}
        {!isCnh && (
          <div className="anim anim-1 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: details */}
            <div className="lg:col-span-1 space-y-4">
              <div
                className="bg-white rounded-2xl p-5"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <h2 className="dash font-bold text-slate-800 text-sm mb-4">Detalhes</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <ProcessStatusBadge status={process.status} />
                  </div>
                  {process.protocol && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Protocolo:</span>
                      <span className="font-mono text-xs text-slate-900">{process.protocol}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Abertura:</span>
                    <span className="text-slate-900">{formatDate(process.created_at)}</span>
                  </div>
                </div>
              </div>

              {customFields.length > 0 && (
                <div
                  className="bg-white rounded-2xl p-5"
                  style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                >
                  <h2 className="dash font-bold text-slate-800 text-sm mb-4">Informações</h2>
                  <div className="space-y-3">
                    {customFields.sort((a: any, b: any) => a.sort_order - b.sort_order).map((f: any) => (
                      <div key={f.id} className="flex justify-between text-sm">
                        <span className="text-slate-500">{f.field_label}:</span>
                        <span className="text-slate-900 font-medium">
                          {f.field_type === 'boolean'
                            ? f.field_value === 'true' ? 'Sim' : 'Não'
                            : f.field_type === 'currency' && f.field_value
                              ? formatCurrency(parseFloat(f.field_value))
                              : f.field_type === 'date' && f.field_value
                                ? formatDate(f.field_value)
                                : f.field_value ?? '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {events && events.length > 0 && (
                <div
                  className="bg-white rounded-2xl p-5"
                  style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                >
                  <h2 className="dash font-bold text-slate-800 text-sm mb-3">Próximos Compromissos</h2>
                  <div className="space-y-3">
                    {events.map((ev: any) => (
                      <div key={ev.id} className="text-sm">
                        <p className="font-medium text-slate-800">{ev.title}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: documents + history */}
            <div className="lg:col-span-2 space-y-4">
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="p-5 border-b border-slate-100">
                  <h2 className="dash font-bold text-slate-900 text-sm">Documentos</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Envie documentos relacionados ao seu processo</p>
                </div>
                <DocumentUploader processId={process.id} clientId={client.id} />
                {documents && documents.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-4">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                        </div>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Ver</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-400">Nenhum documento enviado</p>
                  </div>
                )}
              </div>

              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="p-5 border-b border-slate-100">
                  <h2 className="dash font-bold text-slate-900 text-sm">Histórico</h2>
                </div>
                {!history || history.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400 text-center">Sem movimentações</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {history
                      .filter((h: any) => !['observation_added'].includes(h.action_type))
                      .map((h: any) => (
                        <div key={h.id} className="flex gap-3 p-4">
                          <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2" />
                          <div>
                            <p className="text-sm text-slate-800">{HISTORY_ACTION_LABELS[h.action_type] ?? h.action_type}</p>
                            <p className="text-xs text-slate-400">{formatDateTime(h.created_at)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            CNH — documents + events (below stepper)
        ═══════════════════════════════════════════════════════════ */}
        {isCnh && (
          <>
            {/* Upcoming appointments (client_visible) */}
            {events && events.length > 0 && (
              <div
                className="anim anim-3 bg-white rounded-2xl p-5"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <h2 className="dash font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: '#A14F2A' }} />
                  Próximos Compromissos
                </h2>
                <div className="space-y-3">
                  {events.map((ev: any) => (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                        style={{ backgroundColor: '#FEF3EC', color: '#A14F2A' }}
                      >
                        {formatDate(ev.event_date).slice(0, 5)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(ev.event_date)}{ev.event_time ? ` às ${ev.event_time.slice(0, 5)}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents section */}
            <div
              className="anim anim-4 bg-white rounded-2xl overflow-hidden"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="p-5 border-b border-slate-100">
                <h2 className="dash font-bold text-slate-900 text-sm">Documentos do Processo</h2>
                <p className="text-xs text-slate-400 mt-0.5">Envie os documentos solicitados pela equipe</p>
              </div>
              <DocumentUploader processId={process.id} clientId={client.id} />
              {documents && documents.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 p-4">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: '#F8FAFC' }}
                      >
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                        <p className="text-xs text-slate-400">{formatDate(doc.created_at)}</p>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Ver <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Nenhum documento enviado</p>
                  <p className="text-xs text-slate-300 mt-0.5">Use o formulário acima para enviar</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
