# P0 — seis fluxos: implementação e evidências

Branch: `codex/p0-six-flows-20261029`. Alterações locais; sem push, merge em main ou deployment.

## Publicação e cache verificados

- Production: `f753c3be343209356ff078ac41278c4dbf9b33be`, deployment `dpl_82qb8p8AZuc9AtRseSxDxKMcgt19`, main.
- Preview: `fbcb53ba9c7b93248f277c015d1d201f120fd844`, deployment `dpl_CEtmqLaTQLUEu96rc6fKaCLtjkJ4`, branch `codex/p4-d-mandatory-auth-20261029`.
- Production entrega `index-cgsUSOHO.js`, SW `c274853e9221`, 38 assets. Preview entrega `index-Dt6YBlHm.js`, SW `f0b5a11e42b1`, 37 assets.
- Production respondeu HTTP 200 para shell, SW e manifesto, com `max-age=0, must-revalidate`. Preview lido com autorização da CLI Vercel.
- O código de autenticação obrigatória/ativação guiada do Preview não estava na mesma versão de Production. Os dois conjuntos foram integrados nesta branch isolada.
- Um teste do caminho real do QR comprovou que `/tv/ativar?code=...` era capturado pelo prefixo genérico `/tv` e abria a TV no celular. A rota de aprovação agora fica fora do shell TV e preserva o código durante login/F5.
- O SW utiliza versão do shell, instalação completa antes de ativar e não cacheia APIs. Não foi inspecionado cache de um aparelho real; não há prova de que MSX/PWA físicos estejam atualizados.

## Causas e correções

| Área | Causa observada | Correção e estado |
|---|---|---|
| TV | Estado local/retorno do QR podia liberar interface sem nova confirmação de sessão; seleção local mascarava erro da API; `App` e `TvApp` montavam dois desafios QR simultâneos, reproduzidos no navegador | Ativação pertence somente ao `TvApp`; `/auth/me` confirma QR e restauração; perfil só é aceito após confirmação; erros permitem tentar novamente. Backend remoto validado; TV física **BLOQUEADA** por indisponibilidade do aparelho. |
| Mobile | Scroll manual concorria com inércia nativa e `scroll-smooth`; Top 10 bloqueava gesto vertical e mantinha timer para arrasto | Trilhos nativos, observação de movimento sem controlar scrollLeft, prevenção de clique após arrasto; Top 10 permite gesto vertical e não mantém timer de reset. Chromium com toque em 360/390/430; Safari/Android físicos não verificados. |
| Catálogo | Cursor TV calculado por quantidade/20 apesar de lotes variáveis; categorias reintroduziam itens antes da elegibilidade | Cursor real da descoberta e deduplicação; categorias, tendência e listas usam catálogo elegível. Comparação automatizada dos pipelines reais abaixo; inventário remoto integral **não homologado**. |
| Admin | Autoridade por e-mail e dados locais/legados; snapshots Firebase podiam substituir a identidade confirmada | Papéis de conta vêm do backend por `ADMIN_USER_IDS`; legado Firebase continua exigindo UID realmente verificado. Snapshots não substituem sessão/perfis Turso. Visitante/comum negados e admin por UID permitido no backend de staging. |
| Continuidade | Hidratações tardias de conta/perfil anterior; pull antes de flush; TV memo sem revisão e limiar exclusivo de 2%; recomendações mobile criavam membros falsos; Firebase account-wide sobrescrevia listas de perfil | Cercas por geração/escopo/revisão, flush compartilhado antes de pull, versões remotas e tombstones preservados, eventos após persistência, refresh leve existente de 30s/foco/online, listas e progresso reativos. PC/mobile/TV usam a mesma regra de participação e ordenação. Backend remoto entre sessões aprovado; Home de dois dispositivos físicos **não homologada**. |
| Auth obrigatório | Versão não publicada; inicialização confiava em flag local; modal não confinava foco e permitia conteúdo de fundo receber teclado | Estado inicial não autenticado, política/backend existentes preservados, distinção entre indisponibilidade e sessão encerrada, invalidação de resposta anterior a logout, fundo inert + fallback de foco + Tab confinado + mídia de fundo pausada. App `/` e `/tv` testados após F5 em Chromium com API controlada. |

## Catálogo: comparação reproduzível

Mesma entrada: **173 títulos reais incluídos no projeto + 660 fixtures determinísticas**. Serviços reais de elegibilidade, deduplicação, classificação e callbacks de cada plataforma. As fixtures não representam inventário remoto.

| Categoria | PC | Mobile | TV | IDs exclusivos PC/TV |
|---|---:|---:|---:|---|
| Filmes | 346 | 346 | 346 | Nenhum |
| Séries | 253 | 253 | 253 | Nenhum |
| Animes | 234 | 234 | 234 | Nenhum |

Contagens não devem ser somadas como inventário único, pois regras de categoria podem se sobrepor. Paginação testada com lotes variáveis e mais de 200 resultados por categoria. Não foi feita varredura autenticada integral do catálogo externo em três dispositivos.

## Turso remoto: testes realmente executados

Destino exclusivamente `gebelson/zapitv-staging-db`. Endpoints privados comparados com referência de produção: distintos; staging com 7 migrações, produção com 8. Nenhuma variável Vercel foi alterada. O processo de testes recebeu somente credenciais staging, sem herdar credenciais ou permissões Production.

O usuário autorizou reutilizar a credencial staging anteriormente exposta. Essa exceção continua registrada; não equivale a rotação ou aprovação de segurança da credencial.

