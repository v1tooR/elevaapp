BEGIN;

-- =====================================================
-- 1. VISIBILIDADE EXPLÍCITA E SEGURA POR PADRÃO
-- =====================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'admin_only'
    CHECK (visibility IN ('admin_only', 'client_visible'));

ALTER TABLE public.process_history
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.process_custom_fields
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_documents_client_visibility
  ON public.documents(client_id, visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_process_history_client_visible
  ON public.process_history(process_id, client_visible, created_at DESC);

-- O portal mostra somente o tipo e a data dessas movimentações; notas, valores
-- anteriores e valores novos permanecem exclusivamente internos.
UPDATE public.process_history
SET client_visible = TRUE
WHERE action_type IN (
  'created', 'status_changed', 'document_uploaded', 'document_approved',
  'document_rejected', 'completed', 'archived', 'cancelled'
);

-- Documentos já existentes permanecem privados até revisão humana.
UPDATE public.documents
SET visibility = 'admin_only'
WHERE visibility IS NULL OR visibility NOT IN ('admin_only', 'client_visible');

-- =====================================================
-- 2. PERFIS INATIVOS NÃO AUTORIZAM NENHUMA OPERAÇÃO
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_client_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT c.id
  FROM public.clients c
  JOIN public.profiles p ON p.id = c.profile_id
  WHERE p.auth_user_id = auth.uid()
    AND p.is_active = TRUE
    AND c.is_active = TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_id() TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Active users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth_user_id = auth.uid() AND is_active = TRUE);

-- Dados internos deixam de ser consultáveis diretamente pelo cliente. O portal
-- usa uma DAL server-only, verifica a titularidade e retorna DTOs mínimos.
DROP POLICY IF EXISTS "Client can view own record" ON public.clients;
DROP POLICY IF EXISTS "Client can view own processes" ON public.processes;
DROP POLICY IF EXISTS "Client can view own custom fields" ON public.process_custom_fields;
DROP POLICY IF EXISTS "Client can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Client can upload own documents" ON public.documents;
DROP POLICY IF EXISTS "Client can view own history" ON public.process_history;
DROP POLICY IF EXISTS "Client can view own process stages" ON public.process_stages;

-- =====================================================
-- 3. DOCUMENTOS: URL CONTROLADA, TITULARIDADE E HISTÓRICO ATÔMICO
-- =====================================================

