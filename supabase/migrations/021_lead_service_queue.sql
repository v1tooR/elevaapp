-- =====================================================
-- ELEVA ISENÇÕES - Serviços múltiplos e fila do cliente
-- =====================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS intended_services TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.leads
SET intended_services = ARRAY[intended_service]
WHERE intended_service IS NOT NULL
  AND CARDINALITY(intended_services) = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_intended_services_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_intended_services_check
      CHECK (
        intended_services <@ ARRAY[
          'cnh_especial', 'ipi', 'icms', 'ipva',
          'credencial_estacionamento', 'cin', 'emplacamento',
          'renovacao', 'isencao_ir', 'aposentadoria', 'alvara'
        ]::TEXT[]
      );
  END IF;
END $$;

-- Tipos que já podiam ser contratados no lead, mas ainda não possuíam
-- um tipo de processo correspondente.
INSERT INTO public.process_types (name, slug, description, color)
VALUES
  ('Renovação', 'renovacao', 'Renovação de documento ou benefício contratado', '#6366F1'),
  ('Aposentadoria', 'aposentadoria', 'Acompanhamento do processo de aposentadoria', '#8B5CF6'),
  ('Alvará', 'alvara', 'Acompanhamento de solicitação ou renovação de alvará', '#14B8A6')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS service_order INTEGER,
  ADD COLUMN IF NOT EXISTS origin_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'processes_service_order_check'
  ) THEN
    ALTER TABLE public.processes
      ADD CONSTRAINT processes_service_order_check
      CHECK (service_order IS NULL OR service_order > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_processes_origin_lead_type
  ON public.processes(origin_lead_id, process_type_id)
  WHERE origin_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processes_client_service_order
  ON public.processes(client_id, service_order)
  WHERE service_order IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prioritize_client_service_process(
  p_client_id UUID,
  p_process_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_process_id UUID;
  v_target_status TEXT;
  v_position INTEGER := 1;
  v_process RECORD;
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT process.status
  INTO v_target_status
  FROM public.processes process
  WHERE process.id = p_process_id
    AND process.client_id = p_client_id
    AND process.service_order IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não pertence à fila deste cliente';
  END IF;

  IF v_target_status IN ('concluido', 'arquivado', 'cancelado') THEN
    RAISE EXCEPTION 'Um processo encerrado não pode ser definido como próximo';
  END IF;

  -- A CNH Especial aberta sempre permanece como processo atual. Sem CNH,
  -- o primeiro processo aberto da ordem vigente é mantido como atual.
  SELECT process.id
  INTO v_current_process_id
  FROM public.processes process
  JOIN public.process_types process_type ON process_type.id = process.process_type_id
  WHERE process.client_id = p_client_id
    AND process.service_order IS NOT NULL
    AND process.status NOT IN ('concluido', 'arquivado', 'cancelado')
  ORDER BY
    CASE WHEN process_type.slug = 'cnh_especial' THEN 0 ELSE 1 END,
    process.service_order,
    process.created_at,
    process.id
  LIMIT 1
  FOR UPDATE OF process;

  IF v_current_process_id = p_process_id THEN
    RETURN;
  END IF;

  -- Processos encerrados preservam o histórico. Em seguida vêm o atual,
  -- o processo escolhido como próximo e os demais itens da fila.
  FOR v_process IN
    SELECT process.id
    FROM public.processes process
    WHERE process.client_id = p_client_id
      AND process.service_order IS NOT NULL
    ORDER BY
      CASE
        WHEN process.status IN ('concluido', 'arquivado', 'cancelado') THEN 0
        WHEN process.id = v_current_process_id THEN 1
        WHEN process.id = p_process_id THEN 2
        ELSE 3
      END,
      process.service_order,
      process.created_at,
      process.id
  LOOP
    UPDATE public.processes
    SET service_order = v_position
    WHERE id = v_process.id;

    v_position := v_position + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.prioritize_client_service_process(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prioritize_client_service_process(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_next_client_service_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_process_id UUID;
BEGIN
  IF NEW.service_order IS NULL
     OR NEW.status NOT IN ('concluido', 'arquivado', 'cancelado')
     OR OLD.status IN ('concluido', 'arquivado', 'cancelado') THEN
    RETURN NEW;
  END IF;

  SELECT process.id
  INTO v_next_process_id
  FROM public.processes process
  WHERE process.client_id = NEW.client_id
    AND process.service_order IS NOT NULL
    AND process.status NOT IN ('concluido', 'arquivado', 'cancelado')
  ORDER BY process.service_order, process.created_at, process.id
  LIMIT 1;

  IF v_next_process_id IS NOT NULL THEN
    UPDATE public.processes
    SET status = 'em_andamento'
    WHERE id = v_next_process_id
      AND status = 'aberto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activate_next_client_service_process
  ON public.processes;
CREATE TRIGGER activate_next_client_service_process
  AFTER UPDATE OF status ON public.processes
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_next_client_service_process();

COMMENT ON COLUMN public.leads.intended_services IS
  'Serviços selecionados no lead; permite múltiplas escolhas e preserva a ordem.';
COMMENT ON COLUMN public.processes.service_order IS
  'Posição do processo na fila de serviços contratados pelo cliente.';
COMMENT ON COLUMN public.processes.origin_lead_id IS
  'Lead cuja conversão originou este processo da fila de serviços.';
