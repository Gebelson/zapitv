/**
 * ZAPITV — Authorized Add-ons Registry & Security Policy (Backend)
 * 
 * Centraliza e governa os add-ons Stremio autorizados para o proxy de metadados,
 * garantindo proteção estrita contra SSRF, isolamento de mídia e controle administrativo.
 */

export type DeliveryCapacity =
  | 'METADATA_ONLY'
  | 'TORRENT_ONLY'
  | 'DIRECT_HTTP_AVAILABLE'
  | 'PLAYABLE_SOURCE_CONFIRMED'
  | 'NO_RESULT_FOR_TEST'
  | 'NOT_TESTED';

export type ProviderHealthState =
  | 'CONFIGURATION_REQUIRED'
  | 'DISABLED'
  | 'MANIFEST_UNREACHABLE'
  | 'MANIFEST_VALID'
  | 'STREAM_ENDPOINT_UNREACHABLE'
  | 'STREAM_ENDPOINT_OPERATIONAL'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'TIMEOUT'
  | 'TEMPORARILY_UNAVAILABLE';

export interface AuthorizedAddonDefinition {
  id: string;
  name: string;
  baseUrl: string;
  origin: string;
  supportedTypes: ('movie' | 'series' | 'anime')[];
  supportedResources: ('manifest' | 'catalog' | 'meta' | 'stream' | 'subtitles')[];
  requiresConfig: boolean;
  preferredMethod: 'direct' | 'proxy_fallback' | 'proxy_direct';
  corsSupport: 'full' | 'partial' | 'none';
  timeoutPolicy: {
    directTimeoutMs: number;
    maxBudgetMs: number;
  };
  healthState: ProviderHealthState;
  deliveryCapacity: DeliveryCapacity;
  lastChecked?: string;
  failureCount: number;
  circuitBreakerUntil?: number;
}

