-- =====================================================
-- ELEVA ISENÇÕES - Parceiros de indicação e triagem do cliente
-- =====================================================

CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  partner_types TEXT[] NOT NULL DEFAULT ARRAY['vendedor']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_partners_name_check CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT referral_partners_phone_check CHECK (LENGTH(TRIM(phone)) > 0),
  CONSTRAINT referral_partners_types_check CHECK (
    CARDINALITY(partner_types) > 0
    AND partner_types <@ ARRAY['vendedor', 'indicador']::TEXT[]
  )
);

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

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

DROP TRIGGER IF EXISTS update_referral_partners_updated_at
  ON public.referral_partners;
CREATE TRIGGER update_referral_partners_updated_at
  BEFORE UPDATE ON public.referral_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS referral_partner_id UUID
    REFERENCES public.referral_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_referral_partner_created_at
  ON public.leads(referral_partner_id, created_at DESC)
  WHERE referral_partner_id IS NOT NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cnh_expiry_date DATE;

CREATE OR REPLACE FUNCTION public.keep_cnh_decisions_in_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Colunas legadas são preservadas para histórico, mas novas decisões ficam
  -- exclusivamente nos dados das etapas do processo de CNH.
  NEW.requires_practical_exam := OLD.requires_practical_exam;
  NEW.requires_adapted_vehicle := OLD.requires_adapted_vehicle;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_cnh_decisions_in_process
  ON public.clients;
CREATE TRIGGER keep_cnh_decisions_in_process
  BEFORE UPDATE OF requires_practical_exam, requires_adapted_vehicle
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_cnh_decisions_in_process();

-- A conversão reaproveita todos os dados já coletados no lead. O RG e os
-- campos periciais históricos permanecem no banco, mas não integram a triagem.
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id UUID;
  v_disability_types TEXT[];
BEGIN
  PERFORM public.workflow_assert_staff();

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.converted_client_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'convertido'
    WHERE id = p_lead_id
      AND status IS DISTINCT FROM 'convertido';

    RETURN v_lead.converted_client_id;
  END IF;

  v_disability_types := CASE
    WHEN CARDINALITY(v_lead.disability_types) > 0
      THEN v_lead.disability_types
    WHEN v_lead.disability_type IS NOT NULL
      THEN ARRAY[v_lead.disability_type]
    ELSE ARRAY[]::TEXT[]
  END;

  INSERT INTO public.clients (
    name, phone, email, internal_notes,
    client_type, disability_type, disability_types,
    has_cnh_especial, cnh_status, cnh_restrictions,
    medical_assessment_status,
    receives_loas_bpc, has_medical_report,
    has_legal_representative, legal_representative_name,
    is_active
  ) VALUES (
    v_lead.name,
    v_lead.phone,
    v_lead.email,
    NULLIF(TRIM(v_lead.notes), ''),
    CASE
      WHEN v_lead.is_driver IS NULL THEN NULL
      WHEN v_lead.is_driver THEN 'condutor'
      ELSE 'nao_condutor'
    END,
    COALESCE(v_lead.disability_type, v_disability_types[1]),
    v_disability_types,
    COALESCE(v_lead.has_cnh_especial, FALSE),
    COALESCE(
      v_lead.cnh_status,
      CASE
        WHEN v_lead.has_cnh_especial THEN 'com_restricoes'
        WHEN v_lead.is_driver IS FALSE THEN 'nao_possui'
        ELSE NULL
      END
    ),
    COALESCE(v_lead.cnh_restrictions, ARRAY[]::TEXT[]),
    COALESCE(v_lead.medical_assessment_status, 'nao_realizada'),
    COALESCE(v_lead.receives_loas_bpc, FALSE),
    COALESCE(v_lead.has_medical_report, FALSE),
    COALESCE(v_lead.has_legal_representative, FALSE),
    v_lead.legal_representative_name,
    TRUE
  )
  RETURNING id INTO v_client_id;

  UPDATE public.leads
  SET status = 'convertido',
      converted_client_id = v_client_id
  WHERE id = p_lead_id;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_client(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_client(UUID) TO authenticated;

COMMENT ON TABLE public.referral_partners IS
  'Cadastro único de vendedores e indicadores, categorizado por tipo de atuação.';
COMMENT ON COLUMN public.leads.referral_partner_id IS
  'Parceiro responsável pela venda ou indicação, vinculado por identificador.';
COMMENT ON COLUMN public.clients.rg IS
  'Dado histórico preservado; não é solicitado nem exibido na triagem atual.';
COMMENT ON COLUMN public.clients.cnh_expiry_date IS
  'Vencimento informado diretamente da CNH do cliente.';
