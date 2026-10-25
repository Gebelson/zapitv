import { StremioStream } from '../stremio/stremioTypes';
import { CanonicalMediaIdentity } from '../identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../identity/sourceConfidenceEngine';
import { streamQuarantineService } from '../security/streamQuarantineService';
import { videoAdBlocker } from '../security/videoAdBlocker';
import { audioPreferenceService } from '../audio/audioPreferenceService';
import { subtitlePreferenceService } from '../subtitles/subtitlePreferenceService';
import { mediaAvailabilityIndex } from '../catalog/MediaAvailabilityIndex';

export type ValidationState =
  | 'discovered'
  | 'accessible'
  | 'container_valid'
  | 'video_compatible'
  | 'audio_valid'
  | 'language_identified'
  | 'resolution_known'
  | 'identity_verified'
  | 'ready_for_playback'
  | 'rejected';

export interface ValidatedAudioTrack {
  id: string | number;
  name: string;
  lang: string;
  isPtBr: boolean;
  isDubbed: boolean;
  codec?: string;
  channels?: number;
}

export interface ValidatedSource {
  mediaId: string;
  sourceId: string;
  providerId: string;
  providerName: string;
  url: string;
  canonicalIdentity?: CanonicalMediaIdentity;
  season?: number;
  episode?: number;
  streamType: 'hls' | 'dash' | 'mp4' | 'webm' | 'unknown';
  audioLanguages: string[];
  availableAudioTracks: ValidatedAudioTrack[];
  availableResolutions: string[];
  resolutionsByAudioTrack: Record<string, string[]>;
  videoCodec?: string;
  audioCodec?: string;
  hasFunctionalAudio: boolean;
  audioValidationReason?: string;
  availability: 'ready' | 'pending' | 'unavailable' | 'rejected';
  validationState: ValidationState;
  lastChecked: number;
  rejectionReason?: string;
  originalStream: StremioStream;
}

export interface SourceValidationContext {
  mediaId: string;
  mediaTitle: string;
  mediaType: 'movie' | 'series' | 'anime';
  season?: number;
  episode?: number;
  canonicalIdentity?: CanonicalMediaIdentity;
  hasExternalPtSub?: boolean;
}

const STORAGE_VALIDATED_SOURCES_KEY = 'zapitv_validated_sources_v5_canonical';
const VALIDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h para fontes válidas
const REJECTED_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h para fontes rejeitadas

