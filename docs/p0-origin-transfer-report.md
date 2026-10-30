# P0 — tráfego de mídia fora das Functions

Base: `2117bf7`. Branch: `codex/p0-origin-transfer-20261030`. Sem push, merge, deploy, alteração de credenciais ou operação em banco remoto.

## Causa comprovada e limites de observabilidade

O caminho antigo era `origem → publicHttpGet → /api/proxy → Function → navegador`. O handler encaminhava `Content-Length`, `Content-Range` e executava `nodeStream.pipe(res)` sem limitar a mídia. Para HLS, `rewriteHlsManifest()` convertia variantes, áudio, legendas, chaves e segmentos em novas requisições `/api/proxy`. A descoberta também criava alternativas de relay para arquivos diretos e Ao Vivo. São mecanismos comprovados no código que fazem o tráfego pesado atravessar a função, inclusive repetidamente em sessões HLS/seek.

**Não há comprovação de que todos os 14,31 GB vieram dessa rota.** Esse total e o limite de 10 GB foram informados pelo usuário; não foram confirmados de forma independente.

| Dado solicitado | Resultado efetivamente obtido |
|---|---|
| Projeto investigado | `zapi-group/zapitv`; projeto externo do player não alterado |
| FOT por projeto, rota e frequência | Consultas CLI feitas; API respondeu `payment_required`, exigindo Observability Plus |
| Observabilidade MCP | Endpoint legado retornou 404; a CLI atual expôs o schema de métricas, mas bloqueou as consultas de dados |
| Cobrança agregada pelo conector | HTTP 403 para a equipe; não se inferiu consumo a partir dessa resposta |
| Ranking real de maiores consumidores | Indisponível; não foram inventadas contagens/percentuais por rota |
| Monitoramento após correção | **Pendente:** Production não recebeu estas alterações |

Não foi comprado plano/add-on. MP4/Range, segmentos HLS e alternativas automáticas de proxy são os principais caminhos de risco identificados; não constituem ranking medido de produção.

## Correções implementadas

1. `/api/proxy` agora é um gateway **somente JSON de addons** com origens e caminhos permitidos no servidor. HLS, MP4, segmentos, áudio, legendas e Range recebem recusa; não há redirect/fallback de mídia para outra infraestrutura.
2. Mantidas validação SSRF/DNS com conexão fixada e política de autenticação. Destinos desconhecidos não podem usar o gateway como fetch genérico. Respostas/erros não imprimem URLs ou segredos.
3. JSON limitado a **512 KiB**, timeout total de **8 s**, concorrência **16**, limite existente por IP adaptado a metadados. A identificação da rota no middleware passou a usar `req.baseUrl`, pois `req.path` é relativo ao prefixo montado.
4. MIME, destino após redirect, tamanho declarado e corpo são verificados; corpos upstream são encerrados e timers/listeners removidos. Nenhum header de mídia é encaminhado.
5. Descoberta/Ao Vivo retornam origem direta. Alternativas duplicadas proxy/direto do mesmo arquivo foram removidas, preservando os títulos, episódios e fontes diretas originais.
6. O ZapiPlayer resolve links legados relativos/da mesma origem para a URL original, preservando parâmetros assinados. HTTPS→HTTP, credenciais URL, proxy de outra origem ou Referer obrigatório não são contornados: a fonte fica indisponível. Nenhuma credencial server-side foi movida ao navegador.
7. Nenhum motor, buffer HLS, idioma, preferência, qualidade, vinheta ou identidade de mídia foi substituído. Origens sem CORS/HTTPS/acesso direto compatível **podem deixar de reproduzir**, conforme a restrição solicitada; não existe fallback oculto pela Vercel.
8. Probes frontend usam origem direta e cancelam o corpo. No Ao Vivo, um MP4 que ignora Range não é lido integralmente como texto; retorna verificação inconclusiva para confirmação pelo player. Probes de segmentos são encerrados após seus headers.
9. Consultas simultâneas ao mesmo JSON **público externo** são deduplicadas, com mapa limitado a 64 entradas e remoção ao terminar. Requisições internas e fallback autenticado não compartilham respostas entre mudanças de sessão.
10. APIs privadas têm `no-store`. `/api/featured`, `/api/featured/monthly` e `/api/catalog/new-releases` usam cache público curto de 30 s somente após obter os dados. ETag/304 do Express foi verificado. Contratos, campos de catálogo e paginação existente foram preservados.

Imagens/capas continuam em suas origens; assets estáticos já possuem cache longo em `vercel.json`. Não foi reduzida a resolução das imagens nem criado outro proxy de imagens. `preload` do vídeo selecionado não foi alterado indiscriminadamente.

## Testes e medições reais do ensaio

