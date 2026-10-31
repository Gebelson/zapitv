# Integração de produção — 31/10/2026

Integra `c301831` (produção anterior) com `6c14afd` e seus ancestrais, incluindo `d08c0b2` e `16089de`. As três divergências foram resolvidas preservando os seletores, guardas de conta/perfil e transporte direto da main, além das funcionalidades dos Previews.

## Falha da Vercel

Deployment `dpl_5hRhbZVwtFsXZbDUnTEAEkknkEp5`: último comando `test:playback-resilience`, todas as asserções concluídas, processo permaneceu aberto. Reprodução local com limite de 12 s confirmou timeout após imprimir sucesso. Causa: timer periódico do singleton CanonicalCatalogMaster. Correção: dispose em finally no teste, inclusive em falha. O mesmo subprocesso passou a encerrar naturalmente com código 0. Nenhum teste foi removido ou teve asserções enfraquecidas.

Também evitada inicialização duplicada do polling de StorageService: authSyncService já mantém foco/online/refresh periódico da aplicação. Método explícito permanece disponível.

## Validação

- TypeScript, estabilidade completa, API e bundle de produção: aprovados.
- 24 testes de continuidade/isolamento: aprovados.
- Chromium: continuidade nos três ambientes, busca remota, fila offline, reload e isolamento: aprovados.
- Reprodução controlada direta HLS/MP4, áudio, legendas, seek e próximo episódio: aprovados nos cinco cenários finais (desktop HLS/MP4, mobile MP4, TV e Fire TV Chromium); sem tráfego de mídia por /api/proxy.
- Execuções concorrentes falharam na asserção de avanço de tempo em MP4/TV. Execuções isoladas e a reexecução integral final passaram, sem mudar o player ou enfraquecer a asserção para ocultar o resultado.
- Smoke legado Watch Party em localhost:4000 executado, bloqueado pelo modal obrigatório de autenticação; não aprovado. Não foi desabilitada autenticação para liberar o teste. Contratos determinísticos da Watch Party passaram na estabilidade.
- Sem homologação física Samsung/Fire TV nesta execução.

Sem migração, alteração de credenciais ou de variáveis de produção. Publicação autorizada pelo usuário. O merge contém as duas linhas de histórico, sem reset ou force push.
