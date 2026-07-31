-- =====================================================
-- ELEVA ISENÇÕES - Custódia protegida e write-only do Gov.br
-- =====================================================
-- A senha é cifrada no servidor Next.js antes de chegar ao Postgres.
-- A chave não fica no banco; portanto, dumps e backups contêm somente o
-- envelope AES-256-GCM. Não existe função SQL ou API para revelar o conteúdo.

-- 1. Simplifica a situação operacional e preserva as colunas legadas apenas
-- para histórico. Elas deixam de ser atualizadas e exibidas pela aplicação.
DROP TRIGGER IF EXISTS audit_client_gov_access ON public.clients;
DROP FUNCTION IF EXISTS public.audit_client_gov_access();

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_gov_validated_requires_client_auth,
  DROP CONSTRAINT IF EXISTS clients_gov_access_status_check;

UPDATE public.clients
SET gov_access_status = CASE
  WHEN gov_access_status = 'validado' THEN 'validado'
  WHEN gov_access_status IN ('nao_validado', 'aguardando_cliente', 'com_pendencia') THEN 'aguardando'
  ELSE 'nao_informou'
END;

ALTER TABLE public.clients
  ALTER COLUMN gov_access_status SET DEFAULT 'nao_informou',
  ADD CONSTRAINT clients_gov_access_status_check
    CHECK (gov_access_status IN ('aguardando', 'validado', 'nao_informou'));

COMMENT ON COLUMN public.clients.gov_access_status IS
  'Situação operacional simplificada: aguardando, validado ou nao_informou.';
COMMENT ON COLUMN public.clients.gov_auth_by_client IS
  'Campo legado preservado somente para histórico; não integra mais o fluxo operacional.';
COMMENT ON COLUMN public.clients.gov_account_level IS
  'Campo legado preservado somente para histórico; não integra mais o fluxo operacional.';
COMMENT ON COLUMN public.clients.gov_account_level_sufficient IS
  'Campo legado preservado somente para histórico; não integra mais o fluxo operacional.';
COMMENT ON COLUMN public.clients.gov_access_last_validated_at IS
  'Campo legado preservado somente para histórico; não integra mais o fluxo operacional.';
COMMENT ON COLUMN public.clients.gov_access_validated_by IS
  'Campo legado preservado somente para histórico; não integra mais o fluxo operacional.';
COMMENT ON COLUMN public.clients.gov_access_pending_note IS
  'Observação operacional. É proibido registrar senha ou código de verificação nesta coluna.';

-- 2. Tabela isolada. Nenhum papel da API recebe SELECT, INSERT, UPDATE ou
-- DELETE direto; as únicas mutações permitidas passam por RPCs auditadas.
CREATE TABLE IF NOT EXISTS public.client_gov_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  initialization_vector TEXT NOT NULL,
  authentication_tag TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_version TEXT NOT NULL,
  stored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_started_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  hard_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_gov_credentials_algorithm_check
    CHECK (algorithm = 'aes-256-gcm'),
  CONSTRAINT client_gov_credentials_ciphertext_check
    CHECK (
      LENGTH(ciphertext) BETWEEN 1 AND 2048
      AND ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'
    ),
  CONSTRAINT client_gov_credentials_iv_check
    CHECK (
      LENGTH(initialization_vector) = 16
      AND initialization_vector ~ '^[A-Za-z0-9+/]{16}$'
    ),
  CONSTRAINT client_gov_credentials_tag_check
    CHECK (
      LENGTH(authentication_tag) = 24
      AND authentication_tag ~ '^[A-Za-z0-9+/]{22}==$'
    ),
  CONSTRAINT client_gov_credentials_key_version_check
    CHECK (key_version ~ '^[A-Za-z0-9._-]{1,32}$'),
  CONSTRAINT client_gov_credentials_retention_check
    CHECK (
      (retention_started_at IS NULL AND purge_after IS NULL)
      OR (retention_started_at IS NOT NULL AND purge_after IS NOT NULL)
    )
);

ALTER TABLE public.client_gov_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_gov_credentials FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.client_gov_credentials IS
  'Envelopes AES-256-GCM write-only. A chave fica fora do banco; não criar política SELECT nem função de descriptografia.';
COMMENT ON COLUMN public.client_gov_credentials.ciphertext IS
  'Texto cifrado em Base64. Nunca contém a senha em claro.';

CREATE INDEX IF NOT EXISTS idx_client_gov_credentials_expiration
  ON public.client_gov_credentials(
    COALESCE(purge_after, hard_expires_at)
  );

-- A auditoria contém somente metadados da operação, jamais senha, IV,
-- authentication tag ou ciphertext.
CREATE TABLE IF NOT EXISTS public.gov_credential_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'stored',
    'replaced',
    'deleted',
    'expired',
    'retention_started',
    'retention_cancelled'
  )),
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gov_credential_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can audit Gov.br credential custody"
  ON public.gov_credential_audit;
