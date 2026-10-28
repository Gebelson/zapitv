# P4.B.2 — preparação e evidências (28/10/2026)

Base confirmada: `07f0217`, branch `codex/p4-b-1-critical-validation-20261028`.
Branch desta entrega: `codex/p4-b-2-turso-staging-20261028`; commit na resposta final.
Checkout Git isolado, inicialmente limpo. Sem merge, push, deploy ou acesso de escrita remoto.

## Estado real

| Área | Evidência / resultado |
| --- | --- |
| Banco exclusivo de staging | **Não comprovado.** Não há TURSO_DATABASE_URL/TURSO_AUTH_TOKEN no ambiente desta sessão nem configuração nos arquivos locais examinados. O link do painel fornecido não prova separação de produção e não foi acessível pela ferramenta web. |
| Vercel remoto | Conector respondeu projeto não encontrado na consulta e a busca por ZapiTV retornou vazia no escopo disponível. Não foi possível consultar bindings Preview/Production. Isso não prova que o projeto/banco não exista em outro escopo. Nenhuma configuração remota foi alterada. |
| Migrações remotas | **Zero executadas.** Nenhuma escrita nem consulta SQL remota; não há autorização de escrita nem isolamento comprovado. |
| Testes contra Turso remoto | **Zero executados.** Cadastro, login, restart, sessões, perfis, QR, sincronização, concorrência e recuperação remotos permanecem pendentes. |
| Métricas Turso | Latência remota, linhas lidas/escritas, armazenamento e consumo: **não disponíveis/não medidos**, não zero consumo presumido. |
| Testes locais | Suítes P4.B.1, P4.B, P3.C (25 cenários) e nova P4.B.2 aprovadas. Usam serviços reais, HTTP local e SQLite/libSQL local; não homologam a rede Turso. |
| Compilação | `npm run lint` (TypeScript) e `npm run build:api` aprovados. Sem build completo do frontend, fora do escopo desta mudança de backend. |
| Preview e aparelhos | Configuração preparada, sem deployment. Linux/Vercel e dois aparelhos físicos ainda não validados. |

## Falhas demonstradas e correções pontuais

O novo teste falhou antes das correções: aceitou dois hosts Vercel não autorizados
e um host sem configuração; após purgar UUIDs com oito dias, o replay restaurou
Minha Lista/favoritos e substituiu progresso recente de 200s por 900s.

- `deviceAuthService.getPublicBaseUrl`: removida a confiança em qualquer
  `*.vercel.app`, no domínio oficial fixo e em `PUBLIC_URL`. APP_URL tem prioridade;
  sem ela, só VERCEL_URL exata é autorizada. Host encaminhado divergente é recusado.
  Sem configuração em produção, falha fechada. HTTP local fica restrito a
  localhost/127.0.0.1 no desenvolvimento. Credenciais/path/query/hash não são aceitos
  na origem configurada. O erro não inclui o cabeçalho recebido.
- `SyncService.processBatch`: recusa timestamps inválidos ou eventos com idade
  **maior ou igual a sete dias**, antes de normalizar clock skew e reservar UUID.
  Isso impede que um envio antigo seja rebaseado para agora após a limpeza da
  deduplicação. Não reescreve registros, não ressuscita tombstones e preserva
  atualizações posteriores, mesmo quando o progresso antigo era maior.
  Resposta individual: `success=false`, `SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP`.
  O campo existente `processed` conta resultados, inclusive recusas; seu contrato
  foi preservado. Clientes devem inspecionar `results`, não presumir sucesso por HTTP 200.
- Testes antigos passaram a exigir a recusa explícita de pacotes expirados e a
  configuração do deployment autorizado; verificações do estado preservado continuam.
- Nova P4.B.2 usa banco em memória descartável com as **sete migrações reais** do
  Drizzle. Exercita purga real, replay, fronteira de sete dias, timestamp inválido,
  duplicação recente e preservação dos registros. Nenhuma migração nova foi criada.

Pacotes expirados não devem ser renomeados/recarimbados automaticamente para
contornar a recusa. Após longa ausência ou relógio incorreto, puxar o estado atual,
corrigir o relógio e exigir nova intenção explícita para alterações conflitantes.
Não foi desenvolvida uma nova interface ou mecanismo de sincronização.

## Cliente e migrações: compatibilidade, sem homologação remota

