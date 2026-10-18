# Orientações para alterações no ZapiTV

- Inspecione `git status`, a arquitetura e os contratos existentes antes de editar. Preserve alterações manuais e não use reset, limpeza destrutiva ou reformatação ampla.
- Mantenha design, navegação, catálogo, player, preferências e progresso. A remoção do sistema de downloads foi intencional; não o recrie sem novo pedido explícito.
- Corrija causas comprovadas. Não esconda exceções com fallbacks de mídia, conteúdo fictício ou dados de demonstração.
- O estado da Watch Party é publicado por `WatchPartyService.getRoomState()`. Ao mudar esse contrato, atualize modal, overlay, player e os testes do estado da sala.
- Execute `npm run test:stability` e `npm run build` para mudanças no player ou Watch Party. Com o servidor em `localhost:4000`, execute `npm run test:watchparty-smoke`.
- `npm run lint` ainda tem erros antigos registrados em `docs/stabilization-baseline.md`; não introduza novos erros. Resolva os antigos por módulo, com teste e sem refatoração ampla.
- Antes de publicar, valide o fluxo alterado no navegador e, depois da implantação, no site publicado. Registre o que foi testado e o que ainda não foi.