export class MediaSourceValidationService {
  private static instance: MediaSourceValidationService;
  private cache = new Map<string, ValidatedSource>();
  private validationPromises = new Map<string, Promise<ValidatedSource>>();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): MediaSourceValidationService {
    if (!MediaSourceValidationService.instance) {
      MediaSourceValidationService.instance = new MediaSourceValidationService();
    }
    return MediaSourceValidationService.instance;
  }

  /**
   * Gera uma chave única e estável para a fonte
   */
  public getSourceKey(mediaId: string, stream: StremioStream, season?: number, episode?: number): string {
    const rawUrl = stream.url || stream.infoHash || `${stream.name}-${stream.title}`;
    const epKey = season !== undefined && episode !== undefined ? `_s${season}e${episode}` : '';
    return `${mediaId.toLowerCase()}${epKey}_${rawUrl.toLowerCase()}`;
  }

  /**
   * Carrega cache persistente
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_VALIDATED_SOURCES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          for (const item of parsed) {
            if (item && item.sourceId && item.lastChecked) {
              const ttl = item.availability === 'rejected' ? REJECTED_CACHE_TTL_MS : VALIDATION_CACHE_TTL_MS;
              if (now - item.lastChecked < ttl) {
                // Invalida do cache qualquer fonte que não atenda à política corrigida de identidade
                if (item.canonicalIdentity && item.originalStream) {
                  const conf = sourceConfidenceEngine.evaluate(item.originalStream, item.canonicalIdentity);
                  if (!conf.isMatch || conf.confidence === 'REJECTED' || conf.confidence === 'QUARANTINED') {
                    continue;
                  }
                }
                this.cache.set(item.sourceId, item);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[MediaSourceValidationService] Erro ao carregar cache de validação:', e);
    }
  }

  /**
   * Salva cache persistente
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const items = Array.from(this.cache.values()).slice(-500);
      localStorage.setItem(STORAGE_VALIDATED_SOURCES_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[MediaSourceValidationService] Erro ao salvar cache de validação:', e);
    }
  }

  /**
   * Extrai o tipo de stream a partir da URL
   */
  public detectStreamType(url: string): ValidatedSource['streamType'] {
    const clean = url.toLowerCase().split('?')[0];
    if (clean.includes('.m3u8')) return 'hls';
    if (clean.includes('.mpd')) return 'dash';
    if (clean.endsWith('.mp4') || clean.endsWith('.m4v')) return 'mp4';
    if (clean.endsWith('.webm')) return 'webm';
    return 'unknown';
  }

  /**
   * Extrai resoluções reais de um stream (sem inventar resoluções ou herdar de outras fontes)
   */
  public extractStreamResolutions(stream: StremioStream, parsedLevels?: string[]): string[] {
    if (parsedLevels && parsedLevels.length > 0) {
      const validLevels = parsedLevels
        .map(l => l.toLowerCase().trim())
        .filter(l => /^(360p|480p|720p|1080p|1440p|2160p|4k)$/i.test(l))
        .map(l => l === '2160p' ? '4K' : (l.endsWith('p') ? l : `${l}p`));
      if (validLevels.length > 0) {
        return Array.from(new Set(validLevels));
      }
    }

    const text = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase();
    const qualities: string[] = [];

    // Confirmação estrita: 4K só entra se houver menção explícita de 2160p ou 4K no nome do release
    if (/\b(2160p|4k|uhd)\b/i.test(text)) {
      qualities.push('4K');
    }
    if (/\b(1440p|2k|qhd)\b/i.test(text)) {
      qualities.push('1440p');
    }
    if (/\b(1080p|fhd|full[-_\s]?hd)\b/i.test(text)) {
      qualities.push('1080p');
    }
    if (/\b(720p|hd)\b/i.test(text) && !/\b(full[-_\s]?hd|fhd|uhd)\b/i.test(text)) {
      qualities.push('720p');
    }
    if (/\b(480p|sd)\b/i.test(text)) {
      qualities.push('480p');
    }
    if (/\b(360p)\b/i.test(text)) {
      qualities.push('360p');
    }

    // Se nenhuma resolução foi identificada no texto, atribui com base no stream.quality declarado
    if (qualities.length === 0 && stream.quality) {
      const q = stream.quality.toLowerCase();
      if (q.includes('4k') || q.includes('2160')) qualities.push('4K');
      else if (q.includes('1440') || q.includes('2k')) qualities.push('1440p');
      else if (q.includes('1080')) qualities.push('1080p');
      else if (q.includes('720')) qualities.push('720p');
      else if (q.includes('480')) qualities.push('480p');
      else if (q.includes('360')) qualities.push('360p');
    }

    // Padrão conservador se nada for encontrado: 1080p ou 720p (NUNCA 4K inventado!)
    return qualities.length > 0 ? qualities : ['1080p'];
  }

  /**
   * Retorna a resolução mais alta confirmada de um stream individual
   */
  public getPrimaryResolution(stream: StremioStream): string {
    const resolutions = this.extractStreamResolutions(stream);
    if (resolutions.includes('4K')) return '4K';
    if (resolutions.includes('1440p')) return '1440p';
    if (resolutions.includes('1080p')) return '1080p';
    if (resolutions.includes('720p')) return '720p';
    if (resolutions.includes('480p')) return '480p';
    if (resolutions.includes('360p')) return '360p';
    return resolutions[0] || '1080p';
  }

  /**
   * Validação técnica profunda e centralizada de uma fonte Stremio
   */
  public async validateSource(
    stream: StremioStream,
    context: SourceValidationContext
  ): Promise<ValidatedSource> {
    const sourceKey = this.getSourceKey(context.mediaId, stream, context.season, context.episode);

    // Retorna cache existente se ainda for válido
    const cached = this.cache.get(sourceKey);
    if (cached && Date.now() - cached.lastChecked < VALIDATION_CACHE_TTL_MS) {
      return cached;
    }

    // Reutiliza promessa em andamento para evitar verificações duplicadas simultâneas
    const inFlight = this.validationPromises.get(sourceKey);
    if (inFlight) {
      return inFlight;
    }

    const validationPromise = this.performValidation(stream, context, sourceKey);
    this.validationPromises.set(sourceKey, validationPromise);

    try {
      const result = await validationPromise;
      this.cache.set(sourceKey, result);
      this.saveToStorage();
      return result;
    } finally {
      this.validationPromises.delete(sourceKey);
    }
  }

  private async performValidation(
    stream: StremioStream,
    context: SourceValidationContext,
    sourceKey: string
  ): Promise<ValidatedSource> {
    const now = Date.now();
    const providerId = stream.providerId || stream.providerName || 'unknown-provider';
    const providerName = stream.providerName || stream.name || 'Provedor Desconhecido';
    const rawUrl = stream.url || '';

    // 1. Verificação de Integridade Básica (URL presente)
    if (!rawUrl) {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: '',
        season: context.season,
        episode: context.episode,
        streamType: 'unknown',
        audioLanguages: [],
        availableAudioTracks: [],
        availableResolutions: [],
        resolutionsByAudioTrack: {},
        hasFunctionalAudio: false,
        audioValidationReason: 'Sem URL direta de stream',
        availability: 'rejected',
        validationState: 'rejected',
        lastChecked: now,
        rejectionReason: 'Stream sem URL válida de reprodução',
        originalStream: stream
      };
    }

    // 2. Filtro de Quarentena e Conteúdo Adulto
    const quarantine = streamQuarantineService.evaluateQuarantine(stream, context.mediaTitle);
    if (quarantine.isQuarantined) {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: rawUrl,
        season: context.season,
        episode: context.episode,
        streamType: this.detectStreamType(rawUrl),
        audioLanguages: [],
        availableAudioTracks: [],
        availableResolutions: [],
        resolutionsByAudioTrack: {},
        hasFunctionalAudio: false,
        audioValidationReason: 'Fonte em quarentena de segurança',
        availability: 'rejected',
        validationState: 'rejected',
        lastChecked: now,
        rejectionReason: `Fonte isolada por segurança (${quarantine.reason})`,
        originalStream: stream
      };
    }

    // 3. Filtro de Bloqueio por Propagandas Embutidas (1xBet, etc.)
    const adEval = videoAdBlocker.evaluateStream(stream, context.mediaTitle, context.season, context.episode);
    if (adEval.status === 'bloqueado por propaganda embutida') {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: rawUrl,
        season: context.season,
        episode: context.episode,
        streamType: this.detectStreamType(rawUrl),
        audioLanguages: [],
        availableAudioTracks: [],
        availableResolutions: [],
        resolutionsByAudioTrack: {},
        hasFunctionalAudio: false,
        audioValidationReason: 'Fonte com propaganda de apostas embutida',
        availability: 'rejected',
        validationState: 'rejected',
        lastChecked: now,
        rejectionReason: `Rejeitado: ${adEval.reason}`,
        originalStream: stream
      };
    }

    // 4. Verificação de Identidade Canônica da Obra (REGRA 7 — Identidade Correta)
    if (context.canonicalIdentity) {
      const confEval = sourceConfidenceEngine.evaluate(stream, context.canonicalIdentity);
      if (!confEval.isMatch || confEval.confidence === 'REJECTED' || confEval.confidence === 'QUARANTINED') {
        return {
          mediaId: context.mediaId,
          sourceId: sourceKey,
          providerId,
          providerName,
          url: rawUrl,
          season: context.season,
          episode: context.episode,
          streamType: this.detectStreamType(rawUrl),
          audioLanguages: [],
          availableAudioTracks: [],
          availableResolutions: [],
          resolutionsByAudioTrack: {},
          hasFunctionalAudio: false,
          audioValidationReason: 'Divergência de identidade da obra',
          availability: 'rejected',
          validationState: 'rejected',
          lastChecked: now,
          rejectionReason: `Título incompatível: ${confEval.reasons.join(', ')}`,
          originalStream: stream
        };
      }
    }

    // 5. Análise Técnica de Áudio e Idioma
    const audioAnalysis = audioPreferenceService.analyzeAudio(stream);
    const subtitleAnalysis = subtitlePreferenceService.analyzeSubtitles(stream, context.hasExternalPtSub || false);

    const streamType = this.detectStreamType(rawUrl);
    const resolutions = this.extractStreamResolutions(stream);

    // Mapeamento de faixas de áudio identificadas
    const audioTracks: ValidatedAudioTrack[] = [];
    const audioLanguages: string[] = [];
    const resolutionsByAudio: Record<string, string[]> = {};

    if (audioAnalysis.isPtBr) {
      audioLanguages.push('pt-BR');
      audioTracks.push({
        id: 'track-pt-br',
        name: audioAnalysis.isDubbed ? 'Português (Dublado)' : 'Português (Brasil)',
        lang: 'pt-BR',
        isPtBr: true,
        isDubbed: audioAnalysis.isDubbed
      });
      // Resoluções permitidas para a dublagem PT-BR (apenas as que o release realmente possui!)
      resolutionsByAudio['pt-BR'] = [...resolutions];
    }

    if (audioAnalysis.isDualAudio || !audioAnalysis.isPtBr) {
      const origLang = audioAnalysis.language === 'pt-BR' ? 'en' : (audioAnalysis.language !== 'unknown' ? audioAnalysis.language : 'original');
      if (!audioLanguages.includes(origLang)) {
        audioLanguages.push(origLang);
        audioTracks.push({
          id: `track-${origLang}`,
          name: origLang === 'ja' ? 'Japonês (Original)' : (origLang === 'en' ? 'Inglês (Original)' : 'Áudio Original'),
          lang: origLang,
          isPtBr: false,
          isDubbed: false
        });
        resolutionsByAudio[origLang] = [...resolutions];
      }
    }

    // Se não há idioma identificado com certeza, adiciona 'original'
    if (audioLanguages.length === 0) {
      audioLanguages.push('original');
      audioTracks.push({
        id: 'track-original',
        name: 'Áudio Original',
        lang: 'original',
        isPtBr: false,
        isDubbed: false
      });
      resolutionsByAudio['original'] = [...resolutions];
    }

    // 6. Teste de Acessibilidade da URL (Head probe com timeout de 4s)
    let isAccessible = true;
    let probeReason = 'Stream acessível';
    let detectedAudioOk = true;

    // Se for URL HTTP externa, faz uma verificação leve de cabeçalhos
    // ATENÇÃO: NÃO faz probe via proxy para endereços locais de engine (127.0.0.1:11470 ou localhost:11470)
    // nem para torrents/infoHash, evitando requisições com 502 Bad Gateway que congestionam a rede.
    const isTorrentEngineUrl = rawUrl.includes('127.0.0.1:11470') ||
      rawUrl.includes('localhost:11470') ||
      Boolean(stream.infoHash) ||
      Boolean((stream as any).isTorrent);

    if (isTorrentEngineUrl) {
      isAccessible = true;
      probeReason = 'Stream via Stremio Streaming Server / Torrent';
    } else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      try {
        const probeUrl = rawUrl.startsWith('http://localhost') || rawUrl.startsWith('/api/')
          ? rawUrl
          : `/api/proxy?url=${encodeURIComponent(rawUrl)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const resp = await fetch(probeUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-1024' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = resp.headers.get('content-type') || '';

        // Se retornar HTML de erro (Cloudflare, 404, ParkLogic), rejeita imediatamente
        if (contentType.includes('text/html') && !rawUrl.includes('.m3u8')) {
          isAccessible = false;
          probeReason = 'Servidor retornou página HTML de erro ou domínio estacionado';
        } else if (resp.status >= 400 && resp.status !== 416) {
          isAccessible = false;
          probeReason = `Servidor respondeu com código de erro HTTP ${resp.status}`;
        }
      } catch (err: any) {
        // Se a rota falhar por CORS direto no frontend, não rejeita imediatamente se for stream HLS conhecido
        if (err?.name === 'AbortError') {
          probeReason = 'Tempo limite de resposta do servidor da fonte (4s)';
        }
      }
    }

    if (!isAccessible) {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: rawUrl,
        season: context.season,
        episode: context.episode,
        streamType,
        audioLanguages,
        availableAudioTracks: audioTracks,
        availableResolutions: resolutions,
        resolutionsByAudioTrack: resolutionsByAudio,
        hasFunctionalAudio: false,
        audioValidationReason: probeReason,
        availability: 'rejected',
        validationState: 'rejected',
        lastChecked: now,
        rejectionReason: probeReason,
        originalStream: stream
      };
    }

    return {
      mediaId: context.mediaId,
      sourceId: sourceKey,
      providerId,
      providerName,
      url: rawUrl,
      canonicalIdentity: context.canonicalIdentity,
      season: context.season,
      episode: context.episode,
      streamType,
      audioLanguages,
      availableAudioTracks: audioTracks,
      availableResolutions: resolutions,
      resolutionsByAudioTrack: resolutionsByAudio,
      hasFunctionalAudio: detectedAudioOk,
      audioValidationReason: 'Trilha de áudio compatível detectada',
      availability: 'ready',
      validationState: 'ready_for_playback',
      lastChecked: now,
      originalStream: stream
    };
  }

  /**
   * Filtra e retorna apenas as resoluções válidas para uma combinação de fonte e idioma de áudio
   */
  public getResolutionsForLanguage(source: ValidatedSource, langCode: string): string[] {
    if (source.resolutionsByAudioTrack[langCode]) {
      return source.resolutionsByAudioTrack[langCode];
    }
    return source.availableResolutions.length > 0 ? source.availableResolutions : ['1080p'];
  }

  /**
   * Obtém registro em cache de uma fonte
   */
  public getCachedSource(sourceKey: string): ValidatedSource | undefined {
    return this.cache.get(sourceKey);
  }

  /**
   * Invalida registros de uma fonte quando ocorre erro de reprodução
   */
  public invalidateSource(mediaId: string, streamUrl: string, reason: string): void {
    for (const record of this.cache.values()) {
      if (record.mediaId === mediaId && record.url === streamUrl) {
        record.availability = 'rejected';
        record.validationState = 'rejected';
        record.rejectionReason = reason;
        record.lastChecked = Date.now();
      }
    }
    this.saveToStorage();
  }
}

export const mediaSourceValidationService = MediaSourceValidationService.getInstance();