export const FACTORY_AUTHORIZED_ADDONS: AuthorizedAddonDefinition[] = [
  {
    id: 'zapitv-show-subtitle-pt-br',
    name: 'Show Subtitle PT-BR (Stremio Oficial)',
    baseUrl: '/api/stremio/show-subtitle-pt-br',
    origin: 'internal',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'stream', 'subtitles'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 5000 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'DIRECT_HTTP_AVAILABLE',
    failureCount: 0
  },
  {
    id: 'zapitv-mico-leao-dublado',
    name: 'Mico-Leão Dublado (Stremio Addon)',
    baseUrl: '/api/stremio/mico-leao-dublado',
    origin: 'internal',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'stream', 'subtitles'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 5000 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'DIRECT_HTTP_AVAILABLE',
    failureCount: 0
  },
  {
    id: 'froststream-http',
    name: 'FrostStream (HTTP Streams PT-BR)',
    baseUrl: 'https://froststream.cloutteam.com',
    origin: 'https://froststream.cloutteam.com',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'catalog', 'meta', 'stream'],
    requiresConfig: false,
    preferredMethod: 'proxy_fallback',
    corsSupport: 'partial',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 8500 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'DIRECT_HTTP_AVAILABLE',
    failureCount: 0
  },
  {
    id: 'fenixflix-animes',
    name: 'FenixFlix (Animes Dublados PT-BR & Zeus)',
    baseUrl: 'https://fenixflix.fenixhub.online',
    origin: 'https://fenixflix.fenixhub.online',
    supportedTypes: ['anime', 'series', 'movie'],
    supportedResources: ['manifest', 'catalog', 'meta', 'stream'],
    requiresConfig: false,
    preferredMethod: 'proxy_fallback',
    corsSupport: 'partial',
    timeoutPolicy: { directTimeoutMs: 2500, maxBudgetMs: 7000 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'DIRECT_HTTP_AVAILABLE',
    failureCount: 0
  },
  {
    id: 'torrentio-brazuca',
    name: 'Torrentio Brazuca (Stremio Addon)',
    baseUrl: 'https://torrentio.strem.fun/brazuca',
    origin: 'https://torrentio.strem.fun',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'stream'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6500 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'TORRENT_ONLY',
    failureCount: 0
  },
  {
    id: 'torrentio-global',
    name: 'Torrentio Oficial (Áudio Original & Multi-Idioma)',
    baseUrl: 'https://torrentio.strem.fun',
    origin: 'https://torrentio.strem.fun',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'stream'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6500 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'TORRENT_ONLY',
    failureCount: 0
  },
  {
    id: 'magnetflix-animes',
    name: 'Magnetflix (Animes e Séries PT-BR Backup)',
    baseUrl: 'https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series',
    origin: 'https://magnetflix.flixbr.online',
    supportedTypes: ['anime', 'series', 'movie'],
    supportedResources: ['manifest', 'catalog', 'meta', 'stream'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6500 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'TORRENT_ONLY',
    failureCount: 0
  },
  {
    id: 'stremio-public-domain-web',
    name: 'Public Domain Movies (Stremio Community Addon)',
    baseUrl: 'https://public-domain-movies.strem.fun',
    origin: 'https://public-domain-movies.strem.fun',
    supportedTypes: ['movie'],
    supportedResources: ['manifest', 'catalog', 'meta', 'stream'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6000 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'DIRECT_HTTP_AVAILABLE',
    failureCount: 0
  },
  {
    id: 'stremio-cinemeta',
    name: 'Cinemeta (Stremio Oficial)',
    baseUrl: 'https://v3-cinemeta.strem.io',
    origin: 'https://v3-cinemeta.strem.io',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'catalog', 'meta'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6000 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'METADATA_ONLY',
    failureCount: 0
  },
  {
    id: 'stremio-opensubtitles',
    name: 'OpenSubtitles v3 (Stremio Oficial)',
    baseUrl: 'https://opensubtitles-v3.strem.io',
    origin: 'https://opensubtitles-v3.strem.io',
    supportedTypes: ['movie', 'series', 'anime'],
    supportedResources: ['manifest', 'subtitles'],
    requiresConfig: false,
    preferredMethod: 'direct',
    corsSupport: 'full',
    timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6000 },
    healthState: 'STREAM_ENDPOINT_OPERATIONAL',
    deliveryCapacity: 'METADATA_ONLY',
    failureCount: 0
  }
];

class AuthorizedAddonsRegistry {
  private static instance: AuthorizedAddonsRegistry | null = null;
  private addons: Map<string, AuthorizedAddonDefinition> = new Map();
  private adminApprovedOrigins: Set<string> = new Set();

  private constructor() {
    for (const addon of FACTORY_AUTHORIZED_ADDONS) {
      this.addons.set(addon.id, { ...addon });
    }
  }

  public static getInstance(): AuthorizedAddonsRegistry {
    if (!AuthorizedAddonsRegistry.instance) {
      AuthorizedAddonsRegistry.instance = new AuthorizedAddonsRegistry();
    }
    return AuthorizedAddonsRegistry.instance;
  }

  /**
   * Retorna todas as origens HTTPS autorizadas (fábrica + aprovadas por administrador)
   */
  public getAuthorizedOrigins(): Set<string> {
    const origins = new Set<string>();
    for (const addon of this.addons.values()) {
      if (addon.origin && addon.origin !== 'internal' && addon.origin.startsWith('https://')) {
        origins.add(addon.origin);
      }
    }
    for (const adminOrigin of this.adminApprovedOrigins) {
      origins.add(adminOrigin);
    }
    return origins;
  }

  /**
   * Aprovação administrativa explícita de uma nova origem de metadados
   */
  public approveOrigin(origin: string): boolean {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
        return false;
      }
      this.adminApprovedOrigins.add(parsed.origin);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove origem aprovada
   */
  public revokeOrigin(origin: string): void {
    this.adminApprovedOrigins.delete(origin);
  }

  public getAllAddons(): AuthorizedAddonDefinition[] {
    return Array.from(this.addons.values());
  }

  public getAddon(id: string): AuthorizedAddonDefinition | undefined {
    return this.addons.get(id);
  }

  public updateAddonHealth(
    id: string,
    health: ProviderHealthState,
    capacity?: DeliveryCapacity,
    failureIncrement = false
  ): void {
    let addon = this.addons.get(id);
    if (!addon) {
      addon = {
        id,
        name: id,
        baseUrl: 'https://' + id + '.test',
        origin: 'https://' + id + '.test',
        supportedTypes: ['movie', 'series', 'anime'],
        supportedResources: ['manifest', 'stream'],
        requiresConfig: false,
        preferredMethod: 'direct',
        corsSupport: 'full',
        timeoutPolicy: { directTimeoutMs: 3000, maxBudgetMs: 6000 },
        healthState: health,
        deliveryCapacity: capacity || 'NOT_TESTED',
        failureCount: 0
      };
      this.addons.set(id, addon);
    }

    addon.healthState = health;
    if (capacity) addon.deliveryCapacity = capacity;
    addon.lastChecked = new Date().toISOString();

    if (failureIncrement) {
      addon.failureCount += 1;
      // Circuit breaker: após 4 falhas consecutivas, resfria por 60 segundos
      if (addon.failureCount >= 4) {
        addon.circuitBreakerUntil = Date.now() + 60_000;
        addon.healthState = 'TEMPORARILY_UNAVAILABLE';
      }
    } else {
      addon.failureCount = 0;
      addon.circuitBreakerUntil = undefined;
    }
  }

  public isCircuitBreakerOpen(id: string): boolean {
    const addon = this.addons.get(id);
    if (!addon || !addon.circuitBreakerUntil) return false;
    if (Date.now() < addon.circuitBreakerUntil) {
      return true;
    }
    // Cooldown expirado: reseta circuito para permitir nova tentativa
    addon.circuitBreakerUntil = undefined;
    addon.failureCount = 0;
    return false;
  }
}

export const authorizedAddonsRegistry = AuthorizedAddonsRegistry.getInstance();
