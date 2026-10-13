import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import { VERIFIED_OPEN_ITEMS } from "./src/core/catalog/verifiedCatalog.ts";
import { classifyStream, checkOpenSubtitlesPtBr, sortStreamsByPtBrPriority } from "./src/core/audio/audioDetector.ts";
import { OfficialChannelProvider } from "./src/core/livetv/OfficialChannelProvider.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureStremioEngine() {
  try {
    const probe = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(1000) });
    if (probe.ok) {
      console.log("Stremio Streaming Engine ativo na porta 11470.");
      return;
    }
  } catch {}

  const serverJsPath = "C:\\Users\\gebel\\AppData\\Local\\Programs\\Stremio\\server.js";
  if (fs.existsSync(serverJsPath)) {
    console.log("Iniciando motor oficial do Stremio (server.js) na porta 11470...");
    try {
      const p = spawn("node", [serverJsPath], {
        detached: true,
        stdio: "ignore",
        cwd: "C:\\Users\\gebel\\AppData\\Local\\Programs\\Stremio"
      });
      p.unref();
    } catch (e: any) {
      console.warn("Não foi possível iniciar motor do Stremio:", e.message);
    }
  }
}

function createApp() {
  const app = express();

  // Enable JSON parsing
  app.use(express.json());

  // Helper function to resolve open items to Stremio streams
  function resolveOpenItemStreams(rawId: string, seasonNum = 1, episodeNum = 1) {
    let cleanId = rawId.replace(/\.json$/, '');
    if (cleanId.includes(':')) {
      const parts = cleanId.split(':');
      cleanId = parts[0];
      if (parts[1]) seasonNum = parseInt(parts[1], 10) || 1;
      if (parts[2]) episodeNum = parseInt(parts[2], 10) || 1;
    }

    const item = VERIFIED_OPEN_ITEMS.find(it => 
      it.id === cleanId || 
      (it.tmdbId && String(it.tmdbId) === cleanId) || 
      (it.imdbId && it.imdbId === cleanId)
    );

    if (!item) return [];

    if (item.episodes && item.episodes.length > 0) {
      const ep = item.episodes.find(e => e.number === episodeNum) || item.episodes[0];
      if (ep?.videoUrl) {
        const directUrl = ep.videoUrl;
        const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
        return [
          {
            name: 'ZapiTV Stream Core',
            title: `[EPISÓDIO ${ep.number}] ${ep.title} - Servidor Local ZapiTV`,
            url: proxyUrl,
            sourceType: ep.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr: item.audioStatus === 'pt-br-original' || item.audioStatus === 'universal',
            isDubbed: false,
            quality: '720p',
            behaviorHints: { notWebReady: false }
          },
          {
            name: 'Acervo Aberto CDN',
            title: `[EPISÓDIO ${ep.number}] ${ep.title} - CDN Direto`,
            url: directUrl,
            sourceType: ep.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr: item.audioStatus === 'pt-br-original' || item.audioStatus === 'universal',
            isDubbed: false,
            quality: '720p',
            behaviorHints: { notWebReady: false }
          }
        ];
      }
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
      'xhamster', 'pornstar', 'hardcore xxx', 'creampie', 'blowjob',
      'playweb', 'ben the men'
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
    const streams = resolveOpenItemStreams(String(req.params.id));
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
    const streams = resolveOpenItemStreams(String(req.params.id)).filter(s => 
      s.title?.toLowerCase().includes('blender') || 
      s.title?.toLowerCase().includes('bunny') || 
      s.title?.toLowerCase().includes('tears') ||
      s.title?.toLowerCase().includes('caminandes')
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
    const streams = resolveOpenItemStreams(String(req.params.id));
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

  app.get(["/api/stremio/show-subtitle-pt-br/stream/:type/:id.json", "/api/stremio/show-subtitle-pt-br/stream/:type/:id"], async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rawId = String(req.params.id).replace(/\.json$/, '');
    const type = String(req.params.type);

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
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Parâmetro 'url' é obrigatório" });
    }

    try {
      const parsed = new URL(targetUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ error: "Protocolo inválido" });
      }

      const headers: Record<string, string> = {
        "User-Agent": "ZapiTV-Stremio/1.0.0 (gebel.streaming@zapitv.local)",
        "Accept": "*/*",
      };

      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const response = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(15000)
      });

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
        const { Readable } = await import("stream");
        // @ts-ignore
        const nodeStream = Readable.fromWeb(response.body);
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
      res.status(502).json({
        error: "Falha ao consultar recurso via proxy",
        details: err?.message || String(err)
      });
    }
  });

  // Stream & Domain Validation Endpoint (ParkLogic, Expired Domains, 404/5xx, Invalid Manifests)
  app.get("/api/validate-stream", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const targetUrl = req.query.url as string;
    const targetTitle = (req.query.targetTitle as string) || "";
    const expectedType = (req.query.type as string) || "auto";

    if (!targetUrl) {
      return res.status(400).json({ valid: false, reason: "Parâmetro 'url' é obrigatório" });
    }

    const lowerTarget = `${targetUrl} ${targetTitle}`.toLowerCase().replace(/[-_./+]/g, ' ');
    const ADULT_TERMS = ['mia khalifa', 'khalifa', 'brazzers', 'xvideos', 'pornhub', 'redtube', 'youporn', 'bangbros', 'spankbang', 'xhamster', 'naughtyamerica', 'hardcore xxx'];
    if (ADULT_TERMS.some(t => lowerTarget.includes(t))) {
      return res.json({
        valid: false,
        isParked: false,
        url: targetUrl,
        finalUrl: targetUrl,
        reason: "🚨 Quarentena: Assinatura de conteúdo adulto/trote detectada"
      });
    }

    try {
      const parsed = new URL(targetUrl.startsWith("/") ? `http://localhost:${process.env.PORT || "4000"}${targetUrl}` : targetUrl);
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

      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Range": "bytes=0-16384"
        },
        redirect: "follow",
        signal: controller.signal
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

      // Verificar status de erro HTTP (404, 403, 5xx)
      if (status >= 400 && status !== 416) {
        return res.json({
          valid: false,
          status,
          url: targetUrl,
          finalUrl,
          reason: `Erro HTTP ${status} retornado pelo servidor`
        });
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
      const isHls = expectedType === "hls" || targetUrl.includes(".m3u8") || contentType.includes("mpegurl");
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

        return res.json({
          valid: true,
          status,
          url: targetUrl,
          finalUrl,
          contentType,
          isManifestValid: true
        });
      }

      // Rejeitar terminantemente qualquer resposta HTML ou embed publicitário
      if (contentType.includes("text/html")) {
        return res.json({
          valid: false,
          status,
          url: targetUrl,
          finalUrl,
          reason: "Resposta HTML recebida. Rejeitado: Apenas transmissões nativas diretas de vídeo (HLS/MP4/WebM) são autorizadas. Players externos com anúncios ou iframes são proibidos."
        });
      }

      // Stream de vídeo nativo direto validado com sucesso
      return res.json({
        valid: true,
        status,
        url: targetUrl,
        finalUrl,
        contentType
      });
    } catch (err: any) {
      return res.json({
        valid: false,
        url: targetUrl,
        reason: `Falha de conexão / URL inacessível: ${err.message || String(err)}`
      });
    }
  });

  return app;
}

const app = createApp();
export default app;

if (!process.env.VERCEL) {
  (async () => {
    await ensureStremioEngine();
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
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
