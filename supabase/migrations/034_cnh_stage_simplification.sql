-- =====================================================
-- ELEVA - simplificação operacional da CNH Especial
-- =====================================================

-- A apresentação segue a planilha operacional. O recurso continua sendo
-- criado somente quando a perícia termina como reprovada.
UPDATE public.process_stages stage
SET label = CASE stage.stage_key
      WHEN 'checklist_documentos' THEN 'Checklist'
      WHEN 'agendamento_poupatempo' THEN 'Poupatempo'
      WHEN 'pericia_medica' THEN 'Perícia'
      WHEN 'recurso_junta_medica' THEN 'Recurso'
      WHEN 'exame_pratico' THEN 'Exame Prático'
      WHEN 'emissao_cnh' THEN 'CNH finalizada'
      ELSE stage.label
    END,
    sort_order = CASE stage.stage_key
      WHEN 'checklist_documentos' THEN 10
      WHEN 'agendamento_poupatempo' THEN 20
      WHEN 'pericia_medica' THEN 30
      WHEN 'recurso_junta_medica' THEN 40
      WHEN 'exame_pratico' THEN 50
      WHEN 'emissao_cnh' THEN 60
      ELSE stage.sort_order
    END
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'cnh_especial'
  AND stage.stage_key IN (
    'checklist_documentos',
    'agendamento_poupatempo',
    'pericia_medica',
    'recurso_junta_medica',
    'exame_pratico',
    'emissao_cnh'
  );

-- A linha do tempo sempre apresenta as seis etapas da planilha. Enquanto não
-- houver reprovação, o recurso é apenas um marcador condicional não editável.
INSERT INTO public.process_stages (
  process_id,
  stage_key,
  label,
  sort_order,
  status,
  data
)
SELECT
  process.id,
  'recurso_junta_medica',
  'Recurso',
  40,
  CASE WHEN pericia.status = 'reprovado' THEN 'pendente' ELSE 'nao_aplicavel' END,
  JSONB_BUILD_OBJECT('conditional_on', 'pericia_reprovada')
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
LEFT JOIN public.process_stages pericia
  ON pericia.process_id = process.id
 AND pericia.stage_key = 'pericia_medica'
WHERE type.slug = 'cnh_especial'
  AND process.status NOT IN ('arquivado', 'cancelado')
  AND NOT EXISTS (
    SELECT 1
    FROM public.process_stages existing
    WHERE existing.process_id = process.id
      AND existing.stage_key = 'recurso_junta_medica'
  );

-- O texto livre da perícia passa a usar somente process_stages.notes. Dados do
-- editor antigo permanecem no JSON como histórico, mas deixam de ser operáveis.
UPDATE public.process_stages stage
SET notes = CONCAT_WS(
      E'\n',
      NULLIF(BTRIM(stage.notes), ''),
      CASE
        WHEN NULLIF(BTRIM(COALESCE(stage.data->>'observacoes', '')), '') IS NOT NULL
          THEN '[Histórico da perícia] ' || BTRIM(stage.data->>'observacoes')
        ELSE NULL
      END
    ),
    data = (
      COALESCE(stage.data, '{}'::JSONB)
        - 'observacoes'
        - 'medical_requirements'
        - 'medical_follow_up_status'
        - 'complementary_exam_name'
        - 'follow_up_date'
    )
    || CASE
      WHEN CASE
        WHEN JSONB_TYPEOF(stage.data->'medical_requirements') = 'array'
          THEN JSONB_ARRAY_LENGTH(stage.data->'medical_requirements')
        ELSE 0
      END > 0
        THEN JSONB_BUILD_OBJECT(
          'legacy_medical_requirements',
          COALESCE(stage.data->'legacy_medical_requirements', stage.data->'medical_requirements')
        )
      ELSE '{}'::JSONB
    END
    || CASE
      WHEN stage.data ?| ARRAY['medical_follow_up_status', 'complementary_exam_name', 'follow_up_date']
        THEN JSONB_BUILD_OBJECT(
          'legacy_medical_follow_up',
          JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(
            'status', stage.data->'medical_follow_up_status',
            'exam_name', stage.data->'complementary_exam_name',
            'follow_up_date', stage.data->'follow_up_date'
          ))
        )
      ELSE '{}'::JSONB
    END
    || CASE
      WHEN NULLIF(BTRIM(COALESCE(stage.data->>'observacoes', '')), '') IS NOT NULL
        THEN JSONB_BUILD_OBJECT('legacy_observacoes', stage.data->'observacoes')
      ELSE '{}'::JSONB
    END
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'cnh_especial'
  AND stage.stage_key IN ('pericia_medica', 'recurso_junta_medica');

-- Etapas de encerramento antigas não participam mais da linha do tempo, mas
-- continuam preservadas para auditoria.
UPDATE public.process_stages stage
SET status = 'nao_aplicavel',
    sort_order = CASE stage.stage_key
      WHEN 'liberado_isencoes' THEN 900
      ELSE 910
    END,
    notes = CONCAT_WS(
      E'\n',
      NULLIF(BTRIM(stage.notes), ''),
      '[Histórico] Etapa substituída por CNH finalizada.'
    )
FROM public.processes process
JOIN public.process_types type ON type.id = process.process_type_id
WHERE stage.process_id = process.id
  AND type.slug = 'cnh_especial'
  AND stage.stage_key IN ('liberado_isencoes', 'cnh_regularizada');

-- O save_process_stage legado insere o recurso com rótulo e ordem antigos.
-- Este gatilho normaliza toda inserção futura sem reescrever o histórico da RPC.
CREATE OR REPLACE FUNCTION public.normalize_cnh_stage_presentation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.label := CASE NEW.stage_key
    WHEN 'checklist_documentos' THEN 'Checklist'
    WHEN 'agendamento_poupatempo' THEN 'Poupatempo'
    WHEN 'pericia_medica' THEN 'Perícia'
    WHEN 'recurso_junta_medica' THEN 'Recurso'
    WHEN 'exame_pratico' THEN 'Exame Prático'
    WHEN 'emissao_cnh' THEN 'CNH finalizada'
    ELSE NEW.label
  END;

  NEW.sort_order := CASE NEW.stage_key
    WHEN 'checklist_documentos' THEN 10
    WHEN 'agendamento_poupatempo' THEN 20
    WHEN 'pericia_medica' THEN 30
    WHEN 'recurso_junta_medica' THEN 40
    WHEN 'exame_pratico' THEN 50
    WHEN 'emissao_cnh' THEN 60
    ELSE NEW.sort_order
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_cnh_stage_presentation ON public.process_stages;
CREATE TRIGGER normalize_cnh_stage_presentation
  BEFORE INSERT OR UPDATE
  ON public.process_stages
  FOR EACH ROW
  WHEN (NEW.stage_key IN (
    'checklist_documentos',
    'agendamento_poupatempo',
    'pericia_medica',
    'recurso_junta_medica',
    'exame_pratico',
    'emissao_cnh'
  ))
  EXECUTE FUNCTION public.normalize_cnh_stage_presentation();

COMMENT ON FUNCTION public.normalize_cnh_stage_presentation() IS
  'Mantém rótulos e ordem operacional da CNH Especial alinhados à planilha.';
