-- =====================================================
-- ELEVA - conclusão do checklist P1 de cadastro e workflows
-- =====================================================

-- Nomes exibidos no catálogo, seletores, carteiras e resumo do cliente.
UPDATE public.process_types
SET name = CASE slug
  WHEN 'cin' THEN 'CIN PCD'
  WHEN 'estacionamento' THEN 'Credencial de estacionamento PCD'
  WHEN 'renovacao' THEN 'Renovação de CNH'
  ELSE name
END
WHERE slug IN ('cin', 'estacionamento', 'renovacao');

-- Estes campos permanecem no banco para leitura histórica, mas não recebem
-- novas decisões genéricas vindas de processos específicos.
CREATE OR REPLACE FUNCTION public.preserve_legacy_client_medical_intake()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.medical_assessment_status := OLD.medical_assessment_status;
  NEW.report_valid_until := OLD.report_valid_until;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_legacy_client_medical_intake ON public.clients;
CREATE TRIGGER preserve_legacy_client_medical_intake
  BEFORE UPDATE OF medical_assessment_status, report_valid_until
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.preserve_legacy_client_medical_intake();

CREATE OR REPLACE FUNCTION public.preserve_legacy_lead_report_validity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.report_valid := OLD.report_valid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_legacy_lead_report_validity ON public.leads;
CREATE TRIGGER preserve_legacy_lead_report_validity
  BEFORE UPDATE OF report_valid
  ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.preserve_legacy_lead_report_validity();

COMMENT ON COLUMN public.leads.report_valid IS
  'Campo legado somente para histórico; possuir laudo não presume validade.';
COMMENT ON COLUMN public.clients.medical_assessment_status IS
  'Campo legado somente leitura; resultados novos pertencem às etapas do processo.';
COMMENT ON COLUMN public.clients.report_valid_until IS
  'Campo legado somente leitura; validade nova pertence ao fluxo documental específico.';

-- CNH: decisões de exame prático ficam somente na Perícia. A Junta preserva
-- suas informações próprias e a emissão final concentra restrições/vencimento.
UPDATE public.process_stages stage
SET data = stage.data - 'requires_adapted_vehicle'
  - CASE WHEN stage.stage_key = 'recurso_junta_medica'
      THEN 'requires_practical_exam' ELSE '__keep__' END,
    label = CASE stage.stage_key
      WHEN 'checklist_documentos' THEN 'Checklist'
      WHEN 'agendamento_poupatempo' THEN 'Poupatempo'
      WHEN 'pericia_medica' THEN 'Perícia'
      WHEN 'recurso_junta_medica' THEN 'Recurso'
      WHEN 'exame_pratico' THEN 'Exame Prático'
      WHEN 'emissao_cnh' THEN 'CNH finalizada'
      ELSE stage.label
    END,
    sort_order = CASE stage.stage_key
      WHEN 'checklist_documentos' THEN 10
      WHEN 'agendamento_poupatempo' THEN 20
      WHEN 'pericia_medica' THEN 30
      WHEN 'recurso_junta_medica' THEN 40
      WHEN 'exame_pratico' THEN 50
      WHEN 'emissao_cnh' THEN 60
      ELSE stage.sort_order
    END
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'cnh_especial';

-- IPI: três estados visíveis do laudo. Datas antigas removidas da tela ficam
-- agrupadas em um bloco histórico dentro do próprio JSON.
UPDATE public.process_stages
SET data = (
      data
      || JSONB_BUILD_OBJECT(
        'legacy_hidden_fields',
        COALESCE(data->'legacy_hidden_fields', '{}'::JSONB)
          || JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
            'requested_at', data->'requested_at',
            'request_date', data->'request_date',
            'valid_until', data->'valid_until',
            'report_valid_until', data->'report_valid_until'
          ))
      )
      - 'requested_at' - 'request_date' - 'valid_until' - 'report_valid_until'
      || JSONB_BUILD_OBJECT(
        'legacy_report_status', COALESCE(data->'legacy_report_status', data->'report_status'),
        'report_status', CASE data->>'report_status'
          WHEN 'em_andamento' THEN 'solicitado'
          WHEN 'nao_aplicavel' THEN 'nao_solicitado'
          ELSE COALESCE(data->>'report_status', 'nao_solicitado')
        END
      )
    ),
    status = CASE data->>'report_status'
      WHEN 'pronto' THEN 'concluido'
      WHEN 'solicitado' THEN 'em_andamento'
      WHEN 'em_andamento' THEN 'em_andamento'
      ELSE 'pendente'
    END
WHERE stage_key = 'laudo_ipi';

-- ICMS: seleção amigável de UF e incorporação da compra no protocolo.
UPDATE public.process_stages
SET data = data || JSONB_BUILD_OBJECT(
  'state_scope', CASE WHEN COALESCE(data->>'state', 'SP') = 'SP' THEN 'sp' ELSE 'outro' END,
  'state', COALESCE(data->>'state', 'SP')
)
WHERE stage_key = 'pre_requisitos_icms';

