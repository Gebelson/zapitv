/**
 * ZapiTV — OfflineSourceInspector
 * Inspeciona fontes com permissão explícita de armazenamento offline.
 * Aceita MP4/WebM diretos acessíveis pelo navegador. HLS, DASH e DRM exigem
 * um mecanismo de licença/armazenamento próprio e não são anunciados como MP4.
 */

import { StremioStream } from '../stremio/stremioTypes';
import { DownloadQualityOption } from './offlineTypes';
import { providerRegistry } from '../providers/providerRegistry';
import { ContentItem, ContentType } from '../../../types';
import { VERIFIED_OPEN_ITEMS } from '../catalog/verifiedCatalog';

export interface InspectionDiagnosisParams {
  item?: ContentItem;
  streams?: StremioStream[];
  skipDiscovery?: boolean;
  season?: number;
  episode?: number;
  preferredLanguage?: 'pt-BR' | 'original';
  durationMinutes?: number;
}

export interface InspectionDiagnosisResult {
  options: DownloadQualityOption[];
  reason?: string;
  identifiedSourcesCount: number;
  compatibleSourcesCount: number;
  drmProtectedCount: number;
  torrentEngineRequiredCount: number;
  corsRestrictedCount: number;
}

export class OfflineSourceInspector {
  /**
   * Avalia as fontes disponíveis e retorna diagnóstico detalhado das opções reais para download.
   * Suporta chamada com parâmetros em objeto ou assinatura tradicional (streams, preferredLanguage, durationMinutes).
   */
  public async inspectDownloadOptionsDetailed(
    streamsOrParams: StremioStream[] | InspectionDiagnosisParams,
    preferredLangParam: 'pt-BR' | 'original' = 'pt-BR',
    durationParam: number = 90
  ): Promise<InspectionDiagnosisResult> {
    let item: ContentItem | undefined;
    let initialStreams: StremioStream[] = [];
    let season: number | undefined;
    let episode: number | undefined;
    let preferredLanguage: 'pt-BR' | 'original' = preferredLangParam;
    let durationMinutes = durationParam;
    let skipDiscovery = false;

    if (Array.isArray(streamsOrParams)) {
      initialStreams = [...streamsOrParams];
    } else if (streamsOrParams && typeof streamsOrParams === 'object') {
      item = streamsOrParams.item;
      initialStreams = Array.isArray(streamsOrParams.streams) ? [...streamsOrParams.streams] : [];
      skipDiscovery = streamsOrParams.skipDiscovery === true;
      season = streamsOrParams.season;
      episode = streamsOrParams.episode;
      preferredLanguage = streamsOrParams.preferredLanguage || 'pt-BR';
      durationMinutes = streamsOrParams.durationMinutes || 90;
    }

    // 1. Coleta todas as fontes candidatas (incluindo busca de alternativas se necessário)
    let candidatePool = [...initialStreams];

    // Busca no provedor somente quando o chamador ainda não possui candidatas.
    if (item && candidatePool.length === 0 && !skipDiscovery) {
      try {
        const isMovie = item.mediaFormat === 'movie' || item.type === ContentType.MOVIE;
        const targetType = isMovie ? 'movie' : (item.type === ContentType.ANIME ? 'anime' : 'series');
        const epParams = (season !== undefined && episode !== undefined) ? { season, episode } : undefined;
        
        const extraStreams = await providerRegistry.resolveStreams(
          targetType,
          {
            tmdbId: item.tmdbId,
            imdbId: item.imdbId,
            id: item.id,
            title: item.title,
            originalTitle: item.originalTitle,
            year: item.year
          },
          epParams
        );

        if (Array.isArray(extraStreams) && extraStreams.length > 0) {
          const existingUrls = new Set(candidatePool.map(s => s.url));
          for (const s of extraStreams) {
            if (s && s.url && !existingUrls.has(s.url)) {
              candidatePool.push(s);
              existingUrls.add(s.url);
            }
          }
        }
      } catch (e) {
        console.warn('[OfflineSourceInspector] Falha ao buscar fontes adicionais:', e);
      }
    }

    // Se ainda estiver vazio e o item tiver verifiedStreams
    if (candidatePool.length === 0 && season === undefined && item?.verifiedStreams) {
      candidatePool.push(...item.verifiedStreams);
    }

    // Procura no acervo aberto se ainda não tiver fontes
    if (candidatePool.length === 0 && item && season === undefined) {
      const match = VERIFIED_OPEN_ITEMS.find(i => i.id === item.id || i.tmdbId === item.tmdbId || i.imdbId === item.imdbId);
      if (match?.verifiedStreams) {
        candidatePool.push(...match.verifiedStreams);
      }
    }

    if (candidatePool.length === 0) {
      return {
        options: [],
        reason: 'Nenhuma fonte de reprodução foi encontrada para este título nos provedores configurados.',
        identifiedSourcesCount: 0,
        compatibleSourcesCount: 0,
        drmProtectedCount: 0,
        torrentEngineRequiredCount: 0,
        corsRestrictedCount: 0
      };
    }

    // 2. Classificação e diagnóstico das fontes
    let drmProtectedCount = 0;
    let torrentEngineRequiredCount = 0;
    let corsRestrictedCount = 0;
    let onlineOnlyCount = 0;
    let adaptiveCount = 0;
    let authRequiredCount = 0;
    const eligibleStreams: Array<{
      stream: StremioStream;
      resolvedUrl: string;
      sourceType: 'mp4' | 'webm' | 'hls';
      qualities: string[];
      isDubbed: boolean;
    }> = [];

    for (const s of candidatePool) {
      if (!s || !s.url) continue;
      const rawUrl = s.url.trim();
      if (!s.offlineAllowed) { onlineOnlyCount++; continue; }
      if (rawUrl.startsWith('/api/proxy?')) { corsRestrictedCount++; continue; }
      if (s.behaviorHints?.proxyHeaders?.request || s.behaviorHints?.headers) {
        authRequiredCount++;
        continue; // Não copiar credenciais de addon para o navegador ou logs.
      }
      const lower = rawUrl.toLowerCase();
      const mediaPath = (() => { try { return new URL(rawUrl, 'https://zapitv.local').pathname.toLowerCase(); } catch { return ''; } })();

      // A) DRM Comercial Real (Widevine, PlayReady, FairPlay, SAMPLE-AES)
      const hasCommercialDrm = (
        lower.startsWith('widevine:') ||
        lower.startsWith('playready:') ||
        lower.startsWith('fairplay:') ||
        lower.includes('clearkey') ||
        Boolean(s.behaviorHints && (s.behaviorHints as any).drm)
      );

      if (hasCommercialDrm) {
        // Suporte EME do navegador não é uma licença offline concedida ao ZapiTV.
        drmProtectedCount++;
        continue;
      }

      // B) Fontes que requerem motor local do Stremio (127.0.0.1:11470)
      if (lower.includes('127.0.0.1:11470') || lower.includes('localhost:11470')) {
        torrentEngineRequiredCount++;
        continue; // Motor local não estaria disponível durante a reprodução offline.
      }

      // Download exige acesso direto permitido pela origem (sem contornar CORS).
      const resolvedUrl = rawUrl;

      // D) Identificação do tipo de contêiner
      const isHls = mediaPath.endsWith('.m3u8') || s.sourceType === 'hls';
      const isWebm = mediaPath.endsWith('.webm') || s.sourceType === 'webm';
      // O downloader atual não remuxa segmentos HLS em um arquivo reproduzível.
      // Não anuncie um download que terminaria como MP4 corrompido.
      if (isHls || s.sourceType === 'dash') { adaptiveCount++; continue; }
      if (!mediaPath.endsWith('.mp4') && !isWebm && s.sourceType !== 'mp4') continue;
      const sourceType: 'mp4' | 'webm' | 'hls' = isHls ? 'hls' : (isWebm ? 'webm' : 'mp4');

      // F) O validador do player usa 1080p como padrão quando não há dado.
      // Para download isso seria uma qualidade fictícia; usamos só declarações.
      let qualityList: string[] = [];
      const text = `${s.quality || ''} ${s.name || ''} ${s.title || ''}`.toLowerCase();
      if (/\b(2160p|4k|uhd)\b/i.test(text)) qualityList.push('4K');
      else if (/\b(1440p|2k|qhd)\b/i.test(text)) qualityList.push('1440p');
      else if (/\b(1080p|fhd|full[-_\s]?hd)\b/i.test(text)) qualityList.push('1080p');
      else if (/\b(720p|hd)\b/i.test(text)) qualityList.push('720p');
      else if (/\b(480p|sd)\b/i.test(text)) qualityList.push('480p');
      else if (/\b(360p)\b/i.test(text)) qualityList.push('360p');

      // Arquivo direto sem resolução declarada continua utilizável, mas não
      // recebe uma qualidade inventada.
      if (qualityList.length === 0) qualityList = ['Original'];

      const isDubbed = Boolean(s.isDubbed);

      eligibleStreams.push({
        stream: s,
        resolvedUrl,
        sourceType,
        qualities: qualityList,
        isDubbed
      });
    }

    // Se não houver fontes elegíveis, mostra o motivo disponível.
    if (eligibleStreams.length === 0) {
      let specificReason = 'Nenhuma fonte com permissão explícita para download offline, acesso direto e formato MP4/WebM foi encontrada.';
      
      if (onlineOnlyCount === candidatePool.length) {
        specificReason = `${onlineOnlyCount} fonte(s) encontrada(s) para assistir online, mas nenhuma informa permissão para armazenamento offline.`;
      } else if (authRequiredCount > 0) {
        specificReason = 'A fonte offline exige autenticação do provedor que ainda não pode ser renovada com segurança no navegador.';
      } else if (adaptiveCount > 0) {
        specificReason = 'A fonte autorizada usa HLS/DASH; ainda falta armazenamento e reprodução offline dos segmentos completos.';
      } else if (drmProtectedCount > 0 && candidatePool.length === drmProtectedCount) {
        specificReason = 'As fontes disponíveis possuem proteção DRM comercial (Widevine/FairPlay) sem autorização de licença offline para este dispositivo.';
      } else if (torrentEngineRequiredCount > 0 && candidatePool.length === torrentEngineRequiredCount) {
        specificReason = 'As fontes disponíveis dependem do aplicativo de streaming local Stremio Engine (porta 11470), que não está ativo neste momento.';
      } else if (corsRestrictedCount > 0) {
        specificReason = 'As fontes encontradas passam pelo proxy do player; esse endereço não oferece uma transferência offline direta verificada.';
      }

      return {
        options: [],
        reason: specificReason,
        identifiedSourcesCount: candidatePool.length,
        compatibleSourcesCount: 0,
        drmProtectedCount,
        torrentEngineRequiredCount,
        corsRestrictedCount
      };
    }

    // 5. Agrupa as fontes elegíveis por qualidade real (sem duplicar nem inventar)
    const streamsByQuality = new Map<string, typeof eligibleStreams>();
    for (const eligible of eligibleStreams) {
      for (const q of eligible.qualities) {
        if (!streamsByQuality.has(q)) {
          streamsByQuality.set(q, []);
        }
        streamsByQuality.get(q)!.push(eligible);
      }
    }

    // 6. Testa as candidatas de cada qualidade em ordem; uma CDN inativa não
    // deve esconder outra fonte autorizada para o mesmo episódio.
    const orderedKeys = ['4K', '1440p', '1080p', '720p', '480p', '360p', 'Original'].filter(k => streamsByQuality.has(k));

    const optionResults = await Promise.all(orderedKeys.map(async quality => {
      const candidates = streamsByQuality.get(quality) || [];
      if (candidates.length === 0) return null;

      // Priorização de candidatos:
      // a) Prioriza Dublado PT-BR se preferredLanguage for pt-BR
      candidates.sort((a, b) => {
        if (preferredLanguage === 'pt-BR') {
          if (a.isDubbed && !b.isDubbed) return -1;
          if (!a.isDubbed && b.isDubbed) return 1;
        }

        return 0;
      });

      for (const candidate of candidates.slice(0, 4)) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        try {
          const response = await fetch(candidate.resolvedUrl, {
            headers: { Range: 'bytes=0-0' }, signal: controller.signal
          });
          if (!response.ok || /text\/html|application\/json/i.test(response.headers.get('content-type') || '')) {
            await response.body?.cancel();
            continue;
          }
          let estimatedBytes = 0;
          const range = response.headers.get('content-range');
          const total = range?.match(/\/(\d+)$/)?.[1];
          if (total) estimatedBytes = Number(total);
          else if (response.status === 200) {
            const length = Number(response.headers.get('content-length'));
            if (Number.isFinite(length) && length > 0) estimatedBytes = length;
          }
          await response.body?.cancel();
          return {
            quality, estimatedBytes, sourceUrl: candidate.resolvedUrl,
            sourceType: candidate.sourceType, isDubbed: candidate.isDubbed,
            audioLanguage: candidate.stream.isPtBr ? 'pt-BR' : 'original',
            isAuthorized: true
          } satisfies DownloadQualityOption;
        } catch {
          // Tenta a próxima candidata da mesma obra e qualidade.
        } finally {
          clearTimeout(timeout);
        }
      }
      return null;
    }));
    const accessibleOptions = optionResults.filter(option => option !== null) as DownloadQualityOption[];

