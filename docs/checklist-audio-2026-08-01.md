# Checklist consolidado — reunião de 01/08/2026

Este checklist contém somente os ajustes adicionais identificados na nova
transcrição. Funcionalidades já concluídas aparecem no final apenas para evitar
retrabalho.

## P0 — Operação diária e visão geral

- [ ] Transformar a lista unificada em uma visão operacional com colunas
  explícitas para cliente, CPF/telefone, serviço, status do processo, etapa
  atual, status da etapa, próxima ação, quem deve agir, prazo e responsável
  operacional.
- [ ] Diferenciar visualmente os três conceitos que hoje podem ser confundidos:
  status geral do processo, etapa atual e status da etapa.
- [ ] Criar uma tag de ação objetiva, com verbos como “Agendar”, “Dar entrada”,
  “Protocolar”, “Revisar documento” e “Entrar em contato”.
- [ ] Reservar o vermelho para itens em que a equipe precisa agir; usar tons
  neutros para espera de cliente/órgão/data, verde para concluído/deferido e
  cinza para cancelado.
- [ ] Exibir na lista o motivo da ação ou do bloqueio, aproveitando próxima ação,
  observação da etapa e observação interna sem obrigar a abertura do processo.
- [ ] Ordenar a operação por: vencidos/críticos, ação da equipe, ação próxima,
  aguardando cliente/órgão e itens sem ação imediata.
- [ ] Adicionar filtros por “quem deve agir”, “exige ação da equipe”, próxima
  ação, status da etapa e texto da ação.
- [ ] Manter os filtros existentes de serviço, etapa, prazo e responsável.
- [ ] Incluir telefone na busca e na apresentação resumida da lista.

## P0 — Minha rotina

- [ ] Fazer a Minha rotina listar também ações operacionais normais da equipe,
  não somente exceções como atraso, documento, processo parado e falta de
  responsável.
- [ ] Criar categorias operacionais como “Ação da equipe”, “Aguardando cliente”,
  “Aguardando órgão” e “Sem próxima ação definida”.
- [ ] Mostrar serviço, etapa, status da etapa, ação, ator e observação diretamente
  em cada item da rotina.
- [ ] Permitir filtrar e ordenar a rotina por responsável operacional, serviço,
  ator e prazo.
- [ ] Garantir que uma ação vencida sempre apareça acima de ações sem prazo.
- [ ] Evitar itens duplicados quando o mesmo processo estiver vencido e parado;
  apresentar um item consolidado com o motivo mais crítico.

## P0 — Responsabilidade comercial e operacional

- [ ] Separar o “dono comercial/relacionamento” do cliente do responsável pela
  execução do processo.
- [ ] Copiar o responsável comercial do lead para o cliente durante a conversão.
- [ ] Não copiar automaticamente o responsável comercial para todos os processos.
- [ ] Manter responsável operacional independente por processo ou tarefa para
  Michelle, Karine e demais analistas.
- [ ] Exibir o dono comercial no cadastro do cliente e o responsável operacional
  nas listas de trabalho.
- [ ] Atualizar permissões, filtros, relatórios e transferência de carteira para
  considerar os dois papéis sem misturá-los.

## P0 — Conversão e plano de serviços

- [ ] Na conversão, abrir uma confirmação com todos os serviços pretendidos já
  marcados e permitir desmarcar os que não foram efetivamente contratados.
- [ ] Salvar um plano de serviços contratados separado dos processos efetivamente
  iniciados, preservando ordem, situação e motivo de cancelamento/recusa.
- [ ] Definir a estratégia final de abertura:
  - [ ] opção recomendada: iniciar somente o serviço que pode começar agora e
    manter os demais como planejados;
  - [ ] alternativa: criar todos os processos imediatamente, deixando os futuros
    bloqueados por pré-requisito.
- [ ] Modelar dependências configuráveis entre serviços, evitando regras rígidas
  espalhadas pela interface.
- [ ] Considerar CNH Especial como primeira quando ela for realmente necessária.
- [ ] Impedir o avanço de IPI/ICMS quando a CNH necessária não for aprovada ou
  concluída.
- [ ] Colocar IPI antes de ICMS e criar a espera explícita “Aguardando escolha do
  veículo” entre os dois quando aplicável.
- [ ] Tratar IPVA como serviço independente da fila CNH/IPI/ICMS, mantendo apenas
  o vínculo opcional com o acompanhamento IMESC.
