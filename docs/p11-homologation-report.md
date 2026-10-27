# P1.1 — homologação local, 27/10/2026

**Decisão: P1 não está apto para liberação integral em produção.** Há evidências
positivas reais, mas a identidade audiovisual dos títulos e os idiomas não foram
confirmados por reprodução supervisionada. Existe divergência real de metadados
de idioma que precisa ser resolvida antes da liberação.

Base: `bcf1b1e`, descendente direto de `a875f30`. Branch de homologação:
`codex/p1-1-homologation-20261027`. Commit desta entrega informado na resposta final.
Árvore inicialmente limpa. Não houve merge, push, deploy ou alteração de código
de produção nesta etapa. O checkout utilizado é isolado do trabalho do Antigravity.

## Matriz por área

| Funcionalidade | Ambiente e evidência | Resultado | Pendências e risco para produção |
| --- | --- | --- | --- |
| P0: histórico, progresso, episódios, listas, favoritos, concorrência, migração e Continuar Assistindo | `test:storage-integrity` e `test:mobile-cw-dedup` no build; `test:storage-browser` com IndexedDB/localStorage reais, dados legados controlados, quota, concorrência e reload em três viewports. Nenhuma diferença P0→P1 nos módulos de armazenamento/sessão; handlers de listas não foram modificados pelo P1. | **Aprovada** para persistência local no ambiente exercitado. | Chromium mobile/TV são simulações. Não houve migração de dados pessoais reais. Bloqueio total/remoção dos dados do navegador continua sendo limitação do armazenamento local. |
| Identidade dos oito conteúdos | Busca real TMDB/Cinemeta, resolução dos IDs, descoberta pelos provedores já configurados e reavaliação dos metadados das candidatas. Nenhum VOD foi iniciado. Resident Evil 2026 permaneceu inelegível. | **Parcialmente validada**. | URLs e rótulos não comprovam os quadros do conteúdo. Não foi confirmada nem descartada por reprodução a antiga troca de vídeos. Risco alto para liberação. |
| Catálogo | Serviço real em Chromium, páginas 1–6 de cada categoria e filtro Drama; páginas reais desktop/mobile/TV. Queda de rede real com cache HTTP desativado: erro temporário e recuperação na mesma página 2 nas três categorias. | **Parcialmente validada**. | Avanço além de 56 demonstrado; fim completo de cada catálogo, todos os filtros/ordenações e aliases sem IMDb ainda não certificados. |
| Flags e informação de idioma | Respostas reais: Jimihen declara japonês/legendado e recebe `isPtBr=true`; Hope declara Legendado com a mesma flag; fontes coreanas de Chicago também chegam sinalizadas. | **Reprovada** quanto à confiabilidade dessa flag. | A linha `Boolean(s.isPtBr) || addon.isPtBr || ...` em `providerRegistry.ts` já existia em `a875f30`, sem modificação P1. É uma falha preexistente, não uma regressão demonstrada do P1. Esta etapa autoriza corrigir somente regressões do P1; nenhuma mudança de produção foi feita. |
| Seleção efetiva de PT-BR, idioma ouvido, áudio/legendas durante recuperação de VOD | Testes determinísticos de faixas passaram; canais públicos decodificaram áudio, sem audição. | **Não testável no ambiente disponível** para os títulos sem identidade/direitos de reprodução confirmados. | Faltam trilhas verificadas e audição, incluindo SAO e Bleach. A correção P1 de tracks HLS conhecidos não torna confiáveis os metadados de fontes sem tracks identificados. |
| Ao Vivo | TV Câmara e TV Senado reproduziram no `LiveTvPlayer` real. Troca pela mesma raiz React. Câmara também passou por 35s de rede offline e retomou sem interação após reconexão. | **Parcialmente validada**. | Amostras curtas de dois canais; faltam uso prolongado, todos os canais, troca rápida sob rede instável e dispositivos físicos. |
| Fire TV / Samsung | Aplicação real em Chromium, UA de cada aparelho, mesma viewport 960×540 e CPU 4×. Setas atingiram fileiras nas três categorias; nenhuma exceção JS. Ensaio controlado manteve 0 commits redundantes Fire TV e 24 Samsung. | **Parcialmente validada**. | Não são medições no hardware. Dispatch de tecla não é latência física. Foco vertical durante comandos/rolagens sobrepostos não foi certificado; FPS e vazamento de memória de longa duração não foram medidos. |
| Imagens e navegação | 12 combinações de categoria/interface sem exceções JS; cancelamento e nova decodificação real de Image passaram; teste existente de longevidade mostrou virtualização ativa. | **Parcialmente validada**. | Não comprovam ausência de piscadas no compositor Tizen/Silk nem minimizar/restaurar janelas físicas. |
| Build e contratos | `npm run build` aprovado, incluindo TypeScript/lint, estabilidade, P0/P1, API e Vite; lint final aprovado após inclusão dos ensaios. Browser P1, persistência, longevidade e Watch Party smoke aprovados. | **Aprovada** localmente. | Avisos de chunks grandes permanecem. CI remoto e Vercel não executados, pois não houve publicação. |
| Fire TV, Samsung/Tizen/MSX físicos | Nenhum aparelho ou interface de depuração física acessível nesta sessão. | **Não testável no ambiente disponível**. | Compatibilidade, áudio, FPS, controle remoto físico e estabilidade prolongada continuam abertos. |

