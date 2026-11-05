# P0 - Proxy 415/502 e orcamento de requisicoes

## Base e limites

Production de referencia: 70b509d. metadataProxy.ts dessa versao e identico ao baseline local anterior a esta etapa. Trabalho somente na branch fix/p0-provider-transitions-20261105; sem deploy, push, merge, migracao ou alteracao de credenciais.

A coleta informada pelo usuario preservou 101 respostas 415, 9 respostas 502, 152 FETCH_FAILED, request ID ate 783 em cerca de 180 s e 1260 descartes. NAO sao totais da sessao; tampouco identificam individualmente cada provedor. O JSON original nao foi fornecido nesta etapa. currentTime=0/waiting nao comprova a causa de origem nem identifica intro versus conteudo.

## Causas demonstradas no codigo e testes

1. **415 agregado:** destino final incompatível e MIME nao JSON usavam o mesmo METADATA_ONLY. A nova telemetria distingue REDIRECT_ENDPOINT_BLOCKED e CONTENT_TYPE_BLOCKED sem revelar URL/payload. Resposta publica generica permanece.
2. **HTTP mascarado por MIME:** 403/502 do upstream com pagina HTML era classificado 415 antes da checagem HTTP. Agora o status upstream e preservado como AUTH_REQUIRED/UPSTREAM_ERROR sem ler o corpo HTML. Um sucesso 200 HTML continua bloqueado em 415.
3. **502 agregado:** DNS, timeout, conexao recusada, destino bloqueado e JSON invalido terminavam no mesmo catch. Agora DNS_FAILURE/TIMEOUT/CONNECTION_REFUSED/DESTINATION_BLOCKED/INVALID_JSON sao diferenciados administrativamente. A prevalidacao SSRF da rota server.ts ocorre antes do handler e tambem foi instrumentada; nenhuma verificacao SSRF foi removida.
4. **Orcamento excedido no cliente:** Math.max(800, remaining) iniciava outra consulta mesmo apos esgotar o limite total. Teste com relogio controlado: 2 tentativas antes, 1 depois. Timeout direto padrao tambem foi limitado ao total solicitado.
5. **Orcamento renovado por identificador:** cada ID alternativo recebia outros 2500 ms, alem do prazo do provedor. Teste: 3 chamadas getStreams antes, 1 depois quando a primeira ja esgotou o prazo. Sao chamadas logicas num teste, NAO contagens reais da sessao. Esgotamento antes das alternativas e inconclusivo/TIMEOUT, nao sucesso vazio conclusivo.
6. **Cancelamento na camada StremioClient:** o ultimo consumidor era removido antes de testar um conjunto nao vazio, deixando transporte ativo. Corrigido tambem aqui (a correcao anterior era em providerRegistry). Testes preservam outro consumidor, abortam o ultimo e nao reutilizam a entrada abortada.
7. **Erro antigo apos fallback valido:** uma alternativa com fonte aceita ainda mantinha HTTP_FAILURE da tentativa inicial. Teste falhou antes (HTTP_FAILURE) e passou depois (SUCCESS_WITH_STREAMS). Limpa somente a falha substituida por resposta correspondente valida.
8. **MIME rigoroso:** text/html com parametro contendo application/json era aceito pela regex antiga. Teste retornou 200 antes, 415 depois. application/vnd.stremio+json continua permitido. Nao aceitar HTML ou relaxar seguranca para recuperar fontes.

## Telemetria administrativa

GET /api/admin/providers/proxy-diagnostics usa requireAdmin real da aplicacao e ainda exige req.user.role=admin no handler. Resposta no-store. Nao ha console publico ou endpoint publico novo de diagnostico.

Campos permitidos: providerId publico, resource (manifest/catalog/meta/stream/subtitles/unknown), upstreamStatus, contentTypeClass (JSON/HTML/MEDIA/OTHER/MISSING), redirected, reason enumerado, durationMs, attempts e status de resposta (null se conexao destruida). Nao armazena URL, query, tokens, credenciais, payload ou mensagem livre de excecao.

Buffer limitado a 200 eventos na instancia atual da funcao; dropped informa perdas. Em Vercel serverless ha multiplas instancias e reinicios: resposta vazia nao comprova ausencia de consultas, e as contagens nao sao totais globais. attempts conta tentativas de resolucao/conexao do transporte incluindo redirects observados; nao e um contador de retries globais do navegador. Falha de preflight aparece separadamente como evento sem upstreamStatus.