- [ ] Ao concluir um serviço, gerar uma sugestão acionável “Iniciar próximo
  serviço”, com opções para iniciar, adiar ou encerrar o plano.
- [ ] Levar a sugestão do próximo serviço para Minha rotina e notificações.
- [ ] Registrar no histórico quem confirmou, adiou, pulou ou cancelou o próximo
  serviço.
- [ ] Ajustar a funcionalidade “Definir como próximo” para operar sobre o plano
  de serviços, inclusive quando o processo ainda não tiver sido criado.

## P0 — Regras de veículo e duplicidade

- [ ] Restringir IPI e ICMS a veículo zero-quilômetro na interface, API e banco.
- [ ] Não mostrar a opção “Usado” na criação de IPI ou ICMS.
- [ ] Manter IPVA disponível para veículo zero-quilômetro ou usado.
- [ ] Manter apenas um processo ativo de CNH Especial, IPI e ICMS por cliente.
- [ ] Permitir mais de um IPVA ativo somente quando estiverem relacionados a
  veículos diferentes.
- [ ] Criar identificação mínima do veículo para essa regra, preferencialmente
  placa, RENAVAM e/ou chassi conforme o momento do atendimento.
- [ ] Alterar a trava de duplicidade para considerar cliente + tipo + veículo no
  IPVA, preservando a regra atual para os demais serviços.
- [ ] Exibir uma mensagem clara com link para o processo existente quando uma
  tentativa realmente duplicada for bloqueada.

## P0 — Criação de processo no meio do fluxo

- [ ] Permitir informar, durante a criação, em qual etapa o atendimento já está.
- [ ] Permitir escolher o status inicial da etapa, a próxima ação, quem deve agir
  e o prazo.
- [ ] Permitir iniciar CNH Especial diretamente em perícia, exame prático ou
  recurso quando o cliente já chegar nesse ponto.
- [ ] Permitir iniciar IPI com o Laudo DETRAN já existente e anexá-lo no fluxo de
  criação ou imediatamente após salvar.
- [ ] Marcar etapas anteriores como concluídas ou não aplicáveis de forma
  coerente, sem exigir preenchimento retroativo desnecessário.
- [ ] Registrar no histórico que o processo foi importado/iniciado no meio do
  fluxo e quais informações foram informadas pelo usuário.
- [ ] Padronizar “Aberto” como processo criado, mas ainda não iniciado, sempre
  exigindo ou sugerindo uma próxima ação objetiva.

## P1 — IMESC e IPVA

- [ ] Acrescentar ao acompanhamento IMESC próxima ação, ator da ação e prazo,
  permitindo gerar “Agendar IMESC” na Minha rotina.
- [ ] Mostrar data agendada e classificação/resultado diretamente no card IMESC.
- [ ] Na carteira IPVA, mostrar um resumo opcional do IMESC vinculado — situação,
  data e resultado — sem recolocar o IMESC dentro do workflow do IPVA.
- [ ] Permitir filtrar IPVA por “precisa agendar IMESC”, “IMESC agendado” e
  “resultado disponível” usando o vínculo independente.
- [ ] Manter protocolo, SEFAZ, recurso e conclusão como etapas exclusivas do
  workflow IPVA.

## P1 — Renovações

- [ ] Limitar o bloco “Próximas renovações” aos próximos 30 dias, em vez de
  mostrar eventos de anos futuros.
- [ ] Criar uma consulta dedicada de renovações, com filtros por período, serviço,
  cliente e responsável.
- [ ] Gerar item na Minha rotina 30 dias antes do vencimento para oferecer a
  renovação ao cliente.
- [ ] Notificar a equipe e, quando permitido, o cliente dentro da janela de 30
  dias.
- [ ] Usar sempre o vencimento real do documento, especialmente na CNH, sem
  presumir prazo fixo.
- [ ] Testar lista, calendário e notificações com muitos vencimentos no mesmo mês.

## P1 — Financeiro do contrato

- [ ] Liberar o módulo financeiro para os perfis administrador autorizados, não
  apenas para super administrador, mantendo analistas sem acesso.
- [ ] Separar valor total contratado, valor recebido, saldo a receber, custos,
  comissão e resultado líquido.
- [ ] Criar parcelas vinculadas ao cliente/processo com número, valor, vencimento,
  forma de pagamento, situação e data de recebimento.
