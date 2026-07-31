-- =====================================================
-- ELEVA ISENÇÕES - Operação IMESC independente do IPVA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.imesc_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  board_status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (board_status IN (
      'aguardando', 'leve', 'moderado', 'grave',
      'nao_compareceu', 'sem_deficiencia', 'indeferido', 'cancelado'
    )),
  operational_status TEXT NOT NULL DEFAULT 'nao_iniciado'
    CHECK (operational_status IN (
      'nao_iniciado', 'solicitacao_em_preparo', 'agendado',
      'pericia_realizada', 'laudo_disponivel', 'encerrado'
    )),
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ipi_process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  ipva_process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  protocol TEXT,
  scheduled_date DATE,
  examination_date DATE,
  report_issued_at DATE,
  report_valid_until DATE,
  source_classification TEXT
    CHECK (source_classification IS NULL OR source_classification IN (
      'leve', 'moderada', 'grave', 'gravissima', 'sem_deficiencia'
    )),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT imesc_followups_one_per_client UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS public.imesc_followup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  followup_id UUID NOT NULL REFERENCES public.imesc_followups(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_board_status TEXT,
  new_board_status TEXT NOT NULL,
  old_operational_status TEXT,
  new_operational_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imesc_followups_board
  ON public.imesc_followups(board_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_imesc_followups_operational
  ON public.imesc_followups(operational_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_imesc_followups_responsible
  ON public.imesc_followups(responsible_user_id, updated_at DESC)
  WHERE responsible_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imesc_followups_ipi
  ON public.imesc_followups(ipi_process_id)
  WHERE ipi_process_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imesc_followups_ipva
  ON public.imesc_followups(ipva_process_id)
  WHERE ipva_process_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imesc_history_followup
  ON public.imesc_followup_history(followup_id, created_at DESC);

ALTER TABLE public.imesc_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imesc_followup_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage IMESC followups" ON public.imesc_followups;
CREATE POLICY "Staff can manage IMESC followups"
  ON public.imesc_followups
  FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP POLICY IF EXISTS "Staff can view IMESC history" ON public.imesc_followup_history;
CREATE POLICY "Staff can view IMESC history"
  ON public.imesc_followup_history
  FOR SELECT
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP TRIGGER IF EXISTS update_imesc_followups_updated_at
  ON public.imesc_followups;
CREATE TRIGGER update_imesc_followups_updated_at
  BEFORE UPDATE ON public.imesc_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_imesc_process_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process RECORD;
BEGIN
  IF NEW.ipi_process_id IS NOT NULL THEN
    SELECT process.client_id, process_type.slug
    INTO v_process
    FROM public.processes process
    JOIN public.process_types process_type ON process_type.id = process.process_type_id
    WHERE process.id = NEW.ipi_process_id;

    IF NOT FOUND OR v_process.client_id <> NEW.client_id OR v_process.slug <> 'processo_ipi' THEN
      RAISE EXCEPTION 'O processo IPI deve pertencer ao mesmo cliente';
    END IF;
  END IF;

  IF NEW.ipva_process_id IS NOT NULL THEN
    SELECT process.client_id, process_type.slug
    INTO v_process
    FROM public.processes process
    JOIN public.process_types process_type ON process_type.id = process.process_type_id
    WHERE process.id = NEW.ipva_process_id;

    IF NOT FOUND OR v_process.client_id <> NEW.client_id OR v_process.slug <> 'processo_ipva' THEN
      RAISE EXCEPTION 'O processo IPVA deve pertencer ao mesmo cliente';
    END IF;
  END IF;

  IF NEW.board_status = 'leve' THEN
    NEW.source_classification := 'leve';
  ELSIF NEW.board_status = 'moderado' THEN
    NEW.source_classification := 'moderada';
  ELSIF NEW.board_status = 'grave' THEN
    IF NEW.source_classification IS DISTINCT FROM 'gravissima' THEN
      NEW.source_classification := 'grave';
    END IF;
  ELSIF NEW.board_status = 'sem_deficiencia' THEN
    NEW.source_classification := 'sem_deficiencia';
  ELSE
    NEW.source_classification := NULL;
  END IF;

  IF NEW.operational_status IN ('nao_iniciado', 'solicitacao_em_preparo') THEN
    NEW.scheduled_date := NULL;
    NEW.examination_date := NULL;
    NEW.report_issued_at := NULL;
    NEW.report_valid_until := NULL;
  ELSIF NEW.operational_status = 'agendado' THEN
    NEW.examination_date := NULL;
    NEW.report_issued_at := NULL;
    NEW.report_valid_until := NULL;
  ELSIF NEW.operational_status = 'pericia_realizada' THEN
    NEW.report_issued_at := NULL;
    NEW.report_valid_until := NULL;
  END IF;

  IF NEW.board_status IN ('sem_deficiencia', 'indeferido', 'cancelado')
     OR NEW.operational_status = 'encerrado' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_imesc_process_links
  ON public.imesc_followups;
CREATE TRIGGER validate_imesc_process_links
  BEFORE INSERT OR UPDATE ON public.imesc_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_imesc_process_links();

CREATE OR REPLACE FUNCTION public.audit_imesc_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR OLD.board_status IS DISTINCT FROM NEW.board_status
     OR OLD.operational_status IS DISTINCT FROM NEW.operational_status THEN
    INSERT INTO public.imesc_followup_history (
      followup_id,
      changed_by,
      old_board_status,
      new_board_status,
      old_operational_status,
      new_operational_status,
      note
    ) VALUES (
      NEW.id,
      public.get_profile_id(),
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.board_status ELSE NULL END,
      NEW.board_status,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.operational_status ELSE NULL END,
      NEW.operational_status,
      CASE WHEN TG_OP = 'INSERT'
        THEN 'Acompanhamento IMESC iniciado'
        ELSE 'Situação do acompanhamento IMESC atualizada'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_imesc_followup
  ON public.imesc_followups;
CREATE TRIGGER audit_imesc_followup
  AFTER INSERT OR UPDATE ON public.imesc_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_imesc_followup();

-- Backfill seguro: cria um acompanhamento por cliente a partir do processo
-- IPVA mais recente, preservando a classificação original do laudo.
WITH latest_ipva AS (
  SELECT DISTINCT ON (process.client_id)
    process.id AS ipva_process_id,
    process.client_id,
    process.responsible_user_id,
    process.created_at,
    COALESCE(
      JSONB_OBJECT_AGG(field.field_name, field.field_value)
        FILTER (WHERE field.field_name IS NOT NULL),
      '{}'::JSONB
    ) AS fields
  FROM public.processes process
  JOIN public.process_types process_type
    ON process_type.id = process.process_type_id
   AND process_type.slug = 'processo_ipva'
  LEFT JOIN public.process_custom_fields field
    ON field.process_id = process.id
  GROUP BY
    process.id,
    process.client_id,
    process.responsible_user_id,
    process.created_at
  ORDER BY process.client_id, process.created_at DESC, process.id DESC
),
legacy_imesc AS (
  SELECT
    latest.*,
    ipi.id AS ipi_process_id
  FROM latest_ipva latest
  LEFT JOIN LATERAL (
    SELECT process.id
    FROM public.processes process
    JOIN public.process_types process_type
      ON process_type.id = process.process_type_id
     AND process_type.slug = 'processo_ipi'
    WHERE process.client_id = latest.client_id
    ORDER BY process.created_at DESC, process.id DESC
    LIMIT 1
  ) ipi ON TRUE
  WHERE COALESCE(latest.fields->>'imesc_status', '') <> ''
     OR COALESCE(latest.fields->>'imesc_grau', '') <> ''
     OR COALESCE(latest.fields->>'imesc_protocolo', '') <> ''
     OR COALESCE(latest.fields->>'imesc_data_pericia', '') <> ''
     OR COALESCE(latest.fields->>'imesc_data_laudo', '') <> ''
     OR COALESCE(latest.fields->>'imesc', '') <> ''
     OR EXISTS (
       SELECT 1
       FROM public.process_stages stage
       WHERE stage.process_id = latest.ipva_process_id
         AND stage.stage_key IN ('imesc_agendamento', 'imesc_pericia', 'imesc_laudo')
     )
)
INSERT INTO public.imesc_followups (
  client_id,
  board_status,
  operational_status,
  responsible_user_id,
  ipi_process_id,
  ipva_process_id,
  protocol,
  scheduled_date,
  examination_date,
  report_issued_at,
  source_classification,
  notes,
  started_at
)
SELECT
  legacy.client_id,
  CASE legacy.fields->>'imesc_grau'
    WHEN 'leve' THEN 'leve'
    WHEN 'moderada' THEN 'moderado'
    WHEN 'moderado' THEN 'moderado'
    WHEN 'grave' THEN 'grave'
    WHEN 'gravissima' THEN 'grave'
    WHEN 'sem_deficiencia' THEN 'sem_deficiencia'
    ELSE 'aguardando'
  END,
  CASE
    WHEN legacy.fields->>'imesc_status' = 'agendado' THEN 'agendado'
    WHEN legacy.fields->>'imesc_status' = 'pericia_realizada' THEN 'pericia_realizada'
    WHEN legacy.fields->>'imesc_status' IN (
      'laudo_disponivel', 'laudo_anterior_reaproveitado'
    ) THEN 'laudo_disponivel'
    WHEN legacy.fields->>'imesc_status' = 'dispensa_documentada' THEN 'encerrado'
    WHEN EXISTS (
      SELECT 1
      FROM public.process_stages stage
      WHERE stage.process_id = legacy.ipva_process_id
        AND stage.stage_key = 'imesc_laudo'
        AND stage.status IN ('concluido', 'aprovado')
    ) THEN 'laudo_disponivel'
    WHEN EXISTS (
      SELECT 1
      FROM public.process_stages stage
      WHERE stage.process_id = legacy.ipva_process_id
        AND stage.stage_key = 'imesc_pericia'
        AND stage.status IN ('concluido', 'aprovado')
    ) THEN 'pericia_realizada'
    WHEN EXISTS (
      SELECT 1
      FROM public.process_stages stage
      WHERE stage.process_id = legacy.ipva_process_id
        AND stage.stage_key = 'imesc_agendamento'
        AND stage.status IN ('em_andamento', 'concluido', 'aprovado')
    ) THEN 'agendado'
    ELSE 'nao_iniciado'
  END,
  legacy.responsible_user_id,
  legacy.ipi_process_id,
  legacy.ipva_process_id,
  NULLIF(legacy.fields->>'imesc_protocolo', ''),
  CASE
    WHEN legacy.fields->>'imesc_status' = 'agendado'
      AND COALESCE(legacy.fields->>'imesc_data_pericia', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (legacy.fields->>'imesc_data_pericia')::DATE
    ELSE NULL
  END,
  CASE
    WHEN legacy.fields->>'imesc_status' IN (
      'pericia_realizada', 'laudo_disponivel', 'laudo_anterior_reaproveitado'
    )
      AND COALESCE(legacy.fields->>'imesc_data_pericia', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (legacy.fields->>'imesc_data_pericia')::DATE
    ELSE NULL
  END,
  CASE
    WHEN COALESCE(legacy.fields->>'imesc_data_laudo', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (legacy.fields->>'imesc_data_laudo')::DATE
    ELSE NULL
  END,
  CASE
    WHEN legacy.fields->>'imesc_grau' IN (
      'leve', 'moderada', 'grave', 'gravissima', 'sem_deficiencia'
    ) THEN legacy.fields->>'imesc_grau'
    ELSE NULL
  END,
  NULLIF(legacy.fields->>'imesc', ''),
  legacy.created_at
FROM legacy_imesc legacy
ON CONFLICT (client_id) DO NOTHING;

-- Reexecuta de modo idempotente o backfill de múltiplas deficiências.
UPDATE public.clients
SET disability_types = ARRAY[disability_type]::TEXT[]
WHERE disability_type IS NOT NULL
  AND COALESCE(CARDINALITY(disability_types), 0) = 0;

UPDATE public.leads
SET disability_types = ARRAY[disability_type]::TEXT[]
WHERE disability_type IS NOT NULL
  AND COALESCE(CARDINALITY(disability_types), 0) = 0;

UPDATE public.process_types
SET description = 'Isenção de IPVA para PCD, com protocolo, decisão da SEFAZ, recurso e conclusão'
WHERE slug = 'processo_ipva';

-- O workflow do IPVA passa a cuidar somente do protocolo, SEFAZ, recurso e
-- conclusão. As etapas IMESC antigas permanecem no banco como histórico.
CREATE OR REPLACE FUNCTION public.sync_ipva_workflow(p_process_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_process RECORD;
  v_fields JSONB := '{}'::JSONB;
  v_sefaz_status TEXT;
  v_notice_date DATE;
  v_appeal_filed_date DATE;
  v_appeal_due_date DATE;
  v_reminder_date DATE;
  v_stage_count INTEGER;
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT process.id, process.client_id, process.status,
         COALESCE(NULLIF(process.jurisdiction_state, ''), client.state) AS state,
         process_type.slug
  INTO v_process
  FROM public.processes process
  JOIN public.clients client ON client.id = process.client_id
  JOIN public.process_types process_type ON process_type.id = process.process_type_id
  WHERE process.id = p_process_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;
  IF v_process.slug <> 'processo_ipva'
     OR UPPER(COALESCE(v_process.state, '')) <> 'SP' THEN
    RAISE EXCEPTION 'O workflow IPVA está disponível apenas para processos de São Paulo';
  END IF;

  INSERT INTO public.process_stages (
    process_id, stage_key, label, sort_order, status, data
  )
  VALUES
    (p_process_id, 'ipva_documentos', 'Documentos iniciais', 10, 'pendente', '{"document_types":["protocolo_sivei","decisao_sefaz"]}'::JSONB),
    (p_process_id, 'sivei_protocolo', 'Protocolo no SIVEI', 20, 'pendente', '{"document_type":"protocolo_sivei"}'::JSONB),
    (p_process_id, 'sefaz_decisao', 'Decisão da SEFAZ', 30, 'pendente', '{"document_type":"decisao_sefaz"}'::JSONB),
    (p_process_id, 'ipva_recurso', 'Recurso do IPVA', 40, 'nao_aplicavel', '{"document_type":"recurso_ipva"}'::JSONB),
    (p_process_id, 'ipva_conclusao', 'Conclusão da isenção', 50, 'pendente', '{}'::JSONB)
  ON CONFLICT (process_id, stage_key) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    data = public.process_stages.data || EXCLUDED.data;

  SELECT COALESCE(JSONB_OBJECT_AGG(field_name, field_value), '{}'::JSONB)
  INTO v_fields
  FROM public.process_custom_fields
  WHERE process_id = p_process_id;

  v_sefaz_status := NULLIF(v_fields->>'sefaz_ipva_status', '');

  UPDATE public.process_stages
  SET status = 'pendente', completed_at = NULL
  WHERE process_id = p_process_id
    AND stage_key IN (
      'sivei_protocolo', 'sefaz_decisao', 'ipva_conclusao'
    );

  UPDATE public.process_stages
  SET status = 'nao_aplicavel', completed_at = NULL, due_date = NULL
  WHERE process_id = p_process_id
    AND stage_key = 'ipva_recurso';

  IF v_sefaz_status = 'em_analise' THEN
    UPDATE public.process_stages
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';

    UPDATE public.process_stages SET status = 'em_andamento'
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';

    UPDATE public.processes SET status = 'aguardando_orgao'
    WHERE id = p_process_id
      AND status NOT IN ('concluido', 'arquivado', 'cancelado');
  ELSIF v_sefaz_status = 'deferido' THEN
    UPDATE public.process_stages
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';

    UPDATE public.process_stages
    SET status = 'aprovado', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';

    UPDATE public.process_stages
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'ipva_conclusao';

    UPDATE public.processes
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE id = p_process_id;
  ELSIF v_sefaz_status = 'deferido_com_condicao' THEN
    UPDATE public.process_stages
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';

    UPDATE public.process_stages
    SET status = 'aprovado', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sefaz_decisao';

    UPDATE public.process_stages SET status = 'em_andamento'
    WHERE process_id = p_process_id AND stage_key = 'ipva_conclusao';
  ELSIF v_sefaz_status IN ('indeferido', 'recurso_em_andamento') THEN
    UPDATE public.process_stages
    SET status = 'concluido', completed_at = COALESCE(completed_at, NOW())
    WHERE process_id = p_process_id AND stage_key = 'sivei_protocolo';

    UPDATE public.process_stages
    SET status = 'reprovado', completed_at = COALESCE(completed_at, NOW())
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
      SET status = 'em_andamento',
          due_date = CASE WHEN v_notice_date IS NULL THEN NULL ELSE v_notice_date + 30 END
      WHERE process_id = p_process_id AND stage_key = 'ipva_recurso';

      UPDATE public.calendar_events SET status = 'canceled'
      WHERE process_id = p_process_id
        AND source_key IN (
          'ipva:appeal:deadline', 'ipva:appeal:d10',
          'ipva:appeal:d3', 'ipva:appeal:d1'
        );
      UPDATE public.notifications SET is_canceled = TRUE
      WHERE process_id = p_process_id
        AND source_key IN ('ipva:appeal:d10', 'ipva:appeal:d3', 'ipva:appeal:d1');
    ELSE
      UPDATE public.process_stages
      SET status = 'pendente',
          due_date = CASE WHEN v_notice_date IS NULL THEN NULL ELSE v_notice_date + 30 END
      WHERE process_id = p_process_id AND stage_key = 'ipva_recurso';

      PERFORM public.workflow_notify_process(
        p_process_id,
        'ipva:appeal:opened',
        'IPVA indeferido — avaliar recurso',
        CASE WHEN v_notice_date IS NULL
          THEN 'Registre a data da ciência para iniciar o controle seguro do prazo recursal.'
          ELSE FORMAT(
            'O recurso deve ser avaliado até %s, 30 dias corridos após a ciência.',
            TO_CHAR(v_notice_date + 30, 'DD/MM/YYYY')
          )
        END,
        'warning',
        CURRENT_DATE
      );

      IF v_notice_date IS NOT NULL THEN
        v_appeal_due_date := v_notice_date + 30;
        PERFORM public.workflow_upsert_event(
          p_process_id,
          'ipva:appeal:deadline',
          'Prazo final — recurso IPVA',
          v_appeal_due_date,
          'deadline',
          'Prazo de 30 dias corridos contado da ciência da decisão.',
          'admin_only'
        );

        FOREACH v_reminder_date IN ARRAY ARRAY[
          v_appeal_due_date - 10,
          v_appeal_due_date - 3,
          v_appeal_due_date - 1
        ]
        LOOP
          IF v_reminder_date >= CURRENT_DATE THEN
            PERFORM public.workflow_upsert_event(
              p_process_id,
              CASE (v_appeal_due_date - v_reminder_date)
                WHEN 10 THEN 'ipva:appeal:d10'
                WHEN 3 THEN 'ipva:appeal:d3'
                ELSE 'ipva:appeal:d1'
              END,
              FORMAT(
                'Alerta recurso IPVA — faltam %s dia(s)',
                v_appeal_due_date - v_reminder_date
              ),
              v_reminder_date,
              'reminder',
              FORMAT('Prazo final em %s.', TO_CHAR(v_appeal_due_date, 'DD/MM/YYYY')),
              'admin_only'
            );
            PERFORM public.workflow_notify_process(
              p_process_id,
              CASE (v_appeal_due_date - v_reminder_date)
                WHEN 10 THEN 'ipva:appeal:d10'
                WHEN 3 THEN 'ipva:appeal:d3'
                ELSE 'ipva:appeal:d1'
              END,
              FORMAT(
                'Recurso IPVA — faltam %s dia(s)',
                v_appeal_due_date - v_reminder_date
              ),
              FORMAT(
                'O prazo recursal termina em %s.',
                TO_CHAR(v_appeal_due_date, 'DD/MM/YYYY')
              ),
              'warning',
              v_reminder_date
            );
          END IF;
        END LOOP;
      END IF;
    END IF;
  ELSE
    UPDATE public.calendar_events SET status = 'canceled'
    WHERE process_id = p_process_id
      AND source_key IN (
        'ipva:appeal:deadline', 'ipva:appeal:d10',
        'ipva:appeal:d3', 'ipva:appeal:d1'
      );
    UPDATE public.notifications SET is_canceled = TRUE
    WHERE process_id = p_process_id
      AND source_key IN ('ipva:appeal:d10', 'ipva:appeal:d3', 'ipva:appeal:d1');
  END IF;

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, note
  )
  VALUES (
    p_process_id,
    public.get_profile_id(),
    'updated',
    'Workflow IPVA sincronizado'
  );

  SELECT COUNT(*)
  INTO v_stage_count
  FROM public.process_stages
  WHERE process_id = p_process_id
    AND stage_key IN (
      'ipva_documentos', 'sivei_protocolo', 'sefaz_decisao',
      'ipva_recurso', 'ipva_conclusao'
    );

  RETURN JSONB_BUILD_OBJECT(
    'process_id', p_process_id,
    'stage_count', v_stage_count,
    'appeal_due_date', v_appeal_due_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ipva_workflow(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_ipva_workflow(UUID) TO authenticated;

-- Confirma o menor privilégio para vendedores/indicadores: analistas apenas
-- consultam; somente administradores criam, editam ou desativam parceiros.
DROP POLICY IF EXISTS "Staff can view referral partners" ON public.referral_partners;
CREATE POLICY "Staff can view referral partners"
  ON public.referral_partners
  FOR SELECT
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP POLICY IF EXISTS "Admins can manage referral partners" ON public.referral_partners;
CREATE POLICY "Admins can manage referral partners"
  ON public.referral_partners
  FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));

-- Dados de representante permanecem disponíveis somente para a equipe nas
-- tabelas internas. O portal do cliente usa DTOs mínimos via funções seguras.
DROP POLICY IF EXISTS "Client can view own record" ON public.clients;

COMMENT ON TABLE public.imesc_followups IS
  'Acompanhamento operacional IMESC independente dos processos IPI e IPVA.';
COMMENT ON COLUMN public.imesc_followups.board_status IS
  'Classificação do fluxo IMESC; não representa grau genérico do cadastro do cliente.';
COMMENT ON COLUMN public.imesc_followups.ipi_process_id IS
  'Vínculo opcional: o acompanhamento pode começar antes ou durante o IPI.';
COMMENT ON COLUMN public.imesc_followups.ipva_process_id IS
  'Vínculo opcional: a existência do IPVA não é requisito para acompanhar o IMESC.';
COMMENT ON TABLE public.referral_partners IS
  'Cadastro protegido de vendedores e indicadores; leitura interna e escrita exclusiva de administradores.';
COMMENT ON COLUMN public.clients.legal_representative_name IS
  'Dado pessoal interno do representante; não expor em DTOs do portal do cliente.';
COMMENT ON COLUMN public.clients.legal_representative_cpf IS
  'Dado pessoal interno do representante; acesso direto restrito à equipe.';
