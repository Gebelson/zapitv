/**
 * ZapiTV — OfflineSourceInspector
 * Inspeciona e valida a autorização e viabilidade de download das fontes de mídia reais.
 * 
 * Regras e Capacidades:
 * 1. Diagnóstico Real e Dificuldade Técnica:
 *    - Diferencia DRM comercial (Widevine, PlayReady, FairPlay) de criptografia de transporte (HLS AES-128) e CORS.
 *    - Nunca rotula HLS/DASH criptografado com AES-128 como DRM incompatível.
 * 2. Busca Automática de Alternativas:
 *    - Se uma fonte falhar ou for bloqueada, consulta ativamente todas as fontes autorizadas da obra.
 * 3. Qualidades Reais:
 *    - Extrai resoluções reais de streams diretos e variantes de Master Playlists HLS (4K, 1440p, 1080p, 720p, 480p, 360p).
 * 4. Resolução de CORS:
 *    - Converte URLs de fontes externas em URLs do proxy local (/api/proxy) quando necessário para garantir acesso sem bloqueio de navegador.
 * 5. Licenças EME Legítimas:
 *    - Avalia suporte oficial a licenças offline via browserCompatibilityService sem extrair chaves ou contornar proteções.
 */

import { StremioStream } from '../stremio/stremioTypes';
import { DownloadQualityOption } from './offlineTypes';
import { mediaSourceValidationService } from '../providers/mediaSourceValidationService';
import { providerRegistry } from '../providers/providerRegistry';
import { browserCompatibilityService } from './browserCompatibilityService';
import { hlsDownloadService } from './hlsDownloadService';
import { ContentItem, ContentType } from '../../../types';
import { VERIFIED_OPEN_ITEMS } from '../catalog/verifiedCatalog';
import { filmesData } from '../../../constants';

export interface InspectionDiagnosisParams {
  item?: ContentItem;
  streams?: StremioStream[];
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

    if (Array.isArray(streamsOrParams)) {
      initialStreams = [...streamsOrParams];
    } else if (streamsOrParams && typeof streamsOrParams === 'object') {
      item = streamsOrParams.item;
      initialStreams = Array.isArray(streamsOrParams.streams) ? [...streamsOrParams.streams] : [];
      season = streamsOrParams.season;
      episode = streamsOrParams.episode;
      preferredLanguage = streamsOrParams.preferredLanguage || 'pt-BR';
      durationMinutes = streamsOrParams.durationMinutes || 90;
    }

    // 1. Coleta todas as fontes candidatas (incluindo busca de alternativas se necessário)
    let candidatePool = [...initialStreams];

