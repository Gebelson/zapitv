import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { VERIFIED_OPEN_ITEMS } from "./src/core/catalog/verifiedCatalog.ts";
import { classifyStream, checkOpenSubtitlesPtBr, sortStreamsByPtBrPriority } from "./src/core/audio/audioDetector.ts";
import { OfficialChannelProvider } from "./src/core/livetv/OfficialChannelProvider.ts";
import { featuredRankingService } from "./src/core/rankings/FeaturedRankingService.ts";
import { weeklyFeaturedScheduler } from "./src/core/rankings/WeeklyFeaturedScheduler.ts";
import { imdbWeeklyRankingService } from "./src/core/rankings/IMDbWeeklyRankingService.ts";
import { catalogReleaseScheduler } from "./src/core/catalog/CatalogReleaseScheduler.ts";
import { CatalogReleaseStorageUnavailable, getPersistedReleases, runPersistedReleaseSync } from "./src/server/catalog/releaseRepository.ts";
import { collaborativeTrainer } from "./src/core/recommendations/CollaborativeTrainer.ts";
import { bannedContentRegistry } from "./src/core/catalog/BannedContentRegistry.ts";
import { FeedbackStorageUnavailable, withFeedbackStore } from "./src/server/feedback/repository.ts";
import { resolveValidationTargetUrl } from "./src/core/providers/validationTargetUrl.ts";
import { databaseRouter } from "./src/server/database/routes.ts";
import { authenticateAdmin } from "./src/server/database/firebaseAuth.ts";
import { watchPartyRouter } from "./src/server/watchparty/routes.ts";
import { publicHttpGet } from "./src/server/security/publicHttp.ts";
import { normalizeProxyRange } from "./src/server/proxyRange.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verificação passiva e silenciosa de disponibilidade do Streaming Engine (porta 11470)
// NUNCA cria subprocessos locais (cmd, powershell, spawn, node) nem abre janelas no sistema operacional
async function checkStremioEngineStatus(): Promise<boolean> {
  try {
    const probe = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(800) });
    return probe.ok;
  } catch {
    return false;
  }
}

function requireCronSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim() || req.header("authorization") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Autorização de cron necessária." });
  }
  next();
}

async function requireMaintenanceAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const actorUid = await authenticateAdmin(req.header("authorization"));
    if (!actorUid) return res.status(403).json({ error: "Autenticação administrativa necessária." });
    res.locals.actorUid = actorUid;
    next();
  } catch {
    return res.status(503).json({ error: "Verificação de autenticação temporariamente indisponível." });
  }
}

