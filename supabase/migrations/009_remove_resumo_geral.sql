-- Remove o módulo legado "Resumo Geral" das opções operacionais.
-- O registro é preservado para manter íntegros processos históricos vinculados.

UPDATE public.process_types
SET is_active = false
WHERE slug = 'resumo';
