-- =====================================================
-- ELEVA — execução integral dos serviços e carteiras operacionais
-- =====================================================

-- Um processo bloqueado por outro serviço já existe e pode ser consultado,
-- mas não deve aparecer como iniciado nem gerar uma ação para a equipe.
CREATE OR REPLACE FUNCTION public.sync_service_plan_from_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_item_status TEXT;
  v_engagement_id UUID;
  v_just_completed BOOLEAN;
BEGIN
  IF NEW.service_plan_item_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_just_completed := NEW.status = 'concluido';
  ELSE
    v_just_completed := NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM NEW.status;
  END IF;

  v_new_item_status := CASE
    WHEN NEW.status = 'concluido' THEN 'concluido'
    WHEN NEW.status IN ('arquivado', 'cancelado') THEN 'cancelado'
    WHEN NEW.status = 'aberto' AND NULLIF(TRIM(COALESCE(NEW.blocked_reason, '')), '') IS NOT NULL
      THEN 'planejado'
    ELSE 'iniciado'
  END;

  UPDATE public.client_service_plan_items
  SET process_id = NEW.id,
      status = v_new_item_status,
      wait_reason = CASE WHEN v_new_item_status = 'planejado' THEN NEW.blocked_reason ELSE NULL END,
      ready_at = CASE
        WHEN v_new_item_status = 'iniciado' THEN COALESCE(ready_at, NEW.started_at, NOW())
        ELSE ready_at
      END,
      started_at = CASE
        WHEN v_new_item_status = 'iniciado' THEN COALESCE(started_at, NEW.started_at, NEW.created_at)
        ELSE started_at
      END,
      completed_at = CASE
        WHEN NEW.status = 'concluido' THEN COALESCE(NEW.completed_at, NOW())
        ELSE completed_at
      END
  WHERE id = NEW.service_plan_item_id;

  IF v_just_completed THEN
    -- O próximo processo já foi materializado na conversão. A conclusão do
    -- pré-requisito apenas o libera; não é necessário recriá-lo manualmente.
    UPDATE public.processes next_process
    SET status = 'em_andamento',
        started_at = COALESCE(next_process.started_at, NOW()),
        blocked_reason = NULL,
        next_action = COALESCE(NULLIF(next_process.next_action, ''), 'Iniciar atendimento'),
        action_owner = COALESCE(NULLIF(next_process.action_owner, ''), 'equipe')
    FROM public.client_service_plan_items next_item
    WHERE next_item.prerequisite_item_id = NEW.service_plan_item_id
      AND next_item.status = 'planejado'
      AND next_process.service_plan_item_id = next_item.id
      AND next_process.status = 'aberto';

    -- Compatibilidade com planos antigos ainda sem processo materializado.
    UPDATE public.client_service_plan_items next_item
    SET status = 'pronto_para_iniciar',
        ready_at = COALESCE(ready_at, NOW()),
        wait_reason = NULL
    WHERE next_item.prerequisite_item_id = NEW.service_plan_item_id
      AND next_item.status = 'planejado'
      AND next_item.process_id IS NULL;

    SELECT engagement_id INTO v_engagement_id
    FROM public.client_service_plan_items
    WHERE id = NEW.service_plan_item_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.client_service_plan_items item
      WHERE item.engagement_id = v_engagement_id
        AND item.status NOT IN ('concluido', 'recusado', 'cancelado')
    ) THEN
      UPDATE public.client_service_engagements
      SET status = 'concluido'
      WHERE id = v_engagement_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Vincula primeiro os processos já existentes aos itens do plano.
WITH candidates AS (
  SELECT DISTINCT ON (process.id)
    item.id AS item_id,
    process.id AS process_id
  FROM public.client_service_plan_items item
  JOIN public.client_service_engagements engagement ON engagement.id = item.engagement_id
  JOIN public.processes process
    ON process.client_id = engagement.client_id
   AND process.process_type_id = item.process_type_id
   AND process.status NOT IN ('concluido', 'arquivado', 'cancelado')
  WHERE item.process_id IS NULL
  ORDER BY process.id,
    (process.origin_lead_id IS NOT DISTINCT FROM engagement.origin_lead_id) DESC,
    item.created_at DESC
)
UPDATE public.client_service_plan_items item
SET process_id = candidate.process_id
FROM candidates candidate
WHERE item.id = candidate.item_id;