function createApp() {
  const app = express();
  const activeRequests = new Map<string, number>();
  const validationWindows = new Map<string, { count: number; expires: number }>();
  const allowPublicRequest = (key: string, limit: number): boolean => {
    const now = Date.now();
    const window = validationWindows.get(key);
    const nextWindow = !window || window.expires < now ? { count: 1, expires: now + 60000 } : { count: window.count + 1, expires: window.expires };
    validationWindows.set(key, nextWindow);
    if (validationWindows.size > 4096) {
      for (const [entryKey, entry] of validationWindows) {
        if (entry.expires < now) validationWindows.delete(entryKey);
      }
      while (validationWindows.size > 4096) validationWindows.delete(validationWindows.keys().next().value!);
    }
    return nextWindow.count <= limit;
  };

  // Normalização de rotas em ambientes serverless da Vercel (rewrites para /api/index)
  app.use((req, _res, next) => {
    if (req.url && req.url.startsWith('/api/index')) {
      const queryIdx = req.url.indexOf('?');
      const queryString = queryIdx >= 0 ? req.url.slice(queryIdx) : '';
      const matchPath = req.headers['x-matched-path'] as string;

      if (matchPath && matchPath.startsWith('/api/')) {
        req.url = `${matchPath}${queryString}`;
      } else if (req.query && typeof req.query.path === 'string') {
        const restQuery = new URLSearchParams(queryIdx >= 0 ? req.url.slice(queryIdx + 1) : '');
        restQuery.delete('path');
        const restStr = restQuery.toString();
        req.url = `/api/${req.query.path}${restStr ? '?' + restStr : ''}`;
      }
    }
    next();
  });

  // Enable JSON parsing
  app.use(express.json());
  app.use('/api/watchparty', (req, res, next) => {
    if (!allowPublicRequest(`watchparty:${req.ip || 'unknown'}`, 1800) ||
        (req.path === '/room/announce' && !allowPublicRequest(`watchparty-announce:${req.ip || 'unknown'}`, 120))) {
      return res.status(429).set('Retry-After', '60').json({ error: 'Muitas solicitações à sala.' });
    }
    next();
  });
  app.use('/api/recommendations/events', (req, res, next) => {
    if (!allowPublicRequest(`recommendations:${req.ip || 'unknown'}`, 240)) {
      return res.status(429).set('Retry-After', '60').json({ error: 'Muitos eventos enviados.' });
    }
    next();
  });
  app.use(['/api/proxy', '/api/validate-stream'], (req, res, next) => {
    const endpoint = req.path;
    const limit = endpoint === '/api/proxy' ? 128 : 24;
    const active = activeRequests.get(endpoint) || 0;
    if (active >= limit) return res.status(503).set('Retry-After', '2').json({ error: 'Capacidade temporariamente ocupada.' });
    if (endpoint === '/api/validate-stream') {
      if (!allowPublicRequest(`validation:${req.ip || 'unknown'}`, 600)) {
        return res.status(429).set('Retry-After', '60').json({ error: 'Limite temporário de validações excedido.' });
      }
    }
    activeRequests.set(endpoint, active + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeRequests.set(endpoint, Math.max(0, (activeRequests.get(endpoint) || 1) - 1));
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  });
  app.use('/api/db', databaseRouter);
  app.use('/api/watchparty', watchPartyRouter);

  // Helper function to resolve open items to Stremio streams
  function resolveOpenItemStreams(rawId: string, seasonNum = 1, episodeNum = 1) {
    let cleanId = rawId.replace(/\.json$/, '');
    if (cleanId.includes(':')) {
      const parts = cleanId.split(':');
      cleanId = parts[0];
      if (parts[1]) seasonNum = parseInt(parts[1], 10) || 1;
      if (parts[2]) episodeNum = parseInt(parts[2], 10) || 1;
    }

    if (bannedContentRegistry.isBannedKeyOrId(cleanId)) return [];

    const item = VERIFIED_OPEN_ITEMS.find(it => 
      it.id === cleanId || 
      (cleanId.startsWith('open-') && (
        (it.tmdbId && String(it.tmdbId) === cleanId) || 
        (it.imdbId && it.imdbId === cleanId)
      ))
    );

    if (!item || !item.id.startsWith('open-') || bannedContentRegistry.isBanned(item)) return [];

    if (item.episodes && item.episodes.length > 0) {
      if (seasonNum !== 1) return [];
      const ep = item.episodes.find(e => e.number === episodeNum);
      if (ep?.videoUrl) {
        const directUrl = ep.videoUrl;
        const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
        return [
          {
            name: 'ZapiTV Stream Core',
            title: `[EPISÓDIO ${ep.number}] ${ep.title} - Servidor Local ZapiTV`,
            url: proxyUrl,
            sourceType: ep.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr: item.audioStatus === 'pt-br-original' || item.audioStatus === 'pt-br-dubbed',
            isDubbed: false,
            quality: '720p',
            behaviorHints: { notWebReady: false }
          },
          {
            name: 'Acervo Aberto CDN',
            title: `[EPISÓDIO ${ep.number}] ${ep.title} - CDN Direto`,
            url: directUrl,
            sourceType: ep.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr: item.audioStatus === 'pt-br-original' || item.audioStatus === 'pt-br-dubbed',
            isDubbed: false,
            quality: '720p',
            behaviorHints: { notWebReady: false }
          }
        ];
      }
      return [];
    }

    return item.verifiedStreams || [];
  }

  // =========================================================================
  // STREMIO ADDON PROTOCOL V3 - PROVEDORES NATIVOS OFICIAIS
  // =========================================================================

  // Filtro de segurança contra torrents falsos, iscas e trotes de conteúdo adulto
  function isSafeLegitStream(s: any): boolean {
    if (!s) return false;
    const hash = String(s.infoHash || '').toLowerCase();
    const title = String(s.title || '').toLowerCase();
    const name = String(s.name || '').toLowerCase();
    const url = String(s.url || '').toLowerCase();
    const combined = `${name} ${title} ${url} ${hash}`;

    const bannedHashes = [
      '812efbe7d0a75fb31bf9426db566f299d10b3474',
      '6dc48c588dca97da6c610ae730c556a2c7c6718d',
      'e79c88ea04c7326eb0f88ae9f18571689317e27f',
      'f9a842dfe9f5b2e7fda509f2306e0700b97a4036',
      'd0eacddff07a24173d8f7dc11a18ef3ed32b886a'
    ];
    if (bannedHashes.some(h => hash.includes(h) || url.includes(h))) return false;

    const adultTerms = [
      'khalifa', 'mia khalifa', 'brazzers', 'xvideos', 'pornhub', 
      'redtube', 'youporn', 'bangbros', 'naughtyamerica', 'spankbang',
      'xhamster', 'pornstar', 'hardcore xxx', 'creampie', 'blowjob'
    ];
    if (adultTerms.some(term => combined.includes(term))) return false;

    return true;
  }

  // 1. Provedor Cinema Aberto & Acervo Nacional PT-BR
  app.get("/api/stremio/cinema-aberto/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.cinemaaberto",
      name: "Cinema Aberto & Acervo Nacional PT-BR",
      version: "1.0.0",
      description: "Provedor oficial Stremio de Cinema Aberto, Domínio Público e Acervo Nacional com áudio PT-BR e reprodução direta HLS/MP4.",
      resources: ["stream", "catalog", "meta"],
      types: ["movie", "series"],
      catalogs: [
        {
          type: "movie",
          id: "cinema-aberto-filmes",
          name: "Filmes de Cinema Aberto & Domínio Público"
        },
        {
          type: "series",
          id: "cinema-aberto-series",
          name: "Séries & Curtas em Episódios"
        }
      ]
    });
  });

  app.get(["/api/stremio/cinema-aberto/stream/:type/:id.json", "/api/stremio/cinema-aberto/stream/:type/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestedId = String(req.params.id || '');
    if (!requestedId.startsWith('open-')) {
      return res.json({ streams: [] });
    }
    const streams = resolveOpenItemStreams(requestedId);
    res.json({ streams });
  });

  // 2. Provedor Blender Open Movies & Animações Abertas (CC-BY)
  app.get("/api/stremio/blender-open/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.blenderopen",
      name: "Blender Open Movies (Creative Commons CC-BY)",
      version: "1.0.0",
      description: "Produções abertas da Blender Foundation em HLS adaptativo 4K/1080p e MP4.",
      resources: ["stream"],
      types: ["movie", "series"],
      catalogs: []
    });
  });

  app.get(["/api/stremio/blender-open/stream/:type/:id.json", "/api/stremio/blender-open/stream/:type/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestedId = String(req.params.id || '');
    if (!requestedId.startsWith('open-') || bannedContentRegistry.isBannedKeyOrId(requestedId)) {
      return res.json({ streams: [] });
    }
    const streams = resolveOpenItemStreams(requestedId).filter(s => 
      !bannedContentRegistry.isBannedStream(s) &&
      (s.title?.toLowerCase().includes('blender') || 
       s.title?.toLowerCase().includes('tears'))
    );
    res.json({ streams });
  });

  // 3. Provedor Domínio Público Mundial
  app.get("/api/stremio/public-domain/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.publicdomain",
      name: "Domínio Público Mundial",
      version: "1.0.0",
      description: "Clássicos do cinema em domínio público mundial com reprodução direta e sem anúncios.",
      resources: ["stream"],
      types: ["movie"],
      catalogs: []
    });
  });

  app.get(["/api/stremio/public-domain/stream/:type/:id.json", "/api/stremio/public-domain/stream/:type/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestedId = String(req.params.id || '');
    if (!requestedId.startsWith('open-')) {
      return res.json({ streams: [] });
    }
    const streams = resolveOpenItemStreams(requestedId);
    res.json({ streams });
  });

  // =========================================================================
  // 4. Provedor Mico-Leão Dublado (Protocolo Oficial Stremio Addon)
  // =========================================================================
  app.get("/api/stremio/mico-leao-dublado/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "community.mico-leao-dublado",
      version: "1.0.0",
      name: "Mico-Leão Dublado",
      description: "Catálogo comunitário de filmes dublados em português brasileiro.",
      logo: "https://i.ibb.co/9tWdHsv/icon.jpg",
      resources: ["catalog", "stream"],
      types: ["movie"],
      catalogs: [
        {
          type: "movie",
          id: "BrazilianCatalog",
          name: "Filmes Dublados (pt-BR)",
          genres: ["Ação", "Animação", "Aventura", "Comédia", "Drama", "Ficção", "Terror", "Nacional"],
          extraSupported: ["search", "genre", "skip"]
        }
      ],
      idPrefixes: ["tt", "open"]
    });
  });

  app.get([
    "/api/stremio/mico-leao-dublado/catalog/movie/BrazilianCatalog.json",
    "/api/stremio/mico-leao-dublado/catalog/movie/BrazilianCatalog/:extra.json"
  ], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const metas = VERIFIED_OPEN_ITEMS.filter(it => it.audioStatus === 'pt-br-original' || it.audioStatus === 'universal').map(it => ({
      id: it.id,
      type: "movie",
      name: it.title,
      poster: it.image,
      background: it.backdrop,
      description: it.description || '',
      year: it.year,
      genres: it.genres
    }));
    res.json({ metas });
  });

  app.get(["/api/stremio/mico-leao-dublado/stream/:type/:id.json", "/api/stremio/mico-leao-dublado/stream/:type/:id"], async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rawId = String(req.params.id).replace(/\.json$/, '');
    
    // 1. Verificar catálogo local aberto com áudio PT-BR
    const localStreams = resolveOpenItemStreams(rawId).filter(s => s.isPtBr || s.isDubbed);
    
    // 2. Consultar Torrentio Brazuca upstream para extrair streams com tag MicoLeaoDublado ou Dublado
    let upstreamStreams: any[] = [];
    if (rawId.startsWith('tt')) {
      try {
        const tUrl = `https://torrentio.strem.fun/brazuca/stream/${String(req.params.type)}/${rawId}.json`;
        const response = await fetch(tUrl, { signal: AbortSignal.timeout(4000) });
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.streams)) {
            upstreamStreams = data.streams
              .filter((s: any) => {
                const text = `${s.name || ''} ${s.title || ''}`.toLowerCase();
                return text.includes('dublado') || text.includes('dual') || text.includes('micolea') || text.includes('pt-br');
              })
              .map((s: any) => ({
                ...s,
                name: `🔊 Mico-Leão Dublado\n${s.name?.split('\n')[1] || '1080p'}`,
                isPtBr: true,
                isDubbed: true,
                providerName: 'Mico-Leão Dublado'
              }));
          }
        }
      } catch {}
    }

    const all = [...localStreams, ...upstreamStreams].filter(isSafeLegitStream);
    res.json({ streams: all });
  });

  // =========================================================================
  // 5. Provedor Show Subtitle PT-BR (Protocolo Oficial Stremio Addon)
  // =========================================================================
  app.get("/api/stremio/show-subtitle-pt-br/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "community.stremio-show-subtitle-pt-br",
      version: "1.1.0",
      name: "Show Subtitle PT-BR",
      description: "Classifica e prioriza fontes no Stremio com badges de áudio dublado (🔊) e legendas (💬) em português brasileiro.",
      resources: ["stream"],
      types: ["movie", "series"],
      catalogs: [],
      idPrefixes: ["tt", "open"]
    });
  });

  // Cache interno de streams enriquecidos (TTL: 1 hora) para mitigar rate-limit do upstream
  const showSubtitleStreamCache = new Map<string, { streams: any[]; timestamp: number }>();

  app.get(["/api/stremio/show-subtitle-pt-br/stream/:type/:id.json", "/api/stremio/show-subtitle-pt-br/stream/:type/:id"], async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rawId = String(req.params.id).replace(/\.json$/, '');
    const type = String(req.params.type);
    const cacheKey = `${type}:${rawId}`;
    const now = Date.now();

    const cached = showSubtitleStreamCache.get(cacheKey);
    if (cached && (now - cached.timestamp < 60 * 60 * 1000) && cached.streams.length > 0) {
      return res.json({ streams: cached.streams });
    }

    // 1. Checar legendas PT-BR no OpenSubtitles v3 em paralelo
    const hasPtSubPromise = checkOpenSubtitlesPtBr(type, rawId);

    // 2. Consultar upstream (Torrentio Brazuca + Streams Locais Verificados)
    const fetchUpstreamPromise = (async () => {
      let results: any[] = [];
      const local = resolveOpenItemStreams(rawId);
      results.push(...local);

      if (rawId.startsWith('tt')) {
        try {
          const [respBrazuca, respGlobal] = await Promise.allSettled([
            fetch(`https://torrentio.strem.fun/brazuca/stream/${type}/${rawId}.json`, { signal: AbortSignal.timeout(3500) }),
            fetch(`https://torrentio.strem.fun/stream/${type}/${rawId}.json`, { signal: AbortSignal.timeout(3500) })
          ]);
          if (respBrazuca.status === 'fulfilled' && respBrazuca.value.ok) {
            const data = await respBrazuca.value.json();
            if (data?.streams) results.push(...data.streams);
          }
          if (respGlobal.status === 'fulfilled' && respGlobal.value.ok) {
            const data = await respGlobal.value.json();
            if (data?.streams) results.push(...data.streams);
          }
        } catch {}
      }
      return results;
    })();

    const [hasPtSub, rawStreams] = await Promise.all([
      hasPtSubPromise,
      fetchUpstreamPromise
    ]);

    // 3. Classificar e enriquecer streams com regras e badges do Show Subtitle PT-BR
    const enriched = rawStreams.filter(isSafeLegitStream).map(s => {
      const classification = classifyStream(s, hasPtSub);
      return {
        ...s,
        name: `${classification.badge} ${s.name || 'Stream'}`,
        badge: classification.badge,
        badgeLabel: classification.badgeLabel,
        isPtBr: classification.isPtBr,
        isDubbed: classification.isDubbed,
        isSubtitled: classification.isSubtitled,
        quality: classification.quality,
        _score: classification.score
      };
    });

    // 4. Ordenação prioritária: Áudio Dublado PT-BR em 1º lugar absoluto
    const sorted = sortStreamsByPtBrPriority(enriched, { preferDubbed: true, allowSubtitled: true, excludeYouTube: true });

    if (sorted.length > 0) {
      showSubtitleStreamCache.set(cacheKey, { streams: sorted, timestamp: now });
      return res.json({ streams: sorted });
    }

    // Se upstream falhou temporariamente (429/timeout), verifica se temos cache anterior
    if (cached && cached.streams.length > 0) {
      return res.json({ streams: cached.streams });
    }

    res.json({ streams: sorted });
  });

  // =========================================================================
  // 6. Provedor ZapiTV Live TV Brasil (Protocolo Oficial Stremio Addon V3)
  // Inspirado em AIOLiveTV, IPTV Brasil, NexoTV e IPTV Addon M3U + EPG
  // =========================================================================
  app.get("/api/stremio/live/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.livetv",
      name: "ZapiTV Live TV Brasil",
      version: "1.0.0",
      description: "Agregador de TV ao vivo com canais brasileiros, transmissões abertas oficiais e catálogo FAST verificado.",
      resources: ["catalog", "meta", "stream"],
      types: ["tv"],
      catalogs: [
        {
          type: "tv",
          id: "live-tv-brazil",
          name: "TV ao Vivo Brasil",
          genres: ["TV Aberta", "Notícias", "Esportes", "Filmes & Séries", "Infantil", "Cultura", "Música", "Documentários", "Regionais"],
          extraSupported: ["search", "genre"]
        }
      ],
      idPrefixes: ["tv-", "cnn-", "sbt-", "record-", "pluto-", "n-", "mtv-", "turma-", "naruto-", "one-", "nick-", "globo-", "sportv-", "espn-", "premiere-"]
    });
  });

  app.get([
    "/api/stremio/live/catalog/tv/live-tv-brazil.json",
    "/api/stremio/live/catalog/tv/live-tv-brazil/:extra.json"
  ], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const channels = OfficialChannelProvider.getOfficialChannels();
    const metas = channels.map(ch => ({
      id: ch.id,
      type: "tv",
      name: ch.name,
      poster: ch.tvgLogo,
      logo: ch.tvgLogo,
      background: ch.tvgLogo,
      description: ch.description || `Transmissão ao vivo de ${ch.name}`,
      genres: [ch.groupTitle || "TV Aberta"]
    }));
    res.json({ metas });
  });

  app.get(["/api/stremio/live/meta/tv/:id.json", "/api/stremio/live/meta/tv/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cleanId = String(req.params.id).replace(/\.json$/, "");
    const ch = OfficialChannelProvider.getOfficialChannels().find(c => c.id === cleanId || c.tvgId === cleanId);
    if (!ch) return res.status(404).json({ meta: null });
    res.json({
      meta: {
        id: ch.id,
        type: "tv",
        name: ch.name,
        poster: ch.tvgLogo,
        logo: ch.tvgLogo,
        background: ch.tvgLogo,
        description: ch.description,
        genres: [ch.groupTitle || "TV Aberta"]
      }
    });
  });

  app.get(["/api/stremio/live/stream/tv/:id.json", "/api/stremio/live/stream/tv/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cleanId = String(req.params.id).replace(/\.json$/, "");
    const ch = OfficialChannelProvider.getOfficialChannels().find(c => c.id === cleanId || c.tvgId === cleanId);
    if (!ch || !ch.url) {
      return res.json({ streams: [] });
    }
    const streamUrl = ch.url.startsWith("http") ? `/api/proxy?url=${encodeURIComponent(ch.url)}` : ch.url;
    res.json({
      streams: [
        {
          name: ch.name,
          title: `${ch.name} - Transmissão Direta Oficial (${ch.quality || "HD"})`,
          url: streamUrl,
          sourceType: "hls",
          behaviorHints: { notWebReady: false }
        },
        {
          name: `${ch.name} (CDN Direto)`,
          title: `${ch.name} - CDN Direto Original`,
          url: ch.url,
          sourceType: "hls",
          behaviorHints: { notWebReady: false }
        }
      ]
    });
  });

  // =========================================================================
  // 7. BitTorrent Web Compatibility & Streaming Engine Status Bridge
  // =========================================================================
  app.get("/api/torrent/status", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const probe = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(1500) });
      if (probe.ok) {
        return res.json({
          available: true,
          engineUrl: "http://127.0.0.1:11470",
          status: "connected",
          message: "Motor Stremio Streaming Server ativo localmente na porta 11470."
        });
      }
    } catch {}

    res.json({
      available: false,
      engineUrl: null,
      status: "standalone_web",
      message: "Executando em ambiente Web direto. Transmissões diretas HLS/MP4 nativas estão ativas com reprodução imediata."
    });
  });


  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      platform: "ZapiTV Stremio Core",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // CORS Proxy for Stremio Addons and media streams
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url;
    if (typeof targetUrl !== 'string' || !targetUrl || targetUrl.length > 4096) {
      return res.status(400).json({ error: "Parâmetro 'url' é obrigatório" });
    }

    try {
      const parsed = new URL(targetUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ error: "Protocolo inválido" });
      }

      const incomingUa = (req.headers["user-agent"] as string) || "";
      const isCustomBotUa = !incomingUa || incomingUa.includes("ZapiTV") || incomingUa.includes("node-fetch");
      const userAgent = isCustomBotUa
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        : incomingUa;

      const headers: Record<string, string> = {
        "User-Agent": userAgent,
        "Accept": (req.headers["accept"] as string) || "*/*",
        "Accept-Language": (req.headers["accept-language"] as string) || "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      };

      // Suporte a referer explícito (ex: streams do MagnetFlix / CDN que exigem domínio de origem)
      const customReferer = (req.query.referer as string) || (req.headers["x-target-referer"] as string);
      if (customReferer && customReferer.length <= 1024 && /^https?:\/\//i.test(customReferer)) {
        headers["Referer"] = customReferer;
      } else if (!targetUrl.includes('cloutteam.com')) {
        headers["Referer"] = parsed.origin;
      }

      if (req.headers.range) {
        const safeRange = typeof req.headers.range === 'string' ? normalizeProxyRange(req.headers.range) : null;
        if (!safeRange) {
          return res.status(416).json({ error: 'Range inválido' });
        }
        headers["Range"] = safeRange;
      }

      const controller = new AbortController();
      const connectTimer = setTimeout(() => {
        try { controller.abort(new Error("Timeout de conexão com servidor de origem")); } catch {}
      }, 25000);
      // `req.close` also fires after an ordinary GET request has been read.
      // Only cancel the upstream stream when the response/client actually closes.
      res.on("close", () => {
        if (!res.writableEnded) {
          try { controller.abort(); } catch {}
        }
      });

      const response = await publicHttpGet(targetUrl, {
        headers,
        signal: controller.signal,
        timeoutMs: 25000
      });
      clearTimeout(connectTimer);

      const responseType = response.headers.get("content-type") || "";
      const isHlsManifest = /\.m3u8(?:$|[?#])/i.test(new URL(response.url).pathname) ||
        /(?:mpegurl|vnd\.apple\.mpegurl)/i.test(responseType);
      if (response.ok && isHlsManifest) {
        const { rewriteHlsManifest } = await import("./src/server/rewriteHlsManifest");
        const original = await response.text();
        const rewritten = rewriteHlsManifest(original, response.url);
        if (!rewritten) return res.status(502).json({ error: "Manifesto HLS inválido" });
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(rewritten);
      }

      // Set CORS and forward media headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
      
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      const contentRange = response.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);
      const acceptRanges = response.headers.get("accept-ranges");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      const contentLength = response.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      res.status(response.status);
      if (response.body) {
        const nodeStream = response.body;
        res.once('close', () => nodeStream.destroy());
        nodeStream.on("error", (streamErr: any) => {
          // Client closed connection or timeout reached - close cleanly without crashing
          try {
            if (!res.writableEnded) res.end();
          } catch {}
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      if (!res.headersSent) res.status(502).json({ error: "Falha ao consultar recurso via proxy" });
      else res.end();
    }
  });

  // Cache em memória de validação de stream (TTL: 10 minutos)
  const streamValidationServerCache = new Map<string, { result: any; timestamp: number }>();
  const cacheStreamValidation = (key: string, result: any) => {
    const now = Date.now();
    for (const [entryKey, entry] of streamValidationServerCache) {
      if (now - entry.timestamp >= 10 * 60 * 1000) streamValidationServerCache.delete(entryKey);
    }
    if (streamValidationServerCache.has(key)) streamValidationServerCache.delete(key);
    while (streamValidationServerCache.size >= 256) streamValidationServerCache.delete(streamValidationServerCache.keys().next().value!);
    streamValidationServerCache.set(key, { result, timestamp: now });
  };

  // Stream & Domain Validation Endpoint (ParkLogic, Expired Domains, 404/5xx, Invalid Manifests)
  app.get("/api/validate-stream", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const targetUrl = req.query.url;
    const targetTitle = (req.query.targetTitle as string) || "";
    const expectedType = (req.query.type as string) || "auto";

    if (typeof targetUrl !== 'string' || !targetUrl || targetUrl.length > 4096 || typeof targetTitle !== 'string' || targetTitle.length > 256) {
      return res.status(400).json({ valid: false, reason: "Parâmetro 'url' é obrigatório" });
    }

    // Cache hit: resposta imediata em 0ms
    const cacheKey = `${targetUrl}_${expectedType}_${targetTitle}`;
    const cached = streamValidationServerCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
      return res.json(cached.result);
    }

    const probeUrl = resolveValidationTargetUrl(targetUrl);
    if (!probeUrl) {
      return res.status(400).json({ valid: false, reason: 'URL de mídia inválida para validação' });
    }

    if (probeUrl.includes("127.0.0.1:11470") || probeUrl.includes("localhost:11470") || probeUrl.includes("127-0-0-1.strem.io:11470")) {
      const isEngineOnline = await checkStremioEngineStatus();
      const result = {
        valid: isEngineOnline,
        isParked: false,
        requiresEngine: true,
        engineActive: isEngineOnline,
        url: targetUrl,
        finalUrl: targetUrl,
        reason: isEngineOnline
          ? "Motor Stremio Streaming Server ativo localmente"
          : "Fonte requer motor Stremio Streaming Server ativo na porta 11470"
      };
      cacheStreamValidation(cacheKey, result);
      return res.json(result);
    }

    const lowerTarget = `${probeUrl} ${targetTitle}`.toLowerCase().replace(/[-_./+]/g, ' ');
    const ADULT_TERMS = ['mia khalifa', 'khalifa', 'brazzers', 'xvideos', 'pornhub', 'redtube', 'youporn', 'bangbros', 'spankbang', 'xhamster', 'naughtyamerica', 'hardcore xxx'];
    if (ADULT_TERMS.some(t => lowerTarget.includes(t))) {
      const result = {
        valid: false,
        isParked: false,
        url: targetUrl,
        finalUrl: targetUrl,
        reason: "🚨 Quarentena: Assinatura de conteúdo adulto/trote detectada"
      };
      cacheStreamValidation(cacheKey, result);
      return res.json(result);
    }

    try {
      const parsed = new URL(probeUrl);
      const host = parsed.hostname.toLowerCase();

      const PARKED_DOMAINS = [
        "superflixapi.top",
        "parklogic.com",
        "bodis.com",
        "sedo.com",
        "parkingcrew.net",
        "hugedomains.com",
        "dan.com"
      ];

      if (PARKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`))) {
        return res.json({
          valid: false,
          isParked: true,
          url: targetUrl,
          finalUrl: targetUrl,
          reason: "Domínio comprovadamente estacionado / ParkLogic detectado"
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await publicHttpGet(probeUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Range": "bytes=0-16384"
        },
        signal: controller.signal,
        timeoutMs: 6000
      });

      clearTimeout(timeout);

      const finalUrl = response.url || targetUrl;
      const finalHost = new URL(finalUrl).hostname.toLowerCase();
      const status = response.status;
      const contentType = (response.headers.get("content-type") || "").toLowerCase();

      // Verificar se redirecionou para domínio parked
      if (PARKED_DOMAINS.some(d => finalHost === d || finalHost.endsWith(`.${d}`))) {
        return res.json({
          valid: false,
          isParked: true,
          status,
          url: targetUrl,
          finalUrl,
          reason: "Redirecionamento para domínio ParkLogic / Estacionado"
        });
      }

      // Verificar status de erro HTTP (404, 5xx)
      // Nota: muitos CDNs de streaming (Cloudflare, Akamai, Bunny) rejeitam probes com 405 (Method Not Allowed)
      // ou 403 (anti-probe/anti-hotlink de IP de servidor), mas reproduzem normalmente no navegador do usuário.
      if (status === 403 || status === 405) {
        const result = {
          valid: true,
          provisional: true,
          status,
          url: targetUrl,
          finalUrl,
          reason: `Fonte aceita provisoriamente (Status HTTP ${status} não impede reprodução no navegador)`
        };
        cacheStreamValidation(cacheKey, result);
        return res.json(result);
      }

      if (status >= 400 && status !== 416) {
        const result = {
          valid: false,
          status,
          url: targetUrl,
          finalUrl,
          reason: `Erro HTTP ${status} retornado pelo servidor`
        };
        cacheStreamValidation(cacheKey, result);
        return res.json(result);
      }

      // Inspecionar corpo da resposta
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      const lowerText = text.toLowerCase();

      const PARKING_SIGNATURES = [
        "this page has been created by parklogic",
        "parklogic.com",
        "visit parklogic.com",
        "domain parked",
        "domain has expired",
        "domain is parked",
        "godaddy parking",
        "buy this domain",
        "domain name is available",
        "is parked free courtesy of",
        "sedo domain parking"
      ];

      for (const sig of PARKING_SIGNATURES) {
        if (lowerText.includes(sig)) {
          return res.json({
            valid: false,
            isParked: true,
            status,
            url: targetUrl,
            finalUrl,
            reason: `Assinatura de domínio estacionado encontrada: "${sig}"`
          });
        }
      }

      // Validação de Manifesto HLS
      const isHls = expectedType === "hls" || probeUrl.includes(".m3u8") || contentType.includes("mpegurl");
      if (isHls) {
        if (contentType.includes("text/html") && !text.includes("#EXTM3U")) {
          return res.json({
            valid: false,
            isManifestValid: false,
            status,
            url: targetUrl,
            finalUrl,
            reason: "Resposta HTML recebida quando se esperava manifesto HLS (.m3u8)"
          });
        }

        const hasValidM3uHeader = text.trimStart().startsWith("#EXTM3U");
        if (!hasValidM3uHeader && !contentType.includes("octet-stream") && !contentType.includes("video/")) {
          return res.json({
            valid: false,
            isManifestValid: false,
            status,
            url: targetUrl,
            finalUrl,
            reason: "Manifesto HLS inválido (cabeçalho #EXTM3U ausente)"
          });
        }

        const result = {
          valid: true,
          status,
          url: targetUrl,
          finalUrl,
          contentType,
          isManifestValid: true
        };
        cacheStreamValidation(cacheKey, result);
        return res.json(result);
      }

      // Rejeitar terminantemente qualquer resposta HTML ou embed publicitário
      if (contentType.includes("text/html")) {
        const result = {
          valid: false,
          status,
          url: targetUrl,
          finalUrl,
          reason: "Resposta HTML recebida. Rejeitado: Apenas transmissões nativas diretas de vídeo (HLS/MP4/WebM) são autorizadas. Players externos com anúncios ou iframes são proibidos."
        };
        cacheStreamValidation(cacheKey, result);
        return res.json(result);
      }

      // Stream de vídeo nativo direto validado com sucesso
      const result = {
        valid: true,
        status,
        url: targetUrl,
        finalUrl,
        contentType
      };
      cacheStreamValidation(cacheKey, result);
      return res.json(result);
    } catch (err: any) {
      return res.json({
        valid: false,
        url: targetUrl,
        reason: `Falha de conexão / URL inacessível: ${err.message || String(err)}`
      });
    }
  });

  // =========================================================================
  // FEATURED RANKINGS API (WEEKLY IMDb POPULARITY + REAL AVAILABILITY)
  // =========================================================================
  const FEATURED_CACHE_FILE = path.resolve(process.cwd(), "data", "featured_weekly_selection.json");

  // Configuração de persistência em disco local para ambiente Node.js
  featuredRankingService.setStorageAdapter({
    load: () => {
      try {
        if (fs.existsSync(FEATURED_CACHE_FILE)) {
          const raw = fs.readFileSync(FEATURED_CACHE_FILE, "utf-8");
          if (raw) return JSON.parse(raw);
        }
      } catch (e) {
        console.warn("[Server] Falha ao carregar cache do Em Destaque do disco:", e);
      }
      return null;
    },
    save: (data) => {
      try {
        const dir = path.dirname(FEATURED_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmpFile = `${FEATURED_CACHE_FILE}.${Date.now()}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
        fs.renameSync(tmpFile, FEATURED_CACHE_FILE);
      } catch (e) {
        console.warn("[Server] Falha ao persistir cache do Em Destaque no disco:", e);
      }
    }
  });

  app.get("/api/featured", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const selection = featuredRankingService.getFeaturedSelectionSync();
      res.json(selection);
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao obter rankings em destaque", details: err?.message });
    }
  });

  app.post("/api/featured/refresh", requireMaintenanceAdmin, async (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const selection = await featuredRankingService.refreshFeaturedSelection();
      res.json(selection);
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao atualizar rankings em destaque", details: err?.message });
    }
  });

  // Endpoint acionado semanalmente pela Vercel Cron ou GitHub Actions
  const handleFeaturedCron = async (_req: express.Request, res: express.Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      console.log("[Server] Acionamento cron semanal de Em Destaque recebido...");
      const result = await featuredRankingService.runWeeklyScheduledUpdate({ force: false });
      return res.json({
        success: true,
        weekKey: result.weekKey,
        weekLabel: result.weekLabel,
        referenceDate: result.referenceDate,
        lastUpdatedAt: result.lastUpdatedAt,
        nextScheduledUpdateFormatted: result.nextScheduledUpdateFormatted,
        moviesCount: result.featuredMovies.length,
        seriesCount: result.featuredSeries.length,
        status: result.updateStatus
      });
    } catch (err: any) {
      console.error("[Server] Erro no endpoint cron semanal:", err);
      return res.status(500).json({ error: "Falha na execução agendada", details: err?.message });
    }
  };

  app.get("/api/featured/cron", requireCronSecret, handleFeaturedCron);
  app.post("/api/featured/cron", requireCronSecret, handleFeaturedCron);

  app.get("/api/featured/scheduler-status", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(weeklyFeaturedScheduler.getStatus());
  });

  // =========================================================================
  // SISTEMA AUTOMÁTICO DE DESCOBERTA E ATUALIZAÇÃO DE LANÇAMENTOS DO CATÁLOGO
  // =========================================================================
  const handleReleaseCron = async (_req: express.Request, res: express.Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      console.log("[Server] Acionamento cron diário de lançamentos recebido...");
      const result = await runPersistedReleaseSync();
      return res.json({
        success: true,
        executedAt: new Date(result.timestamp).toISOString(),
        summary: result
      });
    } catch (err: any) {
      console.error("[Server] Erro no endpoint cron diário de lançamentos:", err);
      return res.status(err instanceof CatalogReleaseStorageUnavailable ? 503 : 500).json({ error: "Falha na sincronização de lançamentos", details: err?.message });
    }
  };

  app.get("/api/catalog/sync-releases", requireCronSecret, handleReleaseCron);
  app.post("/api/catalog/sync-releases", requireCronSecret, handleReleaseCron);

  app.get("/api/catalog/release-status", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(catalogReleaseScheduler.getStatus());
  });

  app.get("/api/catalog/new-releases", async (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      res.json(await getPersistedReleases());
    } catch (err) {
      res.status(err instanceof CatalogReleaseStorageUnavailable ? 503 : 500).json({ error: "Lançamentos temporariamente indisponíveis" });
    }
  });

  // Auditoria Oficial de Correspondência IMDb (Seção 16 da Especificação)
  app.get("/api/featured/verify-correspondence", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const selection = featuredRankingService.getFeaturedSelectionSync();
      const audit = imdbWeeklyRankingService.verifyCorrespondence(
        selection.featuredMovies,
        selection.featuredSeries
      );
      res.json(audit);
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao verificar correspondência com IMDb", details: err?.message });
    }
  });

  // Importação Administrativa de Snapshot Autorizado (Seção 5 da Especificação)
  app.post("/api/featured/import-snapshot", requireMaintenanceAdmin, (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { snapshot } = req.body || {};
      if (!snapshot) {
        return res.status(400).json({ error: "Corpo da requisição deve conter o objeto 'snapshot'" });
      }
      const result = imdbWeeklyRankingService.importAuthorizedSnapshot(snapshot);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      // Recalcula atomicamente a seleção em destaque com o novo snapshot
      const updated = featuredRankingService.recomputeFeaturedSelectionSync();
      return res.json({
        success: true,
        message: result.message,
        featuredSelection: updated
      });
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao importar snapshot IMDb", details: err?.message });
    }
  });

  // =========================================================================
  // SISTEMA DE RECOMENDAÇÕES COLABORATIVAS E HÍBRIDAS
  // =========================================================================

  // Ingestão de eventos de consumo consentidos (pseudonimizados, sem PII)
  app.post("/api/recommendations/events", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { anonymousId, contentId, weight, timestamp } = req.body || {};
      if (typeof anonymousId !== 'string' || anonymousId.length < 16 || anonymousId.length > 128 ||
          typeof contentId !== 'string' || !contentId || contentId.length > 256) {
        return res.status(400).json({ error: "Identificadores inválidos" });
      }
      const ok = await collaborativeTrainer.ingestEvent({
        anonymousId,
        contentId,
        weight: Number(weight) || 0.5,
        timestamp: Number(timestamp) || Date.now()
      });
      return res.status(ok ? 200 : 503).json({ success: ok });
    } catch (err: any) {
      return res.status(500).json({ error: "Erro ao registrar evento colaborativo", details: err?.message });
    }
  });

  // Obtenção do modelo colaborativo Item-Item agregado
  app.get("/api/recommendations/model", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.json(collaborativeTrainer.getModel());
  });

  // Treinamento incremental sob demanda ou via scheduler
  app.post("/api/recommendations/train", requireMaintenanceAdmin, async (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const model = await collaborativeTrainer.train();
      return res.json({ success: true, model });
    } catch (err: any) {
      return res.status(500).json({ error: "Falha no treinamento colaborativo", details: err?.message });
    }
  });

  // Purga de dados por revogação de consentimento (direito ao esquecimento)
  app.delete("/api/recommendations/user-data/:anonymousId", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { anonymousId } = req.params;
      if (typeof anonymousId !== 'string' || anonymousId.length < 16 || anonymousId.length > 128) {
        return res.status(400).json({ error: 'Identificador inválido' });
      }
      const ok = await collaborativeTrainer.purgeUserData(anonymousId);
      return res.json({ success: ok, message: "Dados do identificador purgados com sucesso" });
    } catch (err: any) {
      return res.status(500).json({ error: "Erro ao purgar dados", details: err?.message });
    }
  });

  // =========================================================================
  // CENTRAL INTELIGENTE DE FEEDBACKS E CORREÇÃO DE PROBLEMAS
  // =========================================================================

  // Envio de feedback por usuários (anônimo, sem login, com proteção contra spam)
  app.post("/api/feedback/submit", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    try {
      const response = await withFeedbackStore(store => store.submitFeedback(req.body), {
        write: true, actor: 'anonymous-feedback', shouldPersist: result => !result.isDuplicateIgnored
      });
      return res.status(200).json(response);
    } catch (err: any) {
      console.error("[API Feedback] Erro ao submeter feedback:", err);
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 400).json({ error: "Falha ao processar feedback", details: err?.message });
    }
  });

  // Todos os demais endpoints de feedback expõem dados internos ou alteram o painel.
  app.use("/api/feedback", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const actorUid = await authenticateAdmin(req.header("authorization"));
      if (!actorUid) return res.status(403).json({ error: "Autenticação administrativa necessária." });
      res.locals.actorUid = actorUid;
      next();
    } catch {
      return res.status(503).json({ error: "Verificação de autenticação temporariamente indisponível." });
    }
  });

  // Estatísticas do Dashboard para o Painel Administrativo
  app.get("/api/feedback/stats", async (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const stats = await withFeedbackStore(store => store.getDashboardStats());
      return res.json(stats);
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao obter estatísticas", details: err?.message });
    }
  });

  // Consulta de clusters de problemas com filtros, busca e paginação
  app.get("/api/feedback/clusters", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { status, category, priority, search, limit, offset, sortBy } = req.query;
      const result = await withFeedbackStore(store => store.getClusters({
        status: status as any,
        category: category as any,
        priority: priority as any,
        search: search ? String(search) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
        sortBy: sortBy as any
      }));
      return res.json(result);
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao listar clusters de problemas", details: err?.message });
    }
  });

  // Detalhes completos de um cluster com relatos associados e histórico
  app.get("/api/feedback/clusters/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const details = await withFeedbackStore(store => store.getClusterDetails(req.params.id));
      if (!details) {
        return res.status(404).json({ error: "Problema não encontrado" });
      }
      return res.json(details);
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao buscar detalhes do problema", details: err?.message });
    }
  });

  // Atualização administrativa de status e prioridade
  app.patch("/api/feedback/clusters/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { id } = req.params;
      const { status, priority, adminNotes } = req.body || {};
      if (status && !['new', 'investigating', 'fixing', 'resolved', 'reopened'].includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
      }
      if (priority && !['critical', 'high', 'medium', 'low'].includes(priority)) {
        return res.status(400).json({ error: "Prioridade inválida." });
      }
      const author = res.locals.actorUid;

      const updated = await withFeedbackStore(store => {
        let result = null;
        if (status) result = store.updateClusterStatus(id, status, author, adminNotes);
        if (priority) result = store.updateClusterPriority(id, priority, author);
        if (adminNotes && !status) result = store.updateAdminNotes(id, adminNotes, author);
        return result;
      }, { write: true, actor: author, shouldPersist: result => Boolean(result) });

      if (!updated) {
        return res.status(404).json({ error: "Problema não encontrado para atualização" });
      }
      return res.json({ success: true, cluster: updated });
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao atualizar problema", details: err?.message });
    }
  });

  // Regeneração de prompt técnico (individual ou consolidado)
  app.post("/api/feedback/clusters/:id/prompt", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { id } = req.params;
      const prompt = await withFeedbackStore(store => store.regeneratePrompt(id, res.locals.actorUid), {
        write: true, actor: res.locals.actorUid, shouldPersist: result => Boolean(result)
      });
      if (!prompt) {
        return res.status(404).json({ error: "Cluster não encontrado para gerar prompt" });
      }
      return res.json({ success: true, prompt });
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao regenerar prompt", details: err?.message });
    }
  });

  // Salvamento de edição manual do prompt pelo administrador
  app.put("/api/feedback/clusters/:id/prompt", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { id } = req.params;
      const { markdownContent } = req.body || {};
      if (!markdownContent) {
        return res.status(400).json({ error: "Conteúdo do prompt é obrigatório" });
      }
      const prompt = await withFeedbackStore(store => store.saveEditedPrompt(id, markdownContent, res.locals.actorUid), {
        write: true, actor: res.locals.actorUid, shouldPersist: result => Boolean(result)
      });
      if (!prompt) {
        return res.status(404).json({ error: "Cluster não encontrado para salvar prompt" });
      }
      return res.json({ success: true, prompt });
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao salvar prompt editado", details: err?.message });
    }
  });

  // Mesclagem manual de clusters
  app.post("/api/feedback/clusters/:id/merge", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { id } = req.params;
      const { targetClusterId } = req.body || {};
      if (!targetClusterId) {
        return res.status(400).json({ error: "targetClusterId é obrigatório" });
      }
      const ok = await withFeedbackStore(store => store.mergeClustersManually(id, targetClusterId, res.locals.actorUid), {
        write: true, actor: res.locals.actorUid, shouldPersist: result => Boolean(result)
      });
      return res.json({ success: ok });
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao mesclar clusters", details: err?.message });
    }
  });

  // Desmembramento manual de relato para novo cluster
  app.post("/api/feedback/reports/:id/split", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { id } = req.params;
      const newCluster = await withFeedbackStore(store => store.splitReportFromCluster(id, res.locals.actorUid), {
        write: true, actor: res.locals.actorUid, shouldPersist: result => Boolean(result)
      });
      if (!newCluster) {
        return res.status(404).json({ error: "Relato não encontrado para desmembrar" });
      }
      return res.json({ success: true, newCluster });
    } catch (err: any) {
      return res.status(err instanceof FeedbackStorageUnavailable ? 503 : 500).json({ error: "Erro ao desmembrar relato", details: err?.message });
    }
  });

  return app;
}

const app = createApp();
export default app;

if (!process.env.VERCEL) {
  (async () => {
    const engineActive = await checkStremioEngineStatus();
    if (engineActive) {
      console.log("Stremio Streaming Server detectado na porta 11470.");
    } else {
      console.log("Modo Web direto ativo (sem processos externos).");
    }

    // Inicializa o agendador de tarefas semanais em segundo plano
    weeklyFeaturedScheduler.start();

    // Inicializa o agendador diário de novos lançamentos em segundo plano
    catalogReleaseScheduler.start(runPersistedReleaseSync);

    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      app.use(async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api/') || url.startsWith('/stream/')) {
          return next();
        }
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("/{*path}", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
    const port = parseInt(process.env.PORT || "4000", 10);
    app.listen(port, "0.0.0.0", () => {
      console.log(`ZapiTV Core Server running on http://localhost:${port}`);
    });
  })().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