## Diagnostico por provedor

Ainda NAO ATRIBUIDO para os erros historicos. Sondagens reais somente leitura foram executadas via publicHttpGet (SSRF ativo), no Node local, sem sessao de navegador, sem credenciais e sem passar pela Vercel:

| Provedor | Recurso | Resultado observado | Duracao |
|---|---|---|---:|
| froststream-http | manifest | HTTP 403, MIME OTHER, endpoint permitido | 55 ms |
| froststream-http | stream movie tt0063350 | HTTP 403, MIME OTHER, endpoint permitido | 80 ms |
| fenixflix-animes | manifest | HTTP 200, JSON valido | 265 ms |
| fenixflix-animes | stream movie tt0063350 | ABORT_ERR ao atingir limite de 5 s do ensaio | 5015 ms |
| torrentio-global | manifest | HTTP 200, JSON valido | 58 ms |
| stremio-cinemeta | manifest | HTTP 200, JSON valido; provedor apenas de metadados | 69 ms |

Referencia da consulta stream: A Noite dos Mortos-Vivos (1968), IMDb tt0063350. Nenhuma URL de video foi reproduzida, alterada ou usada para substituir a obra. Campos streamsReturned ficaram nao observados, nao zero. Se a Vercel receber a mesma resposta 403/MIME OTHER do FrostStream, o codigo 70b509d a convertera em 415; a nova ordem preserva 403. Isso demonstra o mecanismo, mas nao prova que os 101 eventos preservados tenham essa origem. O IP/rede local difere da Vercel e do navegador; o timeout Fenix de 5 s nao comprova indisponibilidade permanente nem falha sob o orcamento maior do app.

 A nova telemetria permite agrupar os eventos pelo ID publico depois de homologada em Preview com sessao administrativa autorizada. Nao afirmar que todos os provedores falham, ou marcar um provedor permanentemente offline com uma resposta transitoria. Nenhuma configuracao operacional foi desativada nesta etapa.

Nao foi introduzido limite global arbitrario de concorrencia: os eventos agregados nao demonstram o numero simultaneo por provedor. Foram corrigidos limites temporais e cancelamentos comprovadamente defeituosos, preservando deduplicacao existente e fallback direto/proxy limitado.

## Testes

metadata_proxy_diagnostics: JSON/vendor JSON aceitos; HTML, MIME incompatível e redirect nao autorizado bloqueados; DNS, timeout, conexao recusada, JSON invalido, upstream 502 e 403/HTML diferenciados; campos sanitizados; acesso admin, usuario e visitante verificado no handler com fixtures de papel; buffer limitado. Isso nao substitui sessao administrativa real.

stremio_request_budget: orcamento total, uma falha direta seguida de exatamente um fallback, deduplicacao de dois consumidores, cancelamento parcial/total e retry sem reutilizacao de request abortado.

provider_request_budget: deadline compartilhado entre IDs e sucesso alternativo substituindo falha primaria. origin-transfer: 10 testes de API/SSRF/midia/proxy passaram. Fontes nos testes sao fixtures controladas, sem alegacao de disponibilidade de titulo real.

## Proxima homologacao

CI Linux e Preview isolado permanecem pendentes de autorizacao remota. Nao publicar Production. Em Preview staging: autenticar administrador, obter diagnostico antes/depois de tentativa do titulo autorizado, correlacionar provider/resource/status com captura cliente e confirmar frames do conteudo correto. So depois comparar a taxa de requisicoes da mesma sessao e condicoes. O P0 permanece ABERTO; nenhuma reproducao integrada real foi comprovada nesta etapa.

## Resultado final local

npm run build completo terminou com exit 0, incluindo TypeScript, ESLint, test:stability, os novos testes, API e Vite (11,78 s). Lint adicional apos instrumentacao do preflight passou. Teste de MIME rigoroso e classificador passou apos a ultima alteracao; 10 testes origin-transfer haviam passado. Novas regras nao removem seguranca ou validacao de identidade. CI Linux e Preview nao executados; nenhum ganho percentual real ou encerramento do P0 e declarado.
