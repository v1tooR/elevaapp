import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Tag, Stethoscope, StickyNote, Clock,
  ArrowUpRight, CheckCircle2, UserX
} from 'lucide-react'
import { formatPhone, formatDate, formatDateTime } from '@/lib/utils'
import { EditLeadModal } from '@/components/leads/edit-lead-modal'
import { ConvertLeadModal } from '@/components/leads/convert-lead-modal'

const STATUS_LABEL: Record<string, string> = {
  novo:            'Novo',
  em_atendimento:  'Em atendimento',
  convertido:      'Convertido',
  perdido:         'Perdido',
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  novo:           { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  em_atendimento: { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  convertido:     { bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
  perdido:        { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
}

const SOURCE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  google:    'Google',
  indicacao: 'Indicação',
  vendedor:  'Vendedor',
  outros:    'Outros',
}

const SOURCE_STYLE: Record<string, { bg: string; text: string }> = {
  instagram: { bg: '#FAF5FF', text: '#9333EA' },
  google:    { bg: '#EFF6FF', text: '#2563EB' },
  indicacao: { bg: '#F0FDF4', text: '#15803D' },
  vendedor:  { bg: '#FFF7ED', text: '#EA580C' },
  outros:    { bg: '#F8FAFC', text: '#64748B' },
}

const DISABILITY_LABEL: Record<string, string> = {
  fisica:    'Física',
  auditiva:  'Auditiva',
  visual:    'Visual',
  monocular: 'Monocular',
  autismo:   'Autismo (TEA)',
  mental:    'Mental / Intelectual',
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('*, assignee:assigned_to(id, name), converted_client:converted_client_id(id, name)')
    .eq('id', id)
    .single()

  if (!lead) notFound()

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['super_admin', 'admin', 'analista'])
    .eq('is_active', true)
    .order('name')

  const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE.novo
  const isConverted = lead.status === 'convertido'
  const isPerdido = lead.status === 'perdido'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        .dash { font-family: 'Outfit', sans-serif; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim   { animation: slideUp 0.4s ease-out both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.10s; }
        .anim-3 { animation-delay: 0.15s; }
        .anim-4 { animation-delay: 0.20s; }
        .back-btn:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      <div className="space-y-5">

        {/* ── Banner ─────────────────────────────────────────────── */}
        <div
          className="anim relative overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #0C1A2E 0%, #1A3055 55%, #1E40AF 100%)' }}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.08]"
            style={{ background: 'radial-gradient(circle, #60A5FA, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          {/* Back + actions */}
          <div className="relative flex items-center justify-between gap-3 px-6 pt-5 pb-0">
            <Link
              href="/leads"
              className="back-btn flex items-center gap-1.5 text-blue-300/80 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar a Leads
            </Link>
            <div className="flex gap-2 items-center">
              {!isConverted && !isPerdido && (
                <ConvertLeadModal lead={lead as any} />
              )}
              <EditLeadModal lead={lead as any} staff={staff ?? []} />
            </div>
          </div>

          {/* Lead info */}
          <div className="relative flex items-end gap-5 px-6 pb-6 pt-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold dash"
                  style={{ background: st.bg, color: st.text }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                  {STATUS_LABEL[lead.status]}
                </span>
                {lead.lead_source && (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold dash"
                    style={{ background: SOURCE_STYLE[lead.lead_source]?.bg, color: SOURCE_STYLE[lead.lead_source]?.text }}
                  >
                    {SOURCE_LABEL[lead.lead_source]}
                  </span>
                )}
              </div>
              <h1 className="dash text-white text-2xl font-bold leading-tight">{lead.name}</h1>
              {lead.phone && (
                <p className="dash text-blue-300/70 text-sm mt-1">{formatPhone(lead.phone)}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Converted banner ───────────────────────────────────── */}
        {isConverted && (lead.converted_client as any)?.id && (
          <div
            className="anim flex items-center justify-between gap-4 bg-emerald-50 rounded-2xl px-5 py-4"
            style={{ border: '1px solid #BBF7D0' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dash">Lead convertido com sucesso</p>
                <p className="text-xs text-emerald-700 dash">
                  Cliente: <strong>{(lead.converted_client as any)?.name}</strong>
                </p>
              </div>
            </div>
            <Link
              href={`/clientes/${(lead.converted_client as any)?.id}`}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 dash"
            >
              Ver cliente <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {isPerdido && (
          <div
            className="anim flex items-center gap-3 bg-red-50 rounded-2xl px-5 py-4"
            style={{ border: '1px solid #FECACA' }}
          >
            <UserX className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-semibold text-red-700 dash">Este lead foi marcado como perdido</p>
          </div>
        )}

        {/* ── Content Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left */}
          <div className="space-y-4">

            {/* Contato */}
            {lead.phone && (
              <div
                className="anim anim-1 bg-white rounded-2xl p-5"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <h2 className="dash font-bold text-slate-900 mb-4 text-sm">Contato</h2>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dash">Telefone</p>
                    <p className="text-sm font-medium text-slate-800 dash">{formatPhone(lead.phone)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Perfil de deficiência */}
            <div
              className="anim anim-2 bg-white rounded-2xl p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <h2 className="dash font-bold text-slate-900 text-sm">Perfil de Deficiência</h2>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 dash">Habilitado</span>
                  <span className="text-xs font-semibold text-slate-700 dash">
                    {lead.is_driver ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 dash">Tipo de deficiência</span>
                  <span className="text-xs font-semibold text-slate-700 dash">
                    {lead.disability_type ? DISABILITY_LABEL[lead.disability_type] : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 dash">CNH Especial</span>
                  <span className="text-xs font-semibold dash" style={{ color: lead.has_cnh_especial ? '#16A34A' : '#94A3B8' }}>
                    {lead.has_cnh_especial ? 'Sim' : 'Não / N.A.'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 dash">Laudo médico</span>
                  <span className="text-xs font-semibold dash" style={{ color: lead.has_medical_report ? '#16A34A' : '#94A3B8' }}>
                    {lead.has_medical_report ? (lead.report_valid ? 'Sim, dentro da validade' : 'Sim, vencido') : 'Não'}
                  </span>
                </div>
              </div>
            </div>

            {/* Origem */}
            <div
              className="anim anim-3 bg-white rounded-2xl p-5"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <h2 className="dash font-bold text-slate-900 text-sm">Origem e Atribuição</h2>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 dash">Origem</span>
                  <span className="text-xs font-semibold text-slate-700 dash">
                    {lead.lead_source ? SOURCE_LABEL[lead.lead_source] : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400 dash">Responsável</span>
                  <span className="text-xs font-semibold text-slate-700 dash">
                    {(lead.assignee as any)?.name ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">

            {/* Observações */}
            {lead.notes && (
              <div
                className="anim anim-1 bg-white rounded-2xl p-5"
                style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <h2 className="dash font-bold text-slate-900 text-sm">Observações</h2>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap dash leading-relaxed">{lead.notes}</p>
              </div>
            )}

            {/* Sistema */}
            <div
              className="anim anim-2 bg-white rounded-2xl p-5"
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
                  <p className="text-xs font-medium text-slate-600 dash">{formatDateTime(lead.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dash">Atualizado em</p>
                  <p className="text-xs font-medium text-slate-600 dash">{formatDateTime(lead.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
