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
import { getCnhStageTemplates } from '@/lib/cnh-stages'
import { buildOperationalStageRows } from '@/lib/operational-workflows'
import { applyStartingStage } from '@/lib/process-start-stage'
import type { Client, ClientVehicle, ProcessType, Profile, VehicleCondition } from '@/types/database'
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

interface ActiveProcessSummary {
  id: string
  client_id: string
  process_type_id: string
  protocol: string | null
  status: string
  vehicle_id: string | null
}

function NovoProcessoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preClientId  = searchParams.get('client_id') ?? ''
  const preTypeId    = searchParams.get('type_id')   ?? ''
  const preTypeSlug  = searchParams.get('type')      ?? ''
  const prePlanItemId = searchParams.get('service_plan_item_id') ?? ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [processTypes, setProcessTypes] = useState<ProcessType[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Array<Pick<Profile, 'id' | 'name'>>>([])
  const [activeProcesses, setActiveProcesses] = useState<ActiveProcessSummary[]>([])
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([])
  const [selectedTypeSlug, setSelectedTypeSlug] = useState('')
  const [selectedTypeName, setSelectedTypeName] = useState('')
  const [selectedTypeColor, setSelectedTypeColor] = useState('')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [servicePlanItem, setServicePlanItem] = useState<{
    id: string
    engagement_id: string
    process_type_id: string
    sort_order: number
  } | null>(null)

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
    vehicle_id: '',
    start_stage_key: '',
  })

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('process_types')
        .select('*')
        .eq('is_active', true)
        .eq('accepts_new_processes', true)
        .neq('slug', 'resumo')
        .order('sort_order')
        .order('name'),
      supabase.from('clients').select('id, name, state, client_type, disability_type, disability_types, disability_severity, cnh_status, cnh_restrictions, medical_assessment_status, requires_adapted_vehicle, requires_practical_exam, has_medical_report, authorized_drivers').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, name').in('role', ['admin', 'analista', 'super_admin']).order('name'),
      supabase.from('processes')
        .select('id, client_id, process_type_id, protocol, status, vehicle_id')
        .not('status', 'in', '(concluido,arquivado,cancelado)')
        .order('created_at'),
      supabase.auth.getUser(),
      prePlanItemId
        ? supabase
            .from('client_service_plan_items')
            .select('id, engagement_id, process_type_id, sort_order, status, process_id')
            .eq('id', prePlanItemId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('client_vehicles').select('*').eq('is_active', true).order('created_at', { ascending: false }),
    ]).then(async ([{ data: pt }, { data: cl }, { data: pf }, { data: active }, { data: { user } }, { data: planItem }, { data: vehicleRows }]) => {
      const processTypeRows = (pt ?? []) as ProcessType[]
      const clientRows = (cl ?? []) as Client[]
      setProcessTypes(processTypeRows)
      setClients(clientRows)
      setProfiles((pf ?? []) as Array<Pick<Profile, 'id' | 'name'>>)
      setActiveProcesses((active ?? []) as ActiveProcessSummary[])
      setVehicles((vehicleRows ?? []) as ClientVehicle[])
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
        setIsSuperAdmin(prof?.role === 'super_admin')
      }
      setDataLoaded(true)

      // Pre-select client
      if (preClientId) {
        const found = clientRows.find(client => client.id === preClientId)
        const foundState = found?.state
        if (foundState) {
          setForm(prev => ({
            ...prev,
            jurisdiction_state: prev.jurisdiction_state || foundState,
          }))
        }
      }

      // Pre-select type from URL param (type_id=UUID or type=slug)
      const typeToFind = preTypeId
        ? processTypeRows.find(type => type.id === preTypeId)
        : preTypeSlug
        ? processTypeRows.find(type => type.slug === preTypeSlug)
        : null
      if (typeToFind) {
        setForm(prev => ({
          ...prev,
          process_type_id: typeToFind.id,
          vehicle_condition: ['processo_ipi', 'processo_icms'].includes(typeToFind.slug)
            ? 'zero_km'
            : prev.vehicle_condition,
        }))
        setSelectedTypeSlug(typeToFind.slug)
        setSelectedTypeName(typeToFind.name)
        setSelectedTypeColor(typeToFind.color ?? '#3B82F6')
        setCustomFieldValues({})
      }

      if (prePlanItemId) {
        if (!planItem || planItem.status !== 'pronto_para_iniciar' || planItem.process_id) {
          setError('Este servico nao esta mais disponivel para iniciar.')
          return
        }
        const { data: engagement } = await supabase
          .from('client_service_engagements')
          .select('client_id')
          .eq('id', planItem.engagement_id)
          .maybeSingle()
        if (
          !engagement
          || engagement.client_id !== preClientId
          || !typeToFind
          || typeToFind.id !== planItem.process_type_id
        ) {
          setError('O servico selecionado nao pertence a este cliente ou tipo de processo.')
          return
        }
        setServicePlanItem({
          id: planItem.id,
          engagement_id: planItem.engagement_id,
          process_type_id: planItem.process_type_id,
          sort_order: planItem.sort_order,
        })
        setForm(prev => ({ ...prev, status: 'em_andamento' }))
      }
    })
  }, [preClientId, prePlanItemId, preTypeId, preTypeSlug])

  const handleClientChange = (clientId: string) => {
    const found = clients.find(client => client.id === clientId)
    setForm(prev => ({
      ...prev,
      client_id: clientId,
      jurisdiction_state: found?.state ?? '',
      vehicle_id: '',
      vehicle_condition: ['processo_ipi', 'processo_icms'].includes(selectedTypeSlug)
        ? 'zero_km'
        : '',
      start_stage_key: '',
    }))
  }

  const handleTypeSelect = (typeId: string) => {
    const type = processTypes.find(t => t.id === typeId)
    if (!type) return
    setForm(prev => ({
      ...prev,
      process_type_id: typeId,
      vehicle_condition: ['processo_ipi', 'processo_icms'].includes(type.slug)
        ? 'zero_km'
        : '',
      start_stage_key: '',
    }))
    setSelectedTypeSlug(type.slug)
    setSelectedTypeName(type.name)
    setSelectedTypeColor(type.color ?? '#3B82F6')
    setCustomFieldValues({})
  }

  const clearType = () => {
    if (prePlanItemId) return
    setForm(prev => ({ ...prev, process_type_id: '', start_stage_key: '' }))
    setSelectedTypeSlug('')
    setSelectedTypeName('')
    setSelectedTypeColor('')
    setCustomFieldValues({})
  }

  const customFields = PROCESS_TYPE_CUSTOM_FIELDS[selectedTypeSlug] ?? []

  const selectedClient = form.client_id
    ? clients.find(client => client.id === form.client_id)
    : null
  const existingActiveProcess = form.client_id && form.process_type_id
    ? activeProcesses.find(process => (
        process.client_id === form.client_id
        && process.process_type_id === form.process_type_id
        && (
          selectedTypeSlug !== 'processo_ipva'
          || process.vehicle_id === form.vehicle_id
        )
      ))
    : null
  const clientVehicles = vehicles.filter(vehicle => (
    vehicle.client_id === form.client_id
    && (
      !['processo_ipi', 'processo_icms'].includes(selectedTypeSlug)
      || vehicle.vehicle_condition === 'zero_km'
    )
  ))
  const selectedVehicle = form.vehicle_id
    ? clientVehicles.find(vehicle => vehicle.id === form.vehicle_id) ?? null
    : null
  const startStageOptions = selectedTypeSlug === 'cnh_especial'
    ? selectedClient
      ? (getCnhStageTemplates({
          clientType: selectedClient.client_type,
          medicalAssessmentStatus: selectedClient.medical_assessment_status,
          requiresPracticalExam: null,
        }) ?? [])
          .filter(stage => stage.status !== 'nao_aplicavel')
          .map(stage => ({ value: stage.stage_key, label: stage.label }))
      : []
    : selectedTypeSlug
      ? buildOperationalStageRows('', selectedTypeSlug)
          .filter(stage => stage.status !== 'nao_aplicavel')
          .map(stage => ({ value: stage.stage_key, label: stage.label }))
      : []
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id || !form.process_type_id) {
      setError('Selecione o cliente e o tipo de processo.')
      return
    }
    if (!selectedClient) {
      setError('O cliente selecionado não está mais disponível.')
      return
    }
    if (existingActiveProcess) {
      setError('Este cliente já possui um processo ativo deste tipo.')
      return
    }
    if (selectedTypeSlug === 'cnh_especial' && selectedClient?.client_type !== 'condutor') {
      setError('A CNH Especial exige que o cliente esteja cadastrado como condutor.')
      return
    }
    if (prePlanItemId && !servicePlanItem) {
      setError('O item do plano ainda nao foi validado. Recarregue a pagina antes de continuar.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const customFieldInserts = customFields
      .filter(f => customFieldValues[f.field_name])
      .map((f, idx) => ({
        field_name: f.field_name,
        field_label: f.field_label,
        field_type: f.field_type,
        field_value: customFieldValues[f.field_name],
        sort_order: idx,
        client_visible: false,
      }))
    const cnhStages = selectedTypeSlug === 'cnh_especial'
      ? getCnhStageTemplates({
          clientType: selectedClient.client_type,
          medicalAssessmentStatus: selectedClient.medical_assessment_status,
          requiresPracticalExam: null,
        })
      : null
    const baseStageRows = cnhStages
      ? cnhStages.map(stage => ({
          stage_key: stage.stage_key,
          label: stage.label,
          sort_order: stage.sort_order,
          status: stage.status ?? 'pendente',
          data: stage.data,
        }))
      : buildOperationalStageRows('', selectedTypeSlug).map(({ process_id: _processId, ...stage }) => {
          void _processId
          return stage
        })
    const stageRows = applyStartingStage(baseStageRows, form.start_stage_key)
    const financial = isSuperAdmin && (form.service_value || form.payment_method || form.financial_notes)
      ? {
          service_value: form.service_value ? parseCurrency(form.service_value) : null,
          payment_method: form.payment_method || null,
          payment_status: form.payment_status,
          expected_payment_date: form.expected_payment_date || null,
          financial_notes: form.financial_notes || null,
        }
      : null

    const { data: processId, error: procErr } = await supabase.rpc('create_process_atomic', {
      p_client_id: form.client_id,
      p_process_type_id: form.process_type_id,
      p_protocol: form.protocol || null,
      p_status: form.start_stage_key ? 'em_andamento' : form.status,
      p_responsible_user_id: form.responsible_user_id || null,
      p_observations: form.observations || null,
      p_jurisdiction_state: form.jurisdiction_state || selectedClient?.state || null,
      p_vehicle_condition: selectedTypeSlug === 'cnh_especial'
        ? null
        : (selectedVehicle?.vehicle_condition ?? form.vehicle_condition) || null,
      // Campos legados permanecem nulos em novos processos. A viabilidade
      // comercial ja foi definida durante a venda/conversao do lead.
      p_eligibility_status: null,
      p_eligibility_analysis: null,
      p_custom_fields: customFieldInserts,
      p_stages: stageRows,
      p_financial: financial,
    })

    if (procErr || !processId) {
      setError('Erro ao criar processo: ' + (procErr?.message ?? 'Erro desconhecido'))
      setLoading(false)
      return
    }

    if (servicePlanItem || selectedVehicle) {
      const { error: planLinkError } = await supabase
        .from('processes')
        .update({
          service_engagement_id: servicePlanItem?.engagement_id ?? null,
          service_plan_item_id: servicePlanItem?.id ?? null,
          service_order: servicePlanItem?.sort_order ?? null,
          vehicle_id: selectedVehicle?.id ?? null,
        })
        .eq('id', processId)

      if (planLinkError) {
        await supabase
          .from('processes')
          .update({ status: 'cancelado' })
          .eq('id', processId)
        setError('O processo nao foi vinculado ao plano: ' + planLinkError.message)
        setLoading(false)
        return
      }
    }

    router.push(`/processos/${processId}`)
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
              {selectedTypeName && !prePlanItemId && (
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
                {['processo_ipi', 'processo_icms'].includes(selectedTypeSlug) && (
                  <p className="dash rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Este beneficio e exclusivo para veiculo zero-quilometro; essa condicao ja foi aplicada ao processo.
                  </p>
                )}
                {['processo_ipi', 'processo_icms', 'processo_ipva'].includes(selectedTypeSlug) && form.client_id && (
                  <div className="space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3.5">
                    <Select
                      label="Veículo (opcional nesta etapa)"
                      options={clientVehicles.map(vehicle => ({
                        value: vehicle.id,
                        label: [
                          [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.description || 'Veiculo',
                          vehicle.plate,
                          vehicle.vehicle_condition === 'zero_km' ? 'zero km' : 'usado',
                        ].filter(Boolean).join(' · '),
                      }))}
                      placeholder="Escolher depois"
                      value={form.vehicle_id}
                      onChange={event => {
                        const vehicle = clientVehicles.find(item => item.id === event.target.value)
                        setForm(current => ({
                          ...current,
                          vehicle_id: event.target.value,
                          vehicle_condition: vehicle?.vehicle_condition ?? current.vehicle_condition,
                        }))
                      }}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="dash text-[11px] text-cyan-800">
                        O atendimento pode começar agora. Vincule o veículo quando a compra ou a identificação estiver definida.
                      </p>
                      <Link
                        href={`/clientes/${form.client_id}`}
                        className="dash text-[11px] font-semibold text-cyan-800 underline underline-offset-2"
                      >
                        Cadastrar veiculo no cliente
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
              />
              {startStageOptions.length > 0 && (
                <Select
                  label="Etapa inicial"
                  options={startStageOptions}
                  placeholder="Comecar pela primeira etapa"
                  value={form.start_stage_key}
                  onChange={event => setForm(current => ({ ...current, start_stage_key: event.target.value }))}
                />
              )}
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
          {existingActiveProcess && (
            <div className="anim flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dash">
                    Este processo já está cadastrado
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dash">
                    Não é possível manter dois processos ativos do mesmo tipo para o mesmo cliente.
                  </p>
                </div>
              </div>
              <Link
                href={`/processos/${existingActiveProcess.id}`}
                className="shrink-0 text-xs font-semibold text-amber-800 hover:underline dash"
              >
                Abrir existente
              </Link>
            </div>
          )}

          {error && (
            <div className="anim flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dash">{error}</p>
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="anim anim-5 flex gap-3 pb-2">
            <Button type="submit" loading={loading} disabled={Boolean(existingActiveProcess)} size="md">
              Criar Processo
            </Button>
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
