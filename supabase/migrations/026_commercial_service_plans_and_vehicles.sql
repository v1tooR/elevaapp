-- =====================================================
-- ELEVA ISENÇÕES - Dono comercial, plano de serviços e veículos
-- =====================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS commercial_owner_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_commercial_owner
  ON public.clients(commercial_owner_id, is_active, name)
  WHERE commercial_owner_id IS NOT NULL;

-- O dono comercial vem do lead convertido, quando esse vínculo é confiável.
WITH owner_source AS (
  SELECT DISTINCT ON (lead.converted_client_id)
    lead.converted_client_id AS client_id,
    lead.assigned_to
  FROM public.leads lead
  JOIN public.profiles assigned ON assigned.id = lead.assigned_to
  WHERE lead.converted_client_id IS NOT NULL
    AND lead.assigned_to IS NOT NULL
    AND assigned.role IN ('super_admin', 'admin')
  ORDER BY lead.converted_client_id, lead.updated_at DESC, lead.id DESC
)
UPDATE public.clients client
SET commercial_owner_id = source.assigned_to
FROM owner_source source
WHERE client.id = source.client_id
  AND client.commercial_owner_id IS NULL;

CREATE TABLE IF NOT EXISTS public.client_service_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  origin_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  commercial_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- O indice precisa ser um alvo inferivel por ON CONFLICT (origin_lead_id).
-- UNIQUE continua aceitando varios NULLs no PostgreSQL, portanto o predicado
-- parcial nao e necessario e impediria a inferencia usada no backfill abaixo.
DROP INDEX IF EXISTS public.uq_service_engagement_origin_lead;
CREATE UNIQUE INDEX uq_service_engagement_origin_lead
  ON public.client_service_engagements(origin_lead_id);
CREATE INDEX IF NOT EXISTS idx_service_engagements_client
  ON public.client_service_engagements(client_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_service_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id UUID NOT NULL
    REFERENCES public.client_service_engagements(id) ON DELETE CASCADE,
  process_type_id UUID NOT NULL
    REFERENCES public.process_types(id) ON DELETE RESTRICT,
  service_key TEXT NOT NULL CHECK (service_key IN (
    'cnh_especial', 'ipi', 'icms', 'ipva',
    'credencial_estacionamento', 'cin', 'emplacamento',
    'renovacao', 'isencao_ir', 'aposentadoria', 'alvara'
  )),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  status TEXT NOT NULL DEFAULT 'planejado'
    CHECK (status IN (
      'planejado', 'pronto_para_iniciar', 'iniciado', 'concluido',
      'adiado', 'recusado', 'cancelado'
    )),
  process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
  prerequisite_item_id UUID
    REFERENCES public.client_service_plan_items(id) ON DELETE SET NULL,
  wait_reason TEXT,
  decision_reason TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ready_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_plan_item_not_own_prerequisite CHECK (
    prerequisite_item_id IS NULL OR prerequisite_item_id <> id
  ),
  CONSTRAINT service_plan_one_type_per_engagement UNIQUE (
    engagement_id, process_type_id
  ),
  CONSTRAINT service_plan_process_unique UNIQUE (process_id)
);

