-- =====================================================
-- ELEVA ISENÇÕES - Catálogo operacional e Laudo DETRAN no IPI
-- =====================================================

ALTER TABLE public.process_types
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS accepts_new_processes BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'process_types_sort_order_check'
  ) THEN
    ALTER TABLE public.process_types
      ADD CONSTRAINT process_types_sort_order_check
      CHECK (sort_order > 0);
  END IF;
END $$;

-- Garante os serviços já previstos no cadastro de leads mesmo em bases que
-- tenham recebido as migrações anteriores de forma parcial.
INSERT INTO public.process_types (name, slug, description, color, sort_order)
VALUES
  ('Renovação', 'renovacao', 'Renovação de documento ou benefício contratado', '#6366F1', 100),
  ('Aposentadoria', 'aposentadoria', 'Acompanhamento do processo de aposentadoria', '#8B5CF6', 120),
  ('Alvará', 'alvara', 'Acompanhamento de solicitação ou renovação de alvará', '#14B8A6', 130)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.process_types
SET sort_order = CASE slug
  WHEN 'cnh_especial' THEN 10
  WHEN 'processo_ipi' THEN 20
  WHEN 'processo_icms' THEN 30
  WHEN 'processo_ipva' THEN 40
  WHEN 'processo_iof' THEN 50
  WHEN 'estacionamento' THEN 60
  WHEN 'cin' THEN 70
  WHEN 'emplacamento' THEN 80
  WHEN 'rodizio' THEN 90
  WHEN 'renovacao' THEN 100
  WHEN 'imposto_de_renda' THEN 110
  WHEN 'aposentadoria' THEN 120
  WHEN 'alvara' THEN 130
  WHEN 'laudo' THEN 900
  WHEN 'resumo' THEN 1000
  ELSE sort_order
END;

UPDATE public.process_types
SET description = 'Isenção de IPVA para PCD, incluindo o fluxo IMESC quando aplicável'
WHERE slug = 'processo_ipva';

-- "Laudo" continua ativo para leitura dos atendimentos antigos, mas deixa de
-- aparecer como uma carteira ou opção de criação de novos processos.
UPDATE public.process_types
SET accepts_new_processes = FALSE
WHERE slug IN ('laudo', 'resumo');

CREATE INDEX IF NOT EXISTS idx_process_types_operational_order
  ON public.process_types(is_active, accepts_new_processes, sort_order);

CREATE OR REPLACE FUNCTION public.enforce_process_type_available_for_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.process_types process_type
    WHERE process_type.id = NEW.process_type_id
      AND process_type.is_active = TRUE
      AND process_type.accepts_new_processes = TRUE
  ) THEN
    RAISE EXCEPTION 'Este tipo de processo não está disponível para novos atendimentos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_process_type_available_for_new
  ON public.processes;
CREATE TRIGGER enforce_process_type_available_for_new
  BEFORE INSERT ON public.processes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_process_type_available_for_new();

-- Compatibilidade dos processos IPI já existentes com o novo controle.
UPDATE public.process_stages stage
SET label = 'Laudo DETRAN',
    data = COALESCE(stage.data, '{}'::JSONB)
      || JSONB_BUILD_OBJECT(
        'report_status',
        CASE
          WHEN COALESCE(stage.data->>'report_status', '') IN (
            'nao_solicitado', 'solicitado', 'em_andamento', 'pronto', 'nao_aplicavel'
          ) THEN stage.data->>'report_status'
          WHEN stage.status IN ('concluido', 'aprovado') THEN 'pronto'
          WHEN stage.status = 'nao_aplicavel' THEN 'nao_aplicavel'
          WHEN stage.status = 'em_andamento' THEN 'em_andamento'
          ELSE 'nao_solicitado'
        END
      )
      || CASE
        WHEN COALESCE(stage.data->>'issuing_authority', '') = ''
             AND COALESCE(stage.data->>'issuer', '') <> ''
        THEN JSONB_BUILD_OBJECT(
          'issuing_authority',
          CASE stage.data->>'issuer'
            WHEN 'detran' THEN 'DETRAN'
            WHEN 'sus_conveniado' THEN 'Serviço público ou conveniado ao SUS'
            WHEN 'outro_oficial' THEN 'Outro emissor oficial aceito'
            ELSE stage.data->>'issuer'
          END
        )
        ELSE '{}'::JSONB
      END
FROM public.processes process
JOIN public.process_types process_type
  ON process_type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND process_type.slug = 'processo_ipi'
  AND stage.stage_key = 'laudo_ipi';

UPDATE public.process_stages documents
SET data = CASE
  WHEN report.data->>'report_status' IN ('pronto', 'nao_aplicavel')
    THEN COALESCE(documents.data, '{}'::JSONB) - 'blocked_by'
  ELSE COALESCE(documents.data, '{}'::JSONB)
    || JSONB_BUILD_OBJECT('blocked_by', 'laudo_ipi')
END
FROM public.process_stages report
WHERE documents.process_id = report.process_id
  AND documents.stage_key = 'documentos_ipi'
  AND report.stage_key = 'laudo_ipi';

CREATE OR REPLACE FUNCTION public.sync_ipi_detran_report_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stage_key <> 'laudo_ipi' THEN
    RETURN NEW;
  END IF;

  UPDATE public.process_stages next_stage
  SET data = CASE
    WHEN NEW.data->>'report_status' IN ('pronto', 'nao_aplicavel')
      THEN COALESCE(next_stage.data, '{}'::JSONB) - 'blocked_by'
    ELSE COALESCE(next_stage.data, '{}'::JSONB)
      || JSONB_BUILD_OBJECT('blocked_by', 'laudo_ipi')
  END
  WHERE next_stage.process_id = NEW.process_id
    AND next_stage.stage_key = 'documentos_ipi';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_ipi_detran_report_dependency
  ON public.process_stages;
CREATE TRIGGER sync_ipi_detran_report_dependency
  AFTER INSERT OR UPDATE ON public.process_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ipi_detran_report_dependency();

CREATE INDEX IF NOT EXISTS idx_process_stages_ipi_report_status
  ON public.process_stages ((data->>'report_status'))
  WHERE stage_key = 'laudo_ipi';

COMMENT ON COLUMN public.process_types.sort_order IS
  'Ordem operacional compartilhada pelo hub, seletores e filtros.';
COMMENT ON COLUMN public.process_types.accepts_new_processes IS
  'Controla criação de novos processos sem ocultar atendimentos históricos.';
