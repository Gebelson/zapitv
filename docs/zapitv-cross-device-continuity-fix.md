# P0 — Continuidade entre dispositivos

## Estado e escopo

- Base confirmada: `5c3c178` (também `origin/main` no início), contendo `2117bf7` e as correções posteriores de transporte/CI.
- Branch: `codex/p0-cross-device-continuity-20261030`.
- Árvore limpa antes das alterações. Trabalho de outros checkouts preservado.
- Sem push, merge, deploy, alteração de credenciais ou migração remota. A versão publicada não contém estas alterações locais.
- Homologação funcional controlada e Turso staging: resultados abaixo. **Hardware físico e Preview HTTPS deste código não homologados.**

## Causas comprovadas e correções

| Causa | Correção |
|---|---|
| TV enumerava progresso somente a partir de `allContent`; Histórico e Minha Lista faziam interseção com o catálogo | `ProfileContinuityService` e `useProfileContinuity` obtêm a participação dos registros persistidos; catálogo apenas enriquece. TV aplica o limite de 15 depois da seleção. |
| Algoritmos distintos no desktop, Home mobile, Minha ZapiTV e TV | Todas essas superfícies consomem os seletores compartilhados. A curadoria desktop não remove continuidade por indisponibilidade transitória. Restrições de conteúdo continuam aplicadas; seleção não certifica reprodução. |
| Espalhamento de objetos apagava metadados; aliases mais recentes e incompletos substituíam dados bons | Precedência por campo: valores válidos enriquecem campos ausentes; título técnico, ano zero e imagem inválida não substituem dados confiáveis. Revisão, posição, temporada e episódio não são alterados pelo enriquecimento. |
| Histórico enviava somente `poster` | Seleção validada `poster`/`image`, reutilizando a lista de corrupção do PosterRecoveryService por módulo puro. |
| Tipos remotos `movie/series/anime` não eram aceitos pelo normalizador local | Normalização de leitura para os tipos existentes; sem mudar IDs/chaves remotas. |
| Busca da TV pesquisava somente o índice carregado | Resultado local imediato mais `searchService.search`, debounce de 300 ms, cancelamento e descarte de respostas antigas, perfil ativo, deduplicação tipada; janela incremental e D-Pad preservados. |
| Hidratação e respostas de metadados podiam terminar após mudança de escopo | Guardas por conta/perfil, geração e desmontagem. Estado `loading/synced/offline` exposto pelo seletor; eventos de armazenamento do escopo atual atualizam outras abas. Refresh remoto reaproveita o serviço existente de 30 s/foco/online. |

A recuperação usa identidade exata e tipo: catálogo canônico, TMDB, IMDb/Cinemeta e AniList existentes. Cache de metadados públicos limitado a 512 entradas, TTL positivo de 6 horas e negativo de 60 segundos, requisições simultâneas deduplicadas e concorrência máxima de 3. Não há consultas por frame nem novo polling. Catálogo e player não foram reescritos.

O histórico remoto sem progresso possui cache local próprio, versionado e isolado por conta/perfil (`zapitv_continuity_metadata_v1`). Não contém sessões ou segredos, não importa chaves anônimas e não altera formatos anteriores. Mutações pendentes, conflitos, UUIDs, tombstones e revisões permanecem na infraestrutura existente.

## Matriz dos cinco casos

| Caso | Identidade usada nos ensaios | Evidência |
|---|---|---|
| One Piece (1999) | IMDb `tt0388629`, série | Presença/ordem/episódio/progresso iguais nos três contextos controlados e nas sessões HTTP de staging. |
| Dark (2017) | IMDb `tt5753856`, série | Presente mesmo com catálogo mobile vazio/TV parcial; atualização de posição confirmada. |
| Doctor Who (1963) | TMDB **TV 121**, ID legado `tmdb-121` | Fixture tipada e consulta **real somente leitura** via `tmdbService.getDetails(121, SERIES, series)`: `Doctor Who`, 1963, imagem presente. Não é o registro de 2005. O serviço de enriquecimento completo também foi executado com consulta real: posição 123 s, T2/E4 e revisão 7 preservadas. |
| Lupin (2021) | IMDb `tt2531336`, série | Mesma participação nas listas e sessões controladas. Não foi executada reprodução do vídeo. |
| Quinto anime não informado | Fixture explicitamente sintética, categoria anime | Exercita a quinta participação e isolamento. A identidade do anime real do relato não foi fornecida; não foi inventada uma correspondência de catálogo. |

## Antes e depois

1. Testes novos inicialmente falharam ao substituir `Doctor Who` por `tmdb-121` e ao manter três registros em vez de dois para aliases equivalentes + filme distinto. Um teste adicional reproduziu perda de metadados em alias mais recente vazio. Todos passam após a correção.
2. Chromium, armazenamentos independentes: catálogos locais de **5 / 0 / 2** títulos produziram **5 / 5 / 5** itens de continuidade, com identidade, ordem e metadados iguais.
3. Posição remota de Dark atualizada para 420 s; gravação real pelo `storageService` offline em 600 s sobreviveu ao reload, permaneceu na fila e foi confirmada após reconexão. Os outros clientes recuperaram 600 s.
4. Troca para outra conta limpou a lista visível. Minha Lista da interface mobile própria também foi verificada sem catálogo carregado.
5. Busca remota da TV encontrou resultado ausente do catálogo local. Navegação de teclado executada sem mouse na TV.
6. Resultado final do ensaio: **17 pulls**, zero erros JavaScript. Isso mede o cenário controlado, não CPU/FPS de Fire TV físico.

## Testes e evidências