    return {
      options: accessibleOptions,
      reason: accessibleOptions.length === 0
        ? 'Nenhuma fonte com permissão de download e acesso direto respondeu com vídeo MP4/WebM compatível. Tente novamente mais tarde se o provedor estiver temporariamente indisponível.'
        : undefined,
      identifiedSourcesCount: candidatePool.length,
      compatibleSourcesCount: accessibleOptions.length,
      drmProtectedCount,
      torrentEngineRequiredCount,
      corsRestrictedCount
    };
  }

  /**
   * Mantém retrocompatibilidade retornando apenas a lista de opções autorizadas.
   */
  public async inspectDownloadOptions(
    streams: StremioStream[],
    preferredLanguage: 'pt-BR' | 'original' = 'pt-BR'
  ): Promise<DownloadQualityOption[]> {
    const diag = await this.inspectDownloadOptionsDetailed(streams, preferredLanguage);
    return diag.options;
  }

  /**
   * Valida a integridade do arquivo após a transferência.
   * Inspeciona se há uma faixa de áudio presente no container MP4 ou WebM.
   */
  public async verifyMediaIntegrity(blob: Blob): Promise<{ isValid: boolean; hasAudio: boolean; error?: string }> {
    if (!blob || blob.size < 1024) {
      return { isValid: false, hasAudio: false, error: 'Arquivo vazio ou truncado.' };
    }

    try {
      const headerSlice = blob.slice(0, Math.min(blob.size, 131072));
      const buffer = await headerSlice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let hasVideo = false;
      let hasAudio = false;

      const ascii = new TextDecoder('latin1').decode(bytes).toLowerCase();
      if (ascii.includes('soun') || ascii.includes('mp4a') || ascii.includes('ac-3') || ascii.includes('opus') || ascii.includes('vorbis')) {
        hasAudio = true;
      }
      if (ascii.includes('vide') || ascii.includes('avc1') || ascii.includes('hev1') || ascii.includes('vp09') || ascii.includes('av01') || ascii.includes('v_vp8') || ascii.includes('v_vp9')) {
        hasVideo = true;
      }

      if (!hasAudio && blob.size > 262144) {
        const trailerSlice = blob.slice(blob.size - 131072);
        const trailerBuffer = await trailerSlice.arrayBuffer();
        const trailerAscii = new TextDecoder('latin1').decode(new Uint8Array(trailerBuffer)).toLowerCase();
        if (trailerAscii.includes('soun') || trailerAscii.includes('mp4a') || trailerAscii.includes('opus')) {
          hasAudio = true;
        }
        if (trailerAscii.includes('vide') || trailerAscii.includes('avc1') || trailerAscii.includes('hev1') || trailerAscii.includes('vp09') || trailerAscii.includes('v_vp8') || trailerAscii.includes('v_vp9')) {
          hasVideo = true;
        }
      }

      if (!hasAudio) {
        return {
          isValid: false,
          hasAudio: false,
          error: 'O arquivo baixado não contém uma faixa de áudio válida ou compatível.'
        };
      }

      return { isValid: hasVideo, hasAudio: true, error: hasVideo ? undefined : 'Arquivo sem faixa de vídeo reconhecida.' };
    } catch {
      return { isValid: false, hasAudio: false, error: 'Não foi possível validar o arquivo baixado.' };
    }
  }
}

export const offlineSourceInspector = new OfflineSourceInspector();