## Casos reais: identidade e descoberta, sem reprodução VOD

Contagens são **candidatas processadas retornadas pelo registry**, não fontes com
reprodução confirmada. A reavaliação final de identidade aceitou seus metadados;
isso não contabiliza todos os descartes internos anteriores nem valida a mídia.

| Conteúdo | Identidade observada | Consulta | Candidatas / URLs / torrent | Estado |
| --- | --- | --- | --- | --- |
| Sussurros do Coração | TMDB 37797; IMDb tt0113824; 1995; anime em formato filme | Filme, sem episódio | 65 / 3 / 62 | Metadados e descoberta confirmados; vídeo não iniciado. |
| Lupin, série francesa | TMDB 96677; IMDb tt2531336; 2021 | Série, T1E1 | 87 / 5 / 82 | Idêntico ao registro correto; episódio e áudio reais pendentes. |
| Jimihen!! | TMDB 113360; IMDb tt13490144; 2021 | Anime, T1E1 | 1 / 1 / 0 | Rótulo japonês/legendado contradiz flag PT-BR. Nenhuma mídia potencialmente inadequada foi reproduzida. |
| Chicago Typewriter | TMDB 70528; IMDb tt6516076; 2017 | Série, T1E1 | 15 / 0 / 15 | Nenhum torrent foi iniciado. Idioma não comprovado. |
| Resident Evil, regressão 2026 | TMDB 1423191; IMDb tt35538033 | Filme | Não consultadas após inelegibilidade | Bloqueio existente preservado; nenhuma substituição por animação. A franquia possui outras obras, não intercambiáveis. |
| Hope: O Primeiro Impacto | TMDB 1058424; IMDb tt27369017; 2026 | Filme | 115 / 4 / 111 | Nenhuma URL opaca ou mídia de risco foi reproduzida. Identidade visual e idioma pendentes. |
| Sword Art Online | TMDB 45782; IMDb tt2250192; 2012 | Anime, T1E1 | 99 / 15 / 84 | Alias TMDB/IMDb resolvido por detalhes reais. PT-BR é declaração do provedor, não audição confirmada. |
| Bleach: Thousand-Year Blood War | IMDb tt14986406; 2022 | Anime, T1E1 | 66 / 0 / 66 | Consulta por IMDb preservada; não foi confundido com o Bleach original. Reprodução e idioma pendentes. |

As respostas variam no tempo. Houve timeouts/erros de provedores em algumas
consultas, preservando as candidatas positivas dos outros. Não foi declarada
indisponibilidade definitiva de qualquer provedor.

## Catálogo e interfaces reais

| Categoria | Itens nas páginas 1–6 | União sem repetição pelas chaves disponíveis | Drama, página 1 | Último resultado alcançado? |
| --- | --- | ---: | ---: | --- |
| Filmes | 75, 36, 37, 20, 19, 19 | 174 | 62 | Não; `hasMore=true`. |
| Séries | 66, 20, 19, 19, 18, 17 | 131 | 67 | Não; `hasMore=true`. |
| Animes | 56, 59, 60, 58, 60, 58 | 299 | 19 | Não; `hasMore=true`. |

Não foram utilizados os totais estimados/fixos da interface como prova de tamanho
do catálogo. Aliases ainda sem correspondência canônica completa podem coexistir;
a busca de SAO retornou IDs TMDB e IMDb para a mesma série, conciliados no ensaio
de identidade por consulta aos detalhes. Não foi certificada ausência global de
duplicatas em todo o catálogo externo.

Desktop 1440×900 e mobile Chromium 390×844 percorreram oito passos de rolagem por
categoria. A quantidade de imagens montadas variou no desktop (26 inicialmente;
36/24/41 após rolagem). Mobile apresentou 228/92/117 imagens nas respectivas páginas;
esses números são DOM observado, não quantidade total de títulos. As duas TVs
simuladas abriram as três rotas, receberam setas e atingiram as fileiras. Todas as
12 combinações terminaram sem `pageerror`.

