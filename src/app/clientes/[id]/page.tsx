import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, FolderOpen, FileText,
  Phone, Mail, MapPin, Calendar, Shield, StickyNote, Clock, ArrowUpRight,
  Stethoscope, Zap,
} from 'lucide-react'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatCPF, formatPhone, formatDate, formatDateTime } from '@/lib/utils'
import { EditClientModal } from '@/components/clientes/edit-client-modal'
import { PortalAccessCard } from '@/components/clientes/portal-access-card'
import { canHaveCnhEspecial } from '@/lib/eligibility'

const DISABILITY_LABEL: Record<string, string> = {
  fisica:    'Física',
  auditiva:  'Auditiva',
  visual:    'Visual',
  monocular: 'Monocular',
  autismo:   'Autismo (TEA)',
  mental:    'Mental / Intelectual',
}

const CLIENT_TYPE_LABEL: Record<string, string> = {
  condutor:     'Condutor',
  nao_condutor: 'Não condutor',
}

const CNH_STATUS_LABEL: Record<string, string> = {
  nao_possui: 'Não possui',
  comum: 'Sem restrições PCD',
  com_restricoes: 'Com restrições',
  em_regularizacao: 'Em regularização',
  inapto_temporario: 'Inapto temporariamente',
  inapto: 'Inapto',
}

const MEDICAL_STATUS_LABEL: Record<string, string> = {
  nao_realizada: 'Não realizada',
  agendada: 'Agendada',
  apto: 'Apto',
  apto_com_restricoes: 'Apto com restrições',
  inapto_temporario: 'Inapto temporariamente',
  inapto: 'Inapto',
}

