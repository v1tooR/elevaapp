-- =====================================================
-- ELEVA ISENÇÕES - Documentos via Link do Drive
-- =====================================================
-- Documentos não são mais uploads de arquivo.
-- São links do Google Drive com título e tipo.

-- Tornar storage_path opcional (não há path de storage para links Drive)
ALTER TABLE public.documents
  ALTER COLUMN storage_path DROP NOT NULL;

-- file_size e mime_type também são irrelevantes para Drive links
ALTER TABLE public.documents
  ALTER COLUMN file_size DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL;
