# Persistência local — auditoria P0 (2026-10-27)

Base: `1a351fe` (inclui a correção existente do Continuar Assistindo).
Branch de trabalho: `codex/data-integrity-20261027`. Sem publicação em produção.

## Mapa verificado

| Domínio | Implementação real | Persistência |
| --- | --- | --- |
| Histórico e Continuar Assistindo | `storageService`, `HistoryPage`, `MobileHomeView`, `MobileMyZapiView`, `App` | O histórico é o conjunto de registros de progresso; não existe uma segunda tabela de histórico ativa. |
| Posição e episódios | `ZapiPlayer.flushProgress` → `storageService` | IndexedDB/Dexie `keyValueStore`, espelho localStorage e cache em memória. Player preservado. |
| Minha Lista e favoritos | `index.tsx`, handlers e listeners existentes de `App`, `storageService` | Antes: bootstrap local, mas botões gravavam somente no Firestore. Agora também usam a persistência local central. Integração remota preexistente preservada. |
| Preferências de recomendação | `userPreferenceStore` | `zapitv_user_prefs_*`, IndexedDB e localStorage; contexto de perfil preexistente preservado. |
| Legendas e estilo | `subtitlePreferenceService`, `subtitleStyleService` | `zapitv_subtitle_user_preference`, `zapitv_subtitle_style`, localStorage e memória. Não foram unificados com progresso. |
| Reprodução automática e sons | `autoPlayService`, `uiSoundService` | `zapitv_autoplay_next_episode`, `zapitv_ui_sound_v1`, `zapitv_ui_sound_tv_v1`; preferências distintas de TV/desktop são intencionais. |
| Sessão/intro | `playbackSessionService` | `zapitv_playback_session_v1`, sessionStorage; não é o armazenamento durável do histórico. Preservado. |
| Catálogo/administração | `db.ts`, `storageService` (cache), `AdminView`, `TvHomeView`, serviços de catálogo | IndexedDB, caches locais e integração existente. Catálogo não foi alterado. |
| Atualização | `public/sw.js`, ação Atualizar de `TvProfileMenu` | Removem caches do app shell; não apagam localStorage/IndexedDB. |

Acessos diretos nos componentes: `App` (ordenação de categorias), `AdminView` e
`TvHomeView` (destaques administrativos), `TvLiveView` (último canal). `TvProfileMenu`
preserva os dados ao atualizar. Acessos por domínio também existem em serviços de
busca, recomendações/consentimento, legendas, som, Ao Vivo, rankings, provedores,
segurança, feedback e caches de catálogo. Não são todos o mesmo dado; centralizá-los
indiscriminadamente alteraria recursos fora do escopo. Não há segunda base Dexie de
progresso. `db.ts` continua usando o esquema existente da `ZapiTVDatabase`.

## Falhas comprovadas e correções

1. `resolveWatchProgress` aceitava igualdade de título e aliases numéricos sem tipo.
   Agora usa identificadores existentes com domínio de mídia e nunca o título.
   Consultas por string ambígua retornam ausência em vez de selecionar outra obra.
2. O cache de inicialização sobrescrevia progresso local recente com IndexedDB antigo.
   A migração concilia registros por identidade e data, preservando o mais recente.
3. `saveProgress` fazia leitura/alteração/gravação sem serialização. Atualizações
   simultâneas podiam perder títulos ou episódios. O novo limite de armazenamento
   serializa operações locais e usa transação IndexedDB entre conexões/abas.
4. localStorage e IndexedDB eram gravados no mesmo `try`. Falta de quota no primeiro
   impedia o segundo. Os caminhos agora são independentes, com fallback em memória
   e aviso sem dados pessoais se ambos estiverem indisponíveis.
5. `getFavorites` retornava vazio quando a linha IndexedDB faltava, mesmo havendo
   localStorage válido. Leitura e migração agora consideram ambas as cópias.
6. Botões de listas não gravavam no armazenamento usado pelo bootstrap. Foram
   ligados ao serviço; bootstrap, hidratação e integração remota existente usam os
   mesmos dados locais. Toggles são operações serializadas, sem depender de estado
   React atrasado. Não foi criada sincronização remota.
7. O histórico persistido era truncado em 30 registros, mas o cache em memória não.
   Os registros disponíveis agora são preservados; não é possível recuperar itens
   já descartados por versões anteriores sem uma cópia externa.
8. Validação de posição, duração, data, tipo e temporada/episódio era insuficiente.
   Entradas inválidas não entram na nova estrutura; percentuais são recalculados.
   Filmes e animes em formato filme não recebem episódios pelos valores padrão do
   player. Cada episódio mantém sua própria posição, inclusive em gravações atrasadas.
9. Preferências de recomendação tinham o mesmo acoplamento de falhas de gravação e
   podiam ignorar uma cópia IndexedDB mais recente. A leitura inicial concilia datas,
   valida a estrutura e evita substituir preferências existentes por metadados vazios.

## Estrutura e migração

