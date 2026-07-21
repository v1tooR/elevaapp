import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ProcessStatus, DocumentStatus, PaymentStatus, NotificationType } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  aguardando_documentos: 'Aguard. Documentos',
  em_analise: 'Em Análise',
  aguardando_orgao: 'Aguard. Órgão',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
  cancelado: 'Cancelado',
}

export const PROCESS_STATUS_COLORS: Record<ProcessStatus, string> = {
  aberto: 'bg-blue-100 text-blue-800',
  em_andamento: 'bg-yellow-100 text-yellow-800',
  aguardando_documentos: 'bg-orange-100 text-orange-800',
  em_analise: 'bg-purple-100 text-purple-800',
  aguardando_orgao: 'bg-indigo-100 text-indigo-800',
  concluido: 'bg-green-100 text-green-800',
  arquivado: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-800',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'Pendente',
  received: 'Recebido',
  under_review: 'Em Revisão',
  approved: 'Aprovado',
  rejected: 'Reprovado',
  resend_required: 'Reenvio Necessário',
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  received: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  resend_required: 'bg-orange-100 text-orange-800',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  partially_paid: 'Parcialmente Pago',
  paid: 'Pago',
  overdue: 'Em Atraso',
  canceled: 'Cancelado',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-600',
}

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, string> = {
  info: 'text-blue-500',
  warning: 'text-yellow-500',
  success: 'text-green-500',
  error: 'text-red-500',
  document: 'text-purple-500',
  status: 'text-indigo-500',
}

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  created: 'Processo criado',
  status_changed: 'Status alterado',
  protocol_added: 'Protocolo adicionado',
  document_uploaded: 'Documento enviado',
  document_approved: 'Documento aprovado',
  document_rejected: 'Documento reprovado',
  observation_added: 'Observação adicionada',
  field_changed: 'Campo atualizado',
  completed: 'Processo concluído',
  archived: 'Processo arquivado',
  cancelled: 'Processo cancelado',
  updated: 'Processo atualizado',
}

export interface ProcessCustomFieldOption {
  value: string
  label: string
}

export interface ProcessCustomFieldDefinition {
  field_name: string
  field_label: string
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'currency'
  options?: ProcessCustomFieldOption[]
  help_text?: string
}

export const PROCESS_TYPE_CUSTOM_FIELDS: Record<string, ProcessCustomFieldDefinition[]> = {
  resumo: [
    { field_name: 'imesc', field_label: 'IMESC', field_type: 'text' },
    { field_name: 'ipi', field_label: 'IPI', field_type: 'text' },
    { field_name: 'icms', field_label: 'ICMS', field_type: 'text' },
    { field_name: 'ipva', field_label: 'IPVA', field_type: 'text' },
    { field_name: 'laudo', field_label: 'Laudo', field_type: 'text' },
  ],
  cin: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
    { field_name: 'pago', field_label: 'Pago', field_type: 'boolean' },
  ],
  estacionamento: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
  ],
  cnh_especial: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
  ],
  processo_ipi: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
  ],
  processo_icms: [],
  processo_iof: [],
  processo_ipva: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
    {
      field_name: 'imesc_status',
      field_label: 'Situação da perícia/laudo IMESC',
      field_type: 'select',
      options: [
        { value: 'nao_iniciado', label: 'Ainda não iniciado' },
        { value: 'agendado', label: 'Perícia agendada' },
        { value: 'pericia_realizada', label: 'Perícia realizada — aguardando laudo' },
        { value: 'laudo_disponivel', label: 'Laudo disponível' },
        { value: 'laudo_anterior_reaproveitado', label: 'Laudo anterior reaproveitado' },
        { value: 'dispensa_documentada', label: 'Dispensa formalmente documentada' },
      ],
      help_text: 'Em São Paulo, registre separadamente a perícia, o laudo e a decisão da SEFAZ.',
    },
    { field_name: 'imesc_data_pericia', field_label: 'Data da perícia IMESC', field_type: 'date' },
    { field_name: 'imesc_data_laudo', field_label: 'Data de emissão do laudo IMESC', field_type: 'date' },
    {
      field_name: 'imesc_grau',
      field_label: 'Classificação no laudo IMESC',
      field_type: 'select',
      options: [
        { value: 'sem_deficiencia', label: 'Inexistência de deficiência' },
        { value: 'leve', label: 'Leve' },
        { value: 'moderada', label: 'Moderada' },
        { value: 'grave', label: 'Grave' },
        { value: 'gravissima', label: 'Gravíssima' },
      ],
      help_text: 'Copie a classificação exatamente como consta no laudo; não a deduza pelo diagnóstico.',
    },
    { field_name: 'imesc_protocolo', field_label: 'Protocolo/laudo IMESC', field_type: 'text' },
    {
      field_name: 'sefaz_ipva_status',
      field_label: 'Decisão da SEFAZ',
      field_type: 'select',
      options: [
        { value: 'nao_protocolado', label: 'Pedido ainda não protocolado' },
        { value: 'em_analise', label: 'Em análise' },
        { value: 'deferido', label: 'Deferido' },
        { value: 'deferido_com_condicao', label: 'Deferido com condição' },
        { value: 'indeferido', label: 'Indeferido' },
        { value: 'recurso_em_andamento', label: 'Recurso em andamento' },
      ],
    },
    { field_name: 'sefaz_data_ciencia', field_label: 'Data da ciência da decisão', field_type: 'date' },
    { field_name: 'recurso_ipva_protocolado_em', field_label: 'Recurso protocolado em', field_type: 'date' },
    { field_name: 'recurso_ipva_protocolo', field_label: 'Protocolo do recurso IPVA', field_type: 'text' },
    { field_name: 'imesc', field_label: 'Observações sobre IMESC', field_type: 'text' },
  ],
  imposto_de_renda: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
  ],
  laudo: [
    { field_name: 'perfil', field_label: 'Perfil', field_type: 'text' },
    { field_name: 'emissao', field_label: 'Emissão', field_type: 'date' },
    { field_name: 'pagamento_cliente', field_label: 'Pagamento do Cliente', field_type: 'currency' },
    { field_name: 'pagamento_clinica', field_label: 'Pagamento para Clínica', field_type: 'currency' },
    { field_name: 'clinica_solicitada', field_label: 'Clínica Solicitada', field_type: 'text' },
  ],
  emplacamento: [
    { field_name: 'valor_pago', field_label: 'Valor Pago', field_type: 'currency' },
  ],
  rodizio: [
    { field_name: 'senha_gov', field_label: 'Senha Gov.br', field_type: 'text' },
  ],
}

export function getCustomFieldOptionLabel(processTypeSlug: string, fieldName: string, value: string): string {
  const field = (PROCESS_TYPE_CUSTOM_FIELDS[processTypeSlug] ?? [])
    .find(item => item.field_name === fieldName)
  return field?.options?.find(option => option.value === value)?.label ?? value
}
