# Auditoria funcional — Lead e resumo dos processos

Data da análise: 03/08/2026. Atualização de implementação: 04/08/2026.

Fontes analisadas:

- `C:\Users\Usuario\Downloads\Lead.pdf`
- `C:\Users\Usuario\Downloads\Tela de resumo dos processos - ELEVA.xlsx`
- implementação atual do app e migrations `001` a `032`

Este documento separa o que já existe do que ainda falta. Os itens P1 assinalados
foram implementados no código e cobertos pelas migrations `030` a `032`. Para a
homologação no ambiente conectado, ainda é necessário aplicar as migrations
novas e executar o roteiro funcional indicado na seção P2.

## Visualização consolidada dos materiais

O PDF descreve a jornada completa do atendimento, enquanto a planilha define a
visão operacional que a equipe precisa consultar no dia a dia.

```text
Lead com várias condições e serviços
                |
                v
Conversão sem redigitação -> cliente + plano de serviços visível
                |
                +-> CNH Especial -> IPI -> ICMS
                |                    |
                |                    +-> decisão sobre iniciar IPVA
                |
                +-> IPVA em paralelo, sem depender de CNH/IPI/ICMS
                |      |
                |      +-> resumo do IMESC vinculado, mas fluxo independente
                |
                +-> CIN, Credencial, Emplacamento e demais serviços
```

A ordem acima representa dependência, não necessariamente a ordem visual do
catálogo. O PDF mais novo coloca CIN antes de CNH, mas isso conflita com a regra
anterior do app, que coloca CNH Especial primeiro. Essa decisão está registrada
ao final.

### Estrutura esperada da planilha

Todas as quatro carteiras principais usam a mesma base:

| Cliente | CPF | Telefone | Etapa | Situação | Próxima ação | Observações | Última atualização |
| --- | --- | --- | --- | --- | --- | --- | --- |

Referências operacionais extraídas da planilha:

| Carteira | Etapas/situações destacadas | Transição esperada |
| --- | --- | --- |
| CNH Especial | Poupatempo, Perícia, Recurso, Exame Prático e resultado | Aprovação/finalização libera IPI |
| IPI | Laudo DETRAN, Protocolo, Recurso, Deferido/Indeferido | Deferimento libera ICMS |
| ICMS | Escolha do carro, Protocolo, Recurso, Deferido/Indeferido | Perguntar se deve iniciar IPVA |
| IPVA | IMESC como referência, Protocolo, Recurso, Deferido/Indeferido | Acompanhar sem depender da fila CNH/IPI/ICMS |

A planilha também contém uma visão de clientes com: cliente, CPF, telefone,
contrato, valor, responsável, indicação, concessionária, vendedor, data da
compra, próxima troca, vencimento da CNH, existência de CIN e existência de
Credencial.

## O que já está implementado

- [x] Seleção múltipla de deficiências/condições no lead, no formato de chips
  com checkbox solicitado.
- [x] Perfil condutor/não condutor com exibição condicional dos campos.
- [x] CNH Especial, restrições, LOAS/BPC e existência de laudo no lead.
- [x] Seleção de vários serviços pretendidos no lead.
- [x] Cadastro de vendedores/indicadores e vínculo do lead por identificador.
- [x] Relatório mensal de indicações com leads, conversões e situação.
- [x] Cópia dos principais dados de elegibilidade do lead para o cliente.
- [x] RG removido dos formulários, com preservação histórica no banco.
- [x] Uma única seleção múltipla de deficiências no cliente.
- [x] Rótulo “Restrições da CNH” e campo “Vencimento da CNH”.
- [x] Estados simplificados do Gov.br e armazenamento de senha em fluxo de
  escrita protegida, sem visualização/cópia e com expiração.
- [x] Plano de serviços persistido, com ordem e dependências entre CNH, IPI e
  ICMS.
- [x] `sort_order` persistido nos tipos de processo e usado no seletor de criação.
- [x] Tipos Aposentadoria e Alvará criados no catálogo.
- [x] “Laudo” retirado da criação de novos processos e preservado para histórico.
- [x] Laudo DETRAN incorporado ao workflow do IPI.
- [x] Visão IMESC independente do processo de IPVA.
- [x] Estrutura geral de próxima ação, ator, prazo e bloqueio já existente no
  processo e reutilizável nas novas carteiras.

