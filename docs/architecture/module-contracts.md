# Contratos preservados

- providerRegistry.resolveStreams(type, identity, episode, options): Promise<StremioStream[]>; progressivo, sinais e telemetria. Cache nao prova nova consulta; cancelar consumidor nao cancela os demais.
- sourceVerificationService.verifySources: AVAILABLE/INCONCLUSIVE/UNAVAILABLE, streams e diagnostico. Falta de evidencia nao comprova ausencia.
- ZapiPlayer: item, streams, verificationState. Uma engine/video, preservar idioma, progresso e intro.
- WatchPartyService.getRoomState: contrato autoritativo da sala, inalterado.
- storageService/syncQueue: isolamento conta/perfil e retencao de recusas, schema inalterado.
- CatalogSnapshotManager.sortItemsByOption: copia ordenada, elegibilidade e desempate deterministico.

Novos provedores usam contratos existentes, configuracao privada server-side e fixtures identificadas; HTTP 200 nao comprova playback.