UPDATE public.processes process
SET service_plan_item_id = item.id,
    service_engagement_id = item.engagement_id,
    service_order = item.sort_order,
    origin_lead_id = COALESCE(process.origin_lead_id, engagement.origin_lead_id)
FROM public.client_service_plan_items item
JOIN public.client_service_engagements engagement ON engagement.id = item.engagement_id
WHERE item.process_id = process.id
  AND process.service_plan_item_id IS NULL;

-- Materializa os serviços contratados que existiam apenas no plano.
INSERT INTO public.processes (
  client_id, process_type_id, status, observations, jurisdiction_state,
  service_order, origin_lead_id, service_engagement_id, service_plan_item_id,
  started_at, blocked_reason, next_action, action_owner
)
SELECT
  engagement.client_id,
  item.process_type_id,
  CASE WHEN prerequisite.id IS NOT NULL AND prerequisite.status <> 'concluido'
    THEN 'aberto' ELSE 'em_andamento' END,
  'Processo materializado automaticamente a partir do plano de serviços.',
  client.state,
  item.sort_order,
  engagement.origin_lead_id,
  engagement.id,
  item.id,
  CASE WHEN prerequisite.id IS NOT NULL AND prerequisite.status <> 'concluido'
    THEN NULL ELSE NOW() END,
  CASE
    WHEN prerequisite.service_key = 'cnh_especial' AND prerequisite.status <> 'concluido'
      THEN 'Aguardando conclusão da CNH Especial'
    WHEN prerequisite.service_key = 'ipi' AND prerequisite.status <> 'concluido'
      THEN 'Aguardando deferimento do IPI'
    ELSE NULL
  END,
  CASE WHEN prerequisite.id IS NOT NULL AND prerequisite.status <> 'concluido'
    THEN NULL ELSE 'Iniciar atendimento' END,
  CASE WHEN prerequisite.id IS NOT NULL AND prerequisite.status <> 'concluido'
    THEN NULL ELSE 'equipe' END
FROM public.client_service_plan_items item
JOIN public.client_service_engagements engagement ON engagement.id = item.engagement_id
JOIN public.clients client ON client.id = engagement.client_id
LEFT JOIN public.client_service_plan_items prerequisite ON prerequisite.id = item.prerequisite_item_id
WHERE item.process_id IS NULL
  AND item.status NOT IN ('concluido', 'recusado', 'cancelado')
  AND NOT EXISTS (
    SELECT 1 FROM public.processes existing
    WHERE existing.client_id = engagement.client_id
      AND existing.process_type_id = item.process_type_id
      AND existing.duplicate_of_process_id IS NULL
      AND existing.status NOT IN ('concluido', 'arquivado', 'cancelado')
  );

-- Etapas essenciais dos processos materializados ou antigos sem workflow.
INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, status, data)
SELECT process.id, template.stage_key, template.label, template.sort_order,
       template.status, template.data
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
CROSS JOIN LATERAL (VALUES
  ('checklist_documentos', 'Checklist de documentos', 10, 'pendente',
    '{"cnh":false,"laudo_medico":false,"acesso_gov_validado":false,"comprovante_endereco":false,"email":false}'::JSONB),
  ('agendamento_poupatempo', 'Poupatempo', 20, 'pendente', '{}'::JSONB),
  ('pericia_medica', 'Perícia', 30, 'pendente',
    '{"observacoes":"","restricoes":"","requires_practical_exam":null,"medical_requirements":[]}'::JSONB),
  ('exame_pratico', 'Exame Prático', 50, 'pendente',
    '{"modalidade":null,"checklist_veiculo_proprio":{}}'::JSONB),
  ('emissao_cnh', 'CNH finalizada', 60, 'pendente',
    '{"restricoes":"","vencimento_cnh":""}'::JSONB)
) AS template(stage_key, label, sort_order, status, data)
WHERE type.slug = 'cnh_especial'
  AND process.status NOT IN ('arquivado', 'cancelado')
  AND NOT EXISTS (
    SELECT 1 FROM public.process_stages stage
    WHERE stage.process_id = process.id AND stage.stage_key = template.stage_key
  );

INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, status, data)
SELECT process.id, template.stage_key, template.label, template.sort_order,
       template.status, template.data
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
CROSS JOIN LATERAL (VALUES
  ('laudo_ipi', 'Laudo DETRAN', 10, 'pendente', '{"report_status":"nao_solicitado"}'::JSONB),
  ('documentos_ipi', 'Checklist do IPI', 20, 'pendente',
    '{"blocked_by":"laudo_ipi","checklist":{}}'::JSONB),
  ('protocolo_sisen_ipi', 'Protocolo do IPI', 30, 'pendente', '{}'::JSONB),
  ('recurso_ipi', 'Recurso administrativo', 40, 'nao_aplicavel', '{}'::JSONB)
) AS template(stage_key, label, sort_order, status, data)
WHERE type.slug = 'processo_ipi'
  AND process.status NOT IN ('arquivado', 'cancelado')
  AND NOT EXISTS (
    SELECT 1 FROM public.process_stages stage
    WHERE stage.process_id = process.id AND stage.stage_key = template.stage_key
  );

INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, status, data)
SELECT process.id, template.stage_key, template.label, template.sort_order,
       template.status, template.data
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
CROSS JOIN LATERAL (VALUES
  ('pre_requisitos_icms', 'Checklist do ICMS', 10, 'pendente',
    '{"state":"SP","checklist":{}}'::JSONB),
  ('dados_compra_icms', 'Concessionária e compra', 20, 'pendente', '{}'::JSONB),
  ('protocolo_sivei_icms', 'Protocolo de ICMS', 30, 'pendente', '{}'::JSONB),
  ('recurso_icms', 'Recurso ou novo protocolo', 40, 'nao_aplicavel', '{}'::JSONB)
) AS template(stage_key, label, sort_order, status, data)
WHERE type.slug = 'processo_icms'
  AND process.status NOT IN ('arquivado', 'cancelado')
  AND NOT EXISTS (
    SELECT 1 FROM public.process_stages stage
    WHERE stage.process_id = process.id AND stage.stage_key = template.stage_key
  );

-- CNH: nova nomenclatura e retirada da etapa duplicada de encerramento.
UPDATE public.process_stages stage
SET label = CASE stage.stage_key
      WHEN 'agendamento_poupatempo' THEN 'Poupatempo'
      WHEN 'pericia_medica' THEN 'Perícia'
      WHEN 'emissao_cnh' THEN 'CNH finalizada'
      ELSE stage.label
    END,
    sort_order = CASE stage.stage_key
      WHEN 'exame_pratico' THEN 50
      WHEN 'emissao_cnh' THEN 60
      ELSE stage.sort_order
    END,
    data = CASE WHEN stage.stage_key IN ('pericia_medica', 'recurso_junta_medica')
      THEN stage.data - 'requires_adapted_vehicle' ELSE stage.data END
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'cnh_especial';

UPDATE public.process_stages stage
SET status = 'nao_aplicavel',
    notes = CONCAT_WS(E'\n', NULLIF(stage.notes, ''), '[Fluxo simplificado] Etapa mantida somente para histórico.')
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'cnh_especial'
  AND stage.stage_key IN ('cnh_regularizada', 'liberado_isencoes');

-- IPI: a decisão passa a fazer parte do protocolo.
UPDATE public.process_stages protocol
SET data = protocol.data || JSONB_BUILD_OBJECT(
      'legacy_analysis', analysis.data,
      'requirement_details', COALESCE(protocol.data->>'requirement_details', analysis.data->>'requirement_details'),
      'rejection_reason', COALESCE(protocol.data->>'rejection_reason', analysis.data->>'rejection_reason')
    ),
    status = CASE WHEN analysis.status IN ('aprovado', 'reprovado') THEN analysis.status ELSE protocol.status END,
    result = CASE
      WHEN analysis.status = 'aprovado' THEN 'deferido'
      WHEN analysis.status = 'reprovado' THEN 'indeferido'
      ELSE protocol.result
    END
FROM public.process_stages analysis
WHERE protocol.process_id = analysis.process_id
  AND protocol.stage_key = 'protocolo_sisen_ipi'
  AND analysis.stage_key = 'analise_receita_ipi';

UPDATE public.process_stages stage
SET label = CASE stage.stage_key
      WHEN 'documentos_ipi' THEN 'Checklist do IPI'
      WHEN 'protocolo_sisen_ipi' THEN 'Protocolo do IPI'
      ELSE stage.label
    END,
    sort_order = CASE stage.stage_key WHEN 'recurso_ipi' THEN 40 ELSE stage.sort_order END
