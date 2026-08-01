# Plano de implementação — alterações da reunião de 01/08/2026

Este plano organiza todas as alterações em entregas incrementais. Cada fase deve
ser concluída e validada antes da próxima, evitando retrabalho e migrations
contraditórias.

## Visão das entregas

- **Entrega A — Operação utilizável:** lista geral e Minha rotina orientadas a
  ações.
- **Entrega B — Estrutura comercial e serviços:** dono comercial, plano de
  serviços e dependências.
- **Entrega C — Processos e veículos:** regras de veículo, duplicidade e início
  no meio do fluxo.
- **Entrega D — Carteiras e renovações:** IMESC/IPVA e vencimentos em 30 dias.
- **Entrega E — Financeiro completo:** parcelas, custos, comissões e margem.
- **Entrega F — Migração, testes e publicação:** backfills, segurança e validação
  ponta a ponta.

---

## Fase 0 — Decisões e contrato funcional

Concluir antes de criar as novas tabelas.

- [ ] Aprovar a separação entre **plano de serviços contratados** e **processos
  efetivamente iniciados**.
- [ ] Aprovar que, na conversão, o usuário confirma os serviços e apenas os que
  podem começar agora viram processo.
- [ ] Aprovar que serviços futuros geram uma sugestão “Iniciar próximo serviço”,
  em vez de processos vazios ou bloqueados.
- [ ] Definir quais perfis podem ser donos comerciais. Recomendação:
  superadministrador e administrador.
- [ ] Confirmar que responsável comercial e responsável operacional são pessoas
  diferentes e campos independentes.
- [ ] Definir a identificação progressiva do veículo:
  - [ ] descrição temporária permitida no início;
  - [ ] chassi para veículo novo quando disponível;
  - [ ] placa ou RENAVAM para veículo usado/emplacado;
  - [ ] exigir ao menos um identificador antes de protocolar o IPVA.
- [ ] Confirmar que IPI e ICMS aceitam somente veículo zero-quilômetro.
- [ ] Confirmar que múltiplos IPVA simultâneos são permitidos apenas para veículos
  diferentes.
- [ ] Confirmar que alertas de cobrança por marco serão internos na primeira
  versão; nenhuma cobrança automática será enviada ao cliente.
- [ ] Definir se comissões pessoais entram no financeiro da empresa. Recomendação:
  registrar somente obrigações efetivamente pagas pela empresa.
- [ ] Aprovar a janela de renovação em 30 dias.
- [ ] Registrar as decisões neste documento e remover alternativas rejeitadas.

### Critério de aceite da fase

- [ ] Não existe decisão pendente que altere o desenho das tabelas ou o fluxo de
  conversão.

---

## Entrega A — Operação diária orientada a ações

### Fase 1 — Linguagem e regras de prioridade

- [ ] Definir os conceitos apresentados ao usuário:
  - [ ] **Status do processo:** aberto, em andamento, aguardando, concluído etc.;
  - [ ] **Etapa atual:** Poupatempo, perícia, exame prático, protocolo etc.;
  - [ ] **Status da etapa:** precisa agendar, agendado, em análise, aprovado etc.;
  - [ ] **Próxima ação:** instrução objetiva do que deve ser feito;
  - [ ] **Ator:** equipe, cliente, órgão ou terceiro.
- [ ] Criar um catálogo central de ações sugeridas por tipo de processo e etapa.
- [ ] Padronizar rótulos com verbos: Agendar, Dar entrada, Protocolar, Revisar,
  Solicitar documento, Entrar em contato e Aguardar.
- [ ] Definir a prioridade operacional:
  1. vencido/crítico;
  2. ação da equipe com prazo;
  3. ação da equipe sem prazo;
  4. ação de cliente/órgão/terceiro;
  5. aguardando data;
  6. sem ação definida.
- [ ] Definir a legenda de cores:
  - [ ] vermelho: equipe precisa agir ou item vencido;
  - [ ] âmbar: prazo próximo/atenção;
  - [ ] azul ou violeta: aguardando cliente/órgão/data;
  - [ ] verde: aprovado/concluído;
  - [ ] cinza: cancelado/arquivado.
- [ ] Garantir que texto e ícone expressem a situação sem depender apenas da cor.