CREATE OR REPLACE FUNCTION public.document_url_is_allowed(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    TRIM(p_url) ~* '^https://(drive\.google\.com|docs\.google\.com)(/|$)',
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.document_url_is_allowed(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.add_staff_process_document(
  p_process_id UUID,
  p_file_name TEXT,
  p_file_url TEXT,
  p_document_type TEXT,
  p_process_stage_id UUID,
  p_visibility TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process public.processes%ROWTYPE;
  v_document_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();

  IF p_visibility NOT IN ('admin_only', 'client_visible') THEN
    RAISE EXCEPTION 'Visibilidade de documento inválida';
  END IF;
  IF NOT public.document_url_is_allowed(p_file_url) THEN
    RAISE EXCEPTION 'Use um link HTTPS válido do Google Drive';
  END IF;

  SELECT * INTO v_process
  FROM public.processes
  WHERE id = p_process_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  IF p_process_stage_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.process_stages
    WHERE id = p_process_stage_id AND process_id = p_process_id
  ) THEN
    RAISE EXCEPTION 'A etapa informada não pertence ao processo';
  END IF;

  INSERT INTO public.documents (
    client_id, process_id, process_stage_id, file_name, file_url,
    storage_path, document_type, status, uploaded_by, visibility
  ) VALUES (
    v_process.client_id, p_process_id, p_process_stage_id, TRIM(p_file_name), TRIM(p_file_url),
    NULL, NULLIF(p_document_type, ''), 'received', public.get_profile_id(), p_visibility
  ) RETURNING id INTO v_document_id;

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, new_value, note, client_visible
  ) VALUES (
    p_process_id, public.get_profile_id(), 'document_uploaded', TRIM(p_file_name),
    FORMAT('Documento vinculado: %s', TRIM(p_file_name)),
    p_visibility = 'client_visible'
  );

  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_staff_process_document(UUID, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_staff_process_document(UUID, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- Mantém compatibilidade com integrações existentes, sempre com padrão privado.
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
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.add_staff_process_document(
    p_process_id,
    p_file_name,
    p_file_url,
    p_document_type,
    p_process_stage_id,
    'admin_only'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_process_document(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_process_document(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_client_process_document(
  p_process_id UUID,
  p_file_name TEXT,
  p_file_url TEXT,
  p_document_type TEXT DEFAULT NULL,
  p_process_stage_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process public.processes%ROWTYPE;
  v_profile_id UUID;
  v_client_id UUID;
  v_document_id UUID;
BEGIN
  v_profile_id := public.get_profile_id();
  v_client_id := public.get_client_id();

  IF v_profile_id IS NULL OR v_client_id IS NULL OR public.get_user_role() <> 'cliente' THEN
    RAISE EXCEPTION 'Cliente não autorizado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.document_url_is_allowed(p_file_url) THEN
    RAISE EXCEPTION 'Use um link HTTPS válido do Google Drive';
  END IF;

  SELECT * INTO v_process
  FROM public.processes
  WHERE id = p_process_id AND client_id = v_client_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  IF p_process_stage_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.process_stages
    WHERE id = p_process_stage_id AND process_id = p_process_id
  ) THEN
    RAISE EXCEPTION 'A etapa informada não pertence ao processo';
  END IF;

  INSERT INTO public.documents (
    client_id, process_id, process_stage_id, file_name, file_url,
    storage_path, document_type, status, uploaded_by, visibility
  ) VALUES (
    v_client_id, p_process_id, p_process_stage_id, TRIM(p_file_name), TRIM(p_file_url),
    NULL, NULLIF(p_document_type, ''), 'received', v_profile_id, 'client_visible'
  ) RETURNING id INTO v_document_id;

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, new_value, note, client_visible
  ) VALUES (
    p_process_id, v_profile_id, 'document_uploaded', TRIM(p_file_name),
    'Documento enviado pelo cliente', TRUE
  );

  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_client_process_document(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_client_process_document(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- =====================================================
-- 4. TRANSIÇÃO CENTRAL E ATÔMICA DO STATUS DO PROCESSO
-- =====================================================

CREATE OR REPLACE FUNCTION public.transition_process_status(
  p_process_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process public.processes%ROWTYPE;
  v_action TEXT;
  v_history_id UUID;
  v_client_profile_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();

  IF p_status NOT IN (
    'aberto', 'em_andamento', 'aguardando_documentos', 'em_analise',
    'aguardando_orgao', 'concluido', 'arquivado', 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Status de processo inválido';
  END IF;

  SELECT * INTO v_process
  FROM public.processes
  WHERE id = p_process_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  IF v_process.status = p_status THEN
    RETURN JSONB_BUILD_OBJECT(
      'process_id', v_process.id,
      'status', v_process.status,
      'completed_at', v_process.completed_at
    );
  END IF;

  IF p_status = 'concluido'
     AND EXISTS (SELECT 1 FROM public.process_stages WHERE process_id = p_process_id)
     AND EXISTS (
       SELECT 1 FROM public.process_stages
       WHERE process_id = p_process_id
         AND status NOT IN ('concluido', 'aprovado', 'reprovado', 'nao_aplicavel')
     ) THEN
    RAISE EXCEPTION 'Conclua ou dispense todas as etapas antes de concluir o processo';
  END IF;

  UPDATE public.processes
  SET status = p_status,
      completed_at = CASE
        WHEN p_status = 'concluido' THEN COALESCE(completed_at, NOW())
        ELSE NULL
      END
  WHERE id = p_process_id;

  v_action := CASE p_status
    WHEN 'concluido' THEN 'completed'
    WHEN 'arquivado' THEN 'archived'
    WHEN 'cancelado' THEN 'cancelled'
    ELSE 'status_changed'
  END;

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, old_value, new_value, note, client_visible
  ) VALUES (
    p_process_id, public.get_profile_id(), v_action,
    v_process.status, p_status, NULLIF(TRIM(p_note), ''), TRUE
  ) RETURNING id INTO v_history_id;

  SELECT c.profile_id INTO v_client_profile_id
  FROM public.clients c
  JOIN public.profiles pr ON pr.id = c.profile_id AND pr.is_active = TRUE
  WHERE c.id = v_process.client_id AND c.is_active = TRUE;

  IF v_client_profile_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, client_id, process_id, title, message, type,
      source_key, available_at, is_canceled, is_read
    ) VALUES (
      v_client_profile_id, v_process.client_id, p_process_id,
      'Situação do processo atualizada',
      FORMAT('A situação do seu processo foi atualizada para %s.', REPLACE(p_status, '_', ' ')),
      CASE WHEN p_status = 'concluido' THEN 'success' ELSE 'status' END,
      FORMAT('process:status:%s', v_history_id), NOW(), FALSE, FALSE
    );
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'process_id', p_process_id,
    'status', p_status,
    'completed_at', CASE WHEN p_status = 'concluido' THEN NOW() ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_process_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_process_status(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
