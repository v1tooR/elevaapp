-- =====================================================
-- ELEVA ISENÇÕES - Workflow operacional e regras versionadas
-- =====================================================

-- 1. Corrigir recorrências que não podem ser inferidas por período fixo.
UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'Para o mesmo veículo, a isenção de IPVA-PCD em São Paulo não exige novo pedido anual. Reavaliar somente nas hipóteses legais, como troca de veículo ou alteração relevante.'
WHERE slug = 'processo_ipva';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'A renovação da CNH deve usar a data de vencimento efetivamente impressa no documento, sem presumir prazo fixo.'
WHERE slug = 'cnh_especial';

-- Preserva o histórico, mas cancela lembretes futuros criados pelas regras fixas antigas.
UPDATE public.calendar_events ce
SET status = 'canceled',
    description = CONCAT_WS(E'\n', ce.description, 'Cancelado pela migration 011: recorrência fixa substituída por validade documental/regra vigente.')
FROM public.processes p
JOIN public.process_types pt ON pt.id = p.process_type_id
WHERE ce.id = p.renewal_calendar_event_id
  AND pt.slug IN ('processo_ipva', 'cnh_especial')
  AND ce.status <> 'completed';

UPDATE public.processes p
SET renewal_date = NULL,
    renewal_calendar_event_id = NULL
FROM public.process_types pt
WHERE pt.id = p.process_type_id
  AND pt.slug IN ('processo_ipva', 'cnh_especial');

-- 2. Idempotência e metadados do workflow.
ALTER TABLE public.process_stages
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Duplicidades antigas são preservadas como registros legados, sem bloquear a constraint.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY process_id, stage_key ORDER BY updated_at DESC, id DESC) AS row_number
  FROM public.process_stages
)
UPDATE public.process_stages ps
SET stage_key = CONCAT(ps.stage_key, '_duplicado_', LEFT(ps.id::TEXT, 8)),
    label = CONCAT(ps.label, ' (duplicado legado)'),
    data = ps.data || '{"legacy_duplicate": true}'::JSONB
FROM ranked r
WHERE r.id = ps.id
  AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_process_stages_process_stage_key
  ON public.process_stages(process_id, stage_key);

-- Custom fields também precisam ser determinísticos para o sincronizador.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY process_id, field_name ORDER BY updated_at DESC, id DESC) AS row_number
  FROM public.process_custom_fields
)
UPDATE public.process_custom_fields pcf
SET field_name = CONCAT(pcf.field_name, '_duplicado_', LEFT(pcf.id::TEXT, 8)),
    field_label = CONCAT(pcf.field_label, ' (duplicado legado)')
FROM ranked r
WHERE r.id = pcf.id
  AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_process_custom_fields_process_field
  ON public.process_custom_fields(process_id, field_name);

UPDATE public.process_custom_fields
SET field_label = 'Observações sobre IMESC'
WHERE field_name = 'imesc';

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_events_process_source
  ON public.calendar_events(process_id, source_key);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_canceled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_source
  ON public.notifications(user_id, process_id, source_key);

CREATE INDEX IF NOT EXISTS idx_notifications_available
  ON public.notifications(user_id, available_at)
  WHERE is_canceled = FALSE;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS process_stage_id UUID REFERENCES public.process_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_process_stage
  ON public.documents(process_stage_id);

