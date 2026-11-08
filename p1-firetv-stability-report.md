# ZapiTV P1 — desempenho e estabilidade do carrossel TV

## Atualização — retorno do player e resize

Correção adicional no mesmo PR #5, mantendo a base integrada dos PRs #3/#4.

Causa comprovada: TvApp normaliza a continuidade para temporada/episódio 1 inclusive em filmes. Após desmontar o modal para reproduzir e remontá-lo, TvDetailsModal suprimia o foco do botão play porque initialEpisode existia; a alternativa só inicializava foco quando havia episódios. Filme sem episódios ficava sem alvo.

RED comportamental: teste do modal real com Norigin e player interrompido de fixture, servido apenas em loopback, falhou no baseline b2ac051 ao retornar por Escape: nenhum elemento focado. O modo P1_BASELINE carrega explicitamente o arquivo original por git show, sem trocar arquivos do produto.

Correção: TvApp captura a chave de foco antes de entrar no player e passa essa chave no retorno. O modal tem uma inicialização por requestAnimationFrame com cancelamento; procura alvo conectado, renderizado e habilitado, depois episódio de continuidade válido ou ação principal/fallback do modal. Continuidade de filme não é tratada como episódio. Resposta assíncrona preserva a restauração pendente quando o episódio anterior ainda não montou; entrada deliberada do usuário cancela essa seleção tardia. O timer anterior de 150 ms foi removido. Registro de Voltar mantém cleanup próprio.

Resize: regressão independente falhou antes ao reduzir 1920×1080 para 960×540; o card focado ficava fora da viewport. A medição geométrica existente agora reposiciona somente o card focado fora da área vertical, sem mudar identidade/seleção ou registrar novos listeners.

Testes novos: 18 combinações de 9 cenários × 2 resoluções, com filme, progresso salvo, série, continuidade, episódios assíncronos na primeira montagem e no retorno, lista vazia e anime. Enter, setas reais, Escape/Backspace, reprodução interrompida e reabertura. Fixture de player valida o contrato de desmontagem/retorno; não substitui reprodução remota real.

Carrosséis: complementada seleção por Enter em duas voltas completas e retorno inverso para 7/8/40 itens; limites finitos para 1/6; troca dinâmica para uma nova identidade de lista; retenção de imagens e cleanup de listeners já existentes. Fixtures isoladas, sem alterações de dados staging.

Métrica de 60 passos local com CPU 4×: nove imagens na janela, oito retidas por passo, 60 substituições e 120 commits. Mantida redução de 88,9% contra as 540 substituições do baseline. A amostra de tempo React desta execução ocorreu concorrente ao build/testes e não é comparação temporal pareada. Heap e ciclos de GC não comprovam vazamento resolvido.

CI oficial e novo Preview: resultados finais registrados no relatório de entrega, após push do novo SHA. Fire TV física permanece NÃO TESTADA. Sem merge, alteração de Production, Firebase, Turso, grants, tokens, bindings ou autenticação.

Data: 07/11/2026. **Primeiro lote aprovado e implementado. GO para revisão deste lote; não é aprovação da P1 inteira nem autorização de integração/publicação.**

## 1. Isolamento e problema reproduzido

Branch: fix/p1-firetv-stability-20261107. Base: integração homologada aaea52442adb1783256f62a591d56b69e6e0af51, que contém os PRs #3/#4 sem merge em main. Checkout inicialmente limpo e já isolado em worktree. As branches originais não foram alteradas.

Problema confirmado no componente real TvContentRow: a janela de nove imagens era inteiramente substituída a cada avanço horizontal, mesmo quando oito itens continuavam presentes. Isso foi reproduzido com 40 itens locais, Fire TV 960×540/1920×1080 e Samsung 960×540, em Chromium com CPU 4×. O Enter selecionava o item correto, portanto a causa medida era trabalho repetido de montagem, não um erro geral de seleção.

Não foram reproduzidos nesta amostra: travamento extremo, reinicialização da interface ou crescimento ilimitado de DOM. Não se atribui a esta correção a resolução desses sintomas históricos.

