# Custódia da senha Gov.br

## Decisão operacional

O Eleva aceita a senha Gov.br apenas como uma credencial temporária, protegida e
somente para gravação. A aplicação não possui rota, botão ou função SQL para
visualizar, copiar ou descriptografar a senha. Códigos de verificação, tokens
temporários e respostas de recuperação não podem ser armazenados.

Os estados operacionais são:

- `aguardando` — Aguardando
- `validado` — Acesso validado
- `nao_informou` — Não informou

Nível da conta, suficiência do nível, data da validação e forma de autenticação
foram retirados da operação. As colunas antigas permanecem no banco somente para
preservar histórico e não são atualizadas pela interface.

## Proteções implementadas

- Criptografia autenticada AES-256-GCM antes de qualquer gravação no banco.
- IV aleatório de 96 bits em cada gravação e tag de autenticação de 128 bits.
- Identificador do cliente e versão da chave vinculados como dados autenticados,
  impedindo a troca de envelopes entre clientes.
- Chave fora do banco e dos backups, em segredo de runtime do servidor.
- Tabela sem acesso direto para `anon` ou `authenticated`, mesmo com RLS.
- Gravação, substituição e exclusão somente por funções `SECURITY DEFINER` que
  revalidam um perfil ativo da equipe.
- Nenhum endpoint `GET`, nenhuma descriptografia e nenhuma resposta contendo
  ciphertext, IV ou tag.
- Respostas da API com `Cache-Control: no-store`, validação de origem e sem logs
  do corpo da solicitação.
- Auditoria separada contendo apenas evento, cliente, operador, prazo e versão da
  chave. Nunca contém material criptográfico ou credencial.

## Permissões formais

| Ação | Quem pode | Situação autorizada |
| --- | --- | --- |
| Gravar ou substituir | `super_admin`, `admin`, `analista` ativos | Atendimento autorizado do cliente e necessidade operacional do processo |
| Visualizar ou copiar | Ninguém | Não existe essa capacidade nesta versão |
| Excluir antecipadamente | `super_admin`, `admin`, `analista` ativos | A pedido do cliente, correção de cadastro ou fim da necessidade |
| Consultar auditoria | `super_admin` e `admin` ativos | Controle de segurança e apuração de incidente |
| Descriptografar | Ninguém pelo app ou banco | Exige nova decisão formal, fluxo server-only dedicado e auditoria de finalidade |

O operador deve confirmar a autorização do titular antes da gravação. A senha
não deve ser colada em observações, chamados, mensagens, planilhas ou campos
customizados.

## Retenção e exclusão automática

- Quando todos os processos do cliente ficam `concluido`, `arquivado` ou
  `cancelado`, começa uma retenção de **7 dias**.
- Se um processo voltar a ficar ativo, essa contagem é cancelada.
- Toda credencial possui descarte de segurança em no máximo **180 dias** após a
  última gravação, mesmo que um processo permaneça aberto.
- O job `eleva-purge-expired-gov-credentials` executa a cada hora por Supabase
  Cron e remove os envelopes vencidos.
- A exclusão antecipada pode ser feita na edição do cliente.

## Configuração obrigatória de produção

1. Gere uma chave aleatória de 32 bytes. Exemplo em PowerShell:

   ```powershell
   [Convert]::ToBase64String(
     [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
   )
   ```

2. Salve o resultado exclusivamente no gerenciador de segredos da hospedagem:

   ```text
   GOV_CREDENTIAL_ENCRYPTION_KEY=<base64 de 32 bytes>
   GOV_CREDENTIAL_KEY_VERSION=v1
   ```

3. Nunca use prefixo `NEXT_PUBLIC_`, nunca grave a chave em `.env` versionado e
   nunca coloque a chave no Supabase junto com os envelopes.
4. Aplique a migration
   `supabase/migrations/023_secure_gov_credential_escrow.sql`. Ela habilita
   `pg_cron`, cria a rotina e agenda a exclusão horária.
5. Confirme no painel do Supabase que o módulo Cron e o job
   `eleva-purge-expired-gov-credentials` estão ativos.
6. Desative captura de corpo de requisição em proxy, observabilidade, APM e
   error tracking para a rota `/api/clientes/*/gov-credential`.
7. Mantenha HTTPS obrigatório e restrinja o segredo de criptografia somente ao
   runtime do servidor web.

Sem `GOV_CREDENTIAL_ENCRYPTION_KEY`, a API recusa a gravação com erro de
configuração e não envia a senha ao banco.

## Rotação e resposta a incidente

- Gere uma nova chave, altere `GOV_CREDENTIAL_KEY_VERSION` e faça o deploy.
- Como esta versão não descriptografa, credenciais antigas continuam apenas até
  o prazo de descarte; substitua manualmente somente as ainda necessárias.
- Em suspeita de exposição, troque a chave, exclua os envelopes existentes,
  revise a auditoria e oriente os titulares a trocar a senha Gov.br.
- Backups do banco contêm apenas ciphertext. O segredo de runtime deve ter
  backup e acesso controlados separadamente, conforme a política da hospedagem.

## Referências da decisão

- LGPD, art. 46: medidas técnicas e administrativas de segurança desde a
  concepção do serviço.
- OWASP Cryptographic Storage Cheat Sheet: minimizar armazenamento, usar
  criptografia autenticada e manter chaves separadas dos dados.
- Supabase Cron: agendamento recorrente da função de expiração.

