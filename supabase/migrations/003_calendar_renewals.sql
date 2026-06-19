-- =====================================================
-- ELEVA ISENÇÕES - Calendário Real + Renovações
-- =====================================================

-- 1. Adicionar tipo de evento e cor ao calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (event_type IN ('normal', 'renewal', 'deadline', 'reminder')),
  ADD COLUMN IF NOT EXISTS color TEXT;

-- 2. Adicionar dados de renovação aos tipos de processo
ALTER TABLE public.process_types
  ADD COLUMN IF NOT EXISTS renewal_period_months INTEGER,
  ADD COLUMN IF NOT EXISTS renewal_notes TEXT;

-- Períodos de renovação por tipo (legislação brasileira)
UPDATE public.process_types SET
  renewal_period_months = 24,
  renewal_notes = 'Lei 8.989/95 — isenção de IPI válida por 2 anos. Após esse prazo, o PCD pode solicitar nova isenção para um novo veículo.'
WHERE slug = 'processo_ipi';

UPDATE public.process_types SET
  renewal_period_months = 24,
  renewal_notes = 'Isenção de ICMS (Convênio ICMS 38/2012 e atualizações) — prazo médio de 2 anos dependendo do estado. Verificar legislação estadual específica.'
WHERE slug = 'processo_icms';

UPDATE public.process_types SET
  renewal_period_months = 12,
  renewal_notes = 'Isenção de IPVA — em geral renovada anualmente junto ao DETRAN do estado. O contribuinte deve apresentar laudo médico atualizado a cada ano.'
WHERE slug = 'processo_ipva';

UPDATE public.process_types SET
  renewal_period_months = 60,
  renewal_notes = 'CNH Especial — validade padrão de 5 anos (menores de 50 anos) conforme CTB. Para condutores acima de 50 anos, validade pode ser reduzida pelo médico perito.'
WHERE slug = 'cnh_especial';

UPDATE public.process_types SET
  renewal_period_months = 24,
  renewal_notes = 'Laudo médico para PCD — em geral tem validade de 2 anos. Deve ser emitido por médico especialista e aprovado pelo DETRAN/órgão competente.'
WHERE slug = 'laudo';

UPDATE public.process_types SET
  renewal_period_months = 24,
  renewal_notes = 'Credencial de estacionamento PCD — validade típica de 2 anos conforme legislação municipal. Verificar prazo específico do município do cliente.'
WHERE slug = 'estacionamento';

UPDATE public.process_types SET
  renewal_period_months = 12,
  renewal_notes = 'Licenciamento anual do veículo — o emplacamento PCD não se renova, mas o licenciamento DETRAN deve ser pago/renovado todo ano.'
WHERE slug = 'emplacamento';

UPDATE public.process_types SET
  renewal_period_months = 120,
  renewal_notes = 'CIN — Carteira de Identidade Nacional tem validade de 10 anos (adultos até 60 anos), 5 anos acima de 60 anos, 10 anos para menores. Portaria SDS 2023.'
WHERE slug = 'cin';

UPDATE public.process_types SET
  renewal_period_months = 12,
  renewal_notes = 'Isenção de rodízio PCD — em São Paulo e outras cidades é renovada anualmente. Verificar legislação da cidade do cliente.'
WHERE slug = 'rodizio';

UPDATE public.process_types SET
  renewal_period_months = 12,
  renewal_notes = 'Declaração de Imposto de Renda — obrigação anual (ano-calendário anterior). Prazo usual: março a maio de cada ano.'
WHERE slug = 'imposto_de_renda';

-- Resumo Geral não tem renovação periódica

-- 3. Adicionar data de renovação e referência ao evento nos processos
ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS renewal_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL;
