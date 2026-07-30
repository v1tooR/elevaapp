import type { LeadStatus } from '@/types/database'

export const LEAD_FUNNEL_STATUSES = [
  'novo',
  'frio',
  'quente',
  'convertido',
  'perdido',
] as const satisfies readonly LeadStatus[]

export const OPEN_LEAD_STATUSES = [
  'novo',
  'frio',
  'quente',
] as const satisfies readonly LeadStatus[]

export const LEAD_STATUS_META: Record<LeadStatus, {
  label: string
  description: string
  background: string
  text: string
  dot: string
}> = {
  novo: {
    label: 'Novo',
    description: 'Ainda não classificado',
    background: '#EFF6FF',
    text: '#2563EB',
    dot: '#3B82F6',
  },
  frio: {
    label: 'Frio',
    description: 'Baixo interesse, sem retorno ou tentativas em andamento',
    background: '#F0F9FF',
    text: '#0369A1',
    dot: '#0EA5E9',
  },
  quente: {
    label: 'Quente',
    description: 'Intenção de contratar; aguarda documento ou providência',
    background: '#FFF7ED',
    text: '#C2410C',
    dot: '#F97316',
  },
  convertido: {
    label: 'Convertido',
    description: 'Convertido em cliente',
    background: '#F0FDF4',
    text: '#16A34A',
    dot: '#22C55E',
  },
  perdido: {
    label: 'Perdido',
    description: 'Atendimento encerrado sem conversão',
    background: '#FEF2F2',
    text: '#DC2626',
    dot: '#EF4444',
  },
}

export function isLeadStatus(value: string): value is LeadStatus {
  return LEAD_FUNNEL_STATUSES.includes(value as LeadStatus)
}
