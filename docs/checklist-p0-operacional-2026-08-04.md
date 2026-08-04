# Checklist P0 — Operação de serviços e visão de clientes

> Atualizado em 04/08/2026.
>
> Status: implementação concluída e validada no código. Para ativar as novas
> views, auditoria de prioridade e dados normalizados de compra no banco, ainda
> é necessário aplicar `supabase/migrations/031_p0_operational_checklist_completion.sql`.
>
> Validação executada: 87 testes, TypeScript e build de produção aprovados.

## Conversão e abertura correta dos serviços

- [x] Todos os serviços confirmados são materializados como processos visíveis.
- [x] CNH inicia ativa; IPI aguarda CNH; ICMS aguarda IPI; IPVA fica paralelo.
- [x] Serviços adicionados posteriormente também criam cards/processos.
- [x] Prioridade manual registra operador e data.
- [x] CNH concluída libera IPI; IPI deferido libera ICMS.
- [x] ICMS deferido oferece abertura do IPVA.
- [x] Criações e transições são idempotentes e protegidas contra duplicidade.

## Veículo progressivo

- [x] ICMS e IPVA podem iniciar sem veículo.
- [x] O veículo pode ser vinculado depois pela edição do processo.
- [x] Concessionária/vendedor, marca/modelo e identificadores são preenchidos de
  forma progressiva.
- [x] A validação mínima ocorre somente antes do protocolo dependente do veículo.
- [x] IPI/ICMS continuam restritos a zero-quilômetro; IPVA aceita novo ou usado.

## Carteiras operacionais

- [x] Cliente, contato, etapa, situação, ação, observações e atualização visíveis.
- [x] Próxima ação e prioridade usam o catálogo central compartilhado.
- [x] Ordenação ocorre por necessidade de ação.
- [x] Busca e filtros de etapa, situação, ação, responsável e período disponíveis.
- [x] Desktop usa tabela e celular usa cards.

## Resumo de clientes

- [x] Colunas comerciais, contratuais, compra, CNH, CIN e Credencial disponíveis.
- [x] Usuário pode escolher as colunas.
- [x] Compra normalizada em `client_vehicle_purchases`.
- [x] CIN/Credencial usam a regra de documento concluído e vigente.
- [x] Filtros e exportação CSV acompanham a mesma consulta.
- [x] Desktop e celular possuem visualizações próprias.

## Implantação

- [ ] Aplicar `supabase/migrations/031_p0_operational_checklist_completion.sql` no
  ambiente Supabase e executar uma validação funcional com dados reais.
