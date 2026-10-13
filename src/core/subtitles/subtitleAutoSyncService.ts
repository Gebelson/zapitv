import { StremioStream } from '../stremio/stremioTypes';
import { SubtitleTrack } from './subtitleService';
import { SkipInterval } from '../skip/skipService';

export interface AutoSyncResult {
  offset: number; // Offset em segundos a ser somado ao tempo (currentTime + offset >= cue.start)
  confidence: number; // 0.0 a 1.0
  method: 'cached_profile' | 'native_embedded_anchor' | 'release_bumper_calibration' | 'skip_interval_anchor' | 'first_dialogue_anchor' | 'default';
  explanation: string;
}

export interface CueItem {
  start: number;
  end: number;
  text: string;
}

/**
 * Serviço de Sincronização Inteligente e Automática de Legendas do ZapiTV.
 * Detecta e calibra automaticamente atrasos de sincronia entre fontes de vídeo e legendas externas,
 * garantindo que os usuários NÃO precisem ajustar o atraso manualmente.
 */
export class SubtitleAutoSyncService {
  private static STORAGE_PREFIX = 'zapitv_sub_autosync_';

  /**
   * Gera uma chave única estável para armazenar calibrações de sincronia
   */
  public getSyncKey(contentId: string, stream?: StremioStream, trackId?: string): string {
    const streamIdentifier = stream?.title || stream?.url || stream?.name || 'default_stream';
    const cleanStream = streamIdentifier.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    const cleanSub = (trackId || 'default_sub').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
    return `${SubtitleAutoSyncService.STORAGE_PREFIX}${contentId}_${cleanStream}_${cleanSub}`;
  }

  /**
   * Recupera offset de sincronia pré-calibrado ou salvo anteriormente
   */
  public getSavedOffset(contentId: string, stream?: StremioStream, trackId?: string): number | null {
    try {
      const key = this.getSyncKey(contentId, stream, trackId);
      const val = localStorage.getItem(key);
      if (val !== null) {
        const num = parseFloat(val);
        if (!isNaN(num)) return num;
      }
    } catch {
      // Ignora falhas de acesso a storage
    }
    return null;
  }

  /**
   * Salva offset de sincronia para reutilização transparente em reproduções futuras
   */
  public saveOffset(contentId: string, offset: number, stream?: StremioStream, trackId?: string): void {
    try {
      const key = this.getSyncKey(contentId, stream, trackId);
      localStorage.setItem(key, offset.toString());
    } catch {}
  }

  /**
   * Limpa offset de sincronia salvo
   */
  public clearSavedOffset(contentId: string, stream?: StremioStream, trackId?: string): void {
    try {
      const key = this.getSyncKey(contentId, stream, trackId);
      localStorage.removeItem(key);
    } catch {}
  }

  /**
   * Analisa os metadados do stream para extrair release, distribuidora e formato
   */
  public extractStreamRelease(stream?: StremioStream): {
    isWebDl: boolean;
    isBluRay: boolean;
    isHdtv: boolean;
    source: 'web' | 'bluray' | 'hdtv' | 'unknown';
    bumperEstimateSec: number;
    releaseGroup?: string;
  } {
    if (!stream) {
      return { isWebDl: false, isBluRay: false, isHdtv: false, source: 'unknown', bumperEstimateSec: 0 };
    }

    const text = `${stream.title || ''} ${stream.name || ''} ${stream.description || ''} ${stream.behaviorHints?.bingeGroup || ''}`.toLowerCase();

    const isWebDl = /\b(web[-_]?dl|webrip|web|amzn|netflix|disney|apple|hbo|max)\b/i.test(text);
    const isBluRay = /\b(bluray|bdrip|brrip|bd|remux)\b/i.test(text);
    const isHdtv = /\b(hdtv|pdtv|dsr)\b/i.test(text);

    let source: 'web' | 'bluray' | 'hdtv' | 'unknown' = 'unknown';
    let bumperEstimateSec = 0;

    if (isBluRay) {
      source = 'bluray';
      bumperEstimateSec = 10.5; // Vinhetas clássicas de estúdio em Blu-Ray (Universal/Warner/Disney)
    } else if (isWebDl) {
      source = 'web';
      bumperEstimateSec = 0.5; // Streaming inicia direto na vinheta curta da plataforma
    } else if (isHdtv) {
      source = 'hdtv';
      bumperEstimateSec = 0;
    }

    const matchGroup = text.match(/\b(yts|yify|flux|rarbg|psa|qxr|cmrg|galaxytv|sparks|ntb|dimension)\b/i);
    const releaseGroup = matchGroup ? matchGroup[1].toUpperCase() : undefined;

    return { isWebDl, isBluRay, isHdtv, source, bumperEstimateSec, releaseGroup };
  }

