BEGIN;

SELECT plan(19);

SELECT has_table('public', 'legal_rule_versions', 'legal_rule_versions existe');
SELECT has_column('public', 'process_stages', 'due_date', 'process_stages possui due_date');
SELECT has_column('public', 'documents', 'process_stage_id', 'documentos podem ser vinculados a etapas');
SELECT has_column('public', 'calendar_events', 'source_key', 'eventos possuem chave idempotente');
SELECT has_column('public', 'notifications', 'available_at', 'notificações podem ser agendadas');
SELECT has_column('public', 'notifications', 'source_key', 'notificações possuem chave idempotente');
SELECT has_index('public', 'process_stages', 'uq_process_stages_process_stage_key', 'etapas têm índice único');
SELECT has_index('public', 'calendar_events', 'uq_calendar_events_process_source', 'eventos têm índice único');
SELECT has_function('public', 'sync_ipva_workflow', ARRAY['uuid'], 'RPC de IPVA existe');
SELECT has_function('public', 'save_process_stage', ARRAY['uuid','text','date','boolean','text','text','jsonb','boolean'], 'RPC de etapa existe');
SELECT has_function('public', 'add_process_document', ARRAY['uuid','text','text','text','uuid'], 'RPC de documento existe');
SELECT results_eq(
  $$ SELECT renewal_period_months FROM public.process_types WHERE slug = 'processo_ipva' $$,
  ARRAY[NULL::INTEGER],
  'IPVA não possui recorrência anual fixa'
);

-- Integração: os comandos abaixo rodam em transação e são revertidos no final.
CREATE OR REPLACE FUNCTION public.workflow_assert_staff()
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;

CREATE TEMP TABLE workflow_fixture (key TEXT PRIMARY KEY, value UUID NOT NULL);

WITH inserted AS (
  INSERT INTO public.profiles (name, email, role)
  VALUES ('Teste Workflow', 'workflow@example.test', 'admin')
  RETURNING id
)
INSERT INTO workflow_fixture SELECT 'profile', id FROM inserted;

WITH inserted AS (
  INSERT INTO public.clients (profile_id, name, state)
  VALUES ((SELECT value FROM workflow_fixture WHERE key = 'profile'), 'Cliente Workflow', 'SP')
  RETURNING id
)
INSERT INTO workflow_fixture SELECT 'client', id FROM inserted;

WITH inserted AS (
  INSERT INTO public.processes (client_id, process_type_id, jurisdiction_state, responsible_user_id)
  VALUES (
    (SELECT value FROM workflow_fixture WHERE key = 'client'),
    (SELECT id FROM public.process_types WHERE slug = 'processo_ipva'),
    'SP',
    (SELECT value FROM workflow_fixture WHERE key = 'profile')
  )
  RETURNING id
)
INSERT INTO workflow_fixture SELECT 'ipva_process', id FROM inserted;

DO $$ BEGIN
  PERFORM public.sync_ipva_workflow((SELECT value FROM workflow_fixture WHERE key = 'ipva_process'));
END $$;

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.process_stages WHERE process_id = (SELECT value FROM workflow_fixture WHERE key = 'ipva_process')),
  8,
  'sincronização cria as oito etapas do IPVA'
);

DO $$ BEGIN
  PERFORM public.sync_ipva_workflow((SELECT value FROM workflow_fixture WHERE key = 'ipva_process'));
END $$;

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.process_stages WHERE process_id = (SELECT value FROM workflow_fixture WHERE key = 'ipva_process')),
  8,
  'segunda sincronização não duplica etapas'
);

INSERT INTO public.process_custom_fields (process_id, field_name, field_label, field_type, field_value)
VALUES
  ((SELECT value FROM workflow_fixture WHERE key = 'ipva_process'), 'sefaz_ipva_status', 'Situação SEFAZ', 'select', 'indeferido'),
  ((SELECT value FROM workflow_fixture WHERE key = 'ipva_process'), 'sefaz_data_ciencia', 'Data da ciência', 'date', CURRENT_DATE::TEXT);

