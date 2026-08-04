-- =====================================================
-- ELEVA — visão completa do cliente e progressão automática
-- =====================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS legal_representative_cpf TEXT;

-- Recupera o CPF já complementado no cliente para leads históricos convertidos.
UPDATE public.leads lead
SET legal_representative_cpf = client.legal_representative_cpf
FROM public.clients client
WHERE lead.converted_client_id = client.id
  AND NULLIF(TRIM(COALESCE(lead.legal_representative_cpf, '')), '') IS NULL
  AND NULLIF(TRIM(COALESCE(client.legal_representative_cpf, '')), '') IS NOT NULL;

-- A conversão copia o CPF do representante e deixa decisões periciais e
-- validade de laudo somente em seus fluxos específicos.
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

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;

  IF v_lead.converted_client_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'convertido'
    WHERE id = p_lead_id AND status IS DISTINCT FROM 'convertido';
    RETURN v_lead.converted_client_id;
  END IF;

  v_disability_types := CASE
    WHEN CARDINALITY(v_lead.disability_types) > 0 THEN v_lead.disability_types
    WHEN v_lead.disability_type IS NOT NULL THEN ARRAY[v_lead.disability_type]
    ELSE ARRAY[]::TEXT[]
  END;

  INSERT INTO public.clients (
    name, phone, email, internal_notes,
    client_type, disability_type, disability_types,
    has_cnh_especial, cnh_status, cnh_restrictions,
    receives_loas_bpc, has_medical_report,
    has_legal_representative, legal_representative_name,
    legal_representative_cpf, is_active
  ) VALUES (
    v_lead.name,
    v_lead.phone,
    v_lead.email,
    NULLIF(TRIM(v_lead.notes), ''),
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
    COALESCE(v_lead.receives_loas_bpc, FALSE),
    COALESCE(v_lead.has_medical_report, FALSE),
    COALESCE(v_lead.has_legal_representative, FALSE),
    v_lead.legal_representative_name,
    v_lead.legal_representative_cpf,
    TRUE
  )
  RETURNING id INTO v_client_id;

  UPDATE public.leads
  SET status = 'convertido', converted_client_id = v_client_id
  WHERE id = p_lead_id;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_client(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_client(UUID) TO authenticated;

-- Libera o sucessor usando vínculo direto, atendimento ou lead de origem.
-- A função é idempotente e também cobre registros antigos parcialmente ligados.
CREATE OR REPLACE FUNCTION public.activate_service_successor(
  p_source_process_id UUID,
  p_successor_service_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source public.processes%ROWTYPE;
  v_successor_slug TEXT;
  v_activated INTEGER := 0;
BEGIN
  SELECT * INTO v_source
  FROM public.processes
  WHERE id = p_source_process_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  v_successor_slug := CASE p_successor_service_key
    WHEN 'ipi' THEN 'processo_ipi'
    WHEN 'icms' THEN 'processo_icms'
    ELSE NULL
  END;
  IF v_successor_slug IS NULL THEN RETURN 0; END IF;

  WITH candidate AS (
    SELECT successor.id
    FROM public.processes successor
    JOIN public.process_types successor_type
      ON successor_type.id = successor.process_type_id
    WHERE successor_type.slug = v_successor_slug
      AND successor.client_id = v_source.client_id
      AND successor.id <> v_source.id
      AND successor.status = 'aberto'
      AND (
        (
          v_source.service_engagement_id IS NOT NULL
          AND successor.service_engagement_id = v_source.service_engagement_id
        )
        OR (
          v_source.origin_lead_id IS NOT NULL
          AND successor.origin_lead_id = v_source.origin_lead_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.client_service_plan_items target_item
          WHERE target_item.id = successor.service_plan_item_id
            AND target_item.prerequisite_item_id = v_source.service_plan_item_id
        )
        OR (
          v_source.service_engagement_id IS NULL
          AND v_source.origin_lead_id IS NULL
          AND NULLIF(TRIM(COALESCE(successor.blocked_reason, '')), '') IS NOT NULL
        )
      )
    ORDER BY
      (v_source.service_engagement_id IS NOT NULL
        AND successor.service_engagement_id = v_source.service_engagement_id) DESC,
      (v_source.origin_lead_id IS NOT NULL
        AND successor.origin_lead_id = v_source.origin_lead_id) DESC,
      successor.created_at DESC
    LIMIT 1
  )
  UPDATE public.processes successor
  SET status = 'em_andamento',
      started_at = COALESCE(successor.started_at, NOW()),
      blocked_reason = NULL,
      next_action = COALESCE(NULLIF(successor.next_action, ''), 'Iniciar atendimento'),
      action_owner = COALESCE(NULLIF(successor.action_owner, ''), 'equipe')
  FROM candidate
  WHERE successor.id = candidate.id;

  GET DIAGNOSTICS v_activated = ROW_COUNT;

  -- Compatibilidade com plano antigo sem shell de processo.
  UPDATE public.client_service_plan_items target_item
  SET status = 'pronto_para_iniciar',
      ready_at = COALESCE(target_item.ready_at, NOW()),
      wait_reason = NULL
  WHERE target_item.prerequisite_item_id = v_source.service_plan_item_id
    AND target_item.process_id IS NULL
    AND target_item.status = 'planejado';

  RETURN v_activated;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_service_successor(UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.advance_service_chain_from_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process RECORD;
  v_should_advance BOOLEAN;
BEGIN
  SELECT process.id, process.status, type.slug
  INTO v_process
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  WHERE process.id = NEW.process_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_process.slug = 'cnh_especial'
     AND NEW.stage_key = 'emissao_cnh'
     AND NEW.status = 'concluido' THEN
    IF TG_OP = 'INSERT' THEN
      v_should_advance := TRUE;
    ELSE
      v_should_advance := OLD.status IS DISTINCT FROM 'concluido';
    END IF;

    IF v_should_advance THEN
      UPDATE public.processes
      SET status = 'concluido',
          completed_at = COALESCE(completed_at, NOW()),
          next_action = NULL,
          action_owner = NULL,
          blocked_reason = NULL
      WHERE id = NEW.process_id
        AND status NOT IN ('arquivado', 'cancelado');

      PERFORM public.activate_service_successor(NEW.process_id, 'ipi');
    END IF;
  END IF;

  IF v_process.slug = 'processo_ipi'
     AND NEW.stage_key = 'protocolo_sisen_ipi'
     AND (NEW.status = 'aprovado' OR NEW.result = 'deferido') THEN
    IF TG_OP = 'INSERT' THEN
      v_should_advance := TRUE;
    ELSE
      v_should_advance := NOT (
        COALESCE(OLD.status = 'aprovado', FALSE)
        OR COALESCE(OLD.result = 'deferido', FALSE)
      );
    END IF;

    IF v_should_advance THEN
      UPDATE public.processes
      SET status = 'concluido',
          completed_at = COALESCE(completed_at, NOW()),
          next_action = NULL,
          action_owner = NULL,
          blocked_reason = NULL
      WHERE id = NEW.process_id
        AND status NOT IN ('arquivado', 'cancelado');

      PERFORM public.activate_service_successor(NEW.process_id, 'icms');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advance_service_chain_from_stage ON public.process_stages;
CREATE TRIGGER advance_service_chain_from_stage
  AFTER INSERT OR UPDATE ON public.process_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.advance_service_chain_from_stage();

-- Libera agora cadeias que já estavam concluídas antes desta migration.
DO $$
DECLARE
  source_process RECORD;
BEGIN
  FOR source_process IN
    SELECT DISTINCT process.id, type.slug
    FROM public.processes process
    JOIN public.process_types type ON type.id = process.process_type_id
    JOIN public.process_stages stage ON stage.process_id = process.id
    WHERE (
      (
        type.slug = 'cnh_especial'
        AND stage.stage_key = 'emissao_cnh'
        AND stage.status = 'concluido'
      ) OR (
        type.slug = 'processo_ipi'
        AND stage.stage_key = 'protocolo_sisen_ipi'
        AND (stage.status = 'aprovado' OR stage.result = 'deferido')
      )
    )
    AND process.status NOT IN ('arquivado', 'cancelado')
  LOOP
    UPDATE public.processes
    SET status = 'concluido',
        completed_at = COALESCE(completed_at, NOW()),
        next_action = NULL,
        action_owner = NULL,
        blocked_reason = NULL
    WHERE id = source_process.id
      AND status <> 'concluido';

    PERFORM public.activate_service_successor(
      source_process.id,
      CASE source_process.slug WHEN 'cnh_especial' THEN 'ipi' ELSE 'icms' END
    );
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_leads_converted_client_updated
  ON public.leads(converted_client_id, updated_at DESC)
  WHERE converted_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processes_client_type_updated
  ON public.processes(client_id, process_type_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_stages_process_key_updated
  ON public.process_stages(process_id, stage_key, updated_at DESC);

-- Reaproveita concessionária, vendedor e valor que tenham sido preenchidos no
-- antigo estágio de transição do IPI. Dados já informados no ICMS prevalecem.
WITH legacy_purchase AS (
  SELECT DISTINCT ON (purchase.id)
    purchase.id AS purchase_stage_id,
    legacy.data AS legacy_data
  FROM public.process_stages purchase
  JOIN public.processes icms_process ON icms_process.id = purchase.process_id
  JOIN public.process_types icms_type
    ON icms_type.id = icms_process.process_type_id
   AND icms_type.slug = 'processo_icms'
  JOIN public.processes ipi_process
    ON ipi_process.client_id = icms_process.client_id
   AND (
     (
       icms_process.service_engagement_id IS NOT NULL
       AND ipi_process.service_engagement_id = icms_process.service_engagement_id
     )
     OR (
       icms_process.origin_lead_id IS NOT NULL
       AND ipi_process.origin_lead_id = icms_process.origin_lead_id
     )
   )
  JOIN public.process_types ipi_type
    ON ipi_type.id = ipi_process.process_type_id
   AND ipi_type.slug = 'processo_ipi'
  JOIN public.process_stages legacy
    ON legacy.process_id = ipi_process.id
   AND legacy.stage_key = 'transicao_compra_icms'
  WHERE purchase.stage_key = 'dados_compra_icms'
    AND legacy.data ?| ARRAY['dealership', 'salesperson', 'vehicle_price']
  ORDER BY purchase.id, ipi_process.updated_at DESC, legacy.updated_at DESC
)
UPDATE public.process_stages purchase
SET data = legacy_purchase.legacy_data || purchase.data
FROM legacy_purchase
WHERE purchase.id = legacy_purchase.purchase_stage_id;

-- Uma única linha por cliente para a operação comercial e documental.
CREATE OR REPLACE VIEW public.client_complete_rows
WITH (security_invoker = true)
AS
SELECT
  client.id AS client_id,
  client.name AS client_name,
  client.cpf AS client_cpf,
  client.phone AS client_phone,
  client.email AS client_email,
  client.city AS client_city,
  client.state AS client_state,
  client.is_active,
  client.cnh_status,
  client.cnh_expiry_date,
  contract.id AS contract_id,
  contract.contract_label,
  contract.status AS contract_status,
  contract.net_amount AS contract_value,
  contract.contracted_at,
  origin.lead_source,
  origin.referral_partner_id,
  origin.referral_partner_name AS indication_name,
  purchase.dealership,
  purchase.salesperson,
  purchase.vehicle AS purchase_vehicle,
  purchase.vehicle_price,
  purchase.purchase_date,
  purchase.next_vehicle_change_date,
  cnh.process_status AS cnh_process_status,
  cnh.stage_label AS cnh_stage_label,
  cin.process_status AS cin_process_status,
  cin.stage_label AS cin_stage_label,
  cin.valid_until AS cin_valid_until,
  credential.process_status AS credential_process_status,
  credential.stage_label AS credential_stage_label,
  credential.valid_until AS credential_valid_until,
  GREATEST(
    client.updated_at,
    COALESCE(contract.updated_at, client.updated_at),
    COALESCE(purchase.updated_at, client.updated_at),
    COALESCE(cnh.updated_at, client.updated_at),
    COALESCE(cin.updated_at, client.updated_at),
    COALESCE(credential.updated_at, client.updated_at)
  ) AS last_updated_at,
  LOWER(CONCAT_WS(
    ' ', client.name, client.cpf, client.phone, client.email,
    origin.referral_partner_name, purchase.dealership, purchase.salesperson,
    purchase.vehicle
  )) AS search_text
FROM public.clients client
LEFT JOIN LATERAL (
  SELECT
    financial.id,
    financial.status,
    financial.net_amount,
    financial.contracted_at,
    financial.updated_at,
    COALESCE(type.name, 'Contrato geral') AS contract_label
  FROM public.financial_contracts financial
  LEFT JOIN public.processes process ON process.id = financial.process_id
  LEFT JOIN public.process_types type ON type.id = process.process_type_id
  WHERE financial.client_id = client.id
    AND financial.status <> 'cancelado'
  ORDER BY (financial.status = 'ativo') DESC, financial.contracted_at DESC, financial.created_at DESC
  LIMIT 1
) contract ON TRUE
LEFT JOIN LATERAL (
  SELECT
    lead.lead_source,
    lead.referral_partner_id,
    partner.name AS referral_partner_name
  FROM public.leads lead
  LEFT JOIN public.referral_partners partner ON partner.id = lead.referral_partner_id
  WHERE lead.converted_client_id = client.id
  ORDER BY lead.updated_at DESC, lead.created_at DESC
  LIMIT 1
) origin ON TRUE
LEFT JOIN LATERAL (
  SELECT
    NULLIF(stage.data->>'dealership', '') AS dealership,
    NULLIF(stage.data->>'salesperson', '') AS salesperson,
    NULLIF(stage.data->>'vehicle', '') AS vehicle,
    NULLIF(stage.data->>'vehicle_price', '')::NUMERIC AS vehicle_price,
    NULLIF(stage.data->>'purchase_date', '')::DATE AS purchase_date,
    NULLIF(stage.data->>'next_vehicle_change_date', '')::DATE AS next_vehicle_change_date,
    GREATEST(process.updated_at, stage.updated_at) AS updated_at
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  JOIN public.process_stages stage
    ON stage.process_id = process.id AND stage.stage_key = 'dados_compra_icms'
  WHERE process.client_id = client.id
    AND type.slug = 'processo_icms'
    AND process.status NOT IN ('arquivado', 'cancelado')
  ORDER BY process.updated_at DESC, stage.updated_at DESC
  LIMIT 1
) purchase ON TRUE
LEFT JOIN LATERAL (
  SELECT
    process.status AS process_status,
    current_stage.label AS stage_label,
    GREATEST(process.updated_at, COALESCE(current_stage.updated_at, process.updated_at)) AS updated_at
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  LEFT JOIN LATERAL (
    SELECT stage.label, stage.updated_at
    FROM public.process_stages stage
    WHERE stage.process_id = process.id
      AND stage.stage_key NOT IN ('cnh_regularizada', 'liberado_isencoes')
    ORDER BY
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
      CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
    LIMIT 1
  ) current_stage ON TRUE
  WHERE process.client_id = client.id AND type.slug = 'cnh_especial'
  ORDER BY (process.status NOT IN ('concluido', 'arquivado', 'cancelado')) DESC, process.updated_at DESC
  LIMIT 1
) cnh ON TRUE
LEFT JOIN LATERAL (
  SELECT
    process.status AS process_status,
    current_stage.label AS stage_label,
    NULLIF((
      SELECT issued.data->>'valid_until'
      FROM public.process_stages issued
      WHERE issued.process_id = process.id
        AND issued.stage_key = 'emissao_cin'
      LIMIT 1
    ), '')::DATE AS valid_until,
    GREATEST(process.updated_at, COALESCE(current_stage.updated_at, process.updated_at)) AS updated_at
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  LEFT JOIN LATERAL (
    SELECT stage.label, stage.updated_at
    FROM public.process_stages stage
    WHERE stage.process_id = process.id
    ORDER BY
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
      CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
    LIMIT 1
  ) current_stage ON TRUE
  WHERE process.client_id = client.id AND type.slug = 'cin'
  ORDER BY (process.status NOT IN ('concluido', 'arquivado', 'cancelado')) DESC, process.updated_at DESC
  LIMIT 1
) cin ON TRUE
LEFT JOIN LATERAL (
  SELECT
    process.status AS process_status,
    current_stage.label AS stage_label,
    NULLIF((
      SELECT issued.data->>'valid_until'
      FROM public.process_stages issued
      WHERE issued.process_id = process.id
        AND issued.stage_key = 'emissao_estacionamento'
      LIMIT 1
    ), '')::DATE AS valid_until,
    GREATEST(process.updated_at, COALESCE(current_stage.updated_at, process.updated_at)) AS updated_at
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  LEFT JOIN LATERAL (
    SELECT stage.label, stage.updated_at
    FROM public.process_stages stage
    WHERE stage.process_id = process.id
    ORDER BY
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
      CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
    LIMIT 1
  ) current_stage ON TRUE
  WHERE process.client_id = client.id AND type.slug = 'estacionamento'
  ORDER BY (process.status NOT IN ('concluido', 'arquivado', 'cancelado')) DESC, process.updated_at DESC
  LIMIT 1
) credential ON TRUE;

GRANT SELECT ON public.client_complete_rows TO authenticated;

COMMENT ON COLUMN public.leads.legal_representative_cpf IS
  'CPF do representante coletado no lead e copiado automaticamente na conversão.';
COMMENT ON COLUMN public.clients.medical_assessment_status IS
  'Campo legado preservado para histórico; novas decisões ficam nas etapas do processo.';
COMMENT ON COLUMN public.clients.report_valid_until IS
  'Campo legado preservado; validade de laudo é registrada apenas no fluxo específico.';
COMMENT ON VIEW public.client_complete_rows IS
  'Visão completa de clientes com contrato, indicação, compra e situação de CNH, CIN e credencial.';
