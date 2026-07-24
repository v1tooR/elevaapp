-- =====================================================
-- ELEVA ISENÇÕES - Bloqueio de processos ativos duplicados
-- =====================================================

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS duplicate_of_process_id UUID
    REFERENCES public.processes(id) ON DELETE RESTRICT;

ALTER TABLE public.processes
  DROP CONSTRAINT IF EXISTS processes_duplicate_not_self;

ALTER TABLE public.processes
  ADD CONSTRAINT processes_duplicate_not_self CHECK (
    duplicate_of_process_id IS NULL OR duplicate_of_process_id <> id
  );

CREATE INDEX IF NOT EXISTS idx_processes_duplicate_of
  ON public.processes(duplicate_of_process_id)
  WHERE duplicate_of_process_id IS NOT NULL;

-- Resolve automaticamente apenas duplicidades recentes sem documentos, agenda,
-- campos personalizados ou financeiro. O registro permanece para auditoria.
WITH ranked_active AS (
  SELECT
    p.id,
    p.client_id,
    p.process_type_id,
    p.created_at,
    FIRST_VALUE(p.id) OVER (
      PARTITION BY p.client_id, p.process_type_id
      ORDER BY p.created_at, p.id
    ) AS canonical_process_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.client_id, p.process_type_id
      ORDER BY p.created_at, p.id
    ) AS duplicate_rank
  FROM public.processes p
  WHERE p.duplicate_of_process_id IS NULL
    AND p.status NOT IN ('concluido', 'arquivado', 'cancelado')
),
safe_duplicates AS (
  SELECT ranked.id, ranked.canonical_process_id
  FROM ranked_active ranked
  WHERE ranked.duplicate_rank > 1
    AND NOT EXISTS (
      SELECT 1 FROM public.documents document
      WHERE document.process_id = ranked.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.calendar_events event
      WHERE event.process_id = ranked.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.process_custom_fields field
      WHERE field.process_id = ranked.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.process_financials financial
      WHERE financial.process_id = ranked.id
    )
)
UPDATE public.processes process
SET duplicate_of_process_id = duplicate.canonical_process_id,
    status = 'cancelado',
    completed_at = NULL,
    blocked_reason = 'Registro duplicado preservado para auditoria'
FROM safe_duplicates duplicate
WHERE process.id = duplicate.id;

UPDATE public.calendar_events event
SET status = 'canceled'
WHERE event.process_id IN (
  SELECT id FROM public.processes WHERE duplicate_of_process_id IS NOT NULL
)
  AND event.status <> 'canceled';

UPDATE public.notifications notification
SET is_canceled = TRUE
WHERE notification.process_id IN (
  SELECT id FROM public.processes WHERE duplicate_of_process_id IS NOT NULL
)
  AND notification.is_canceled IS DISTINCT FROM TRUE;

INSERT INTO public.process_history (
  process_id,
  action_type,
  old_value,
  new_value,
  note,
  client_visible
)
SELECT
  process.id,
  'cancelled',
  NULL,
  'cancelado',
  FORMAT(
    'Duplicidade identificada; processo oficial: %s',
    process.duplicate_of_process_id
  ),
  FALSE
FROM public.processes process
WHERE process.duplicate_of_process_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.process_history history
    WHERE history.process_id = process.id
      AND history.note LIKE 'Duplicidade identificada;%'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.processes process
    WHERE process.duplicate_of_process_id IS NULL
      AND process.status NOT IN ('concluido', 'arquivado', 'cancelado')
    GROUP BY process.client_id, process.process_type_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem processos ativos duplicados com dados operacionais; reconcilie-os antes de concluir a migração';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_processes_one_active_type_per_client
  ON public.processes(client_id, process_type_id)
  WHERE duplicate_of_process_id IS NULL
    AND status NOT IN ('concluido', 'arquivado', 'cancelado');

CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_process_id UUID;
BEGIN
  IF NEW.duplicate_of_process_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.processes canonical
      WHERE canonical.id = NEW.duplicate_of_process_id
        AND canonical.client_id = NEW.client_id
        AND canonical.process_type_id = NEW.process_type_id
    ) THEN
      RAISE EXCEPTION
        'O processo oficial da duplicidade deve pertencer ao mesmo cliente e tipo.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('concluido', 'arquivado', 'cancelado') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      NEW.client_id::TEXT || ':' || NEW.process_type_id::TEXT,
      0
    )
  );

  SELECT process.id
  INTO v_existing_process_id
  FROM public.processes process
  WHERE process.client_id = NEW.client_id
    AND process.process_type_id = NEW.process_type_id
    AND process.duplicate_of_process_id IS NULL
    AND process.status NOT IN ('concluido', 'arquivado', 'cancelado')
    AND process.id IS DISTINCT FROM NEW.id
  ORDER BY process.created_at
  LIMIT 1;

  IF v_existing_process_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um processo ativo deste tipo para este cliente.'
      USING
        ERRCODE = '23505',
        DETAIL = FORMAT('Processo existente: %s', v_existing_process_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_active_process
  ON public.processes;

CREATE TRIGGER prevent_duplicate_active_process
  BEFORE INSERT OR UPDATE OF client_id, process_type_id, status, duplicate_of_process_id
  ON public.processes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_active_process();
