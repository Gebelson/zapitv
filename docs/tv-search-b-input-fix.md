# Busca TV — B e confirmação do controle remoto

Base: `5ec19f6`, branch `codex/fix-tv-b-input-20261102`.

## Evidências e causa

- A versão anterior já registrava o listener em captura antes de inicializar Norigin e já excluía 66 do keyMap. Essas proteções foram preservadas; não se atribui a elas uma alteração que já existia.
- O classificador anterior rejeitava `key=Enter, code=KeyB, keyCode=66`, pois dava prioridade absoluta a `code=KeyB`. O teste do componente real reproduziu a falha: B destacado com setas, confirmação enviada, pesquisa continuava vazia.
- Quando `key` era vazio/Unidentified e `code=KeyB`, o classificador reconhecia que não era Enter, mas o listener de texto não recuperava a letra pelo código físico.
- O teclado tinha dois bloqueios por tempo (100/150 ms), capazes de eliminar pressionamentos distintos rápidos. Os testes anteriores inseriam pausas de 200 ms e frequentemente moviam foco por uma função global em vez de setas.

## Correção

`tvKeyboardEvent.ts` contém uma única interpretação de texto/confirmação, exportada pelo gerenciador existente. Caracteres explícitos continuam sendo texto; Enter/Select/OK explícitos prevalecem sobre códigos legados contraditórios; código físico KeyB recupera b/B quando falta key. Eventos DOM não são reescritos, inclusive quando keyCode é não configurável.

O gerenciador em captura encaminha confirmações exatamente uma vez aos handlers existentes/Norigin, impede a ação padrão duplicada do botão e ignora repetição sinalizada de Enter. O texto da busca utiliza o registro de comandos já existente, com limpeza ao desmontar. Não há segundo sistema de navegação. Foram removidas as duas travas por tempo do teclado; cliques/toques distintos e pressões completas distintas continuam válidos.

Grade, estilos, dimensões, Espaço/Apagar/Limpar, filtros, resultados e otimizações Fire TV preservados. O teclado virtual existente é minúsculo: Breaking Bad e Barbie são inseridos como breaking bad e barbie; a busca permanece insensível a maiúsculas. O teclado físico preserva a caixa digitada.

## Validação

- 13 testes determinísticos do interpretador: aprovados.
- Playwright monta o TvSearchView real pelo harness existente, usa setas reais e verifica destaque e conteúdo real do DOM, sem usar __setTvFocus para posicionar letras.
- Perfis Chromium com User-Agent de Silk, Tizen, webOS e desktop: seis pesquisas físicas e virtuais, todas as 36 letras/números, bbb rápido, Enter repetido/solto, clique e toque, eventos 13/66/65385, KeyB e key vazio/Unidentified. Confirmação em filtro e retorno também verificados. Zero exceções JavaScript.
- Navegação TV e oito contratos do fluxo de perfis: aprovados.
- Browser do seletor de perfis: 20 cenários aprovados, incluindo seleção normal e repetida por OK, retorno e isolamento. São simulações Chromium, apesar do texto antigo desse teste usar a palavra homologação.
- Ambiente local: faltava heic2any 0.0.4, já declarado no package.json/lock. Foi disponibilizada a mesma versão em runtime isolado, sem alterar dependências declaradas, lock ou outras bibliotecas. O ensaio anterior do seletor falhou antes dessa correção de ambiente; a execução final passou.
- Build de produção/TypeScript/estabilidade: aprovados; Vite compilou em 10,29 s.

O teste Playwright foi retirado da cadeia de build determinística da Vercel e permanece como passo obrigatório do GitHub Actions após instalar Chromium. A cadeia de estabilidade executa os testes puros novos; nenhuma asserção de teclado foi removida para fabricar aprovação.

## Limites

Sem Fire TV/Silk, Tizen ou LG físicos acessíveis. Não há homologação física. Quando B físico e OK produzem eventos realmente idênticos (sem key/code distinguíveis), JavaScript não pode descobrir uma origem ausente. Na experiência TV, o legado 66 sem informação textual é tratado como confirmação; KeyB identifica texto quando disponível. Esse limite exige observação no dispositivo com o diagnóstico existente, não um palpite adicional sobre a origem.

Publicação: autorizada em Production. Confirmar o novo commit e alias zapitv-stream.vercel.app após o build. Não há alteração de banco ou credenciais. Reversão, se necessária, por commit revisado de código, sem apagar dados.
