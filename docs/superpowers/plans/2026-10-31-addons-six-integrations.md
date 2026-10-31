# Plano de Implementação — Integração Completa dos Seis Add-ons e Deploy em Produção

**Objetivo:** Integrar os 6 add-ons solicitados (CineTorrent, ThePirateBay+, Brazuca Torrents, Orion, MY CINE, AIOStreams) na infraestrutura existente da ZapiTV sem alterar o design visual, preservando os provedores atuais, garantindo a compatibilidade de reprodução na Fire TV / navegadores e publicando em Production na Vercel (`https://zapitv-stream.vercel.app/`).

---

## 1. Mapeamento Arquitetural dos 6 Provedores

| Add-on | ID Estável | URL / Manifest Base | Tipos Suportados | Requer Config? | Status Padrão | Observações Técnicas |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **CineTorrent** | `cinetorrent-pt` | `https://150203dd784e-cinetorrent-addon.baby-beamup.club/manifest.json` | `['movie']` (filmes) | Não | `online` / `enabled: true` | Manifesto declara series mas descrição avisa "TV Shows Support Comming Soon" e streams de séries vêm vazios. Validado para filmes com tags de áudio PT-BR. |
| **ThePirateBay+** | `thepiratebay-plus` | `https://thepiratebay-plus.strem.fun/manifest.json` | `['movie', 'series']` | Não | `offline` / `enabled: false` | Host oficial `thepiratebay-plus.strem.fun` encontra-se fora do ar (DNS ENOTFOUND). Registrado com isolamento de falha e deduplicação de infoHash contra Torrentio. |
| **Brazuca Torrents** | `brazuca-torrents` | `https://94c8cb9f702d-brazuca-torrents.baby-beamup.club/manifest.json` | `['movie', 'series']` | Não | `offline` / `enabled: false` | Não confundir com `torrentio-brazuca`. Instância comunitária beamup com timeout. Registrado de forma autônoma sem travar o pipeline. |
| **Orion** | `orion-addon` | `https://5a0d1888fa64-orion.baby-beamup.club/manifest.json` | `['movie', 'series', 'anime']` | **Sim** (API Key) | `offline` / `enabled: false` | Requer chave de API do Orionoid. Campo de configuração adicionado no painel administrativo. Não expor chaves públicas no código. |
| **MY CINE** | `my-cine` | `https://mycine.alwaysdata.net/manifest.json` | `['movie', 'series']` | Não | `offline` / `enabled: false` | Host AlwaysData fora do ar. Registrado como indisponível com erro isolado, sem tentativas infinitas nem endpoints não homologados. |
| **AIOStreams** | `aiostreams` | `https://aiostreams.elfhosted.com/stremio/configure` (Base) | `['movie', 'series', 'anime']` | **Sim** (Instância/UUID) | `offline` / `enabled: false` | Projeto de agregação distribuída. Campo de URL de manifesto personalizado no painel administrativo. Deduplicação com provedores já cadastrados. |

---

## 2. Modificações em Arquivos Existentes

### A. `src/core/providers/providerRegistry.ts`
- **Extensão de `ProviderConfig`:**
  - `supportedMediaTypes?: ('movie' | 'series' | 'anime')[]`
  - `requiresConfig?: boolean`
  - `configKey?: string` (ex: `apiKey` ou `customManifestUrl`)
  - `configDescription?: string`
  - `successRate?: number`
  - `recentErrorsCount?: number`
- **Registro nos `DEFAULT_PROVIDERS`:**
  - Adicionar os 6 novos provedores com IDs estáveis e configurações iniciais precisas.
  - Preservar rigorosamente os 15 provedores atuais com suas prioridades estabelecidas.
- **Tratamento Específico na Resolução:**
  - Filtrar provedores por `supportedMediaTypes`: se o provedor declara suporte apenas a filmes (como `cinetorrent-pt`), não despachá-lo para consultas de séries ou animes.
  - Para provedores que exigem configuração (`requiresConfig: true`), verificar se a configuração necessária foi preenchida antes de disparar requisições.
  - Tratamento de timeouts e cancelamento rápido para provedores offline sem prejudicar a concorrência.
  - Deduplicação de torrents por `infoHash` entre ThePirateBay+, Brazuca Torrents, CineTorrent e Torrentio.

### B. `src/core/providers/sourceReadiness.ts` e `streamValidator.ts`
- Garantir que fontes originárias dos novos add-ons passem pelas validações de prontidão técnica (`isSourcePlayableHere` e `isSourceTechnicallyPlayable`).
- No Fire TV / Navegador Web em HTTPS:
  - Fontes torrent puras sem Stremio Engine local ativo continuam marcadas com `notWebReady: true` para não tentar decodificar protocolos P2P brutos no elemento `<video>`.
  - Fontes HLS / MP4 diretas ou com Debrid/Proxy passam pela cadeia normal de reprodução.

### C. `components/AdminView.tsx`
- Atualizar a interface administrativa de provedores para exibir:
  - Nome e status operacional com badges claros.
  - Tipos de mídia suportados (Filmes / Séries / Animes).
  - Indicador de "Configuração Necessária" quando aplicável.
  - Modal ou formulário inline para configuração da API Key do Orion e da URL da instância do AIOStreams.
  - Latência e contadores de sucesso/erro.
  - Toggle de ativação e ajuste de prioridade.

### D. `tests/addons_six_integrations.test.ts`
- Criar suíte completa de testes cobrindo os 12 cenários obrigatórios:
  1. Presença dos 6 novos provedores no registro padrão sem duplicatas.
  2. Preservação integral dos provedores legados.
  3. CineTorrent: manifesto válido e restrição estrita a filmes.
  4. ThePirateBay+: isolamento de falha quando offline e detecção de DNS.
  5. Brazuca Torrents: independência de `torrentio-brazuca` e áudio PT-BR confiável.
  6. Orion: exigência de API Key e transição de status após configuração.
  7. MY CINE: detecção de indisponibilidade no AlwaysData sem bloquear o pipeline.
  8. AIOStreams: suporte a instâncias personalizadas e deduplicação de streams.
  9. Concorrência paralela e limite de contingência (pelo menos 6 fontes prontas).
  10. Compatibilidade com Fire TV e fontes não web-ready.
  11. Preservação de identidade canônica (Doctor Who, One Piece, títulos homônimos).
  12. Recuperação automática e quarentena de fontes falhas sem loops.

---

## 3. Plano de Tarefas Passo a Passo

- [ ] **Tarefa 1: Atualização da tipagem e registro padrão dos 6 add-ons em `providerRegistry.ts`**
- [ ] **Tarefa 2: Refinamento da busca progressiva, restrição por tipo e deduplicação inteligente**
- [ ] **Tarefa 3: Atualização do painel administrativo em `components/AdminView.tsx`**
- [ ] **Tarefa 4: Criação da suíte de testes `tests/addons_six_integrations.test.ts` e configuração no `package.json`**
- [ ] **Tarefa 5: Execução de testes de regressão, lint e build de produção**
- [ ] **Tarefa 6: Commit, push para `main` e publicação em Production na Vercel**
- [ ] **Tarefa 7: Relatório Final Completo**
