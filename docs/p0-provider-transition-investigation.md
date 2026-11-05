# P0 - Investigacao de transicoes de provedores

## Escopo e seguranca

Branch de trabalho: fix/p0-provider-transitions-20261105, derivada de e26d293. A branch refactor/clean-architecture-20261105 foi preservada. Nenhuma sessao privada de Chrome, cookie ou token foi acessado. Nenhum deploy, push, migracao ou escrita em Production.

## Evidencias externas somente leitura

GET Production /api/providers/config: HTTP 200, 22 entradas, 20 enabled, 8 status offline, 2 metadata-only, 2 enabled sem configuracao. Contagens se sobrepoem. Campos isEligible identificam corretamente os provedores sem configuracao/offline como inelegiveis. Esses grupos nao representam 20 provedores consultados.

A classe real do cliente, iniciada com defaults e sem preferencias persistidas, foi sincronizada com essa resposta: 13 elegiveis antes e 13 depois. Nao reproduziu queda generalizada; preferencias privadas de usuarios existentes nao foram examinadas. Por exemplo, stremio-public-domain-web permaneceu desabilitado conforme a configuracao local de fabrica; esse comportamento nao foi alterado sem evidencia da intencao administrativa.

Vercel logs 24h: HTTP 400, plano Hobby sem retencao nessa janela. Consulta de 30 minutos disponivel: ultima amostra com 7 registros, nenhum contendo diagnostico de providers, timeout ou AUTH_REQUIRED. Ausencia de log nao comprova ausencia de falha; a descoberta roda principalmente no cliente, sem uma tentativa autenticada correlacionada nesses registros.

## Defeito 1 - Cancelamento nao chega ao transporte

providerRegistry.resolveStreams registrava releaseListener antes de onConsumerAbort. O primeiro removia o sinal abortado do conjunto; quando o segundo verificava isCancelled, nao havia consumidores e retornava false. Uma pre-busca cancelada continuava consumindo rede e podia concluir posteriormente.

Reproducao antes da correcao: teste da classe real falhou `last consumer cancellation must abort shared transport`, actual false. Correcao: reter sinais abortados ate o encerramento compartilhado; limpar listeners de consumidores concluidos; recusar sinais previamente abortados; novas consultas nao reutilizam um transporte ja abortado. Cancelar somente um consumidor preserva o transporte de outro consumidor ativo.

## Defeito 2 - Cooldown classificado como ausencia conclusiva

executeAddon emitia SKIPPED por cooldown sem registrar o resultado em providerOutcomes. A escrita do cache negativo nao incluia SKIPPED/INVALID_RESPONSE/CANCELLED como resultados inconclusivos. sourceVerificationService tambem nao considerava SKIPPED/CANCELLED na classificacao final. Uma consulta nao realizada podia parecer ausencia comprovada.

Reproducao antes da correcao: teste novo retornou UNAVAILABLE em vez de INCONCLUSIVE. Correcao minima: registrar SKIPPED, manter cache inconclusivo e nao classificar consultas puladas/canceladas como ausencia. Preservado cooldown de 60 s apos quatro falhas e sucesso vazio como resposta conclusiva. Nenhuma validacao de identidade ou seguranca removida.

## Testes e limites

- provider_transition_regression: transporte abortado ao cancelar ultimo consumidor; nova consulta usa transporte novo; outro consumidor ativo preservado; mapas limpos ao finalizar. Usa transporte controlado, NAO prova playback.
- source_double_verification: 20 testes passaram, incluindo regressao SKIPPED -> INCONCLUSIVE.
- provider_cooldown_http: servidor HTTP real local com respostas identificadas como fixtures. Zero chamadas durante cooldown; recuperacao imediata apos expiracao; cache negativo conclusivo expira apos 15 s. Quatro requisicoes HTTP ao longo do ensaio; uma fonte normalizada/selecionavel, uma apos sync e uma apos revalidacao SWR com relogio controlado avancado em 3 minutos (sem alegar tres minutos reais de reproducao). A URL de midia da fixture nao foi reproduzida: playbackConfirmed=false.
- session-stability: Chromium independente, sem reutilizar perfil privado. Tres inicios decodificados passaram; o harness injeta streamsMap, portanto NAO valida descoberta integrada nem conteudo real.
- npm run build completo local: exit 0, sem interrupcoes; inclui TypeScript, ESLint, test:stability, os dois testes de transicao novos, build:api e Vite (9,53 s). Avisos de chunks grandes persistem; CI Linux nao executado.

## Hipoteses e homologacao pendentes

Esses defeitos internos estao reproduzidos e corrigidos localmente. Nao foi demonstrado que expliquem todos os relatos reais. Ainda verificar, com sessao autenticada autorizada: configuracao persistida daquele cliente; requests e CORS; status HTTP e tempos de cada addon; TTL de URLs reais; descartes por identidade/episodio/idioma; primeira fonte selecionada e frames; repeticao apos buscas, sync, cooldown e cache expirado. Cooldown e circuit breakers dependem do historico em memoria daquele cliente, inacessivel sem a sessao.

Nao ha confirmacao de recuperacao de titulo real, TVs fisicas, CI Linux ou ambiente Preview nesta execucao. Build local nao substitui CI Linux. P0 permanece ABERTO e a refatoracao profunda permanece bloqueada. Para CI Linux destes commits locais, sera necessario autorizar push da branch e execucao do workflow; nao foi solicitado nesta etapa.