  /**
   * Analisa a faixa de legendas para identificar a release correspondente
   */
  public extractSubtitleRelease(track?: SubtitleTrack): {
    isWebDl: boolean;
    isBluRay: boolean;
    isHdtv: boolean;
    source: 'web' | 'bluray' | 'hdtv' | 'unknown';
  } {
    if (!track) {
      return { isWebDl: false, isBluRay: false, isHdtv: false, source: 'unknown' };
    }

    const text = `${track.release || ''} ${track.label || ''} ${track.id || ''} ${track.url || ''}`.toLowerCase();

    const isWebDl = /\b(web[-_]?dl|webrip|web|amzn|netflix|disney|apple|hbo)\b/i.test(text);
    const isBluRay = /\b(bluray|bdrip|brrip|bd|remux)\b/i.test(text);
    const isHdtv = /\b(hdtv|pdtv)\b/i.test(text);

    let source: 'web' | 'bluray' | 'hdtv' | 'unknown' = 'unknown';
    if (isBluRay) source = 'bluray';
    else if (isWebDl) source = 'web';
    else if (isHdtv) source = 'hdtv';

    return { isWebDl, isBluRay, isHdtv, source };
  }

  /**
   * Heurística de Alinhamento com TextTracks Nativas Embutidas no Vídeo:
   * Se o container de vídeo (HLS / MP4 / MKV) possuir faixas de texto nativas embutidas,
   * os timestamps dessas faixas estão 100% sincronizados com o áudio do container.
   * Comparamos a mediana das primeiras falas para deduzir o delta exato!
   */
  public alignWithNativeEmbeddedTracks(
    video: HTMLVideoElement | null,
    cues: CueItem[]
  ): { delta: number; confidence: number } | null {
    if (!video || !video.textTracks || video.textTracks.length === 0 || cues.length === 0) {
      return null;
    }

    try {
      // Procura qualquer faixa nativa que contenha cues (inglês, espanhol, etc.)
      for (let i = 0; i < video.textTracks.length; i++) {
        const nativeTrack = video.textTracks[i];
        if (nativeTrack.label === 'ZapiTV PiP Subtitles') continue; // Ignora nossa própria track de PiP

        const nativeCues = nativeTrack.cues;
        if (nativeCues && nativeCues.length >= 3) {
          const sampleCount = Math.min(6, nativeCues.length, cues.length);
          const deltas: number[] = [];

          // Filtra primeiras falas reais (desconsiderando créditos curtos nos primeiros 3s)
          const validExternal = cues.filter(c => c.start >= 5 && c.end - c.start >= 1.0).slice(0, sampleCount);
          const validNative: Array<{ startTime: number }> = [];

          for (let j = 0; j < nativeCues.length; j++) {
            const c = nativeCues[j];
            if (c.startTime >= 5 && c.endTime - c.startTime >= 1.0) {
              validNative.push(c);
              if (validNative.length >= sampleCount) break;
            }
          }

          if (validExternal.length >= 3 && validNative.length >= 3) {
            const count = Math.min(validExternal.length, validNative.length);
            for (let k = 0; k < count; k++) {
              const diff = validExternal[k].start - validNative[k].startTime;
              deltas.push(diff);
            }

            // Mediana dos deltas
            deltas.sort((a, b) => a - b);
            const medianDelta = deltas[Math.floor(deltas.length / 2)];

            // Se a diferença for estável e significativa (entre 0.4s e 40s)
            if (Math.abs(medianDelta) >= 0.4 && Math.abs(medianDelta) <= 40) {
              // Se a legenda externa começa depois da nativa (ex: ext = 14s, nat = 10s -> diff = +4s),
              // a legenda externa está ATRASADA! Precisamos adiantá-la somando +4s ao currentTime.
              return {
                delta: Number(medianDelta.toFixed(1)),
                confidence: 0.95
              };
            }
          }
        }
      }
    } catch {
      // Ignora restrições de cross-origin ou erro de leitura de tracks nativas
    }

    return null;
  }

