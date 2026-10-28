# P4.B.3 — operações offline recusadas

Base `61472e2`, mesma branch `codex/p4-b-3-remote-validation-20261028`.
Sem acesso/configuração de Turso/WSL, merge, push ou deploy nesta correção.

## Causa e alteração

`SyncQueueManager.flush` removia todos os UUIDs enviados quando o envelope HTTP
declarava sucesso. Ignorava recusas individuais e respostas incompletas.

- Só sai da fila um UUID enviado e confirmado individualmente com sucesso, sem
  erro contraditório, como aplicado ou duplicata já processada. Resultados ausentes,
  estranhos ou duplicados/ambíguos não confirmam operações.
- Recusa por expiração/timestamp inválido e conflito remoto conhecido viram
  `syncState=conflict`. UUID, timestamp, ação e payload originais são preservados
  na mesma fila persistente da conta/perfil. Uma única gravação mantém a transição
  e evita remover um registro antes de salvar sua cópia de recuperação.
- Falhas transitórias ficam pendentes. Tentativas automáticas são limitadas a
  cinco por operação, com backoff; o contador sobrevive ao reload. Recusas
  permanentes não são reenviadas. O botão de retry atua somente nas pendentes,
  sem trocar UUID/timestamp nem reenviar conflitos.
- O enqueue não modifica UUID já tentado/em voo. Assim, uma confirmação antiga
  não apaga uma nova alteração criada durante o envio.
- Logout/troca de conta ou perfil cancela timers/requests, preserva o armazenamento
  e invalida respostas antigas. Nenhuma fila de outra conta é enviada pela sessão
  atual. Filas legadas sem conta não são adotadas automaticamente por outra conta.
  Seus dados continuam intactos, sem atribuição privada presumida.
- Removido o truncamento silencioso dos dados persistidos em 500 registros.
  Se o navegador recusar a gravação, a interface avisa para manter a aba aberta;
  não há promessa de durabilidade quando o próprio armazenamento está indisponível.
- `SyncClient.pushBatch` conserva o timeout de oito segundos junto com o sinal
  de logout; timer e listener são removidos em `finally`.

## Revisão segura

Aviso discreto para a conta/perfil ativos, nas interfaces existentes. Não aparece
sobre as rotas de reprodução. Permite revisar alterações e escolher **Manter no
dispositivo**. A comparação faz apenas GET do estado atual, com identidade e
temporada/episódio correspondentes. Falha de consulta não é exibida como registro
remoto vazio. Logout/troca de escopo invalida o resultado da comparação.

Não existe botão de forçar sobrescrita/retimestamp/reenvio de conflito. Para mudar
o remoto, o usuário precisa revisar e realizar uma nova ação explícita pela
interface existente. A operação recusada original continua preservada. Os botões
de revisão/preservação também funcionam com foco TV, Enter e Voltar.

## Testes efetivos

- A nova suíte falhou na base: lote misto terminou com zero registros, quando dois
  deveriam permanecer. Após correção, preservou a recusa de oito dias e a falha
  transitória, removendo somente a operação confirmada.
- `test:outbox-recovery`: classe/cliente reais, respostas HTTP controladas. Abrange
  lote misto e fora de ordem, UUID estranho, envelope 200 com recusa, resposta
  incompleta/contraditória, rede, duplicata, TTL, reload, logout/relogin, conta/perfil,
  limite de retries persistido, comparação sem escrita, enqueue durante request,
  resposta tardia após logout e timeout com sinal externo. Todos passaram.
- `test:outbox-browser`: Chromium com localStorage real em contextos descartáveis,
  APIs controladas. Aviso, comparação remoto/local, preservação, F5, troca de conta
  e retorno passaram. Contexto TV simulado validou Enter/Back. Zero mutações de
  escrita durante revisão/preservação; zero exceções JS. Não é teste físico Tizen.
- P3.D (25 cenários) e P4.A (12 cenários), HTTP local/SQLite: passaram. O caso
  antigo de idempotência P3.D usava data fixa de 2023, já expirada pela regra P4.B.2;
  agora usa data atual e exige explicitamente sucesso e reconhecimento de duplicata.
  Não foi relaxada a retenção de sete dias.
- TypeScript/lint e `npm run build` completos aprovados (saída 0). Permanecem
  os avisos existentes de chunks grandes. O build
  inclui a nova suíte determinística; browser fica no CI com Chromium preparado.
  Simulações não representam homologação Turso. Estimativas de consumo impressas
  pela suíte antiga P4.A não foram tratadas como métricas reais nesta entrega.

Arquivos principais: `syncQueue.ts`, `syncClient.ts`, ligação de escopo em
`storageService.ts`, `SyncRecoveryNotice.tsx` e pontos de montagem em `App.tsx`.
Incluídos testes, fixture browser e comandos/CI correspondentes. Player, fontes,
catálogo, autenticação e regras do servidor não foram alterados.

Limites: armazenamento bloqueado/cheio não permite garantir novas gravações
duráveis; o aviso explicita a preservação apenas em memória nesse caso. Limpar
dados do navegador ou descarte deliberado continuam fora da garantia. Testes
remotos e em dispositivos físicos permanecem separados e não foram realizados.
