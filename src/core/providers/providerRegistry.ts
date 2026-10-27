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
import { sourceConfidenceEngine } from '../identity/sourceConfidenceEngine';
import { mediaLoadingTracker } from '../tracking/mediaLoadingTracker';
import { mediaSourceValidationService } from './mediaSourceValidationService';
import { ContentItem } from '../../../types';
import { filmesData } from '../../../constants';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { playbackOptimizerService } from '../playback/PlaybackOptimizerService';
import { tvPerformanceService } from '../tv/tvPerformanceService';
import { LruCache } from '../cache/LruCache';
import { getRememberedSources, prioritizeRememberedSources } from './sourceMemory';

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

export interface ResolveStreamsOptions {
  onProgressiveStreams?: (streams: StremioStream[]) => void;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  bypassNegativeCache?: boolean;
  isRetryAttempt?: boolean;
  onProviderResult?: (detail: {
    providerId: string;
    providerName: string;
    durationMs: number;
    success: boolean;
    streamCount: number;
    isTimeout?: boolean;
    error?: string;
  }) => void;
}

// TMDB/AniList IDs already contain a colon, but still need the episode suffix.
export function stremioEpisodeId(baseId: string, episode?: { season: number; episode: number }): string {
  return episode && !/:\d+:\d+$/.test(baseId)
    ? `${baseId}:${episode.season}:${episode.episode}`
    : baseId;
}

export function findCatalogEpisode(episodes: ContentItem['episodes'], requested?: { season: number; episode: number }) {
  const season = requested?.season ?? 1;
  const number = requested?.episode ?? 1;
  const matches = (episodes ?? []).filter(ep => (ep.season ?? 1) === season && ep.number === number);
  return matches.length && new Set(matches.map(ep => ep.videoUrl)).size === 1 ? matches[0] : undefined;
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
    id: 'froststream-http',
    name: 'FrostStream (HTTP Streams PT-BR)',
    url: 'https://froststream.cloutteam.com',
    enabled: true,
    type: 'stremio-addon',
    priority: 3,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'fenixflix-animes',
    name: 'FenixFlix (Animes Dublados PT-BR & Zeus)',
    url: 'https://fenixflix.fenixhub.online',
    enabled: true,
    type: 'stremio-addon',
    priority: 4,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'torrentio-brazuca',
    name: 'Torrentio Brazuca (Stremio Addon)',
    url: 'https://torrentio.strem.fun/brazuca',
    enabled: true,
    type: 'stremio-addon',
    priority: 5,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'torrentio-global',
    name: 'Torrentio Oficial (Áudio Original & Multi-Idioma)',
    url: 'https://torrentio.strem.fun',
    enabled: true,
    type: 'stremio-addon',
    priority: 6,
    isPtBr: false,
    status: 'online'
  },
  {
    id: 'magnetflix-animes',
    name: 'Magnetflix (Animes e Séries PT-BR Backup)',
    url: 'https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series',
    enabled: true,
    type: 'stremio-addon',
    priority: 7,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-cinema-aberto',
    name: 'Cinema Aberto & Acervo Nacional PT-BR (Stremio Oficial)',
    url: '/api/stremio/cinema-aberto',
    enabled: true,
    type: 'stremio-addon',
    priority: 8,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-blender-open',
    name: 'Blender Open Movies & Séries Abertas (Creative Commons CC-BY)',
    url: '/api/stremio/blender-open',
    enabled: true,
    type: 'stremio-addon',
    priority: 9,
    isPtBr: true,
    status: 'online'
  },
  {
    id: 'zapitv-public-domain',
    name: 'Domínio Público Mundial (Stremio Oficial)',
    url: '/api/stremio/public-domain',
    enabled: true,
    type: 'stremio-addon',
    priority: 10,
    isPtBr: false,
    status: 'online'
  },
  {
    id: 'stremio-public-domain-web',
    name: 'Public Domain Movies (Stremio Community Addon)',
    url: 'https://public-domain-movies.strem.fun',
    enabled: false,
    type: 'stremio-addon',
    priority: 11,
    isPtBr: false,
    status: 'offline'
  },
  {
    id: 'stremio-cinemeta',
    name: 'Cinemeta (Stremio Oficial)',
    url: 'https://v3-cinemeta.strem.io',
    enabled: true,
    type: 'stremio-addon',
    priority: 12,
    isPtBr: false,
    status: 'online'
  },
  {
    id: 'stremio-opensubtitles',
    name: 'OpenSubtitles v3 (Stremio Oficial)',
    url: 'https://opensubtitles-v3.strem.io',
    enabled: true,
    type: 'stremio-addon',
    priority: 13,
    isPtBr: true,
    status: 'online'
  }
];

