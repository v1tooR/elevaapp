-- =====================================================
-- ELEVA ISENÇÕES - Acesso assistido a portais, sem credenciais
-- =====================================================

-- O Eleva registra somente a prontidão operacional do acesso. Senhas e
-- códigos de verificação permanecem sob controle do titular da conta.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gov_access_status TEXT NOT NULL DEFAULT 'nao_validado',
  ADD COLUMN IF NOT EXISTS gov_auth_by_client BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gov_account_level TEXT,
  ADD COLUMN IF NOT EXISTS gov_account_level_sufficient BOOLEAN,
  ADD COLUMN IF NOT EXISTS gov_access_last_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gov_access_pending_note TEXT,
  ADD COLUMN IF NOT EXISTS gov_access_validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_gov_access_status_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_gov_access_status_check
      CHECK (gov_access_status IN ('nao_validado', 'aguardando_cliente', 'validado', 'com_pendencia'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_gov_account_level_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_gov_account_level_check
      CHECK (gov_account_level IS NULL OR gov_account_level IN ('bronze', 'prata', 'ouro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_gov_validated_requires_client_auth'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_gov_validated_requires_client_auth
      CHECK (gov_access_status <> 'validado' OR gov_auth_by_client IS TRUE);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_gov_access_status
  ON public.clients(gov_access_status);

CREATE OR REPLACE FUNCTION public.audit_client_gov_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.gov_access_status = 'validado' THEN
    IF NEW.gov_auth_by_client IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso Gov.br só pode ser validado quando a autenticação foi realizada pelo cliente';
    END IF;

    NEW.gov_access_last_validated_at := COALESCE(NEW.gov_access_last_validated_at, NOW());

    IF TG_OP = 'INSERT' THEN
      NEW.gov_access_validated_by := public.get_profile_id();
    ELSIF OLD.gov_access_status IS DISTINCT FROM NEW.gov_access_status
       OR OLD.gov_access_last_validated_at IS DISTINCT FROM NEW.gov_access_last_validated_at THEN
      NEW.gov_access_validated_by := public.get_profile_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_client_gov_access ON public.clients;
CREATE TRIGGER audit_client_gov_access
  BEFORE INSERT OR UPDATE OF gov_access_status, gov_auth_by_client, gov_access_last_validated_at
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_client_gov_access();

-- Remove definitivamente o campo que podia receber uma senha ou "dica".
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS gov_password_reference;

-- Elimina credenciais legadas sem copiá-las para histórico, log ou backup da aplicação.
DELETE FROM public.process_custom_fields
WHERE LOWER(field_name) LIKE '%senha%'
   OR LOWER(field_name) LIKE '%password%';

-- Impede a recriação de campos de senha em processos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_custom_fields_no_password_fields'
  ) THEN
    ALTER TABLE public.process_custom_fields
      ADD CONSTRAINT process_custom_fields_no_password_fields
      CHECK (
        LOWER(field_name) NOT LIKE '%senha%'
        AND LOWER(field_name) NOT LIKE '%password%'
      );
  END IF;
END $$;

-- O checklist da CNH guarda apenas um booleano de validação, com nome inequívoco.
UPDATE public.process_stages
SET data = JSONB_SET(
  data - 'senha_gov',
  '{acesso_gov_validado}',
  COALESCE(data -> 'senha_gov', 'false'::JSONB),
  TRUE
)
WHERE data ? 'senha_gov';

COMMENT ON COLUMN public.clients.gov_access_status IS
  'Prontidão operacional do acesso Gov.br; nunca contém credenciais.';
COMMENT ON COLUMN public.clients.gov_auth_by_client IS
  'Confirma que o titular realizou a autenticação sem compartilhar a credencial com a equipe.';
COMMENT ON COLUMN public.clients.gov_access_pending_note IS
  'Pendência operacional. É proibido registrar senha ou código de verificação.';
