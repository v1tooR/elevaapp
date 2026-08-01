-- =====================================================
-- ELEVA ISENCOES - Contratos, parcelas, custos e comissoes
-- =====================================================

CREATE TABLE IF NOT EXISTS public.financial_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_engagement_id UUID REFERENCES public.client_service_engagements(id) ON DELETE SET NULL,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (
    discount_amount >= 0 AND discount_amount <= total_amount
  ),
  net_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - discount_amount) STORED,
  payment_method TEXT CHECK (payment_method IN (
    'pix', 'cartao', 'boleto', 'dinheiro', 'transferencia'
  )),
  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  contracted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.financial_contracts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (
    paid_amount >= 0 AND paid_amount <= amount
  ),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  last_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, installment_number)
);

CREATE TABLE IF NOT EXISTS public.financial_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installment_id UUID NOT NULL REFERENCES public.financial_installments(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT CHECK (payment_method IN (
    'pix', 'cartao', 'boleto', 'dinheiro', 'transferencia'
  )),
  note TEXT,
  finance_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_contract_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.financial_contracts(id) ON DELETE CASCADE,
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  finance_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.financial_contracts(id) ON DELETE CASCADE,
  referral_partner_id UUID REFERENCES public.referral_partners(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  beneficiary_name TEXT,
  percentage NUMERIC(7,4) CHECK (percentage IS NULL OR percentage BETWEEN 0 AND 100),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'dispensado')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  finance_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    referral_partner_id IS NOT NULL
    OR profile_id IS NOT NULL
    OR NULLIF(TRIM(COALESCE(beneficiary_name, '')), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_financial_contracts_client
  ON public.financial_contracts(client_id, status, contracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_installments_due
  ON public.financial_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_financial_receipts_installment
  ON public.financial_receipts(installment_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_financial_costs_contract
  ON public.financial_contract_costs(contract_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_financial_commissions_contract
  ON public.financial_commissions(contract_id, status, due_date);

ALTER TABLE public.financial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_contract_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view finance entries" ON public.finance_entries;
DROP POLICY IF EXISTS "Staff can manage finance entries" ON public.finance_entries;
DROP POLICY IF EXISTS "Finance admins manage finance entries" ON public.finance_entries;
CREATE POLICY "Finance admins manage finance entries" ON public.finance_entries FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "Staff can view all financials" ON public.process_financials;
DROP POLICY IF EXISTS "Staff can manage financials" ON public.process_financials;
DROP POLICY IF EXISTS "Finance admins manage process financials" ON public.process_financials;
CREATE POLICY "Finance admins manage process financials" ON public.process_financials FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "Finance admins manage contracts" ON public.financial_contracts;
CREATE POLICY "Finance admins manage contracts" ON public.financial_contracts FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));
DROP POLICY IF EXISTS "Finance admins manage installments" ON public.financial_installments;
CREATE POLICY "Finance admins manage installments" ON public.financial_installments FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));
DROP POLICY IF EXISTS "Finance admins manage receipts" ON public.financial_receipts;
DROP POLICY IF EXISTS "Finance admins view receipts" ON public.financial_receipts;
CREATE POLICY "Finance admins view receipts" ON public.financial_receipts FOR SELECT
  USING (public.get_user_role() IN ('super_admin', 'admin'));
DROP POLICY IF EXISTS "Finance admins manage costs" ON public.financial_contract_costs;
CREATE POLICY "Finance admins manage costs" ON public.financial_contract_costs FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));
DROP POLICY IF EXISTS "Finance admins manage commissions" ON public.financial_commissions;
CREATE POLICY "Finance admins manage commissions" ON public.financial_commissions FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin'));

DROP TRIGGER IF EXISTS update_financial_contracts_updated_at ON public.financial_contracts;
CREATE TRIGGER update_financial_contracts_updated_at
  BEFORE UPDATE ON public.financial_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_financial_installments_updated_at ON public.financial_installments;
CREATE TRIGGER update_financial_installments_updated_at
  BEFORE UPDATE ON public.financial_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_financial_commissions_updated_at ON public.financial_commissions;
