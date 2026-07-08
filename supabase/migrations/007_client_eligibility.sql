-- =====================================================
-- ELEVA ISENÇÕES - Campos de Elegibilidade do Cliente
-- =====================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type         TEXT    CHECK (client_type IN ('condutor', 'nao_condutor')),
  ADD COLUMN IF NOT EXISTS disability_type     TEXT    CHECK (disability_type IN ('fisica', 'auditiva', 'visual', 'monocular', 'autismo', 'mental')),
  ADD COLUMN IF NOT EXISTS has_cnh_especial    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS receives_loas_bpc   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_medical_report  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_valid_until  DATE;
