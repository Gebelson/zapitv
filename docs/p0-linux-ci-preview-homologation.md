# P0 - CI Linux e gate de Preview - 2026-11-05

## Commit e publicacao

Branch fix/p0-provider-transitions-20261105 publicada preservando os commits anteriores. SHA testado/publicado: 6af35376930321bc6aa351483d6a79e88595e462. Commits 717b877 e 6af3537 preservados. git.deploymentEnabled continua false para essa branch. Nenhum merge, deploy, promocao ou variavel Production modificada.

## GitHub Actions real

Workflow: Qualidade do ZapiTV, workflow_dispatch.
URL: https://github.com/Gebelson/zapitv/actions/runs/42072616048
Run ID: 42072616048. Conclusao: SUCCESS.

Jobs search-performance e build-and-regression: SUCCESS em ubuntu-latest, Node 24. Passaram: npm ci; lint:architecture; test:architecture; test:catalog-sort; build completo (TypeScript, ESLint, estabilidade, transicoes de provedores, proxy, budgets, cancelamento, seguranca e autenticacao); instalacao Chromium; session-stability; player-real; storage-browser; p1-browser; outbox-browser; catalog-longevity; mobile-ranked-stability; continuity-browser; six-flows-browser; tv-search-b-disambiguation.

Os testes de browser usam ambientes controlados, nao a sessao privada do usuario e nao TVs fisicas. CI aprovada nao e evidencia de reproducao integrada de um titulo real.

## Vercel e isolamento

Projeto zapitv, equipe zapi-group, repositorio Gebelson/zapitv, production branch main, raiz do repositorio, Node 24.x. Vercel Authentication configurada como all_except_custom_domains. Leitura de metadados de variaveis: Production separado por target; credenciais Turso Preview existentes restritas a codex/p4-b-3-remote-validation-20261028, nao a branch P0. Nenhuma credencial Production copiada. Nenhuma variavel remota criada/alterada.

Preflight Turso remoto somente leitura: host staging esperado confirmado, distinto da referencia Production salva; revisao previa de isolamento registrada. 21 tabelas, 7 migracoes aplicadas, ledger consistente com prefixo local, 1475 ms, zero escritas. Tabelas users/sessions/profiles presentes. Repo tem 8 migracoes: falta 0007_password_recovery e tabela password_reset_tokens. Nenhuma migracao foi aplicada; isso limita homologacao completa de recuperacao de senha. A excecao de seguranca conhecida do token staging exposto anteriormente nao foi removida nem declarada resolvida.

**ISOLAMENTO TOTAL DO PREVIEW: NAO APROVADO. DEPLOYMENT NAO CRIADO.**

Bloqueio demonstrado: firebase.ts importa firebase-applet-config.json e inicializa Firestore com configuracao fixa, sem selecao de ambiente. Esses arquivos e App.tsx sao identicos aos de 70b509d. App.tsx:2152-2155 grava usuarios nesse Firestore; outros handlers gravam content, keyValueStore, customSections e notifications. Nao foi identificado um destino Firebase/Firestore exclusivo de staging nem demonstrado bloqueio confiavel dessas gravacoes no Preview. Separar somente Turso nao garante ausencia de escrita no servico compartilhado. Regras remotas Firestore nao foram alteradas nem presumidas seguras.

Preview URL: inexistente nesta execucao. Autenticacao HTTPS, Argon2id no deployment, acesso administrativo real, protecao de visitantes/usuarios e telemetria serverless autenticada: BLOQUEADOS pelo gate de isolamento, nao aprovados por fixtures.

## Provedores - sondagens reais somente leitura

Referencia consultada: A Noite dos Mortos-Vivos (1968), movie IMDb tt0063350. GETs publicos de metadados via publicHttpGet, sem credenciais e sem contornar restricoes. Rede Node local, nao a origem Vercel nem navegador autenticado.

| Provedor | Budget do ensaio | Resultado | Duracao |
|---|---:|---|---:|
| froststream-http stream | 7000 ms | HTTP 403, MIME OTHER; fontes nao observadas | 57 ms |
| fenixflix-animes stream | 4500 ms | abort por limite | 4511 ms |
| fenixflix-animes stream subsequente | 6500 ms | HTTP 200 JSON, streams: [] | 2294 ms |

O segundo ensaio Fenix nao prova que aumentar o timeout causou a resposta mais rapida; sao tentativas distintas em rede variavel. Nao marcar provedores permanentemente offline por isso. Manifestos validos observados antes em Torrentio/Cinemeta/Fenix nao provam video reproduzivel. O 403 Frost e uma restricao de acesso observada: a causa/politica interna do servico nao e conhecida e nao foi contornada.

## Comparacao de repeticao

Regressoes controladas, agora aprovadas tambem na CI Linux: fallback iniciado depois de budget expirado, 2 -> 1 tentativas; provider com primeiro ID ja consumindo budget, 3 -> 1 chamadas logicas getStreams. Nenhum percentual de reducao em Production foi medido. Os numeros preservados da coleta autenticada anterior nao sao totais e nao foram retroativamente atribuidos a provedores.

## Estado do P0 e proxima acao

P0 permanece ABERTO. Nao houve descoberta -> selecao -> frames da obra real em Preview. A primeira barreira desta etapa de homologacao e o isolamento incompleto do Firestore; antes houve 401 esperado da API Production consultada sem sessao.

Antes de criar Preview: identificar/configurar destino Firebase/Firestore de homologacao ou demonstrar isolamento efetivo de todas as gravacoes compartilhadas; validar configuracao branch-specific Turso/ADMIN_USER_IDS sem identidades Production; tratar explicitamente a migracao 0007 se recuperacao de senha entrar no escopo. Nao provisionar bancos/projetos ou migrar sem autorizacao pertinente. Depois: deployment manual Preview protegido do commit aprovado, teste real de login/admin e tentativa integrada, correlacionando telemetria sanitizada e frames do conteudo principal apos repeticoes/cache. Production permanece intacta.
