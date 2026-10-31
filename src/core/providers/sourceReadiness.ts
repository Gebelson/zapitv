import type { StremioStream } from '../stremio/stremioTypes';
import { sanitizePlaybackReason } from '../tracking/mediaLoadingTracker';

/**
 * Os 4 estados canônicos do ciclo de vida de uma fonte na ZapiTV:
 * 1. discovered: Fonte retornada pela busca de um provedor upstream.
 * 2. identity_verified: Obra, temporada e episódio validados estritamente contra o TMDB/IMDb.
 * 3. technically_ready: Protocolo, codecs, compatibilidade com o dispositivo e fora de quarentena.
 * 4. playback_confirmed: Primeiro frame decodificado com progresso de tempo verificado (>0.5s).
 */
export type SourceLifecycleStage =
  | 'discovered'
  | 'identity_verified'
  | 'technically_ready'
  | 'playback_confirmed';

export type PlaybackPlatform =
  | 'firetv'
  | 'android_mobile'
  | 'desktop_chrome'
  | 'desktop_safari'
  | 'smart_tv_tizen'
  | 'smart_tv_webos'
  | 'generic_web';

export interface DevicePlaybackProfile {
  platform: PlaybackPlatform;
  isTv: boolean;
  isMobile: boolean;
  prefersHlsOverMp4: boolean;
  supportsHevc: boolean;
  supportsEac3: boolean;
  isHttpsOrigin: boolean;
}

export interface ProblematicSourceRecord {
  url: string;
  reason: string;
  timestamp: number;
  failuresCount: number;
}

// Armazenamento em memória de fontes com problemas recentes (quarentena transitória com TTL de 15 minutos)
const PROBLEMATIC_COOLDOWN_MS = 15 * 60 * 1000;
const problematicSources = new Map<string, ProblematicSourceRecord>();

/**
 * Detecta o perfil de hardware e ambiente de execução do dispositivo ativo.
 */
export function getDevicePlaybackProfile(): DevicePlaybackProfile {
  if (typeof window === 'undefined') {
    return {
      platform: 'generic_web',
      isTv: false,
      isMobile: false,
      prefersHlsOverMp4: false,
      supportsHevc: false,
      supportsEac3: false,
      isHttpsOrigin: false,
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const isHttpsOrigin = window.location.protocol === 'https:';

  // Detecção de Fire TV / Silk Browser
  const isFireTv = ua.includes('aft') || ua.includes('firetv') || ua.includes('silk') || ua.includes('amazonwebappplatform');
  // Detecção de Tizen / webOS
  const isTizen = ua.includes('tizen') || ua.includes('smart-tv');
  const isWebOs = ua.includes('webos') || ua.includes('netcast');
  // Detecção de Mobile
  const isMobile = /android|iphone|ipad|ipod|windows phone/i.test(ua) && !isFireTv && !isTizen && !isWebOs;
  // Detecção de Safari Desktop
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua) && !isMobile;

  let platform: PlaybackPlatform = 'generic_web';
  if (isFireTv) platform = 'firetv';
  else if (isTizen) platform = 'smart_tv_tizen';
  else if (isWebOs) platform = 'smart_tv_webos';
  else if (isMobile) platform = 'android_mobile';
  else if (isSafari) platform = 'desktop_safari';
  else platform = 'desktop_chrome';

  const isTv = isFireTv || isTizen || isWebOs || window.location.pathname.startsWith('/tv') || window.location.search.includes('tv=1');

  return {
    platform,
    isTv,
    isMobile,
    prefersHlsOverMp4: isTv || isMobile,
    supportsHevc: isTv && !ua.includes('aftm'), // Fire TV Stick Lite / modelos antigos podem ter limitação
    supportsEac3: isTv, // Smart TVs geralmente possuem passthrough HDMI ARC
    isHttpsOrigin,
  };
}

/**
 * Normaliza uma URL para chave estável de quarentena.
 */
function normalizeSourceUrlKey(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    return decoded.split('?')[0].trim().toLowerCase();
  } catch {
    return url.split('?')[0].trim().toLowerCase();
  }
}

/**
 * Marca uma fonte como temporariamente problemática após falha real de carregamento, rede ou decodificação.
 */
export function markSourceTemporarilyProblematic(url: string, reason: string): void {
  if (!url) return;
  const key = normalizeSourceUrlKey(url);
  const existing = problematicSources.get(key);
  const failuresCount = (existing?.failuresCount || 0) + 1;
  const sanitized = sanitizePlaybackReason(reason) || 'Falha de reprodução não especificada';

  problematicSources.set(key, {
    url,
    reason: sanitized,
    timestamp: Date.now(),
    failuresCount,
  });
}

/**
 * Verifica se a fonte está em período de penalidade temporária (quarentena transitória).
 */
