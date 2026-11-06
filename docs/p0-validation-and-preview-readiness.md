# P0 - Revisao e prontidao de homologacao

Branch: fix/p0-provider-transitions-20261105. Base desta etapa: ebb0ad8. A branch de refatoracao permanece em e26d293. Nenhum push, PR, workflow remoto, Preview ou alteracao Production executado.

## Revisao dos defeitos anteriores

As verificacoes existentes exercitam cancelamento parcial, cancelamento do ultimo consumidor, nova consulta antes da conclusao da anterior, rejeicao de consumidor previamente abortado e limpeza dos mapas. Nenhuma modificacao adicional no runtime foi necessaria nesta etapa. A classificacao final passou a ter testes separados para SKIPPED e CANCELLED: ambos inconclusivos. Testes de descoberta HTTP cobrem cooldown, recuperacao, cache negativo de 15 segundos e revalidacao positiva apos 3 minutos em relogio controlado. Nao sao tempos reais de reproducao.

## Evidencia real disponivel

Referencia: A Noite dos Mortos-Vivos (1968), filme, IMDb tt0063350 / TMDB movie 10331, ja presente no acervo aberto do projeto. Nenhum video diferente substituiu essa obra.

| Etapa observada | Resultado |
|---|---|
| GET Production /api/stremio/cinema-aberto/stream/movie/tt0063350.json sem sessao | HTTP 401 |
| HEAD da URL Wikimedia cadastrada para a mesma obra | HTTP 200, video/webm |
| Provedores consultados nessa requisicao protegida | Nao comprovados; autenticação interrompeu a requisicao |
| Fontes recebidas/descartadas/selecionadas | Nao observadas, nao confundir com zero |
| Player integrado e primeiro frame da obra | Nao executados |

Primeira interrupcao observavel: fronteira de autenticacao da API, comportamento esperado para cliente sem sessao. Nao e evidencia de defeito de autenticacao numa sessao valida, nem identifica a causa da indisponibilidade relatada por usuarios autenticados. HTTP 200 da midia nao comprova integridade, audio, identidade visual ou reproducao continua.

## Coleta executavel pelo usuario

scripts/diagnostics/p0-session-collector.js e docs/p0-user-session-capture.md permitem coletar na sessao autenticada sem extrair credenciais. Instrumentacao temporaria e manual, nao importada pelo aplicativo. GET de configuracao, fetchs normais preservados, eventos/metrica do video, contagens JSON com limite de tamanho. Sem upload automatico, sem storage ou comandos para enfraquecer seguranca. Campos permitidos sao copiados explicitamente; nenhum URL, header, titulo privado ou payload de autenticacao e exportado.

Teste em VM verifica descarte de URLs assinadas, campos secretos e titulos, classificacao de abort, captura de proxy, limite de 300 eventos, parada automatica e restauracao do fetch. Nao e homologacao em navegador autenticado. A coleta nao mede motivos de rejeicao internos ou XHR; veja unobserved no relatorio. Intro e conteudo nao podem ser diferenciados so por frames.

## CI e Preview

O workflow Linux existente executa npm ci, gate arquitetural, build completo e browser tests apos instalar Chromium. test:p0-collector integra test:stability. Nenhum workflow remoto foi disparado. Para avaliar estes commits no Linux, e necessario autorizar push da branch e execucao do workflow por PR ou workflow_dispatch. Push pode acionar a integracao Git da Vercel; confirmar a estrategia antes de executar.

Preview ainda NAO LIBERADO: verificar variaveis exclusivas de staging para esta branch, APP_URL exato, protecao Vercel e ausencia de fallback para banco Production. Nao promover para Production. Nao alegar CI verde ou deployment apenas porque ferramentas locais passaram.

## Proxima evidencia obrigatoria

Obter coleta de uma tentativa autenticada que falhe e outra que funcione na mesma sessao; associar manualmente titulo/episodio ao marcador; confrontar as respostas, estados dos provedores e eventos de video. Se os descartes internos nao forem observaveis, sera preciso instrumentacao adicional restrita em Preview, autorizada e sanitizada. Depois repetir com o mesmo conteudo apos navegacao, sync e cache. O incidente permanece ABERTO ate essa homologacao integrada.

## Resultado local final

npm run test:source-double-verification: 21 testes aprovados. test:p0-collector: sanitizacao, proxy JSON, abort, limite e parada aprovados. npm run build completo: exit 0, incluindo TypeScript, ESLint, test:stability, test:provider-transitions, test:p0-collector, bundle API e Vite (12,90 s). Avisos de chunks grandes permanecem. Isso NAO equivale a CI Linux nem a reproducao autenticada da referencia.