O teste existente `test:catalog-longevity` passou: pico de 42 cards montados, 991 nós
e snapshot de heap de 31,57 MB no retorno ao topo; repouso de 5s sem novas
requisições. Não é prova de ausência de vazamento durante horas. Nos ensaios da
aplicação TV real, snapshots de heap ficaram aproximadamente entre 37 e 68 MB;
medianas do round-trip de dispatch ficaram entre 39 e 59 ms, incluindo automação.
Não foram interpretadas como FPS, latência do controle físico ou comparação causal
antes/depois. O ganho causal medido continua restrito aos resizes redundantes.

## Reprodução pública observada

- TV Câmara: 1920×1080, 479 quadros adicionais em 16,00s, 4 descartados acumulados,
  `readyState=4`, sem erro de mídia. Áudio decodificado; execução mutada.
- TV Senado: 870×480 efetivos, 480 quadros adicionais em 16,00s, zero descartados,
  `readyState=4`, sem erro. O cadastro anuncia 720p, mas a amostra real foi 480p;
  não foi simulada uma resolução maior. Áudio decodificado; execução mutada.
- Câmara sob falha: depois de 20s iniciais, rede offline por 35s. Buffer esgotou e
  houve espera de aproximadamente **6,62s**. Retomada automática após reconexão,
  sem erro fatal registrado; tempo 155,90 → 185,45 → 201,47 e quadros
  1437 → 2325 → 2805. Os últimos 16s avançaram continuamente. Sem retorno a zero
  ou regressão do tempo nos checkpoints. Isso não certifica continuidade por horas.
- Catálogo offline: as três consultas da página 2 falharam temporariamente;
  após reconectar retornaram 36 filmes, 20 séries e 59 animes, `hasMore=true`,
  sem resposta parcial. Não houve migração/gravação de progresso real.

## Alterações e reprodução dos ensaios

Somente testes/evidências/documentação foram alterados:

- `tests/p1_tv_performance_browser.test.ts`: aguardava apenas 400ms e podia enviar
  Enter antes da transição/commit React com CPU reduzida. Agora espera foco,
  início/fim da transição e frames de commit, verificando o título exato em cada
  passo. Watcher desativado no servidor isolado para impedir reload por artefatos
  concorrentes de build. Assertivas foram fortalecidas, não removidas.
- `tests/p11_external_homologation.test.ts`: metadados/descoberta externos seguros,
  catálogo e dois canais públicos; sem VOD automático.
- `tests/p11_app_navigation.test.ts`: aplicação real, viewports, teclas, DOM e heap.
- `tests/p11_network_recovery.test.ts`: queda/reconexão de rede real, catálogo e canal.
- JSONs sanitizados nesta pasta: `p11-external-evidence.json`,
  `p11-navigation-evidence.json`, `p11-network-evidence.json`. Não contêm URLs de
  fontes, hashes de torrents, credenciais ou dados pessoais.

Com o servidor local já iniciado por `npm run dev`, executar os novos scripts com
`node --import tsx tests/<arquivo>.test.ts`. São ensaios externos opt-in: código 0
significa que a coleta terminou; o conteúdo do relatório determina a aprovação.
Não fazem parte do build determinístico nem tornam a Vercel dependente de terceiros.
As opções `P11_SKIP_CATALOG`, `P11_SKIP_LIVE`, `P11_ONLY_TITLE` e `P11_TV_ONLY`
permitem repetir somente a fase necessária, preservando as outras observações.

Também executados: `npm run build`, `npm run lint`, `npm run test:storage-browser`,
`npm run test:p1-browser`, `npm run test:catalog-longevity` e
`npm run test:watchparty-smoke`. Todos aprovados ao final. TypeScript é o lint
existente do projeto. O build já inclui estabilidade e testes P0/P1, sem repeti-los
separadamente. A smoke de Grupo abriu/fechou o modal, sem participantes reais.

Não foi encontrada regressão de produção comprovadamente introduzida pelo P1.
Foi corrigida a sincronização insuficiente de seu teste de navegação. Nenhum código
do armazenamento, catálogo, player, layout ou provedores foi alterado nesta etapa.

## Bloqueios para liberação

1. Corrigir a propagação comprovadamente indevida de flags PT-BR e validar tracks/
   idioma real. Esta falha antecede P1 e permanece aberta nesta homologação.
2. Confirmar de forma supervisionada a mídia/episódio dos títulos, quando houver
   acesso autorizado; nunca liberar uma URL apenas pelo nome declarado.
3. Certificar paginação até o EOF real e ordenações/filtros completos, inclusive
   aliases duplicados, nas três interfaces.
4. Validar Fire TV e Samsung Tizen/MSX reais: foco durante rolagens, menus, áudio,
   composição gráfica, recuperação e sessões prolongadas de memória/reprodução.
5. Ampliar a amostra de Ao Vivo e a duração dos ensaios, mantendo estados honestos
   de indisponibilidade e reconexão limitada.