- `localDataStore.ts`: fronteira tipada de leitura/atualização, transação, fallback,
  revisão e versão. `LocalDataBackend` permite uma implementação futura sem acoplar
  consumidores a um fornecedor externo. Nenhum backend novo foi provisionado.
- `watchState.ts`: validação e identidade de mídia/episódio; preserva `contentId` e
  `ContentItem` existentes, usando IDs canônicos/IMDb/TMDB/AniList quando disponíveis.
- `zapitv_watch_state_v2`: envelope `{ version: 2, revision, updatedAt, data }` com
  itens e episódios em uma única atualização. Chave de episódio inclui identidade,
  temporada e episódio. Conclusão continua derivada da regra existente de 92%.
- `zapitv_local_favorites_v2` e `zapitv_local_mylist_v2`: envelopes com IDs opacos
  existentes, validados e sem duplicações. Não inferem identidades pelo título.
- Fontes legadas: `zapitv_local_progress`, `zapitv_episode_progress`, registros válidos
  em `zapitv_local_history`, `zapitv_local_favorites`, `zapitv_local_mylist`.
- Migração preguiçosa na primeira leitura; novas leituras não reaplicam o legado
  nem incrementam a revisão. As chaves antigas ficam intactas como backup.
- Um snapshot vazio após limpeza explícita impede a ressurreição do backup antigo.
  A ação explícita Limpar histórico também remove as cópias legadas de histórico;
  isso não ocorre durante a migração ou leitura normal.
  Réplica inválida é ignorada em favor da réplica íntegra; a retomada do IndexedDB
  repara uma cópia atrasada usando o estado mais recente do fallback.
- Exportação 2.0; importação aceita 1.0/1.1 e 2.0, valida e mescla registros sem
  apagar dados atuais. Configuração de provedores mantém o contrato preexistente.
  Importação entre domínios pode ser parcial se uma operação externa ao repositório
  (como salvar configuração de provedores) falhar; repetir a importação é idempotente.

As migrações desta tarefa foram executadas somente com fixtures, em armazenamento
descartável. Os dados reais dos usuários não foram acessados nem migrados por este
trabalho. A aplicação executará a migração quando esta alteração for disponibilizada.

## Verificação

- `test:storage-integrity`: histórico, retomada de filme/série/anime, colisão de IDs,
  temporada/episódio, timestamps, duplicatas, gravações concorrentes, migração
  idempotente, backup legado, importação, dados inválidos e falha dos armazenamentos.
- `test:storage-browser`: Chromium em viewports desktop, mobile e TV; IndexedDB e
  localStorage reais de contextos descartáveis, dados preexistentes, duas abas,
  recarregamentos, listas, quota simulada e limpeza sem ressuscitar o legado.
- `test:mobile-cw-dedup`: regressão existente do Continuar Assistindo preservada.
- O teste de navegador fica no CI após instalar Chromium; não integra o build da Vercel.
- `npm run build`: aprovado (TypeScript/lint, suíte de estabilidade, build da API e
  bundle Vite). Após o ajuste final de aliases, os testes de persistência, navegador,
  TypeScript e bundle foram verificados novamente sem repetir toda a suíte.
- Apenas avisos de tamanho de chunks no Vite; nenhum erro de compilação.
- O workflow remoto de CI não foi disparado nesta entrega sem publicação; seus
  novos comandos foram executados localmente.

## Limites e evolução recomendada

- Nenhum teste físico em Samsung/Tizen, MSX ou Fire TV; viewports Chromium não
  comprovam compatibilidade ou desempenho nesses aparelhos.
- Se IndexedDB e localStorage estiverem ambos bloqueados/cheios, só é possível
  preservar a sessão em memória. Remover dados do navegador/origem também os elimina.
  O último salvamento concluído sobrevive ao reload; um encerramento forçado não
  garante a conclusão de operações ainda em andamento.
- Episódios legados sem metadados suficientes para distinguir obras são preservados
  sem atribuição automática a uma obra ambígua. Dados já sobrescritos não são inventados.
- Listas mantêm IDs existentes porque os contratos dos botões recebem esses IDs.
  Uma associação futura a conta/perfil/dispositivo exigirá escopo explícito e nova
  migração, sem reaproveitar e-mails, títulos ou perfis fictícios como identidade.
- Histórico permanece local ao navegador. Não houve cadastro, login, contas novas,
  perfis novos, sincronização entre dispositivos ou contratação de banco/serviços.
- Firestore já existe no projeto. Regras remotas e autenticação não foram alteradas
  nem declaradas auditadas por este trabalho de persistência local.
- Antes de retornar a uma versão antiga do app que desconhece v2, exportar os dados
  atuais. As chaves legadas são backup da migração, não um espelho de novas gravações.
- Snapshot de metadados segue o contrato existente do histórico; minimizar seus
  campos para um backend futuro exige validar antes o fallback da página de histórico.
  Nenhuma URL privada ou credencial foi incluída em logs de teste.
