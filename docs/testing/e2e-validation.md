# Evidencias E2E

2026-11-05: test:session-stability passou em Chromium Windows. Executa cancelamentos/descoberta, mas as tres reproducoes recebem streamsMap diretamente. Decodificacao do adaptador confirmada; integracao descoberta -> player e indisponibilidade real NAO APROVADAS. Sem TVs fisicas, sem escritas remotas ou deployment.

## Ensaio fortalecido

player-real agora observa mais de 5 segundos continuos e crescimento real de totalVideoFrames, alem das dimensoes e ausencia de erro. Execucao Chromium: 5,01038 s e 150 frames adicionais (amostra local de 10 s). Nao comprova 15 minutos, fontes externas ou titulos comerciais. Nenhum currentTime foi atribuido para simular reproducao.

## Gate do incidente

P0 permanece aberto: nenhum titulo real indisponivel foi recuperado e repetido nesta execucao. A configuracao remota foi consultada apenas em leitura. Promocao Preview/Production nao executada; isolar staging e selecionar uma tentativa autenticada reproduzivel antes de homologar. Nao afirmar estabilizacao geral a partir do harness.
