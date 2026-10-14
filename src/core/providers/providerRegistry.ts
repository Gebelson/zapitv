import { StremioClient } from '../stremio/stremioClient';
import { StremioManifest, StremioStream } from '../stremio/stremioTypes';
import { sortStreamsByPtBrPriority } from '../audio/audioDetector';
import { VERIFIED_OPEN_ITEMS } from '../catalog/verifiedCatalog';
import { streamValidator } from './streamValidator';
import { tmdbService } from '../tmdb/tmdbClient';
import { ContentType } from '../../../types';
import { subtitleService } from '../subtitles/subtitleService';
import { smartRankStreams } from '../subtitles/streamSubtitleDetector';
import { sourceSelectionService } from '../selection/sourceSelectionService';
import { canonicalIdentityService } from '../identity/canonicalIdentity';
import { mediaLoadingTracker } from '../tracking/mediaLoadingTracker';
import { mediaSourceValidationService } from './mediaSourceValidationService';
import { ContentItem } from '../../../types';
import { filmesData } from '../../../constants';

export interface ProviderConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  type: 'stremio-addon' | 'direct-stream' | 'test-fixture';
  priority: number;
  isPtBr: boolean;
  status: 'online' | 'offline' | 'checking' | 'error';
  latencyMs?: number;
  lastChecked?: string;
  errorMessage?: string;
}

// Verificação passiva em cache de prontidão do Stremio Engine local (sem spawn de processos)
let localEngineCache = { active: false, lastCheck: 0 };
export async function isLocalStremioEngineOnline(): Promise<boolean> {
  const now = Date.now();
  if (now - localEngineCache.lastCheck < 15000) {
    return localEngineCache.active;
  }
  // No navegador em HTTPS (ex: Vercel), requisições HTTP para 127.0.0.1 são bloqueadas por Mixed Content
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    localEngineCache = { active: false, lastCheck: now };
    return false;
  }
  try {
    const res = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(500) });
    localEngineCache = { active: res.ok, lastCheck: now };
    return res.ok;
  } catch {
    localEngineCache = { active: false, lastCheck: now };
    return false;
  }
}

// Provedores pré-configurados de fábrica via Protocolo Oficial Stremio (Sem publicidade, sem iframes)
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'zapitv-show-subtitle-pt-br',
    name: 'Show Subtitle PT-BR (Stremio Oficial)',
    url: '/api/stremio/show-subtitle-pt-br',
    enabled: true,
    type: 'stremio-addon',
    priority: 1,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-mico-leao-dublado',
    name: 'Mico-Leão Dublado (Stremio Addon)',
    url: '/api/stremio/mico-leao-dublado',
    enabled: true,
    type: 'stremio-addon',
    priority: 2,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'fenixflix-animes',
    name: 'FenixFlix (Animes Dublados PT-BR & Zeus)',
    url: 'https://fenixflix.fenixhub.online',
    enabled: true,
    type: 'stremio-addon',
    priority: 3,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'torrentio-brazuca',
    name: 'Torrentio Brazuca (Stremio Addon)',
    url: 'https://torrentio.strem.fun/brazuca',
    enabled: true,
    type: 'stremio-addon',
    priority: 4,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'torrentio-global',
    name: 'Torrentio Oficial (Áudio Original & Multi-Idioma)',
    url: 'https://torrentio.strem.fun',
    enabled: true,
    type: 'stremio-addon',
    priority: 5,
    isPtBr: false,
    status: 'online'
  },
  {
    id: 'magnetflix-animes',
    name: 'Magnetflix (Animes e Séries PT-BR Backup)',
    url: 'https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series',
    enabled: true,
    type: 'stremio-addon',
    priority: 6,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-cinema-aberto',
    name: 'Cinema Aberto & Acervo Nacional PT-BR (Stremio Oficial)',
    url: '/api/stremio/cinema-aberto',
    enabled: true,
    type: 'stremio-addon',
    priority: 6,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-blender-open',
    name: 'Blender Open Movies & Séries Abertas (Creative Commons CC-BY)',
    url: '/api/stremio/blender-open',
    enabled: true,
    type: 'stremio-addon',
    priority: 7,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-public-domain',
    name: 'Domínio Público Mundial (Stremio Oficial)',
    url: '/api/stremio/public-domain',
    enabled: true,
    type: 'stremio-addon',
    priority: 8,
    isPtBr: false,
    status: 'online'
  },
  {
    id: 'stremio-public-domain-web',
    name: 'Public Domain Movies (Stremio Community Addon)',
    url: 'https://public-domain-movies.strem.fun',
    enabled: false,
    type: 'stremio-addon',
    priority: 9,
    isPtBr: false,
    status: 'offline'
  },
  {
    id: 'stremio-cinemeta',
    name: 'Cinemeta (Stremio Oficial)',
    url: 'https://v3-cinemeta.strem.io',
    enabled: true,
    type: 'stremio-addon',
    priority: 10,
    isPtBr: false,
    status: 'online'
  },
  {
    id: 'stremio-opensubtitles',
    name: 'OpenSubtitles v3 (Stremio Oficial)',
    url: 'https://opensubtitles-v3.strem.io',
    enabled: true,
    type: 'stremio-addon',
    priority: 11,
    isPtBr: true,
    status: 'online'
  }
];