-- 3. Regras jurídicas versionadas e auditáveis.
CREATE TABLE IF NOT EXISTS public.legal_rule_versions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_type_slug TEXT        NOT NULL,
  rule_key          TEXT        NOT NULL,
  version           TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  source_url        TEXT        NOT NULL,
  effective_from    DATE        NOT NULL,
  effective_to      DATE,
  rule_data         JSONB       NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legal_rule_versions_period_check CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT legal_rule_versions_identity_unique UNIQUE (process_type_slug, rule_key, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_rule_versions_active
  ON public.legal_rule_versions(process_type_slug, is_active, effective_from DESC);

DROP TRIGGER IF EXISTS update_legal_rule_versions_updated_at ON public.legal_rule_versions;
CREATE TRIGGER update_legal_rule_versions_updated_at
  BEFORE UPDATE ON public.legal_rule_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.legal_rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view legal rules" ON public.legal_rule_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage legal rules" ON public.legal_rule_versions
  FOR ALL USING (get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

INSERT INTO public.legal_rule_versions (
  process_type_slug, rule_key, version, title, source_url, effective_from, rule_data
) VALUES
  (
    'processo_ipva',
    'imesc_report_validity',
    'decreto-70090-2025',
    'Validade do laudo IMESC',
    'https://legislacao.fazenda.sp.gov.br/Paginas/Decreto-70090-de-2025.aspx',
    '2025-11-17',
    '{"validity_years": 5, "renewal_exemption_may_apply_to_immutable_condition": true}'::JSONB
  ),
  (
    'processo_ipva',
    'ipva_appeal_deadline',
    'decreto-70090-2025',
    'Prazo e hipóteses de revisão do indeferimento',
    'https://legislacao.fazenda.sp.gov.br/Paginas/Decreto-70090-de-2025.aspx',
    '2025-11-17',
    '{"calendar_days": 30, "starts_from": "decision_notice", "review_reasons": ["no_disability", "mild_degree", "formal_error"]}'::JSONB
  ),
  (
    'processo_ipva',
    'mild_degree_exception',
    'lei-13296-compilada-2026',
    'Análise excepcional do grau leve',
    'https://www.al.sp.gov.br/repositorio/legislacao/lei/2008/compilacao-lei-13296-23.12.2008.html',
    '2022-01-01',
    '{"requires_human_review": true, "automatic_denial": false}'::JSONB
  ),
  (
    'processo_ipva',
    'same_vehicle_renewal',
    'sefaz-guidance-2026',
    'Manutenção da isenção para o mesmo veículo',
    'https://portal.fazenda.sp.gov.br/servicos/ipva/Paginas/Fiz-o-protocolo-do-pedido-de-isen%C3%A7%C3%A3o-PCD-mas-o-que-fa%C3%A7o-agora.aspx',
    '2026-01-01',
    '{"annual_reapplication_required": false, "scope": "same_vehicle"}'::JSONB
  )
ON CONFLICT (process_type_slug, rule_key, version) DO UPDATE SET
  title = EXCLUDED.title,
  source_url = EXCLUDED.source_url,
  effective_from = EXCLUDED.effective_from,
  rule_data = EXCLUDED.rule_data,
  is_active = TRUE;

-- 4. Helpers internos. Todas as funções públicas abaixo executam em uma única transação.
CREATE OR REPLACE FUNCTION public.workflow_assert_staff()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() NOT IN ('super_admin', 'admin', 'analista') THEN
    RAISE EXCEPTION 'Usuário não autorizado para operar workflows' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_assert_staff() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.workflow_upsert_event(
  p_process_id UUID,
  p_source_key TEXT,
  p_title TEXT,
  p_event_date DATE,
  p_event_type TEXT,
  p_description TEXT,
  p_visibility TEXT DEFAULT 'admin_only'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_process public.processes%ROWTYPE;
BEGIN
  SELECT * INTO v_process FROM public.processes WHERE id = p_process_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  INSERT INTO public.calendar_events (
    title, description, event_date, event_type, client_id, process_id,
    responsible_user_id, visibility, status, source_key
  ) VALUES (
    p_title, p_description, p_event_date, p_event_type, v_process.client_id, p_process_id,
    v_process.responsible_user_id, p_visibility, 'pending', p_source_key
  )
  ON CONFLICT (process_id, source_key) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    event_date = EXCLUDED.event_date,
    event_type = EXCLUDED.event_type,
    client_id = EXCLUDED.client_id,
    responsible_user_id = EXCLUDED.responsible_user_id,
    visibility = EXCLUDED.visibility,
    status = 'pending'
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_upsert_event(UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.workflow_notify_process(
  p_process_id UUID,
  p_source_key TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'warning',
  p_available_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO public.notifications (
    user_id, client_id, process_id, title, message, type,
    source_key, available_at, is_canceled, is_read
  )
  SELECT recipient.user_id,
         p.client_id,
         p.id,
         p_title,
         p_message,
         p_type,
         p_source_key,
         (p_available_date + TIME '08:00') AT TIME ZONE 'America/Sao_Paulo',
         FALSE,
         FALSE
  FROM public.processes p
  JOIN public.clients c ON c.id = p.client_id
  CROSS JOIN LATERAL (
    SELECT p.responsible_user_id AS user_id
    WHERE p.responsible_user_id IS NOT NULL
    UNION
    SELECT c.profile_id AS user_id
    WHERE c.profile_id IS NOT NULL
  ) recipient
  WHERE p.id = p_process_id
  ON CONFLICT (user_id, process_id, source_key) DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    type = EXCLUDED.type,
    available_at = EXCLUDED.available_at,
    is_canceled = FALSE,
    is_read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.workflow_notify_process(UUID, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;

-- 5. Inicialização e sincronização do workflow IMESC/IPVA-SP.
CREATE OR REPLACE FUNCTION public.sync_ipva_workflow(p_process_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_process RECORD;
  v_fields JSONB := '{}'::JSONB;
  v_imesc_status TEXT;
  v_sefaz_status TEXT;
  v_notice_date DATE;
  v_appeal_filed_date DATE;
  v_appeal_due_date DATE;
  v_reminder_date DATE;
  v_stage_count INTEGER;
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT p.id, p.client_id, p.status, p.jurisdiction_state,
         COALESCE(NULLIF(p.jurisdiction_state, ''), c.state) AS state,
         pt.slug
  INTO v_process
  FROM public.processes p
  JOIN public.clients c ON c.id = p.client_id
  JOIN public.process_types pt ON pt.id = p.process_type_id
  WHERE p.id = p_process_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;
  IF v_process.slug <> 'processo_ipva' OR UPPER(COALESCE(v_process.state, '')) <> 'SP' THEN
    RAISE EXCEPTION 'O workflow IMESC está disponível apenas para processos IPVA de São Paulo';
  END IF;

  INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, status, data)
  VALUES
    (p_process_id, 'ipva_documentos', 'Documentos iniciais', 10, 'pendente', '{"document_types":["laudo_imesc","protocolo_sivei","decisao_sefaz"]}'::JSONB),
    (p_process_id, 'imesc_agendamento', 'Agendamento IMESC', 20, 'pendente', '{}'::JSONB),
    (p_process_id, 'imesc_pericia', 'Perícia IMESC', 30, 'pendente', '{}'::JSONB),
    (p_process_id, 'imesc_laudo', 'Laudo IMESC', 40, 'pendente', '{"document_type":"laudo_imesc"}'::JSONB),
    (p_process_id, 'sivei_protocolo', 'Protocolo no SIVEI', 50, 'pendente', '{"document_type":"protocolo_sivei"}'::JSONB),
    (p_process_id, 'sefaz_decisao', 'Decisão da SEFAZ', 60, 'pendente', '{"document_type":"decisao_sefaz"}'::JSONB),
    (p_process_id, 'ipva_recurso', 'Recurso do IPVA', 70, 'nao_aplicavel', '{"document_type":"recurso_ipva"}'::JSONB),
    (p_process_id, 'ipva_conclusao', 'Conclusão da isenção', 80, 'pendente', '{}'::JSONB)
  ON CONFLICT (process_id, stage_key) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    data = process_stages.data || EXCLUDED.data;

  SELECT COALESCE(JSONB_OBJECT_AGG(field_name, field_value), '{}'::JSONB)
  INTO v_fields
  FROM public.process_custom_fields
  WHERE process_id = p_process_id;

  v_imesc_status := NULLIF(v_fields->>'imesc_status', '');
  v_sefaz_status := NULLIF(v_fields->>'sefaz_ipva_status', '');

  UPDATE public.process_stages
  SET status = 'pendente', completed_at = NULL
  WHERE process_id = p_process_id
    AND stage_key IN ('imesc_agendamento', 'imesc_pericia', 'imesc_laudo', 'sivei_protocolo', 'sefaz_decisao', 'ipva_conclusao');

  UPDATE public.process_stages
  SET status = 'nao_aplicavel', completed_at = NULL, due_date = NULL
  WHERE process_id = p_process_id AND stage_key = 'ipva_recurso';

  IF v_imesc_status = 'agendado' THEN
    UPDATE public.process_stages SET status = 'em_andamento'
    WHERE process_id = p_process_id AND stage_key = 'imesc_agendamento';
  ELSIF v_imesc_status = 'pericia_realizada' THEN
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key IN ('imesc_agendamento', 'imesc_pericia');
    UPDATE public.process_stages SET status = 'em_andamento'
    WHERE process_id = p_process_id AND stage_key = 'imesc_laudo';
  ELSIF v_imesc_status = 'laudo_disponivel' THEN
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key IN ('imesc_agendamento', 'imesc_pericia', 'imesc_laudo');
  ELSIF v_imesc_status IN ('laudo_anterior_reaproveitado', 'dispensa_documentada') THEN
    UPDATE public.process_stages SET status = 'nao_aplicavel'
    WHERE process_id = p_process_id AND stage_key IN ('imesc_agendamento', 'imesc_pericia');
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'imesc_laudo';
  END IF;

  IF v_sefaz_status = 'nao_protocolado' THEN
    UPDATE public.process_stages SET status = 'pendente'
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';
  ELSIF v_sefaz_status = 'em_analise' THEN
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';
    UPDATE public.process_stages SET status = 'em_andamento'
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';
    UPDATE public.processes SET status = 'aguardando_orgao'
    WHERE id = p_process_id AND status NOT IN ('concluido', 'arquivado', 'cancelado');
  ELSIF v_sefaz_status = 'deferido' THEN
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';
    UPDATE public.process_stages SET status = 'aprovado', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'ipva_conclusao';
    UPDATE public.processes SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE id = p_process_id;
  ELSIF v_sefaz_status = 'deferido_com_condicao' THEN
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';
    UPDATE public.process_stages SET status = 'aprovado', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';
    UPDATE public.process_stages SET status = 'em_andamento'
    WHERE process_id = p_process_id AND stage_key = 'ipva_conclusao';
  ELSIF v_sefaz_status IN ('indeferido', 'recurso_em_andamento') THEN
    UPDATE public.process_stages SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';
    UPDATE public.process_stages SET status = 'reprovado', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';
  END IF;

  IF COALESCE(v_fields->>'sefaz_data_ciencia', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_notice_date := (v_fields->>'sefaz_data_ciencia')::DATE;
  END IF;
  IF COALESCE(v_fields->>'recurso_ipva_protocolado_em', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_appeal_filed_date := (v_fields->>'recurso_ipva_protocolado_em')::DATE;
  END IF;

  IF v_sefaz_status IN ('indeferido', 'recurso_em_andamento') THEN
    IF v_appeal_filed_date IS NOT NULL OR v_sefaz_status = 'recurso_em_andamento' THEN
      UPDATE public.process_stages
      SET status = 'em_andamento', due_date = CASE WHEN v_notice_date IS NULL THEN NULL ELSE v_notice_date + 30 END
      WHERE process_id = p_process_id AND stage_key = 'ipva_recurso';

      UPDATE public.calendar_events SET status = 'canceled'
      WHERE process_id = p_process_id AND source_key IN ('ipva:appeal:deadline', 'ipva:appeal:d10', 'ipva:appeal:d3', 'ipva:appeal:d1');
      UPDATE public.notifications SET is_canceled = TRUE
      WHERE process_id = p_process_id AND source_key IN ('ipva:appeal:d10', 'ipva:appeal:d3', 'ipva:appeal:d1');
    ELSE
      UPDATE public.process_stages
      SET status = 'pendente', due_date = CASE WHEN v_notice_date IS NULL THEN NULL ELSE v_notice_date + 30 END
      WHERE process_id = p_process_id AND stage_key = 'ipva_recurso';

      PERFORM public.workflow_notify_process(
        p_process_id,
        'ipva:appeal:opened',
        'IPVA indeferido — avaliar recurso',
        CASE WHEN v_notice_date IS NULL
          THEN 'Registre a data da ciência para iniciar o controle seguro do prazo recursal.'
          ELSE FORMAT('O recurso deve ser avaliado até %s, 30 dias corridos após a ciência.', TO_CHAR(v_notice_date + 30, 'DD/MM/YYYY'))
        END,
        'warning',
        CURRENT_DATE
      );

      IF v_notice_date IS NOT NULL THEN
        v_appeal_due_date := v_notice_date + 30;
        PERFORM public.workflow_upsert_event(p_process_id, 'ipva:appeal:deadline', 'Prazo final — recurso IPVA', v_appeal_due_date, 'deadline', 'Prazo de 30 dias corridos contado da ciência da decisão.', 'admin_only');

        FOREACH v_reminder_date IN ARRAY ARRAY[v_appeal_due_date - 10, v_appeal_due_date - 3, v_appeal_due_date - 1]
        LOOP
          IF v_reminder_date >= CURRENT_DATE THEN
            PERFORM public.workflow_upsert_event(
              p_process_id,
              CASE (v_appeal_due_date - v_reminder_date) WHEN 10 THEN 'ipva:appeal:d10' WHEN 3 THEN 'ipva:appeal:d3' ELSE 'ipva:appeal:d1' END,
              FORMAT('Alerta recurso IPVA — faltam %s dia(s)', v_appeal_due_date - v_reminder_date),
              v_reminder_date,
              'reminder',
              FORMAT('Prazo final em %s.', TO_CHAR(v_appeal_due_date, 'DD/MM/YYYY')),
              'admin_only'
            );
            PERFORM public.workflow_notify_process(
              p_process_id,
              CASE (v_appeal_due_date - v_reminder_date) WHEN 10 THEN 'ipva:appeal:d10' WHEN 3 THEN 'ipva:appeal:d3' ELSE 'ipva:appeal:d1' END,
              FORMAT('Recurso IPVA — faltam %s dia(s)', v_appeal_due_date - v_reminder_date),
              FORMAT('O prazo recursal termina em %s.', TO_CHAR(v_appeal_due_date, 'DD/MM/YYYY')),
              'warning',
              v_reminder_date
            );
          END IF;
        END LOOP;
      END IF;
    END IF;
  ELSE
    UPDATE public.calendar_events SET status = 'canceled'
    WHERE process_id = p_process_id AND source_key IN ('ipva:appeal:deadline', 'ipva:appeal:d10', 'ipva:appeal:d3', 'ipva:appeal:d1');
    UPDATE public.notifications SET is_canceled = TRUE
    WHERE process_id = p_process_id AND source_key IN ('ipva:appeal:d10', 'ipva:appeal:d3', 'ipva:appeal:d1');
  END IF;

  INSERT INTO public.process_history (process_id, changed_by, action_type, note)
  VALUES (p_process_id, public.get_profile_id(), 'updated', 'Workflow IMESC/IPVA sincronizado');

  SELECT COUNT(*) INTO v_stage_count FROM public.process_stages WHERE process_id = p_process_id;
  RETURN JSONB_BUILD_OBJECT('process_id', p_process_id, 'stage_count', v_stage_count, 'appeal_due_date', v_appeal_due_date);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ipva_workflow(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_ipva_workflow(UUID) TO authenticated;

-- 6. Salvamento atômico de etapas, incluindo CNH, ciência, alertas e validade real.
CREATE OR REPLACE FUNCTION public.save_process_stage(
  p_stage_id UUID,
  p_status TEXT,
  p_scheduled_date DATE,
  p_attended BOOLEAN,
  p_result TEXT,
  p_notes TEXT,
  p_data JSONB,
  p_notify_client BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage public.process_stages%ROWTYPE;
  v_process RECORD;
  v_is_terminal BOOLEAN;
  v_notice_date DATE;
  v_due_date DATE;
  v_expiry_date DATE;
  v_reminder_date DATE;
  v_restrictions TEXT[];
  v_event_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();
  IF p_status NOT IN ('pendente', 'em_andamento', 'concluido', 'aprovado', 'reprovado', 'nao_aplicavel') THEN
    RAISE EXCEPTION 'Status de etapa inválido';
  END IF;

  SELECT * INTO v_stage FROM public.process_stages WHERE id = p_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;

  SELECT p.*, pt.slug AS process_type_slug, c.profile_id AS client_profile_id, c.name AS client_name
  INTO v_process
  FROM public.processes p
  JOIN public.process_types pt ON pt.id = p.process_type_id
  JOIN public.clients c ON c.id = p.client_id
  WHERE p.id = v_stage.process_id;

  v_is_terminal := p_status IN ('concluido', 'aprovado', 'reprovado');

  -- O prazo da CNH nasce da ciência, nunca do momento em que o usuário clicou em salvar.
  IF v_process.process_type_slug = 'cnh_especial'
     AND v_stage.stage_key = 'pericia_medica'
     AND (p_result = 'reprovado' OR p_status = 'reprovado') THEN
    IF COALESCE(p_data->>'decision_notified_at', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Informe a data da ciência da reprovação para calcular o prazo do recurso';
    END IF;
    v_notice_date := (p_data->>'decision_notified_at')::DATE;
    v_due_date := v_notice_date + 30;
  END IF;

  IF v_process.process_type_slug = 'cnh_especial'
     AND v_stage.stage_key = 'emissao_cnh'
     AND p_status = 'concluido' THEN
    IF COALESCE(p_data->>'vencimento_cnh', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Informe o vencimento impresso na CNH antes de concluir a emissão';
    END IF;
    v_expiry_date := (p_data->>'vencimento_cnh')::DATE;
  END IF;

  UPDATE public.process_stages
  SET status = p_status,
      scheduled_date = p_scheduled_date,
      attended = p_attended,
      result = NULLIF(p_result, ''),
      notes = NULLIF(p_notes, ''),
      data = COALESCE(p_data, '{}'::JSONB),
      completed_at = CASE WHEN v_is_terminal THEN COALESCE(completed_at, NOW()) ELSE NULL END
  WHERE id = p_stage_id;

  IF p_status IN ('em_andamento', 'concluido', 'aprovado', 'reprovado')
     AND v_process.status = 'aberto' THEN
    UPDATE public.processes SET status = 'em_andamento' WHERE id = v_process.id;
  END IF;

  INSERT INTO public.process_history (process_id, changed_by, action_type, new_value, note)
  VALUES (v_process.id, public.get_profile_id(), 'updated', p_status, FORMAT('Etapa "%s" → %s', v_stage.label, p_status));

  IF p_scheduled_date IS NOT NULL THEN
    v_event_id := public.workflow_upsert_event(
      v_process.id,
      FORMAT('stage:%s:appointment', v_stage.stage_key),
      FORMAT('%s — %s', v_stage.label, v_process.client_name),
      p_scheduled_date,
      'normal',
      p_notes,
      CASE WHEN p_notify_client THEN 'client_visible' ELSE 'admin_only' END
    );
    IF p_notify_client AND v_stage.scheduled_date IS DISTINCT FROM p_scheduled_date THEN
      PERFORM public.workflow_notify_process(
        v_process.id,
        FORMAT('stage:%s:appointment', v_stage.stage_key),
        FORMAT('Agendamento — %s', v_stage.label),
        FORMAT('%s agendado para %s.', v_stage.label, TO_CHAR(p_scheduled_date, 'DD/MM/YYYY')),
        'info',
        CURRENT_DATE
      );
    END IF;
  ELSE
    UPDATE public.calendar_events SET status = 'canceled'
    WHERE process_id = v_process.id AND source_key = FORMAT('stage:%s:appointment', v_stage.stage_key);
  END IF;

  IF v_process.process_type_slug = 'cnh_especial' AND v_stage.stage_key = 'pericia_medica' THEN
    IF p_result = 'reprovado' OR p_status = 'reprovado' THEN
      INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, status, due_date, data)
      VALUES (v_process.id, 'recurso_junta_medica', 'Recurso — Junta Médica (3 médicos)', 35, 'pendente', v_due_date, JSONB_BUILD_OBJECT('decision_notified_at', v_notice_date))
      ON CONFLICT (process_id, stage_key) DO UPDATE SET
        status = 'pendente',
        due_date = EXCLUDED.due_date,
        data = process_stages.data || EXCLUDED.data;

      PERFORM public.workflow_upsert_event(v_process.id, 'cnh:appeal:deadline', 'Prazo final — recurso CNH', v_due_date, 'deadline', 'Prazo calculado a partir da ciência da reprovação.', 'admin_only');
      PERFORM public.workflow_notify_process(v_process.id, 'cnh:appeal:opened', 'Perícia CNH reprovada — recurso necessário', FORMAT('Ciência em %s; prazo final em %s.', TO_CHAR(v_notice_date, 'DD/MM/YYYY'), TO_CHAR(v_due_date, 'DD/MM/YYYY')), 'warning', CURRENT_DATE);

      FOREACH v_reminder_date IN ARRAY ARRAY[v_due_date - 10, v_due_date - 3, v_due_date - 1]
      LOOP
        IF v_reminder_date >= CURRENT_DATE THEN
          PERFORM public.workflow_upsert_event(
            v_process.id,
            CASE (v_due_date - v_reminder_date) WHEN 10 THEN 'cnh:appeal:d10' WHEN 3 THEN 'cnh:appeal:d3' ELSE 'cnh:appeal:d1' END,
            FORMAT('Alerta recurso CNH — faltam %s dia(s)', v_due_date - v_reminder_date),
            v_reminder_date,
            'reminder',
            FORMAT('Prazo final em %s.', TO_CHAR(v_due_date, 'DD/MM/YYYY')),
            'admin_only'
          );
          PERFORM public.workflow_notify_process(
            v_process.id,
            CASE (v_due_date - v_reminder_date) WHEN 10 THEN 'cnh:appeal:d10' WHEN 3 THEN 'cnh:appeal:d3' ELSE 'cnh:appeal:d1' END,
            FORMAT('Recurso CNH — faltam %s dia(s)', v_due_date - v_reminder_date),
            FORMAT('O prazo termina em %s.', TO_CHAR(v_due_date, 'DD/MM/YYYY')),
            'warning',
            v_reminder_date
          );
        END IF;
      END LOOP;
    ELSIF p_result = 'aprovado' OR p_status = 'aprovado' THEN
      SELECT COALESCE(ARRAY_AGG(UPPER(TRIM(value))) FILTER (WHERE TRIM(value) <> ''), ARRAY[]::TEXT[])
      INTO v_restrictions
      FROM UNNEST(STRING_TO_ARRAY(COALESCE(p_data->>'restricoes', ''), ',')) value;

      UPDATE public.clients
      SET medical_assessment_status = CASE WHEN CARDINALITY(v_restrictions) > 0 THEN 'apto_com_restricoes' ELSE 'apto' END,
          requires_practical_exam = CASE WHEN JSONB_TYPEOF(p_data->'requires_practical_exam') = 'boolean' THEN (p_data->>'requires_practical_exam')::BOOLEAN ELSE NULL END,
          requires_adapted_vehicle = CASE WHEN JSONB_TYPEOF(p_data->'requires_adapted_vehicle') = 'boolean' THEN (p_data->>'requires_adapted_vehicle')::BOOLEAN ELSE NULL END,
          cnh_restrictions = v_restrictions
      WHERE id = v_process.client_id;

      UPDATE public.process_stages
      SET status = CASE WHEN (p_data->>'requires_practical_exam')::BOOLEAN THEN 'pendente' ELSE 'nao_aplicavel' END,
          label = 'Exame Prático'
      WHERE process_id = v_process.id
        AND stage_key = 'exame_pratico'
        AND JSONB_TYPEOF(p_data->'requires_practical_exam') = 'boolean';

      UPDATE public.process_stages
      SET data = data || JSONB_BUILD_OBJECT('restricoes', ARRAY_TO_STRING(v_restrictions, ', '))
      WHERE process_id = v_process.id AND stage_key = 'emissao_cnh';
    END IF;
  END IF;

  IF v_process.process_type_slug = 'cnh_especial'
     AND v_stage.stage_key = 'emissao_cnh'
     AND p_status = 'concluido' THEN
    SELECT COALESCE(ARRAY_AGG(UPPER(TRIM(value))) FILTER (WHERE TRIM(value) <> ''), ARRAY[]::TEXT[])
    INTO v_restrictions
    FROM UNNEST(STRING_TO_ARRAY(COALESCE(p_data->>'restricoes', ''), ',')) value;

    UPDATE public.clients
    SET has_cnh_especial = TRUE,
        cnh_status = 'com_restricoes',
        cnh_restrictions = v_restrictions
    WHERE id = v_process.client_id;

    UPDATE public.process_stages
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = v_process.id AND stage_key IN ('cnh_regularizada', 'liberado_isencoes');

    v_event_id := public.workflow_upsert_event(v_process.id, 'cnh:expiry', 'Vencimento da CNH Especial', v_expiry_date, 'renewal', 'Data de vencimento efetivamente impressa na CNH.', 'client_visible');

    UPDATE public.processes
    SET status = 'concluido',
        completed_at = COALESCE(completed_at, NOW()),
        renewal_date = v_expiry_date,
        renewal_calendar_event_id = v_event_id
    WHERE id = v_process.id;

    PERFORM public.workflow_notify_process(v_process.id, 'cnh:issued', 'CNH Especial emitida', FORMAT('CNH emitida. Vencimento registrado para %s.', TO_CHAR(v_expiry_date, 'DD/MM/YYYY')), 'success', CURRENT_DATE);
  ELSIF p_notify_client
        AND v_stage.status IS DISTINCT FROM p_status
        AND p_status IN ('em_andamento', 'aprovado', 'reprovado', 'concluido') THEN
    PERFORM public.workflow_notify_process(
      v_process.id,
      FORMAT('stage:%s:status:%s', v_stage.stage_key, p_status),
      FORMAT('%s — %s', v_process.process_type_slug, v_stage.label),
      FORMAT('A etapa "%s" foi atualizada para %s.', v_stage.label, p_status),
      CASE WHEN p_status = 'reprovado' THEN 'warning' ELSE 'status' END,
      CURRENT_DATE
    );
  END IF;

  RETURN JSONB_BUILD_OBJECT('stage_id', p_stage_id, 'process_id', v_process.id, 'status', p_status, 'due_date', v_due_date, 'renewal_date', v_expiry_date);
END;
$$;

REVOKE ALL ON FUNCTION public.save_process_stage(UUID, TEXT, DATE, BOOLEAN, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_process_stage(UUID, TEXT, DATE, BOOLEAN, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;

-- 7. Documento, histórico e vínculo de etapa são gravados juntos.
CREATE OR REPLACE FUNCTION public.add_process_document(
  p_process_id UUID,
  p_file_name TEXT,
  p_file_url TEXT,
  p_document_type TEXT DEFAULT NULL,
  p_process_stage_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_process public.processes%ROWTYPE;
  v_document_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();
  SELECT * INTO v_process FROM public.processes WHERE id = p_process_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  IF p_process_stage_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.process_stages WHERE id = p_process_stage_id AND process_id = p_process_id
  ) THEN
    RAISE EXCEPTION 'A etapa informada não pertence ao processo';
  END IF;

  INSERT INTO public.documents (
    client_id, process_id, process_stage_id, file_name, file_url,
    storage_path, document_type, status, uploaded_by
  ) VALUES (
    v_process.client_id, p_process_id, p_process_stage_id, TRIM(p_file_name), TRIM(p_file_url),
    NULL, NULLIF(p_document_type, ''), 'received', public.get_profile_id()
  ) RETURNING id INTO v_document_id;

  INSERT INTO public.process_history (process_id, changed_by, action_type, new_value, note)
  VALUES (p_process_id, public.get_profile_id(), 'document_uploaded', TRIM(p_file_name), FORMAT('Documento vinculado: %s', TRIM(p_file_name)));

  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_process_document(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_process_document(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