  /**
   * Heurística de Alinhamento com Marcações de Abertura / Intro (SkipIntervals):
   * Compara o ponto de término da abertura com o início dos diálogos.
   */
  public alignWithSkipInterval(
    skipInterval: SkipInterval | null | undefined,
    cues: CueItem[]
  ): { delta: number; confidence: number } | null {
    if (!skipInterval || cues.length === 0) return null;

    // Se temos um intervalo de abertura confirmado
    if (skipInterval.type === 'op' && skipInterval.endTime > 30) {
      // Procura a primeira fala pós-abertura na legenda externa
      const postOpCues = cues.filter(c => c.start >= skipInterval.startTime - 5);
      if (postOpCues.length > 0) {
        const firstPostOp = postOpCues[0];
        // Se a fala está situada absurdamente fora da margem da abertura (ex: vinheta deslocou 10s)
        const expectedStart = skipInterval.endTime + 0.5;
        const diff = firstPostOp.start - expectedStart;

        if (diff > 5 && diff < 30) {
          return {
            delta: Number(diff.toFixed(1)),
            confidence: 0.75
          };
        }
      }
    }

    return null;
  }

  /**
   * Heurística de Discrepância de Vinheta de Estúdio entre Releases (WEB-DL vs BluRay):
   * A discrepância clássica é o estúdio de cinema pré-filme que é cortado em streaming.
   */
  public alignWithReleaseBumper(
    stream?: StremioStream,
    track?: SubtitleTrack,
    cues?: CueItem[]
  ): { delta: number; confidence: number } | null {
    const streamRel = this.extractStreamRelease(stream);
    const subRel = this.extractSubtitleRelease(track);

    if (streamRel.source === 'unknown' || subRel.source === 'unknown') {
      return null;
    }

    // Caso 1: O vídeo é WEB-DL (sem vinheta longa), mas a legenda baixada veio de um Blu-Ray (com vinheta de ~10.5s a 12s)
    // Consequência: A legenda em BluRay tem timestamps inflados (ex: fala ocorre aos 14s no BluRay, mas aos 3s no WEB-DL).
    // A legenda aparece ATRASADA em ~10.5s no vídeo do streaming!
    if (streamRel.isWebDl && subRel.isBluRay) {
      let estimatedDelta = 10.5;

      // Se temos as cues, verifica se a primeira fala da legenda ocorre perto de ~12s a 25s
      if (cues && cues.length > 0) {
        const firstCue = cues.find(c => c.start >= 3);
        if (firstCue && firstCue.start >= 10 && firstCue.start <= 25) {
          estimatedDelta = Number((firstCue.start - 3.5).toFixed(1));
        }
      }

      return {
        delta: Math.min(Math.max(estimatedDelta, 8.0), 14.0),
        confidence: 0.85
      };
    }

    // Caso 2: O vídeo é BluRay (com vinheta longa), mas a legenda veio de um WEB-DL (sem vinheta)
    // Consequência: A legenda WEB-DL aparece ADIANTADA no BluRay em ~10.5s.
    if (streamRel.isBluRay && subRel.isWebDl) {
      return {
        delta: -10.5,
        confidence: 0.85
      };
    }

    return null;
  }