CREATE POLICY "Admins can audit Gov.br credential custody"
  ON public.gov_credential_audit
  FOR SELECT
  USING (public.get_user_role() IN ('super_admin', 'admin'));

REVOKE ALL ON TABLE public.gov_credential_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gov_credential_audit TO authenticated;

COMMENT ON TABLE public.gov_credential_audit IS
  'Trilha de custódia sem qualquer conteúdo de credencial. Visível somente a administradores ativos.';

-- 3. Gravação/substituição. O chamador envia somente o envelope já cifrado.
CREATE OR REPLACE FUNCTION public.store_gov_credential_envelope(
  p_client_id UUID,
  p_ciphertext TEXT,
  p_initialization_vector TEXT,
  p_authentication_tag TEXT,
  p_algorithm TEXT,
  p_key_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
  v_was_stored BOOLEAN;
  v_has_process BOOLEAN;
  v_has_active_process BOOLEAN;
  v_retention_started_at TIMESTAMPTZ;
  v_purge_after TIMESTAMPTZ;
  v_hard_expires_at TIMESTAMPTZ := NOW() + INTERVAL '180 days';
BEGIN
  PERFORM public.workflow_assert_staff();
  v_profile_id := public.get_profile_id();

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = p_client_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF p_algorithm <> 'aes-256-gcm'
     OR LENGTH(p_ciphertext) NOT BETWEEN 1 AND 2048
     OR p_ciphertext !~ '^[A-Za-z0-9+/]+={0,2}$'
     OR p_initialization_vector !~ '^[A-Za-z0-9+/]{16}$'
     OR p_authentication_tag !~ '^[A-Za-z0-9+/]{22}==$'
     OR p_key_version !~ '^[A-Za-z0-9._-]{1,32}$' THEN
    RAISE EXCEPTION 'Envelope de credencial inválido';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.client_gov_credentials WHERE client_id = p_client_id
  ) INTO v_was_stored;

  SELECT EXISTS (
    SELECT 1 FROM public.processes WHERE client_id = p_client_id
  ) INTO v_has_process;

  SELECT EXISTS (
    SELECT 1
    FROM public.processes
    WHERE client_id = p_client_id
      AND status NOT IN ('concluido', 'arquivado', 'cancelado')
  ) INTO v_has_active_process;

  IF v_has_process AND NOT v_has_active_process THEN
    v_retention_started_at := NOW();
    v_purge_after := LEAST(NOW() + INTERVAL '7 days', v_hard_expires_at);
  END IF;

  INSERT INTO public.client_gov_credentials (
    client_id,
    ciphertext,
    initialization_vector,
    authentication_tag,
    algorithm,
    key_version,
    stored_by,
    stored_at,
    retention_started_at,
    purge_after,
    hard_expires_at,
    updated_at
  ) VALUES (
    p_client_id,
    p_ciphertext,
    p_initialization_vector,
    p_authentication_tag,
    p_algorithm,
    p_key_version,
    v_profile_id,
    NOW(),
    v_retention_started_at,
    v_purge_after,
    v_hard_expires_at,
    NOW()
  )
  ON CONFLICT (client_id) DO UPDATE SET
    ciphertext = EXCLUDED.ciphertext,
    initialization_vector = EXCLUDED.initialization_vector,
    authentication_tag = EXCLUDED.authentication_tag,
    algorithm = EXCLUDED.algorithm,
    key_version = EXCLUDED.key_version,
    stored_by = EXCLUDED.stored_by,
    stored_at = EXCLUDED.stored_at,
    retention_started_at = EXCLUDED.retention_started_at,
    purge_after = EXCLUDED.purge_after,
    hard_expires_at = EXCLUDED.hard_expires_at,
    updated_at = NOW();

  INSERT INTO public.gov_credential_audit (
    client_id,
    event_type,
    performed_by,
    metadata
  ) VALUES (
    p_client_id,
    CASE WHEN v_was_stored THEN 'replaced' ELSE 'stored' END,
    v_profile_id,
    JSONB_BUILD_OBJECT(
      'algorithm', p_algorithm,
      'key_version', p_key_version,
      'purge_after', v_purge_after,
      'hard_expires_at', v_hard_expires_at
    )
  );

  RETURN JSONB_BUILD_OBJECT(
    'stored', TRUE,
    'purge_after', v_purge_after,
    'hard_expires_at', v_hard_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.store_gov_credential_envelope(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_gov_credential_envelope(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- 4. Exclusão antecipada, disponível aos mesmos perfis que podem gravar.
CREATE OR REPLACE FUNCTION public.delete_gov_credential(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();

  DELETE FROM public.client_gov_credentials
  WHERE client_id = p_client_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NOT NULL THEN
    INSERT INTO public.gov_credential_audit (
      client_id,
      event_type,
      performed_by
    ) VALUES (
      p_client_id,
      'deleted',
      public.get_profile_id()
    );
  END IF;

  RETURN v_deleted_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_gov_credential(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_gov_credential(UUID) TO authenticated;

-- 5. Metadados seguros para a interface. Não retorna qualquer parte do
-- envelope, tampouco oferece descriptografia.
CREATE OR REPLACE FUNCTION public.get_gov_credential_metadata(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT JSONB_BUILD_OBJECT(
    'exists', TRUE,
    'stored_at', stored_at,
    'purge_after', purge_after,
    'hard_expires_at', hard_expires_at
  )
  INTO v_result
  FROM public.client_gov_credentials
  WHERE client_id = p_client_id;

  RETURN COALESCE(v_result, JSONB_BUILD_OBJECT(
    'exists', FALSE,
    'stored_at', NULL,
    'purge_after', NULL,
    'hard_expires_at', NULL
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_gov_credential_metadata(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gov_credential_metadata(UUID) TO authenticated;

-- 6. Inicia a retenção quando todos os processos terminam e cancela a
-- contagem quando um processo volta a ficar ativo.
CREATE OR REPLACE FUNCTION public.refresh_gov_credential_retention(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_active_process BOOLEAN;
  v_changed_id UUID;
  v_purge_after TIMESTAMPTZ;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.processes
    WHERE client_id = p_client_id
      AND status NOT IN ('concluido', 'arquivado', 'cancelado')
  ) INTO v_has_active_process;

  IF v_has_active_process THEN
    UPDATE public.client_gov_credentials
    SET retention_started_at = NULL,
        purge_after = NULL,
        updated_at = NOW()
    WHERE client_id = p_client_id
      AND retention_started_at IS NOT NULL
    RETURNING id INTO v_changed_id;

    IF v_changed_id IS NOT NULL THEN
      INSERT INTO public.gov_credential_audit (
        client_id,
        event_type,
        performed_by
      ) VALUES (
        p_client_id,
        'retention_cancelled',
        public.get_profile_id()
      );
    END IF;
  ELSE
    UPDATE public.client_gov_credentials
    SET retention_started_at = NOW(),
        purge_after = LEAST(NOW() + INTERVAL '7 days', hard_expires_at),
        updated_at = NOW()
    WHERE client_id = p_client_id
      AND retention_started_at IS NULL
    RETURNING id, purge_after INTO v_changed_id, v_purge_after;

    IF v_changed_id IS NOT NULL THEN
      INSERT INTO public.gov_credential_audit (
        client_id,
        event_type,
        performed_by,
        metadata
      ) VALUES (
        p_client_id,
        'retention_started',
        public.get_profile_id(),
        JSONB_BUILD_OBJECT('purge_after', v_purge_after)
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_gov_credential_retention(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_gov_credential_retention_from_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  v_client_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.client_id ELSE NEW.client_id END;
  PERFORM public.refresh_gov_credential_retention(v_client_id);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_gov_credential_retention_from_process() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_gov_credential_retention_from_process
  ON public.processes;
CREATE TRIGGER sync_gov_credential_retention_from_process
  AFTER INSERT OR DELETE OR UPDATE OF status
  ON public.processes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_gov_credential_retention_from_process();

-- 7. Exclusão automática. O job horário remove o envelope e registra somente
-- o motivo da expiração na trilha de auditoria.
CREATE OR REPLACE FUNCTION public.purge_expired_gov_credentials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credential RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_credential IN
    SELECT id, client_id, purge_after, hard_expires_at
    FROM public.client_gov_credentials
    WHERE (purge_after IS NOT NULL AND purge_after <= NOW())
       OR hard_expires_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.gov_credential_audit (
      client_id,
      event_type,
      metadata
    ) VALUES (
      v_credential.client_id,
      'expired',
      JSONB_BUILD_OBJECT(
        'reason',
        CASE
          WHEN v_credential.purge_after IS NOT NULL
               AND v_credential.purge_after <= NOW()
            THEN 'process_retention'
          ELSE 'hard_expiration'
        END
      )
    );

    DELETE FROM public.client_gov_credentials
    WHERE id = v_credential.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_gov_credentials() FROM PUBLIC, anon, authenticated;

-- O Supabase Cron executa a limpeza a cada hora. Reaplicar a migration com o
-- mesmo nome atualiza o job, sem criar duplicidade.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'eleva-purge-expired-gov-credentials',
  '15 * * * *',
  'SELECT public.purge_expired_gov_credentials();'
);
