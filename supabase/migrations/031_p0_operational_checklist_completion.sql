-- =====================================================
-- ELEVA - conclusão do checklist operacional P0
-- =====================================================

-- A prioridade manual passa a registrar operador e data no histórico do
-- processo escolhido. A reorganização continua centralizada na função original.
CREATE OR REPLACE FUNCTION public.prioritize_client_service_process_audited(
  p_client_id UUID,
  p_process_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.workflow_assert_staff();
  PERFORM public.prioritize_client_service_process(p_client_id, p_process_id);

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, new_value, note
  ) VALUES (
    p_process_id,
    public.get_profile_id(),
    'updated',
    'prioridade_manual',
    'Processo escolhido manualmente como próximo serviço do cliente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prioritize_client_service_process_audited(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prioritize_client_service_process_audited(UUID, UUID) TO authenticated;

-- Dados comerciais da compra deixam de depender exclusivamente do JSON da
-- etapa. O registro pode existir antes do veículo e ser complementado depois.
CREATE TABLE IF NOT EXISTS public.client_vehicle_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  process_id UUID NOT NULL UNIQUE REFERENCES public.processes(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.client_vehicles(id) ON DELETE SET NULL,
  dealership TEXT,
  salesperson TEXT,
  vehicle_description TEXT,
  brand TEXT,
  model TEXT,
  chassis TEXT,
  plate TEXT,
  renavam TEXT,
  vehicle_price NUMERIC(12,2),
  purchase_date DATE,
  next_vehicle_change_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_vehicle_purchases_client
  ON public.client_vehicle_purchases(client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_vehicle_purchases_dealership
  ON public.client_vehicle_purchases(LOWER(dealership))
  WHERE dealership IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_vehicle_purchases_dates
  ON public.client_vehicle_purchases(purchase_date, next_vehicle_change_date);

ALTER TABLE public.client_vehicle_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage client vehicle purchases"
  ON public.client_vehicle_purchases;
CREATE POLICY "Staff can manage client vehicle purchases"
  ON public.client_vehicle_purchases FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_vehicle_purchases TO authenticated;

DROP TRIGGER IF EXISTS update_client_vehicle_purchases_updated_at
  ON public.client_vehicle_purchases;
CREATE TRIGGER update_client_vehicle_purchases_updated_at
  BEFORE UPDATE ON public.client_vehicle_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_client_vehicle_purchase_from_stage()
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
  IF NEW.stage_key <> 'dados_compra_icms' THEN RETURN NEW; END IF;

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
    v_process.client_id,
    NEW.process_id,
    v_process.vehicle_id,
    NULLIF(TRIM(NEW.data->>'dealership'), ''),
    NULLIF(TRIM(NEW.data->>'salesperson'), ''),
    NULLIF(TRIM(NEW.data->>'vehicle'), ''),
    NULLIF(TRIM(NEW.data->>'brand'), ''),
    NULLIF(TRIM(NEW.data->>'model'), ''),
    NULLIF(TRIM(NEW.data->>'chassis'), ''),
    NULLIF(TRIM(NEW.data->>'license_plate'), ''),
    NULLIF(TRIM(NEW.data->>'renavam'), ''),
    v_price,
    v_purchase_date,
    v_next_change
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

DROP TRIGGER IF EXISTS sync_client_vehicle_purchase_from_stage
  ON public.process_stages;
CREATE TRIGGER sync_client_vehicle_purchase_from_stage
  AFTER INSERT OR UPDATE OF data ON public.process_stages
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_vehicle_purchase_from_stage();

-- Backfill dos dados que já estavam nas etapas.
INSERT INTO public.client_vehicle_purchases (
  client_id, process_id, vehicle_id, dealership, salesperson,
  vehicle_description, brand, model, chassis, plate, renavam,
  vehicle_price, purchase_date, next_vehicle_change_date
)
SELECT
  process.client_id,
  process.id,
  process.vehicle_id,
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
  AND stage.stage_key = 'dados_compra_icms'
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

-- Carteira operacional com filtros e ordenação resolvidos no banco.
CREATE OR REPLACE VIEW public.process_wallet_rows
WITH (security_invoker = true)
AS
SELECT
  process.id AS process_id,
  process.process_type_id,
  type.slug AS process_type_slug,
  type.name AS process_type_name,
  process.client_id,
  client.name AS client_name,
  client.cpf AS client_cpf,
  client.phone AS client_phone,
  process.protocol,
  process.status AS process_status,
  process.responsible_user_id,
  responsible.name AS responsible_name,
  process.next_action,
  process.action_owner,
  process.action_due_date,
  process.blocked_reason,
  process.observations AS process_observations,
  process.created_at,
  process.updated_at AS process_updated_at,
  current_stage.id AS stage_id,
  current_stage.stage_key,
  current_stage.label AS stage_label,
  current_stage.status AS stage_status,
  current_stage.scheduled_date,
  current_stage.notes AS stage_notes,
  current_stage.data AS stage_data,
  current_stage.updated_at AS stage_updated_at,
  GREATEST(process.updated_at, COALESCE(current_stage.updated_at, process.updated_at)) AS last_updated_at,
  LOWER(CONCAT_WS(' ', client.name, client.cpf, client.phone, process.protocol)) AS search_text,
  CASE
    WHEN process.status IN ('concluido', 'arquivado', 'cancelado') THEN 'encerrar'
    WHEN LOWER(COALESCE(process.next_action, '')) LIKE '%agend%' THEN 'agendar'
    WHEN LOWER(COALESCE(process.next_action, '')) LIKE '%solicit%' THEN 'solicitar'
    WHEN LOWER(COALESCE(process.next_action, '')) LIKE ANY (ARRAY['%dar entrada%', '%protocol%', '%iniciar%']) THEN 'dar_entrada'
    WHEN process.blocked_reason IS NOT NULL
      OR LOWER(COALESCE(process.next_action, '')) LIKE ANY (ARRAY['%consult%', '%acompanhar%', '%aguard%']) THEN 'consultar'
    ELSE 'dar_andamento'
  END AS action_category,
  CASE
    WHEN process.status IN ('concluido', 'arquivado', 'cancelado') THEN 6
    WHEN process.action_due_date < CURRENT_DATE THEN 0
    WHEN process.action_owner = 'equipe' AND process.action_due_date IS NOT NULL THEN 1
    WHEN COALESCE(process.action_owner, CASE WHEN process.blocked_reason IS NULL THEN 'equipe' ELSE 'terceiro' END) = 'equipe' THEN 2
    WHEN current_stage.scheduled_date IS NOT NULL THEN 4
    WHEN process.blocked_reason IS NOT NULL OR process.action_owner IN ('cliente', 'orgao', 'terceiro') THEN 3
    ELSE 5
  END AS operational_priority_rank,
  CASE
    WHEN current_stage.status = 'reprovado' THEN 'indeferido'
    WHEN current_stage.status = 'aprovado' THEN 'deferido'
    WHEN current_stage.status = 'concluido' THEN 'finalizado'
    WHEN current_stage.scheduled_date IS NOT NULL THEN 'agendado'
    WHEN LOWER(COALESCE(process.next_action, '')) LIKE '%solicit%' THEN 'solicitado'
    WHEN process.status = 'aguardando_documentos' THEN 'aguardando_documento'
    WHEN process.status IN ('em_analise', 'aguardando_orgao') THEN 'em_analise'
    WHEN current_stage.status = 'em_andamento' THEN 'em_andamento'
    ELSE 'nao_iniciado'
  END AS operational_situation
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
JOIN public.clients client ON client.id = process.client_id
LEFT JOIN public.profiles responsible ON responsible.id = process.responsible_user_id
LEFT JOIN LATERAL (
  SELECT stage.*
  FROM public.process_stages stage
  WHERE stage.process_id = process.id
    AND NOT (
      (type.slug = 'cnh_especial' AND stage.stage_key IN ('cnh_regularizada', 'liberado_isencoes'))
      OR (type.slug = 'processo_ipi' AND stage.stage_key IN ('analise_receita_ipi', 'autorizacao_ipi', 'transicao_compra_icms'))
      OR (type.slug = 'processo_icms' AND stage.stage_key IN ('documentos_icms', 'decisao_icms'))
    )
  ORDER BY
    CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
    CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
    CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
  LIMIT 1
) current_stage ON TRUE;

GRANT SELECT ON public.process_wallet_rows TO authenticated;

-- A ordem original da view 030 é preservada; os novos campos são anexados
-- ao final para permitir CREATE OR REPLACE em bancos onde ela já existe.
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
  purchase.vehicle_price::NUMERIC AS vehicle_price,
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
    purchase.vehicle, commercial_owner.name,
    ARRAY_TO_STRING(services.service_names, ' ')
  )) AS search_text,
  client.created_at AS client_created_at,
  client.commercial_owner_id,
  commercial_owner.name AS commercial_owner_name,
  services.service_names,
  services.service_keys,
  CASE
    WHEN cin.process_status = 'concluido'
      AND (cin.valid_until IS NULL OR cin.valid_until >= CURRENT_DATE) THEN TRUE
    ELSE FALSE
  END AS has_valid_cin,
  CASE
    WHEN credential.process_status = 'concluido'
      AND (credential.valid_until IS NULL OR credential.valid_until >= CURRENT_DATE) THEN TRUE
    ELSE FALSE
  END AS has_valid_credential,
  CASE
    WHEN cin.process_status = 'concluido' AND cin.valid_until < CURRENT_DATE THEN 'vencido'
    WHEN cin.process_status = 'concluido' THEN 'vigente'
    WHEN cin.process_status IS NOT NULL AND cin.process_status NOT IN ('arquivado', 'cancelado') THEN 'em_andamento'
    ELSE 'nao_possui'
  END AS cin_document_state,
  CASE
    WHEN credential.process_status = 'concluido' AND credential.valid_until < CURRENT_DATE THEN 'vencido'
    WHEN credential.process_status = 'concluido' THEN 'vigente'
    WHEN credential.process_status IS NOT NULL AND credential.process_status NOT IN ('arquivado', 'cancelado') THEN 'em_andamento'
    ELSE 'nao_possui'
  END AS credential_document_state
FROM public.clients client
LEFT JOIN public.profiles commercial_owner ON commercial_owner.id = client.commercial_owner_id
LEFT JOIN LATERAL (
  SELECT financial.id, financial.status, financial.net_amount,
    financial.contracted_at, financial.updated_at,
    COALESCE(type.name, 'Contrato geral') AS contract_label
  FROM public.financial_contracts financial
  LEFT JOIN public.processes process ON process.id = financial.process_id
  LEFT JOIN public.process_types type ON type.id = process.process_type_id
  WHERE financial.client_id = client.id AND financial.status <> 'cancelado'
  ORDER BY (financial.status = 'ativo') DESC, financial.contracted_at DESC, financial.created_at DESC
  LIMIT 1
) contract ON TRUE
LEFT JOIN LATERAL (
  SELECT lead.lead_source, lead.referral_partner_id,
    partner.name AS referral_partner_name
  FROM public.leads lead
  LEFT JOIN public.referral_partners partner ON partner.id = lead.referral_partner_id
  WHERE lead.converted_client_id = client.id
  ORDER BY lead.updated_at DESC, lead.created_at DESC
  LIMIT 1
) origin ON TRUE
LEFT JOIN LATERAL (
  SELECT purchase.dealership, purchase.salesperson,
    COALESCE(
      purchase.vehicle_description,
      NULLIF(CONCAT_WS(' ', COALESCE(purchase.brand, vehicle.brand), COALESCE(purchase.model, vehicle.model)), ''),
      vehicle.description
    ) AS vehicle,
    purchase.vehicle_price, purchase.purchase_date,
    purchase.next_vehicle_change_date, purchase.updated_at
  FROM public.client_vehicle_purchases purchase
  LEFT JOIN public.client_vehicles vehicle ON vehicle.id = purchase.vehicle_id
  WHERE purchase.client_id = client.id
  ORDER BY purchase.updated_at DESC, purchase.created_at DESC
  LIMIT 1
) purchase ON TRUE
LEFT JOIN LATERAL (
  SELECT
    ARRAY_AGG(service.name ORDER BY service.sort_order) AS service_names,
    ARRAY_AGG(service.service_key ORDER BY service.sort_order) AS service_keys
  FROM (
    SELECT DISTINCT ON (item.service_key)
      item.service_key, type.name, item.sort_order, engagement.created_at
    FROM public.client_service_plan_items item
    JOIN public.client_service_engagements engagement ON engagement.id = item.engagement_id
    JOIN public.process_types type ON type.id = item.process_type_id
    WHERE engagement.client_id = client.id
      AND engagement.status <> 'cancelado'
      AND item.status NOT IN ('recusado', 'cancelado')
    ORDER BY item.service_key, engagement.created_at DESC, item.updated_at DESC
  ) service
) services ON TRUE
LEFT JOIN LATERAL (
  SELECT process.status AS process_status, current_stage.label AS stage_label,
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
  SELECT process.status AS process_status, current_stage.label AS stage_label,
    NULLIF((SELECT issued.data->>'valid_until' FROM public.process_stages issued
      WHERE issued.process_id = process.id AND issued.stage_key = 'emissao_cin' LIMIT 1), '')::DATE AS valid_until,
    GREATEST(process.updated_at, COALESCE(current_stage.updated_at, process.updated_at)) AS updated_at
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  LEFT JOIN LATERAL (
    SELECT stage.label, stage.updated_at FROM public.process_stages stage
    WHERE stage.process_id = process.id
    ORDER BY CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
      CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
    LIMIT 1
  ) current_stage ON TRUE
  WHERE process.client_id = client.id AND type.slug = 'cin'
  ORDER BY (process.status NOT IN ('concluido', 'arquivado', 'cancelado')) DESC, process.updated_at DESC
  LIMIT 1
) cin ON TRUE
LEFT JOIN LATERAL (
  SELECT process.status AS process_status, current_stage.label AS stage_label,
    NULLIF((SELECT issued.data->>'valid_until' FROM public.process_stages issued
      WHERE issued.process_id = process.id AND issued.stage_key = 'emissao_estacionamento' LIMIT 1), '')::DATE AS valid_until,
    GREATEST(process.updated_at, COALESCE(current_stage.updated_at, process.updated_at)) AS updated_at
  FROM public.processes process
  JOIN public.process_types type ON type.id = process.process_type_id
  LEFT JOIN LATERAL (
    SELECT stage.label, stage.updated_at FROM public.process_stages stage
    WHERE stage.process_id = process.id
    ORDER BY CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
      CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
      CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
    LIMIT 1
  ) current_stage ON TRUE
  WHERE process.client_id = client.id AND type.slug = 'estacionamento'
  ORDER BY (process.status NOT IN ('concluido', 'arquivado', 'cancelado')) DESC, process.updated_at DESC
  LIMIT 1
) credential ON TRUE;

GRANT SELECT ON public.client_complete_rows TO authenticated;

COMMENT ON TABLE public.client_vehicle_purchases IS
  'Dados normalizados de concessionária, vendedor, compra e próxima troca, sincronizados a partir do fluxo ICMS.';
COMMENT ON VIEW public.client_complete_rows IS
  'Resumo operacional completo do cliente; possui CIN/Credencial significa processo concluído e documento sem vencimento ou ainda vigente.';
