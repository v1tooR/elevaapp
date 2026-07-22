export type UserRole = 'super_admin' | 'admin' | 'analista' | 'cliente'

export type ProcessStatus =
  | 'aberto'
  | 'em_andamento'
  | 'aguardando_documentos'
  | 'em_analise'
  | 'aguardando_orgao'
  | 'concluido'
  | 'arquivado'
  | 'cancelado'

export type DocumentStatus =
  | 'pending'
  | 'received'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'resend_required'

export type PaymentStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'canceled'

export type EventVisibility = 'admin_only' | 'client_visible'
export type EventStatus = 'pending' | 'in_progress' | 'completed' | 'canceled'
export type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'document' | 'status'

export type HistoryActionType =
  | 'created'
  | 'status_changed'
  | 'protocol_added'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'observation_added'
  | 'field_changed'
  | 'completed'
  | 'archived'
  | 'cancelled'
  | 'updated'
  | 'client_message'

// --- Leads ---
export type LeadStatus = 'novo' | 'em_atendimento' | 'convertido' | 'perdido'
export type LeadSource = 'instagram' | 'google' | 'indicacao' | 'vendedor' | 'outros'

// --- Shared enums ---
export type DisabilityType = 'fisica' | 'auditiva' | 'visual' | 'monocular' | 'autismo' | 'mental'
export type ClientType = 'condutor' | 'nao_condutor'
export type GovAccessStatus = 'nao_validado' | 'aguardando_cliente' | 'validado' | 'com_pendencia'
export type GovAccountLevel = 'bronze' | 'prata' | 'ouro'
export type DisabilitySeverity = 'leve' | 'moderada' | 'grave' | 'gravissima' | 'nao_informada'
export type CnhStatus = 'nao_possui' | 'comum' | 'com_restricoes' | 'em_regularizacao' | 'inapto_temporario' | 'inapto'
export type MedicalAssessmentStatus = 'nao_realizada' | 'agendada' | 'apto' | 'apto_com_restricoes' | 'inapto_temporario' | 'inapto'
export type VehicleCondition = 'zero_km' | 'usado'
export type EligibilityStatus =
  | 'pre_elegivel'
  | 'pendente_informacoes'
  | 'requer_validacao'
  | 'provavelmente_nao_elegivel'
  | 'elegibilidade_confirmada'

export interface AuthorizedDriver {
  name: string
  cpf: string
  cnh: string
}

// --- Process Stages ---
export type StageStatus =
  | 'pendente'
  | 'em_andamento'
  | 'concluido'
  | 'aprovado'
  | 'reprovado'
  | 'nao_aplicavel'