export function isSourceTemporarilyProblematic(url: string): boolean {
  if (!url) return false;
  const key = normalizeSourceUrlKey(url);
  const record = problematicSources.get(key);
  if (!record) return false;

  const age = Date.now() - record.timestamp;
  if (age > PROBLEMATIC_COOLDOWN_MS) {
    problematicSources.delete(key);
    return false;
  }
  return true;
}

/**
 * Retorna o motivo pelo qual a fonte foi marcada como problemática.
 */
export function getProblematicSourceReason(url: string): string | undefined {
  if (!url) return undefined;
  const key = normalizeSourceUrlKey(url);
  const record = problematicSources.get(key);
  if (!record) return undefined;
  if (Date.now() - record.timestamp > PROBLEMATIC_COOLDOWN_MS) {
    problematicSources.delete(key);
    return undefined;
  }
  return record.reason;
}

/**
 * Limpa todas as fontes marcadas como problemáticas (para retry forçado ou testes).
 */
export function clearProblematicSources(): void {
  problematicSources.clear();
}

/**
 * Avaliação rigorosa de prontidão técnica da fonte (Estágio 3):
 * 1. Possui URL válida e acessível.
 * 2. Não está em quarentena temporária por falha recente.
 * 3. Não viola Mixed Content (HTTP em HTTPS) a menos que use a rota de proxy segura.
 * 4. Não depende de motor local Stremio Engine inexistente/inativo.
 * 5. Não utiliza domínios estacionados, bloqueados ou assinaturas Malfoy.
 * 6. Codecs compatíveis com o perfil do dispositivo.
 */
export function isSourceTechnicallyPlayable(
  stream: StremioStream,
  profile?: DevicePlaybackProfile
): boolean {
  if (!stream || !stream.url) return false;

  let url = stream.url;
  try { url = decodeURIComponent(url); } catch {}
  const normUrl = url.toLowerCase();

  // 1. Quarentena transitória por falhas consecutivas nesta sessão
  if (isSourceTemporarilyProblematic(url)) {
    return false;
  }

  // 2. Dependência de Stremio Engine local / Torrents
  const requiresLocalEngine = Boolean(stream.isTorrent) ||
    /(?:^|[/:])(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(normUrl) ||
    Boolean(stream.infoHash);

  if (requiresLocalEngine) {
    // Se a fonte depende do motor local, só é tecnicamente pronta se o motor foi confirmado
    return stream.behaviorHints?.notWebReady === false;
  }

  const effectiveProfile = profile || getDevicePlaybackProfile();

  // 3. Proteção contra Mixed Content em conexões HTTPS
  if (effectiveProfile.isHttpsOrigin && normUrl.startsWith('http://') && !normUrl.includes('/api/proxy')) {
    // Requisição HTTP pura em página HTTPS será bloqueada pelo navegador (Mixed Content)
    return false;
  }

  // 4. Domínios estacionados ou corrompidos
  if (normUrl.includes('parklogic') || normUrl.includes('superflixapi.top') || normUrl.includes('hugedomains')) {
    return false;
  }

  // 5. Filtro de assinaturas Malfoy conhecidas por corromper episódios
  const streamTitle = `${stream.name || ''} ${stream.title || ''}`.toLowerCase();
  if (streamTitle.includes('malfoy') || streamTitle.includes('🐉')) {
    return false;
  }

  // 6. Compatibilidade de container
  const isHls = normUrl.includes('.m3u8') || stream.sourceType === 'hls';
  const isDash = normUrl.includes('.mpd');
  const isDirectVideo = normUrl.includes('.mp4') || normUrl.includes('.webm') || normUrl.includes('.ogv') ||
    normUrl.includes('/api/proxy') || stream.sourceType === 'mp4';

  if (!isHls && !isDash && !isDirectVideo) {
    // URLs que apontam para embeds, páginas web ou iframes não são tecnicamente reproduzíveis pelo player nativo
    if (normUrl.includes('embed') || normUrl.includes('iframe') || normUrl.includes('playerflix')) {
      return false;
    }
  }

  // 7. Compatibilidade de áudio por dispositivo
  // Releases MP4 com áudio puro E-AC-3 sem AAC falham silenciosamente em navegadores sem passthrough
  if (!effectiveProfile.supportsEac3 && !isHls && (streamTitle.includes('e-ac-3') || streamTitle.includes('eac3')) && !streamTitle.includes('aac')) {
    // Desqualifica como tecnicamente pronto para desktop se não tiver HLS ou áudio AAC alternativo
    if (effectiveProfile.platform === 'desktop_chrome') {
      return false;
    }
  }

  return true;
}

/**
 * Função de retrocompatibilidade preservando a assinatura histórica no ecossistema.
 */
export function isSourcePlayableHere(stream: StremioStream): boolean {
  return isSourceTechnicallyPlayable(stream);
}
