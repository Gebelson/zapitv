# Baseline técnico — 2026-11-05

Base 70b509d. Árvore inicial limpa. React/Vite/TypeScript, Express empacotado por esbuild em api/index.mjs; Drizzle/libSQL, sessões próprias e fila offline. Não foram lidas credenciais nem executadas escritas remotas.

| Módulo | Linhas | Imports resolvidos |
|---|---:|---:|
| `App.tsx` | 3415 | 74 |
| `src/pages/tv/TvApp.tsx` | 1098 | 44 |
| `components/ContentDetailModal.tsx` | 1649 | 35 |
| `src/components/player/ZapiPlayer.tsx` | 6178 | 47 |
| `src/core/providers/providerRegistry.ts` | 1874 | 24 |
| `src/core/providers/sourceVerificationService.ts` | 668 | 9 |
| `src/core/providers/streamValidator.ts` | 796 | 7 |
| `src/core/providers/sourceReadiness.ts` | 251 | 2 |
| `src/core/providers/mediaSourceValidationService.ts` | 552 | 8 |
| `src/core/stremio/stremioClient.ts` | 523 | 1 |
| `src/core/identity/sourceConfidenceEngine.ts` | 614 | 6 |
| `src/core/selection/sourceSelectionService.ts` | 396 | 8 |
| `server.ts` | 1734 | 31 |

Prioridade: indisponibilidade temporal não homologada. Registry acumula configuração, cache, transporte, concorrência e seleção; verification agrega descoberta e validação; ZapiPlayer acumula engines, interação, recuperação e progresso. App/TvApp acumulam roteamento, sessão e apresentação. O número de linhas não justifica extração isoladamente.

O E2E de sessão existente passou em Chromium: três inícios decodificados (854x480/640x360). Porém startPlayback injeta streamsMap e verificationState AVAILABLE, sem conectar descoberta ao player. Não comprova correção de títulos reais nem estabilidade prolongada. Não foram testadas TVs físicas.

Riscos prioritários: testes de 0,5s insuficientes; P0 ainda aberto; dependências circulares no grafo; configuração local/backend com precedência própria; módulos UI importados pelo core. Nenhuma reestruturação da reprodução está autorizada pelo gate até evidência do fluxo completo.

## Leitura remota sem escrita

/api/providers/config em Production retornou HTTP 200: 22 provedores, 20 enabled, 8 offline, 2 metadata-only e 2 enabled com configuracao ausente. Esses grupos podem se sobrepor. Elegibilidade real do cliente precisa ser considerada antes de concluir que houve consulta ou falha externa. Nenhum segredo foi registrado.

## Efeitos e riscos por fronteira

| Fronteira | Estado/efeito | Risco e teste existente |
|---|---|---|
| App/TvApp/ContentDetailModal | Sessao, foco, catalogo e descoberta assincrona | Desmontagem/cancelamento; watch-routes, six-flows, tv-navigation |
| ZapiPlayer | Elemento de video, HLS, timers, listeners, progresso | Limpeza, áudio e recuperacao; player-real, tv-buffering, watchparty |
| providerRegistry | LRU, pending promises, abort controllers, HTTP e config | Contaminacao temporal; addons-discovery-isolated, session-stability |
| sourceVerificationService | Fases de descoberta, motivos e validacao | Falsos estados; source-double-verification, source-playability |
| streamValidator/sourceReadiness/mediaSourceValidation | Identidade e capacidades técnicas | Rejeicao indevida ou obra errada; source-playability, playback-identity |
| stremioClient | HTTP, manifestos, adaptacao de respostas | CORS, formatos e timeout; addons-discovery-isolated |
| sourceConfidenceEngine/sourceSelectionService | Identidade e ranking | Regras contraditorias/ciclos; canonical-title-matching, smart-audio |
| server/api bundle | Rotas Express, autorizacao, proxy e banco | SSRF, acesso e trafego; public-api-security, origin-transfer |

api/index.mjs e gerado por build:api: revisar server.ts, nao refatorar o bundle manualmente. Linhas/imports acima sao medidas do baseline; contratos ainda exigem inventario detalhado antes de cada extracao.
