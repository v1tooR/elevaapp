-- =====================================================
-- ELEVA ISENÇÕES - Leads
-- =====================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT        NOT NULL,
  phone               TEXT,
  is_driver           BOOLEAN,
  has_cnh_especial    BOOLEAN,
  disability_type     TEXT        CHECK (disability_type IN ('fisica', 'auditiva', 'visual', 'monocular', 'autismo', 'mental')),
  has_medical_report  BOOLEAN,
  report_valid        BOOLEAN,
  lead_source         TEXT        CHECK (lead_source IN ('instagram', 'google', 'indicacao', 'vendedor', 'outros')),
  assigned_to         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status              TEXT        NOT NULL DEFAULT 'novo'
                                  CHECK (status IN ('novo', 'em_atendimento', 'convertido', 'perdido')),
  converted_client_id UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status      ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Apenas staff acessa leads; cliente não tem visibilidade
CREATE POLICY "Staff can manage leads" ON public.leads
  FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));