## 2. Causa e correção

A chave anterior combinava slot e item. Quando um item se deslocava para outro slot, a chave mudava e o React desmontava sua instância. A chave agora combina índice de origem, ID e ocorrência visível. Assim, itens compartilhados mantêm sua identidade e cópias simultâneas em janelas circulares continuam distintas, incluindo os casos de sete e oito itens.

A correção do produto é restrita a TvContentRow. Foram preservados o ref de medição no slot zero, as regras finito/infinito, os índices de seleção, a duração/curva das animações, o layout, os gradientes e a navegação espacial. Nenhuma mudança cosmética.

## 3. Métricas antes/depois

Dados completos: [p1-firetv-carousel-metrics.json](docs/validation/p1-firetv-carousel-metrics.json). São execuções diagnósticas individuais, não um estudo estatístico nem medição em hardware físico.

| Cenário: seis avanços | Antes | Depois |
|---|---:|---:|
| Imagens compartilhadas retidas por passo, lista de 40 | 0 de 9 | 8 de 9 |
| Substituições de imagens em seis passos | 54 | 6 |
| Operações addEventListener durante os passos | 108 | 12 |
| Commits React | 12 | 12 |
| Tempo React acumulado, Fire TV 960×540 | 86,7 ms | 54,4 ms |
| Tempo React acumulado, Fire TV 1920×1080 | 88,5 ms | 41,5 ms |
| Tempo React acumulado, Samsung 960×540 | 83,1 ms | 39,5 ms |
| Nós do DOM ao final da matriz comparativa | 129 | 129 |

| Fire TV 960×540: 60 avanços, CPU 4× | Antes | Depois |
|---|---:|---:|
| Substituições de imagens | 540 | 60 |
| Operações de registro de eventos | 1.080 | 120 |
| Tempo React acumulado | 856,4 ms | 394,3 ms |
| Heap JS inicial após GC | 11.331.444 bytes | 11.340.448 bytes |
| Heap JS final após GC | 13.363.292 bytes | 12.259.004 bytes |
| Crescimento observado de heap | 2.031.848 bytes | 918.556 bytes |
| DOM final | 129 | 129 |

As substituições e os registros de eventos caíram 88,9%; o tempo React do teste prolongado caiu aproximadamente 54%. O número de commits não caiu: cada transição ainda atualiza o estado necessário; o trabalho dentro desses commits diminuiu. O crescimento de heap observado caiu cerca de 55%, mas **não se declara um vazamento de memória resolvido**.

Os tempos até estabilização incluem animação, polling e dois frames de observação; não são latência pura de entrada. A matriz comparativa original foi preservada. O harness depois inclui um wrapper de teste para troca de lista/desmontagem, sem mudar dados ou DOM dos cards. A ferramenta final desabilita HMR para impedir interferência de builds/testes concorrentes; o smoke test dessa versão confirmou a retenção de oito imagens em todos os contextos.

## 4. Investigação de memória e ciclo de vida

Foram observados dez ciclos adicionais de montagem/desmontagem com GC explícito. Os contadores globais do navegador oscilaram entre 16/166 nós, 1/2 documentos e aproximadamente 191–218 listeners, sem crescimento acumulativo nesses contadores. O heap JS após GC cresceu de 11.479.092 para 11.972.660 bytes nesses ciclos. Contadores globais incluem documentos não visíveis; não são contagem de componentes React vivos.

As regressões verificam separadamente que cada desmontagem retorna a contagem de listeners resize ao nível anterior e remove os controles focados do DOM. As operações de registro de eventos nas imagens removidas não foram confundidas com listeners permanentemente abandonados.

Persistem como investigação futura: separar aquecimento/retentores do runtime de desenvolvimento de retenção da aplicação, e obter perfil de longa duração em build de produção e hardware Fire TV. Não foi aplicada uma segunda correção de memória sem causa demonstrada.

## 5. Testes de regressão e navegação real