## Checklist do que falta alterar

### P0 — Conversão e abertura correta dos serviços

- [x] Ao converter o lead, mostrar todos os serviços confirmados como processos
  visíveis no cliente; hoje apenas o primeiro processo realmente é criado e os
  demais ficam somente no plano.
- [x] Para o conjunto CNH + IPI + ICMS + IPVA, aplicar o comportamento:
  - [x] CNH inicia pronta para movimentação;
  - [x] IPI fica visível como “Aguardando conclusão da CNH”;
  - [x] ICMS fica visível como “Aguardando deferimento do IPI”;
  - [x] IPVA fica disponível em paralelo, sem esperar a fila anterior;
  - [x] apenas CNH e IPVA geram alertas imediatos nesse cenário.
- [x] Fazer a seção “Serviços contratados” explicar claramente o que será aberto,
  o que ficará aguardando e qual serviço está ativo.
- [x] Depois de adicionar serviços no cliente, criar os respectivos cards/processos
  planejados e não apenas salvar seleções sem retorno operacional.
- [x] Manter a possibilidade de escolher manualmente o próximo serviço, registrando
  quem alterou a prioridade e quando.
- [x] Ao finalizar a CNH, liberar e iniciar o IPI selecionado sem exigir nova
  criação manual.
- [x] Ao deferir o IPI, liberar/iniciar o ICMS quando contratado.
- [x] Ao deferir o ICMS, perguntar “Dar entrada no IPVA?” sem tornar o IPVA uma
  dependência obrigatória.
- [x] Evitar processos duplicados quando uma transição automática encontrar um
  processo ou item de plano já existente.

### P0 — Retirar a exigência prematura de veículo

- [x] Permitir criar e movimentar ICMS sem veículo cadastrado; atualmente a tela
  bloqueia o salvamento se não houver veículo selecionado.
- [x] Permitir criar e movimentar IPVA sem veículo cadastrado, possibilitando o
  vínculo posterior.
- [x] Remover de ICMS/IPVA a regra `requiresVehicleBeforeStart`.
- [x] Não exigir descrição temporária, chassi, placa ou RENAVAM quando o veículo
  ainda não foi escolhido/comprado.
- [x] Exigir identificação do veículo somente no marco operacional em que ela for
  realmente necessária, com validação progressiva:
  - [x] concessionária e vendedor podem ser informados antes do veículo;
  - [x] marca/modelo podem ser preenchidos quando escolhidos;
  - [x] chassi, placa e RENAVAM ficam para quando existirem;
  - [x] antes do protocolo que depende do veículo, validar os dados mínimos.
- [x] Preservar a regra de IPI/ICMS apenas para veículo zero-quilômetro e IPVA para
  zero-quilômetro ou usado, sem antecipar a escolha do automóvel.

### P0 — Carteiras no formato operacional da planilha

- [x] Substituir a lista simplificada de cada tipo de processo, que hoje mostra
  apenas cliente, protocolo, status e data, por uma visão com:
  - [x] cliente;
  - [x] CPF;
  - [x] telefone;
  - [x] etapa atual;
  - [x] situação da etapa;
  - [x] próxima ação;
  - [x] observações operacionais;
  - [x] última atualização.
- [x] Reutilizar a lógica da lista geral de processos para não criar duas regras
  diferentes de próxima ação e prioridade.
- [x] Separar visualmente “status do processo”, “etapa”, “situação” e “próxima
  ação”; a planilha não trata esses conceitos como sinônimos.
- [x] Criar um catálogo central de situações e ações sugeridas, incluindo:
  - [x] Não iniciado;
  - [x] Agendado;
  - [x] Solicitado;
  - [x] Aguardando documento/laudo;
  - [x] Em análise;
  - [x] Finalizado;
  - [x] Deferido/Indeferido;
  - [x] Agendar, Solicitar, Dar entrada, Consultar e Encerrar.
- [x] Ordenar cada carteira por necessidade de ação, e não somente por data de
  criação ou status geral.
- [x] Adicionar busca por nome, CPF e telefone e filtros por etapa, situação,
  próxima ação, responsável e período.
