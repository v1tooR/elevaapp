-- =====================================================
-- ELEVA ISENÇÕES - Metadados dos workflows operacionais
-- =====================================================
-- Remove recorrências genéricas que não representam a validade real do
-- benefício/documento. Os lembretes devem nascer da data efetivamente emitida.

UPDATE public.process_types
SET renewal_period_months = 36,
    renewal_notes = 'IPI PCD: nova aquisição, em regra, após 3 anos. Revalidar a legislação e as condições no SISEN antes de cada pedido.'
WHERE slug = 'processo_ipi';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'IOF PCD não é renovação periódica e o benefício para aquisição de veículo pode ser utilizado uma única vez, conforme as condições vigentes.'
WHERE slug = 'processo_iof';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'ICMS não possui renovação automática: cada aquisição exige nova análise conforme UF, convênio e regras vigentes.'
WHERE slug = 'processo_icms';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'Usar a validade efetivamente indicada na CIN, pois o prazo varia conforme a idade do titular e a emissão.'
WHERE slug = 'cin';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'Usar a validade indicada na credencial emitida; canal digital e órgão local podem adotar regras distintas.'
WHERE slug = 'estacionamento';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'Emplacamento é um serviço pontual, sem renovação própria. Licenciamento do veículo deve ser controlado separadamente.'
WHERE slug = 'emplacamento';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'Usar a validade ou necessidade de recadastramento informada na decisão do órgão municipal; não presumir renovação anual.'
WHERE slug = 'rodizio';

UPDATE public.process_types
SET description = 'Isenção de IR sobre aposentadoria, pensão, reforma ou reserva por moléstia grave',
    renewal_period_months = NULL,
    renewal_notes = 'Não é uma declaração anual genérica. Acompanhar a decisão da fonte pagadora e eventual prazo indicado no laudo ou ato concessório.'
WHERE slug = 'imposto_de_renda';

UPDATE public.process_types
SET renewal_period_months = NULL,
    renewal_notes = 'A validade depende da finalidade, do emissor e do conteúdo do laudo; registrar a data efetivamente indicada no documento.'
WHERE slug = 'laudo';

