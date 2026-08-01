-- =====================================================
-- ELEVA ISENCOES - Proxima acao do IMESC e consulta de renovacoes
-- =====================================================

ALTER TABLE public.imesc_followups
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS action_owner TEXT
    CHECK (action_owner IN ('equipe', 'cliente', 'orgao', 'terceiro')),
  ADD COLUMN IF NOT EXISTS action_due_date DATE,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

UPDATE public.imesc_followups
SET next_action = CASE operational_status
      WHEN 'nao_iniciado' THEN 'Preparar solicitacao do IMESC'
      WHEN 'solicitacao_em_preparo' THEN 'Concluir e protocolar a solicitacao'
      WHEN 'agendado' THEN 'Comparecer a pericia do IMESC'
      WHEN 'pericia_realizada' THEN 'Acompanhar a emissao do laudo'
      WHEN 'laudo_disponivel' THEN 'Revisar laudo e registrar classificacao'
      ELSE NULL
    END,
    action_owner = CASE operational_status
      WHEN 'agendado' THEN 'cliente'
      WHEN 'pericia_realizada' THEN 'orgao'
      WHEN 'encerrado' THEN NULL
      ELSE 'equipe'
    END,
    action_due_date = CASE
      WHEN operational_status = 'agendado' THEN scheduled_date
      ELSE action_due_date
    END
WHERE next_action IS NULL;

CREATE INDEX IF NOT EXISTS idx_imesc_followups_action
  ON public.imesc_followups(action_owner, action_due_date)
  WHERE operational_status <> 'encerrado';

CREATE INDEX IF NOT EXISTS idx_processes_renewal_lookup
  ON public.processes(renewal_date, client_id)
  WHERE renewal_date IS NOT NULL
    AND status <> 'cancelado';

CREATE INDEX IF NOT EXISTS idx_calendar_renewal_lookup
  ON public.calendar_events(event_date, status, client_id)
  WHERE event_type = 'renewal'
    AND status <> 'canceled';

COMMENT ON COLUMN public.imesc_followups.next_action IS
  'Acao operacional explicita exibida no card e na rotina da equipe.';
COMMENT ON COLUMN public.imesc_followups.action_owner IS
  'Ator que precisa agir: equipe, cliente, orgao ou terceiro.';