- **RED comprovado:** o novo teste falhou antes da correção com “40 items: preserve shared image nodes, retained 0”.
- **GREEN:** dez combinações de listas de 1, 6, 7, 8 e 40 itens em 960×540/1920×1080. Retenção dos nós compartilhados, direita/esquerda, limites finitos, wrap circular, Enter durante e após a animação, item selecionado, foco visível, troca por lista menor com nova identidade e três ciclos de desmontagem por caso. Sem warnings de chaves React duplicadas ou erros não tratados.
- npm run test:p1-browser: aprovado; a nova regressão integra esse comando já executado pela CI oficial. Também passaram o benchmark de resize, ciclo de vida de TV ao vivo e cancelamento/decodificação de imagens existentes.
- npm run test:tv-carousel-finite-infinite e test:tv-carousel-transitions: aprovados.
- npm run test:tv-focus-browser: interface real com login simulado somente no servidor de testes, perfil assíncrono, foco inicial, quatro setas, Enter, Escape/Back, restauração e mudança de páginas; aprovado em 960×540 e 1920×1080.
- npm run test:auth-routes-browser: desktop 1440×900, mobile 390×844 e ativação TV nas duas resoluções; aprovado.
- npm run lint: aprovado, zero findings/newViolations, incluindo typecheck.
- npm run build: aprovado, incluindo validate:firebase-env, lint, test:stability, build:api e bundle Vite. Configuração Firebase sintética igual à CI usada somente no processo local; nenhuma variável remota foi alterada.
- Revisão independente do diff: nenhum achado acionável de bug/regressão.

O build registrou avisos de chunks maiores que 600 kB e módulos importados de forma estática/dinâmica. Não foram escondidos nem tratados com refatoração fora deste lote. Arquivos api/index.mjs e rankings mensais regenerados pelo build/testes foram restaurados ao conteúdo Git anterior; não fazem parte da alteração.

## 6. Benchmark reproduzível

Com as dependências e Chromium já instalados:

~~~sh
npm run benchmark:tv-carousel -- --output /caminho/fora-do-git/row-metrics.json
npm run benchmark:tv-carousel -- --soak --output /caminho/fora-do-git/row-soak.json
npm run benchmark:tv-carousel -- --lifecycle --output /caminho/fora-do-git/row-lifecycle.json
~~~

A ferramenta usa o componente real e imagens SVG locais, limita CPU a 4×, bloqueia todos os destinos externos e mede nós preservados, React Profiler, operações de eventos e heap após GC. Não requer conta, token, banco ou servidor remoto. Não executar em paralelo com carga intensa para comparar tempos.

## 7. Reprodução, sincronização e hardware

Nenhum comportamento do player foi alterado. A homologação audiovisual P0.1 anterior foi preservada; não foi repetida como se fosse evidência de uma mudança no player. Tempo até primeiro frame, troca de episódio, buffering, codec e sincronização PC/celular/TV não foram homologados novamente neste lote. Permanecem na fase P1 posterior.

**Fire TV física: NÃO TESTADA.** User agent e CPU simulados não equivalem a Silk/Tizen físicos. Nenhuma fonte foi habilitada para forçar reprodução; nenhuma proteção de autenticação foi removida.

## 8. Riscos e recomendação de integração

GO para revisar o primeiro lote como Draft PR sobre integration/p0-1-pr3-pr4-20261106, mostrando apenas a P1. Não fazer merge nessa base nem em main nesta tarefa. Após resolver a base dos PRs #3/#4 e o bloqueio de segurança GitHub anterior, preparar a aplicação da alteração P1 à base final e revalidar o SHA resultante antes de propor integração.

A CI oficial deve ser acompanhada no SHA exato do Draft PR. Um eventual Preview automático sem bindings específicos P1 não autoriza copiar credenciais ou alterar Vercel; registrar o bloqueio sem fallback para Production.

A hipótese de categorias montarem fileiras distantes ainda não foi medida/corrigida. Reinicializações, travamentos extremos, player e consistência entre dispositivos continuam pendências da P1 geral. Esta entrega não declara esses problemas resolvidos.

Sem merge, promoção, rollback, deployment de Production, alteração Firebase/Turso, grants, credenciais ou PRs #3/#4.
