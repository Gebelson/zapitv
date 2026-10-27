# P1 — estabilidade e integridade (2026-10-27)

Base confirmada: `a875f30`, branch P0 `codex/data-integrity-20261027`.
Trabalho: `codex/p1-stability-20261027`. Commit final informado na entrega.
Não houve push, deploy, migração de dados reais, criação de contas ou contratação de serviços.

## Resultados por grupo

| Grupo | Causa comprovada e correção | Testes e resultado | Classificação |
| --- | --- | --- | --- |
| A — fontes | Fontes locais escolhiam episódios apenas pelo número e presumiam T1. Agora selecionam temporada + episódio, aceitam T0 e recusam duplicatas com URLs conflitantes. A validação também verifica tags no nome da fonte e não ignora T0. URLs completas, inclusive proxy com URL codificada, foram removidas dos diagnósticos de identidade; logs de quarentena e Ao Vivo foram sanitizados. | `p1_source_integrity`, `canonical_title_matching_integrity`, `playback_canonical_identity_and_resilience`, `resident_evil_2026_temporary_lock`: passaram com fixtures. | **Corrigido e testado**, para as falhas internas demonstradas. Reprodução dos títulos reais permanece pendente. |
| B — catálogo | Cache global de deduplicação omitia itens já vistos em outra consulta/filtro. Respostas vazias por erro viravam fim de catálogo e cursores avançavam antes da confirmação. Agora cada consulta retorna seus itens; erro temporário mantém a página; resultados parciais são preservados e não viram cache completo. Há cooldown e limite de três falhas automáticas no desktop/mobile; o botão existente permite nova tentativa manual. Categorias da TV não pediam páginas novas ao alcançar o fim: foram ligadas ao serviço existente, com cursor por categoria e navegação circular preservada. Animes não cobertos pelas fileiras editoriais ficam acessíveis pela fileira existente de todos os animes; o foco do fallback foi corrigido. | `p1_catalog_recovery`: 80 itens controlados por categoria, filtros, começo/meio/fim, repetição de consulta, falha e retomada, resposta parcial, concorrência e EOF. `catalog_infinite_scroll_and_virtualization`: passou. Navegação remota atingiu o callback de paginação em Chromium. | **Corrigido e testado** com dados controlados. Catálogo externo completo e TV física não foram certificados. |
| C — Fire TV | Geometria idêntica criava novo estado React a cada resize; o serviço de viewport notificava todos os consumidores sem mudança de medidas. Ambos os caminhos agora ignoram valores iguais exclusivamente quando o dispositivo é identificado como Fire TV. | Ensaio comparativo abaixo; setas, Enter e solicitação de próxima página passaram. Testes de proporção/isolamento Fire TV e interfaces TV passaram. | **Corrigido, mas pendente de validação física**. |
| D — áudio/player | Regex local ignorava `pt-BR` explícito e podia escolher uma faixa inglesa chamada “Original” ao procurar japonês; rótulo Português podia sobrepor código `pt-PT`. A seleção agora usa a normalização existente e códigos regionais. Faixa de uma fonte anterior deixa de ser reaproveitada pelo mesmo índice em outra fonte. Manifesto conhecido de faixa única prevalece sobre selo do addon para o idioma atual, preservando fontes alternativas. Ausência comprovada de PT-BR aciona o aviso existente; idioma desconhecido continua inconclusivo. A legenda automática considera a faixa HLS selecionada. | `p1_audio_track_identity`, `anime_ptbr_audio_selection_and_fallback`, `tv_buffering_policy`, `firetv_performance_and_playback`: passaram. Políticas de espera, recuperação limitada e fallback preservadas. `watchparty-smoke` abriu/fechou Grupo na aplicação sem tela branca. | **Corrigido, mas pendente de validação física** para seleção de faixas. Buffering dos títulos reais continua **ainda pendente**. |
| E — Ao Vivo | Redirecionamento era agendado durante render, repetindo ações a cada atualização. Outros timers de fallback sobreviviam à sessão e podiam executar navegação antiga após sair/trocar canal. Agora são rastreados, cancelados no cleanup e vinculados à geração da reprodução. Acesso externo não inicia um decoder antes do redirecionamento existente. | `p1_live_lifecycle_browser`: quinze rerenders não duplicaram a troca, desmontagem cancelou ação pendente e não houve requisição de mídia restrita. `livetv_stability_and_playback_suite`: passou. | **Corrigido e testado** para o ciclo de vida. Estabilidade das transmissões reais: **ainda pendente**. |
| F — imagens | Abort de navegação marcava uma imagem como falha por dez minutos. O mobile fazia uma segunda carga sem timeout/cancelamento. Agora abort libera a requisição sem negativar a URL, e o banner reutiliza o carregamento compartilhado. Callback antigo de erro não pode aplicar seu fallback ao slide novo. | `p1_image_abort`: cancelamento, cleanup, nova tentativa e timeout real passaram. Chromium decodificou a imagem após cancelamento. Testes existentes de ghosting mobile e prevenção de flash branco passaram. | **Corrigido e testado** para o carregamento. Flash branco ao restaurar janela e artefatos GPU físicos: **não reproduzidos** nesta investigação. |

“Corrigido e testado” descreve os defeitos internos que os testes efetivamente exercitam.
Não significa que todos os conteúdos/canais externos passaram a reproduzir.

## Conteúdos e idiomas citados

- Sussurros do Coração → The Cazalets, Jimihen!! → Raven of the Inner Palace,
  Chicago Typewriter → Chicago e Resident Evil → animação: as associações incorretas
  foram recusadas pelas fixtures existentes de identidade/colisão; não reproduzidas
  nesses testes. Não foi feita uma nova auditoria quadro a quadro dos títulos reais.