export interface Profile {
  id: string
  auth_user_id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  is_active: boolean
  must_change_password?: boolean
  mfa_required?: boolean
  mfa_enrolled_at?: string
  invited_at?: string
  deactivated_at?: string
  deactivated_by?: string
  offboarding_note?: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  profile_id?: string
  name: string
  cpf?: string
  cpf_normalized?: string
  rg?: string
  birth_date?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  gov_access_status?: GovAccessStatus
  gov_auth_by_client?: boolean
  gov_account_level?: GovAccountLevel
  gov_account_level_sufficient?: boolean | null
  gov_access_last_validated_at?: string
  gov_access_pending_note?: string
  gov_access_validated_by?: string
  internal_notes?: string
  is_active: boolean
  // eligibility fields (migration 007)
  client_type?: ClientType
  disability_type?: DisabilityType
  disability_types?: DisabilityType[]
  has_cnh_especial?: boolean
  disability_severity?: DisabilitySeverity
  disability_details?: string
  cnh_status?: CnhStatus
  cnh_restrictions?: string[]
  medical_assessment_status?: MedicalAssessmentStatus
  requires_adapted_vehicle?: boolean | null
  requires_practical_exam?: boolean | null
  authorized_drivers?: AuthorizedDriver[]
  eligibility_notes?: string
  receives_loas_bpc?: boolean
  has_medical_report?: boolean
  report_valid_until?: string
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Lead {
  id: string
  name: string
  phone?: string
  is_driver?: boolean
  has_cnh_especial?: boolean
  cnh_status?: CnhStatus
  medical_assessment_status?: MedicalAssessmentStatus
  requires_practical_exam?: boolean | null
  disability_type?: DisabilityType
  has_medical_report?: boolean
  report_valid?: boolean
  lead_source?: LeadSource
  assigned_to?: string
  status: LeadStatus
  converted_client_id?: string
  notes?: string
  created_at: string
  updated_at: string
  assignee?: Profile
  converted_client?: Client
}

export interface ProcessType {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  color: string
  is_active: boolean
  renewal_period_months?: number | null
  renewal_notes?: string | null
  created_at: string
  updated_at: string
}

export interface Process {
  id: string
  client_id: string
  process_type_id: string
  title?: string
  protocol?: string
  status: ProcessStatus
  responsible_user_id?: string
  started_at?: string
  completed_at?: string
  observations?: string
  next_action?: string
  action_owner?: 'equipe' | 'cliente' | 'orgao' | 'terceiro'
  action_due_date?: string
  blocked_reason?: string
  last_client_update_at?: string
  jurisdiction_state?: string
  vehicle_condition?: VehicleCondition
  eligibility_status?: EligibilityStatus
  eligibility_analysis?: Record<string, unknown>
  eligibility_review_notes?: string
  eligibility_reviewed_at?: string
  eligibility_reviewed_by?: string
  renewal_date?: string | null
  renewal_calendar_event_id?: string | null
  created_at: string
  updated_at: string
  client?: Client
  process_type?: ProcessType
  responsible_user?: Profile
  custom_fields?: ProcessCustomField[]
  financials?: ProcessFinancial
  stages?: ProcessStage[]
}

export interface ProcessStage {
  id: string
  process_id: string
  stage_key: string
  label: string
  sort_order: number
  status: StageStatus
  scheduled_date?: string
  due_date?: string
  attended?: boolean
  result?: string
  data: Record<string, unknown>
  notes?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface ProcessCustomField {
  id: string
  process_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'currency'
  field_value?: string
  sort_order: number
  client_visible?: boolean
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  client_id: string
  process_id?: string
  process_stage_id?: string
  document_type?: string
  file_name: string
  file_url: string
  storage_path: string
  file_size?: number
  mime_type?: string
  status: DocumentStatus
  visibility?: 'admin_only' | 'client_visible'
  requested_at?: string
  requested_by?: string
  review_responsible_id?: string
  uploaded_by?: string
  reviewed_by?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
  client?: Client
  process?: Process
  uploader?: Profile
  reviewer?: Profile
  review_responsible?: Profile
}

export interface ProcessHistory {
  id: string
  process_id: string
  changed_by?: string
  action_type: HistoryActionType
  old_value?: string
  new_value?: string
  note?: string
  client_visible?: boolean
  created_at: string
  changer?: Profile
}

export interface Notification {
  id: string
  user_id: string
  client_id?: string
  process_id?: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  source_key?: string
  available_at: string
  is_canceled: boolean
  created_at: string
  client?: Client
  process?: Process
}

export type EventType = 'normal' | 'renewal' | 'deadline' | 'reminder'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  event_date: string
  event_time?: string
  event_type: EventType
  source_key?: string
  color?: string | null
  client_id?: string
  process_id?: string
  responsible_user_id?: string
  visibility: EventVisibility
  status: EventStatus
  created_at: string
  updated_at: string
  client?: Client
  process?: Process
  responsible_user?: Profile
}

export interface LegalRuleVersion {
  id: string
  process_type_slug: string
  rule_key: string
  version: string
  title: string
  source_url: string
  effective_from: string
  effective_to?: string
  rule_data: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProcessFinancial {
  id: string
  process_id: string
  service_value?: number
  payment_method?: 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'
  payment_status: PaymentStatus
  expected_payment_date?: string
  paid_at?: string
  financial_notes?: string
  created_at: string
  updated_at: string
}

// Database generic type for Supabase
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      clients: {
        Row: Client
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>
      }
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>
      }
      process_types: {
        Row: ProcessType
        Insert: Omit<ProcessType, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProcessType, 'id' | 'created_at' | 'updated_at'>>
      }
      processes: {
        Row: Process
        Insert: Omit<Process, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>
      }
      process_stages: {
        Row: ProcessStage
        Insert: Omit<ProcessStage, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProcessStage, 'id' | 'created_at' | 'updated_at'>>
      }
      process_custom_fields: {
        Row: ProcessCustomField
        Insert: Omit<ProcessCustomField, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProcessCustomField, 'id' | 'created_at' | 'updated_at'>>
      }
      documents: {
        Row: Document
        Insert: Omit<Document, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Document, 'id' | 'created_at' | 'updated_at'>>
      }
      process_history: {
        Row: ProcessHistory
        Insert: Omit<ProcessHistory, 'id' | 'created_at'>
        Update: never
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Pick<Notification, 'is_read'>>
      }
      calendar_events: {
        Row: CalendarEvent
        Insert: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>>
      }
      process_financials: {
        Row: ProcessFinancial
        Insert: Omit<ProcessFinancial, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProcessFinancial, 'id' | 'created_at' | 'updated_at'>>
      }
      legal_rule_versions: {
        Row: LegalRuleVersion
        Insert: Omit<LegalRuleVersion, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<LegalRuleVersion, 'id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