- `test:continuity`: 11 testes determinísticos, incluindo aliases tipados, Movie 121 versus TV 121, cache negativo, falha externa, concorrência máxima de 3, resposta obsoleta e preservação de progresso.
- `progress_scope_isolation.test.ts`: 13 testes da classe StorageService, incluindo escopos A/B, respostas fora de ordem, fila pendente, conflitos, revisão remota, imagem e histórico sem progresso.
- `test:continuity-browser`: componentes reais desktop/mobile/TV, StorageService, fila e cliente HTTP reais contra backend HTTP controlado. Playwright com contextos independentes. Não equivale a teste em dispositivo físico.
- `test:storage-browser`: aprovado em desktop, mobile e TV Chromium: migração com dados antigos, episódios, listas, quota e reload.
- `test:tv-perf`: 16 cenários existentes aprovados, sem alegar ganho medido em hardware.
- `test:mobile-ranked-stability`: aprovado; altura 203 px, deslocamento **8 px**, gestos nativos e retorno 1º → 10º → 1º. A asserção de CI foi mantida.
- `test:six-flows-browser`: aprovado; gestos nativos em 360/390/430 px, sessão da ativação TV e rotas reais App `/`, `/tv` e `/tv/ativar` após F5.
- `npm run build`: aprovado (Vite 9,66 s); após o ajuste do TTL de respostas incompletas, TypeScript e os 11 testes de continuidade passaram novamente e o bundle final Vite compilou em 9,06 s; inclui TypeScript (`lint`), estabilidade completa, API e Vite. Não foram removidas verificações.
- Workflow de qualidade passa a executar `test:continuity-browser` após instalar Chromium. Testes determinísticos novos entram em `test:stability`. **CI remoto não executado nesta branch sem push.**

### Turso remoto verdadeiro

Destino validado: organização `gebelson`, banco **`zapitv-staging-db`**, distinto da referência de produção; processo filho recebe apenas credenciais de staging por allowlist. Nenhum valor secreto é registrado.

Preflight somente leitura: **1.513 ms**, **21 tabelas**, **7 migrações**, ledger correspondente, nenhum campo/tabela exigido ausente. O repositório possui 8 migrações: **compatibilidade integral do schema continua não aprovada**; a migração adicional de recuperação de senha não foi aplicada nesta tarefa.

Ensaio remoto final: **28.178 ms**, sete grupos aprovados, execução `f2bc4dd1-39c5-4d9e-b708-bb08c82888d5`:

- Cadastro/login/logout e sessões reais.
- Aprovação QR pelo celular e sessão própria da TV.
- Perfis e bloqueio de acesso cruzado.
- Cinco registros reais no banco de progresso, histórico e Minha Lista, iguais em três sessões HTTP independentes.
- Permissões administrativas e recusa de mutações não autorizadas.
- Limpeza restrita aos dados fictícios da execução: **confirmada**.

O ensaio inicial da nova fase falhou por reutilizar uma sessão mobile que o teste anterior havia deliberadamente deslogado. O backend devolveu 401 corretamente. O harness foi corrigido para autenticar novamente essa sessão; antes de repetir no remoto, o mesmo fluxo passou no SQLite descartável. Os resultados locais não foram apresentados como resultados Turso. Não houve alteração da autenticação para fazer o teste passar. As execuções recusadas também confirmaram limpeza.

## Arquivos

Produção: `App.tsx`; `TvApp.tsx`; `TvHomeView.tsx`; `TvSearchView.tsx`; `MobileHomeView.tsx`; `MobileMyZapiView.tsx`; `storageService.ts`; `watchState.ts`; novos `ProfileContinuityService.ts`, `useProfileContinuity.ts`, `continuityMetadata.ts`; `editorialCuratorService.ts`; `PosterRecoveryService.ts` e módulo puro `posterValidation.ts`.

Validação: novos testes de continuidade unitário/browser; testes existentes de escopo, TV e deduplicação mobile atualizados para a arquitetura compartilhada; harness de staging; `package.json` e workflow de qualidade.

## Limitações e aprovação

- **BLOQUEADO para homologação física**: sem Samsung/Tizen/MSX, Fire TV, LG ou Android TV acessíveis nesta execução. Chromium não comprova esses aparelhos.
- **Não publicado/não testado em Preview HTTPS deste commit**: nenhum deploy autorizado nesta solicitação. Testes remotos executam o backend local contra Turso remoto; não são testes de runtime serverless Vercel.
- Metadados sem tipo confiável em listas legadas: um ID isolado `tmdb-121`, sem histórico/catálogo/tipo, é ambíguo entre filme e TV. O item é preservado em recuperação, sem escolher outra obra ou reescrever sua chave. IDs IMDb e canônicos tipados permitem recuperação exata. Não há migração destrutiva para tentar adivinhar essa informação.
- O índice remoto legado de progresso não inclui `content_type` na unicidade. Episódios normais distinguem-se por temporada/episódio; registros legados com mesmo ID não tipado e mesmos números ainda exigem análise de schema/migração autorizada para uma garantia global. Nenhuma chave existente foi alterada silenciosamente.
- O quinto anime real permanece não identificado. Fontes de vídeo/reprodução não foram alteradas nem homologadas por estes testes de dados.
- Não se declara cumprimento integral de todos os critérios em produção/hardware enquanto essas pendências existirem.

## Publicação e recuperação

Após revisão, completar o schema staging por procedimento separado autorizado e validar Preview HTTPS e aparelhos reais antes de liberar. Publicar somente com autorização explícita, CI aprovado e comparação das listas do mesmo perfil.

Rollback de código: reverter os commits desta branch de forma revisada, preservando alterações posteriores. Não limpar históricos, filas, IndexedDB ou localStorage. O cache adicional de metadados pode permanecer: versões anteriores o ignoram; dados antigos e seus backups não foram removidos. Não há rollback SQL nesta entrega, pois não houve migração de aplicação.
