-- =====================================================
-- ELEVA ISENÇÕES - Módulo Financeiro
-- =====================================================

-- =====================================================
-- TABELA: finance_categories
-- =====================================================
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias padrão
INSERT INTO public.finance_categories (name, color) VALUES
  ('Honorários', '#10B981'),
  ('IPI', '#F59E0B'),
  ('ICMS', '#EF4444'),
  ('IPVA', '#EC4899'),
  ('CNH Especial', '#8B5CF6'),
  ('Estacionamento', '#06B6D4'),
  ('Laudo Médico', '#F97316'),
  ('Emplacamento', '#84CC16'),
  ('Imposto de Renda', '#14B8A6'),
  ('Despesas Operacionais', '#6B7280'),
  ('Outros', '#9CA3AF')
ON CONFLICT DO NOTHING;

-- =====================================================
-- TABELA: finance_entries
-- =====================================================
CREATE TABLE IF NOT EXISTS public.finance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'PREDICTED', 'OVERDUE')),
  recurrence TEXT NOT NULL DEFAULT 'NONE' CHECK (recurrence IN ('NONE', 'WEEKLY', 'MONTHLY', 'ANNUAL')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finance_entries_type ON public.finance_entries(type);
CREATE INDEX IF NOT EXISTS idx_finance_entries_status ON public.finance_entries(status);
CREATE INDEX IF NOT EXISTS idx_finance_entries_occurred_at ON public.finance_entries(occurred_at);
CREATE INDEX IF NOT EXISTS idx_finance_entries_category_id ON public.finance_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_process_id ON public.finance_entries(process_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_client_id ON public.finance_entries(client_id);

-- Updated_at trigger
CREATE TRIGGER update_finance_entries_updated_at
  BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

-- finance_categories: todos os staff podem ver e admin+ gerencia
CREATE POLICY "Staff can view finance categories" ON public.finance_categories
  FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

CREATE POLICY "Admins can manage finance categories" ON public.finance_categories
  FOR ALL USING (get_user_role() IN ('super_admin', 'admin'));

-- finance_entries: staff pode ver, admin+ gerencia
CREATE POLICY "Staff can view finance entries" ON public.finance_entries
  FOR SELECT USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

CREATE POLICY "Staff can manage finance entries" ON public.finance_entries
  FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