CREATE TRIGGER update_financial_commissions_updated_at
  BEFORE UPDATE ON public.financial_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_financial_contract(
  p_client_id UUID,
  p_service_engagement_id UUID,
  p_process_id UUID,
  p_total_amount NUMERIC,
  p_discount_amount NUMERIC,
  p_contracted_at DATE,
  p_payment_method TEXT,
  p_notes TEXT,
  p_installments JSONB,
  p_commissions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id UUID;
  v_profile_id UUID;
  v_installment_total NUMERIC;
BEGIN
  IF public.get_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Sem permissao para gerir contratos financeiros';
  END IF;
  v_profile_id := public.get_profile_id();

  IF p_total_amount <= 0
     OR COALESCE(p_discount_amount, 0) < 0
     OR COALESCE(p_discount_amount, 0) > p_total_amount THEN
    RAISE EXCEPTION 'Valores do contrato invalidos';
  END IF;
  IF p_process_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.processes process
    WHERE process.id = p_process_id AND process.client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'O processo deve pertencer ao cliente do contrato';
  END IF;
  IF p_service_engagement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.client_service_engagements engagement
    WHERE engagement.id = p_service_engagement_id AND engagement.client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'O plano de servicos deve pertencer ao cliente do contrato';
  END IF;
  IF JSONB_TYPEOF(COALESCE(p_installments, '[]'::JSONB)) <> 'array'
     OR JSONB_ARRAY_LENGTH(COALESCE(p_installments, '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma parcela';
  END IF;

  SELECT COALESCE(SUM(item.amount), 0)
  INTO v_installment_total
  FROM JSONB_TO_RECORDSET(p_installments) item(
    installment_number INTEGER, due_date DATE, amount NUMERIC
  );

  IF ABS(v_installment_total - (p_total_amount - COALESCE(p_discount_amount, 0))) > 0.01 THEN
    RAISE EXCEPTION 'A soma das parcelas deve ser igual ao valor liquido do contrato';
  END IF;

  INSERT INTO public.financial_contracts (
    client_id, service_engagement_id, process_id, total_amount,
    discount_amount, contracted_at, payment_method, notes, created_by
  ) VALUES (
    p_client_id, p_service_engagement_id, p_process_id, p_total_amount,
    COALESCE(p_discount_amount, 0), COALESCE(p_contracted_at, CURRENT_DATE),
    p_payment_method, NULLIF(TRIM(p_notes), ''), v_profile_id
  ) RETURNING id INTO v_contract_id;

  INSERT INTO public.financial_installments (
    contract_id, installment_number, due_date, amount
  )
  SELECT v_contract_id, item.installment_number, item.due_date, item.amount
  FROM JSONB_TO_RECORDSET(p_installments) item(
    installment_number INTEGER, due_date DATE, amount NUMERIC
  );

  IF JSONB_TYPEOF(COALESCE(p_commissions, '[]'::JSONB)) = 'array' THEN
    INSERT INTO public.financial_commissions (
      contract_id, referral_partner_id, profile_id, beneficiary_name,
      percentage, amount, due_date, created_by
    )
    SELECT
      v_contract_id, item.referral_partner_id, item.profile_id,
      NULLIF(TRIM(item.beneficiary_name), ''), item.percentage,
      item.amount, item.due_date, v_profile_id
    FROM JSONB_TO_RECORDSET(COALESCE(p_commissions, '[]'::JSONB)) item(
      referral_partner_id UUID, profile_id UUID, beneficiary_name TEXT,
      percentage NUMERIC, amount NUMERIC, due_date DATE
    )
    WHERE item.amount >= 0;
  END IF;

  RETURN v_contract_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_financial_receipt(
  p_installment_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ,
  p_payment_method TEXT,
  p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_installment RECORD;
  v_profile_id UUID;
  v_entry_id UUID;
  v_receipt_id UUID;
  v_new_paid NUMERIC;
BEGIN
  IF public.get_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Sem permissao para registrar recebimentos';
  END IF;
  v_profile_id := public.get_profile_id();

  SELECT installment.*, contract.client_id, contract.process_id
  INTO v_installment
  FROM public.financial_installments installment
  JOIN public.financial_contracts contract ON contract.id = installment.contract_id
  WHERE installment.id = p_installment_id
  FOR UPDATE OF installment;

  IF NOT FOUND OR v_installment.status = 'cancelado' THEN
    RAISE EXCEPTION 'Parcela nao encontrada ou cancelada';
  END IF;
  IF p_amount <= 0 OR p_amount > (v_installment.amount - v_installment.paid_amount) THEN
    RAISE EXCEPTION 'O recebimento excede o saldo da parcela';
  END IF;

  INSERT INTO public.finance_entries (
    type, title, amount, occurred_at, process_id, client_id,
    status, recurrence, created_by
  ) VALUES (
    'INCOME', FORMAT('Recebimento parcela %s', v_installment.installment_number),
    p_amount, COALESCE(p_paid_at, NOW())::DATE, v_installment.process_id,
    v_installment.client_id, 'CONFIRMED', 'NONE', v_profile_id
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.financial_receipts (
    installment_id, amount, paid_at, payment_method, note,
    finance_entry_id, created_by
  ) VALUES (
    p_installment_id, p_amount, COALESCE(p_paid_at, NOW()), p_payment_method,
    NULLIF(TRIM(p_note), ''), v_entry_id, v_profile_id
  ) RETURNING id INTO v_receipt_id;

  v_new_paid := v_installment.paid_amount + p_amount;
  UPDATE public.financial_installments
  SET paid_amount = v_new_paid,
      status = CASE WHEN v_new_paid >= amount THEN 'pago' ELSE 'parcial' END,
      last_paid_at = COALESCE(p_paid_at, NOW())
  WHERE id = p_installment_id;

  UPDATE public.financial_contracts contract
  SET status = CASE WHEN NOT EXISTS (
    SELECT 1 FROM public.financial_installments installment
    WHERE installment.contract_id = contract.id
      AND installment.status NOT IN ('pago', 'cancelado')
  ) THEN 'concluido' ELSE 'ativo' END
  WHERE contract.id = v_installment.contract_id
    AND contract.status <> 'cancelado';

  RETURN v_receipt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_financial_contract_cost(
  p_contract_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_occurred_at DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract RECORD;
  v_profile_id UUID;
  v_entry_id UUID;
  v_cost_id UUID;
BEGIN
  IF public.get_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Sem permissao para registrar custos';
  END IF;
  IF p_amount <= 0 OR NULLIF(TRIM(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Descricao e valor positivo sao obrigatorios';
  END IF;
  v_profile_id := public.get_profile_id();

  SELECT id, client_id, process_id INTO v_contract
  FROM public.financial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado'; END IF;

  INSERT INTO public.finance_entries (
    type, title, amount, occurred_at, process_id, client_id,
    status, recurrence, created_by
  ) VALUES (
    'EXPENSE', TRIM(p_description), p_amount, COALESCE(p_occurred_at, CURRENT_DATE),
    v_contract.process_id, v_contract.client_id, 'CONFIRMED', 'NONE', v_profile_id
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.financial_contract_costs (
    contract_id, process_id, description, amount, occurred_at,
    finance_entry_id, created_by
  ) VALUES (
    p_contract_id, v_contract.process_id, TRIM(p_description), p_amount,
    COALESCE(p_occurred_at, CURRENT_DATE), v_entry_id, v_profile_id
  ) RETURNING id INTO v_cost_id;

  RETURN v_cost_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_financial_contract(
  UUID, UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_financial_contract(
  UUID, UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, JSONB, JSONB
) TO authenticated;
REVOKE ALL ON FUNCTION public.record_financial_receipt(UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_financial_receipt(UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_financial_contract_cost(UUID, TEXT, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_financial_contract_cost(UUID, TEXT, NUMERIC, DATE) TO authenticated;

-- Preserva os valores ja cadastrados por processo em um contrato de parcela unica.
INSERT INTO public.financial_contracts (
  client_id, process_id, service_engagement_id, total_amount, contracted_at,
  payment_method, status, notes, created_at
)
SELECT
  process.client_id, process.id, process.service_engagement_id,
  financial.service_value, COALESCE(process.started_at::DATE, process.created_at::DATE),
  financial.payment_method,
  CASE WHEN financial.payment_status = 'paid' THEN 'concluido' ELSE 'ativo' END,
  financial.financial_notes, financial.created_at
FROM public.process_financials financial
JOIN public.processes process ON process.id = financial.process_id
WHERE financial.service_value > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_contracts contract WHERE contract.process_id = process.id
  );

INSERT INTO public.financial_installments (
  contract_id, installment_number, due_date, amount, paid_amount,
  status, last_paid_at, created_at
)
SELECT
  contract.id, 1,
  COALESCE(financial.expected_payment_date, contract.contracted_at),
  contract.net_amount,
  CASE WHEN financial.payment_status = 'paid' THEN contract.net_amount ELSE 0 END,
  CASE
    WHEN financial.payment_status = 'paid' THEN 'pago'
    ELSE 'pendente'
  END,
  financial.paid_at,
  financial.created_at
FROM public.financial_contracts contract
JOIN public.process_financials financial ON financial.process_id = contract.process_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_installments installment
  WHERE installment.contract_id = contract.id
);

COMMENT ON TABLE public.financial_contracts IS
  'Contrato financeiro vinculado ao cliente, plano de servicos ou processo.';
COMMENT ON TABLE public.financial_receipts IS
  'Recebimentos imutaveis, inclusive pagamentos parciais de uma parcela.';
