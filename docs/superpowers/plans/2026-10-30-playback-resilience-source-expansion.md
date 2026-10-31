# ZAPITV — Correção P0 de Reprodução, Resiliência e Expansão de Fontes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Visão Geral
Reduzir drasticamente as falhas "Não foi possível reproduzir" na ZapiTV através da revisão profunda do ciclo de vida de fontes audiovisuais:
1. Classificação e diagnóstico sanitizado de erros técnicos em 10 causas.
2. Separação formal dos 4 estados da fonte (`discovered`, `identity_verified`, `technically_ready`, `playback_confirmed`).
3. Fim do abandono prematuro da descoberta com busca progressiva e contínua em segundo plano.
4. Integração de novos provedores de domínio público e mídia aberta autorizada (Internet Archive, Wikimedia Commons, Open Culture).
5. Recuperação automática e silenciosa com preservação milimétrica de progresso e preferências de áudio/legenda.
6. Ranking inteligente adaptativo por dispositivo (Fire TV vs Android Mobile vs Desktop).
7. Testes de regressão estritos para Doctor Who, One Piece e estabilidade geral do app.

---

## Estrutura de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-------------------|
| `src/core/providers/sourceReadiness.ts` | Reescrever | Gestor técnico de prontidão, compatibilidade com dispositivos, quarentena transitória de URLs com falha e distinção de 4 estados |
| `src/core/tracking/mediaLoadingTracker.ts` | Atualizar | Classificação estrita de erros nas 10 causas canônicas com sanitização de URLs/tokens |
| `src/core/providers/providerRegistry.ts` | Atualizar | Descoberta progressiva, eliminação de parada prematura, suporte a `discoverMoreSources`, novos provedores no registro |
| `server.ts` | Atualizar | Endpoints de Stremio Addon para Internet Archive Movies, Wikimedia Open Media e Open Culture |
| `src/core/providers/sourceMemory.ts` & `playbackOptimizerService.ts` | Atualizar | Aprendizado e telemetria de confiabilidade segmentada por dispositivo |
| `src/components/player/ZapiPlayer.tsx` | Atualizar | Recuperação automática com preservação de tempo e áudio, quarentena de falhas e reabastecimento dinâmico de fontes |
| `tests/playback_resilience_and_source_expansion.test.ts` | Criar | Suíte completa de testes automatizados e regressões |
| `package.json` | Atualizar | Script de teste `test:playback-resilience` integrado ao pipeline de estabilidade |

---

## Tarefas de Implementação

### Tarefa 1: Diagnóstico Sanitizado e Classificação Canônica de 10 Erros
- [ ] Atualizar `src/core/tracking/mediaLoadingTracker.ts` para mapear exatamente as 10 causas de erro:
  1. `NO_CANDIDATES_RETURNED`: nenhuma fonte retornada pelo provedor.
  2. `INCORRECT_CONTENT_ID`: metadados ou IDs de TMDB/IMDb incompatíveis com a obra.
  3. `SEASON_EPISODE_MISMATCH`: temporada ou episódio divergente do solicitado.
  4. `PROVIDER_UNREACHABLE_OR_TIMEOUT`: timeout ou recusa de conexão do servidor do addon.
  5. `HTTP_OR_CORS_ERROR`: erro HTTP (403, 404, 502) ou bloqueio de CORS/Mixed Content.
  6. `INCOMPATIBLE_CODEC`: codec não suportado pelo ambiente/navegador (ex.: E-AC-3 ou HEVC sem decoder).
  7. `INVALID_MANIFEST`: manifesto HLS (.m3u8) ou DASH (.mpd) corrompido ou vazio.
  8. `EXPIRED_SOURCE`: link temporário ou assinado expirado.
  9. `DECODE_OR_RENDER_FAILURE`: erro nativo de decodificação no `<video>` (`mediaError.code = 3`).
  10. `LOCAL_ENGINE_REQUIRED`: fonte torrent/loopback exigindo Stremio Engine inativo.
- [ ] Assegurar que `sanitizePlaybackReason` oculte totalmente parâmetros de busca, tokens, senhas e URLs privadas, substituindo por `[redacted-url]`.

### Tarefa 2: Ciclo de Vida da Fonte e Prontidão Técnica em `sourceReadiness.ts`
- [ ] Modelar formalmente o enum e tipos de estado: `discovered`, `identity_verified`, `technically_ready`, `playback_confirmed`.
- [ ] Implementar `isSourceTechnicallyPlayable(stream, deviceProfile)`:
  - Validar se a URL é HTTP insegura quando a página roda em HTTPS (bloqueio de Mixed Content).
  - Validar suporte a codecs para o dispositivo ativo (ex.: Fire TV prefere AAC em HLS).
  - Se for torrent/localhost, exigir estritamente confirmação ativa do Stremio Engine local.
  - Verificar se a URL está em quarentena temporária por falha recente.
