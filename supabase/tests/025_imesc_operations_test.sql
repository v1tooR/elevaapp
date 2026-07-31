BEGIN;

SELECT plan(13);

SELECT has_table(
  'public',
  'imesc_followups',
  'existe uma carteira operacional própria do IMESC'
);

SELECT has_table(
  'public',
  'imesc_followup_history',
  'movimentações do IMESC possuem histórico'
);

SELECT ok(
  (
    SELECT is_nullable = 'NO'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'imesc_followups'
      AND column_name = 'client_id'
  ),
  'cliente é obrigatório no acompanhamento'
);

SELECT ok(
  (
    SELECT is_nullable = 'YES'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'imesc_followups'
      AND column_name = 'ipi_process_id'
  ),
  'processo IPI é opcional'
);

SELECT ok(
  (
    SELECT is_nullable = 'YES'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'imesc_followups'
      AND column_name = 'ipva_process_id'
  ),
  'processo IPVA é opcional'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.imesc_followups'::REGCLASS
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%client_id%'
  ),
  'há somente um acompanhamento corrente por cliente'
);

SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.imesc_followups'::REGCLASS
  ),
  'RLS protege os acompanhamentos IMESC'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'imesc_followups'
      AND policyname = 'Staff can manage IMESC followups'
  ),
  'somente a equipe possui política operacional do IMESC'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'imesc_followup_history'
      AND policyname = 'Staff can view IMESC history'
  ),
  'histórico do IMESC possui leitura restrita à equipe'
);

SELECT ok(
  POSITION(
    'imesc_agendamento'
    IN pg_get_functiondef('public.sync_ipva_workflow(uuid)'::REGPROCEDURE)
  ) = 0,
  'workflow ativo do IPVA não cria etapa do IMESC'
);

SELECT ok(
  POSITION(
    'sivei_protocolo'
    IN pg_get_functiondef('public.sync_ipva_workflow(uuid)'::REGPROCEDURE)
  ) > 0,
  'workflow do IPVA mantém o protocolo SIVEI'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.imesc_followups'::REGCLASS
      AND tgname = 'validate_imesc_process_links'
      AND NOT tgisinternal
  ),
  'vínculos opcionais são validados quando informados'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'Client can view own record'
  ),
  'dados internos do representante não são expostos por SELECT direto ao cliente'
);

SELECT * FROM finish();
ROLLBACK;