UPDATE public.process_stages protocol
SET data = purchase.data || protocol.data
      || JSONB_BUILD_OBJECT('legacy_purchase_stage', purchase.data),
    sort_order = 20
FROM public.process_stages purchase
WHERE protocol.process_id = purchase.process_id
  AND protocol.stage_key = 'protocolo_sivei_icms'
  AND purchase.stage_key = 'dados_compra_icms';

UPDATE public.process_stages
SET status = 'nao_aplicavel',
    notes = CONCAT_WS(E'\n', NULLIF(notes, ''), '[Fluxo simplificado] Dados incorporados ao Protocolo de ICMS.')
WHERE stage_key = 'dados_compra_icms';

UPDATE public.process_stages
SET sort_order = CASE stage_key
  WHEN 'protocolo_sivei_icms' THEN 20
  WHEN 'recurso_icms' THEN 30
  ELSE sort_order
END
WHERE stage_key IN ('protocolo_sivei_icms', 'recurso_icms');

-- Novas alterações comerciais feitas no protocolo continuam alimentando a
-- tabela normalizada criada na migration 031.
CREATE OR REPLACE FUNCTION public.sync_client_vehicle_purchase_from_icms_protocol()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process RECORD;
  v_price NUMERIC(12,2);
  v_purchase_date DATE;
  v_next_change DATE;
