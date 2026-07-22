BEGIN;

-- =====================================================
-- 1. INTEGRIDADE DE CLIENTES E CONTROLE DE ACESSO
-- =====================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf_normalized TEXT;

CREATE OR REPLACE FUNCTION public.normalize_client_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.cpf_normalized := NULLIF(REGEXP_REPLACE(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g'), '');
  RETURN NEW;
END;
$$;

UPDATE public.clients
SET cpf_normalized = NULLIF(REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g'), '');

DROP TRIGGER IF EXISTS normalize_client_cpf ON public.clients;
CREATE TRIGGER normalize_client_cpf
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.normalize_client_cpf();

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_cpf_normalized
  ON public.clients(cpf_normalized)
  WHERE cpf_normalized IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offboarding_note TEXT;

-- Funcionários existentes entram no fluxo de MFA quando a nova aplicação for publicada.
UPDATE public.profiles
SET mfa_required = TRUE
WHERE role IN ('super_admin', 'admin', 'analista') AND is_active = TRUE;

-- =====================================================
-- 2. CONTEXTO OPERACIONAL DO PROCESSO
-- =====================================================

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS action_owner TEXT,
  ADD COLUMN IF NOT EXISTS action_due_date DATE,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_client_update_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processes_action_owner_check'
  ) THEN
    ALTER TABLE public.processes
      ADD CONSTRAINT processes_action_owner_check
      CHECK (action_owner IS NULL OR action_owner IN ('equipe', 'cliente', 'orgao', 'terceiro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_processes_operational_queue
  ON public.processes(status, responsible_user_id, action_due_date, updated_at DESC);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_review_queue
  ON public.documents(status, review_responsible_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.add_staff_process_document(
  p_process_id UUID,
  p_file_name TEXT,
  p_file_url TEXT,
  p_document_type TEXT,
  p_process_stage_id UUID,
  p_visibility TEXT,
  p_requested BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document_id UUID;
BEGIN
  v_document_id := public.add_staff_process_document(
    p_process_id, p_file_name, p_file_url, p_document_type,
    p_process_stage_id, p_visibility
  );

  IF COALESCE(p_requested, FALSE) THEN
    UPDATE public.documents
    SET requested_at = NOW(),
        requested_by = public.get_profile_id(),
        review_responsible_id = (
          SELECT responsible_user_id FROM public.processes WHERE id = p_process_id
        )
    WHERE id = v_document_id;
  END IF;

  RETURN v_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_staff_process_document(UUID, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_staff_process_document(UUID, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

ALTER TABLE public.process_history
  DROP CONSTRAINT IF EXISTS process_history_action_type_check;

ALTER TABLE public.process_history
  ADD CONSTRAINT process_history_action_type_check CHECK (action_type IN (
    'created', 'status_changed', 'protocol_added', 'document_uploaded',
    'document_approved', 'document_rejected', 'observation_added',
    'field_changed', 'completed', 'archived', 'cancelled', 'updated',
    'client_message'
  ));

-- =====================================================
-- 3. FILTROS SALVOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.saved_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('processes')),
  name TEXT NOT NULL CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 60),
  filters JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, scope, name)
);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved filters" ON public.saved_filters
  FOR ALL
  USING (profile_id = public.get_profile_id())
  WITH CHECK (profile_id = public.get_profile_id());

-- =====================================================
-- 4. AUDITORIA E DESLIGAMENTO SEGURO
-- =====================================================

CREATE TABLE IF NOT EXISTS public.employee_offboardings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  replacement_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT,
  transferred_processes INTEGER NOT NULL DEFAULT 0,
  transferred_events INTEGER NOT NULL DEFAULT 0,
  transferred_leads INTEGER NOT NULL DEFAULT 0,
  transferred_documents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_offboardings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view offboardings" ON public.employee_offboardings
  FOR SELECT USING (public.get_user_role() = 'super_admin');

CREATE OR REPLACE FUNCTION public.offboard_employee(
  p_employee_profile_id UUID,
  p_replacement_profile_id UUID,
  p_performed_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_employee public.profiles%ROWTYPE;
  v_processes INTEGER := 0;
  v_events INTEGER := 0;
  v_leads INTEGER := 0;
  v_documents INTEGER := 0;
BEGIN
  SELECT * INTO v_employee
  FROM public.profiles
  WHERE id = p_employee_profile_id
  FOR UPDATE;

  IF NOT FOUND OR v_employee.role NOT IN ('admin', 'analista') THEN
    RAISE EXCEPTION 'Funcionário inválido para desligamento';
  END IF;
  IF p_employee_profile_id = p_performed_by THEN
    RAISE EXCEPTION 'Não é permitido desligar a própria conta';
  END IF;
  IF p_replacement_profile_id = p_employee_profile_id THEN
    RAISE EXCEPTION 'O substituto deve ser outro funcionário';
  END IF;
  IF p_replacement_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_replacement_profile_id
      AND role IN ('super_admin', 'admin', 'analista')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Funcionário substituto inválido ou inativo';
  END IF;

  UPDATE public.processes
  SET responsible_user_id = p_replacement_profile_id
  WHERE responsible_user_id = p_employee_profile_id;
  GET DIAGNOSTICS v_processes = ROW_COUNT;

  UPDATE public.calendar_events
  SET responsible_user_id = p_replacement_profile_id
  WHERE responsible_user_id = p_employee_profile_id
    AND status IN ('pending', 'in_progress');
  GET DIAGNOSTICS v_events = ROW_COUNT;

  UPDATE public.leads
  SET assigned_to = p_replacement_profile_id
  WHERE assigned_to = p_employee_profile_id
    AND status IN ('novo', 'em_atendimento');
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  UPDATE public.documents
  SET review_responsible_id = p_replacement_profile_id
  WHERE review_responsible_id = p_employee_profile_id
    AND status IN ('pending', 'received', 'under_review', 'resend_required');
  GET DIAGNOSTICS v_documents = ROW_COUNT;

  UPDATE public.profiles
  SET is_active = FALSE,
      deactivated_at = NOW(),
      deactivated_by = p_performed_by,
      offboarding_note = NULLIF(TRIM(p_reason), '')
  WHERE id = p_employee_profile_id;

  -- Revoga imediatamente sessões e tokens de atualização sem apagar o usuário.
  DELETE FROM auth.refresh_tokens WHERE user_id = v_employee.auth_user_id::TEXT;
  DELETE FROM auth.sessions WHERE user_id = v_employee.auth_user_id;

  INSERT INTO public.employee_offboardings (
    employee_profile_id, replacement_profile_id, performed_by, reason,
    transferred_processes, transferred_events, transferred_leads, transferred_documents
  ) VALUES (
    p_employee_profile_id, p_replacement_profile_id, p_performed_by,
    NULLIF(TRIM(p_reason), ''), v_processes, v_events, v_leads, v_documents
  );

  RETURN JSONB_BUILD_OBJECT(
    'processes', v_processes,
    'events', v_events,
    'leads', v_leads,
    'documents', v_documents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.offboard_employee(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offboard_employee(UUID, UUID, UUID, TEXT) TO service_role;

-- =====================================================
-- 5. OBSERVAÇÃO INTERNA X MENSAGEM AO CLIENTE
-- =====================================================

CREATE OR REPLACE FUNCTION public.add_process_communication(
  p_process_id UUID,
  p_message TEXT,
  p_audience TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process public.processes%ROWTYPE;
  v_history_id UUID;
  v_client_profile_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();

  IF p_audience NOT IN ('internal', 'client') THEN
    RAISE EXCEPTION 'Destino da comunicação inválido';
  END IF;
  IF CHAR_LENGTH(TRIM(COALESCE(p_message, ''))) < 2 THEN
    RAISE EXCEPTION 'Escreva uma mensagem válida';
  END IF;

  SELECT * INTO v_process FROM public.processes WHERE id = p_process_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, note, client_visible
  ) VALUES (
    p_process_id,
    public.get_profile_id(),
    CASE WHEN p_audience = 'client' THEN 'client_message' ELSE 'observation_added' END,
    TRIM(p_message),
    p_audience = 'client'
  ) RETURNING id INTO v_history_id;

  IF p_audience = 'client' THEN
    UPDATE public.processes SET last_client_update_at = NOW() WHERE id = p_process_id;

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
        'Nova atualização no seu processo', TRIM(p_message), 'status',
        FORMAT('process:message:%s', v_history_id), NOW(), FALSE, FALSE
      );
    END IF;
  END IF;

  RETURN v_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_process_communication(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_process_communication(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_document_workflow(
  p_document_id UUID,
  p_status TEXT,
  p_visibility TEXT,
  p_review_responsible_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_action TEXT;
BEGIN
  PERFORM public.workflow_assert_staff();

  IF p_status NOT IN ('pending', 'received', 'under_review', 'approved', 'rejected', 'resend_required') THEN
    RAISE EXCEPTION 'Status de documento inválido';
  END IF;
  IF p_visibility NOT IN ('admin_only', 'client_visible') THEN
    RAISE EXCEPTION 'Visibilidade de documento inválida';
  END IF;
  IF p_review_responsible_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_review_responsible_id
      AND role IN ('super_admin', 'admin', 'analista')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Responsável pela revisão inválido';
  END IF;

  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;

  UPDATE public.documents
  SET status = p_status,
      visibility = p_visibility,
      review_responsible_id = p_review_responsible_id,
      reviewed_by = CASE WHEN p_status IN ('approved', 'rejected', 'resend_required') THEN public.get_profile_id() ELSE reviewed_by END,
      rejection_reason = CASE WHEN p_status IN ('rejected', 'resend_required') THEN NULLIF(TRIM(p_rejection_reason), '') ELSE NULL END
  WHERE id = p_document_id;

  IF v_document.process_id IS NOT NULL THEN
    v_action := CASE p_status
      WHEN 'approved' THEN 'document_approved'
      WHEN 'rejected' THEN 'document_rejected'
      WHEN 'resend_required' THEN 'document_rejected'
      ELSE 'updated'
    END;

    INSERT INTO public.process_history (
      process_id, changed_by, action_type, old_value, new_value, note, client_visible
    ) VALUES (
      v_document.process_id, public.get_profile_id(), v_action,
      v_document.status, p_status,
      CASE WHEN p_rejection_reason IS NOT NULL THEN FORMAT('Documento %s: %s', v_document.file_name, TRIM(p_rejection_reason)) ELSE FORMAT('Documento %s atualizado', v_document.file_name) END,
      p_visibility = 'client_visible'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_document_workflow(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_document_workflow(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- =====================================================
-- 6. CRIAÇÃO TRANSACIONAL DE PROCESSO
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_process_atomic(
  p_client_id UUID,
  p_process_type_id UUID,
  p_protocol TEXT,
  p_status TEXT,
  p_responsible_user_id UUID,
  p_observations TEXT,
  p_jurisdiction_state TEXT,
  p_vehicle_condition TEXT,
  p_eligibility_status TEXT,
  p_eligibility_analysis JSONB,
  p_custom_fields JSONB DEFAULT '[]'::JSONB,
  p_stages JSONB DEFAULT '[]'::JSONB,
  p_financial JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_process_id UUID;
  v_process_type_slug TEXT;
  v_process_type_name TEXT;
  v_profile_id UUID;
  v_service_value NUMERIC;
  v_payment_status TEXT;
  v_finance_status TEXT;
  v_finance_entry_id UUID;
  v_category_id UUID;
  v_category_name TEXT;
BEGIN
  PERFORM public.workflow_assert_staff();
  v_profile_id := public.get_profile_id();

  SELECT slug, name INTO v_process_type_slug, v_process_type_name
  FROM public.process_types
  WHERE id = p_process_type_id AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tipo de processo inválido ou inativo'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Cliente inválido ou inativo';
  END IF;
  IF p_responsible_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_responsible_user_id
      AND role IN ('super_admin', 'admin', 'analista')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Responsável inválido ou inativo';
  END IF;

  INSERT INTO public.processes (
    client_id, process_type_id, protocol, status, responsible_user_id,
    observations, jurisdiction_state, vehicle_condition,
    eligibility_status, eligibility_analysis
  ) VALUES (
    p_client_id, p_process_type_id, NULLIF(TRIM(p_protocol), ''), p_status,
    p_responsible_user_id, NULLIF(TRIM(p_observations), ''),
    NULLIF(UPPER(TRIM(p_jurisdiction_state)), ''), NULLIF(p_vehicle_condition, ''),
    NULLIF(p_eligibility_status, ''), p_eligibility_analysis
  ) RETURNING id INTO v_process_id;

  IF JSONB_TYPEOF(COALESCE(p_custom_fields, '[]'::JSONB)) <> 'array'
     OR JSONB_TYPEOF(COALESCE(p_stages, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'Campos e etapas devem ser listas';
  END IF;

  INSERT INTO public.process_custom_fields (
    process_id, field_name, field_label, field_type, field_value, sort_order, client_visible
  )
  SELECT v_process_id, row.field_name, row.field_label, row.field_type,
         row.field_value, COALESCE(row.sort_order, 0), COALESCE(row.client_visible, FALSE)
  FROM JSONB_TO_RECORDSET(COALESCE(p_custom_fields, '[]'::JSONB)) AS row(
    field_name TEXT, field_label TEXT, field_type TEXT, field_value TEXT,
    sort_order INTEGER, client_visible BOOLEAN
  );

  INSERT INTO public.process_stages (
    process_id, stage_key, label, sort_order, status, data
  )
  SELECT v_process_id, row.stage_key, row.label, row.sort_order,
         COALESCE(row.status, 'pendente'), COALESCE(row.data, '{}'::JSONB)
  FROM JSONB_TO_RECORDSET(COALESCE(p_stages, '[]'::JSONB)) AS row(
    stage_key TEXT, label TEXT, sort_order INTEGER, status TEXT, data JSONB
  );

  IF v_process_type_slug = 'processo_ipva' AND UPPER(COALESCE(p_jurisdiction_state, '')) = 'SP' THEN
    PERFORM public.sync_ipva_workflow(v_process_id);
  END IF;

  IF p_financial IS NOT NULL AND public.get_user_role() = 'super_admin' THEN
    v_service_value := NULLIF(p_financial->>'service_value', '')::NUMERIC;
    v_payment_status := COALESCE(NULLIF(p_financial->>'payment_status', ''), 'pending');
    v_finance_status := CASE v_payment_status
      WHEN 'paid' THEN 'CONFIRMED'
      WHEN 'overdue' THEN 'OVERDUE'
      WHEN 'canceled' THEN NULL
      ELSE 'PREDICTED'
    END;

    IF v_service_value IS NOT NULL AND v_service_value > 0 AND v_finance_status IS NOT NULL THEN
      v_category_name := CASE v_process_type_slug
        WHEN 'processo_ipi' THEN 'IPI'
        WHEN 'processo_icms' THEN 'ICMS'
        WHEN 'processo_ipva' THEN 'IPVA'
        WHEN 'cnh_especial' THEN 'CNH Especial'
        WHEN 'estacionamento' THEN 'Estacionamento'
        WHEN 'laudo' THEN 'Laudo Médico'
        WHEN 'emplacamento' THEN 'Emplacamento'
        WHEN 'imposto_de_renda' THEN 'Imposto de Renda'
        ELSE 'Honorários'
      END;
      SELECT id INTO v_category_id FROM public.finance_categories WHERE name = v_category_name LIMIT 1;

      INSERT INTO public.finance_entries (
        type, title, amount, occurred_at, category_id, process_id, client_id,
        status, recurrence, created_by
      ) VALUES (
        'INCOME', FORMAT('%s — Honorários', v_process_type_name), v_service_value,
        COALESCE(NULLIF(p_financial->>'expected_payment_date', '')::DATE, CURRENT_DATE),
        v_category_id, v_process_id, p_client_id, v_finance_status, 'NONE', v_profile_id
      ) RETURNING id INTO v_finance_entry_id;
    END IF;

    INSERT INTO public.process_financials (
      process_id, service_value, payment_method, payment_status,
      expected_payment_date, financial_notes, finance_entry_id
    ) VALUES (
      v_process_id, v_service_value, NULLIF(p_financial->>'payment_method', ''),
      v_payment_status, NULLIF(p_financial->>'expected_payment_date', '')::DATE,
      NULLIF(TRIM(p_financial->>'financial_notes'), ''), v_finance_entry_id
    );
  END IF;

  INSERT INTO public.process_history (
    process_id, changed_by, action_type, new_value, note, client_visible
  ) VALUES (
    v_process_id, v_profile_id, 'created', p_status, 'Processo criado', TRUE
  );

  RETURN v_process_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_process_atomic(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_process_atomic(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB) TO authenticated;

-- =====================================================
-- 7. CONVERSÃO TRANSACIONAL DE LEAD
-- =====================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id UUID;
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF v_lead.status = 'convertido' OR v_lead.converted_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lead já foi convertido';
  END IF;

  INSERT INTO public.clients (
    name, phone, client_type, disability_type, disability_types,
    has_cnh_especial, cnh_status, medical_assessment_status,
    requires_practical_exam, has_medical_report, is_active
  ) VALUES (
    v_lead.name, v_lead.phone,
    CASE WHEN v_lead.is_driver THEN 'condutor' ELSE 'nao_condutor' END,
    v_lead.disability_type,
    CASE WHEN v_lead.disability_type IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY[v_lead.disability_type] END,
    COALESCE(v_lead.has_cnh_especial, FALSE),
    COALESCE(v_lead.cnh_status, CASE WHEN v_lead.has_cnh_especial THEN 'com_restricoes' WHEN v_lead.is_driver THEN NULL ELSE 'nao_possui' END),
    COALESCE(v_lead.medical_assessment_status, 'nao_realizada'),
    v_lead.requires_practical_exam,
    COALESCE(v_lead.has_medical_report, FALSE),
    TRUE
  ) RETURNING id INTO v_client_id;

  UPDATE public.leads
  SET status = 'convertido', converted_client_id = v_client_id
  WHERE id = p_lead_id;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_client(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_client(UUID) TO authenticated;

-- =====================================================
-- 8. CONCLUSÃO DO PRIMEIRO ACESSO E MFA
-- =====================================================

CREATE OR REPLACE FUNCTION public.complete_password_setup()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET must_change_password = FALSE
  WHERE auth_user_id = auth.uid() AND is_active = TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_mfa_enrolled()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'A autenticação em duas etapas ainda não foi confirmada';
  END IF;

  UPDATE public.profiles
  SET mfa_enrolled_at = NOW()
  WHERE auth_user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'analista')
    AND is_active = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_password_setup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_mfa_enrolled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_password_setup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mfa_enrolled() TO authenticated;

COMMIT;
