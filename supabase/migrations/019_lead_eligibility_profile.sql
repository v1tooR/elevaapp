-- =====================================================
-- ELEVA ISENÇÕES - Perfil completo de elegibilidade no lead
-- =====================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS disability_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cnh_restrictions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS receives_loas_bpc BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_legal_representative BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS intended_service TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_disability_types_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_disability_types_check
      CHECK (
        disability_types <@ ARRAY[
          'fisica', 'auditiva', 'visual', 'monocular', 'autismo', 'mental'
        ]::TEXT[]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_intended_service_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_intended_service_check
      CHECK (
        intended_service IS NULL
        OR intended_service IN (
          'cnh_especial', 'ipi', 'icms', 'ipva',
          'credencial_estacionamento', 'cin', 'emplacamento',
          'renovacao', 'isencao_ir', 'aposentadoria', 'alvara'
        )
      );
  END IF;
END $$;

UPDATE public.leads
SET disability_types = ARRAY[disability_type]
WHERE disability_type IS NOT NULL
  AND CARDINALITY(disability_types) = 0;

-- No novo formulário, "possui laudo" já significa que o documento é útil
-- e está válido para o processo. Registros explicitamente vencidos passam
-- a responder "não", sem apagar o campo legado.
UPDATE public.leads
SET has_medical_report =
  COALESCE(has_medical_report, FALSE)
  AND COALESCE(report_valid, TRUE);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS has_legal_representative BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_cpf TEXT;

-- Completa clientes já convertidos sem sobrescrever dados posteriormente
-- enriquecidos no cadastro do cliente.
UPDATE public.clients client
SET disability_types = CASE
      WHEN CARDINALITY(client.disability_types) = 0
        THEN lead.disability_types
      ELSE client.disability_types
    END,
    cnh_restrictions = CASE
      WHEN CARDINALITY(client.cnh_restrictions) = 0
        THEN lead.cnh_restrictions
      ELSE client.cnh_restrictions
    END,
    receives_loas_bpc =
      COALESCE(client.receives_loas_bpc, FALSE)
      OR COALESCE(lead.receives_loas_bpc, FALSE),
    has_legal_representative =
      client.has_legal_representative OR lead.has_legal_representative,
    legal_representative_name =
      COALESCE(client.legal_representative_name, lead.legal_representative_name)
FROM public.leads lead
WHERE lead.converted_client_id = client.id;

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id UUID;
  v_disability_types TEXT[];
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

  v_disability_types := CASE
    WHEN CARDINALITY(v_lead.disability_types) > 0
      THEN v_lead.disability_types
    WHEN v_lead.disability_type IS NOT NULL
      THEN ARRAY[v_lead.disability_type]
    ELSE ARRAY[]::TEXT[]
  END;

  INSERT INTO public.clients (
    name, phone, client_type, disability_type, disability_types,
    has_cnh_especial, cnh_status, cnh_restrictions,
    medical_assessment_status, requires_practical_exam,
    receives_loas_bpc, has_medical_report,
    has_legal_representative, legal_representative_name,
    is_active
  ) VALUES (
    v_lead.name,
    v_lead.phone,
    CASE
      WHEN v_lead.is_driver IS NULL THEN NULL
      WHEN v_lead.is_driver THEN 'condutor'
      ELSE 'nao_condutor'
    END,
    COALESCE(v_lead.disability_type, v_disability_types[1]),
    v_disability_types,
    COALESCE(v_lead.has_cnh_especial, FALSE),
    COALESCE(
      v_lead.cnh_status,
      CASE
        WHEN v_lead.has_cnh_especial THEN 'com_restricoes'
        WHEN v_lead.is_driver IS FALSE THEN 'nao_possui'
        ELSE NULL
      END
    ),
    COALESCE(v_lead.cnh_restrictions, ARRAY[]::TEXT[]),
    COALESCE(v_lead.medical_assessment_status, 'nao_realizada'),
    v_lead.requires_practical_exam,
    COALESCE(v_lead.receives_loas_bpc, FALSE),
    COALESCE(v_lead.has_medical_report, FALSE),
    COALESCE(v_lead.has_legal_representative, FALSE),
    v_lead.legal_representative_name,
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

COMMENT ON COLUMN public.leads.disability_types IS
  'Condições associadas selecionadas no lead; aceita múltiplos valores.';
COMMENT ON COLUMN public.leads.has_medical_report IS
  'Indica que existe laudo médico válido e útil para o processo pretendido.';
COMMENT ON COLUMN public.leads.legal_representative_name IS
  'Nome opcional na triagem; CPF é complementado no cadastro do cliente.';