Preflight somente leitura confirmou hashes do ledger 0000–0006 e colunas requeridas. Migração 0007 de recuperação de senha ausente no staging; nenhuma migração executada e nenhuma aprovação integral do schema declarada.

Execução `2b4dfb1c-15ed-436d-a59a-c4051def78af`: Express real + Turso remoto, sessões HTTP independentes, seis grupos aprovados:

1. Política obrigatória, bloqueio de streaming e exceções públicas.
2. Cadastro, login por senha, logout e sessão real persistida no banco.
3. QR criado, login móvel, aprovação autenticada, poll TV, sessão independente e consumo único.
4. Perfis criados/editados/selecionados, progresso PC→TV, isolamento entre contas/perfis.
5. Admin por UID, e-mail sem privilégio, diagnóstico negado aos demais.
6. Mutação sem sessão/de outra conta recusada sem alterar progresso nem reservar UUID.

Limpeza por UUID/contas da execução confirmada. Sem usuários reais, DDL, escrita global, migrações ou escrita Production. Não foram coletadas latências por endpoint nem métricas do painel; não se afirma ganho de desempenho.

## Verificação e limites

- `npm run test:six-flows`: **19 testes aprovados**, classes reais de armazenamento/fila, falhas de transporte, respostas atrasadas, A→B→A, tombstones, conflitos e isolamento; guarda de execução remota e pipelines de catálogo.
- `npm run test:six-flows-browser`: componentes reais e App no Chrome headless, entrada de toque nativa via CDP, modal/foco/teclado, QR sem sessão recusado, sessão confirmada aceita, `/`, `/tv` e `/tv/ativar` após F5. O login inline preservou o desafio e não aprovou a TV automaticamente; clique explícito enviou uma única aprovação com o código original. HTTP de navegador é controlado; não é homologação HTTPS/Turso pela UI.
- `npm run lint`: aprovado, executa TypeScript.
- `npm run build`: aprovado, incluindo estabilidade, API e Vite. Primeiro build encontrou teste antigo que exigia `scroll-smooth`; contrato atualizado para inércia nativa e cobertura comportamental preservada. Avisos de chunks grandes permanecem, sem ampliar escopo.
- Registros gerados pelos testes de ranking e bundle de API não foram incluídos como alterações funcionais.

| Cenário | Evidência | Classificação |
|---|---|---|
| A/B/K: bloqueio, QR e F5 | App Chromium com backend controlado; sessão também verificada por HTTP remoto | Parcialmente validado |
| C: aprovar TV, perfil e reinício físico | QR/perfil/sessões HTTP reais; UI de ativação testada separadamente | **BLOQUEADO** para reinício em TV real |
| D: arrasto mobile | Toque nativo em dois trilhos e três larguras no Chromium | Validado no ambiente simulado; aparelhos pendentes |
| E: catálogo equivalente | Pipelines reais com entrada comum e IDs comparados | Parcial: inventário externo integral pendente |
| F/G: diagnóstico | Backend remoto negou visitante/comum e aceitou UID autorizado; identidade legada sem autoridade de sessão | Backend validado; conta admin Production não alterada |
| H: episódio/posição entre sessões | HTTP real PC→TV no Turso staging | Backend validado; reprodução física pendente |
| I: Home aberta recebe progresso | Testes reativos de armazenamento e heartbeat existente de 30s/foco/online | Parcial; dois dispositivos reais pendentes |
| J: troca de conta/perfil | Escopos reais de armazenamento + isolamento HTTP remoto | Validado nesses ambientes |
| L: falha temporária/offline | Transporte, fila persistente, conflitos e respostas tardias locais/controlados | Parcial; interrupção física de rede/banco não executada |

Não há homologação final dos seis fluxos em dispositivos físicos nem liberação Production nesta entrega. Código corrigido e testes aprovados não significam que o site publicado já recebeu as mudanças.

## Arquivos

- Integração/sessão: `App.tsx`, `components/ProfileSelectorView.tsx`, `components/TvActivationView.tsx`, `src/core/auth/authClient.ts`, `src/core/auth/authSyncService.ts`, `src/components/auth/MandatoryAuthModal.tsx`, `src/components/tv/TvActivationScreen.tsx`.
- TV/mobile/catálogo: `src/pages/tv/TvApp.tsx`, `src/components/tv/TvHomeView.tsx`, `src/components/mobile/MobileContentRow.tsx`, `MobileRankedRow.tsx`, `MobileHomeView.tsx`.
- Persistência: `src/core/storage/storageService.ts`, `watchState.ts`, `src/core/sync/syncQueue.ts`.
- Integração das correções já publicadas: `components/AdminView.tsx`, `server.ts`, `src/core/admin/adminAccountsClient.ts`, `globalSettingsClient.ts`, `src/server/auth/adminAccess.ts`, `authMiddleware.ts`, `routes.ts`, `src/server/database/firebaseAuth.ts`, `routes.ts`.
- Testes/scripts: `tests/auth_session_transport.test.ts`, `progress_scope_isolation.test.ts`, `six_flows_browser.test.ts`, `six_flows_staging_guard.test.ts`, `tv_session_catalog_p0.test.ts`, `account_admin_access.test.ts`, `tv_incognito_bootstrap_and_resilience.test.ts`, contratos mobile de transição/Top 10, `scripts/six_flows_staging_acceptance.ts`, `package.json`.

Player, fontes, catálogo mestre, layout e dados reais não foram alterados.
