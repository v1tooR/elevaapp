-- E-mail do cliente passa a ser único (mesma abordagem já usada para o CPF na 016).
--
-- ATENÇÃO: se já existirem clientes com o mesmo e-mail, esta migration falha de
-- propósito e lista os duplicados, para que nenhum dado seja apagado sem revisão.
-- Para inspecionar antes de rodar:
--
--   SELECT LOWER(TRIM(email)) AS email, COUNT(*), STRING_AGG(name, ' | ' ORDER BY created_at)
--   FROM public.clients
--   WHERE NULLIF(TRIM(email), '') IS NOT NULL
--   GROUP BY 1 HAVING COUNT(*) > 1;
--
-- Resolva os duplicados (corrija ou limpe o e-mail do cadastro repetido) e rode de novo.

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email_normalized TEXT;

CREATE OR REPLACE FUNCTION public.normalize_client_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.email := NULLIF(TRIM(NEW.email), '');
  NEW.email_normalized := LOWER(NEW.email);
  RETURN NEW;
END;
$$;

UPDATE public.clients
SET email_normalized = LOWER(NULLIF(TRIM(email), ''))
WHERE email_normalized IS DISTINCT FROM LOWER(NULLIF(TRIM(email), ''));

DROP TRIGGER IF EXISTS normalize_client_email ON public.clients;
CREATE TRIGGER normalize_client_email
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.normalize_client_email();

DO $$
DECLARE
  v_duplicates TEXT;
BEGIN
  SELECT STRING_AGG(entry, E'\n' ORDER BY entry)
  INTO v_duplicates
  FROM (
    SELECT FORMAT(
      '  %s -> %s cadastros: %s',
      email_normalized,
      COUNT(*),
      STRING_AGG(name, ' | ' ORDER BY created_at)
    ) AS entry
    FROM public.clients
    WHERE email_normalized IS NOT NULL
    GROUP BY email_normalized
    HAVING COUNT(*) > 1
  ) AS duplicated;

  IF v_duplicates IS NOT NULL THEN
    RAISE EXCEPTION E'Não é possível aplicar a restrição de e-mail único: existem clientes com o mesmo e-mail.\n%\nCorrija ou limpe o e-mail dos cadastros repetidos e rode esta migration novamente.', v_duplicates;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_email_normalized
  ON public.clients(email_normalized)
  WHERE email_normalized IS NOT NULL;

COMMIT;