const GOV_ACCESS_STATUS: Record<string, { label: string; className: string }> = {
  nao_validado: {
    label: 'Não validado',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  aguardando_cliente: {
    label: 'Aguardando o cliente',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  validado: {
    label: 'Acesso validado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  com_pendencia: {
    label: 'Com pendência',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
}

const GOV_ACCOUNT_LEVEL: Record<string, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
}

function avatarGradient(name: string) {
  const g = [
    'linear-gradient(135deg,#6B3019,#A14F2A)',
    'linear-gradient(135deg,#7C3E24,#C97A52)',
    'linear-gradient(135deg,#8A4A2E,#D08A64)',
    'linear-gradient(135deg,#5C2A18,#9A4828)',
    'linear-gradient(135deg,#70402E,#B86C49)',
    'linear-gradient(135deg,#425438,#718061)',
  ]
  const n = [...name].reduce((s, c) => s + c.charCodeAt(0), 0)
  return g[n % g.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: callerProfile } = user
    ? await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
    : { data: null }

  const [{ data: processes }, { data: documents }, { data: linkedProfile }] = await Promise.all([
    supabase.from('processes')
      .select('*, process_types(name, color, slug)')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('documents')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    client.profile_id
      ? supabase.from('profiles').select('email').eq('id', client.profile_id).single()
      : Promise.resolve({ data: null }),
  ])

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
        .process-row { transition: background 0.12s; }
        .process-row:hover { background: #F8FAFC; }
        .process-row:hover .process-name { color: #2563EB; }
        .doc-row { transition: background 0.12s; }
        .doc-row:hover { background: #F8FAFC; }
        .back-btn { transition: background 0.12s, color 0.12s; }
        .back-btn:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      <div className="space-y-5">

        {/* ── Hero Banner ──────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.08]"
            style={{ background: 'radial-gradient(circle, #C97A52, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          {/* Back + actions bar */}
          <div className="relative flex items-center justify-between gap-3 px-6 pt-5 pb-0">
            <Link
              href="/clientes"
              className="back-btn flex items-center gap-1.5 text-primary-foreground/75 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar a Clientes
            </Link>
            <div className="flex gap-2">
              <Link
                href={`/processos/novo?client_id=${client.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all dash"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Processo
              </Link>
              <EditClientModal client={client} />
            </div>
          </div>

          {/* Profile info */}
          <div className="relative flex items-end gap-5 px-6 pb-6 pt-5">
            <div
              className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-white text-xl font-bold dash border-2 border-white/20"
              style={{ background: avatarGradient(client.name) }}
            >
              {initials(client.name)}
            </div>
            <div className="flex-1 min-w-0 pb-0.5">
              <h1 className="dash text-white text-2xl font-bold leading-tight truncate">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {client.cpf && (
                  <span className="text-xs font-medium text-primary-foreground/75 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 dash">
                    CPF {formatCPF(client.cpf)}
                  </span>
                )}
                {client.phone && (
                  <span className="text-xs font-medium text-primary-foreground/75 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 dash">
                    {formatPhone(client.phone)}
                  </span>
                )}
                {(client.city || client.state) && (
                  <span className="text-xs font-medium text-primary-foreground/75 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 dash">
                    {[client.city, client.state].filter(Boolean).join(' / ')}
                  </span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden sm:flex gap-3 shrink-0">
              <div className="text-center bg-white/10 border border-white/10 rounded-xl px-4 py-2.5">
                <p className="dash text-xl font-bold text-white">{processes?.length ?? 0}</p>
                <p className="dash text-[10px] text-primary-foreground/65 mt-0.5">Processos</p>
              </div>
              <div className="text-center bg-white/10 border border-white/10 rounded-xl px-4 py-2.5">
                <p className="dash text-xl font-bold text-white">{documents?.length ?? 0}</p>
                <p className="dash text-[10px] text-primary-foreground/65 mt-0.5">Documentos</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">

            {/* Contact info */}
            <div
              className="anim anim-1 bg-white rounded-2xl p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <h2 className="dash font-bold text-slate-900 mb-4">Contato & Dados</h2>
              <div className="space-y-3">
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dash">Telefone</p>
                      <p className="text-sm font-medium text-slate-800 dash">{formatPhone(client.phone)}</p>
                    </div>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 dash">E-mail</p>
                      <p className="text-sm font-medium text-slate-800 dash truncate">{client.email}</p>
                    </div>
                  </div>
                )}
                {(client.city || client.state) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dash">Localização</p>
                      <p className="text-sm font-medium text-slate-800 dash">
                        {[client.city, client.state].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dash">Endereço</p>
                      <p className="text-sm font-medium text-slate-800 dash">{client.address}</p>
                    </div>
                  </div>
                )}
                {client.birth_date && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dash">Nascimento</p>
                      <p className="text-sm font-medium text-slate-800 dash">{formatDate(client.birth_date)}</p>
                    </div>
                  </div>
                )}
                {client.rg && (
                  <div className="pt-2 border-t border-slate-50">
                    <p className="text-[10px] text-slate-400 dash mb-0.5">RG</p>
                    <p className="text-sm font-medium text-slate-800 dash">{client.rg}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Gov.br */}
            <div
              className="anim anim-2 rounded-2xl bg-white p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                    <Shield className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <h2 className="dash text-sm font-bold text-slate-900">Acesso Gov.br</h2>
                </div>
                {(() => {
                  const status = GOV_ACCESS_STATUS[client.gov_access_status ?? 'nao_validado'] ?? GOV_ACCESS_STATUS.nao_validado
                  return <span className={`dash rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                })()}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <span className="dash text-xs text-slate-400">Autenticação pelo cliente</span>
                  <span className="dash text-right text-xs font-semibold text-slate-700">
                    {client.gov_auth_by_client ? 'Confirmada' : 'Não confirmada'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="dash text-xs text-slate-400">Nível da conta</span>
                  <span className="dash text-right text-xs font-semibold text-slate-700">
                    {client.gov_account_level ? GOV_ACCOUNT_LEVEL[client.gov_account_level] : 'Não informado'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="dash text-xs text-slate-400">Nível suficiente</span>
                  <span className="dash text-right text-xs font-semibold text-slate-700">
                    {client.gov_account_level_sufficient == null ? 'Não avaliado' : client.gov_account_level_sufficient ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="dash text-xs text-slate-400">Última validação</span>
                  <span className="dash text-right text-xs font-semibold text-slate-700">
                    {client.gov_access_last_validated_at ? formatDateTime(client.gov_access_last_validated_at) : 'Ainda não realizada'}
                  </span>
                </div>
              </div>

              {client.gov_access_pending_note && (
                <div className="dash mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                  <span className="font-semibold">Pendência: </span>{client.gov_access_pending_note}
                </div>
              )}

              <p className="dash mt-4 border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-400">
                Para prosseguir, faça o acesso junto com o cliente. Senha e código de verificação não são registrados no Eleva.
              </p>
            </div>

            {/* Internal notes */}
            {client.internal_notes && (
              <div
                className="anim anim-2 bg-white rounded-2xl p-5"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Observações</h2>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap dash leading-relaxed">{client.internal_notes}</p>
              </div>
            )}

            {/* System info */}
            <div
              className="anim anim-3 bg-white rounded-2xl p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <h2 className="dash font-bold text-slate-900 text-sm">Sistema</h2>
              </div>
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] text-slate-400 dash">Cadastrado em</p>
                  <p className="text-xs font-medium text-slate-600 dash">{formatDateTime(client.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dash">Atualizado em</p>
                  <p className="text-xs font-medium text-slate-600 dash">{formatDateTime(client.updated_at)}</p>
                </div>
              </div>
            </div>

            {/* Elegibilidade */}
            {(client.client_type || client.disability_type || client.cnh_status ||
              client.receives_loas_bpc || client.has_medical_report) && (
              <div
                className="anim anim-3 bg-white rounded-2xl p-5"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Elegibilidade</h2>
                </div>
                <div className="space-y-2">
                  {client.client_type && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400 dash">Perfil</span>
                      <span className="text-xs font-semibold text-slate-700 dash">{CLIENT_TYPE_LABEL[client.client_type]}</span>
                    </div>
                  )}
                  {(client.disability_types?.length > 0 || client.disability_type) && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400 dash">Condição</span>
                      <span className="text-right text-xs font-semibold text-slate-700 dash">
                        {(client.disability_types?.length > 0 ? client.disability_types : [client.disability_type])
                          .filter(Boolean)
                          .map((type: string) => DISABILITY_LABEL[type] ?? type)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {client.cnh_status && (
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-slate-400 dash">CNH</span>
                      <span className="text-right text-xs font-semibold text-slate-700 dash">{CNH_STATUS_LABEL[client.cnh_status]}</span>
                    </div>
                  )}
                  {client.cnh_restrictions?.length > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-slate-400 dash">Restrições registradas</span>
                      <span className="text-right text-xs font-semibold text-slate-700 dash">{client.cnh_restrictions.join(', ')}</span>
                    </div>
                  )}
                  {client.medical_assessment_status && (
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-slate-400 dash">Avaliação pericial</span>
                      <span className="text-right text-xs font-semibold text-slate-700 dash">{MEDICAL_STATUS_LABEL[client.medical_assessment_status]}</span>
                    </div>
                  )}
                  {client.client_type === 'condutor' && (
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-slate-400 dash">Exame prático</span>
                      <span className="text-right text-xs font-semibold text-slate-700 dash">
                        {client.requires_practical_exam === null || client.requires_practical_exam === undefined
                          ? 'Aguardando perícia'
                          : client.requires_practical_exam ? 'Determinado' : 'Dispensado'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400 dash">LOAS/BPC</span>
                    <span className="text-xs font-semibold dash" style={{ color: client.receives_loas_bpc ? '#16A34A' : '#94A3B8' }}>
                      {client.receives_loas_bpc ? 'Sim' : 'Não'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400 dash">Laudo médico</span>
                    <span className="text-xs font-semibold dash" style={{ color: client.has_medical_report ? '#16A34A' : '#94A3B8' }}>
                      {client.has_medical_report
                        ? client.report_valid_until ? `Válido até ${formatDate(client.report_valid_until)}` : 'Sim'
                        : 'Não'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Portal access */}
            <PortalAccessCard
              client={client}
              hasAccess={!!client.profile_id}
              profileEmail={linkedProfile?.email ?? undefined}
              callerRole={callerProfile?.role ?? undefined}
            />
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-5">

            {/* CNH Especial shortcut */}
            {canHaveCnhEspecial(client.client_type, client.disability_type) && client.cnh_status !== 'com_restricoes' && (
              <div
                className="anim anim-1 rounded-2xl overflow-hidden"
                style={{ border: '1px solid #C4B5FD', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div
                  className="flex items-center justify-between gap-4 px-5 py-4"
                  style={{ background: 'linear-gradient(135deg, #6B3019 0%, #A14F2A 100%)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <Zap className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <p className="dash text-white font-bold text-sm">Iniciar regularização da CNH</p>
                      <p className="dash text-primary-foreground/75 text-xs mt-0.5">
                        A perícia definirá as restrições, adaptações e a necessidade de exame prático
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/processos/novo?client_id=${client.id}&type=cnh_especial`}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/15 border border-white/25 hover:bg-white/25 transition-all dash"
                  >
                    Iniciar <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Processes */}
            <div
              className="anim anim-2 bg-white rounded-2xl overflow-hidden"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                <div>
                  <h2 className="dash font-bold text-slate-900">Processos</h2>
                  <p className="text-xs text-slate-400 mt-0.5 dash">{processes?.length ?? 0} registrado{processes?.length !== 1 ? 's' : ''}</p>
                </div>
                <Link
                  href={`/processos/novo?client_id=${client.id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dash group"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo
                </Link>
              </div>

              {!processes || processes.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 dash">Nenhum processo cadastrado</p>
                </div>
              ) : (
                <div>
                  {(processes as any[]).map(p => (
                    <Link
                      key={p.id}
                      href={`/processos/${p.id}`}
                      className="process-row flex items-center gap-4 px-5 py-3.5 border-b border-slate-50 last:border-0"
                    >
                      <div
                        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: `${p.process_types?.color ?? '#3B82F6'}18` }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="process-name text-sm font-semibold text-slate-900 dash transition-colors">
                          {p.process_types?.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.protocol && (
                            <p className="text-xs text-slate-400 dash">Protocolo: {p.protocol}</p>
                          )}
                          {p.protocol && <span className="text-slate-200 text-xs">·</span>}
                          <p className="text-xs text-slate-400 dash">{formatDate(p.created_at)}</p>
                        </div>
                      </div>
                      <ProcessStatusBadge status={p.status} />
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div
              className="anim anim-3 bg-white rounded-2xl overflow-hidden"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
                <div>
                  <h2 className="dash font-bold text-slate-900">Documentos Recentes</h2>
                  <p className="text-xs text-slate-400 mt-0.5 dash">Últimos 5 enviados</p>
                </div>
                <Link
                  href={`/documentos?client_id=${client.id}`}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dash group"
                >
                  Ver todos <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>

              {!documents || documents.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 dash">Nenhum documento enviado</p>
                </div>
              ) : (
                <div>
                  {(documents as any[]).map(d => (
                    <div key={d.id} className="doc-row flex items-center gap-4 px-5 py-3.5 border-b border-slate-50 last:border-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate dash">{d.file_name}</p>
                        <p className="text-xs text-slate-400 dash">{formatDate(d.created_at)}</p>
                      </div>
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dash shrink-0"
                      >
                        Abrir <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
