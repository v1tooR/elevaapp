-- =====================================================
-- ELEVA ISENÇÕES - Funil comercial de leads
-- =====================================================
-- Todo registro legado em "em_atendimento" inicia em "frio". A equipe pode
-- reclassificar os casos com intenção clara como "quente" pelo Kanban.

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

UPDATE public.leads
SET status = 'frio'
WHERE status = 'em_atendimento';

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('novo', 'frio', 'quente', 'convertido', 'perdido'));

COMMENT ON COLUMN public.leads.status IS
  'Funil comercial: novo, frio, quente, convertido ou perdido.';

-- Mantém a transferência operacional dos três status ainda abertos quando um
-- funcionário é desligado.
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
    AND status IN ('novo', 'frio', 'quente');
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
