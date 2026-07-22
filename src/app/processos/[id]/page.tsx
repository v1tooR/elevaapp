import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Clock, RefreshCw, Link2, ArrowUpRight, DollarSign, Calendar, ListChecks } from 'lucide-react'
import { ProcessStatusBadge, PaymentStatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatDateTime, formatCurrency, getCustomFieldOptionLabel, HISTORY_ACTION_LABELS } from '@/lib/utils'
import { EditProcessModal } from '@/components/processos/edit-process-modal'
import { DocumentUploader } from '@/components/shared/document-uploader'
import { CnhStagesPanel } from '@/components/processos/cnh-stages-panel'
import { InitCnhStagesButton } from '@/components/processos/init-cnh-stages-button'
import { IpvaStagesPanel } from '@/components/processos/ipva-stages-panel'
import { OperationalStagesPanel } from '@/components/processos/operational-stages-panel'
import { EligibilityReviewPanel } from '@/components/processos/eligibility-review-panel'
import { hasOperationalWorkflow } from '@/lib/operational-workflows'
import {
  analyzeEligibility,
  isEligibilityProcess,
  type EligibilityAnalysis,
  type ImescSeverity,
  type ImescStatus,
  type SefazIpvaStatus,
} from '@/lib/eligibility'
import type { Document, EligibilityStatus, LegalRuleVersion, ProcessCustomField, ProcessStage } from '@/types/database'

const ACTION_ICONS: Record<string, string> = {
  created: '🟢',
  status_changed: '🔄',
  updated: '✏️',
  document_uploaded: '📎',
  document_approved: '✅',
  document_rejected: '❌',
  completed: '🏁',
}