// Open Source Verified Sample Streams para testes de reprodução garantida e verificação
export const VERIFIED_TEST_STREAMS: Record<string, StremioStream[]> = {
  "sample-stream": [
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
  private cache = new LruCache<string, { streams: StremioStream[]; timestamp: number }>(100, 15 * 60 * 1000);
  private negativeCache = new LruCache<string, { timestamp: number; reason: string; inconclusive: boolean }>(100, 15 * 1000); // 15s de expiração rápida para cache negativo
  private pending = new Map<string, Promise<StremioStream[]>>();
  private progressiveListeners = new Map<string, Set<(streams: StremioStream[]) => void>>();
  private providerResultListeners = new Map<string, Set<(detail: any) => void>>();
  private inFlightConsumers = new Map<string, Set<AbortSignal | null>>();
  private cacheGeneration = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de retenção em cache
  private readonly STALE_TTL_MS = 3 * 60 * 1000; // 3 minutos de fresh (stale-while-revalidate após isso)

  private isCancelled(cacheKey: string): boolean {
    const consumers = this.inFlightConsumers.get(cacheKey);
    if (!consumers || consumers.size === 0) return false;
    return Array.from(consumers).every(s => s !== null && s.aborted);
  }

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
        DEFAULT_PROVIDERS.forEach(p => map.set(p.id, { ...p }));
        cleanParsed.forEach(p => map.set(p.id, { ...(map.get(p.id) || {}), ...p }));
        this.providers = Array.from(map.values()).sort((a, b) => a.priority - b.priority);
        return;
      }
    } catch {
      // Ignora erro de storage
    }
    this.providers = DEFAULT_PROVIDERS.map(p => ({ ...p }));
  }

  public saveProviders() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('zapitv_providers_config', JSON.stringify(this.providers));
    } catch (e) {
      console.warn('Erro ao salvar provedores:', e);
    }
  }

  public getProviders(): ProviderConfig[] {
    return [...this.providers];
  }

  public getProvider(id: string): ProviderConfig | undefined {
    const target = id.toLowerCase().trim();
    return this.providers.find(p =>
      p.id.toLowerCase() === target ||
      p.id.toLowerCase().includes(target) ||
      p.name.toLowerCase().includes(target)
    );
  }

  public getEligibleProviders(type?: 'movie' | 'series' | 'anime'): ProviderConfig[] {
    return this.providers.filter(p => p.enabled);
  }

  public setProviderPriority(id: string, priority: number): void {
    const provider = this.getProvider(id);
    if (!provider) return;

    // Ajusta provedores existentes para evitar empates de prioridade
    this.providers.forEach(p => {
      if (p.id !== provider.id && p.priority >= priority) {
        p.priority += 1;
      }
    });
    provider.priority = priority;
    this.providers.sort((a, b) => a.priority - b.priority);
    this.saveProviders();
  }

  public resetProviderPriorities(): void {
    const defaultPriorityMap: Record<string, number> = {
      'zapitv-show-subtitle-pt-br': 1,
      'zapitv-mico-leao-dublado': 2,
      'froststream-http': 3,
      'fenixflix-animes': 4,
      'torrentio-brazuca': 5,
      'torrentio-global': 6,
      'magnetflix-animes': 7,
      'zapitv-cinema-aberto': 8,
      'zapitv-blender-open': 9,
      'zapitv-public-domain': 10
    };
    this.providers.forEach(p => {
      const def = defaultPriorityMap[p.id];
      if (def !== undefined) {
        p.priority = def;
      }
    });
    this.providers.sort((a, b) => a.priority - b.priority);
    this.saveProviders();
  }

  public addProvider(provider: ProviderConfig) {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
    this.saveProviders();
  }

  public updateProvider(id: string, updates: Partial<ProviderConfig>) {
    const idx = this.providers.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.providers[idx] = { ...this.providers[idx], ...updates };
      this.providers.sort((a, b) => a.priority - b.priority);
      this.saveProviders();
    }
  }

  public removeProvider(id: string) {
    this.providers = this.providers.filter(p => p.id !== id);
    this.providers.sort((a, b) => a.priority - b.priority);
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
  public resolveStreams(
    type: 'movie' | 'series' | 'anime',
    id: { tmdbId?: string | number; imdbId?: string; id?: string; title?: string; originalTitle?: string; year?: number },
    episode?: { season: number; episode: number },
    options?: ResolveStreamsOptions
  ): Promise<StremioStream[]> {
    const rawTargetId = id.id || '';
    const cleanId = rawTargetId.replace(/^tmdb-?/i, '');
    const tmdbStr = id.tmdbId ? String(id.tmdbId).replace(/^tmdb-?/i, '') : (/^\d+$/.test(cleanId) ? cleanId : '');
    const imdbStr = id.imdbId ? String(id.imdbId) : (rawTargetId.startsWith('tt') ? rawTargetId : '');
    const cleanTitle = (id.title || '').trim().toLowerCase();
    const cacheKey = JSON.stringify(['v8_canonical_identity', type, rawTargetId, tmdbStr, imdbStr, cleanTitle, id.year, episode?.season, episode?.episode]);

    // 1. Registro de listeners (progressivo e telemetria de provedores) para este cacheKey
    const releaseListener = () => {
      const callback = options?.onProgressiveStreams;
      if (callback) {
        const listeners = this.progressiveListeners.get(cacheKey);
        listeners?.delete(callback);
        if (listeners?.size === 0) this.progressiveListeners.delete(cacheKey);
      }
      const providerCb = options?.onProviderResult;
      if (providerCb) {
        const pListeners = this.providerResultListeners.get(cacheKey);
        pListeners?.delete(providerCb);
        if (pListeners?.size === 0) this.providerResultListeners.delete(cacheKey);
      }
      const consumers = this.inFlightConsumers.get(cacheKey);
      if (consumers && options?.signal) {
        consumers.delete(options.signal);
        if (consumers.size === 0) this.inFlightConsumers.delete(cacheKey);
      }
      options?.signal?.removeEventListener('abort', releaseListener);
    };

    if (options?.onProgressiveStreams) {
      if (!this.progressiveListeners.has(cacheKey)) {
        this.progressiveListeners.set(cacheKey, new Set());
      }
      this.progressiveListeners.get(cacheKey)!.add(options.onProgressiveStreams);
    }

    if (options?.onProviderResult) {
      if (!this.providerResultListeners.has(cacheKey)) {
        this.providerResultListeners.set(cacheKey, new Set());
      }
      this.providerResultListeners.get(cacheKey)!.add(options.onProviderResult);
    }

    if (options?.signal) {
      options.signal.addEventListener('abort', releaseListener, { once: true });
    }

    // 2. Cache inteligente com separação estrita de positivo vs negativo (Requisito 7)
    if (options?.forceRefresh || options?.bypassNegativeCache) {
      this.negativeCache.delete(cacheKey);
    } else {
      // 2.1 Cache positivo (15 minutos de retenção com Stale-While-Revalidate)
      const cached = this.cache.get(cacheKey);
      if (cached && cached.streams.length > 0) {
        const age = Date.now() - cached.timestamp;
        if (age < this.CACHE_TTL_MS) {
          options?.onProgressiveStreams?.(cached.streams);
          if (options?.onProviderResult) {
            const providers = this.getEligibleProviders();
            for (const p of providers) {
              options.onProviderResult({
                providerId: p.id,
                providerName: p.name,
                durationMs: 0,
                success: true,
                streamCount: cached.streams.filter(s => s.providerId === p.id).length,
                isTimeout: false
              });
            }
          }
          // Se estiver na janela stale, dispara revalidação em segundo plano sem bloquear
          if (age >= this.STALE_TTL_MS && !this.pending.has(cacheKey)) {
            const bgRequest = this.resolveStreamsFresh(type, id, episode, cacheKey, this.cacheGeneration)
              .catch(() => [])
              .finally(() => {
                if (this.pending.get(cacheKey) === bgRequest) {
                  this.pending.delete(cacheKey);
                  this.inFlightConsumers.delete(cacheKey);
                }
              });
            this.pending.set(cacheKey, bgRequest);
          }
          releaseListener();
          return Promise.resolve(cached.streams);
        }
      }

      // 2.2 Cache negativo (expiração ultracurta de 15 segundos para evitar bloqueios)
      if (!options?.bypassNegativeCache) {
        const cachedNeg = this.negativeCache.get(cacheKey);
        if (cachedNeg && !cachedNeg.inconclusive && (Date.now() - cachedNeg.timestamp) < 15000) {
          releaseListener();
          return Promise.resolve([]);
        }
      }
    }

    // Mantém sinais abortados até a operação compartilhada terminar, para que
    // todos os consumidores cancelados realmente interrompam a descoberta.
    let consumers = this.inFlightConsumers.get(cacheKey);
    if (!consumers) {
      consumers = new Set();
      this.inFlightConsumers.set(cacheKey, consumers);
    }
    consumers.add(options?.signal || null);

    // 3. Deduplicação de requisições simultâneas em voo (in-flight deduplication)
    if (!options?.forceRefresh && !options?.bypassNegativeCache) {
      const existing = this.pending.get(cacheKey);
      if (existing) {
        return existing.finally(releaseListener);
      }
    }

    const request = this.resolveStreamsFresh(type, id, episode, cacheKey, this.cacheGeneration, options).finally(() => {
      if (this.pending.get(cacheKey) === request) {
        this.pending.delete(cacheKey);
        this.inFlightConsumers.delete(cacheKey);
      }
      releaseListener();
    });
    this.pending.set(cacheKey, request);
    return request;
  }

  public async resolveStreamsFresh(
    type: 'movie' | 'series' | 'anime',
    id: { tmdbId?: string | number; imdbId?: string; id?: string; title?: string; originalTitle?: string; year?: number },
    episode?: { season: number; episode: number },
    cacheKey?: string,
    generation?: number,
    options?: ResolveStreamsOptions
  ): Promise<StremioStream[]> {
    const effectiveCacheKey = cacheKey || JSON.stringify(['v7_canonical_identity', type, id.id, id.tmdbId, id.imdbId, id.title, id.originalTitle, id.year, episode?.season, episode?.episode]);
    const effectiveGen = generation ?? this.cacheGeneration;

    const notifyProgressive = (currentStreams: StremioStream[]) => {
      const listeners = this.progressiveListeners.get(effectiveCacheKey);
      if (listeners && listeners.size > 0) {
        for (const cb of listeners) {
          try { cb(currentStreams); } catch {}
        }
      }
    };

    // Bloqueio total e imediato de conteúdos banidos (Big Buck Bunny, Caminandes, etc.)
    if (bannedContentRegistry.isBanned(id)) {
      return [];
    }

    const streams: StremioStream[] = [];
    const activeProviders = this.providers.filter(p => p.enabled);

    // 0. Provedor de Cinema Aberto, Domínio Público e Obras Verificadas
    const rawTargetId = id.id || '';
    const cleanId = rawTargetId.replace(/^tmdb-?/i, '');
    let tmdbNum = id.tmdbId && /^\d+$/.test(String(id.tmdbId).replace(/^tmdb-?/i, ''))
      ? String(id.tmdbId).replace(/^tmdb-?/i, '')
      : (/^(?:tmdb-?)?\d+$/i.test(rawTargetId) ? cleanId : '');
    let imdbStr = id.imdbId ? String(id.imdbId) : '';

    // Fontes locais pertencem exclusivamente ao item que as cadastrou. IDs externos
    // podem ser compartilhados por remakes, temporadas e registros incorretos.
    const openItem = VERIFIED_OPEN_ITEMS.find(item => item.id === rawTargetId &&
      (type === 'movie' ? item.type === ContentType.MOVIE : item.type !== ContentType.MOVIE));

    const catalogItem = !openItem ? filmesData.find(item => item.id === rawTargetId &&
      (type === 'movie' ? item.type === ContentType.MOVIE : item.type !== ContentType.MOVIE)) : null;

    if (!tmdbNum && (openItem?.tmdbId || catalogItem?.tmdbId)) {
      const candidateTmdb = String(openItem?.tmdbId || catalogItem?.tmdbId || '').replace(/^tmdb-?/i, '');
      if (/^\d+$/.test(candidateTmdb)) tmdbNum = candidateTmdb;
    }

    if (!imdbStr && (openItem?.imdbId || catalogItem?.imdbId)) {
      imdbStr = String(openItem?.imdbId || catalogItem?.imdbId || '');
    }

    const targetTitle = (id.title || catalogItem?.title || openItem?.title || '').trim();
    const originalTitle = (id.originalTitle || catalogItem?.originalTitle || openItem?.originalTitle || '').trim();
    const alternateTitles: string[] = (id as any).alternateTitles ? [...(id as any).alternateTitles] : [];
    const candidateIds = [rawTargetId, imdbStr, tmdbNum ? `tmdb-${tmdbNum}` : '', tmdbNum].filter(Boolean);
    for (const cid of candidateIds) {
      if (!alternateTitles.includes(cid)) alternateTitles.push(cid);
    }
    if (id.year && !alternateTitles.includes(String(id.year))) {
      alternateTitles.push(String(id.year));
    }
    if (id.year && targetTitle && !alternateTitles.includes(`${targetTitle} ${id.year}`)) {
      alternateTitles.push(`${targetTitle} ${id.year}`);
    }

    // 0. Extração imediata de fontes locais (0ms) sem aguardar requisições de rede
    if (openItem) {
      if ((type === 'series' || type === 'anime') && openItem.episodes && openItem.episodes.length > 0) {
        const epObj = findCatalogEpisode(openItem.episodes, episode);
        if (epObj?.videoUrl) {
          const directUrl = epObj.videoUrl;
          const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          const isPtBr = openItem.audioStatus === 'pt-br-original' || openItem.audioStatus === 'pt-br-dubbed';
          const isDubbed = openItem.audioStatus === 'pt-br-dubbed';
          streams.push({
            name: `${openItem.title} - Ep ${epObj.number}`,
            title: `[EPISÓDIO ${epObj.number}] ${epObj.title} (${isDubbed ? 'Dublado PT-BR' : 'Stream Otimizado'})`,
            url: proxyUrl,
            sourceType: epObj.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr,
            isDubbed,
            quality: epObj.quality || '1080p',
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
            quality: epObj.quality || '1080p',
            providerName: 'Acervo ZapiTV CDN',
            providerId: 'zapitv-verified'
          });
        }
      } else if (openItem.verifiedStreams && openItem.verifiedStreams.length > 0) {
        streams.push(...openItem.verifiedStreams.map(source => ({
          ...source, providerId: source.providerId || 'zapitv-verified'
        })));
      }
    }

    if (catalogItem) {
      if ((type === 'series' || type === 'anime') && catalogItem.episodes && catalogItem.episodes.length > 0) {
        const epObj = findCatalogEpisode(catalogItem.episodes, episode);
        if (epObj?.videoUrl && !epObj.videoUrl.includes('Caminandes') && !epObj.videoUrl.includes('Night_of_the_Living_Dead')) {
          const directUrl = epObj.videoUrl;
          const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          const isDubbed = catalogItem.audioStatus === 'pt-br-dubbed';
          streams.push({
            name: `${catalogItem.title} - T${episode?.season ?? 1}E${epObj.number}`,
            title: `[EPISÓDIO ${epObj.number}] ${epObj.title} (${isDubbed ? 'Dublado PT-BR' : 'Stream HD'})`,
            url: proxyUrl,
            sourceType: epObj.videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            isPtBr: catalogItem.audioStatus === 'pt-br-original' || isDubbed,
            isDubbed,
            quality: epObj.quality || '1080p',
            providerName: 'Acervo ZapiTV Séries',
            providerId: 'zapitv-series'
          });
        }
      } else if (catalogItem.verifiedStreams && catalogItem.verifiedStreams.length > 0) {
        const safeStreams = catalogItem.verifiedStreams.filter(s => 
          !s.url?.includes('Night_of_the_Living_Dead') && !s.url?.includes('Caminandes')
        );
        streams.push(...safeStreams.map(source => ({
          ...source, providerId: source.providerId || 'zapitv-catalog'
        })));
      } else if (catalogItem.videoUrl && !catalogItem.videoUrl.includes('Night_of_the_Living_Dead') && !catalogItem.videoUrl.includes('Caminandes')) {
        const directUrl = catalogItem.videoUrl;
        const isHls = directUrl.includes('.m3u8');
        const isMp4 = directUrl.includes('.mp4');
        if (isHls || isMp4) {
          const proxyUrl = directUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          streams.push({
            name: `${catalogItem.title} - Stream Oficial`,
            title: `${catalogItem.title} (Stream Oficial)`,
            url: proxyUrl,
            sourceType: isHls ? 'hls' : 'mp4',
            isPtBr: catalogItem.audioStatus === 'pt-br-original' || catalogItem.audioStatus === 'pt-br-dubbed',
            isDubbed: catalogItem.audioStatus === 'pt-br-dubbed',
            quality: '1080p',
            providerName: 'Acervo ZapiTV Oficial',
            providerId: 'zapitv-catalog'
          });
        }
      }
    }

    // Se temos fontes locais verificadas (0ms), já ranqueia e emite imediatamente
    if (streams.length > 0) {
      const cleanLocal = streamValidator.filterCleanStreams(streams, targetTitle, originalTitle, alternateTitles, episode);
      const rankedLocal = sourceSelectionService.rankStreams(cleanLocal, {
        hasExternalPtSub: false,
        preferDubbed: true,
        identity: canonicalIdentityService.buildIdentity(openItem || catalogItem || {
          id: id.id || id.imdbId || String(id.tmdbId || ''),
          title: targetTitle,
          type: type === 'movie' ? ContentType.MOVIE : (type === 'anime' ? ContentType.ANIME : ContentType.SERIES),
          rating: 7.0,
          year: id.year || openItem?.year || catalogItem?.year || 0,
          originalTitle: id.originalTitle || openItem?.originalTitle || catalogItem?.originalTitle,
          image: openItem?.image || '',
          tmdbId: id.tmdbId ? String(id.tmdbId) : undefined,
          imdbId: imdbStr || id.imdbId,
          genres: openItem?.genres || []
        }, episode),
        cacheKey: `${effectiveCacheKey}_local`
      });
      if (rankedLocal.length > 0) {
        notifyProgressive(rankedLocal);
      }
    }

    const altIds: string[] = [];
    if (openItem?.imdbId && openItem.imdbId !== imdbStr && !altIds.includes(openItem.imdbId)) {
      altIds.push(openItem.imdbId);
    }
    if (catalogItem?.imdbId && catalogItem.imdbId !== imdbStr && !altIds.includes(catalogItem.imdbId)) {
      altIds.push(catalogItem.imdbId);
    }

    if (tmdbNum) {
      try {
        const resolved = await tmdbService.getImdbId(tmdbNum, type);
        if (resolved) {
          if (!imdbStr) {
            imdbStr = resolved;
          } else if (resolved !== imdbStr) {
            if (!altIds.includes(resolved)) altIds.push(resolved);
          }
        }
      } catch {
        // Ignora
      }
    }
    if (!imdbStr && rawTargetId.startsWith('tt')) {
      imdbStr = rawTargetId;
    }

    // Se temos IMDb mas não temos TMDB ID, resolve antecipadamente via TMDB respeitando o tipo
    if (!tmdbNum && imdbStr) {
      try {
        const found = await Promise.race([
          tmdbService.findByImdb(imdbStr, type),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
        ]);
        if (found?.tmdbId) {
          tmdbNum = String(found.tmdbId).replace(/^tmdb-?/i, '');
        }
      } catch {}
    }

    // Se ainda não temos TMDB ID, busca estrita por título no TMDB preservando tipo e ano
    if (!tmdbNum && targetTitle) {
      try {
        const searchResults = await Promise.race([
          tmdbService.searchMulti(targetTitle),
          new Promise<ContentItem[]>((resolve) => setTimeout(() => resolve([]), 2500))
        ]);
        if (searchResults && searchResults.length > 0) {
          const targetYear = id.year || openItem?.year || catalogItem?.year || 0;
          const normTarget = canonicalIdentityService.normalizeTitle(targetTitle);

          // 1. Filtra estritamente pelo tipo correto (Série vs Filme)
          const typeMatches = searchResults.filter(r => {
            const rIsMovie = r.type === ContentType.MOVIE || r.mediaFormat === 'movie';
            return type === 'movie' ? rIsMovie : !rIsMovie;
          });

          // 2. Compara título completo normalizado ou equivalência de todos os termos (NUNCA 1 palavra isolada)
          const validCandidates = typeMatches.filter(r => {
            const normTitle = canonicalIdentityService.normalizeTitle(r.title);
            const normOrig = r.originalTitle ? canonicalIdentityService.normalizeTitle(r.originalTitle) : '';
            const titleExact = normTitle === normTarget || normOrig === normTarget;
            if (!titleExact) {
              const tTokens = canonicalIdentityService.extractSignificantTokens(normTarget);
              const rTokens = canonicalIdentityService.extractSignificantTokens(normTitle);
              if (tTokens.length >= 2 && rTokens.length >= 2) {
                const allTokensMatch = tTokens.every(t => rTokens.includes(t)) && rTokens.every(t => tTokens.includes(t));
                if (!allTokensMatch) return false;
              } else {
                return false;
              }
            }
            // 3. Verifica ano de lançamento quando conhecido (diferença máxima de 1 ano)
            if (targetYear > 0 && r.year && r.year > 0 && Math.abs(r.year - targetYear) > 1) {
              return false;
            }
            return true;
          });

          // Se houver um candidato estritamente compatível, adota seus IDs
          const match = validCandidates[0];
          if (match) {
            if (match.tmdbId) {
              tmdbNum = String(match.tmdbId).replace(/^tmdb-?/i, '');
            } else if (match.id && !match.id.startsWith('open-') && !match.id.startsWith('local-')) {
              if (/^\d+$/.test(match.id)) {
                tmdbNum = match.id;
              }
            }
            if (match.imdbId && !imdbStr) {
              imdbStr = match.imdbId;
              if (!altIds.includes(match.imdbId)) altIds.push(match.imdbId);
            }
          } else {
            console.warn(`[ProviderRegistry] Busca de fallback por título '${targetTitle}' não encontrou resultado estritamente compatível com tipo='${type}' e ano=${targetYear}. Nenhuma correspondência forçada.`);
          }
        }
      } catch {
        // Ignora
      }
    }

    if (tmdbNum) {
      if (!altIds.includes(`tmdb:${tmdbNum}`)) altIds.push(`tmdb:${tmdbNum}`);
      if (!altIds.includes(tmdbNum)) altIds.push(tmdbNum);
    }

    // Construir identidade canônica para validação estrita e consulta antecipada de legendas
    const itemTarget: ContentItem = openItem || {
      id: id.id || id.imdbId || String(id.tmdbId || ''),
      title: targetTitle,
      type: type === 'movie' ? ContentType.MOVIE : (type === 'anime' ? ContentType.ANIME : ContentType.SERIES),
      rating: 7.0,
      year: id.year || openItem?.year || catalogItem?.year || 0,
      originalTitle: id.originalTitle || openItem?.originalTitle || catalogItem?.originalTitle,
      image: openItem?.image || '',
      tmdbId: id.tmdbId ? String(id.tmdbId) : undefined,
      imdbId: imdbStr || id.imdbId,
      genres: openItem?.genres || []
    };

    const identity = canonicalIdentityService.buildIdentity(itemTarget, episode);

    // Small, bounded global hint; a database outage never blocks source discovery.
    const remembered = await Promise.race([
      getRememberedSources({
        canonicalId: identity.canonicalId || '',
        mediaType: (identity.canonicalId?.split(':')[0] as 'movie' | 'series' | 'anime') || type,
        season: episode?.season || 0, episode: episode?.episode || 0,
      }),
      new Promise<Awaited<ReturnType<typeof getRememberedSources>>>(resolve => setTimeout(() => resolve([]), 400)),
    ]);

    // Consulta antecipada e paralela de legendas PT-BR enquanto os addons são consultados
    const ptSubPromise = Promise.race([
      subtitleService.hasPtBrSubtitles(itemTarget, episode?.season, episode?.episode),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1200))
    ]).catch(() => false);

    // 1. Consultar Provedores Stremio Add-on Habilitados em Paralelo (Protocolo Oficial Stremio v3)
    const stremioAddons = activeProviders.filter(p => p.type === 'stremio-addon' &&
      !['stremio-cinemeta', 'stremio-opensubtitles'].includes(p.id));
    const stremioType = type === 'movie' ? 'movie' : 'series';
    const primaryId = imdbStr || tmdbNum || rawTargetId;
    const stremioId = episode && (type === 'series' || type === 'anime')
      ? `${primaryId}:${episode.season}:${episode.episode}`
      : primaryId;

    if (stremioId) {
      // Ordenação inteligente de provedores: prioridade oficial, PT-BR e score histórico de latência/estabilidade
      const sortedAddons = [...stremioAddons].sort((a, b) => {
        const memoryA = remembered.find(row => row.providerId === a.id)?.score || 0;
        const memoryB = remembered.find(row => row.providerId === b.id)?.score || 0;
        if (memoryA !== memoryB) return memoryB - memoryA;
        const scoreA = playbackOptimizerService.getProviderScore(a.id);
        const scoreB = playbackOptimizerService.getProviderScore(b.id);
        if (a.isPtBr !== b.isPtBr) return a.isPtBr ? -1 : 1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (a.priority || 99) - (b.priority || 99);
      });

      mediaLoadingTracker.transition(rawTargetId, 'SEARCHING_SOURCES', {
        stremioId,
        stremioType,
        providerCount: sortedAddons.length
      });

      const executeAddon = async (addon: ProviderConfig): Promise<StremioStream[]> => {
        const startProviderTime = Date.now();
        let providerSuccess = false;
        let providerStreamCount = 0;
        let providerError: string | undefined;
        // Timeout adaptativo: no Fire TV / cold start, estende para permitir negociação SSL e parsing sem corte precoce
        const isFireTv = tvPerformanceService.isFireTv();
        const addonTimeout = addon.id.includes('froststream')
          ? (isFireTv ? 8500 : 7000)
          : (isFireTv ? 6500 : 4500);

        try {
          const client = new StremioClient(addon.url);
          let primaryQueryId = stremioId;
          // Para o FenixFlix, o identificador IMDb (tt...) é o padrão universal e canônico para séries/animes,
          // possuindo alinhamento perfeito de temporadas e episódios absolutos.
          // O TMDB ID só deve ser a consulta primária se NÃO houver IMDb ID disponível.
          if (addon.id === 'fenixflix-animes' && type === 'anime' && !imdbStr && tmdbNum) {
            primaryQueryId = episode
              ? `tmdb:${tmdbNum}:${episode.season}:${episode.episode}`
              : `tmdb:${tmdbNum}`;
          }

          const hasMatchingStreams = (rawStreams: any[]): boolean => {
            if (!rawStreams || !Array.isArray(rawStreams) || rawStreams.length === 0) return false;
            for (const item of rawStreams) {
              const sTitle = (item.title || item.description || item.name || '').trim();
              const s = { ...item, title: sTitle };
              if (addon.id === 'fenixflix-animes' && /🐉\s*Malfoy/i.test(s.title || '')) continue;
              if (s.ytId || (s.url && (s.url.includes('youtube.com') || s.url.includes('youtu.be')))) continue;
              if (streamValidator.isStreamMatchingTargetTitle(s, targetTitle, originalTitle, alternateTitles, episode)) {
                const conf = sourceConfidenceEngine.evaluate(s, identity);
                if (conf.isMatch) {
                  return true;
                }
              }
            }
            return false;
          };

          let res = await Promise.race([
            client.getStreams(stremioType, primaryQueryId),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ADDON')), addonTimeout))
          ]).catch(() => null);

          // Fallback para IDs secundários se o primeiro não retornou nada ou não correspondeu ao título solicitado
          const secondaryCandidates = (primaryQueryId === stremioId
            ? altIds
            : [stremioId, ...altIds.filter(a => a !== `tmdb:${tmdbNum}` && a !== tmdbNum)]).slice(0, 2);

          if ((!res || !res.streams || !hasMatchingStreams(res.streams)) && secondaryCandidates.length > 0) {
            for (const altBase of secondaryCandidates) {
              const altId = type === 'series' || type === 'anime'
                ? stremioEpisodeId(altBase, episode)
                : altBase;
              try {
                const altTimeout = 2500;
                const altRes = await Promise.race([
                  client.getStreams(stremioType, altId),
                  new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ADDON_ALT')), altTimeout))
                ]).catch(() => null);
                if (altRes && Array.isArray(altRes.streams) && hasMatchingStreams(altRes.streams)) {
                  res = altRes;
                  break;
                }
              } catch {}
            }
          }

          if ((!res || !res.streams || !hasMatchingStreams(res.streams)) && (type === 'anime' || type === 'series')) {
            const altType = stremioType === 'series' ? 'anime' : 'series';
            try {
              const altTypeRes = await Promise.race([
                client.getStreams(altType, stremioId),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ADDON_TYPE')), 2500))
              ]).catch(() => null);
              if (altTypeRes && Array.isArray(altTypeRes.streams) && hasMatchingStreams(altTypeRes.streams)) {
                res = altTypeRes;
              }
            } catch {}
          }

          if (res && Array.isArray(res.streams)) {
            const parsedStreams: StremioStream[] = [];
            for (const rawStream of res.streams) {
              const sTitle = (rawStream.title || rawStream.description || rawStream.name || '').trim();
              const s = { ...rawStream, title: sTitle };
              const sUrl = s.url || '';
              // A variante Malfoy devolveu obras diferentes sob títulos corretos
              // em várias mídias. A quarentena é por origem, nunca por título.
              if (addon.id === 'fenixflix-animes' && /🐉\s*Malfoy/i.test(s.title || '')) continue;
              if (s.ytId || sUrl.includes('youtube.com') || sUrl.includes('youtu.be')) continue;
              
              const isMediaFile = sUrl.includes('.m3u8') || sUrl.includes('.mp4') || sUrl.includes('.webm') || sUrl.includes('.ogv') || sUrl.includes('.mpd') || sUrl.includes('.mkv');
              if (!isMediaFile && (sUrl.includes('embed') || sUrl.includes('iframe') || s.sourceType === ('embed' as any))) continue;

              const isHls = sUrl.includes('.m3u8') || s.sourceType === 'hls';
              const isDash = sUrl.includes('.mpd');
              const isTorrent = Boolean(s.infoHash) || sUrl.includes('127.0.0.1:11470') || sUrl.includes('localhost:11470') || sUrl.includes('.torrent');
              const isDirectVideo = !isTorrent && (sUrl.includes('.mp4') || sUrl.includes('.webm') || sUrl.includes('.ogv') || sUrl.includes('/api/proxy') || s.sourceType === 'mp4' || Boolean(sUrl && !s.infoHash));

              const streamText = `${s.name || ''} ${s.title || ''} ${s.description || ''}`;
              const isExplicitlySubOnly = /\b(legendado|softsub|hardsub|sub\b|leg\b)\b/i.test(streamText) && !/dublado|dual|áudio|audio/i.test(streamText);
              const hasPtAudioIndicator = /dublado|dub\b|dual\b|audio\s*pt|áudio\s*pt|pt[-_]?br|portugu[êe]s|🌎\s*portugu[êe]s/i.test(streamText) || (/🇧🇷/i.test(streamText) && !isExplicitlySubOnly);
              const isDubbed = Boolean(s.isDubbed) || (!isExplicitlySubOnly && hasPtAudioIndicator) || (addon.isPtBr && !isExplicitlySubOnly && hasPtAudioIndicator);
              const isPtBr = Boolean(s.isPtBr) || addon.isPtBr || isDubbed || /pt[-_]?br|portugu[êe]s|pob|por\b|🇧🇷/i.test(streamText);

              if (isHls || isDash || isDirectVideo) {
                // Este host entrega o manifesto por HTTPS, mas não permite que
                // o HLS.js carregue suas variantes diretamente do navegador.
                // A rota de mídia mantém manifesto, variantes e segmentos na
                // mesma origem da página, preservando os caminhos do provedor.
                if (isHls && /^https:\/\/(?:[^/]+\.)?embedplayer2\.xyz\//i.test(sUrl)) {
                  parsedStreams.push({
                    ...s,
                    url: `/api/proxy?url=${encodeURIComponent(sUrl)}`,
                    providerName: `${addon.name} (HLS Proxy)`,
                    providerId: addon.id,
                    sourceType: 'hls',
                    ...(isDubbed ? { isDubbed: true } : {}),
                    ...(isPtBr ? { isPtBr: true } : {})
                  });
                  continue;
                }
                if (sUrl.startsWith('http://') && !sUrl.includes('/api/proxy')) {
                  // O proxy de arquivos FenixFlix é bloqueado na Vercel. A rota
                  // HTTPS do próprio provedor funciona para fontes compatíveis.
                  if (addon.id === 'fenixflix-animes' && typeof window !== 'undefined' && window.location.protocol === 'https:') {
                    parsedStreams.push({
                      ...s,
                      url: sUrl.replace(/^http:/, 'https:'),
                      providerName: `${addon.name} (HTTPS Direto)`,
                      providerId: addon.id,
                      sourceType: isHls ? 'hls' : 'mp4',
                      ...(isDubbed ? { isDubbed: true } : {}),
                      ...(isPtBr ? { isPtBr: true } : {})
                    });
                    continue;
                  }
                  parsedStreams.push({
                    ...s,
                    url: `/api/proxy?url=${encodeURIComponent(sUrl)}`,
                    providerName: `${addon.name} (Proxy)`,
                    providerId: addon.id,
                    sourceType: isHls ? 'hls' : 'mp4',
                    ...(isDubbed ? { isDubbed: true } : {}),
                    ...(isPtBr ? { isPtBr: true } : {})
                  });
                  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
                    parsedStreams.push({
                      ...s,
                      providerName: addon.name,
                      providerId: addon.id,
                      sourceType: isHls ? 'hls' : 'mp4',
                      ...(isDubbed ? { isDubbed: true } : {}),
                      ...(isPtBr ? { isPtBr: true } : {}),
                      behaviorHints: {
                        ...(s.behaviorHints || {}),
                        notWebReady: false
                      }
                    });
                  }
                } else {
                  parsedStreams.push({
                    ...s,
                    providerName: addon.name,
                    providerId: addon.id,
                    sourceType: isHls ? 'hls' : 'mp4',
                    ...(isDubbed ? { isDubbed: true } : {}),
                    ...(isPtBr ? { isPtBr: true } : {}),
                    behaviorHints: {
                      ...(s.behaviorHints || {}),
                      notWebReady: false
                    }
                  });
                }
                if (addon.id === 'froststream-http' || sUrl.includes('cloutteam.com')) {
                  parsedStreams.push({
                    ...s,
                    url: `/api/proxy?url=${encodeURIComponent(sUrl)}`,
                    providerName: `${addon.name} (Proxy)`,
                    providerId: addon.id,
                    sourceType: isHls ? 'hls' : 'mp4',
                    ...(isDubbed ? { isDubbed: true } : {}),
                    ...(isPtBr ? { isPtBr: true } : {}),
                    behaviorHints: {
                      ...(s.behaviorHints || {}),
                      notWebReady: false
                    }
                  });
                }
              } else if (isTorrent) {
                const engineOnline = await isLocalStremioEngineOnline();
                let streamQuality = s.quality;
                if (!streamQuality) {
                  const combinedText = `${s.name || ''} ${s.title || ''}`.toLowerCase();
                  if (combinedText.includes('2160p') || combinedText.includes('4k')) streamQuality = '2160p';
                  else if (combinedText.includes('1080p')) streamQuality = '1080p';
                  else if (combinedText.includes('720p')) streamQuality = '720p';
                  else if (combinedText.includes('480p')) streamQuality = '480p';
                }
                const engineUrl = s.url || `http://127.0.0.1:11470/${s.infoHash}/${s.fileIdx || 0}`;
                parsedStreams.push({
                  ...s,
                  url: engineUrl,
                  providerName: `${addon.name}${engineOnline ? '' : ' (Stremio)'}`,
                  providerId: addon.id,
                  sourceType: 'mp4',
                  isTorrent: true,
                  quality: streamQuality || '1080p',
                  ...(isDubbed ? { isDubbed: true } : {}),
                  ...(isPtBr ? { isPtBr: true } : {}),
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
          const isTimeout = Boolean(providerError?.includes('TIMEOUT') || (duration >= addonTimeout - 300 && !providerSuccess));
          playbackOptimizerService.recordProviderResult(addon.id, duration, providerSuccess);
          mediaLoadingTracker.recordProviderAttempt(rawTargetId, {
            providerId: addon.id,
            providerName: addon.name,
            durationMs: duration,
            success: providerSuccess,
            streamCount: providerStreamCount,
            error: providerError
          });
          const attemptDetail = {
            providerId: addon.id,
            providerName: addon.name,
            durationMs: duration,
            success: providerSuccess,
            streamCount: providerStreamCount,
            isTimeout,
            error: providerError
          };
          options?.onProviderResult?.(attemptDetail);
          const prListeners = this.providerResultListeners.get(effectiveCacheKey);
          if (prListeners && prListeners.size > 0) {
            for (const cb of prListeners) {
              if (cb !== options?.onProviderResult) {
                try { cb(attemptDetail); } catch {}
              }
            }
          }
        }
        return [];
      };

      // Execução paralela com concorrência controlada (máx 8) e saída rápida inteligente
      const CONCURRENCY_LIMIT = 8;
      const collectedFromAddons: StremioStream[] = [];
      let activeIndex = 0;
      let stopSpawning = false;

      const runWorker = async () => {
        while (activeIndex < sortedAddons.length && !stopSpawning) {
          if (this.isCancelled(effectiveCacheKey)) return;
          const currentIndex = activeIndex++;
          const addon = sortedAddons[currentIndex];
          const result = await executeAddon(addon);
          if (Array.isArray(result) && result.length > 0) {
            collectedFromAddons.push(...result);
            // Emite progresso em tempo real assim que novas fontes forem descobertas
            const combinedInterim = [...streams, ...collectedFromAddons];
            const cleanInterim = streamValidator.filterCleanStreams(combinedInterim, targetTitle, originalTitle, alternateTitles, episode)
              .filter(s => sourceConfidenceEngine.evaluate(s, identity).isMatch);
            if (cleanInterim.length > 0) {
              const engineOnline = localEngineCache.active;
              const hasWebReady = cleanInterim.some(s => (!s.isTorrent && !s.url?.includes('127.0.0.1:11470') && !s.url?.includes('localhost:11470')) || engineOnline);
              if (hasWebReady) {
                const rankedInterim = sourceSelectionService.rankStreams(cleanInterim, {
                  hasExternalPtSub: false,
                  preferDubbed: true,
                  identity
                });
                notifyProgressive(prioritizeRememberedSources(rankedInterim, remembered));
              }
            }
            // Na 1ª verificação: interrompe se já encontrou fontes limpas e comprovadamente reproduzíveis na Web com PT-BR
            // Na 2ª verificação (isRetryAttempt): NUNCA interrompe prematuramente, busca exaustiva (Requisito 4)
            if (!options?.isRetryAttempt) {
              const engineOnline = localEngineCache.active;
              const hasFrostStreamFinished = !sortedAddons.some(a => a.id.includes('froststream')) || collectedFromAddons.some(s => s.providerId?.includes('froststream'));
              const culprits = cleanInterim.filter(s => (s.isPtBr || s.isDubbed) && (!s.isTorrent || engineOnline));
              const hasWebReadyPtBr = culprits.length > 0;
              if (((cleanInterim.length >= 1 && hasWebReadyPtBr) || cleanInterim.length >= 2) && hasFrostStreamFinished) {
                stopSpawning = true;
              }
            }
          }
        }
      };

      // Give a known provider a short head start; then continue bounded parallel discovery.
      const workers: Promise<void>[] = [];
      if (sortedAddons.length > 0 && remembered.some(row => row.providerId === sortedAddons[0].id)) {
        workers.push(runWorker());
        await Promise.race([workers[0], new Promise<void>(resolve => setTimeout(resolve, 400))]);
      }
      workers.push(...Array.from(
        { length: Math.min(CONCURRENCY_LIMIT - workers.length, sortedAddons.length - workers.length) },
        () => runWorker()
      ));

      let timer: any = null;
      let interval: any = null;
      await Promise.race([
        Promise.all(workers).then(() => {
          // Workers concluídos normalmente
        }),
        new Promise<void>((resolve) => {
          interval = setInterval(() => {
            if (this.isCancelled(effectiveCacheKey)) {
              if (interval) clearInterval(interval);
              resolve();
              return;
            }
            if (!options?.isRetryAttempt) {
              const engineOnline = localEngineCache.active;
              const cleanInterim = streamValidator.filterCleanStreams([...streams, ...collectedFromAddons], targetTitle, originalTitle, alternateTitles, episode)
                .filter(s => sourceConfidenceEngine.evaluate(s, identity).isMatch);
              const hasFrostStreamFinished = !sortedAddons.some(a => a.id.includes('froststream')) || collectedFromAddons.some(s => s.providerId?.includes('froststream'));
              const culprits = cleanInterim.filter(s => (s.isPtBr || s.isDubbed) && (!s.isTorrent || engineOnline));
              const hasWebReadyPtBr = culprits.length > 0;
              if (((cleanInterim.length >= 1 && hasWebReadyPtBr) || cleanInterim.length >= 2) && hasFrostStreamFinished) {
                if (interval) clearInterval(interval);
                timer = setTimeout(resolve, 250);
              }
            }
          }, 60);
        })
      ]);
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);

      streams.push(...collectedFromAddons);
    }

    // 2. Fallback para Test Streams se explicitamente solicitado
    // Fontes de demonstração nunca participam da resolução de conteúdo publicado.

    // 3. Filtrar rigorosamente streams de domínios estacionados / ParkLogic / Embeds / YouTube e conteúdos trocados
    mediaLoadingTracker.transition(rawTargetId, 'VALIDATING_SOURCES', {
      rawStreamCount: streams.length
    });

    const cleanStreams = streamValidator.filterCleanStreams(streams, targetTitle, originalTitle, alternateTitles, episode).filter(s => {
      const conf = sourceConfidenceEngine.evaluate(s, identity);
      if (!conf.isMatch) return false;
      if (s.ytId) return false;
      const u = (s.url || '').toLowerCase();
      const t = (s.title || '').toLowerCase();
      // O catálogo do FenixFlix mistura Naruto clássico com Shippuden (Zeus)
      // e até outra série (Malfoy) sob o mesmo IMDb. A fonte Shinsu usa o
      // caminho explícito do clássico e entrega HLS com áudio AAC.
      if (imdbStr === 'tt0409591' && s.providerId === 'fenixflix-animes' &&
          !/🌪️\s*Hypex|💥\s*Figgs|🔋\s*Atlas|🚗\s*Arthur/i.test(s.title || '') &&
          !/\/naruto-classico-dublado\/\d+\.mp4\/index\.m3u8(?:\?|$)/i.test(s.url || '')) {
        return false;
      }
      if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        if (u.startsWith('http://')) return false;
        if (/localhost|127\.0\.0\.1|%5b%3a%3a1%5d|\[::1\]/.test(u)) return false;
      }
      if (!u.includes('.m3u8') && !u.includes('.mp4') && (u.includes('embedplay') || u.includes('playerflix') || u.includes('videasy') || u.includes('superflix'))) return false;

      // BLINDAGEM CONTRA SUBSTITUIÇÃO INDEVIDA POR CLÁSSICOS/MOCKS DE DOMÍNIO PÚBLICO OU BLENDER
      const isNightLivingDead = u.includes('night_of_the_living_dead') || t.includes('night of the living dead') || t.includes('noite dos mortos-vivos');
      if (isNightLivingDead && rawTargetId !== 'open-night-living-dead-1968' && id.imdbId !== 'tt0063350') {
        return false;
      }
      // BLOQUEIO TOTAL E IRRESTRITO DE QUALQUER FONTE DE CONTEÚDO BANIDO (BIG BUCK BUNNY, CAMINANDES, ETC.)
      if (bannedContentRegistry.isBannedStream(s)) {
        return false;
      }

      return true;
    });

    // 4. Aguardar o resultado da consulta antecipada de legendas PT-BR
    let hasExternalPtSub = false;
    try {
      hasExternalPtSub = await ptSubPromise;
    } catch {
      hasExternalPtSub = false;
    }

    mediaLoadingTracker.transition(rawTargetId, 'SELECTING_AUDIO', {
      cleanStreamsCount: cleanStreams.length,
      hasExternalPtSub
    });

    // 5. Ordenar rigorosamente pela hierarquia inteligente com prioridade absoluta para PT-BR e descarte de quarentena:
    const sorted = prioritizeRememberedSources(sourceSelectionService.rankStreams(cleanStreams, {
      hasExternalPtSub,
      preferDubbed: true,
      identity,
      cacheKey: `${effectiveCacheKey}_hasPt${hasExternalPtSub}`
    }), remembered);
    // O MP4 Arthur usa E-AC-3, que pode tocar sem som no navegador. O HLS
    // Shinsu do clássico contém AAC e deve ser tentado primeiro.
    if (imdbStr === 'tt0409591') {
      sorted.sort((a, b) =>
        Number(b.providerId === 'fenixflix-animes' && /\/naruto-classico-dublado\/\d+\.mp4\/index\.m3u8(?:\?|$)/i.test(b.url || '')) -
        Number(a.providerId === 'fenixflix-animes' && /\/naruto-classico-dublado\/\d+\.mp4\/index\.m3u8(?:\?|$)/i.test(a.url || ''))
      );
    }
    
    // 6. Enriquecer fontes validadas no MediaSourceValidationService (apenas top candidatos para evitar sobrecarga)
    const topCandidates = sorted.slice(0, 15);
    for (const s of topCandidates) {
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

    // Armazenar no cache positivo se encontrou fontes válidas, ou no cache negativo se vazio (Requisito 7)
    if (effectiveGen === this.cacheGeneration) {
      if (sorted.length > 0) {
        this.cache.set(effectiveCacheKey, { streams: sorted, timestamp: Date.now() });
        this.negativeCache.delete(effectiveCacheKey);
      } else {
        this.negativeCache.set(effectiveCacheKey, {
          timestamp: Date.now(),
          reason: 'Nenhuma fonte reproduzível encontrada',
          inconclusive: false
        });
      }
    }

    notifyProgressive(sorted);

    return sorted;
  }

  /**
   * Invalida o cache de fontes de uma obra ou limpa todo o cache.
   */
  public invalidateCache(target?: { id?: string; tmdbId?: string | number; imdbId?: string; title?: string }): void {
    if (!target) {
      this.clearCache();
      return;
    }
    const candidates = [
      target.id ? String(target.id) : '',
      target.imdbId ? String(target.imdbId) : '',
      target.tmdbId ? String(target.tmdbId) : '',
      target.title ? String(target.title).toLowerCase().trim() : ''
    ].filter(Boolean);

    for (const key of Array.from(this.cache.keys())) {
      const lowerKey = key.toLowerCase();
      if (candidates.some(c => lowerKey.includes(c.toLowerCase()))) {
        this.cache.delete(key);
      }
    }
    for (const key of Array.from(this.negativeCache.keys())) {
      const lowerKey = key.toLowerCase();
      if (candidates.some(c => lowerKey.includes(c.toLowerCase()))) {
        this.negativeCache.delete(key);
      }
    }
    sourceSelectionService.clearRankingCache();
  }

  /**
   * Limpa todos os caches de provedores e ranqueamento inteligente.
   */
  public clearCache(): void {
    this.cacheGeneration++;
    this.cache.clear();
    this.negativeCache.clear();
    this.pending.clear();
    this.progressiveListeners.clear();
    this.providerResultListeners.clear();
    sourceSelectionService.clearRankingCache();
  }
}

export const providerRegistry = new ProviderRegistryService();