- [x] Na visualização móvel, trocar a tabela larga por cards que mantenham etapa,
  ação e contato visíveis.

### P0 — Visão de resumo dos clientes

- [x] Criar uma visão de resumo dos clientes baseada na última seção da planilha,
  sem sobrecarregar a lista simples atual.
- [x] Exibir ou permitir escolher as colunas:
  - [x] cliente, CPF, telefone e data de cadastro;
  - [x] serviços/contrato e valor contratado;
  - [x] responsável comercial;
  - [x] indicação/vendedor-indicador de origem;
  - [x] concessionária e vendedor da concessionária;
  - [x] data da compra e próxima troca;
  - [x] vencimento da CNH;
  - [x] possui CIN;
  - [x] possui Credencial de estacionamento.
- [x] Não misturar “indicação” com “vendedor da concessionária”: são vínculos de
  naturezas diferentes.
- [x] Normalizar concessionária, vendedor da concessionária, data da compra e
  próxima troca; hoje concessionária/vendedor ficam em JSON de etapa e não são
  confiáveis para filtros e resumo.
- [x] Derivar contrato/valor do módulo financeiro e serviços do plano, evitando
  campos duplicados no cliente.
- [x] Definir se “possui CIN/Credencial” significa serviço contratado, processo
  concluído ou documento vigente e aplicar uma única regra.
- [x] Adicionar filtros e exportação da visão, com versão responsiva por cards.

### P1 — Lead e cadastro do cliente

- [x] Adicionar CPF do representante legal ao lead quando “Não condutor” e
  “Possui representante” estiverem marcados; hoje somente o nome é coletado no
  lead e o CPF precisa ser digitado depois no cliente.
- [x] Copiar o CPF do representante na conversão e limpar nome/CPF quando a opção
  de representante for desmarcada.
- [x] Alterar o texto do lead de “Possui laudo médico válido para o processo?”
  para “Possui laudo médico?”; a existência do laudo não deve presumir validade.
- [x] Parar de preencher automaticamente o campo legado `report_valid` como
  verdadeiro apenas porque existe um laudo.
- [x] Remover da criação, edição e resumo do cliente a “Situação da avaliação
  médico-pericial”; resultados devem pertencer ao processo correspondente.
- [x] Remover da criação, edição e resumo do cliente a “Validade do laudo”.
- [x] Preservar os valores antigos de avaliação e validade no banco apenas para
  histórico/migração, sem reapresentá-los como triagem genérica.
- [x] Remover o painel “Revisão de elegibilidade” dos detalhes de CNH, ICMS e
  IPVA; a viabilidade comercial já foi avaliada e exceções podem ir para
  observações.
- [x] Corrigir o atalho de CNH Especial no cliente para considerar também
  processos ativos legados que ainda não estejam vinculados ao plano; hoje ele
  pode oferecer uma nova CNH mesmo com outra em andamento.
- [x] Ajustar os nomes dos serviços para refletir o material: “CIN PCD”,
  “Credencial de estacionamento PCD” e “Renovação de CNH”.
- [x] Quando IPVA for selecionado, permitir registrar “zero-quilômetro” ou “usado”
  no momento adequado, sem criar dois tipos de processo diferentes.

### P1 — CNH Especial

- [x] Simplificar e ordenar as etapas para: Checklist, Poupatempo, Perícia,
  Recurso quando necessário, Exame Prático e CNH finalizada.
- [x] Unificar “Aprovado/Reprovado” com a situação da etapa, eliminando os botões
  duplicados de status e resultado.
- [x] Manter “Exame prático determinado?” somente na Perícia da CNH, onde a
  decisão efetivamente ocorre.
- [x] Remover “Veículo adaptado determinado?” da Perícia e da Junta; necessidades
  excepcionais podem ser registradas nas observações.
- [x] No Exame Prático, mostrar a modalidade antes de data/agendamento.
- [x] Ao selecionar Aprovado ou Reprovado, registrar automaticamente que o cliente
  compareceu, permitindo correção manual somente em caso excepcional.
- [x] Abrir Recurso apenas quando houver reprovação/indeferimento.
- [x] Concentrar na etapa final as restrições e o vencimento da CNH e atualizar o
  cadastro do cliente ao concluir.