- Hope: O Primeiro Impacto: o identificador anteriormente colocado em quarentena
  foi recusado no teste; nenhuma fonte adulta foi reproduzida.
- Sword Art Online, Bleach e Avatar: Os Sete Refúgios: não há confirmação nova de
  reprodução, duração contínua ou dublagem real nesta entrega. As correções são do
  mecanismo de seleção e veracidade dos metadados disponíveis. Verificar cada fonte
  autorizada, episódio e engine no aparelho continua pendente.
- URLs opacas com rótulo correto ainda exigem confirmação da origem ou inspeção do
  conteúdo. Não foram declaradas corretas apenas por retornar uma URL/HTTP 200.
- Não foi demonstrada indisponibilidade definitiva de nenhum provedor externo;
  tampouco foi atribuída a ele uma falha sem teste correspondente.

## Comparação medida de renderização

Chromium, viewport **960×540**, CPU reduzida em **4×** via CDP, mesma fileira real de
40 itens controlados, mesmo SVG e sequência de **20 resize events sem alterar o tamanho**.
React Profiler contou commits e soma de tempo de render; não mediu o decoder.

| Ambiente simulado | Commits antes | Commits depois | Tempo React antes/depois | DOM antes/depois |
| --- | ---: | ---: | --- | --- |
| Fire TV / Silk UA | 24 | 0 | 39,5 ms / 0 ms para esse trabalho redundante | 123 / 123 |
| Samsung / Tizen UA | 24 | 23 | 34,7 ms / 36,2 ms | 123 / 123 |

Uma repetição final manteve Fire TV em zero commits e Samsung em 24. A pequena
variação de tempo/commits no controle Samsung não é ganho ou regressão comprovada.
Setas Esquerda/Direita, Enter e chegada ao fim da fileira foram exercitados pelo
Playwright em ambos. Esses resultados não são uma medição de FPS, latência total,
memória de longo prazo nem desempenho de uma Fire TV ou Samsung física.

## Arquivos de produção modificados

- Identidade: `src/core/providers/providerRegistry.ts`,
  `src/core/identity/sourceConfidenceEngine.ts`,
  `src/core/security/streamQuarantineService.ts`.
- Paginação: `App.tsx`, `src/core/catalog/CatalogDiscoveryService.ts`,
  `src/core/catalog/catalogPaginationSession.ts`, `src/core/tmdb/tmdbClient.ts`,
  `src/pages/tv/TvApp.tsx`, `src/components/tv/TvCategoryView.tsx`,
  `src/components/tv/TvAnimeView.tsx` e callback em `TvContentRow.tsx`.
- Fire TV: `src/components/tv/TvContentRow.tsx`, `src/core/tv/tvViewportService.ts`.
- Áudio: `src/core/audio/audioSelectionManager.ts`, `src/components/player/ZapiPlayer.tsx`.
- Ao Vivo: `src/components/livetv/LiveTvPlayer.tsx`.
- Imagens: `src/core/catalog/heroImageService.ts`, `src/components/mobile/MobileHero.tsx`.
- Verificação: scripts em `package.json`, `.github/workflows/quality.yml`, testes
  `tests/p1_*.test.ts`, fixtures `tests/harness/p1_*` e ajuste do teste antigo que
  exigia `new Image()` no componente em vez do serviço compartilhado.

Não houve alteração de CSS global, dimensões, cores, gradientes, enquadramentos,
HUD Ao Vivo, motor HLS, codecs, provedores configurados ou esquema P0 de persistência.
A fileira adicional de todos os animes só aparece quando há títulos elegíveis que
as fileiras editoriais não cobrem; usa o componente e o estilo existentes.

## P0 e validação final

- Ancestralidade de `a875f30` confirmada; nenhum arquivo de armazenamento do P0 foi alterado.
- `test:storage-integrity`, `test:storage-browser` e regressão existente de
  Continuar Assistindo: passaram. Browser de persistência usa IndexedDB/localStorage
  reais de contextos descartáveis em viewports desktop, mobile e TV.
- `npm run build`: aprovado (código 0), incluindo TypeScript/lint, `test:stability`,
  `test:p1-stability`, build da API e Vite. Permanecem avisos de chunks grandes;
  não houve erro de compilação. `npm run test:p1-browser`: aprovado.
- `test:watchparty-smoke`: passou contra servidor local em `localhost:4000`; o
  servidor de teste foi encerrado. Não houve criação de sala com participantes reais.
- Testes de navegador ficam no CI após instalar Chromium; o build de produção
  continua contendo verificações determinísticas, sem depender de Chromium na Vercel.
- CI remoto e produção não foram executados nesta entrega sem publicação.

## Pendências objetivas

1. Reprodução principal contínua de cada título citado, episódio, áudio, seek e
   retomada com fontes autorizadas: ainda não confirmada.
2. HLS nativo e seleção efetiva de faixas nas APIs oferecidas por Tizen/MSX:
   dependem da validação no aparelho; não se presumiu disponibilidade de AVPlay.
3. Canais reais sob queda de rede, 403/404/429/5xx e sessão prolongada: não certificados
   pelas fixtures de ciclo de vida e validação de fontes.
4. Memória e fluidez após uso prolongado em Fire TV, além de menus, busca e navegação
   entre todas as categorias reais: ainda precisam de medição física.
5. Catálogo real completo por filtro em desktop/mobile/TV: os testes controlados
   demonstram o cursor e a disponibilidade dos itens; não certificam todos os registros
   de terceiros ou todos os gestos de rolagem em cada navegador/dispositivo.
6. Minimizar/restaurar janelas e composição de banners no Tizen/MSX: não reproduzidos
   diretamente. Testes estruturais de flash branco não equivalem a esse teste físico.
