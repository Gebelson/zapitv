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

## Próximos checkpoints

1. **Estabilização estrutural:** validar voz, compartilhamento de tela e reprodução real em múltiplos dispositivos; ampliar testes de recuperação.
2. **Organização e produção:** reduzir os erros TypeScript restantes por módulo, consolidar testes executáveis, revisar duplicações comprovadas, cache, catálogo, banco e compatibilidade Vercel. Medir desempenho antes de otimizar.

Evitar mudanças amplas até que cada fluxo afetado tenha um teste de regressão reproduzível.