### Fase 2 — Lista geral

- [ ] Acrescentar telefone à consulta, busca e exibição resumida.
- [ ] Organizar as colunas em: cliente/contato, serviço, status do processo,
  etapa/status, próxima ação, ator/prazo e responsável operacional.
- [ ] Exibir a tag de ação com destaque conforme a prioridade.
- [ ] Exibir bloqueio ou observação operacional abaixo da ação.
- [ ] Ordenar a lista pela regra de prioridade definida na fase 1.
- [ ] Adicionar filtros por:
  - [ ] exige ação da equipe;
  - [ ] ator da ação;
  - [ ] status da etapa;
  - [ ] texto/categoria da ação;
  - [ ] sem próxima ação definida.
- [ ] Preservar busca, serviço, status, etapa, responsável, prazo, pendência e
  filtros salvos já existentes.
- [ ] Criar uma visualização compacta adequada para celular.

### Fase 3 — Minha rotina

- [ ] Criar itens para ações operacionais normais da equipe.
- [ ] Criar categorias: Ação da equipe, Aguardando cliente, Aguardando órgão,
  Sem próxima ação e manter as categorias críticas existentes.
- [ ] Consolidar pendências do mesmo processo em um único item, exibindo o motivo
  mais crítico e os demais motivos como detalhes.
- [ ] Exibir serviço, etapa, status da etapa, ação, ator, observação, prazo e
  responsável.
- [ ] Permitir filtro por responsável operacional, serviço, ator e período.
- [ ] Garantir que analistas vejam suas ações e administradores possam consultar
  a equipe inteira.
- [ ] Atualizar o resumo do dashboard usando os mesmos critérios.

### Critério de aceite da entrega A

- [ ] Uma analista consegue abrir Minha rotina e identificar o que deve fazer
  sem abrir cada processo.
- [ ] Itens aguardando cliente ou órgão nunca aparecem como ação imediata da
  equipe.
- [ ] Vencidos ficam acima de itens sem prazo.
- [ ] Desktop e celular apresentam todas as informações essenciais.

---

## Entrega B — Estrutura comercial e plano de serviços

### Fase 4 — Dono comercial

- [ ] Criar `commercial_owner_id` no cliente.
- [ ] Definir chave estrangeira, índice, política de acesso e auditoria.
- [ ] Copiar o responsável do lead para o dono comercial na conversão.
- [ ] Não preencher automaticamente `responsible_user_id` dos processos com o
  dono comercial.
- [ ] Manter o responsável operacional editável por processo.
- [ ] Mostrar dono comercial no cliente, leads convertidos e relatórios.
- [ ] Atualizar transferência/desativação de usuários para os dois tipos de
  responsabilidade.
- [ ] Fazer backfill somente quando houver lead de origem confiável.

### Fase 5 — Plano de serviços contratados

- [ ] Criar tabela de plano de serviços do cliente contendo:
  - [ ] cliente;
  - [ ] serviço/tipo de processo;
  - [ ] ordem;
  - [ ] situação: planejado, pronto para iniciar, iniciado, concluído, adiado,
    recusado ou cancelado;
  - [ ] processo iniciado, quando houver;
  - [ ] pré-requisito;
  - [ ] motivo e histórico;
  - [ ] lead/contrato de origem.
- [ ] Criar histórico das alterações do plano.
- [ ] Migrar `service_order` e processos originados por leads para o novo plano
  sem quebrar os vínculos atuais.
- [ ] Preservar a ação “Definir como próximo” usando o plano, mesmo antes da
  criação do processo.

### Fase 6 — Conversão do lead

- [ ] Mostrar modal com os serviços pretendidos já selecionados.
- [ ] Permitir desmarcar serviços não contratados antes da conversão.
- [ ] Exigir ao menos um serviço confirmado ou uma confirmação explícita de
  conversão sem serviço.
- [ ] Criar os itens confirmados no plano de serviços.
- [ ] Iniciar somente os serviços liberados pela estratégia aprovada na fase 0.
- [ ] Exibir resumo final: cliente criado, processos iniciados e serviços
  planejados.
- [ ] Tornar a operação idempotente para não duplicar cliente, plano ou processo
  em uma nova tentativa.