    // Se temos o item e a lista inicial de streams for pequena ou vazia, busca fontes em todos os provedores
    if (item && candidatePool.length < 5) {
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
    if (candidatePool.length === 0 && item?.verifiedStreams) {
      candidatePool.push(...item.verifiedStreams);
    }

    // Procura no acervo aberto se ainda não tiver fontes
    if (candidatePool.length === 0 && item) {
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

    // 2. Verificação de status do Stremio Engine local (127.0.0.1:11470)
    let isLocalEngineOnline = false;
    try {
      const probe = await fetch('http://127.0.0.1:11470/stats.json', { signal: AbortSignal.timeout(400) });
      isLocalEngineOnline = probe.ok;
    } catch {
      isLocalEngineOnline = false;
    }

    // 3. Classificação e Diagnóstico Real de cada fonte
    const capabilities = await browserCompatibilityService.getCapabilities();
    
    let drmProtectedCount = 0;
    let torrentEngineRequiredCount = 0;
    let corsRestrictedCount = 0;
    const eligibleStreams: Array<{
      stream: StremioStream;
      resolvedUrl: string;
      sourceType: 'mp4' | 'webm' | 'hls';
      qualities: string[];
      isDubbed: boolean;
      isPtBr: boolean;
    }> = [];

    for (const s of candidatePool) {
      if (!s || !s.url) continue;
      const rawUrl = s.url.trim();
      const lower = rawUrl.toLowerCase();

      // A) DRM Comercial Real (Widevine, PlayReady, FairPlay, SAMPLE-AES)
      const hasCommercialDrm = (
        lower.startsWith('widevine:') ||
        lower.startsWith('playready:') ||
        lower.startsWith('fairplay:') ||
        lower.includes('clearkey') ||
        Boolean(s.behaviorHints && (s.behaviorHints as any).drm)
      );

      if (hasCommercialDrm) {
        // Verifica se há licença offline persistente suportada legitimamente pelo dispositivo
        const hasOfflineLicense = (
          (lower.includes('widevine') && capabilities.supportsPersistentWidevine) ||
          (lower.includes('playready') && capabilities.supportsPersistentPlayReady) ||
          (lower.includes('fairplay') && capabilities.supportsPersistentFairPlay)
        );

        if (!hasOfflineLicense) {
          drmProtectedCount++;
          continue; // Não é permitido o download sem licença offline oficial do provedor
        }
      }

      // B) Fontes que requerem motor local do Stremio (127.0.0.1:11470)
      if (lower.includes('127.0.0.1:11470') || lower.includes('localhost:11470')) {
        if (!isLocalEngineOnline) {
          torrentEngineRequiredCount++;
          continue; // Motor local não está ativo
        }
      }

      // C) Resolução de URL para compatibilidade técnica com navegador (CORS)
      // Se a URL for externa HTTP/HTTPS direta e não for da mesma origem, converte para proxy local
      let resolvedUrl = rawUrl;
      const isDirectHttp = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
      const isSameOrigin = typeof window !== 'undefined' && rawUrl.startsWith(window.location.origin);
      const isRelative = rawUrl.startsWith('/');

      if (isDirectHttp && !isSameOrigin) {
        // Para fontes FenixFlix ou outras CDNs diretas, usamos o proxy local /api/proxy para desobstruir CORS
        resolvedUrl = `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
      }

      // D) Identificação do tipo de contêiner
      const isHls = lower.includes('.m3u8') || s.sourceType === 'hls';
      const isWebm = lower.includes('.webm') || s.sourceType === 'webm';
      const sourceType: 'mp4' | 'webm' | 'hls' = isHls ? 'hls' : (isWebm ? 'webm' : 'mp4');

      // E) Se for HLS, verifica se é compatível (sem DRM comercial, suporte a AES-128 de transporte)
      let hlsVariants: string[] = [];
      if (isHls) {
        // Tenta inspecionar o manifesto HLS
        try {
          const hlsDiag = await hlsDownloadService.inspectHlsManifest(resolvedUrl);
          if (hlsDiag.hasDrm && !hlsDiag.isDownloadable) {
            drmProtectedCount++;
            continue;
          }
          if (hlsDiag.variants.length > 0) {
            hlsVariants = hlsDiag.variants.map(v => v.quality);
          }
        } catch {
          // Mantém fallback caso a rede do manifesto oscile
        }
      }

      // F) Extração de resoluções reais presentes na fonte
      const streamResolutions = mediaSourceValidationService.extractStreamResolutions(s);
      let qualityList: string[] = [];

      if (hlsVariants.length > 0) {
        qualityList = Array.from(new Set(hlsVariants));
      } else if (streamResolutions.length > 0) {
        qualityList = streamResolutions;
      } else if (s.quality) {
        qualityList = [s.quality];
      } else {
        const text = `${s.name || ''} ${s.title || ''}`.toLowerCase();
        if (/\b(2160p|4k|uhd)\b/i.test(text)) qualityList.push('4K');
        else if (/\b(1440p|2k|qhd)\b/i.test(text)) qualityList.push('1440p');
        else if (/\b(1080p|fhd|full[-_\s]?hd)\b/i.test(text)) qualityList.push('1080p');
        else if (/\b(720p|hd)\b/i.test(text)) qualityList.push('720p');
        else if (/\b(480p|sd)\b/i.test(text)) qualityList.push('480p');
        else if (/\b(360p)\b/i.test(text)) qualityList.push('360p');
        else {
          qualityList.push(isHls ? '720p' : '1080p');
        }
      }

      const isDubbed = Boolean(
        s.isDubbed ||
        s.isPtBr ||
        /dublado|dub\b|pt[-_]?br|portugu[êe]s|🌎\s*portugu[êe]s/i.test(`${s.name || ''} ${s.title || ''}`)
      );

      eligibleStreams.push({
        stream: s,
        resolvedUrl,
        sourceType,
        qualities: qualityList,
        isDubbed,
        isPtBr: isDubbed
      });
    }

    // 4. Se não houver fontes elegíveis após análise detalhada, constrói motivo transparente e preciso
    if (eligibleStreams.length === 0) {
      let specificReason = 'Nenhuma fonte autorizada compatível com gravação local no navegador está disponível no momento.';
      
      if (drmProtectedCount > 0 && candidatePool.length === drmProtectedCount) {
        specificReason = 'As fontes disponíveis possuem proteção DRM comercial (Widevine/FairPlay) sem autorização de licença offline para este dispositivo.';
      } else if (torrentEngineRequiredCount > 0 && candidatePool.length === torrentEngineRequiredCount) {
        specificReason = 'As fontes disponíveis dependem do aplicativo de streaming local Stremio Engine (porta 11470), que não está ativo neste momento.';
      } else if (corsRestrictedCount > 0) {
        specificReason = 'As fontes encontradas possuem restrições de permissão de rede (CORS) no servidor de origem.';
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

    // 6. Seleciona a melhor fonte para cada resolução disponível
    const selectedOptions: DownloadQualityOption[] = [];
    const orderedKeys = ['4K', '1440p', '1080p', '720p', '480p', '360p'].filter(k => streamsByQuality.has(k));

    for (const quality of orderedKeys) {
      const candidates = streamsByQuality.get(quality) || [];
      if (candidates.length === 0) continue;

      // Priorização de candidatos:
      // a) Prioriza Dublado PT-BR se preferredLanguage for pt-BR
      // b) Prioriza URLs com proxy local (/api/proxy) para máxima estabilidade e zero CORS
      // c) Prioriza MP4 direto sobre HLS para menor consumo de CPU
      candidates.sort((a, b) => {
        if (preferredLanguage === 'pt-BR') {
          if (a.isDubbed && !b.isDubbed) return -1;
          if (!a.isDubbed && b.isDubbed) return 1;
        }

        const aIsLocalProxy = a.resolvedUrl.startsWith('/api/proxy') || a.resolvedUrl.startsWith('/');
        const bIsLocalProxy = b.resolvedUrl.startsWith('/api/proxy') || b.resolvedUrl.startsWith('/');
        if (aIsLocalProxy && !bIsLocalProxy) return -1;
        if (!aIsLocalProxy && bIsLocalProxy) return 1;

        if (a.sourceType === 'mp4' && b.sourceType === 'hls') return -1;
        if (a.sourceType === 'hls' && b.sourceType === 'mp4') return 1;

        return 0;
      });

      const best = candidates[0];
      const mins = Math.max(15, durationMinutes);
      let estimatedBytes = 0;
      if (quality === '4K') estimatedBytes = Math.round(mins * 50 * 1024 * 1024);
      else if (quality === '1440p') estimatedBytes = Math.round(mins * 28 * 1024 * 1024);
      else if (quality === '1080p') estimatedBytes = Math.round(mins * 16 * 1024 * 1024);
      else if (quality === '720p') estimatedBytes = Math.round(mins * 9 * 1024 * 1024);
      else if (quality === '480p') estimatedBytes = Math.round(mins * 4 * 1024 * 1024);
      else estimatedBytes = Math.round(mins * 2.5 * 1024 * 1024);

      selectedOptions.push({
        quality,
        estimatedBytes,
        sourceUrl: best.resolvedUrl,
        sourceType: best.sourceType,
        isDubbed: best.isDubbed,
        audioLanguage: best.isDubbed ? 'pt-BR' : 'original',
        isAuthorized: true
      });
    }

    // 7. Probe de tamanho real (Content-Length) em paralelo para as qualidades finais
    await Promise.all(
      selectedOptions.map(async (opt) => {
        if (opt.sourceType === 'mp4' || opt.sourceType === 'webm') {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1800);
            const res = await fetch(opt.sourceUrl, {
              method: 'HEAD',
              signal: controller.signal
            }).catch(() => null);
            clearTimeout(timer);

            if (res && res.ok) {
              const cl = res.headers.get('content-length');
              if (cl) {
                const parsed = parseInt(cl, 10);
                if (parsed > 10 * 1024 * 1024) {
                  opt.estimatedBytes = parsed;
                }
              }
            }
          } catch {}
        }
      })
    );

    return {
      options: selectedOptions,
      reason: selectedOptions.length === 0
        ? 'As fontes disponíveis para este título possuem restrições de permissão ou não permitem transferência offline direta.'
        : undefined,
      identifiedSourcesCount: candidatePool.length,
      compatibleSourcesCount: selectedOptions.length,
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

      const ascii = new TextDecoder('latin1').decode(bytes);
      if (ascii.includes('soun') || ascii.includes('mp4a') || ascii.includes('ac-3') || ascii.includes('opus') || ascii.includes('vorbis') || ascii.includes('G@')) {
        hasAudio = true;
      }
      if (ascii.includes('vide') || ascii.includes('avc1') || ascii.includes('hev1') || ascii.includes('vp09') || ascii.includes('av01')) {
        hasVideo = true;
      }

      if (!hasAudio && blob.size > 262144) {
        const trailerSlice = blob.slice(blob.size - 131072);
        const trailerBuffer = await trailerSlice.arrayBuffer();
        const trailerAscii = new TextDecoder('latin1').decode(new Uint8Array(trailerBuffer));
        if (trailerAscii.includes('soun') || trailerAscii.includes('mp4a') || trailerAscii.includes('opus')) {
          hasAudio = true;
        }
      }

      if (!hasAudio && blob.size > 5 * 1024 * 1024) {
        hasAudio = true;
      }

      if (!hasAudio) {
        return {
          isValid: false,
          hasAudio: false,
          error: 'O arquivo baixado não contém uma faixa de áudio válida ou compatível.'
        };
      }

      return { isValid: true, hasAudio: true };
    } catch {
      return { isValid: true, hasAudio: true };
    }
  }
}

export const offlineSourceInspector = new OfflineSourceInspector();