`npm run test:origin-transfer`: **10 testes determinísticos/de integração local**, cobrindo segurança do gateway, limites, Range, JSON, ciclo de vida, cache privado, 304, catálogo, deduplicação pública e isolamento do fallback autenticado. O teste da reescrita HLS falhou antes da correção. Testes adicionais reproduziram leitura indevida do MP4 e compartilhamento incorreto do fallback antes de suas correções.

Gateway controlado: **6 requisições de mídia recusadas, 0 conexões upstream de mídia, 0 bytes de vídeo retransmitidos**, 744 bytes de erros JSON ao todo. JSON aprovado mantém `no-store`; resposta pública condicional retornou **304 com 0 bytes de corpo**; visitante sem sessão recebeu 401 e destino privado SSRF recebeu 502.

`npm run test:origin-transfer-browser`: Chrome/Chromium headless com o **ZapiPlayer existente**, mídia própria gerada localmente (barras de cor, tons AAC e legenda), origem HTTP separada com CORS/Range, HLS.js real e arquivos/segmentos reais. Não é reprodução de um título comercial nem teste em aparelho físico.

| Cenário | Avanço medido | Quadros adicionais | Bytes de áudio decodificados | Retomada/seek | Pedidos de mídia à API |
|---|---:|---:|---:|---|---:|
| Desktop HLS | 15,497 s | 372 | 142230 | Sim | 0 |
| Desktop MP4 | 3,957 s | 96 | 45879 | Sim | 0 |
| Mobile MP4 | 3,961 s | 96 | 48035 | Sim | 0 |
| Modo TV HLS | 3,947 s | 95 | 40675 | Sim | 0 |
| Identificação Fire TV HLS | 3,966 s | 96 | 40872 | Sim | 0 |

Todos apresentaram quadros em 640×360, a resolução **da fixture**, sem erro de mídia observado. Essa resolução não foi imposta ao produto. Também passaram: solicitação de segmentos da faixa alternativa English, legenda própria efetivamente renderizada e botão real de próximo episódio carregando `/episode2.mp4` diretamente.

A execução completa registrou **117 requisições e 43.625.519 bytes na origem local controlada**, sem tráfego de vídeo pelo `/api/proxy`. Esse volume **não é uso da Vercel**, redução mensal nem estimativa dos 14,31 GB.

### Verificações gerais

- TypeScript/lint aprovados.
- `npm run build` aprovado, incluindo `test:stability`, API e Vite. Após o ajuste final da deduplicação autenticada, reexecutados os testes específicos, TypeScript e bundles.
- Permanecem avisos existentes de chunks grandes; sem refatoração de bundles.
- `npm run test:watchparty-smoke` foi executado com servidor local na porta 4000, sem credenciais remotas e com política pública somente nesse processo. **Não aprovado:** o script não encontrou “Grupo” no conteúdo escolhido. Não foi apresentada essa execução como sucesso nem foi comprovada uma regressão da Watch Party. Contratos de Watch Party da suíte de estabilidade passaram; código da Watch Party não foi alterado.
- Processos de ensaio encerrados e diretórios temporários próprios removidos. Artefatos de ranking/API gerados pelos testes não integram a mudança funcional.

## Pendências e risco operacional

- **BLOQUEADO para medição de produção:** nenhuma publicação foi autorizada nesta tarefa. Não é possível confirmar queda do FOT no ambiente publicado antes disso.
- Detalhamento real por rota/projeto continua bloqueado pelo acesso/plano da observabilidade. O total histórico consumido não é apagado pela correção.
- Samsung/Tizen/MSX, Fire TV e navegadores móveis físicos não foram homologados. User-Agent/viewport Chromium não substituem hardware.
- HLS nativo/Safari não foi testado; a estratégia já existente não foi alterada.
- Fontes que exigem relay, CORS incompatível ou headers server-side precisam de distribuição explicitamente aprovada; permanecem indisponíveis, sem criar custos/infraestrutura alternativa.
- Smoke visual da Watch Party precisa de um cenário alcançável/conta/conteúdo adequados antes de ser considerado aprovado.

## Arquivos efetivamente alterados

`server.ts`; `src/server/metadataProxy.ts`; `src/server/security/publicHttp.ts`; `src/server/rewriteHlsManifest.ts`; `src/core/playback/directMediaUrl.ts`; `src/components/player/ZapiPlayer.tsx`; `src/core/providers/providerRegistry.ts`; `src/core/providers/mediaSourceValidationService.ts`; `src/core/livetv/LiveStreamValidator.ts`; `src/core/stremio/stremioClient.ts`; `src/core/catalog/verifiedCatalog.ts` (somente alternativas de transporte duplicadas); `package.json`; testes `origin_transfer_policy`, `origin_transfer_api`, `origin_transfer_browser`, `hls_manifest_proxy`; plano e este relatório.
