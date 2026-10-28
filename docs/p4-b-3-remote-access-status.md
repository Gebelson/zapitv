# P4.B.3 — acesso remoto bloqueado (28/10/2026)

Base `33ab50f` confirmada; árvore inicialmente limpa. Branch:
`codex/p4-b-3-remote-validation-20261028`. Sem alterações de código de produção.
Sem merge, push ou deploy.

## Configuração e bloqueios observados

- CLI `turso` ausente. A distribuição oficial consultada fornece Linux/macOS;
  a [instalação Windows documentada](https://docs.turso.tech/cli/installation)
  exige WSL. `wsl --list --quiet` terminou com
  `Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG` (classe não registrada). Não foram
  habilitados componentes Windows, instalado Linux ou solicitado reboot.
- Não foi possível executar `turso auth login` nem `turso db list`: não há CLI
  operacional. Nenhum banco/token foi criado; não se presumiu que staging inexiste.
- As duas interfaces disponíveis de automação do navegador falharam na
  inicialização (`failed to write kernel assets`, erro 3). Não houve login no painel.
- O conector Vercel só disponibilizou uma equipe sem o projeto ZapiTV no escopo
  consultado. Bindings Production/Preview não puderam ser conferidos.
- Credenciais staging, referência do banco de produção e confirmação de isolamento
  estão ausentes no ambiente. Preparado `.env.staging.local` a partir do template,
  com valores vazios e confirmação **false**. Arquivo ignorado pelo Git, não commitado.
- Preflight existente executado: `STAGING_CONFIG_MISSING`, saída 1, antes de
  conectar. Nenhuma variável foi marcada como isolamento aprovado sem evidência.

## Resultado da verificação offline solicitada

Foi exercitada a classe **real** `SyncQueueManager`, com armazenamento descartável
em memória e resposta **simulada** do servidor no formato existente:
HTTP/envelope `success=true`, mas resultado individual `success=false`, erro
`SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP`. A operação tinha oito dias.

Resultado observado: fila **1 → 0**, chave persistida **removida**. Zero requests
remotos; nenhum dado real de usuário foi usado. O método `flush` remove o lote
inteiro ao olhar apenas `outcome.success`, sem conferir os resultados individuais.
Portanto, a condição de manter operações recusadas recuperáveis localmente
**não está atendida** na base 33ab50f. Bloqueia aprovação da sincronização; precisa
de correção e regressão específica antes de liberação. Nenhuma mudança funcional
foi feita nesta etapa bloqueada de configuração, conforme o escopo solicitado.

## Próximo passo preciso

1. Restabelecer WSL funcional no Windows (operação administrativa que pode exigir
   reinicialização) ou fornecer um ambiente Linux/Turso já autenticado. Depois,
   seguir o instalador oficial e executar `turso auth login` com o titular da conta.
   Alternativamente, disponibilizar acesso autenticado ao painel/API por canal
   seguro; não colar tokens no chat.
2. Executar `turso db list`. Só se o staging exclusivo não existir, criar
   `turso db create zapitv-staging-db` **sem `--tursodb`**, e conferir com
   `turso db show zapitv-staging-db`. Não alterar banco existente por semelhança de nome.
3. Comparar IDs reais de staging/produção e os bindings de produção do projeto
   Vercel correto. Sem acesso a esses bindings, manter isolamento não comprovado.
4. Preencher o arquivo privado com URL/token exclusivos do staging e a URL de
   referência de produção; só após a revisão marcar `P4B2_ISOLATION_REVIEWED=true`.
5. Executar, em processo sem variáveis conflitantes herdadas:

   ```text
   node --env-file=.env.staging.local --import tsx scripts/p4_b_2_turso_preflight.ts
   ```

6. Se houver divergência, parar. Para migrar, registrar banco identificado,
   backup/recuperação e **obter autorização explícita de escrita**. A autorização
   atual de criar um banco não foi interpretada como autorização para migrações,
   cadastro de contas ou outros dados. Seguir `docs/p4-b-2-turso-staging.md`.

## Entrega real

| Item | Estado |
| --- | --- |
| Conexão e inspeção do schema remoto | Não realizadas; acesso bloqueado. |
| Isolamento staging/produção | Não comprovado. |
| Migrações remotas aplicadas | Nenhuma. |
| Transações/rollback/idempotência/duas sessões remotas | Não testados. |
| Latências e consumo Turso | Não medidos. |
| Teste local do descarte de recusas | Falha demonstrada com resposta simulada. |
| Preview protegido/QR físico | Pendentes; nenhum deploy. |

Não foram repetidas auditorias nem suítes completas. **Homologação remota não concluída.**