// Open Source Verified Sample Streams para testes de reprodução garantida e verificação
export const VERIFIED_TEST_STREAMS: Record<string, StremioStream[]> = {
  // Sintel / Tears of Steel / Big Buck Bunny / Matrix test id
  "sample-stream": [
    {
      name: "ZapiTV HLS Master",
      title: "[DUBLADO PT-BR] Big Buck Bunny - 1080p FHD HLS",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      sourceType: "hls",
      isPtBr: true,
      isDubbed: true,
      quality: "1080p",
      providerName: "ZapiTV Test Stream"
    },
    {
      name: "Tears of Steel HLS",
      title: "[ÁUDIO ORIGINAL INGLÊS / MULTI-ÁUDIO] Tears of Steel - 4K UHD HLS",
      url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      sourceType: "hls",
      isPtBr: false,
      isDubbed: false,
      quality: "4K",
      providerName: "Unified Streaming"
    },
    {
      name: "Sintel Direct MP4",
      title: "[DUBLADO PT-BR] Sintel - 1080p MP4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      sourceType: "mp4",
      isPtBr: true,
      isDubbed: true,
      quality: "1080p",
      providerName: "Google Open CDN"
    }
  ]
};

class ProviderRegistryService {
  private providers: ProviderConfig[] = [];
  private cache: Map<string, { streams: StremioStream[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

  constructor() {
    this.loadProviders();
  }

  private loadProviders() {
    try {
      const saved = localStorage.getItem('zapitv_providers_config');
      if (saved) {
        const parsed: ProviderConfig[] = JSON.parse(saved);
        const cleanParsed = parsed.filter(p => p.type !== ('vod-embed' as any) && !p.id.includes('embedplay') && !p.id.includes('playerflix') && !p.id.includes('videasy'));
        const map = new Map<string, ProviderConfig>();
        DEFAULT_PROVIDERS.forEach(p => map.set(p.id, p));
        cleanParsed.forEach(p => map.set(p.id, { ...(map.get(p.id) || {}), ...p }));
        this.providers = Array.from(map.values()).sort((a, b) => a.priority - b.priority);
        return;
      }
    } catch {
      // Ignora erro de storage
    }
    this.providers = [...DEFAULT_PROVIDERS];
  }

  public saveProviders() {
    try {
      localStorage.setItem('zapitv_providers_config', JSON.stringify(this.providers));
    } catch (e) {
      console.warn('Erro ao salvar provedores:', e);
    }
  }

  public getProviders(): ProviderConfig[] {
    return [...this.providers];
  }

  public addProvider(provider: ProviderConfig) {
    this.providers.push(provider);
    this.saveProviders();
  }

  public updateProvider(id: string, updates: Partial<ProviderConfig>) {
    const idx = this.providers.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.providers[idx] = { ...this.providers[idx], ...updates };
      this.saveProviders();
    }
  }

  public removeProvider(id: string) {
    this.providers = this.providers.filter(p => p.id !== id);
    this.saveProviders();
  }

  public async checkProviderHealth(id: string): Promise<ProviderConfig> {
    const provider = this.providers.find(p => p.id === id);
    if (!provider) throw new Error('Provedor não encontrado');

    const startTime = Date.now();
    try {
      if (provider.type === 'stremio-addon') {
        const client = new StremioClient(provider.url);
        const manifest = await client.getManifest();
        const latency = Date.now() - startTime;
        this.updateProvider(id, {
          status: 'online',
          latencyMs: latency,
          lastChecked: new Date().toISOString(),
          errorMessage: undefined
        });
      } else {
        // Direct ping via proxy or fetch
        const pingUrl = `/api/proxy?url=${encodeURIComponent(provider.url)}`;
        const res = await fetch(pingUrl, { signal: AbortSignal.timeout(6000) });
        const latency = Date.now() - startTime;
        this.updateProvider(id, {
          status: res.ok ? 'online' : 'error',
          latencyMs: latency,
          lastChecked: new Date().toISOString(),
          errorMessage: res.ok ? undefined : `Status HTTP ${res.status}`
        });
      }
    } catch (err: any) {
      this.updateProvider(id, {
        status: 'error',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        errorMessage: err.message || 'Falha de conexão'
      });
    }

    return this.providers.find(p => p.id === id)!;
  }

  /**
   * Resolve todos os fluxos de reprodução para um item (filme ou série).
   */
  public async resolveStreams(
    type: 'movie' | 'series' | 'anime',
    id: { tmdbId?: string | number; imdbId?: string; id?: string; title?: string },
    episode?: { season: number; episode: number }
  ): Promise<StremioStream[]> {
    const cacheKey = `v4_priority_${type}_${id.tmdbId || id.imdbId || id.id}_${episode?.season || 0}_${episode?.episode || 0}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.streams;
    }

    const streams: StremioStream[] = [];
    const activeProviders = this.providers.filter(p => p.enabled);

    // 0. Provedor de Cinema Aberto, Domínio Público e Obras Verificadas
    const rawTargetId = id.id || '';
    const cleanId = rawTargetId.replace(/^tmdb-?/i, '');
    const tmdbNum = id.tmdbId ? String(id.tmdbId).replace(/^tmdb-?/i, '') : (!rawTargetId.startsWith('tt') ? cleanId : '');
    let imdbStr = id.imdbId ? String(id.imdbId) : '';

    if (!imdbStr && tmdbNum) {
      try {
        const resolved = await tmdbService.getImdbId(tmdbNum, type);
        if (resolved) imdbStr = resolved;
      } catch {
        // Ignora
      }
    }
    if (!imdbStr && rawTargetId.startsWith('tt')) {
      imdbStr = rawTargetId;
    }

    const openItem = VERIFIED_OPEN_ITEMS.find(item => 
      item.id === rawTargetId || 
      item.id === id.id ||
      (rawTargetId.startsWith('open-') && (
        (tmdbNum && String(item.tmdbId) === String(tmdbNum)) ||
        (imdbStr && item.imdbId === imdbStr)
      )) ||
      (imdbStr && item.imdbId === imdbStr && item.id.startsWith('anime-'))
    );

    const catalogItem = !openItem ? filmesData.find(item =>
      item.id === rawTargetId ||
      item.id === id.id ||
      (imdbStr && item.imdbId === imdbStr) ||
      (tmdbNum && String(item.tmdbId) === String(tmdbNum))
    ) : null;

    const targetTitle = (id.title || catalogItem?.title || openItem?.title || '').trim();

    // 0. Streams legítimos de Domínio Público (exclusivo para itens 'open-')
    if (openItem) {
      if ((type === 'series' || type === 'anime') && openItem.episodes && openItem.episodes.length > 0) {
        const epNum = episode?.episode || 1;
        const epObj = openItem.episodes.find(e => e.number === epNum) || openItem.episodes[0];
        if (epObj?.videoUrl) {
          const directUrl = epObj.videoUrl;
          const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          const isPtBr = openItem.audioStatus === 'pt-br-original' || openItem.audioStatus === 'universal' || openItem.audioStatus === 'pt-br-dubbed';
          const isDubbed = openItem.audioStatus === 'pt-br-dubbed';
          streams.push({
            name: `${openItem.title} - Ep ${epObj.number}`,
            title: `[EPISÓDIO ${epObj.number}] ${epObj.title} (${isDubbed ? 'Dublado PT-BR' : 'Stream Otimizado'})`,
            url: proxyUrl,
            sourceType: epObj.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr,
            isDubbed,
            quality: '1080p',
            providerName: 'Acervo ZapiTV Verificado',
            providerId: 'zapitv-verified'
          });
          streams.push({
            name: `${openItem.title} - Ep ${epObj.number} (CDN)`,
            title: `[EPISÓDIO ${epObj.number}] ${epObj.title} (${isDubbed ? 'Dublado PT-BR' : 'CDN Direto'})`,
            url: directUrl,
            sourceType: epObj.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr,
            isDubbed,
            quality: '1080p',
            providerName: 'Acervo ZapiTV CDN',
            providerId: 'zapitv-verified'
          });
        }
      } else if (openItem.verifiedStreams && openItem.verifiedStreams.length > 0) {
        streams.push(...openItem.verifiedStreams);
      }
    }

    // 0.1 Streams de mídias do Acervo ZapiTV com fontes confirmadas
    if (catalogItem) {
      if ((type === 'series' || type === 'anime') && catalogItem.episodes && catalogItem.episodes.length > 0) {
        const epNum = episode?.episode || 1;
        const epObj = catalogItem.episodes.find(e => e.number === epNum) || catalogItem.episodes[0];
        if (epObj?.videoUrl && !epObj.videoUrl.includes('Caminandes') && !epObj.videoUrl.includes('Night_of_the_Living_Dead')) {
          const directUrl = epObj.videoUrl;
          const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          const isDubbed = catalogItem.audioStatus === 'pt-br-dubbed';
          streams.push({
            name: `${catalogItem.title} - T${episode?.season || 1}E${epObj.number}`,
            title: `[EPISÓDIO ${epObj.number}] ${epObj.title} (${isDubbed ? 'Dublado PT-BR' : 'Stream HD'})`,
            url: proxyUrl,
            sourceType: epObj.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr: true,
            isDubbed,
            quality: '1080p',
            providerName: 'Acervo ZapiTV Séries',
            providerId: 'zapitv-series'
          });
        }
      } else if (catalogItem.verifiedStreams && catalogItem.verifiedStreams.length > 0) {
        const safeStreams = catalogItem.verifiedStreams.filter(s => 
          !s.url?.includes('Night_of_the_Living_Dead') && !s.url?.includes('Caminandes')
        );
        streams.push(...safeStreams);
      } else if (catalogItem.videoUrl && !catalogItem.videoUrl.includes('Night_of_the_Living_Dead') && !catalogItem.videoUrl.includes('Caminandes')) {
        const directUrl = catalogItem.videoUrl;
        const isHls = directUrl.includes('.m3u8');
        const isMp4 = directUrl.includes('.mp4');
        if (isHls || isMp4) {
          const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          streams.push({
            name: `${catalogItem.title} - Stream Oficial`,
            title: `${catalogItem.title} (Dublado PT-BR 1080p)`,
            url: proxyUrl,
            sourceType: isHls ? 'hls' : 'mp4',
            isPtBr: true,
            isDubbed: true,
            quality: '1080p',
            providerName: 'Acervo ZapiTV Oficial',
            providerId: 'zapitv-catalog'
          });
        }
      }
    }

    // 1. Consultar Provedores Stremio Add-on Habilitados em Paralelo (Protocolo Oficial Stremio v3)
    const stremioAddons = activeProviders.filter(p => p.type === 'stremio-addon');
    const stremioType = type === 'movie' ? 'movie' : 'series';
    const primaryId = imdbStr || tmdbNum || rawTargetId;
    const stremioId = episode && (type === 'series' || type === 'anime')
      ? `${primaryId}:${episode.season}:${episode.episode}`
      : primaryId;

    if (stremioId) {
      mediaLoadingTracker.transition(rawTargetId, 'SEARCHING_SOURCES', {
        stremioId,
        stremioType,
        providerCount: stremioAddons.length
      });

      const addonPromises = stremioAddons.map(async (addon) => {
        const startProviderTime = Date.now();
        let providerSuccess = false;
        let providerStreamCount = 0;
        let providerError: string | undefined;

        try {
          const client = new StremioClient(addon.url);
          // Timeout individual estrito de 8 segundos por add-on
          let res = await Promise.race([
            client.getStreams(stremioType, stremioId),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ADDON')), 8000))
          ]);

          // Fallback para ID secundário se o primeiro não retornou nada
          if ((!res || !res.streams || res.streams.length === 0) && tmdbNum && imdbStr) {
            const altBase = stremioId.startsWith('tt') ? tmdbNum : imdbStr;
            const altId = episode && (type === 'series' || type === 'anime')
              ? `${altBase}:${episode.season}:${episode.episode}`
              : altBase;
            try {
              res = await Promise.race([
                client.getStreams(stremioType, altId),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ADDON_ALT')), 5000))
              ]);
            } catch {}
          }

          if ((!res || !res.streams || res.streams.length === 0) && (type === 'anime' || type === 'series')) {
            const altType = stremioType === 'series' ? 'anime' : 'series';
            try {
              res = await Promise.race([
                client.getStreams(altType, stremioId),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ADDON_TYPE')), 5000))
              ]);
            } catch {}
          }

          if (res && Array.isArray(res.streams)) {
            const parsedStreams: StremioStream[] = [];
            for (const s of res.streams) {
              const sUrl = s.url || '';
              if (s.ytId || sUrl.includes('youtube.com') || sUrl.includes('youtu.be')) continue;
              if (sUrl.includes('embed') || sUrl.includes('iframe') || s.sourceType === ('embed' as any)) continue;

              const isHls = sUrl.includes('.m3u8') || s.sourceType === 'hls';
              const isDash = sUrl.includes('.mpd');
              const isDirectVideo = sUrl.includes('.mp4') || sUrl.includes('.webm') || sUrl.includes('.ogv') || sUrl.includes('/api/proxy') || s.sourceType === 'mp4';
              const isTorrent = Boolean(s.infoHash);

              if (isHls || isDash || isDirectVideo) {
                if (sUrl.startsWith('http://') && !sUrl.includes('/api/proxy')) {
                  parsedStreams.push({
                    ...s,
                    url: `/api/proxy?url=${encodeURIComponent(sUrl)}`,
                    providerName: `${addon.name} (Proxy)`,
                    providerId: addon.id,
                    sourceType: isHls ? 'hls' : 'mp4'
                  });
                }
                parsedStreams.push({
                  ...s,
                  providerName: addon.name,
                  providerId: addon.id,
                  sourceType: isHls ? 'hls' : 'mp4'
                });
              } else if (isTorrent) {
                const engineOnline = await isLocalStremioEngineOnline();
                // A Vercel não pode acessar o Stremio Engine instalado no computador do visitante.
                if (!engineOnline) continue;
                const engineUrl = `http://127.0.0.1:11470/${s.infoHash}/${s.fileIdx || 0}`;
                parsedStreams.push({
                  ...s,
                  url: engineUrl,
                  providerName: `${addon.name}${engineOnline ? '' : ' (Requer Stremio Engine)'}`,
                  providerId: addon.id,
                  sourceType: 'mp4',
                  isTorrent: true,
                  behaviorHints: {
                    ...(s.behaviorHints || {}),
                    notWebReady: !engineOnline
                  }
                });
              }
            }
            providerSuccess = true;
            providerStreamCount = parsedStreams.length;
            return parsedStreams;
          }
        } catch (err: any) {
          providerError = err.message || 'Erro de comunicação';
        } finally {
          const duration = Date.now() - startProviderTime;
          mediaLoadingTracker.recordProviderAttempt(rawTargetId, {
            providerId: addon.id,
            providerName: addon.name,
            durationMs: duration,
            success: providerSuccess,
            streamCount: providerStreamCount,
            error: providerError
          });
        }
        return [];
      });

      const results = await Promise.allSettled(addonPromises);
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          streams.push(...r.value);
        }
      }
    }

    // 2. Fallback para Test Streams se explicitamente solicitado
    if (id.id === 'sample-stream' || id.tmdbId === 'sample-stream') {
      streams.push(...VERIFIED_TEST_STREAMS['sample-stream']);
    }

    // 3. Filtrar rigorosamente streams de domínios estacionados / ParkLogic / Embeds / YouTube e conteúdos trocados
    mediaLoadingTracker.transition(rawTargetId, 'VALIDATING_SOURCES', {
      rawStreamCount: streams.length
    });

    const cleanStreams = streamValidator.filterCleanStreams(streams, targetTitle).filter(s => {
      if (s.ytId) return false;
      const u = (s.url || '').toLowerCase();
      const t = (s.title || '').toLowerCase();
      if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        if (u.startsWith('http://')) return false;
        if (/localhost|127\.0\.0\.1|%5b%3a%3a1%5d|\[::1\]/.test(u)) return false;
      }
      if (u.includes('youtube.com') || u.includes('youtu.be')) return false;
      if (u.includes('embedplay') || u.includes('playerflix') || u.includes('videasy') || u.includes('superflix')) return false;

      // BLINDAGEM CONTRA SUBSTITUIÇÃO INDEVIDA POR CLÁSSICOS/MOCKS DE DOMÍNIO PÚBLICO OU BLENDER
      const isNightLivingDead = u.includes('night_of_the_living_dead') || t.includes('night of the living dead') || t.includes('noite dos mortos-vivos');
      if (isNightLivingDead && rawTargetId !== 'open-night-living-dead-1968' && id.imdbId !== 'tt0063350') {
        return false;
      }
      const isCaminandes = u.includes('caminandes') || t.includes('caminandes');
      if (isCaminandes && rawTargetId !== 'open-caminandes-s1') {
        return false;
      }

      return true;
    });

    // 4. Construir identidade canônica para validação estrita de fontes
    const itemTarget: ContentItem = openItem || {
      id: id.id || id.imdbId || String(id.tmdbId || ''),
      title: targetTitle,
      type: type === 'movie' ? ContentType.MOVIE : (type === 'anime' ? ContentType.ANIME : ContentType.SERIES),
      rating: 7.0,
      year: (id as any).year || openItem?.year || 0,
      image: openItem?.image || '',
      tmdbId: id.tmdbId ? String(id.tmdbId) : undefined,
      imdbId: id.imdbId,
      genres: openItem?.genres || []
    };

    const identity = canonicalIdentityService.buildIdentity(itemTarget, episode);

    // 5. Consultar disponibilidade prévia de legendas PT-BR no ZapiTV para o episódio
    let hasExternalPtSub = false;
    try {
      hasExternalPtSub = await Promise.race([
        subtitleService.hasPtBrSubtitles(itemTarget, episode?.season, episode?.episode),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500))
      ]);
    } catch {
      // ignore
    }

    mediaLoadingTracker.transition(rawTargetId, 'SELECTING_AUDIO', {
      cleanStreamsCount: cleanStreams.length,
      hasExternalPtSub
    });

    // 6. Ordenar rigorosamente pela hierarquia inteligente com prioridade absoluta para PT-BR e descarte de quarentena:
    const sorted = sourceSelectionService.rankStreams(cleanStreams, {
      hasExternalPtSub,
      preferDubbed: true,
      identity,
      cacheKey: `${cacheKey}_hasPt${hasExternalPtSub}`
    });
    
    // 7. Enriquecer fontes validadas no MediaSourceValidationService (normalização centralizada)
    for (const s of sorted) {
      mediaSourceValidationService.validateSource(s, {
        mediaId: rawTargetId,
        mediaTitle: targetTitle,
        mediaType: type,
        season: episode?.season,
        episode: episode?.episode,
        canonicalIdentity: identity,
        hasExternalPtSub
      }).catch(() => {});
    }

    // Armazenar no cache
    this.cache.set(cacheKey, { streams: sorted, timestamp: Date.now() });

    return sorted;
  }

  /**
   * Limpa todos os caches de provedores e ranqueamento inteligente.
   */
  public clearCache(): void {
    this.cache.clear();
    sourceSelectionService.clearRankingCache();
  }
}

export const providerRegistry = new ProviderRegistryService();
