-- =====================================================
-- ELEVA - IPVA sem veículo antecipado e leitura operacional
-- =====================================================

-- Documentos iniciais deixam de ser uma etapa operacional separada. Os dados
-- e anexos continuam preservados no histórico do processo.
UPDATE public.process_stages stage
SET label = CASE stage.stage_key
      WHEN 'ipva_documentos' THEN 'Documentos legados do IPVA'
      WHEN 'sivei_protocolo' THEN 'Protocolo do IPVA'
      WHEN 'sefaz_decisao' THEN 'Análise da SEFAZ'
      WHEN 'ipva_recurso' THEN 'Recurso'
      WHEN 'ipva_conclusao' THEN 'Conclusão do IPVA'
      ELSE stage.label
    END,
    sort_order = CASE stage.stage_key
      WHEN 'ipva_documentos' THEN 5
      WHEN 'sivei_protocolo' THEN 10
      WHEN 'sefaz_decisao' THEN 20
      WHEN 'ipva_recurso' THEN 30
      WHEN 'ipva_conclusao' THEN 40
      ELSE stage.sort_order
    END,
    status = CASE
      WHEN stage.stage_key = 'ipva_documentos' THEN 'nao_aplicavel'
      ELSE stage.status
    END,
    notes = CASE
      WHEN stage.stage_key = 'ipva_documentos'
        AND POSITION('[Fluxo simplificado]' IN COALESCE(stage.notes, '')) = 0
      THEN CONCAT_WS(E'\n', NULLIF(stage.notes, ''), '[Fluxo simplificado] Conteúdo preservado somente como histórico; protocolo, SEFAZ, recurso e conclusão formam a operação atual.')
      ELSE stage.notes
    END
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'processo_ipva'
  AND stage.stage_key IN (
    'ipva_documentos', 'sivei_protocolo', 'sefaz_decisao',
    'ipva_recurso', 'ipva_conclusao'
  );

-- A função legada de sincronização ainda pode ser chamada por processos
-- existentes. Este normalizador impede que ela restaure nomes e ordens antigos.
CREATE OR REPLACE FUNCTION public.normalize_ipva_stage_presentation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stage_key NOT IN (
    'ipva_documentos', 'sivei_protocolo', 'sefaz_decisao',
    'ipva_recurso', 'ipva_conclusao'
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.processes process
    JOIN public.process_types type ON type.id = process.process_type_id
    WHERE process.id = NEW.process_id
      AND type.slug = 'processo_ipva'
  ) THEN
    RETURN NEW;
  END IF;

  CASE NEW.stage_key
    WHEN 'ipva_documentos' THEN
      NEW.label := 'Documentos legados do IPVA';
      NEW.sort_order := 5;
      NEW.status := 'nao_aplicavel';
      IF POSITION('[Fluxo simplificado]' IN COALESCE(NEW.notes, '')) = 0 THEN
        NEW.notes := CONCAT_WS(E'\n', NULLIF(NEW.notes, ''), '[Fluxo simplificado] Conteúdo preservado somente como histórico; protocolo, SEFAZ, recurso e conclusão formam a operação atual.');
      END IF;
    WHEN 'sivei_protocolo' THEN
      NEW.label := 'Protocolo do IPVA';
      NEW.sort_order := 10;
    WHEN 'sefaz_decisao' THEN
      NEW.label := 'Análise da SEFAZ';
      NEW.sort_order := 20;
    WHEN 'ipva_recurso' THEN
      NEW.label := 'Recurso';
      NEW.sort_order := 30;
    WHEN 'ipva_conclusao' THEN
      NEW.label := 'Conclusão do IPVA';
      NEW.sort_order := 40;
    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_ipva_stage_presentation
  ON public.process_stages;
CREATE TRIGGER normalize_ipva_stage_presentation
  BEFORE INSERT OR UPDATE OF stage_key, label, sort_order, status, notes
  ON public.process_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_ipva_stage_presentation();

COMMENT ON FUNCTION public.normalize_ipva_stage_presentation() IS
  'Preserva o histórico do IPVA e mantém protocolo, SEFAZ, recurso e conclusão na apresentação operacional da planilha.';