- [x] Garantir que a conclusão libere o IPI do plano e gere a próxima ação correta.

### P1 — IPI

- [x] Simplificar a etapa Laudo DETRAN para os estados visíveis “Não iniciado”,
  “Solicitado” e “Recebido”.
- [x] Mapear os estados antigos sem perder histórico; “Em andamento” pode ser
  apresentado como “Solicitado”, e “Pronto” como “Recebido”.
- [x] Remover da tela as datas de solicitação e validade do laudo.
- [x] Quando o laudo estiver “Recebido”, mostrar em um bloco opcional somente os
  dados úteis de identificação do documento, evitando um formulário grande.
- [x] Manter a liberação automática do checklist e a notificação ao cliente
  quando o laudo for recebido.
- [x] Manter Checklist e Protocolo como etapas principais.
- [x] Incorporar a situação de análise/deferimento no Protocolo e remover as
  etapas separadas “Análise da Receita Federal” e “Autorização para compra” da
  experiência principal.
- [x] Manter Recurso condicional quando houver indeferimento.
- [x] Na transição, perguntar primeiro “Cliente comprará somente com IPI?”.
- [x] Se a resposta for “Não”, liberar o ICMS sem pedir valor, concessionária,
  vendedor, nota fiscal ou emplacamento dentro do IPI.
- [x] Deixar os dados da compra e da concessionária para o ICMS.

### P1 — ICMS

- [x] Definir São Paulo como UF inicial e, ao escolher “Outro estado”, abrir um
  seletor de UF.
- [x] Unificar “Pré-requisitos do ICMS” e “Checklist de documentos” em um único
  checklist, evitando duas etapas consecutivas com a mesma finalidade.
- [x] Incluir explicitamente nesse checklist a autorização de IPI válida e o
  Laudo DETRAN atualizado.
- [x] Manter concessionária e vendedor, mas permitir preenchê-los sem veículo e
  disponibilizá-los no resumo do cliente.
- [x] Renomear “Protocolo no SIVEI” para “Protocolo de ICMS”.
- [x] Mostrar a referência ao SIVEI somente quando a UF for São Paulo.
- [x] Ajustar as situações e próximas ações para o vocabulário da planilha.
- [x] Controlar resultado/deferimento dentro do Protocolo e retirar a etapa
  separada “Decisão da SEFAZ” da experiência principal.
- [x] Manter Recurso ou novo protocolo apenas após indeferimento.
- [x] Exigir “Cliente comunicado?” antes de concluir/deferir.
- [x] Exigir “Cliente autorizou o envio dos documentos para a concessionária?”
  antes de concluir/deferir.
- [x] Remover uma eventual etapa separada de concessionária; o controle deve
  permanecer no protocolo/transição do ICMS.

### P1 — IPVA e IMESC

- [x] Permitir iniciar o IPVA antes do cadastro do veículo e vincular o automóvel
  posteriormente.
- [x] Apresentar o IPVA no mesmo resumo de etapa, situação, próxima ação e
  observação usado pelas outras carteiras.
- [x] Preservar internamente protocolo, decisão SEFAZ, recurso e conclusão, mas
  simplificar a leitura operacional para o formato da planilha.
- [x] Remover o painel “Revisão de elegibilidade” do IPVA.
- [x] Mostrar no IPVA um resumo do IMESC vinculado — situação, agendamento e
  classificação — sem voltar a fazer o IPVA depender do IMESC.
- [x] Permitir abrir a operação IMESC a partir desse resumo.
- [x] Manter o quadro IMESC independente e a classificação leve/moderado/grave
  fora do cadastro genérico do cliente.

**Status do P1:** concluído no código. A migration `030` adiciona e converte o
CPF do representante; a `031` normaliza os dados da compra; e a `032` migra a
apresentação dos workflows, preserva campos legados como histórico e aplica as
transições condicionais entre CNH, IPI e ICMS. O conjunto automatizado possui
92 testes aprovados. As migrations `031` e `032` foram confirmadas no ambiente
conectado e o fluxo completo foi homologado com dados temporários isolados.

### P2 — Persistência, migração e qualidade

