# Operação IMESC independente

## Aplicação no banco

A operação separada do IMESC depende da migration
`025_independent_imesc_operations.sql`. Ela cria a carteira, o histórico, as
políticas de acesso e o backfill dos dados antigos. A mesma migration redefine
o workflow do IPVA sem excluir as etapas IMESC legadas.

As migrations devem ser aplicadas na ordem numérica antes da publicação do
frontend:

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

- Abrir `/processos/imesc-operacao` e iniciar um acompanhamento apenas com o
  cliente, sem IPI ou IPVA.
- Vincular um IPI existente e confirmar o acesso ao detalhe pelo card.
- Vincular posteriormente um IPVA do mesmo cliente.
- Movimentar o card entre Aguardando, Leve, Moderado e Grave.
- Exibir as situações adicionais e validar Não compareceu, Sem deficiência,
  Indeferido e Cancelado.
- Reduzir a etapa operacional e confirmar que datas condicionais ocultas foram
  limpas.
- Conferir o histórico em `imesc_followup_history`.
- Abrir um IPVA de São Paulo, sincronizar o workflow e confirmar somente cinco
  etapas ativas: documentos, SIVEI, SEFAZ, recurso e conclusão.
- Confirmar que as etapas IMESC antigas continuam armazenadas, mas não aparecem
  no progresso nem determinam a fila do IPVA.
- Validar arrastar e soltar no desktop e o seletor “Mover para” no celular.
- Executar o fluxo novo lead → classificação → conversão → criação dos
  processos, confirmando que `converted_client_id` e os serviços foram
  preservados.

## Operação

- Carteira IMESC: `/processos/imesc-operacao`.
- Fila IPVA: `/processos/ipva-operacao`.
- A classificação fica em `imesc_followups.board_status`, nunca no grau
  genérico do cliente.
- IPI e IPVA são vínculos opcionais e só podem apontar para processos do mesmo
  cliente.