- [ ] Fazer pagamento parcial registrar somente o caixa efetivamente recebido,
  sem lançar o valor total como receita confirmada.
- [ ] Permitir duas, três ou mais parcelas em PIX, sem obrigar cartão.
- [ ] Permitir vincular uma parcela a um marco do processo, por exemplo cobrar a
  segunda parcela quando o benefício for liberado.
- [ ] Gerar contas a receber previstas e destacar parcelas vencidas.
- [ ] Exibir histórico de recebimentos no processo e no cliente.

## P1 — Custos, taxas, comissões e lucro

- [ ] Permitir registrar múltiplos custos por processo, como laudo, taxa de
  emplacamento e outras despesas variáveis.
- [ ] Reaproveitar as categorias financeiras existentes, sem fixar valores no
  código, pois as taxas podem mudar.
- [ ] Expor na interface financeira o vínculo de cada receita/despesa com cliente
  e processo, já suportado pela estrutura do banco.
- [ ] Criar comissão vinculada ao vendedor/indicador, ao cliente e ao contrato.
- [ ] Permitir comissão por valor fixo ou percentual, sem torná-la obrigatória.
- [ ] Registrar beneficiário, valor previsto, vencimento, pagamento, situação e
  data de quitação da comissão.
- [ ] Mostrar comissão pendente e paga no relatório de indicações.
- [ ] Calcular margem por contrato: recebido menos custos e comissões.
- [ ] Manter contas a pagar gerais para despesas sem vínculo com cliente.

## P2 — Validação técnica e experiência

- [ ] Criar migrations para plano de serviços, dono comercial, dados do veículo,
  parcelas, custos e comissões.
- [ ] Fazer backfill do responsável comercial usando o lead de origem quando
  houver vínculo confiável.
- [ ] Preservar a fila e os processos já criados na conversão anterior.
- [ ] Criar testes de prioridade operacional, dependências, confirmação de
  serviços, veículo usado/zero-quilômetro, múltiplos IPVA e parcelas.
- [ ] Validar que alterações de etapa atualizam automaticamente a ação sugerida
  sem apagar observações manuais.
- [ ] Validar desktop e celular, especialmente a tabela operacional e os filtros.
- [ ] Conferir acessibilidade das cores; a informação “agir/aguardar” não pode
  depender somente do vermelho ou de outra cor.

## Decisões que ainda precisam de confirmação

- [ ] Confirmar se os processos futuros serão criados na conversão ou somente
  quando o usuário aceitar a sugestão de próximo serviço. Recomenda-se separar
  plano contratado de processo iniciado.
- [ ] Confirmar os identificadores obrigatórios para distinguir veículos no IPVA:
  placa, RENAVAM, chassi ou uma combinação progressiva.
- [ ] Confirmar se o dono comercial pode ser admin e analista ou somente os
  perfis que fecham contratos.
- [ ] Confirmar quais marcos podem liberar parcelas e se a cobrança será apenas
  um alerta interno ou também uma notificação ao cliente.
- [ ] Confirmar se a comissão pessoal mencionada na reunião integra o financeiro
  da empresa ou deve permanecer em controle separado.

## Bases já existentes — não recriar

- [x] Lista unificada com nome, CPF, serviço, status, etapa, próxima ação, prazo
  e responsável.
- [x] Campos de próxima ação, ator, prazo e bloqueio no processo.
- [x] Filtros por serviço, etapa, responsável, prazo e pendência.
- [x] Minha rotina com prioridade por severidade e vencimento.
- [x] Seleção múltipla de serviços no lead e ordenação com CNH primeiro.
- [x] Criação automática dos processos selecionados na conversão.
- [x] Indicação de processo atual/próximo e ação “Definir como próximo”.
- [x] Bloqueio de processo ativo duplicado por cliente e tipo.
- [x] CNH com vencimento real e evento de renovação no calendário.
- [x] Comunicação unidirecional e notificações no portal do cliente.
- [x] Financeiro geral com receitas, despesas, categorias e vínculos opcionais no
  banco para cliente e processo.
- [x] IMESC independente do workflow IPVA.

## Observação sobre a fonte

A transcrição fornecida termina durante a discussão financeira, logo após a
menção à taxa/comissão. Se houver continuação do áudio, ela deve ser analisada
antes de considerar este checklist definitivo.