- [x] Criar migration para CPF do representante no lead e atualizar RLS, tipos,
  criação, edição, conversão e backfill quando houver dado confiável.
- [x] Criar campos normalizados para concessionária, vendedor da concessionária,
  data da compra e próxima troca, preferencialmente vinculados ao veículo ou à
  aquisição e não ao cadastro-base do cliente.
- [x] Criar a taxonomia persistida de situação/próxima ação ou uma função única de
  derivação por workflow, evitando textos divergentes entre telas.
- [x] Fazer backfill de processos planejados para que serviços já contratados
  apareçam no cliente sem duplicar processos ativos.
- [x] Migrar etapas antigas de CNH, IPI e ICMS para a nova apresentação,
  preservando dados removidos em histórico somente leitura.
- [x] Preservar processos antigos de Laudo como histórico e impedir apenas novas
  criações.
- [x] Atualizar filtros, dashboard, Minha rotina e notificações para as novas
  transições automáticas.
- [x] Registrar no histórico liberações automáticas, mudança de próximo serviço,
  vínculo posterior de veículo e autorizações do cliente.
- [x] Atualizar testes unitários para lead, conversão, plano, CNH, IPI, ICMS,
  IPVA e IMESC.
- [x] Executar os testes de integração contra o banco após aplicar as migrations
  `031` e `032` no ambiente de homologação.
- [x] Validar o fluxo ponta a ponta com os quatro serviços selecionados:
  - [x] conversão cria/mostra todos;
  - [x] CNH e IPVA ficam acionáveis;
  - [x] IPI e ICMS ficam bloqueados com motivo claro;
  - [x] CNH finalizada libera IPI;
  - [x] IPI deferido libera ICMS;
  - [x] ICMS deferido oferece IPVA sem duplicar o já existente.
- [x] Testar desktop e celular com listas extensas, observações longas e dados
  ainda incompletos de veículo.
- [x] Validar que campos removidos/ocultos não continuem sendo gravados com
  valores antigos incompatíveis.

**Status do P2:** concluído no código e na homologação automatizada em
04/08/2026. A suíte unitária passou com 92 testes e o ensaio Playwright passou
com conversão real, quatro serviços, progressões CNH → IPI → ICMS, oferta de
IPVA idempotente e medições em `1440×900` e `390×844`. Os dados temporários
foram removidos e a consulta final retornou zero leads, clientes e perfis E2E.
A migration `033` deve ser aplicada no ambiente para remover o gatilho legado,
ativar a situação “Aguardando serviço anterior”, auditoria/notificações das
liberações e a correção do cascade de exclusão dos planos. Depois da aplicação,
reexecutar `npm run test:e2e:p2` como smoke test de implantação.

## Decisões adotadas na implementação

- [x] **Ordem global:** CNH Especial permanece primeiro quando contratada, por ser
  o pré-requisito operacional mais importante; CIN segue a ordem persistida do catálogo.
- [x] **Laudo “Não se aplica”:** ocultado da operação nova e preservado somente
  como valor legado mapeado para leitura histórica.
- [x] **“Exame prático” no lead:** decisão mantida somente na Perícia do processo
  de CNH, sem campo genérico novo no lead ou cliente.
- [x] **CIN e Credencial no resumo:** “possui” representa documento concluído e
  vigente, e não apenas o serviço selecionado.
- [x] **IMESC na carteira IPVA:** o IPVA exibe somente o resumo vinculado; a
  movimentação e a classificação permanecem no quadro IMESC independente.

## Critérios de aceite finais

- [x] A equipe converte um lead sem redigitar informações já coletadas.
- [x] Todos os serviços contratados ficam imediatamente visíveis e com motivo
  claro para estar ativo, pronto ou aguardando.
- [x] Nenhum processo de ICMS/IPVA é bloqueado apenas porque o veículo ainda não
  foi comprado/cadastrado.
- [x] A equipe identifica cliente, etapa, situação e próxima ação sem abrir cada
  processo.
- [x] CNH libera IPI, IPI libera ICMS e IPVA permanece independente.
- [x] Os resumos de cliente distinguem indicação comercial de vendedor da
  concessionária.
- [x] As telas mantêm leitura e operação completas em desktop e celular.