### Fase 7 — Dependências e próximo serviço

- [ ] Criar regras configuráveis para dependências entre serviços.
- [ ] Priorizar CNH Especial quando ela fizer parte do caso e for necessária.
- [ ] Impedir liberação de IPI/ICMS quando a CNH necessária terminar sem sucesso.
- [ ] Liberar IPI após a CNH quando aplicável.
- [ ] Liberar ICMS após IPI e a escolha do veículo.
- [ ] Criar situação “Aguardando escolha do veículo”.
- [ ] Manter IPVA fora da sequência CNH → IPI → ICMS.
- [ ] Ao concluir um processo, gerar “Iniciar próximo serviço”.
- [ ] Permitir iniciar, adiar, recusar ou encerrar o plano.
- [ ] Criar item na Minha rotina e notificação interna.
- [ ] Registrar todas as decisões no histórico.

### Critério de aceite da entrega B

- [ ] A conversão permite confirmar os serviços sem criar itens indesejados.
- [ ] O próximo serviço nunca é esquecido após a conclusão do anterior.
- [ ] Dono comercial e responsável operacional aparecem corretamente e não são
  confundidos.

---

## Entrega C — Veículos, duplicidade e início no meio do fluxo

### Fase 8 — Cadastro progressivo do veículo

- [ ] Criar entidade ou estrutura reutilizável de veículo vinculada ao cliente.
- [ ] Incluir descrição temporária, condição, placa, RENAVAM, chassi, marca,
  modelo e ano conforme disponibilidade.
- [ ] Permitir complementar os dados ao longo do atendimento.
- [ ] Vincular IPI, ICMS e IPVA ao veículo correspondente.
- [ ] Evitar cópia divergente dos dados do mesmo veículo em vários processos.

### Fase 9 — Regras por serviço

- [ ] Na criação de IPI, fixar condição como zero-quilômetro.
- [ ] Na criação de ICMS, fixar condição como zero-quilômetro.
- [ ] Rejeitar “usado” para IPI/ICMS na API e no banco.
- [ ] Manter zero-quilômetro e usado no IPVA.
- [ ] Manter uma CNH Especial, um IPI e um ICMS ativos por cliente.
- [ ] Alterar a unicidade do IPVA para cliente + tipo + veículo.
- [ ] Permitir outro IPVA do mesmo cliente para veículo diferente.
- [ ] Bloquear IPVA duplicado do mesmo veículo e retornar link do processo
  existente.

### Fase 10 — Iniciar processo no ponto correto

- [ ] Adicionar etapa “Onde este atendimento está?” na criação do processo.
- [ ] Permitir selecionar etapa inicial e status da etapa.
- [ ] Permitir informar próxima ação, ator e prazo na criação.
- [ ] Para CNH, permitir começar em perícia, exame prático ou recurso.
- [ ] Para IPI, permitir começar com Laudo DETRAN pronto.
- [ ] Permitir anexar documento inicial no mesmo fluxo ou imediatamente depois.
- [ ] Marcar etapas anteriores como concluídas/não aplicáveis.
- [ ] Manter etapas posteriores pendentes sem gerar informações falsas.
- [ ] Registrar evento de histórico “Processo iniciado no meio do fluxo”.
- [ ] Padronizar processo “Aberto” como ainda não iniciado e sugerir uma ação.

### Critério de aceite da entrega C

- [ ] IPI/ICMS usado é impossível por qualquer canal.
- [ ] Dois IPVA de veículos diferentes funcionam sem liberar duplicidade real.
- [ ] Um cliente que chega no recurso ou exame prático não precisa refazer etapas.

---

## Entrega D — IMESC, IPVA e renovações

### Fase 11 — Ações do IMESC

- [ ] Acrescentar próxima ação, ator e prazo ao acompanhamento IMESC.
- [ ] Gerar ações sugeridas conforme etapa: preparar solicitação, agendar,
  aguardar perícia, acompanhar laudo e concluir.
- [ ] Levar ações IMESC para Minha rotina.
- [ ] Mostrar data agendada e resultado/classificação no card.
- [ ] Adicionar filtros operacionais correspondentes.

