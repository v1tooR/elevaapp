-- =====================================================
-- ELEVA - auditoria e visibilidade operacional das transições P2
-- =====================================================

-- O gatilho antigo avançava qualquer processo apenas pela ordem numérica. As
-- dependências atuais são explícitas no plano e nos gatilhos CNH -> IPI -> ICMS.
DROP TRIGGER IF EXISTS activate_next_client_service_process ON public.processes;

-- Durante a exclusão de um cliente, o PostgreSQL pode limpar a autorreferência
-- prerequisite_item_id depois que o atendimento-pai já entrou em cascade. O
-- validador anterior tratava essa limpeza interna como uma edição inválida e
-- impedia a exclusão do cliente. Inserts/updates inválidos continuam protegidos
-- pelas próprias FKs; a ausência do atendimento aqui só é aceita no cascade.
CREATE OR REPLACE FUNCTION public.validate_service_plan_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_engagement_client_id UUID;
  v_process RECORD;
  v_prerequisite_engagement_id UUID;
BEGIN
  SELECT client_id INTO v_engagement_client_id
  FROM public.client_service_engagements
  WHERE id = NEW.engagement_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.process_id IS NOT NULL THEN
    SELECT process.client_id, process.process_type_id
    INTO v_process
    FROM public.processes process
    WHERE process.id = NEW.process_id;

    IF NOT FOUND
       OR v_process.client_id <> v_engagement_client_id
       OR v_process.process_type_id <> NEW.process_type_id THEN
      RAISE EXCEPTION 'O processo deve pertencer ao cliente e serviço do plano';
    END IF;
  END IF;

  IF NEW.prerequisite_item_id IS NOT NULL THEN
    SELECT engagement_id INTO v_prerequisite_engagement_id
    FROM public.client_service_plan_items
    WHERE id = NEW.prerequisite_item_id;

    IF NOT FOUND OR v_prerequisite_engagement_id <> NEW.engagement_id THEN
      RAISE EXCEPTION 'O pré-requisito deve pertencer ao mesmo plano';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- A carteira passa a distinguir um processo realmente não iniciado de um
-- processo já materializado que aguarda a conclusão de outro serviço.
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
    WHEN process.status = 'aberto' AND (
      LOWER(COALESCE(process.blocked_reason, '')) LIKE 'aguardando conclusão%'
      OR LOWER(COALESCE(process.blocked_reason, '')) LIKE 'aguardando deferimento%'
      OR LOWER(COALESCE(process.blocked_reason, '')) LIKE 'cliente optou por comprar somente%'
    ) THEN 'aguardando_dependencia'
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
      OR (type.slug = 'processo_icms' AND stage.stage_key IN ('documentos_icms', 'decisao_icms', 'dados_compra_icms'))
    )
  ORDER BY
    CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN 0 ELSE 1 END,
    CASE WHEN stage.status IN ('pendente', 'em_andamento') THEN stage.sort_order END ASC,
    CASE WHEN stage.status NOT IN ('pendente', 'em_andamento') THEN stage.sort_order END DESC
  LIMIT 1
) current_stage ON TRUE;

GRANT SELECT ON public.process_wallet_rows TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_process_operational_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process_type_name TEXT;
  v_vehicle_label TEXT;
  v_release_message TEXT;