CREATE INDEX IF NOT EXISTS idx_service_plan_items_queue
  ON public.client_service_plan_items(engagement_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_plan_items_ready
  ON public.client_service_plan_items(status, ready_at)
  WHERE status IN ('planejado', 'pronto_para_iniciar', 'adiado');

CREATE TABLE IF NOT EXISTS public.client_service_plan_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_item_id UUID NOT NULL
    REFERENCES public.client_service_plan_items(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_plan_history_item
  ON public.client_service_plan_history(plan_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description TEXT,
  vehicle_condition TEXT NOT NULL
    CHECK (vehicle_condition IN ('zero_km', 'usado')),
  plate TEXT,
  plate_normalized TEXT GENERATED ALWAYS AS (
    NULLIF(UPPER(REGEXP_REPLACE(COALESCE(plate, ''), '[^A-Za-z0-9]', '', 'g')), '')
  ) STORED,
  renavam TEXT,
  renavam_normalized TEXT GENERATED ALWAYS AS (
    NULLIF(REGEXP_REPLACE(COALESCE(renavam, ''), '[^0-9]', '', 'g'), '')
  ) STORED,
  chassis TEXT,
  chassis_normalized TEXT GENERATED ALWAYS AS (
    NULLIF(UPPER(REGEXP_REPLACE(COALESCE(chassis, ''), '[^A-Za-z0-9]', '', 'g')), '')
  ) STORED,
  brand TEXT,
  model TEXT,
  model_year INTEGER CHECK (model_year IS NULL OR model_year BETWEEN 1900 AND 2200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_vehicle_has_description CHECK (
    NULLIF(TRIM(COALESCE(description, '')), '') IS NOT NULL
    OR plate_normalized IS NOT NULL
    OR renavam_normalized IS NOT NULL
    OR chassis_normalized IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_vehicle_plate
  ON public.client_vehicles(plate_normalized)
  WHERE plate_normalized IS NOT NULL AND is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_vehicle_renavam
  ON public.client_vehicles(renavam_normalized)
  WHERE renavam_normalized IS NOT NULL AND is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_vehicle_chassis
  ON public.client_vehicles(chassis_normalized)
  WHERE chassis_normalized IS NOT NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_client_vehicles_client
  ON public.client_vehicles(client_id, is_active, created_at DESC);

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS service_engagement_id UUID
    REFERENCES public.client_service_engagements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_plan_item_id UUID
    REFERENCES public.client_service_plan_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID
    REFERENCES public.client_vehicles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_process_service_plan_item
  ON public.processes(service_plan_item_id)
  WHERE service_plan_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processes_service_engagement
  ON public.processes(service_engagement_id, status, service_order);
CREATE INDEX IF NOT EXISTS idx_processes_vehicle
  ON public.processes(vehicle_id, status)
  WHERE vehicle_id IS NOT NULL;

ALTER TABLE public.client_service_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_service_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_service_plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage service engagements"
  ON public.client_service_engagements;
CREATE POLICY "Staff can manage service engagements"
  ON public.client_service_engagements FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP POLICY IF EXISTS "Staff can manage service plan items"
  ON public.client_service_plan_items;
CREATE POLICY "Staff can manage service plan items"
  ON public.client_service_plan_items FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP POLICY IF EXISTS "Staff can view service plan history"
  ON public.client_service_plan_history;
CREATE POLICY "Staff can view service plan history"
  ON public.client_service_plan_history FOR SELECT
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP POLICY IF EXISTS "Staff can manage client vehicles"
  ON public.client_vehicles;
CREATE POLICY "Staff can manage client vehicles"
  ON public.client_vehicles FOR ALL
  USING (public.get_user_role() IN ('super_admin', 'admin', 'analista'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'admin', 'analista'));

DROP TRIGGER IF EXISTS update_service_engagements_updated_at
  ON public.client_service_engagements;
CREATE TRIGGER update_service_engagements_updated_at
  BEFORE UPDATE ON public.client_service_engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_plan_items_updated_at
  ON public.client_service_plan_items;
CREATE TRIGGER update_service_plan_items_updated_at
  BEFORE UPDATE ON public.client_service_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_vehicles_updated_at
  ON public.client_vehicles;
CREATE TRIGGER update_client_vehicles_updated_at
  BEFORE UPDATE ON public.client_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_service_plan_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_engagement_client_id UUID;
  v_process RECORD;
  v_prerequisite_engagement_id UUID;
BEGIN
  SELECT client_id INTO v_engagement_client_id
  FROM public.client_service_engagements
  WHERE id = NEW.engagement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de atendimento não encontrado';
  END IF;

  IF NEW.process_id IS NOT NULL THEN
    SELECT process.client_id, process.process_type_id
    INTO v_process
    FROM public.processes process
    WHERE process.id = NEW.process_id;

    IF NOT FOUND
       OR v_process.client_id <> v_engagement_client_id
       OR v_process.process_type_id <> NEW.process_type_id THEN
      RAISE EXCEPTION 'O processo deve pertencer ao cliente e serviço do plano';
    END IF;
  END IF;

  IF NEW.prerequisite_item_id IS NOT NULL THEN
    SELECT engagement_id INTO v_prerequisite_engagement_id
    FROM public.client_service_plan_items
    WHERE id = NEW.prerequisite_item_id;

    IF NOT FOUND OR v_prerequisite_engagement_id <> NEW.engagement_id THEN
      RAISE EXCEPTION 'O pré-requisito deve pertencer ao mesmo plano';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_service_plan_item
  ON public.client_service_plan_items;
CREATE TRIGGER validate_service_plan_item
  BEFORE INSERT OR UPDATE ON public.client_service_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_service_plan_item();

CREATE OR REPLACE FUNCTION public.audit_service_plan_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_service_plan_history (
      plan_item_id, changed_by, old_status, new_status, note
    ) VALUES (
      NEW.id,
      public.get_profile_id(),
      NULL,
      NEW.status,
      'Servico incluido no plano do cliente'
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.client_service_plan_history (
      plan_item_id, changed_by, old_status, new_status, note
    ) VALUES (
      NEW.id,
      public.get_profile_id(),
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      CASE WHEN TG_OP = 'INSERT'
        THEN 'Serviço incluído no plano do cliente'
        ELSE COALESCE(NEW.decision_reason, 'Situação do serviço atualizada')
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_service_plan_item
  ON public.client_service_plan_items;
CREATE TRIGGER audit_service_plan_item
  AFTER INSERT OR UPDATE ON public.client_service_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_service_plan_item();

CREATE OR REPLACE FUNCTION public.validate_process_vehicle_and_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug TEXT;
  v_vehicle RECORD;
  v_plan RECORD;
BEGIN
  SELECT slug INTO v_slug
  FROM public.process_types
  WHERE id = NEW.process_type_id;

  IF v_slug IN ('processo_ipi', 'processo_icms') THEN
    IF NEW.vehicle_condition = 'usado' THEN
      RAISE EXCEPTION 'IPI e ICMS são permitidos somente para veículo zero-quilômetro';
    END IF;
    NEW.vehicle_condition := 'zero_km';
  END IF;

  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT client_id, vehicle_condition INTO v_vehicle
    FROM public.client_vehicles
    WHERE id = NEW.vehicle_id AND is_active = TRUE;

    IF NOT FOUND OR v_vehicle.client_id <> NEW.client_id THEN
      RAISE EXCEPTION 'O veículo deve pertencer ao mesmo cliente do processo';
    END IF;
    IF v_slug IN ('processo_ipi', 'processo_icms')
       AND v_vehicle.vehicle_condition <> 'zero_km' THEN
      RAISE EXCEPTION 'IPI e ICMS exigem veículo zero-quilômetro';
    END IF;
    NEW.vehicle_condition := v_vehicle.vehicle_condition;
  END IF;

  IF NEW.service_plan_item_id IS NOT NULL THEN
    SELECT engagement.client_id, item.process_type_id, item.engagement_id
    INTO v_plan
    FROM public.client_service_plan_items item
    JOIN public.client_service_engagements engagement
      ON engagement.id = item.engagement_id
    WHERE item.id = NEW.service_plan_item_id;

    IF NOT FOUND
       OR v_plan.client_id <> NEW.client_id
       OR v_plan.process_type_id <> NEW.process_type_id THEN
      RAISE EXCEPTION 'O item do plano deve pertencer ao cliente e tipo do processo';
    END IF;
    NEW.service_engagement_id := v_plan.engagement_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_process_vehicle_and_service
  ON public.processes;
CREATE TRIGGER validate_process_vehicle_and_service
  BEFORE INSERT OR UPDATE OF client_id, process_type_id, vehicle_id,
    vehicle_condition, service_plan_item_id
  ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.validate_process_vehicle_and_service();

-- Substitui a unicidade ampla por uma validação que permite IPVA simultâneo
-- apenas quando cada processo aponta para um veículo diferente.
DROP INDEX IF EXISTS public.uq_processes_one_active_type_per_client;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_process_same_vehicle
  ON public.processes(client_id, process_type_id, vehicle_id)
  WHERE duplicate_of_process_id IS NULL
    AND vehicle_id IS NOT NULL
    AND status NOT IN ('concluido', 'arquivado', 'cancelado');

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_process_without_vehicle
  ON public.processes(client_id, process_type_id)
  WHERE duplicate_of_process_id IS NULL
    AND vehicle_id IS NULL
    AND status NOT IN ('concluido', 'arquivado', 'cancelado');

CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_process_id UUID;
  v_slug TEXT;
BEGIN
  IF NEW.duplicate_of_process_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.processes canonical
      WHERE canonical.id = NEW.duplicate_of_process_id
        AND canonical.client_id = NEW.client_id
        AND canonical.process_type_id = NEW.process_type_id
    ) THEN
      RAISE EXCEPTION 'O processo oficial da duplicidade deve pertencer ao mesmo cliente e tipo.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('concluido', 'arquivado', 'cancelado') THEN RETURN NEW; END IF;

  SELECT slug INTO v_slug FROM public.process_types WHERE id = NEW.process_type_id;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      NEW.client_id::TEXT || ':' || NEW.process_type_id::TEXT || ':'
      || CASE
        WHEN v_slug = 'processo_ipva' THEN COALESCE(NEW.vehicle_id::TEXT, 'sem-veiculo')
        ELSE 'todos-os-veiculos'
      END,
      0
    )
  );

  SELECT process.id INTO v_existing_process_id
  FROM public.processes process
  WHERE process.client_id = NEW.client_id
    AND process.process_type_id = NEW.process_type_id
    AND process.duplicate_of_process_id IS NULL
    AND process.status NOT IN ('concluido', 'arquivado', 'cancelado')
    AND process.id IS DISTINCT FROM NEW.id
    AND (
      v_slug <> 'processo_ipva'
      OR process.vehicle_id IS NOT DISTINCT FROM NEW.vehicle_id
    )
  ORDER BY process.created_at
  LIMIT 1;

  IF v_existing_process_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um processo ativo deste tipo para o cliente/veículo.'
      USING ERRCODE = '23505', DETAIL = FORMAT('Processo existente: %s', v_existing_process_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Cria planos para leads convertidos e preserva os processos já iniciados.
INSERT INTO public.client_service_engagements (
  client_id, origin_lead_id, commercial_owner_id, created_at
)
SELECT
  lead.converted_client_id,
  lead.id,
  CASE WHEN assigned.role IN ('super_admin', 'admin') THEN lead.assigned_to ELSE NULL END,
  lead.updated_at
FROM public.leads lead
LEFT JOIN public.profiles assigned ON assigned.id = lead.assigned_to
WHERE lead.converted_client_id IS NOT NULL
  AND (
    CARDINALITY(lead.intended_services) > 0
    OR EXISTS (SELECT 1 FROM public.processes process WHERE process.origin_lead_id = lead.id)
  )
ON CONFLICT (origin_lead_id) DO NOTHING;

WITH lead_services AS (
  SELECT
    engagement.id AS engagement_id,
    lead.id AS lead_id,
    service.service_key,
    service.ordinality::INTEGER AS sort_order,
    CASE service.service_key
      WHEN 'cnh_especial' THEN 'cnh_especial'
      WHEN 'ipi' THEN 'processo_ipi'
      WHEN 'icms' THEN 'processo_icms'
      WHEN 'ipva' THEN 'processo_ipva'
      WHEN 'credencial_estacionamento' THEN 'estacionamento'
      WHEN 'cin' THEN 'cin'
      WHEN 'emplacamento' THEN 'emplacamento'
      WHEN 'renovacao' THEN 'renovacao'
      WHEN 'isencao_ir' THEN 'imposto_de_renda'
      WHEN 'aposentadoria' THEN 'aposentadoria'
      WHEN 'alvara' THEN 'alvara'
    END AS process_slug
  FROM public.leads lead
  JOIN public.client_service_engagements engagement
    ON engagement.origin_lead_id = lead.id
  CROSS JOIN LATERAL UNNEST(lead.intended_services)
    WITH ORDINALITY AS service(service_key, ordinality)
)
INSERT INTO public.client_service_plan_items (
  engagement_id, process_type_id, service_key, sort_order, status,
  process_id, ready_at, started_at, completed_at
)
SELECT
  source.engagement_id,
  process_type.id,
  source.service_key,
  source.sort_order,
  CASE
    WHEN process.status = 'concluido' THEN 'concluido'
    WHEN process.status IN ('arquivado', 'cancelado') THEN 'cancelado'
    WHEN process.id IS NOT NULL THEN 'iniciado'
    WHEN source.sort_order = 1 THEN 'pronto_para_iniciar'
    ELSE 'planejado'
  END,
  process.id,
  CASE WHEN process.id IS NULL AND source.sort_order = 1 THEN NOW() ELSE NULL END,
  CASE WHEN process.id IS NOT NULL THEN COALESCE(process.started_at, process.created_at) ELSE NULL END,
  CASE WHEN process.status = 'concluido' THEN process.completed_at ELSE NULL END
FROM lead_services source
JOIN public.process_types process_type ON process_type.slug = source.process_slug
LEFT JOIN public.processes process
  ON process.origin_lead_id = source.lead_id
 AND process.process_type_id = process_type.id
ON CONFLICT (engagement_id, process_type_id) DO NOTHING;

UPDATE public.processes process
SET service_engagement_id = item.engagement_id,
    service_plan_item_id = item.id
FROM public.client_service_plan_items item
WHERE item.process_id = process.id
  AND process.service_plan_item_id IS NULL;

-- Dependências iniciais dentro de cada plano.
UPDATE public.client_service_plan_items item
SET prerequisite_item_id = prerequisite.id,
    wait_reason = CASE
      WHEN item.service_key = 'ipi' THEN 'Aguardando conclusão da CNH Especial'
      WHEN item.service_key = 'icms' THEN 'Aguardando conclusão do IPI e escolha do veículo'
      ELSE item.wait_reason
    END
FROM public.client_service_plan_items prerequisite
WHERE prerequisite.engagement_id = item.engagement_id
  AND (
    (item.service_key = 'ipi' AND prerequisite.service_key = 'cnh_especial')
    OR (item.service_key = 'icms' AND prerequisite.service_key = 'ipi')
  )
  AND item.status = 'planejado';

CREATE OR REPLACE FUNCTION public.sync_service_plan_from_process()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_item_status TEXT;
  v_engagement_id UUID;
  v_client_id UUID;
  v_commercial_owner_id UUID;
  v_ready_services TEXT;
  v_just_completed BOOLEAN;
BEGIN
  IF NEW.service_plan_item_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_just_completed := NEW.status = 'concluido';
  ELSE
    v_just_completed := NEW.status = 'concluido'
      AND OLD.status IS DISTINCT FROM NEW.status;
  END IF;

  v_new_item_status := CASE
    WHEN NEW.status = 'concluido' THEN 'concluido'
    WHEN NEW.status IN ('arquivado', 'cancelado') THEN 'cancelado'
    ELSE 'iniciado'
  END;

  UPDATE public.client_service_plan_items
  SET process_id = NEW.id,
      status = v_new_item_status,
      started_at = COALESCE(started_at, NEW.started_at, NEW.created_at),
      completed_at = CASE WHEN NEW.status = 'concluido'
        THEN COALESCE(NEW.completed_at, NOW()) ELSE completed_at END
  WHERE id = NEW.service_plan_item_id;

  IF v_just_completed THEN
    UPDATE public.client_service_plan_items next_item
    SET status = 'pronto_para_iniciar',
        ready_at = NOW(),
        wait_reason = CASE
          WHEN next_item.service_key = 'icms' THEN 'Aguardando escolha do veículo'
          ELSE NULL
        END
    WHERE next_item.prerequisite_item_id = NEW.service_plan_item_id
      AND next_item.status = 'planejado';
  END IF;

  IF v_just_completed THEN
    SELECT item.engagement_id, engagement.client_id, engagement.commercial_owner_id
    INTO v_engagement_id, v_client_id, v_commercial_owner_id
    FROM public.client_service_plan_items item
    JOIN public.client_service_engagements engagement ON engagement.id = item.engagement_id
    WHERE item.id = NEW.service_plan_item_id;

    SELECT STRING_AGG(process_type.name, ', ' ORDER BY item.sort_order)
    INTO v_ready_services
    FROM public.client_service_plan_items item
    JOIN public.process_types process_type ON process_type.id = item.process_type_id
    WHERE item.engagement_id = v_engagement_id
      AND item.status = 'pronto_para_iniciar';

    IF v_ready_services IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, client_id, process_id, title, message, type,
        source_key, available_at, is_canceled, is_read
      )
      SELECT
        profile.id,
        v_client_id,
        NEW.id,
        'Escolha o proximo servico',
        FORMAT('Servicos disponiveis para iniciar: %s.', v_ready_services),
        'status',
        FORMAT('service-plan:%s:next-after:%s', v_engagement_id, NEW.service_plan_item_id),
        NOW(),
        FALSE,
        FALSE
      FROM public.profiles profile
      WHERE profile.is_active = TRUE
        AND (
          profile.id = v_commercial_owner_id
          OR profile.id = NEW.responsible_user_id
          OR (
            v_commercial_owner_id IS NULL
            AND NEW.responsible_user_id IS NULL
            AND profile.role IN ('super_admin', 'admin')
          )
        )
      ON CONFLICT (user_id, process_id, source_key) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        available_at = NOW(),
        is_canceled = FALSE,
        is_read = FALSE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.client_service_plan_items item
      WHERE item.engagement_id = v_engagement_id
        AND item.status NOT IN ('concluido', 'recusado', 'cancelado')
    ) THEN
      UPDATE public.client_service_engagements
      SET status = 'concluido'
      WHERE id = v_engagement_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_service_plan_from_process ON public.processes;
CREATE TRIGGER sync_service_plan_from_process
  AFTER INSERT OR UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.sync_service_plan_from_process();

COMMENT ON COLUMN public.clients.commercial_owner_id IS
  'Responsável pelo relacionamento comercial; não representa o executor operacional dos processos.';
COMMENT ON TABLE public.client_service_engagements IS
  'Agrupa os serviços confirmados em uma conversão/contratação do cliente.';
COMMENT ON TABLE public.client_service_plan_items IS
  'Plano de serviços confirmados, separado dos processos efetivamente iniciados.';
COMMENT ON TABLE public.client_vehicles IS
  'Cadastro progressivo de veículos para compartilhar identificação entre IPI, ICMS e IPVA.';
