'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { PROCESS_TYPE_CUSTOM_FIELDS, PROCESS_STATUS_LABELS } from '@/lib/utils'
import { maskCurrency, parseCurrency } from '@/lib/masks'
import { syncProcessFinancial } from '@/lib/sync-process-financial'
import { createCnhProcessStages } from '@/lib/cnh-stages'
import {
  analyzeEligibility,
  isEligibilityProcess,
  type ImescSeverity,
  type ImescStatus,
  type SefazIpvaStatus,
} from '@/lib/eligibility'
import { EligibilityAnalysisCard } from '@/components/processos/eligibility-analysis-card'
import type { VehicleCondition } from '@/types/database'
import Link from 'next/link'
import {
  ArrowLeft, TrendingUp, Link2, Check,
  Layers, Settings, DollarSign, AlertCircle, ChevronRight,
} from 'lucide-react'

const STATUS_OPTIONS = Object.entries(PROCESS_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
]

const sectionCard = { background: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } as const

function NovoProcessoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preClientId  = searchParams.get('client_id') ?? ''
  const preTypeId    = searchParams.get('type_id')   ?? ''
  const preTypeSlug  = searchParams.get('type')      ?? ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [processTypes, setProcessTypes] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedTypeSlug, setSelectedTypeSlug] = useState('')
  const [selectedTypeName, setSelectedTypeName] = useState('')
  const [selectedTypeColor, setSelectedTypeColor] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    client_id: preClientId,
    process_type_id: preTypeId,
    protocol: '',
    status: 'aberto',
    responsible_user_id: '',
    observations: '',
    service_value: '',
    payment_method: '',
    payment_status: 'pending',
    expected_payment_date: '',
    financial_notes: '',
    jurisdiction_state: '',
    vehicle_condition: '' as VehicleCondition | '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('process_types').select('*').eq('is_active', true).neq('slug', 'resumo').order('name'),
      supabase.from('clients').select('id, name, state, client_type, disability_type, disability_types, disability_severity, cnh_status, cnh_restrictions, medical_assessment_status, requires_adapted_vehicle, requires_practical_exam, has_medical_report, authorized_drivers').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, name').in('role', ['admin', 'analista', 'super_admin']).order('name'),
      supabase.auth.getUser(),
    ]).then(async ([{ data: pt }, { data: cl }, { data: pf }, { data: { user } }]) => {
      setProcessTypes(pt ?? [])
      setClients(cl ?? [])
      setProfiles(pf ?? [])
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
        setIsSuperAdmin(prof?.role === 'super_admin')
      }
      setDataLoaded(true)

      // Pre-select client
      if (preClientId && cl) {
        const found = cl.find((c: any) => c.id === preClientId)
        if (found?.state) setForm(prev => ({ ...prev, jurisdiction_state: prev.jurisdiction_state || found.state }))
      }

      // Pre-select type from URL param (type_id=UUID or type=slug)
      const typeToFind = preTypeId
        ? (pt ?? []).find((t: any) => t.id === preTypeId)
        : preTypeSlug
        ? (pt ?? []).find((t: any) => t.slug === preTypeSlug)
        : null
      if (typeToFind) {
        setForm(prev => ({ ...prev, process_type_id: typeToFind.id }))
        setSelectedTypeSlug(typeToFind.slug)
        setSelectedTypeName(typeToFind.name)
        setSelectedTypeColor(typeToFind.color ?? '#3B82F6')
        setCustomFieldValues({})
      }
    })
  }, [preClientId, preTypeId, preTypeSlug])

  const handleClientChange = (clientId: string) => {
    const found = clients.find((c: any) => c.id === clientId)
    setForm(prev => ({
      ...prev,
      client_id: clientId,
      jurisdiction_state: found?.state ?? '',
    }))
  }

  const handleTypeSelect = (typeId: string) => {
    const type = processTypes.find(t => t.id === typeId)
    if (!type) return
    setForm(prev => ({ ...prev, process_type_id: typeId }))
    setSelectedTypeSlug(type.slug)
    setSelectedTypeName(type.name)
    setSelectedTypeColor(type.color ?? '#3B82F6')
    setCustomFieldValues({})
  }

  const clearType = () => {
    setForm(prev => ({ ...prev, process_type_id: '' }))
    setSelectedTypeSlug('')
    setSelectedTypeName('')
    setSelectedTypeColor('')
    setCustomFieldValues({})
  }

  const customFields = PROCESS_TYPE_CUSTOM_FIELDS[selectedTypeSlug] ?? []

  const selectedClient = form.client_id
    ? clients.find((client: any) => client.id === form.client_id)
    : null
  const eligibilityAnalysis = selectedClient && isEligibilityProcess(selectedTypeSlug)
    ? analyzeEligibility({
        processTypeSlug: selectedTypeSlug,
        state: form.jurisdiction_state || selectedClient.state,
        vehicleCondition: form.vehicle_condition || null,
        clientType: selectedClient.client_type,
        disabilityType: selectedClient.disability_type,
        disabilityTypes: selectedClient.disability_types,
        disabilitySeverity: selectedClient.disability_severity,
        cnhStatus: selectedClient.cnh_status,
        cnhRestrictions: selectedClient.cnh_restrictions,
        medicalAssessmentStatus: selectedClient.medical_assessment_status,
        requiresAdaptedVehicle: selectedClient.requires_adapted_vehicle,
        requiresPracticalExam: selectedClient.requires_practical_exam,
        hasMedicalReport: selectedClient.has_medical_report,
        authorizedDrivers: selectedClient.authorized_drivers,
        imescStatus: (customFieldValues.imesc_status || null) as ImescStatus | null,
        imescReportIssuedAt: customFieldValues.imesc_data_laudo || null,
        imescSeverity: (customFieldValues.imesc_grau || null) as ImescSeverity | null,
        sefazIpvaStatus: (customFieldValues.sefaz_ipva_status || null) as SefazIpvaStatus | null,
        sefazDecisionNotifiedAt: customFieldValues.sefaz_data_ciencia || null,
        ipvaAppealFiledAt: customFieldValues.recurso_ipva_protocolado_em || null,
        ipvaAppealProtocol: customFieldValues.recurso_ipva_protocolo || null,
      })
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id || !form.process_type_id) {
      setError('Selecione o cliente e o tipo de processo.')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const selectedProcessType = processTypes.find(t => t.id === form.process_type_id)

    const { data: process, error: procErr } = await supabase.from('processes').insert({
      client_id: form.client_id,
      process_type_id: form.process_type_id,
      protocol: form.protocol || null,
      status: form.status as any,
      responsible_user_id: form.responsible_user_id || null,
      observations: form.observations || null,
      jurisdiction_state: form.jurisdiction_state || selectedClient?.state || null,
      vehicle_condition: selectedTypeSlug === 'cnh_especial' ? null : form.vehicle_condition || null,
      eligibility_status: eligibilityAnalysis?.status ?? null,
      eligibility_analysis: eligibilityAnalysis ?? null,
    }).select().single()

    if (procErr || !process) {
      setError('Erro ao criar processo: ' + (procErr?.message ?? 'Erro desconhecido'))
      setLoading(false)
      return
    }

    const customFieldInserts = customFields
      .filter(f => customFieldValues[f.field_name])
      .map((f, idx) => ({
        process_id: process.id,
        field_name: f.field_name,
        field_label: f.field_label,
        field_type: f.field_type,
        field_value: customFieldValues[f.field_name],
        sort_order: idx,
      }))

    if (customFieldInserts.length > 0) {
      const { error: customFieldsError } = await supabase.from('process_custom_fields').insert(customFieldInserts)
      if (customFieldsError) {
        setError('Processo criado, mas não foi possível salvar os campos específicos: ' + customFieldsError.message)
        setLoading(false)
        return
      }
    }

    if (
      selectedTypeSlug === 'processo_ipva' &&
      (form.jurisdiction_state || selectedClient?.state)?.toUpperCase() === 'SP'
    ) {
      const workflowResponse = await fetch(`/api/processos/${process.id}/workflow`, { method: 'POST' })
      const workflowResult = await workflowResponse.json()
      if (!workflowResponse.ok) {
        setError('Processo criado, mas não foi possível inicializar o workflow IMESC/IPVA: ' + (workflowResult.error ?? 'Erro desconhecido'))
        setLoading(false)
        return
      }
    }

    if (isSuperAdmin && (form.service_value || form.payment_method || form.financial_notes)) {
      const serviceValue = form.service_value ? parseCurrency(form.service_value) : null
      const financeEntryId = serviceValue ? await syncProcessFinancial(supabase, {
        processId: process.id,
        clientId: form.client_id,
        processTypeName: selectedProcessType?.name ?? 'Processo',
        processTypeSlug: selectedProcessType?.slug ?? '',
        serviceValue,
        paymentStatus: form.payment_status,
        expectedPaymentDate: form.expected_payment_date || null,
      }) : null

      await supabase.from('process_financials').insert({
        process_id: process.id,
        service_value: serviceValue,
        payment_method: form.payment_method as any || null,
        payment_status: form.payment_status as any,
        expected_payment_date: form.expected_payment_date || null,
        financial_notes: form.financial_notes || null,
        finance_entry_id: financeEntryId,
      })
    }

    await supabase.from('process_history').insert({
      process_id: process.id,
      action_type: 'created',
      new_value: form.status,
      note: 'Processo criado',
    })

    // CNH Especial: populate process stages based on client's disability
    if (selectedTypeSlug === 'cnh_especial' && selectedClient?.client_type === 'condutor') {
      try {
        await createCnhProcessStages(supabase, process.id, {
          clientType: selectedClient.client_type,
          medicalAssessmentStatus: selectedClient.medical_assessment_status,
          requiresPracticalExam: selectedClient.requires_practical_exam,
        })
      } catch (stageErr: unknown) {
        // Process created; stages failed — still redirect but warn
        console.error('cnh-stages error:', stageErr)
        const message = stageErr instanceof Error ? stageErr.message : 'Erro desconhecido'
        setError('Processo criado, mas houve um erro ao criar as etapas: ' + message)
        setLoading(false)
        return
      }
    }

    router.push(`/processos/${process.id}`)
  }

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const profileOptions = profiles.map(p => ({ value: p.id, label: p.name }))

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
        .anim-5 { animation-delay: 0.25s; }
        .type-card { transition: all 0.15s; }
        .type-card:hover { border-color: #93C5FD; background: #EFF6FF; transform: translateY(-1px); }
        .type-card-selected { border-color: #3B82F6 !important; background: #EFF6FF !important; }
      `}</style>

      <div className="max-w-2xl space-y-5">

        {/* ── Banner ─────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative p-6">
            <Link href="/processos" className="inline-flex items-center gap-1.5 text-primary-foreground/75 hover:text-white text-xs font-medium mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar a Processos
            </Link>
            <h1 className="dash text-white text-2xl font-bold">Novo Processo</h1>
            <p className="dash text-primary-foreground/65 text-sm mt-1">
              {selectedTypeName
                ? <>Criando: <span className="text-white font-semibold">{selectedTypeName}</span></>
                : 'Selecione o tipo de processo para começar'
              }
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Tipo de Processo ─────────────────────────────────── */}
          <div className="anim anim-1 rounded-2xl p-5" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex-1">
                <h2 className="dash font-bold text-slate-900 text-sm">Tipo de Processo</h2>
                <p className="text-[11px] text-slate-400 dash">
                  {selectedTypeName ? 'Tipo selecionado — clique em alterar para mudar' : 'Selecione o tipo para continuar *'}
                </p>
              </div>
              {selectedTypeName && (
                <button
                  type="button"
                  onClick={clearType}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dash px-3 py-1.5 bg-blue-50 rounded-lg"
                >
                  Alterar
                </button>
              )}
            </div>

            {/* Type selected: show confirmation card */}
            {selectedTypeName ? (
              <div
                className="flex items-center gap-3 p-4 rounded-xl border-2"
                style={{ borderColor: selectedTypeColor, background: `${selectedTypeColor}0D` }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${selectedTypeColor}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTypeColor }} />
                </div>
                <div className="flex-1">
                  <p className="dash font-bold text-slate-900">{selectedTypeName}</p>
                  {customFields.length > 0 && (
                    <p className="text-[11px] text-slate-500 dash mt-0.5">{customFields.length} campo{customFields.length !== 1 ? 's' : ''} específico{customFields.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <Check className="w-5 h-5 shrink-0" style={{ color: selectedTypeColor }} />
              </div>
            ) : (
              /* Type not selected: show card grid */
              dataLoaded ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {processTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleTypeSelect(type.id)}
                      className="type-card flex items-center gap-2.5 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left cursor-pointer"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: type.color ?? '#3B82F6' }}
                      />
                      <span className="dash text-xs font-semibold text-slate-700 truncate">{type.name}</span>
                      <ChevronRight className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              )
            )}
          </div>

          {/* ── Informações Principais ───────────────────────────── */}
          <div className="anim anim-2 rounded-2xl p-5" style={sectionCard}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h2 className="dash font-bold text-slate-900 text-sm">Informações do Processo</h2>
                <p className="text-[11px] text-slate-400 dash">Cliente, status e responsável</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Select
                  label="Cliente *"
                  options={clientOptions}
                  placeholder={dataLoaded ? 'Selecione o cliente' : 'Carregando...'}
                  value={form.client_id}
                  onChange={e => handleClientChange(e.target.value)}
                  required
                />
                {eligibilityAnalysis && (
                  <EligibilityAnalysisCard
                    analysis={eligibilityAnalysis}
                    state={form.jurisdiction_state}
                    vehicleCondition={form.vehicle_condition}
                    onStateChange={jurisdiction_state => setForm(prev => ({ ...prev, jurisdiction_state }))}
                    onVehicleConditionChange={vehicle_condition => setForm(prev => ({ ...prev, vehicle_condition }))}
                    showState={['processo_icms', 'processo_ipva'].includes(selectedTypeSlug)}
                    showVehicleCondition={selectedTypeSlug !== 'cnh_especial'}
                  />
                )}
              </div>
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
              />
              <Input
                label="Protocolo"
                value={form.protocol}
                onChange={e => setForm(prev => ({ ...prev, protocol: e.target.value }))}
                placeholder="Número do protocolo"
              />
              <div className="sm:col-span-2">
                <Select
                  label="Responsável"
                  options={profileOptions}
                  placeholder="Selecione o responsável"
                  value={form.responsible_user_id}
                  onChange={e => setForm(prev => ({ ...prev, responsible_user_id: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Observações"
                  value={form.observations}
                  onChange={e => setForm(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Observações sobre o processo..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* ── Campos Específicos ───────────────────────────────── */}
          {customFields.length > 0 && (
            <div className="anim anim-3 rounded-2xl p-5" style={sectionCard}>
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${selectedTypeColor}18` }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTypeColor }} />
                </div>
                <div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Campos Específicos</h2>
                  <p className="text-[11px] text-slate-400 dash">{selectedTypeName}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customFields.map(field => {
                  return (
                    <div key={field.field_name}>
                      {field.field_type === 'boolean' ? (
                        <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <input
                            type="checkbox"
                            checked={customFieldValues[field.field_name] === 'true'}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.checked ? 'true' : 'false' }))}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-sm font-medium text-slate-700 dash">{field.field_label}</span>
                        </label>
                      ) : field.field_type === 'select' ? (
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-slate-700 dash">{field.field_label}</label>
                          <select
                            value={customFieldValues[field.field_name] ?? ''}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                            className="block w-full rounded-xl border border-border px-3 py-2 text-sm bg-muted focus:bg-card focus:border-primary focus:outline-none transition-all dash"
                          >
                            <option value="">Selecione</option>
                            {(field.options ?? []).map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          {field.help_text && <p className="text-[10px] leading-relaxed text-slate-400">{field.help_text}</p>}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-slate-700 dash">{field.field_label}</label>
                          </div>
                          <input
                            type={field.field_type === 'date' ? 'date' : field.field_type === 'number' || field.field_type === 'currency' ? 'number' : 'text'}
                            value={customFieldValues[field.field_name] ?? ''}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                            placeholder={field.field_type === 'currency' ? '0,00' : ''}
                            step={field.field_type === 'currency' ? '0.01' : undefined}
                            className="block w-full rounded-xl border border-border px-3 py-2 text-sm bg-muted focus:bg-card focus:border-primary focus:outline-none transition-all dash"
                          />
                          {field.help_text && <p className="text-[10px] leading-relaxed text-slate-400">{field.help_text}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Financeiro ───────────────────────────────────────── */}
          {isSuperAdmin && <div className="anim anim-4 rounded-2xl overflow-hidden" style={sectionCard}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Financeiro</h2>
                  <p className="text-[11px] text-slate-400 dash">Opcional — preencha se houver cobrança</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg dash">
                <TrendingUp className="w-3 h-3" /> Módulo Financeiro
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dash">Valor do serviço</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.service_value}
                  onChange={e => setForm(prev => ({ ...prev, service_value: maskCurrency(e.target.value) }))}
                  placeholder="R$ 0,00"
                  className="block w-full rounded-xl border border-border px-4 py-3 text-base font-bold text-foreground placeholder:text-muted-foreground placeholder:font-normal bg-muted focus:bg-card focus:border-primary focus:outline-none transition-all dash"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Forma de pagamento"
                  options={PAYMENT_OPTIONS}
                  placeholder="Selecione"
                  value={form.payment_method}
                  onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                />
                <Input
                  label="Data prevista de pagamento"
                  type="date"
                  value={form.expected_payment_date}
                  onChange={e => setForm(prev => ({ ...prev, expected_payment_date: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dash">Status do pagamento</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'pending',        label: 'Pendente',  finance: 'Previsto',   bg: '#F8FAFC', border: '#CBD5E1', active: '#1E293B', color: '#475569' },
                    { value: 'partially_paid', label: 'Parcial',   finance: 'Previsto',   bg: '#FFFBEB', border: '#FDE68A', active: '#B45309', color: '#B45309' },
                    { value: 'paid',           label: 'Pago',      finance: 'Confirmado', bg: '#ECFDF5', border: '#A7F3D0', active: '#065F46', color: '#065F46' },
                    { value: 'overdue',        label: 'Em atraso', finance: 'Em atraso',  bg: '#FEF2F2', border: '#FECACA', active: '#991B1B', color: '#991B1B' },
                  ].map(opt => {
                    const isActive = form.payment_status === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, payment_status: opt.value }))}
                        className="flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border text-xs font-semibold transition-all dash"
                        style={isActive
                          ? { background: opt.bg, borderColor: opt.active, color: opt.active, boxShadow: `0 0 0 2px ${opt.active}30` }
                          : { background: '#fff', borderColor: '#E2E8F0', color: '#94A3B8' }
                        }
                      >
                        <span className="font-bold">{opt.label}</span>
                        {isActive && (
                          <span className="flex items-center gap-0.5 text-[10px] opacity-70">
                            <Link2 className="w-2.5 h-2.5" />{opt.finance}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Textarea
                label="Notas financeiras"
                value={form.financial_notes}
                onChange={e => setForm(prev => ({ ...prev, financial_notes: e.target.value }))}
                rows={2}
                placeholder="Observações sobre pagamento, parcelamento..."
              />

              {form.service_value && parseCurrency(form.service_value) > 0 && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dash">
                    <span className="font-bold">{form.service_value}</span> será registrado como{' '}
                    <span className="font-bold">receita</span> no Módulo Financeiro
                    {form.payment_status === 'paid' ? ' com status Confirmado' : ' com status Previsto'}.
                  </p>
                </div>
              )}
            </div>
          </div>}

          {/* ── Erro ─────────────────────────────────────────────── */}
          {error && (
            <div className="anim flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dash">{error}</p>
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="anim anim-5 flex gap-3 pb-2">
            <Button type="submit" loading={loading} size="md">Criar Processo</Button>
            <Link href="/processos"><Button variant="outline" type="button" size="md">Cancelar</Button></Link>
          </div>
        </form>
      </div>
    </>
  )
}

export default function NovoProcessoPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl space-y-4 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    }>
      <NovoProcessoForm />
    </Suspense>
  )
}