DO $$ BEGIN
  PERFORM public.sync_ipva_workflow((SELECT value FROM workflow_fixture WHERE key = 'ipva_process'));
END $$;

SELECT is(
  (SELECT due_date FROM public.process_stages WHERE process_id = (SELECT value FROM workflow_fixture WHERE key = 'ipva_process') AND stage_key = 'ipva_recurso'),
  CURRENT_DATE + 30,
  'prazo IPVA nasce da data da ciência'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.calendar_events WHERE process_id = (SELECT value FROM workflow_fixture WHERE key = 'ipva_process') AND source_key LIKE 'ipva:appeal:%' AND status = 'pending'),
  4,
  'IPVA cria deadline e lembretes D-10, D-3 e D-1'
);

DO $$
DECLARE v_stage_id UUID;
BEGIN
  SELECT id INTO v_stage_id FROM public.process_stages
  WHERE process_id = (SELECT value FROM workflow_fixture WHERE key = 'ipva_process') AND stage_key = 'imesc_laudo';
  PERFORM public.add_process_document(
    (SELECT value FROM workflow_fixture WHERE key = 'ipva_process'),
    'Laudo de teste',
    'https://example.test/laudo',
    'laudo_imesc',
    v_stage_id
  );
END $$;

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.documents d JOIN public.process_stages ps ON ps.id = d.process_stage_id WHERE d.process_id = (SELECT value FROM workflow_fixture WHERE key = 'ipva_process') AND ps.stage_key = 'imesc_laudo'),
  1,
  'documento é vinculado à etapa na mesma operação'
);

WITH inserted AS (
  INSERT INTO public.processes (client_id, process_type_id, responsible_user_id)
  VALUES (
    (SELECT value FROM workflow_fixture WHERE key = 'client'),
    (SELECT id FROM public.process_types WHERE slug = 'cnh_especial'),
    (SELECT value FROM workflow_fixture WHERE key = 'profile')
  )
  RETURNING id
)
INSERT INTO workflow_fixture SELECT 'cnh_process', id FROM inserted;

WITH inserted AS (
  INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, data)
  VALUES ((SELECT value FROM workflow_fixture WHERE key = 'cnh_process'), 'pericia_medica', 'Perícia Médica', 30, '{}')
  RETURNING id
)
INSERT INTO workflow_fixture SELECT 'cnh_medical_stage', id FROM inserted;

DO $$ BEGIN
  PERFORM public.save_process_stage(
    (SELECT value FROM workflow_fixture WHERE key = 'cnh_medical_stage'),
    'reprovado', NULL, FALSE, 'reprovado', NULL,
    JSONB_BUILD_OBJECT('decision_notified_at', CURRENT_DATE::TEXT), TRUE
  );
END $$;

SELECT is(
  (SELECT due_date FROM public.process_stages WHERE process_id = (SELECT value FROM workflow_fixture WHERE key = 'cnh_process') AND stage_key = 'recurso_junta_medica'),
  CURRENT_DATE + 30,
  'prazo da CNH também nasce da ciência'
);

WITH inserted AS (
  INSERT INTO public.process_stages (process_id, stage_key, label, sort_order, data)
  VALUES ((SELECT value FROM workflow_fixture WHERE key = 'cnh_process'), 'emissao_cnh', 'Emissão da CNH', 50, '{}')
  RETURNING id
)
INSERT INTO workflow_fixture SELECT 'cnh_issuance_stage', id FROM inserted;

DO $$ BEGIN
  PERFORM public.save_process_stage(
    (SELECT value FROM workflow_fixture WHERE key = 'cnh_issuance_stage'),
    'concluido', NULL, FALSE, NULL, NULL,
    JSONB_BUILD_OBJECT('vencimento_cnh', (CURRENT_DATE + 1000)::TEXT, 'restricoes', 'B'), TRUE
  );
END $$;

SELECT is(
  (SELECT renewal_date FROM public.processes WHERE id = (SELECT value FROM workflow_fixture WHERE key = 'cnh_process')),
  CURRENT_DATE + 1000,
  'renovação da CNH usa o vencimento efetivamente informado'
);

SELECT * FROM finish();
ROLLBACK;
