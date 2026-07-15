-- =====================================================
-- ELEVA ISENÇÕES - Avaliação de elegibilidade por benefício
-- =====================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS disability_types TEXT[] NOT NULL DEFAULT '{}'
    CHECK (disability_types <@ ARRAY['fisica', 'auditiva', 'visual', 'monocular', 'autismo', 'mental']::TEXT[]),
  ADD COLUMN IF NOT EXISTS disability_severity TEXT
    CHECK (disability_severity IN ('leve', 'moderada', 'grave', 'gravissima', 'nao_informada')),
  ADD COLUMN IF NOT EXISTS disability_details TEXT,
  ADD COLUMN IF NOT EXISTS cnh_status TEXT
    CHECK (cnh_status IN ('nao_possui', 'comum', 'com_restricoes', 'em_regularizacao', 'inapto_temporario', 'inapto')),
  ADD COLUMN IF NOT EXISTS cnh_restrictions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medical_assessment_status TEXT
    CHECK (medical_assessment_status IN ('nao_realizada', 'agendada', 'apto', 'apto_com_restricoes', 'inapto_temporario', 'inapto')),
  ADD COLUMN IF NOT EXISTS requires_adapted_vehicle BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_practical_exam BOOLEAN,
  ADD COLUMN IF NOT EXISTS authorized_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_notes TEXT;

-- Compatibilidade com o campo binário anterior.
UPDATE public.clients
SET cnh_status = CASE
  WHEN has_cnh_especial IS TRUE THEN 'com_restricoes'
  WHEN client_type = 'nao_condutor' THEN 'nao_possui'
  ELSE cnh_status
END
WHERE cnh_status IS NULL;

UPDATE public.clients
SET disability_types = ARRAY[disability_type]
WHERE disability_type IS NOT NULL
  AND cardinality(disability_types) = 0;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cnh_status TEXT
    CHECK (cnh_status IN ('nao_possui', 'comum', 'com_restricoes', 'em_regularizacao', 'inapto_temporario', 'inapto')),
  ADD COLUMN IF NOT EXISTS medical_assessment_status TEXT
    CHECK (medical_assessment_status IN ('nao_realizada', 'agendada', 'apto', 'apto_com_restricoes', 'inapto_temporario', 'inapto')),
  ADD COLUMN IF NOT EXISTS requires_practical_exam BOOLEAN;

UPDATE public.leads
SET cnh_status = CASE
  WHEN has_cnh_especial IS TRUE THEN 'com_restricoes'
  WHEN is_driver IS FALSE THEN 'nao_possui'
  ELSE cnh_status
END
WHERE cnh_status IS NULL;

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS jurisdiction_state TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_condition TEXT
    CHECK (vehicle_condition IN ('zero_km', 'usado')),
  ADD COLUMN IF NOT EXISTS eligibility_status TEXT
    CHECK (eligibility_status IN ('pre_elegivel', 'pendente_informacoes', 'requer_validacao', 'provavelmente_nao_elegivel', 'elegibilidade_confirmada')),
  ADD COLUMN IF NOT EXISTS eligibility_analysis JSONB,
  ADD COLUMN IF NOT EXISTS eligibility_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eligibility_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processes_eligibility_status
  ON public.processes(eligibility_status);

UPDATE public.process_stages
SET stage_key = 'cnh_regularizada',
    label = 'CNH regularizada — revisar benefícios'
WHERE stage_key = 'liberado_isencoes';

INSERT INTO public.process_types (name, slug, description, color)
VALUES ('Processo IOF', 'processo_iof', 'Isenção de IOF para aquisição de veículo por PCD', '#0EA5E9')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.finance_categories (name, color)
SELECT 'IOF', '#0EA5E9'
WHERE NOT EXISTS (SELECT 1 FROM public.finance_categories WHERE name = 'IOF');