export default async function ProcessoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getProfile()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [
    { data: process, error: processError },
    { data: history },
    { data: documents },
    { data: events },
    { data: stages },
    { data: legalRules },
  ] = await Promise.all([
    supabase.from('processes').select(`
      *,
      clients(id, name, cpf, phone, email, state, disability_type, disability_types, disability_severity, client_type, cnh_status, cnh_restrictions, medical_assessment_status, requires_adapted_vehicle, requires_practical_exam, has_medical_report, authorized_drivers),
      process_types(*),
      responsible_user:profiles!responsible_user_id(id, name),
      custom_fields:process_custom_fields(*),
      financials:process_financials(*)
    `).eq('id', id).single(),
    supabase.from('process_history').select(`*, changer:profiles!changed_by(id, name)`)
      .eq('process_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('documents').select('*').eq('process_id', id).order('created_at', { ascending: false }),
    supabase.from('calendar_events').select('*').eq('process_id', id).order('event_date', { ascending: true }).limit(5),
    supabase.from('process_stages').select('*').eq('process_id', id).order('sort_order'),
    supabase.from('legal_rule_versions').select('*').eq('process_type_slug', 'processo_ipva').eq('is_active', true).order('effective_from', { ascending: false }),
  ])

  if (processError) {
    if (processError.code === 'PGRST116') notFound()
    throw new Error(processError.message)
  }
  if (!process) notFound()

  const pt = process.process_types as any
  const client = process.clients as any
  const responsible = process.responsible_user as any
  const financials = Array.isArray(process.financials) ? process.financials[0] : process.financials
  const sensitiveFieldNames = new Set(['senha_gov', 'gov_password', 'senha_sei', 'senha_email', 'senha_portal'])
  const customFields = ((Array.isArray(process.custom_fields) ? process.custom_fields : []) as ProcessCustomField[])
    .filter(field => !sensitiveFieldNames.has(field.field_name))
  const sanitizedProcess = { ...process, custom_fields: customFields }
  const processStages = (stages ?? []) as ProcessStage[]
  const processDocuments = (documents ?? []) as Document[]
  const typeColor = pt?.color ?? '#3B82F6'
  const customFieldValues = Object.fromEntries(
    customFields.map(field => [field.field_name, field.field_value ?? '']),
  ) as Record<string, string>
  const liveEligibilityAnalysis = isEligibilityProcess(pt?.slug ?? '')
    ? analyzeEligibility({
        processTypeSlug: pt.slug,
        state: process.jurisdiction_state || client?.state,
        vehicleCondition: process.vehicle_condition,
        clientType: client?.client_type,
        disabilityType: client?.disability_type,
        disabilityTypes: client?.disability_types,
        disabilitySeverity: client?.disability_severity,
        cnhStatus: client?.cnh_status,
        cnhRestrictions: client?.cnh_restrictions,
        medicalAssessmentStatus: client?.medical_assessment_status,
        requiresAdaptedVehicle: client?.requires_adapted_vehicle,
        requiresPracticalExam: client?.requires_practical_exam,
        hasMedicalReport: client?.has_medical_report,
        authorizedDrivers: client?.authorized_drivers,
        imescStatus: (customFieldValues.imesc_status || null) as ImescStatus | null,
        imescReportIssuedAt: customFieldValues.imesc_data_laudo || null,
        imescSeverity: (customFieldValues.imesc_grau || null) as ImescSeverity | null,
        sefazIpvaStatus: (customFieldValues.sefaz_ipva_status || null) as SefazIpvaStatus | null,
        sefazDecisionNotifiedAt: customFieldValues.sefaz_data_ciencia || null,
        ipvaAppealFiledAt: customFieldValues.recurso_ipva_protocolado_em || null,
        ipvaAppealProtocol: customFieldValues.recurso_ipva_protocolo || null,
      })
    : null
  const eligibilityAnalysis = liveEligibilityAnalysis
    ?? ((process.eligibility_analysis as unknown as EligibilityAnalysis) ?? null)
  const displayedEligibilityStatus = (
    process.eligibility_status === 'elegibilidade_confirmada'
      ? process.eligibility_status
      : eligibilityAnalysis?.status ?? process.eligibility_status
  ) as EligibilityStatus | null

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
        .doc-row { transition: background 0.12s; }
        .doc-row:hover { background: #F8FAFC; }
        .back-btn { transition: all 0.12s; }
        .back-btn:hover { background: rgba(255,255,255,0.12); }
        .timeline-item:last-child .timeline-line { display: none; }
      `}</style>

      <div className="space-y-5">

        {/* ── Hero Banner ──────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.12]"
            style={{ background: `radial-gradient(circle, ${typeColor}, transparent 70%)` }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          {/* Nav bar */}
          <div className="relative flex items-center justify-between gap-3 px-6 pt-5">
            <Link href="/processos" className="back-btn flex items-center gap-1.5 text-primary-foreground/75 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar a Processos
            </Link>
            <EditProcessModal process={sanitizedProcess as any} isSuperAdmin={isSuperAdmin} />
          </div>

          {/* Process info */}
          <div className="relative px-6 pb-6 pt-4">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center border-2 border-white/20"
                style={{ background: `${typeColor}25` }}
              >
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: typeColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="dash text-white text-2xl font-bold leading-tight">{pt?.name}</h1>
                  <ProcessStatusBadge status={process.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Link
                    href={`/clientes/${client?.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-foreground/75 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 hover:bg-white/20 transition-all dash"
                  >
                    {client?.name}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                  {process.protocol && (
                    <span className="text-xs font-mono text-primary-foreground/70 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 dash">
                      {process.protocol}
                    </span>
                  )}
                  {responsible && (
                    <span className="text-xs text-primary-foreground/70 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 dash">
                      Resp: {responsible.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Mini stats */}
              <div className="hidden sm:flex gap-3 shrink-0">
                <div className="text-center bg-white/10 border border-white/10 rounded-xl px-4 py-2.5">
                  <p className="dash text-xl font-bold text-white">{documents?.length ?? 0}</p>
                  <p className="dash text-[10px] text-primary-foreground/65 mt-0.5">Documentos</p>
                </div>
                {isSuperAdmin && financials?.service_value && (
                  <div className="text-center bg-white/10 border border-white/10 rounded-xl px-4 py-2.5">
                    <p className="dash text-xl font-bold text-white">{formatCurrency(financials.service_value)}</p>
                    <p className="dash text-[10px] text-primary-foreground/65 mt-0.5">Valor</p>
                  </div>
                )}
              </div>
            </div>

            {/* Renewal alert */}
            {(process as any).renewal_date && (
              <div className="mt-4 flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-2.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <p className="text-xs font-medium text-amber-200 dash">
                  Renovação prevista para <span className="font-bold text-amber-100">{formatDate((process as any).renewal_date)}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Content Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left Sidebar ─────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Process details */}
            <div className="anim anim-1 bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 className="dash font-bold text-slate-900 mb-4 text-sm">Detalhes do Processo</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dash text-xs">Tipo</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor }} />
                    <span className="dash font-semibold text-slate-900 text-xs">{pt?.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dash text-xs">Status</span>
                  <ProcessStatusBadge status={process.status} />
                </div>
                {process.protocol && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dash text-xs">Protocolo</span>
                    <span className="dash font-mono text-xs bg-slate-50 px-2 py-1 rounded-lg text-slate-700">{process.protocol}</span>
                  </div>
                )}
                {responsible && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dash text-xs">Responsável</span>
                    <span className="dash font-medium text-slate-900 text-xs">{responsible.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dash text-xs">Abertura</span>
                  <span className="dash text-slate-700 text-xs">{formatDate(process.created_at)}</span>
                </div>
                {process.jurisdiction_state && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dash text-xs">UF da análise</span>
                    <span className="dash font-semibold text-slate-700 text-xs">{process.jurisdiction_state}</span>
                  </div>
                )}
                {process.vehicle_condition && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dash text-xs">Veículo</span>
                    <span className="dash font-semibold text-slate-700 text-xs">{process.vehicle_condition === 'zero_km' ? 'Zero-quilômetro' : 'Usado'}</span>
                  </div>
                )}
                {process.completed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dash text-xs">Conclusão</span>
                    <span className="dash text-slate-700 text-xs">{formatDate(process.completed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Observations */}
            {process.observations && (
              <div className="anim anim-2 bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h2 className="dash font-bold text-slate-900 mb-3 text-sm">Observações</h2>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed dash">{process.observations}</p>
              </div>
            )}

            {/* Custom fields */}
            {customFields.length > 0 && (
              <div className="anim anim-2 bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${typeColor}18` }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor }} />
                  </div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Campos Específicos</h2>
                </div>
                <div className="space-y-3">
                  {customFields.sort((a: any, b: any) => a.sort_order - b.sort_order).map((field: any) => (
                    <div key={field.id} className="flex justify-between items-start gap-3 text-sm">
                      <span className="text-slate-400 dash text-xs shrink-0">{field.field_label}</span>
                      <span className="dash font-semibold text-slate-900 text-xs text-right">
                        {field.field_type === 'boolean'
                          ? field.field_value === 'true' ? 'Sim' : 'Não'
                          : field.field_type === 'currency' && field.field_value
                            ? formatCurrency(parseFloat(field.field_value))
                            : field.field_type === 'date' && field.field_value
                              ? formatDate(field.field_value)
                              : field.field_type === 'select' && field.field_value
                                ? getCustomFieldOptionLabel(pt?.slug ?? '', field.field_name, field.field_value)
                                : field.field_value ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial */}
            {isSuperAdmin && financials && (
              <div className="anim anim-3 bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Financeiro</h2>
                </div>
                {financials.service_value && (
                  <div className="text-center py-3 mb-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="dash text-2xl font-bold text-emerald-700">{formatCurrency(financials.service_value)}</p>
                    <p className="text-xs text-emerald-500 dash mt-0.5">Valor do serviço</p>
                  </div>
                )}
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dash text-xs">Pagamento</span>
                    <PaymentStatusBadge status={financials.payment_status} />
                  </div>
                  {financials.payment_method && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dash text-xs">Forma</span>
                      <span className="dash font-medium text-slate-900 text-xs capitalize">{financials.payment_method}</span>
                    </div>
                  )}
                  {financials.expected_payment_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dash text-xs">Data prevista</span>
                      <span className="dash text-slate-700 text-xs">{formatDate(financials.expected_payment_date)}</span>
                    </div>
                  )}
                  {financials.financial_notes && (
                    <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-50 dash leading-relaxed">{financials.financial_notes}</p>
                  )}
                  {financials.finance_entry_id && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-50">
                      <Link2 className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="text-[10px] text-blue-500 dash">Vinculado ao Módulo Financeiro</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {isEligibilityProcess(pt?.slug ?? '') && displayedEligibilityStatus && profile?.id && (
              <EligibilityReviewPanel
                processId={process.id}
                reviewerId={profile.id}
                status={displayedEligibilityStatus}
                analysis={eligibilityAnalysis}
                reviewNotes={process.eligibility_review_notes}
                reviewedAt={process.eligibility_reviewed_at}
              />
            )}

            {pt?.slug === 'processo_ipva' && (process.jurisdiction_state || client?.state)?.toUpperCase() === 'SP' && (
              <div className="anim anim-1 overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2.5 border-b border-slate-50 px-5 py-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pink-50">
                    <ListChecks className="h-3.5 w-3.5 text-pink-600" />
                  </div>
                  <div>
                    <h2 className="dash font-bold text-slate-900">Workflow IMESC/IPVA</h2>
                    <p className="dash mt-0.5 text-xs text-slate-400">Etapas, prazos, documentos e fontes oficiais sincronizados</p>
                  </div>
                </div>
                <IpvaStagesPanel
                  processId={process.id}
                  stages={processStages}
                  documents={processDocuments}
                  legalRules={(legalRules ?? []) as LegalRuleVersion[]}
                />
              </div>
            )}

            {/* CNH Especial stages */}
            {pt?.slug === 'cnh_especial' && (
              <div className="anim anim-1 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="dash font-bold text-slate-900">Etapas CNH Especial</h2>
                    <p className="text-xs text-slate-400 mt-0.5 dash">
                      {stages && stages.length > 0
                        ? `${stages.length} etapa${stages.length !== 1 ? 's' : ''} — clique para expandir e editar`
                        : 'Nenhuma etapa criada ainda'
                      }
                    </p>
                  </div>
                  {stages && stages.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg dash">
                      {stages.filter((s: any) => ['concluido', 'aprovado'].includes(s.status)).length}/{stages.length} concluídas
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {stages && stages.length > 0 ? (
                    <CnhStagesPanel
                      stages={processStages}
                      processId={process.id}
                      clientId={client?.id ?? ''}
                      clientName={client?.name ?? ''}
                      responsibleUserId={(responsible as any)?.id ?? null}
                    />
                  ) : (
                    <InitCnhStagesButton
                      processId={process.id}
                      clientId={client?.id ?? ''}
                    />
                  )}
                </div>
              </div>
            )}

            {hasOperationalWorkflow(pt?.slug ?? '') && (
              <div className="anim anim-1 overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2.5 border-b border-slate-50 px-5 py-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50">
                    <ListChecks className="h-3.5 w-3.5 text-sky-600" />
                  </div>
                  <div>
                    <h2 className="dash font-bold text-slate-900">Etapas operacionais</h2>
                    <p className="dash mt-0.5 text-xs text-slate-400">Checklist, protocolos, decisões e comunicação do processo</p>
                  </div>
                </div>
                <OperationalStagesPanel
                  processId={process.id}
                  processTypeSlug={pt.slug}
                  stages={processStages}
                  jurisdictionState={process.jurisdiction_state || client?.state || null}
                />
              </div>
            )}

            {/* Documents */}
            <div className="anim anim-2 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="px-5 py-4 border-b border-slate-50">
                <h2 className="dash font-bold text-slate-900">Documentos</h2>
                <p className="text-xs text-slate-400 mt-0.5 dash">{documents?.length ?? 0} arquivo{documents?.length !== 1 ? 's' : ''} enviado{documents?.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4">
                <DocumentUploader processId={process.id} clientId={client?.id} stages={processStages} />
              </div>
              {documents && documents.length > 0 && (
                <div className="border-t border-slate-50">
                  {(documents as any[]).map(doc => (
                    <div key={doc.id} className="doc-row flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dash text-sm font-semibold text-blue-600 hover:text-blue-700 truncate block"
                        >
                          {doc.file_name}
                        </a>
                        <p className="text-xs text-slate-400 dash">{formatDate(doc.created_at)}</p>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dash shrink-0">
                        Abrir <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History Timeline */}
            <div className="anim anim-3 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="px-5 py-4 border-b border-slate-50">
                <h2 className="dash font-bold text-slate-900">Histórico</h2>
                <p className="text-xs text-slate-400 mt-0.5 dash">{history?.length ?? 0} evento{history?.length !== 1 ? 's' : ''}</p>
              </div>

              {!history || history.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 dash">Sem histórico</p>
                </div>
              ) : (
                <div className="p-5">
                  <div className="relative">
                    {(history as any[]).map((h, idx) => (
                      <div key={h.id} className="timeline-item relative flex gap-4 pb-5 last:pb-0">
                        {/* Line */}
                        {idx < history.length - 1 && (
                          <div className="timeline-line absolute left-4 top-8 bottom-0 w-px bg-slate-100" />
                        )}
                        {/* Dot */}
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 relative z-10">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm font-semibold text-slate-900 dash">
                            {HISTORY_ACTION_LABELS[h.action_type] ?? h.action_type}
                          </p>
                          {h.old_value && h.new_value && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg dash">{h.old_value}</span>
                              <ArrowUpRight className="w-3 h-3 text-slate-300" />
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg dash">{h.new_value}</span>
                            </div>
                          )}
                          {h.note && <p className="text-xs text-slate-500 mt-1 dash">{h.note}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-slate-400 dash">{formatDateTime(h.created_at)}</span>
                            {h.changer?.name && (
                              <span className="text-[11px] text-slate-400 dash">· {h.changer.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calendar events */}
            {events && events.length > 0 && (
              <div className="anim anim-4 bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="px-5 py-4 border-b border-slate-50">
                  <h2 className="dash font-bold text-slate-900">Eventos Vinculados</h2>
                </div>
                <div>
                  {(events as any[]).map(ev => {
                    const evDate = new Date(ev.event_date + 'T00:00:00')
                    const day = evDate.getDate()
                    const month = evDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
                    const nowStr = new Date().toISOString().split('T')[0]
                    const isToday = ev.event_date === nowStr
                    return (
                      <div key={ev.id} className="flex items-start gap-4 px-5 py-4 border-b border-slate-50 last:border-0">
                        <div
                          className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0"
                          style={{ background: isToday ? 'linear-gradient(135deg, #6B3019, #A14F2A)' : 'rgba(161,79,42,0.08)' }}
                        >
                          <span className="text-[9px] font-bold uppercase leading-none" style={{ color: isToday ? '#E8B99F' : '#A14F2A' }}>{month}</span>
                          <span className="text-sm font-bold leading-tight mt-0.5" style={{ color: isToday ? '#fff' : '#6B3019' }}>{day}</span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="dash font-semibold text-slate-900 text-sm">{ev.title}</p>
                          {ev.description && <p className="text-xs text-slate-500 dash mt-0.5">{ev.description}</p>}
                          {isToday && <span className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 mt-1 dash">Hoje</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
