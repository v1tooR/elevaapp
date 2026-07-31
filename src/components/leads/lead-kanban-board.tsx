'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowUpRight, CalendarDays, GripVertical, Handshake, Loader2, Phone, UserRound } from 'lucide-react'
import type { LeadSource, LeadStatus } from '@/types/database'
import { cn, formatDate, formatPhone } from '@/lib/utils'
import { LEAD_STATUS_META } from '@/lib/lead-funnel'

export interface LeadKanbanItem {
  id: string
  name: string
  phone: string | null
  status: LeadStatus
  lead_source: LeadSource | null
  converted_client_id: string | null
  created_at: string
  assignee: { id: string; name: string } | null
  referral_partner: { id: string; name: string } | null
}

type LeadUpdate = Partial<Pick<LeadKanbanItem, 'status' | 'converted_client_id'>>

const COLUMNS: Array<{
  key: LeadStatus
  label: string
  description: string
  headerClass: string
  dotClass: string
  countClass: string
}> = [
  {
    key: 'novo',
    label: LEAD_STATUS_META.novo.label,
    description: LEAD_STATUS_META.novo.description,
    headerClass: 'border-info/20 bg-info-bg/60 text-info',
    dotClass: 'bg-info',
    countClass: 'bg-info/10 text-info',
  },
  {
    key: 'frio',
    label: LEAD_STATUS_META.frio.label,
    description: LEAD_STATUS_META.frio.description,
    headerClass: 'border-sky-200 bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-500',
    countClass: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'quente',
    label: LEAD_STATUS_META.quente.label,
    description: LEAD_STATUS_META.quente.description,
    headerClass: 'border-orange-200 bg-orange-50 text-orange-700',
    dotClass: 'bg-orange-500',
    countClass: 'bg-orange-100 text-orange-700',
  },
  {
    key: 'convertido',
    label: LEAD_STATUS_META.convertido.label,
    description: LEAD_STATUS_META.convertido.description,
    headerClass: 'border-success/20 bg-success-bg/60 text-success',
    dotClass: 'bg-success',
    countClass: 'bg-success/10 text-success',
  },
  {
    key: 'perdido',
    label: LEAD_STATUS_META.perdido.label,
    description: LEAD_STATUS_META.perdido.description,
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
  const router = useRouter()
  const [leadUpdates, setLeadUpdates] = useState<Record<string, LeadUpdate>>({})
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null)
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const items = leads.map(lead => ({ ...lead, ...leadUpdates[lead.id] }))

  const moveLead = async (leadId: string, nextStatus: LeadStatus) => {
    const lead = items.find(item => item.id === leadId)
    if (!lead || lead.status === nextStatus || pendingLeadId) return

    if (lead.converted_client_id) {
      setError('Este lead já foi convertido em cliente e não pode voltar para outra situação.')
      return
    }

    if (
      nextStatus === 'convertido'
      && !window.confirm(`Converter ${lead.name} em cliente? O cadastro será criado automaticamente.`)
    ) {
      return
    }

    const previousStatus = lead.status
    setError('')
    setPendingLeadId(leadId)
    setLeadUpdates(current => ({
      ...current,
      [leadId]: { ...current[leadId], status: nextStatus },
    }))

    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error ?? 'Não foi possível atualizar o lead.')
      }

      setLeadUpdates(current => ({
        ...current,
        [leadId]: {
          ...current[leadId],
          status: nextStatus,
          converted_client_id: result.convertedClientId ?? lead.converted_client_id,
        },
      }))
      setAnnouncement(
        nextStatus === 'convertido'
          ? `${lead.name} foi convertido e agora também aparece em Clientes.`
          : `${lead.name} foi movido para ${COLUMNS.find(column => column.key === nextStatus)?.label}.`,
      )
      router.refresh()
    } catch (moveError) {
      setLeadUpdates(current => ({
        ...current,
        [leadId]: { ...current[leadId], status: previousStatus },
      }))
      setError(moveError instanceof Error ? moveError.message : 'Não foi possível atualizar o lead.')
    } finally {
      setPendingLeadId(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="sr-only" aria-live="polite">{announcement}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Novo ainda não foi classificado. Frio indica baixo interesse ou dificuldade de retorno; Quente indica intenção de contratar enquanto aguarda uma providência. Arraste os cards para mover.
      </p>

      <div className="flex gap-3 overflow-x-auto pb-3 xl:grid xl:grid-cols-5 xl:overflow-visible">
        {COLUMNS.map((column) => {
          const columnLeads = items.filter((lead) => lead.status === column.key)
          const headingId = `lead-column-${column.key}`
          const isDropTarget = dropTarget === column.key

          return (
            <section
              key={column.key}
              aria-labelledby={headingId}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes('text/plain')) return
                event.preventDefault()
                event.dataTransfer.dropEffect = column.key === 'convertido' ? 'copy' : 'move'
                setDropTarget(column.key)
              }}
              onDragLeave={(event) => {
                const related = event.relatedTarget as Node | null
                if (!related || !event.currentTarget.contains(related)) setDropTarget(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const leadId = event.dataTransfer.getData('text/plain') || draggedLeadId
                setDraggedLeadId(null)
                setDropTarget(null)
                if (leadId) void moveLead(leadId, column.key)
              }}
              className={cn(
                'w-[min(19rem,85vw)] shrink-0 rounded-2xl border bg-muted/30 p-2 transition-all xl:w-auto',
                isDropTarget ? 'border-primary ring-2 ring-primary/15' : 'border-border',
              )}
            >
              <div className={`min-h-[4.5rem] rounded-xl border px-3 py-2.5 ${column.headerClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${column.dotClass}`} />
                    <h2 id={headingId} className="truncate text-xs font-bold">
                      {column.label}
                    </h2>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${column.countClass}`}>
                    {columnLeads.length}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug opacity-75">
                  {column.description}
                </p>
              </div>

              <div className="mt-2 flex min-h-72 flex-col gap-2">
                {columnLeads.map((lead) => {
                  const isConverted = Boolean(lead.converted_client_id)
                  const isPending = pendingLeadId === lead.id

                  return (
                    <article
                      key={lead.id}
                      draggable={!isConverted && !isPending}
                      onDragStart={(event) => {
                        setDraggedLeadId(lead.id)
                        setError('')
                        event.dataTransfer.effectAllowed = 'copyMove'
                        event.dataTransfer.setData('text/plain', lead.id)
                      }}
                      onDragEnd={() => {
                        setDraggedLeadId(null)
                        setDropTarget(null)
                      }}
                      className={cn(
                        'group relative rounded-xl border border-border bg-card p-3 shadow-soft transition-all select-none',
                        isConverted ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
                        draggedLeadId === lead.id && 'opacity-50 scale-95',
                        isPending && 'pointer-events-none opacity-70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-card-foreground">
                            {lead.name}
                          </p>
                          {lead.lead_source && (
                            <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                              {SOURCE_LABELS[lead.lead_source]}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/leads/${lead.id}`}
                          draggable={false}
                          aria-label={`Ver lead ${lead.name}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          {isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ArrowUpRight className="h-3.5 w-3.5" />}
                        </Link>
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
                        {lead.referral_partner?.name && (
                          <div className="flex items-center gap-2">
                            <Handshake className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{lead.referral_partner.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          <span>Criado em {formatDate(lead.created_at)}</span>
                        </div>
                      </div>

                      {!isConverted && !isPending && (
                        <div className="mt-2.5 flex items-center gap-1 text-muted-foreground/40">
                          <GripVertical className="h-3 w-3" />
                          <span className="text-[10px]">Arraste para mover</span>
                        </div>
                      )}
                    </article>
                  )
                })}

                {columnLeads.length === 0 && (
                  <div className={cn(
                    'flex min-h-28 flex-1 items-center justify-center rounded-xl border border-dashed bg-card/50 px-4 text-center transition-colors',
                    isDropTarget ? 'border-primary bg-primary/5' : 'border-border',
                  )}>
                    <p className="text-xs text-muted-foreground">
                      {isDropTarget ? 'Solte o lead aqui' : 'Nenhum lead neste status'}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
