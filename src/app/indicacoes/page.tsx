import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  Clock3,
  Filter,
  Handshake,
  Phone,
  TrendingUp,
  UserRoundCheck,
  Users,
  UserX,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { ReferralPartnerManager } from '@/components/indicacoes/referral-partner-manager'
import {
  normalizeReferralMonth,
  referralLeadBucket,
  referralMonthBounds,
} from '@/lib/referral-partners'
import { LEAD_STATUS_META } from '@/lib/lead-funnel'
import { formatDate, formatPhone } from '@/lib/utils'
import type { LeadStatus, ReferralPartner } from '@/types/database'

interface SearchParams {
  month?: string
  partner_id?: string
}

interface ReferredLead {
  id: string
  name: string
  phone: string | null
  status: LeadStatus
  lead_source: 'vendedor' | 'indicacao'
  referral_partner_id: string
  created_at: string
  referral_partner: { id: string; name: string } | null
}

function currentSaoPauloMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return `${year}-${month}`
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

export default async function IndicacoesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const profile = await requireAuth(['super_admin', 'admin', 'analista'])
  const params = await searchParams
  const month = normalizeReferralMonth(params.month) || currentSaoPauloMonth()
  const requestedPartnerId = params.partner_id ?? ''
  const bounds = referralMonthBounds(month)
  const supabase = await createClient()

  const [partnersResult, leadsResult] = await Promise.all([
    supabase.from('referral_partners').select('*').order('name'),
    (() => {
      let query = supabase
        .from('leads')
        .select(`
          id, name, phone, status, lead_source, referral_partner_id, created_at,
          referral_partner:referral_partner_id(id, name)
        `)
        .not('referral_partner_id', 'is', null)
        .order('created_at', { ascending: false })

      if (bounds) {
        query = query.gte('created_at', bounds.start).lt('created_at', bounds.end)
      }
      return query
    })(),
  ])

  const partners = (partnersResult.data ?? []) as ReferralPartner[]
  const monthLeads = (leadsResult.data ?? []) as unknown as ReferredLead[]
  const selectedPartnerId = partners.some(partner => partner.id === requestedPartnerId)
    ? requestedPartnerId
    : ''
  const selectedPartner = partners.find(partner => partner.id === selectedPartnerId)
  const visibleLeads = selectedPartnerId
    ? monthLeads.filter(lead => lead.referral_partner_id === selectedPartnerId)
    : monthLeads
  const loadError = partnersResult.error || leadsResult.error

  const partnerSummaries = partners
    .map(partner => {
      const leads = monthLeads.filter(lead => lead.referral_partner_id === partner.id)
      return {
        partner,
        total: leads.length,
        convertidos: leads.filter(lead => referralLeadBucket(lead.status) === 'convertidos').length,
        perdidos: leads.filter(lead => referralLeadBucket(lead.status) === 'perdidos').length,
        emAndamento: leads.filter(lead => referralLeadBucket(lead.status) === 'em_andamento').length,
      }
    })
    .sort((left, right) => (
      right.total - left.total
      || left.partner.name.localeCompare(right.partner.name, 'pt-BR')
    ))

  const totals = monthLeads.reduce(
    (result, lead) => {
      result.total += 1
      result[referralLeadBucket(lead.status)] += 1
      return result
    },
    { total: 0, convertidos: 0, perdidos: 0, em_andamento: 0 },
  )

  const metricCards = [
    {
      label: 'Indicações',
      value: totals.total,
      helper: monthLabel(month),
      icon: Users,
      iconClass: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Convertidos',
      value: totals.convertidos,
      helper: totals.total ? `${Math.round((totals.convertidos / totals.total) * 100)}% do total` : 'Sem conversões',
      icon: TrendingUp,
      iconClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Em andamento',
      value: totals.em_andamento,
      helper: 'Novo, frio ou quente',
      icon: Clock3,
      iconClass: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Perdidos',
      value: totals.perdidos,
      helper: 'No período selecionado',
      icon: UserX,
      iconClass: 'bg-red-50 text-red-500',
    },
  ]

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E1A17] via-[#6B3019] to-[#A14F2A] p-5 text-white lg:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/[0.04]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Handshake className="h-5 w-5 text-white/85" />
            </div>
            <div className="min-w-0">
              <h1 className="dash text-xl font-bold sm:text-2xl">Vendedores e indicações</h1>
              <p className="dash mt-1 text-xs text-white/65 sm:text-sm">
                Acompanhe parceiros, conversões e leads indicados.
              </p>
            </div>
          </div>
          <div className="dash rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs text-white/75">
            Período: <strong className="text-white">{monthLabel(month)}</strong>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="dash text-sm font-semibold">Não foi possível carregar os dados de indicações.</p>
            <p className="dash mt-0.5 text-xs text-red-700">
              Verifique se a migration de vendedores e indicações foi aplicada e tente novamente.
            </p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map(metric => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="dash text-xs font-semibold text-muted-foreground">{metric.label}</p>
                  <p className="dash mt-1 text-2xl font-bold text-foreground">{metric.value}</p>
                  <p className="dash mt-1 truncate text-[11px] text-muted-foreground">{metric.helper}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${metric.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </div>
          )
        })}
      </section>

      <ReferralPartnerManager
        partners={partners}
        canManage={profile.role === 'super_admin' || profile.role === 'admin'}
        currentProfileId={profile.id}
      />

      <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="dash text-sm font-bold text-foreground">Filtrar relatório</h2>
        </div>
        <form method="GET" className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[180px_minmax(240px,1fr)_auto]">
          <div className="space-y-1">
            <label className="dash block text-xs font-semibold text-muted-foreground">Mês</label>
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="dash h-10 w-full rounded-xl border border-border bg-muted/60 px-3 text-sm outline-none transition-colors focus:border-primary focus:bg-card"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label className="dash block text-xs font-semibold text-muted-foreground">Vendedor/indicador</label>
            <select
              name="partner_id"
              defaultValue={selectedPartnerId}
              className="dash h-10 w-full rounded-xl border border-border bg-muted/60 px-3 text-sm outline-none transition-colors focus:border-primary focus:bg-card"
            >
              <option value="">Todos os parceiros</option>
              {partners.map(partner => (
                <option key={partner.id} value={partner.id}>{partner.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="dash inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Consultar
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="dash text-sm font-bold text-foreground">Resultado por parceiro</h2>
            <p className="dash mt-0.5 text-xs text-muted-foreground">
              Comparativo de {monthLabel(month)}.
            </p>
          </div>
          <span className="dash rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {partners.length} {partners.length === 1 ? 'parceiro' : 'parceiros'}
          </span>
        </div>

        {partnerSummaries.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6 text-muted-foreground">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <UserRoundCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="dash text-sm font-semibold text-foreground">Nenhum parceiro cadastrado</p>
              <p className="dash mt-0.5 text-xs">
                Cadastre um vendedor ou indicador para começar a acompanhar os resultados.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Parceiro</th>
                  <th className="px-4 py-3 text-center font-semibold">Indicados</th>
                  <th className="px-4 py-3 text-center font-semibold">Convertidos</th>
                  <th className="px-4 py-3 text-center font-semibold">Perdidos</th>
                  <th className="px-4 py-3 text-center font-semibold">Em andamento</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {partnerSummaries.map(summary => (
                  <tr key={summary.partner.id} className="transition-colors hover:bg-muted/25">
                    <td className="px-5 py-3.5">
                      <p className="dash font-semibold text-foreground">{summary.partner.name}</p>
                      <p className="dash mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {formatPhone(summary.partner.phone)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-foreground">{summary.total}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-700">{summary.convertidos}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-red-600">{summary.perdidos}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-amber-700">{summary.emAndamento}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/indicacoes?month=${month}&partner_id=${summary.partner.id}`}
                        className="dash inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Ver leads <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="dash text-sm font-bold text-foreground">
              {selectedPartner ? `Leads de ${selectedPartner.name}` : 'Leads indicados'}
            </h2>
            <p className="dash mt-0.5 text-xs text-muted-foreground">
              Nomes e situação para retorno ao vendedor ou indicador.
            </p>
          </div>
          <span className="dash rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {visibleLeads.length} {visibleLeads.length === 1 ? 'lead' : 'leads'}
          </span>
        </div>

        {visibleLeads.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6 text-muted-foreground">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <CalendarRange className="h-4 w-4" />
            </span>
            <div>
              <p className="dash text-sm font-semibold text-foreground">Nenhum lead encontrado</p>
              <p className="dash mt-0.5 text-xs">
                {selectedPartner
                  ? `${selectedPartner.name} não possui indicações em ${monthLabel(month)}.`
                  : `Não há indicações vinculadas no período de ${monthLabel(month)}.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Parceiro</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">Entrada</th>
                  <th className="px-4 py-3 font-semibold">Situação</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleLeads.map(lead => {
                  const status = LEAD_STATUS_META[lead.status]
                  return (
                    <tr key={lead.id} className="transition-colors hover:bg-muted/25">
                      <td className="px-5 py-3.5">
                        <p className="dash font-semibold text-foreground">{lead.name}</p>
                        <p className="dash text-xs text-muted-foreground">
                          {lead.phone ? formatPhone(lead.phone) : 'Sem telefone'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{lead.referral_partner?.name ?? '—'}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {lead.lead_source === 'vendedor' ? 'Vendedor' : 'Indicação'}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{formatDate(lead.created_at)}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className="dash inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ background: status.background, color: status.text }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="inline-flex rounded-lg p-2 text-primary transition-colors hover:bg-primary/5"
                          aria-label={`Abrir lead ${lead.name}`}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
