# ZapiTV: estabilização progressiva

## Estado inicial (18/10/2026)

- `main` em `d170d51`, sem alterações locais no início da auditoria.
- `npm run build` passava, mas não executava `tsc --noEmit` nem testes.
- `npm run lint` apresentava 94 erros TypeScript. A maioria estava no painel de feedback e em módulos do catálogo; 19 provinham do contrato Watch Party e 4 da intro no player.
- O clique em **Grupo** foi reproduzido no Chrome local: `TypeError: Cannot read properties of undefined (reading 'isHost')` em `WatchPartyModal`. O DOM ficou vazio. Erros de imagens, legendas externas e favicon observados no console não causaram essa tela branca.
- A remoção da interface e dos serviços de downloads no commit `8275ed0` é uma decisão existente e deve ser preservada.

## Mapa dos módulos

| Camada | Fluxo e responsabilidades atuais |
| --- | --- |
| Entrada | `index.tsx` inicializa Dexie e monta React Router e TanStack Query. |
| Interface | `App.tsx` concentra navegação e catálogo; `ContentDetailModal.tsx` coordena detalhes, fontes, player e entrada na Watch Party. |
| Reprodução | `ZapiPlayer.tsx` controla vídeo, intro e preferências; `playbackSessionService.ts` mantém o estado da sessão. |
| Watch Party | `WatchPartyService.ts` agrega sala, estado, chat, voz, transmissão, sincronização e transporte Trystero; `WatchPartyModal.tsx` e `WatchPartyOverlay.tsx` consomem seu snapshot. |
| Backend | `server.ts` expõe APIs Express; `api/index.mjs` é o bundle de Functions na Vercel; Turso/Drizzle armazena dados centrais. |
| Cache | Dexie e `public/sw.js` mantêm dados e shell PWA locais; alterações de cache exigem verificação para preservar progresso e preferências. |

O estado da sala pertence ao `WatchPartyRoomManager`. `WatchPartyService.getRoomState()` publica o contrato consumido pelos componentes. A refatoração anterior deixou de publicar `localParticipant`, `isActive`, `mediaMetadata` e os tempos da intro. O acesso a `localParticipant.isHost` produzia a primeira exceção fatal. As duas entradas do modal, em `App.tsx` e `ContentDetailModal.tsx`, dependem do mesmo contrato.

## Primeira entrega: proteção e regressões

- Restaurado o contrato do snapshot da sala, derivando o participante local da lista canônica e preservando os campos existentes.
- Adicionada contenção de erros de renderização no modal, no overlay e na raiz, com registro no console e retorno visível quando necessário.
- Corrigida a troca remota de episódio para manter a sessão e não reiniciar a intro.
- Corrigido o episódio passado ao modal, usando o campo real `playbackContinuity.episode`.
- Testes automatizados sem novas dependências: `npm run test:stability` (executado também pelo build) e `npm run test:watchparty-smoke` com servidor local ativo.

Após essas mudanças, `npm run lint` ainda reporta 69 erros preexistentes em outras áreas. O build e os três testes direcionados passam. A correção da tela branca foi validada no site publicado com o teste de navegação em Chrome. Não há medição de performance antes/depois nesta etapa.

## Segunda entrega: estado e conexão da Watch Party

- Um convite agora preenche a sala e abre o formulário para o convidado escolher seu nome antes da entrada. O ingresso automático ignorava esse nome.
- O horário de início e a duração da intro são mantidos no estado da sala do anfitrião e do convidado; antes eram enviados apenas na mensagem de início.
- `npm run test:watchparty-two-browsers` cobre entrada por convite, nomes, presença sem duplicação, chat nos dois sentidos e saída. Usa dois navegadores reais e exige o servidor local.
- `npm run test:watchparty-intro` cobre o contrato de tempo da intro, integrado ao build por `test:stability`.

O teste de dois navegadores passou no localhost. Voz, compartilhamento de tela e reprodução real em múltiplos dispositivos ainda exigem validação própria; o teste não afirma cobri-los.

## Checkpoints que ainda precisam de validação

1. **Estabilização estrutural:** validar voz, compartilhamento de tela e reprodução real em múltiplos dispositivos; ampliar testes de recuperação.
2. **Organização e produção:** testar catálogo automático entre instâncias, painel com login real, cache e Service Worker em atualizações de deployment; medir desempenho antes de otimizar.

Evitar mudanças amplas até que cada fluxo afetado tenha um teste de regressão reproduzível.

## Terceira entrega: contratos, persistência e gates

- Corrigido o contrato JSON de listagem de feedback e os campos que o painel lia com nomes antigos. O painel mantém o layout e usa os campos reais de clusters, estatísticas, relatos e prompts.
- Todas as rotas administrativas de feedback agora verificam o token Firebase e a lista de UIDs permitidos no servidor. O envio anônimo continua público. O UID verificado, em vez do nome enviado pelo navegador, identifica edições administrativas.
- O feedback na Vercel passa a usar um snapshot versionado no Turso já existente. Gravações concorrentes fazem nova leitura e tentam novamente; indisponibilidade do banco retorna erro, sem declarar sucesso não persistido. O arquivo JSON local não foi apagado.
- Corrigidos contratos de metadados do catálogo que permitiam inserir itens sem pôster/nota e acessos a campos inexistentes. Um título pendente só é publicado após recuperar metadados da identidade confirmada. Não foram inseridos dados fictícios.
- `npm run build` agora executa `tsc --noEmit` e os testes de contratos, autenticação e persistência. O typecheck passou de **94 erros iniciais para 0**. O teste de Turso local gravou seis relatos concorrentes sem perda e verificou a atualização administrativa.

### Medidas e limites

- Bundle principal Vite: **565,50 kB / 159,29 kB gzip** no build anterior; **565,55 kB / 159,30 kB gzip** após esta etapa. Isso não constitui ganho de velocidade; nenhuma otimização ampla foi feita sem medição.
- API empacotada: **798,4 kB → 803,8 kB**. O crescimento inclui o repositório de feedback.
- O teste de dois navegadores verifica presença, nomes e chat. Ele não prova sincronização de vídeo, áudio da mídia, voice chat ou compartilhamento de tela em dispositivos reais.
- O repositório de feedback usa um snapshot com limite de 2 MB para evitar gravação silenciosa excessiva. Volumes maiores exigirão tabelas relacionais e paginação no Turso. O catálogo de lançamentos automáticos ainda mantém estado em memória no servidor; sua persistência entre instâncias da Vercel precisa de migração específica.
- A suíte antiga baseada em Vitest ainda não é executável porque o projeto não declara essa dependência. Os novos testes usam `tsx` e fazem parte do build. Lighthouse, voz/WebRTC real e painel com login Firebase real não foram medidos nesta entrega.