### Fase 12 — Resumo IMESC no IPVA

- [ ] Mostrar no IPVA somente um resumo do acompanhamento vinculado.
- [ ] Exibir situação, data agendada e resultado quando existirem.
- [ ] Permitir abrir a operação IMESC pelo resumo.
- [ ] Não usar esse resumo para controlar as etapas do workflow IPVA.
- [ ] Manter no IPVA apenas documentos, SIVEI, SEFAZ, recurso e conclusão.

### Fase 13 — Renovações em 30 dias

- [ ] Limitar “Próximas renovações” ao intervalo entre hoje e 30 dias.
- [ ] Criar tela ou filtro dedicado para consultar renovações futuras.
- [ ] Permitir filtrar período, cliente, serviço e responsável.
- [ ] Criar item da Minha rotina no D-30.
- [ ] Criar notificação interna no D-30.
- [ ] Notificar o cliente somente quando o evento for visível a ele.
- [ ] Garantir que a CNH use a data real de vencimento.
- [ ] Testar grande volume de renovações no mesmo mês.

### Critério de aceite da entrega D

- [ ] IMESC continua independente e suas ações aparecem na rotina.
- [ ] IPVA mostra contexto do IMESC sem depender dele tecnicamente.
- [ ] A lista principal não exibe renovações a anos de distância.

---

## Entrega E — Financeiro completo

### Fase 14 — Permissões e estrutura do contrato

- [ ] Permitir acesso ao financeiro para superadministrador e administrador.
- [ ] Manter analistas e clientes sem acesso.
- [ ] Revisar RLS, APIs, navegação e testes de autorização.
- [ ] Criar estrutura financeira do contrato com valor total e situação.
- [ ] Vincular contrato financeiro a cliente, processo e plano de serviços quando
  aplicável.

### Fase 15 — Parcelas e recebimentos

- [ ] Criar tabela de parcelas com número, valor, vencimento, forma de pagamento,
  situação, recebimento e responsável pela baixa.
- [ ] Permitir qualquer quantidade de parcelas em PIX.
- [ ] Criar contas a receber previstas para parcelas futuras.
- [ ] Registrar receita confirmada somente quando o valor for recebido.
- [ ] Calcular recebido, saldo a receber e parcelas vencidas.
- [ ] Permitir recebimento parcial de uma parcela sem confirmar o saldo restante.
- [ ] Mostrar parcelas e histórico no cliente e no processo.
- [ ] Permitir associar parcela a um marco do processo.
- [ ] Ao atingir o marco, criar alerta interno de cobrança.

### Fase 16 — Custos e taxas

- [ ] Permitir vários custos por processo.
- [ ] Vincular despesa existente a cliente/processo pela interface.
- [ ] Reutilizar categorias para laudo, emplacamento e despesas operacionais.
- [ ] Não fixar valores padrão no código.
- [ ] Permitir editar valor, vencimento, favorecido e situação.
- [ ] Manter contas a pagar sem cliente para despesas gerais.

### Fase 17 — Comissão de vendedor/indicador

- [ ] Criar comissão vinculada ao parceiro, cliente e contrato.
- [ ] Aceitar valor fixo ou percentual opcional.
- [ ] Registrar valor previsto, vencimento, pagamento e data de quitação.
- [ ] Gerar conta a pagar quando a comissão for devida.
- [ ] Mostrar comissão pendente/paga no painel de indicações.
- [ ] Garantir que comissão continue opcional.

### Fase 18 — Resultado do contrato

- [ ] Exibir valor contratado.
- [ ] Exibir valor efetivamente recebido.
- [ ] Exibir saldo a receber.
- [ ] Exibir custos e taxas.
- [ ] Exibir comissões.
- [ ] Calcular resultado líquido e margem.
- [ ] Permitir detalhar a composição sem expor dados financeiros a analistas.

### Critério de aceite da entrega E

- [ ] Um contrato de R$ 1.200 em duas parcelas de R$ 600 mostra apenas R$ 600
  como recebido após a primeira baixa.
- [ ] Custos e comissão reduzem corretamente o resultado do contrato.
- [ ] Administradores autorizados acessam o financeiro; analistas não.

---

## Entrega F — Migração, testes e publicação

