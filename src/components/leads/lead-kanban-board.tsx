import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Phone, UserRound } from 'lucide-react'
import type { LeadSource, LeadStatus } from '@/types/database'
import { formatDate, formatPhone } from '@/lib/utils'

export interface LeadKanbanItem {
  id: string
  name: string
  phone: string | null
  status: LeadStatus
  lead_source: LeadSource | null
  created_at: string
  assignee: { id: string; name: string } | null
}

const COLUMNS: Array<{
  key: LeadStatus
  label: string
  headerClass: string
  dotClass: string
  countClass: string
}> = [
  {
    key: 'novo',
    label: 'Novo',
    headerClass: 'border-info/20 bg-info-bg/60 text-info',
    dotClass: 'bg-info',
    countClass: 'bg-info/10 text-info',
  },
  {
    key: 'em_atendimento',
    label: 'Em atendimento',
    headerClass: 'border-warning/20 bg-warning-bg/60 text-warning',
    dotClass: 'bg-warning',
    countClass: 'bg-warning/10 text-warning',
  },
  {
    key: 'convertido',
    label: 'Convertido',
    headerClass: 'border-success/20 bg-success-bg/60 text-success',
    dotClass: 'bg-success',
    countClass: 'bg-success/10 text-success',
  },
  {
    key: 'perdido',
    label: 'Perdido',
    headerClass: 'border-destructive/20 bg-destructive/5 text-destructive',
    dotClass: 'bg-destructive',
    countClass: 'bg-destructive/10 text-destructive',
  },
]

const SOURCE_LABELS: Record<LeadSource, string> = {
  instagram: 'Instagram',
  google: 'Google',
  indicacao: 'Indicação',
  vendedor: 'Vendedor',
  outros: 'Outros',
}

export function LeadKanbanBoard({ leads }: { leads: LeadKanbanItem[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 xl:grid xl:grid-cols-4 xl:overflow-visible">
      {COLUMNS.map((column) => {
        const columnLeads = leads.filter((lead) => lead.status === column.key)
        const headingId = `lead-column-${column.key}`

        return (
          <section
            key={column.key}
            aria-labelledby={headingId}
            className="w-[min(19rem,85vw)] shrink-0 rounded-2xl border border-border bg-muted/30 p-2 xl:w-auto"
          >
            <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${column.headerClass}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${column.dotClass}`} />
                <h2 id={headingId} className="truncate text-xs font-bold">
                  {column.label}
                </h2>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${column.countClass}`}>
                {columnLeads.length}
              </span>
            </div>

            <div className="mt-2 flex min-h-72 flex-col gap-2">
              {columnLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  aria-label={`Ver lead ${lead.name}`}
                  className="group rounded-xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-card-foreground transition-colors group-hover:text-primary">
                        {lead.name}
                      </p>
                      {lead.lead_source && (
                        <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                          {SOURCE_LABELS[lead.lead_source]}
                        </span>
                      )}
                    </div>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{lead.phone ? formatPhone(lead.phone) : 'Sem telefone'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{lead.assignee?.name ?? 'Sem responsável'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>Criado em {formatDate(lead.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}

              {columnLeads.length === 0 && (
                <div className="flex min-h-28 flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-4 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum lead neste status</p>
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
