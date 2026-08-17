'use client'
import { cn } from '@/lib/utils'
import {
  PROCESS_STATUS_LABELS, PROCESS_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
} from '@/lib/utils'
import {
  PROCESS_PHASE_COLORS,
  PROCESS_PHASE_LABELS,
  getProcessPhase,
  type ProcessPhase,
  type ProcessPhaseInput,
} from '@/lib/process-pipeline'
import type { ProcessStatus, DocumentStatus, PaymentStatus } from '@/types/database'

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', PROCESS_STATUS_COLORS[status])}>
      {PROCESS_STATUS_LABELS[status]}
    </span>
  )
}

export function ProcessPhaseBadge({ phase }: { phase: ProcessPhase }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', PROCESS_PHASE_COLORS[phase])}>
      {PROCESS_PHASE_LABELS[phase]}
    </span>
  )
}

/** Badge de acompanhamento: usa as etapas quando existem e cai para o status gravado. */
export function ProcessPipelineBadge(input: ProcessPhaseInput) {
  return <ProcessPhaseBadge phase={getProcessPhase(input)} />
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', DOCUMENT_STATUS_COLORS[status])}>
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', PAYMENT_STATUS_COLORS[status])}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}