- [ ] Implementar gestão de quarentena temporária:
  - `markSourceTemporarilyProblematic(url, reason)`: registra falha com TTL (15 minutos).
  - `isSourceTemporarilyProblematic(url)`: retorna true se estiver no período de penalidade.
  - `clearProblematicSources()`: limpa o histórico para reinício limpo de testes ou sessão.

### Tarefa 3: Descoberta Progressiva e Fim do Abandono Prematuro em `providerRegistry.ts`
- [ ] Eliminar a interrupção prematura de workers (`cleanInterim.length >= 1 && hasWebReadyPtBr`) em `providerRegistry.ts`.
- [ ] Implementar emissão progressiva contínua: emitir o primeiro stream tecnicamente pronto via `onProgressiveStreams`, mas manter workers em segundo plano preenchendo a fila de reserva até o teto seguro.
- [ ] Adicionar método `discoverMoreSources(...)` para permitir que o player solicite fontes adicionais caso as primeiras falhem.
- [ ] Proteger URLs HTTP inseguras convertendo-as automaticamente para a rota segura de proxy HTTPS quando executado em ambiente HTTPS.

### Tarefa 4: Expansão de Provedores com Mídia Aberta Autorizada e Domínio Público
- [ ] Adicionar no `providerRegistry.ts` e em `DEFAULT_PROVIDERS`:
  - `archive-org-movies`: Acervo de filmes e clássicos do Internet Archive.
  - `wikimedia-commons-media`: Acervo cultural e documentários Creative Commons da Wikimedia.
  - `open-culture-cinema`: Acervo internacional de cinema aberto e restaurado.
- [ ] Implementar no `server.ts` os endpoints de Stremio Addon correspondentes:
  - `/api/stremio/archive-org-movies/manifest.json` e rotas de stream com consulta à API do Archive.org por IMDb/metadados.
  - `/api/stremio/wikimedia-commons/manifest.json` e streams diretos WebM/MP4.
  - Suporte a filtros de segurança garantindo que apenas arquivos compatíveis com navegador sejam entregues.

### Tarefa 5: Recuperação Automática e Fallback Resiliente em `ZapiPlayer.tsx`
- [ ] No `handleStreamFallback(reason)`:
  - Classificar e registrar a causa do erro de forma sanitizada.
  - Isolar a fonte falha chamando `markSourceTemporarilyProblematic(currentStream.url, reason)`.
  - Capturar e congelar a posição de reprodução antes de descarregar o elemento `<video>` (`targetResumeTimeRef.current = video.currentTime`).
  - Buscar a próxima fonte compatível que não esteja em quarentena.
  - Se a fila local estiver vazia ou com apenas 1 item, acionar `providerRegistry.discoverMoreSources` de forma assíncrona antes de desistir.
  - Preservar a preferência de idioma de áudio e legendas na transição.
  - Limitar as tentativas consecutivas (máximo de 5) para evitar loops infinitos.

### Tarefa 6: Ranking Inteligente com Aprendizado por Dispositivo
- [ ] Atualizar `sourceMemory.ts` e `playbackOptimizerService.ts` para registrar evidência discriminando a plataforma ativa: `firetv`, `android_mobile`, `desktop_chrome`, `desktop_safari`, `smart_tv_tizen`, `smart_tv_webos`.
- [ ] Atualizar cálculo de prioridade ponderando:
  - Taxa de sucesso de inicialização confirmada.
  - Ausência de travamentos (stalls).
  - Presença real de áudio dublado PT-BR.
  - Baixo tempo até o primeiro frame.

### Tarefa 7: Suíte de Testes Automatizados e Validação Geral
- [ ] Criar `tests/playback_resilience_and_source_expansion.test.ts` cobrindo:
  - Classificação das 10 causas de erro.
  - Transição correta dos 4 estados de ciclo de vida da fonte.
  - Detecção de incompatibilidade técnica e quarentena temporária.
  - Descoberta contínua sem abandono prematuro.
  - Novos provedores de domínio público e mídia aberta.
  - Regressões essenciais: Doctor Who (continuidade 1963/2005/2024), One Piece e áudio PT-BR.
- [ ] Atualizar `package.json` adicionando `test:playback-resilience` e inserindo-o em `test:stability`.
- [ ] Executar checagem de tipos (`npm run lint`), testes unitários e build de produção (`npm run build`).
- [ ] Commitar alterações na branch `fix/playback-resilience-source-expansion-p0`.
- [ ] Subir as atualizações para o repositório remoto (`git push`).
