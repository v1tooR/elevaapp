# Workflow IMESC/IPVA

## Aplicação no banco

A implementação depende da migration `011_workflow_hardening.sql`. Ela deve ser aplicada antes da publicação do novo frontend, porque as telas passam a consultar campos, tabela e RPCs criados por ela.

```powershell
npx supabase init
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Em desenvolvimento local com Docker disponível:

```powershell
npx supabase start
npx supabase db reset
npm run test:db
```

## Verificação pós-deploy

- Criar ou abrir um processo IPVA com UF `SP` e acionar **Inicializar workflow IPVA**.
- Confirmar que existem oito etapas, sem duplicidades.
- Informar situação IMESC `laudo_disponivel` e conferir a conclusão das etapas de perícia e laudo.
- Informar SEFAZ `indeferido` e a data da ciência.
- Conferir o prazo final de 30 dias e os alertas D-10, D-3 e D-1 no calendário.
- Protocolar o recurso e conferir o cancelamento dos alertas ainda futuros.
- Anexar laudo, decisão e recurso, escolhendo a etapa correspondente.
- Concluir uma emissão de CNH e confirmar que a renovação usa o vencimento digitado.
- Concluir um IPVA e confirmar que nenhum evento anual de renovação é criado.

## Operação

- Fila consolidada: `/processos/ipva-operacao`.
- Regras ativas: `/configuracoes`, seção **Regras jurídicas versionadas**.
- O botão **Sincronizar** pode ser acionado novamente com segurança; etapas, eventos e notificações possuem chaves idempotentes.