WHERE stage.stage_key IN ('documentos_ipi', 'protocolo_sisen_ipi', 'recurso_ipi');

UPDATE public.process_stages
SET data = (data || JSONB_BUILD_OBJECT('legacy_report_status', data->>'report_status'))
      || JSONB_BUILD_OBJECT('report_status', CASE data->>'report_status'
        WHEN 'em_andamento' THEN 'solicitado'
        WHEN 'nao_aplicavel' THEN 'nao_solicitado'
        ELSE data->>'report_status' END),
    status = CASE WHEN data->>'report_status' = 'nao_aplicavel' THEN 'pendente' ELSE status END
WHERE stage_key = 'laudo_ipi'
  AND data->>'report_status' IN ('em_andamento', 'nao_aplicavel');

UPDATE public.process_stages
SET status = 'nao_aplicavel',
    notes = CONCAT_WS(E'\n', NULLIF(notes, ''), '[Fluxo simplificado] Conteúdo preservado no histórico do processo.')
WHERE stage_key IN ('analise_receita_ipi', 'autorizacao_ipi', 'transicao_compra_icms');

-- ICMS: pré-requisitos e documentos passam a ser um único checklist; decisão
-- e acompanhamento passam a fazer parte do protocolo.
UPDATE public.process_stages prerequisite
SET data = prerequisite.data || JSONB_BUILD_OBJECT(
      'checklist', COALESCE(prerequisite.data->'checklist', '{}'::JSONB)
        || COALESCE(documents.data->'checklist', '{}'::JSONB),
      'legacy_documents', documents.data
    )
FROM public.process_stages documents
WHERE prerequisite.process_id = documents.process_id
  AND prerequisite.stage_key = 'pre_requisitos_icms'
  AND documents.stage_key = 'documentos_icms';

UPDATE public.process_stages protocol
SET data = protocol.data || JSONB_BUILD_OBJECT(
      'legacy_decision', decision.data,
      'rejection_reason', COALESCE(protocol.data->>'rejection_reason', decision.data->>'rejection_reason'),
      'documents_release_authorized', COALESCE(
        protocol.data->'documents_release_authorized',
        decision.data->'documents_release_authorized'
      )
    ),
    status = CASE WHEN decision.status IN ('aprovado', 'reprovado') THEN decision.status ELSE protocol.status END,
    result = CASE
      WHEN decision.status = 'aprovado' THEN 'deferido'
      WHEN decision.status = 'reprovado' THEN 'indeferido'
      ELSE protocol.result
    END
FROM public.process_stages decision
WHERE protocol.process_id = decision.process_id
  AND protocol.stage_key = 'protocolo_sivei_icms'
  AND decision.stage_key = 'decisao_icms';

UPDATE public.process_stages
SET label = CASE stage_key
      WHEN 'pre_requisitos_icms' THEN 'Checklist do ICMS'
      WHEN 'dados_compra_icms' THEN 'Concessionária e compra'
      WHEN 'protocolo_sivei_icms' THEN 'Protocolo de ICMS'
      ELSE label
    END,
    sort_order = CASE stage_key
      WHEN 'pre_requisitos_icms' THEN 10
      WHEN 'dados_compra_icms' THEN 20
      WHEN 'protocolo_sivei_icms' THEN 30
      WHEN 'recurso_icms' THEN 40
      ELSE sort_order
    END
WHERE stage_key IN ('pre_requisitos_icms', 'dados_compra_icms', 'protocolo_sivei_icms', 'recurso_icms');

UPDATE public.process_stages
SET status = 'nao_aplicavel',
    notes = CONCAT_WS(E'\n', NULLIF(notes, ''), '[Fluxo simplificado] Conteúdo incorporado à etapa operacional correspondente.')
WHERE stage_key IN ('documentos_icms', 'decisao_icms');

CREATE INDEX IF NOT EXISTS idx_process_stages_wallet_current
  ON public.process_stages(process_id, status, sort_order, updated_at DESC);

-- Uma linha plana por processo evita N+1 e entrega as colunas operacionais
-- diretamente às carteiras, filtros e paginação.
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
  LOWER(CONCAT_WS(' ', client.name, client.cpf, client.phone, process.protocol)) AS search_text
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

COMMENT ON VIEW public.process_wallet_rows IS
  'Carteira operacional plana: etapa, situação, próxima ação, observações e última atualização por processo.';
