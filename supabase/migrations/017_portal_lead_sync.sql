-- =====================================================
-- ELEVA ISENÇÕES - Sincronização do portal e conversão de leads
-- =====================================================

-- Um processo recém-criado é sempre um evento seguro para o cliente. Esta
-- proteção independe da versão da RPC create_process_atomic instalada.
CREATE OR REPLACE FUNCTION public.enforce_created_process_history_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.action_type = 'created' THEN
    NEW.client_visible := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_created_process_history_visibility
  ON public.process_history;

CREATE TRIGGER enforce_created_process_history_visibility
  BEFORE INSERT OR UPDATE OF action_type, client_visible
  ON public.process_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_created_process_history_visibility();

UPDATE public.process_history
SET client_visible = TRUE
WHERE action_type = 'created'
  AND client_visible IS DISTINCT FROM TRUE;

-- Conversão idempotente: duas requisições simultâneas retornam o mesmo cliente
-- e um lead legado marcado como convertido, mas sem vínculo, pode ser reparado.
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.converted_client_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'convertido'
    WHERE id = p_lead_id
      AND status IS DISTINCT FROM 'convertido';

    RETURN v_lead.converted_client_id;
  END IF;

  INSERT INTO public.clients (
    name, phone, client_type, disability_type, disability_types,
    has_cnh_especial, cnh_status, medical_assessment_status,
    requires_practical_exam, has_medical_report, is_active
  ) VALUES (
    v_lead.name,
    v_lead.phone,
    CASE WHEN v_lead.is_driver THEN 'condutor' ELSE 'nao_condutor' END,
    v_lead.disability_type,
    CASE
      WHEN v_lead.disability_type IS NULL THEN ARRAY[]::TEXT[]
      ELSE ARRAY[v_lead.disability_type]
    END,
    COALESCE(v_lead.has_cnh_especial, FALSE),
    COALESCE(
      v_lead.cnh_status,
      CASE
        WHEN v_lead.has_cnh_especial THEN 'com_restricoes'
        WHEN v_lead.is_driver THEN NULL
        ELSE 'nao_possui'
      END
    ),
    COALESCE(v_lead.medical_assessment_status, 'nao_realizada'),
    v_lead.requires_practical_exam,
    COALESCE(v_lead.has_medical_report, FALSE),
    TRUE
  )
  RETURNING id INTO v_client_id;

  UPDATE public.leads
  SET status = 'convertido',
      converted_client_id = v_client_id
  WHERE id = p_lead_id;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_client(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_client(UUID) TO authenticated;

-- Repara conversões incompletas criadas pelo antigo seletor de status.
DO $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id UUID;
BEGIN
  UPDATE public.leads
  SET status = 'convertido'
  WHERE converted_client_id IS NOT NULL
    AND status IS DISTINCT FROM 'convertido';

  FOR v_lead IN
    SELECT *
    FROM public.leads
    WHERE status = 'convertido'
      AND converted_client_id IS NULL
    FOR UPDATE
  LOOP
    INSERT INTO public.clients (
      name, phone, client_type, disability_type, disability_types,
      has_cnh_especial, cnh_status, medical_assessment_status,
      requires_practical_exam, has_medical_report, is_active
    ) VALUES (
      v_lead.name,
      v_lead.phone,
      CASE WHEN v_lead.is_driver THEN 'condutor' ELSE 'nao_condutor' END,
      v_lead.disability_type,
      CASE
        WHEN v_lead.disability_type IS NULL THEN ARRAY[]::TEXT[]
        ELSE ARRAY[v_lead.disability_type]
      END,
      COALESCE(v_lead.has_cnh_especial, FALSE),
      COALESCE(
        v_lead.cnh_status,
        CASE
          WHEN v_lead.has_cnh_especial THEN 'com_restricoes'
          WHEN v_lead.is_driver THEN NULL
          ELSE 'nao_possui'
        END
      ),
      COALESCE(v_lead.medical_assessment_status, 'nao_realizada'),
      v_lead.requires_practical_exam,
      COALESCE(v_lead.has_medical_report, FALSE),
      TRUE
    )
    RETURNING id INTO v_client_id;

    UPDATE public.leads
    SET converted_client_id = v_client_id
    WHERE id = v_lead.id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_converted_client_id
  ON public.leads(converted_client_id)
  WHERE converted_client_id IS NOT NULL;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_conversion_consistency;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_conversion_consistency CHECK (
    (status = 'convertido' AND converted_client_id IS NOT NULL)
    OR
    (status <> 'convertido' AND converted_client_id IS NULL)
  );