  /**
   * Método Central de Calibração:
   * Determina e calcula o offset ideal de sincronização de forma 100% automática,
   * combinando todas as heurísticas por ordem de precisão.
   */
  public calculateAutoOffset(options: {
    contentId: string;
    video: HTMLVideoElement | null;
    cues: CueItem[];
    stream?: StremioStream;
    track?: SubtitleTrack;
    skipInterval?: SkipInterval | null;
  }): AutoSyncResult {
    const { contentId, video, cues, stream, track, skipInterval } = options;

    // 1. Perfil salvo ou pré-calibrado pelo usuário para esta mídia/stream
    const saved = this.getSavedOffset(contentId, stream, track?.id);
    if (saved !== null) {
      return {
        offset: saved,
        confidence: 1.0,
        method: 'cached_profile',
        explanation: `Sincronia memorizada carregada (${saved > 0 ? `+${saved}s` : `${saved}s`})`
      };
    }

    // Se não há cues válidas, mantém offset neutro (0)
    if (!cues || cues.length === 0) {
      return {
        offset: 0,
        confidence: 0.5,
        method: 'default',
        explanation: 'Sem legendas para calibrar'
      };
    }

    // 2. Alinhamento prioritário com TextTracks nativas embutidas no vídeo (Precisão Máxima)
    const nativeMatch = this.alignWithNativeEmbeddedTracks(video, cues);
    if (nativeMatch && nativeMatch.confidence >= 0.9) {
      this.saveOffset(contentId, nativeMatch.delta, stream, track?.id);
      return {
        offset: nativeMatch.delta,
        confidence: nativeMatch.confidence,
        method: 'native_embedded_anchor',
        explanation: `Sincronizado automaticamente com o áudio nativo (${nativeMatch.delta > 0 ? `+${nativeMatch.delta}s` : `${nativeMatch.delta}s`})`
      };
    }

    // 3. Alinhamento com vinheta de release (WEB-DL vs Blu-Ray bumper)
    const releaseMatch = this.alignWithReleaseBumper(stream, track, cues);
    if (releaseMatch && releaseMatch.confidence >= 0.8) {
      this.saveOffset(contentId, releaseMatch.delta, stream, track?.id);
      return {
        offset: releaseMatch.delta,
        confidence: releaseMatch.confidence,
        method: 'release_bumper_calibration',
        explanation: `Sincronia automática ajustada para a versão do vídeo (${releaseMatch.delta > 0 ? `+${releaseMatch.delta}s` : `${releaseMatch.delta}s`})`
      };
    }

    // 4. Alinhamento com SkipInterval / Abertura
    const skipMatch = this.alignWithSkipInterval(skipInterval, cues);
    if (skipMatch && skipMatch.confidence >= 0.7) {
      this.saveOffset(contentId, skipMatch.delta, stream, track?.id);
      return {
        offset: skipMatch.delta,
        confidence: skipMatch.confidence,
        method: 'skip_interval_anchor',
        explanation: `Sincronia automática ajustada pela abertura (${skipMatch.delta > 0 ? `+${skipMatch.delta}s` : `${skipMatch.delta}s`})`
      };
    }

    // 5. Se as releases forem compatíveis (ex: ambas WEB-DL ou ambas BluRay),
    // o atraso padrão esperado é 0s (sincronia nativa perfeita)
    return {
      offset: 0,
      confidence: 0.85,
      method: 'default',
      explanation: 'Sincronia padrão alinhada (0.0s)'
    };
  }
}

export const subtitleAutoSyncService = new SubtitleAutoSyncService();