Cliente instalado: `@libsql/client` 0.18.0. Drizzle usa
`client.transaction()` no adapter libSQL; o transporte HTTP instalado implementa
transações interativas, modo padrão `write`, commit e rollback. A documentação
[Turso/libSQL](https://docs.turso.tech/sdk/ts/reference) confirma esses modos e o
timeout de aproximadamente cinco segundos de transações interativas. Escritas
concorrentes são serializadas no primário; não presumir paralelismo de escritores.
Não fazer Argon2, chamadas externas ou esperas dentro da transação.

0000–0006 foram aplicadas localmente; P4.B.1 também verificou sequência e
`ensureAuthTables` subsequente, rollback, concorrência, retry e reinicialização.
O teste P4.B exerceu duas contas/perfis/sessões e outbox local. Esses resultados
não verificam timeout, locks, durabilidade ou dialect no servidor remoto.

## Preparação segura para a próxima execução

1. Identificar no painel/CLI autenticado os IDs do staging e da produção e os
   bindings reais de Production/Preview. O banco do link `zapitv` **não foi
   presumido staging**. Confirmar IDs diferentes e ausência do staging em todos os
   bindings de produção; URLs diferentes/nomes com “staging” sozinhos não bastam.
2. Disponibilizar credencial de leitura limitada ao staging em arquivo privado
   não rastreado ou secret store. Usar o template
   `config/p4-b-2-preview.env.example`, sem colocar valores no Git/chat/logs.
   A URL de produção é referência de comparação; **não é necessário token de produção**.
3. Somente após a revisão anterior, marcar `P4B2_ISOLATION_REVIEWED=true`.
   Trata-se de confirmação operacional, não prova automática. Executar:

   ```text
   node --env-file=<arquivo-privado-staging> --import tsx scripts/p4_b_2_turso_preflight.ts
   ```

   O script exige variáveis separadas TURSO_STAGING_DATABASE_URL,
   TURSO_STAGING_AUTH_TOKEN e TURSO_PRODUCTION_DATABASE_URL. Recusa endpoint local,
   credenciais embutidas, parâmetros e mesmo hostname. Usa apenas transação `read`,
   SELECT e PRAGMA table_info, com deadline de rede de 20s e fechamento em finally.
   Não importa inicializadores de schema/migrador nem imprime URLs ou tokens.
   Sem configuração, foi executado e retornou `STAGING_CONFIG_MISSING`, código 1,
   antes de abrir cliente/conexão.
4. Revisar o inventário, colunas, índices, FKs e ledger completo do servidor.
   O script compara colunas exigidas pelo snapshot 0006 e hashes/ordem do prefixo
   de migrações. **Não aprova sozinho o schema completo**: índices, constraints,
   defaults, integridade e schema anterior às migrações pendentes precisam ser
   confrontados com o snapshot correspondente. Usar consultas somente leitura,
   como `PRAGMA quick_check` e `PRAGMA foreign_key_check`, sem publicar linhas de dados.
   Banco vazio: planejar 0000–0006. Prefixo reconhecido: apenas as pendentes.
   Ledger divergente, schema sem ledger, ou tabelas inesperadas: **parar**, sem
   baseline automático, DROP, recriação ou migração forçada.
5. Preparar backup privado do staging e validar restauração em ambiente descartável
   autorizado. Exemplo de exportação documentado pelo
   [Turso](https://github.com/tursodatabase/turso-docs/blob/main/local-development.mdx):
   `turso db shell <staging-verificado> .dump > <backup-privado.sql>`.
   O backup contém dados sensíveis: fora do Git, acesso restrito; nunca imprimir.
   Não presumir disponibilidade de PITR/branching nem contratar recursos.
6. **Aguardar autorização explícita de escrita**, identificando banco, intervalo
   de migrações, backup e recuperação aprovados. Só então, em processo limpo sem
   TURSO_* herdados de produção, carregar o arquivo privado com as variáveis de
   runtime apontadas ao staging e executar o migrador existente:

   ```text
   node --env-file=<arquivo-privado-staging> ./node_modules/drizzle-kit/bin.cjs migrate
   ```

   Comando preparado, **não executado**. Não adicionar migração ao boot, build ou
   deploy. Não usar `ensureAuthTables` como substituto de ledger ou correção de drift.
7. Reexecutar preflight; verificar ledger 0000–0006, FKs/índices e invariantes.
   Se falhar: suspender tráfego de homologação e coletar erro sanitizado. Não
   presumir rollback do lote completo de migrações nem executar “down” destrutivo.
   Recuperar a cópia verificada do staging, com aprovação da restauração; nunca
   reconfigurar produção. Rollback de transação da aplicação deve ser testado
   separadamente de recuperação de schema.

## Vercel Preview preparado, sem deploy

- Manter `vercel.json`: API Node em `api/index.mjs`, `maxDuration=60`, rewrite
  `/api/:path*` → `/api/index` e fallback SPA existentes. Não alterar produção.
- Usar runtime/build Node **24.x** consistente com o ambiente local (24.13.1),
  disponível segundo a [Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
  Confirmar a configuração real do projeto antes do Preview; ela não foi acessível.
- Variáveis somente no escopo **Preview da branch**, nunca Production ou VITE_*:
  TURSO_DATABASE_URL/TURSO_AUTH_TOKEN exclusivos do staging; APP_URL exatamente
  a origem autorizada, ou vazia para usar VERCEL_URL automática do deployment.
  Não herdar APP_URL de produção. Não configurar ALLOW_LOCAL_DB; conferir que o
  banco remoto ausente falha fechado em Vercel.
- Argon2id real foi carregado/testado localmente no Windows; parâmetros atuais:
  memória 19456 KiB, duas iterações, paralelismo 1. Dependência nativa
  `@node-rs/argon2` exige o binário Linux correto no bundle Vercel; preservar opcionais
  e lockfile. O build da API passou, mas não prova execução desse binário em Linux.
- Preview executa NODE_ENV=production: cookies existentes HttpOnly, Secure,
  SameSite=Lax e Path=/, sem Domain compartilhado. Verificar Set-Cookie em HTTPS,
  CSRF e credenciais same-origin, sem expor token a JS ou cookies de outra origem.
- Rotas a validar: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`,
  `/api/auth/logout`, `/api/profiles`, `/api/device-auth/challenge`,
  `/api/device-auth/poll`, `/api/device-auth/validate`, `/api/device-auth/approve`
  e `/api/sync/*`. Mounts conferidos em `server.ts`.

## Preview protegido: celular e TV são dois clientes

O login da aplicação e a proteção Vercel são camadas independentes. Autenticar o
celular na Vercel **não libera a TV**. Ambos precisam alcançar a mesma origem
Preview autorizada antes de criar/pollar/aprovar o desafio.

Primeira opção: autenticar cada navegador/dispositivo pela proteção existente.
Para automação, usar `vercel curl`/sessão autorizada ou cabeçalhos de proteção em
dois contextos separados. A [Vercel documenta cabeçalho de bypass e cookie](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
Se um bypass for autorizado, injetá-lo **somente no cabeçalho de requests ao host
exato do Preview**, a partir do secret store do executor, sem traces/HAR/logs com
headers. Não anexar globalmente a requests de addons/CDNs. Validar cada sessão
separadamente, sem copiar o cookie de login da ZapiTV do celular para a TV.

O QR contém somente URL normal de verificação e user code, nunca bypass, token
Turso ou sessão. Não usar segredo em query string, frontend ou QR. Em Tizen/MSX
sem suporte a autenticação/cabeçalhos/cookie de proteção no próprio aparelho, o
teste físico permanece bloqueado até existir um caminho aprovado pela proteção
vigente; não desabilitar a proteção nem instalar proxy que exponha segredos.

## Matriz remota pendente após autorização

Executar os fluxos existentes contra **o mesmo staging remoto**, com contas de
teste e namespace identificável, limpeza apenas desses dados após aprovação:
cadastro/login Argon2id; persistência de sessões após reinício real do backend;
perfis e duas sessões independentes de contas diferentes; challenge/aprovação/poll
do QR; progresso, histórico, listas/favoritos; concorrência e UUID duplicado;
falha no meio da transação e rollback; purga/replay após sete dias; desconexão e
reconexão do cliente. Não alterar o relógio ou purgar tabelas reais globais para testar TTL.
Capturar duração por operação, status e erro sanitizado; separar cold start, hash
e round-trips. Obter consumo do painel/CLI autorizado quando disponível, sem
inventar contagens de linhas ou custo. Testar limites interativos do Turso e a
execução Linux no Preview; depois, celular e Samsung/Fire TV físicos.

## Arquivos e testes desta entrega

Alterados: dois serviços de segurança/sync, dois testes antigos ajustados, nova
suíte `tests/p4_b_2_staging_safety.test.ts`, preflight somente leitura, template,
este relatório/plano e bundle API gerado. Nenhuma nova dependência ou migração.
O checkout recebeu `npm ci --ignore-scripts` do lockfile existente para restaurar
dependências declaradas ausentes, sem alteração de manifests.

Cada subprocesso das suítes relacionadas recebeu deadline de 120s e encerrou.
Não foram executadas suítes do player/frontend sem relação com a alteração.
Plano e código preservam o bloqueio remoto: **homologação Turso não concluída**.

A revisão automática bloqueou a remoção do diretório temporário
`%TEMP%\zapitv-p4b2-oCc2k7` criado na primeira tentativa de teste em arquivo
(“blocked by policy”). Foi deixado intacto. A suíte final usa memória e não deixa
esse tipo de arquivo; os processos dos testes encerraram.
