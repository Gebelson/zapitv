# Dependencias

Dependency Cruiser: 297 modulos alcancaveis, 18 ciclos relatados e uma dependencia core -> UI. Nao corresponde a contagem total do repositorio. JSON e Mermaid em reports/. Knip executado para revisao manual, sem exclusoes automaticas. Baseline registra identidade e multiplicidade; novas violacoes falham na CI. Nao aumentar baseline para acomodar extracoes.

Referencias: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md ; https://www.jsboundaries.dev/docs/ .


## Resultado incremental

A extracao do tipo de ordenacao removeu a unica aresta core -> UI observada. Restam 18 ciclos conhecidos; nenhum ciclo foi declarado removido. ESLint usa resolver TypeScript para imports sem extensao. O servidor raiz tem regra explicita de imports UI. Testes exercitam ambos e verificam que o checker completo rejeita um arquivo real temporario, removido no finally.

Knip: 238 arquivos com grupos de findings, preservados em reports/unused.json. Nada foi eliminado automaticamente. Npm reportou vulnerabilidades no conjunto instalado; nao foi executado audit fix nem atualizado o runtime indiscriminadamente.