BEGIN
  IF NEW.stage_key <> 'protocolo_sivei_icms' THEN RETURN NEW; END IF;

  SELECT process.client_id, process.vehicle_id, type.slug
  INTO v_process
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  WHERE process.id = NEW.process_id;

  IF NOT FOUND OR v_process.slug <> 'processo_icms' THEN RETURN NEW; END IF;

  IF COALESCE(NEW.data->>'vehicle_price', '') ~ '^[0-9]+([.,][0-9]{1,2})?$' THEN
    v_price := REPLACE(NEW.data->>'vehicle_price', ',', '.')::NUMERIC(12,2);
  END IF;
  IF COALESCE(NEW.data->>'purchase_date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_purchase_date := (NEW.data->>'purchase_date')::DATE;
  END IF;
  IF COALESCE(NEW.data->>'next_vehicle_change_date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_next_change := (NEW.data->>'next_vehicle_change_date')::DATE;
  END IF;

  INSERT INTO public.client_vehicle_purchases (
    client_id, process_id, vehicle_id, dealership, salesperson,
    vehicle_description, brand, model, chassis, plate, renavam,
    vehicle_price, purchase_date, next_vehicle_change_date
  ) VALUES (
    v_process.client_id, NEW.process_id, v_process.vehicle_id,
    NULLIF(TRIM(NEW.data->>'dealership'), ''),
    NULLIF(TRIM(NEW.data->>'salesperson'), ''),
    NULLIF(TRIM(NEW.data->>'vehicle'), ''),
    NULLIF(TRIM(NEW.data->>'brand'), ''),
    NULLIF(TRIM(NEW.data->>'model'), ''),
    NULLIF(TRIM(NEW.data->>'chassis'), ''),
    NULLIF(TRIM(NEW.data->>'license_plate'), ''),
    NULLIF(TRIM(NEW.data->>'renavam'), ''),
    v_price, v_purchase_date, v_next_change
  )
  ON CONFLICT (process_id) DO UPDATE SET
    vehicle_id = EXCLUDED.vehicle_id,
    dealership = EXCLUDED.dealership,
    salesperson = EXCLUDED.salesperson,
    vehicle_description = EXCLUDED.vehicle_description,
    brand = EXCLUDED.brand,
    model = EXCLUDED.model,
    chassis = EXCLUDED.chassis,
    plate = EXCLUDED.plate,
    renavam = EXCLUDED.renavam,
    vehicle_price = EXCLUDED.vehicle_price,
    purchase_date = EXCLUDED.purchase_date,
    next_vehicle_change_date = EXCLUDED.next_vehicle_change_date;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_client_vehicle_purchase_from_icms_protocol
  ON public.process_stages;
CREATE TRIGGER sync_client_vehicle_purchase_from_icms_protocol
  AFTER INSERT OR UPDATE OF data ON public.process_stages
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_vehicle_purchase_from_icms_protocol();

-- Preenche/sincroniza imediatamente os protocolos migrados.
INSERT INTO public.client_vehicle_purchases (
  client_id, process_id, vehicle_id, dealership, salesperson,
  vehicle_description, brand, model, chassis, plate, renavam,
  vehicle_price, purchase_date, next_vehicle_change_date
)
SELECT
  process.client_id, process.id, process.vehicle_id,
  NULLIF(TRIM(stage.data->>'dealership'), ''),
  NULLIF(TRIM(stage.data->>'salesperson'), ''),
  NULLIF(TRIM(stage.data->>'vehicle'), ''),
  NULLIF(TRIM(stage.data->>'brand'), ''),
  NULLIF(TRIM(stage.data->>'model'), ''),
  NULLIF(TRIM(stage.data->>'chassis'), ''),
  NULLIF(TRIM(stage.data->>'license_plate'), ''),
  NULLIF(TRIM(stage.data->>'renavam'), ''),
  CASE WHEN COALESCE(stage.data->>'vehicle_price', '') ~ '^[0-9]+([.,][0-9]{1,2})?$'
    THEN REPLACE(stage.data->>'vehicle_price', ',', '.')::NUMERIC(12,2) END,
  CASE WHEN COALESCE(stage.data->>'purchase_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (stage.data->>'purchase_date')::DATE END,
  CASE WHEN COALESCE(stage.data->>'next_vehicle_change_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (stage.data->>'next_vehicle_change_date')::DATE END
FROM public.process_stages stage
JOIN public.processes process ON process.id = stage.process_id
JOIN public.process_types type ON type.id = process.process_type_id
WHERE type.slug = 'processo_icms'
  AND stage.stage_key = 'protocolo_sivei_icms'
ON CONFLICT (process_id) DO UPDATE SET
  vehicle_id = EXCLUDED.vehicle_id,
  dealership = EXCLUDED.dealership,
  salesperson = EXCLUDED.salesperson,
  vehicle_description = EXCLUDED.vehicle_description,
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  chassis = EXCLUDED.chassis,
  plate = EXCLUDED.plate,
  renavam = EXCLUDED.renavam,
  vehicle_price = EXCLUDED.vehicle_price,
  purchase_date = EXCLUDED.purchase_date,
  next_vehicle_change_date = EXCLUDED.next_vehicle_change_date;

-- A resposta do IPI decide se o ICMS contratado será liberado agora.
CREATE OR REPLACE FUNCTION public.advance_service_chain_from_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process RECORD;
  v_should_advance BOOLEAN;
  v_only_ipi BOOLEAN;
BEGIN
  SELECT process.id, process.status, process.client_id,
    process.service_engagement_id, process.origin_lead_id,
    process.service_plan_item_id, type.slug
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
      SET status = 'concluido', completed_at = COALESCE(completed_at, NOW()),
          next_action = NULL, action_owner = NULL, blocked_reason = NULL
      WHERE id = NEW.process_id AND status NOT IN ('arquivado', 'cancelado');

      PERFORM public.activate_service_successor(NEW.process_id, 'ipi');
    END IF;
  END IF;

  IF v_process.slug = 'processo_ipi'
     AND NEW.stage_key = 'protocolo_sisen_ipi'
     AND (NEW.status = 'aprovado' OR NEW.result = 'deferido') THEN
    v_only_ipi := COALESCE(NEW.data->>'purchase_only_with_ipi', '') = 'sim';
    IF TG_OP = 'INSERT' THEN
      v_should_advance := TRUE;
    ELSE
      v_should_advance := NOT (
          COALESCE(OLD.status = 'aprovado', FALSE)
          OR COALESCE(OLD.result = 'deferido', FALSE)
        )
        OR COALESCE(OLD.data->>'purchase_only_with_ipi', '')
          IS DISTINCT FROM COALESCE(NEW.data->>'purchase_only_with_ipi', '');
    END IF;

    IF v_should_advance THEN
      UPDATE public.processes
      SET status = 'concluido', completed_at = COALESCE(completed_at, NOW()),
          next_action = NULL, action_owner = NULL, blocked_reason = NULL
      WHERE id = NEW.process_id AND status NOT IN ('arquivado', 'cancelado');

      IF v_only_ipi THEN
        UPDATE public.processes successor
        SET status = 'aberto',
            blocked_reason = 'Cliente optou por comprar somente com IPI',
            next_action = NULL,
            action_owner = NULL
        FROM public.process_types successor_type
        WHERE successor.process_type_id = successor_type.id
          AND successor_type.slug = 'processo_icms'
          AND successor.client_id = v_process.client_id
          AND successor.status IN ('aberto', 'em_andamento')
          AND (
            (v_process.service_engagement_id IS NOT NULL
              AND successor.service_engagement_id = v_process.service_engagement_id)
            OR (v_process.origin_lead_id IS NOT NULL
              AND successor.origin_lead_id = v_process.origin_lead_id)
            OR EXISTS (
              SELECT 1 FROM public.client_service_plan_items target_item
              WHERE target_item.id = successor.service_plan_item_id
                AND target_item.prerequisite_item_id = v_process.service_plan_item_id
            )
          );

        UPDATE public.client_service_plan_items target_item
        SET status = 'planejado',
            wait_reason = 'Cliente optou por comprar somente com IPI'
        WHERE target_item.prerequisite_item_id = v_process.service_plan_item_id
          AND target_item.service_key = 'icms'
          AND target_item.status NOT IN ('concluido', 'recusado', 'cancelado');
      ELSE
        PERFORM public.activate_service_successor(NEW.process_id, 'icms');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.advance_service_chain_from_stage() IS
  'Libera IPI após CNH e libera ICMS após IPI somente quando a compra não será feita apenas com IPI.';
