-- =====================================================
-- ELEVA ISENÇÕES - Etapas de Processo (genéricas)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.process_stages (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id     UUID        NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  stage_key      TEXT        NOT NULL,
  label          TEXT        NOT NULL,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'pendente'
                             CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'aprovado', 'reprovado', 'nao_aplicavel')),
  scheduled_date DATE,
  attended       BOOLEAN,
  result         TEXT,
  data           JSONB       NOT NULL DEFAULT '{}',
  notes          TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_stages_process_sort ON public.process_stages(process_id, sort_order);

CREATE TRIGGER update_process_stages_updated_at
  BEFORE UPDATE ON public.process_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.process_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage process stages" ON public.process_stages
  FOR ALL USING (get_user_role() IN ('super_admin', 'admin', 'analista'));

CREATE POLICY "Client can view own process stages" ON public.process_stages
  FOR SELECT USING (
    process_id IN (SELECT id FROM public.processes WHERE client_id = get_client_id())
  );