### Fase 19 — Migrations e backfills

- [ ] Criar migrations idempotentes e numeradas para todas as novas estruturas.
- [ ] Fazer backup antes da aplicação em produção.
- [ ] Fazer backfill do dono comercial a partir do lead de origem.
- [ ] Converter a fila atual em plano de serviços sem duplicar processos.
- [ ] Vincular veículos somente quando houver informação confiável.
- [ ] Migrar dados financeiros preservando lançamentos existentes.
- [ ] Preservar leads convertidos, clientes, processos e históricos.
- [ ] Criar relatório de registros que exigem correção manual.

### Fase 20 — Testes automatizados

- [ ] Testar cálculo e ordenação da prioridade operacional.
- [ ] Testar consolidação de itens da Minha rotina.
- [ ] Testar separação entre dono comercial e responsável operacional.
- [ ] Testar conversão com seleção/desseleção de serviços.
- [ ] Testar idempotência da conversão.
- [ ] Testar dependências CNH → IPI → ICMS.
- [ ] Testar próximo serviço iniciado, adiado, recusado e cancelado.
- [ ] Testar rejeição de veículo usado no IPI/ICMS.
- [ ] Testar múltiplos IPVA por veículo.
- [ ] Testar início de CNH/IPI no meio do fluxo.
- [ ] Testar ações IMESC independentes do IPVA.
- [ ] Testar janela D-30 das renovações.
- [ ] Testar parcelas, recebimentos parciais, custos, comissões e margem.
- [ ] Testar todas as permissões financeiras.

### Fase 21 — Validação ponta a ponta

- [ ] Lead com vários serviços → confirmar conversão → criar plano.
- [ ] Iniciar CNH → concluir → receber sugestão do IPI.
- [ ] Iniciar IPI com laudo pronto → concluir → aguardar veículo → iniciar ICMS.
- [ ] Criar IPVA usado e acompanhamento IMESC independente.
- [ ] Criar dois IPVA para veículos diferentes e bloquear duplicata do mesmo
  veículo.
- [ ] Consultar a operação pela Minha rotina e lista geral.
- [ ] Registrar contrato parcelado, custos e comissão.
- [ ] Conferir resultado financeiro e permissões.
- [ ] Conferir renovação da CNH no D-30.
- [ ] Validar desktop e celular.
- [ ] Validar acessibilidade por teclado, leitores e contraste.

### Fase 22 — Publicação gradual

- [ ] Publicar migrations em homologação.
- [ ] Executar backfill e revisar o relatório de exceções.
- [ ] Validar com um admin e uma analista usando dados de teste.
- [ ] Corrigir divergências antes da produção.
- [ ] Publicar banco antes do frontend compatível.
- [ ] Monitorar erros de conversão, criação de processo e financeiro.
- [ ] Liberar primeiro para administradores.
- [ ] Liberar para analistas após validação da rotina.
- [ ] Registrar feedback da primeira semana sem alterar regras diretamente em
  produção.

### Critério final de aceite

- [ ] A equipe identifica ações sem abrir processos individualmente.
- [ ] Nenhum serviço contratado é esquecido ou criado sem confirmação.
- [ ] Regras de veículo e duplicidade funcionam no banco e na interface.
- [ ] Processos podem começar na etapa real do atendimento.
- [ ] Renovações aparecem no momento certo.
- [ ] Financeiro representa caixa recebido, obrigações e resultado real.
- [ ] Todos os fluxos críticos possuem teste automatizado e evidência de
  homologação.

---

## Funcionalidades existentes que serão reaproveitadas

- [x] Lista unificada e filtros básicos.
- [x] Próxima ação, ator, prazo e bloqueio no processo.
- [x] Priorização da Minha rotina por severidade e vencimento.
- [x] Serviços múltiplos no lead e fila do cliente.
- [x] Ação “Definir como próximo”.
- [x] Bloqueio de processos ativos duplicados.
- [x] Workflows de CNH, IPI, ICMS e demais serviços.
- [x] Operação IMESC independente.
- [x] Renovação baseada no vencimento real da CNH.
- [x] Financeiro com receitas, despesas e categorias.
- [x] Comunicação e notificações do portal do cliente.