BEGIN
  SELECT type.name INTO v_process_type_name
  FROM public.process_types type
  WHERE type.id = NEW.process_type_id;

  IF NEW.status = 'em_andamento'
     AND NULLIF(TRIM(COALESCE(OLD.blocked_reason, '')), '') IS NOT NULL
     AND NULLIF(TRIM(COALESCE(NEW.blocked_reason, '')), '') IS NULL THEN
    v_release_message := FORMAT(
      '%s liberado automaticamente. Motivo anterior: %s',
      COALESCE(v_process_type_name, 'Serviço'),
      OLD.blocked_reason
    );

    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note
    ) VALUES (
      NEW.id, public.get_profile_id(), 'updated', OLD.blocked_reason,
      'liberado_automaticamente', v_release_message
    );

    -- A liberação é uma ação interna: notifica o responsável ou, quando ainda
    -- não existe um, a supervisão. O portal do cliente não recebe detalhes da
    -- fila operacional da equipe.
    INSERT INTO public.notifications (
      user_id, client_id, process_id, title, message, type,
      source_key, available_at, is_canceled, is_read
    )
    SELECT profile.id, NEW.client_id, NEW.id,
      FORMAT('%s liberado', COALESCE(v_process_type_name, 'Próximo serviço')),
      CASE WHEN NEW.responsible_user_id IS NULL
        THEN 'O serviço anterior foi concluído. Defina o responsável e inicie a próxima ação.'
        ELSE 'O serviço anterior foi concluído. O atendimento já aparece na sua fila de próximas ações.'
      END,
      'success', 'service:released', NOW(), FALSE, FALSE
    FROM public.profiles profile
    WHERE profile.is_active = TRUE
      AND (
        profile.id = NEW.responsible_user_id
        OR (
          NEW.responsible_user_id IS NULL
          AND profile.role IN ('super_admin', 'admin')
        )
      )
    ON CONFLICT (user_id, process_id, source_key) DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      type = EXCLUDED.type,
      available_at = EXCLUDED.available_at,
      is_canceled = FALSE,
      is_read = FALSE;
  END IF;

  IF OLD.blocked_reason IS DISTINCT FROM NEW.blocked_reason
     AND NULLIF(TRIM(COALESCE(NEW.blocked_reason, '')), '') IS NOT NULL THEN
    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note
    ) VALUES (
      NEW.id, public.get_profile_id(), 'updated', OLD.blocked_reason,
      NEW.blocked_reason, FORMAT('Serviço colocado em espera: %s', NEW.blocked_reason)
    );
  END IF;

  IF OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
    IF NEW.vehicle_id IS NOT NULL THEN
      SELECT COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', vehicle.brand, vehicle.model)), ''),
        NULLIF(TRIM(vehicle.description), ''),
        NEW.vehicle_id::TEXT
      ) INTO v_vehicle_label
      FROM public.client_vehicles vehicle
      WHERE vehicle.id = NEW.vehicle_id;
    END IF;

    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note
    ) VALUES (
      NEW.id, public.get_profile_id(), 'updated', OLD.vehicle_id::TEXT,
      NEW.vehicle_id::TEXT,
      CASE WHEN NEW.vehicle_id IS NULL
        THEN 'Vínculo do veículo removido do processo'
        ELSE FORMAT('Veículo vinculado posteriormente: %s', COALESCE(v_vehicle_label, NEW.vehicle_id::TEXT))
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_process_operational_changes ON public.processes;
CREATE TRIGGER audit_process_operational_changes
  AFTER UPDATE OF status, blocked_reason, vehicle_id ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.audit_process_operational_changes();

-- Corrige liberações feitas antes desta migration nas quais o gatilho legado
-- mudou o status antes da função atual conseguir limpar o motivo de bloqueio.
-- A condição usa o vínculo persistido do plano e só alcança pré-requisitos já
-- concluídos, sem liberar esperas documentais ou manuais.
UPDATE public.processes successor
SET blocked_reason = NULL,
    next_action = COALESCE(NULLIF(successor.next_action, ''), 'Iniciar atendimento'),
    action_owner = COALESCE(NULLIF(successor.action_owner, ''), 'equipe')
FROM public.client_service_plan_items target_item
JOIN public.client_service_plan_items prerequisite_item
  ON prerequisite_item.id = target_item.prerequisite_item_id
WHERE successor.service_plan_item_id = target_item.id
  AND successor.status = 'em_andamento'
  AND prerequisite_item.status = 'concluido'
  AND (
    LOWER(COALESCE(successor.blocked_reason, '')) LIKE 'aguardando conclusão%'
    OR LOWER(COALESCE(successor.blocked_reason, '')) LIKE 'aguardando deferimento%'
  );

CREATE OR REPLACE FUNCTION public.audit_stage_client_decisions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.data->>'client_notified') IS DISTINCT FROM (NEW.data->>'client_notified') THEN
    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note
    ) VALUES (
      NEW.process_id, public.get_profile_id(), 'updated',
      OLD.data->>'client_notified', NEW.data->>'client_notified',
      FORMAT('Cliente comunicado: %s', CASE WHEN NEW.data->>'client_notified' = 'true' THEN 'sim' ELSE 'não' END)
    );
  END IF;

  IF (OLD.data->>'documents_release_authorized') IS DISTINCT FROM (NEW.data->>'documents_release_authorized') THEN
    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note
    ) VALUES (
      NEW.process_id, public.get_profile_id(), 'updated',
      OLD.data->>'documents_release_authorized', NEW.data->>'documents_release_authorized',
      FORMAT(
        'Autorização para envio de documentos à concessionária: %s',
        CASE WHEN NEW.data->>'documents_release_authorized' = 'true' THEN 'concedida' ELSE 'revogada' END
      )
    );
  END IF;

  IF (OLD.data->>'purchase_only_with_ipi') IS DISTINCT FROM (NEW.data->>'purchase_only_with_ipi') THEN
    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note
    ) VALUES (
      NEW.process_id, public.get_profile_id(), 'updated',
      OLD.data->>'purchase_only_with_ipi', NEW.data->>'purchase_only_with_ipi',
      FORMAT(
        'Decisão de compra após o IPI: %s',
        CASE WHEN NEW.data->>'purchase_only_with_ipi' = 'sim'
          THEN 'comprar somente com IPI' ELSE 'prosseguir também com ICMS' END
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_stage_client_decisions ON public.process_stages;
CREATE TRIGGER audit_stage_client_decisions
  AFTER UPDATE OF data ON public.process_stages
  FOR EACH ROW EXECUTE FUNCTION public.audit_stage_client_decisions();

COMMENT ON FUNCTION public.audit_process_operational_changes() IS
  'Audita liberações automáticas, bloqueios operacionais e vínculos posteriores de veículo.';
COMMENT ON FUNCTION public.audit_stage_client_decisions() IS
  'Audita comunicação, autorização documental e decisão de continuidade IPI/ICMS.';
COMMENT ON FUNCTION public.validate_service_plan_item() IS
  'Valida vínculos do plano e permite somente a ausência transitória do atendimento durante cascades de exclusão.';
