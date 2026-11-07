# P1 Fire TV — primeiro lote de estabilidade

Estado: aprovado pelo proprietário em 07/11/2026; primeiro lote implementado e validado localmente.

## Objetivo e limites

Reduzir trabalho repetido na navegação horizontal sem alterar aparência, animação, catálogo, autenticação ou foco. Base homologada: `aaea52442adb1783256f62a591d56b69e6e0af51`; branch isolada: `fix/p1-firetv-stability-20261107`. Não modificar PRs #3/#4, main, Production ou serviços/credenciais.

## Evidência

O harness existente monta o componente real TvContentRow com 40 itens locais. Uma sonda Playwright adicional, fora do produto, bloqueia destinos externos e mede três contextos com CPU 4x: Fire TV 960x540/1920x1080 e Samsung 960x540. Cada avanço substitui os nove elementos de imagem; seis avanços substituem 54 imagens em cada contexto. A chave atual combina slot e item, logo todos os itens mudam de chave ao deslizar.

O DOM permanece em 129 nós após seis avanços e Enter seleciona fixture-6. A amostra de heap cresce, mas não prova vazamento. Os tempos até estabilização incluem a animação e a espera da ferramenta; não representam exclusivamente latência de entrada.

Uma amostra prolongada com 60 avanços manteve 129 nós, mas o heap JS após GC subiu de 11,33 MB para 13,36 MB. Antes de atribuir essa diferença a vazamento, comparar a retenção e o crescimento em ciclos equivalentes, incluindo o runtime de desenvolvimento. A investigação de memória integra o primeiro lote; a correção de chaves não será apresentada como solução automática desse crescimento.

## Abordagens consideradas

1. **Recomendada: identidade dos itens que permanecem na janela.** Preservar a instância de cada item compartilhado entre janelas consecutivas; distinguir cópias simultâneas em listas circulares, sobretudo sete itens. Manter medição por slot e resultado de seleção/foco. Evita reescrever a arquitetura e reduz remontagens.
2. **Alternativa: reciclar instâncias por posição fixa.** Diminui remontagens, mas obriga redefinir estado de erros, URL recuperada e operações assíncronas quando a posição recebe outro item. Maior risco de capa/progresso incorreto. Não recomendada para o primeiro lote.

Esta recomendação é uma decisão técnica proposta pelo agente, não uma aprovação já dada pelo proprietário.

## Implementação proposta

- Modificar somente a identidade de renderização necessária à causa confirmada; não alterar regras finito/infinito ou duração da animação para melhorar artificialmente as métricas.
- Preservar explicitamente duplicatas legítimas da janela circular, sem chaves duplicadas, e a referência de medição do slot zero.
- Acrescentar regressão comportamental verificando retenção de nós compartilhados e seleção correta após direita/esquerda, wrap, Enter e mudança de lista.
- Se não for possível preservar identidade/foco com correção pequena, parar essa abordagem e apresentar o motivo, sem migrar automaticamente para reciclagem de estado.

## Aceitação do primeiro lote

- Reduzir substituição dos nove nós em cada passo para somente os que entram/saem da janela, ou demonstrar por que o componente exige outra identidade.
- Validar listas de 1, 6, 7, 8 e 40 itens, incluindo wrap e sentido inverso, sem React key warnings ou seleção incorreta.
- Repetir a mesma medição baseline com dados, CPU e resoluções idênticos; registrar antes/depois, DOM e heap como observações, sem equivalência a hardware físico.
- Executar typecheck/lint aplicável, testes focados de carrossel e o gate comportamental local impactado. Build completo e checks obrigatórios antes de qualquer Draft PR.
- Depois desse lote, investigar montagem vertical/categorias, transições, player e sincronização em ordem de impacto. Não atribuir a essa correção a solução de reinicializações ou buffering ainda não reproduzidos.

## Dependências e entrega

A fase local usa somente fixtures e servidores loopback, sem credenciais ou autenticação remota. Validação entre dispositivos reais exige sessões staging autorizadas e dispositivos disponíveis; não exportar sessões. Fire TV física: NÃO TESTADA.

Não abrir Draft PR nem afirmar P1 concluída antes de implementar, testar e registrar resultados. O bloqueio de segurança GitHub anterior permanece separado; esta proposta não autoriza publicação.
