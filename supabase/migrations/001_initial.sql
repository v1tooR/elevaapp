-- =====================================================
-- ELEVA ISENÇÕES - Schema Inicial
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('super_admin', 'admin', 'analista', 'cliente')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: clients
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  gov_password_reference TEXT,
  internal_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: process_types
-- =====================================================
CREATE TABLE IF NOT EXISTS public.process_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir tipos de processo da planilha
INSERT INTO public.process_types (name, slug, description, color) VALUES
  ('Resumo Geral', 'resumo', 'Resumo geral dos processos do cliente', '#6366F1'),
  ('CIN', 'cin', 'Carteira de Identificação Nacional', '#8B5CF6'),
  ('Estacionamento PCD', 'estacionamento', 'Credencial de estacionamento para PCD', '#06B6D4'),
  ('CNH Especial', 'cnh_especial', 'Carteira Nacional de Habilitação Especial', '#10B981'),
  ('Processo IPI', 'processo_ipi', 'Isenção de IPI para PCD', '#F59E0B'),
  ('Processo ICMS', 'processo_icms', 'Isenção de ICMS para PCD', '#EF4444'),
  ('Processo IPVA', 'processo_ipva', 'Isenção de IPVA para PCD', '#EC4899'),
  ('Imposto de Renda', 'imposto_de_renda', 'Declaração de Imposto de Renda', '#14B8A6'),
  ('Laudo', 'laudo', 'Laudo médico para PCD', '#F97316'),
  ('Emplacamento', 'emplacamento', 'Emplacamento de veículo PCD', '#84CC16'),
  ('Rodízio', 'rodizio', 'Isenção de rodízio para PCD', '#A78BFA')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- TABELA: processes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  process_type_id UUID NOT NULL REFERENCES public.process_types(id) ON DELETE RESTRICT,
  title TEXT,
  protocol TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN (
    'aberto', 'em_andamento', 'aguardando_documentos', 'em_analise',
    'aguardando_orgao', 'concluido', 'arquivado', 'cancelado'
  )),
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: process_custom_fields
-- =====================================================
CREATE TABLE IF NOT EXISTS public.process_custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'currency')),
  field_value TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: documents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  document_type TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'received', 'under_review', 'approved', 'rejected', 'resend_required'
  )),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: process_history
-- =====================================================
CREATE TABLE IF NOT EXISTS public.process_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created', 'status_changed', 'protocol_added', 'document_uploaded',
    'document_approved', 'document_rejected', 'observation_added',
    'field_changed', 'completed', 'archived', 'cancelled', 'updated'
  )),
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'document', 'status')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: calendar_events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'client_visible')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABELA: process_financials
-- =====================================================
CREATE TABLE IF NOT EXISTS public.process_financials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL UNIQUE REFERENCES public.processes(id) ON DELETE CASCADE,
  service_value DECIMAL(10,2),
  payment_method TEXT CHECK (payment_method IN ('pix', 'cartao', 'boleto', 'dinheiro', 'transferencia', NULL)),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'partially_paid', 'paid', 'overdue', 'canceled'
  )),
  expected_payment_date DATE,
  paid_at TIMESTAMPTZ,
  financial_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_profile_id ON public.clients(profile_id);
CREATE INDEX IF NOT EXISTS idx_processes_client_id ON public.processes(client_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON public.processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_type_id ON public.processes(process_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON public.documents(process_id);
CREATE INDEX IF NOT EXISTS idx_process_history_process_id ON public.process_history(process_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(event_date);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_process_types_updated_at BEFORE UPDATE ON public.process_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_process_custom_fields_updated_at BEFORE UPDATE ON public.process_custom_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_process_financials_updated_at BEFORE UPDATE ON public.process_financials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_financials ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get current user profile id
CREATE OR REPLACE FUNCTION get_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get client_id for current user (if role = 'cliente')
CREATE OR REPLACE FUNCTION get_client_id()
RETURNS UUID AS $$
  SELECT c.id FROM public.clients c
  JOIN public.profiles p ON p.id = c.profile_id
  WHERE p.auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (get_user_role() IN ('super_admin', 'admin'));

-- Policies for clients
CREATE POLICY "Staff can view all clients" ON public.clients FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can view own record" ON public.clients FOR SELECT USING (profile_id = get_profile_id());
CREATE POLICY "Staff can manage clients" ON public.clients FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

-- Policies for process_types
CREATE POLICY "Everyone can view process types" ON public.process_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage process types" ON public.process_types FOR ALL USING (get_user_role() IN ('super_admin', 'admin'));

-- Policies for processes
CREATE POLICY "Staff can view all processes" ON public.processes FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can view own processes" ON public.processes FOR SELECT USING (client_id = get_client_id());
CREATE POLICY "Staff can manage processes" ON public.processes FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

-- Policies for process_custom_fields
CREATE POLICY "Staff can view all custom fields" ON public.process_custom_fields FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can view own custom fields" ON public.process_custom_fields FOR SELECT USING (
  process_id IN (SELECT id FROM public.processes WHERE client_id = get_client_id())
);
CREATE POLICY "Staff can manage custom fields" ON public.process_custom_fields FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

-- Policies for documents
CREATE POLICY "Staff can view all documents" ON public.documents FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can view own documents" ON public.documents FOR SELECT USING (client_id = get_client_id());
CREATE POLICY "Staff can manage documents" ON public.documents FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can upload own documents" ON public.documents FOR INSERT WITH CHECK (client_id = get_client_id());

-- Policies for process_history
CREATE POLICY "Staff can view all history" ON public.process_history FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can view own history" ON public.process_history FOR SELECT USING (
  process_id IN (SELECT id FROM public.processes WHERE client_id = get_client_id())
);
CREATE POLICY "Staff can manage history" ON public.process_history FOR INSERT WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'analista'));

-- Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = get_profile_id());
CREATE POLICY "Staff can manage notifications" ON public.notifications FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = get_profile_id());

-- Policies for calendar_events
CREATE POLICY "Staff can view all events" ON public.calendar_events FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Client can view visible events" ON public.calendar_events FOR SELECT USING (
  visibility = 'client_visible' AND client_id = get_client_id()
);
CREATE POLICY "Staff can manage events" ON public.calendar_events FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

-- Policies for process_financials
CREATE POLICY "Staff can view all financials" ON public.process_financials FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
CREATE POLICY "Staff can manage financials" ON public.process_financials FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
