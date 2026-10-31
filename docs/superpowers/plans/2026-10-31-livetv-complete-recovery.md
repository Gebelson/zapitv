# ZapiTV — Plano de Recuperação Completa da TV ao Vivo

**Data:** 2026-10-31  
**Branch:** `feat/livetv-complete-recovery-p0`  
**Escopo:** Recuperação e estabilidade total dos canais ao vivo, eliminação de bugs nos adaptadores, suporte a múltiplas fontes por canal, avaliação de provedores (USA TV Next, Minha TV), validação de áudio/vídeo, prevenção de loops e deploy em produção na Vercel.

---

## 1. Arquitetura e Correções

### 1.1 `src/core/livetv/LiveTVProviderRegistry.ts`
- Corrigir o bug `!== id` em `toggleM3UAdapter` e `toggleStremioAdapter` para `=== id`.
- Garantir que cada adaptador seja habilitado e desabilitado corretamente por seu identificador único.
- Adicionar suporte a múltiplos adaptadores Stremio e M3U ativos simultaneamente.

### 1.2 `src/core/livetv/StremioLiveTVAdapter.ts`
- Rejeitar streams não compatíveis com navegador (`acestream://`, `magnet:?`, `infoHash`, `notWebReady: true`).
- Extrair múltiplos streams válidos por canal (`sources` e `backupStreamUrls`), tanto de `meta.streams` embutidos no catálogo quanto de consultas `/stream/:type/:id.json`.
- Eliminar o fallback cego `|| streams[0]`.

### 1.3 `src/core/livetv/OfficialChannelProvider.ts`
- Atualizar a URL da Rede Brasil (RBTV) para a fonte oficial ativa: `https://redebrasil.nuvemplay.live/hls/stream.m3u8`.
- Verificar a integridade das 66 entradas oficiais e garantir que nenhuma transmissão interna aponte para recursos 404.

### 1.4 `src/core/livetv/ChannelSourceResolver.ts` & `LiveStreamValidator.ts`
- Classificar e ordenar as fontes de um canal por pontuação de estabilidade (Oficial > Verificado > 720p estável > 1080p instável).
- Prevenção de loops com quarentena temporária das fontes que falham.
- Detecção precisa de manifestos válidos vs páginas HTML/bloqueios.

### 1.5 `src/components/livetv/LiveTvPlayer.tsx` & `TvLiveView.tsx`
- Alternância suave de fontes ao detectar falha ou stall persistente sem recarregar a árvore DOM.
- Detecção e tratamento de vídeo sem áudio ou áudio sem vídeo.
- Preservação da experiência de TV: numeração de canais, EPG, zapping pelo controle remoto, favoritos e performance na Fire TV.

---

## 2. Testes Obrigatórios
- Criar `tests/livetv_complete_recovery.test.ts`.
- Validar correção de adaptadores, extração de múltiplas fontes, ranking de estabilidade, recuperação contra erros HTTP, preservação de EPG e controle remoto.
- Integrar com a suíte de estabilidade (`npm run test:stability`).

---

## 3. Deploy em Produção (Vercel)
- Verificar build de produção (`npm run build:api && vite build`).
- Efetuar deploy em produção no projeto associado a `https://zapitv-stream.vercel.app/`.
