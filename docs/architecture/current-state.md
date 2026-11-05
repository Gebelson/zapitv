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
