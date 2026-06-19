-- =====================================================
-- ELEVA ISENÇÕES - Vincular process_financials → finance_entries
-- =====================================================
-- Cada registro em process_financials agora aponta para
-- seu lançamento espelhado em finance_entries (receita).

ALTER TABLE public.process_financials
  ADD COLUMN IF NOT EXISTS finance_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL;
