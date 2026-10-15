/**
 * ZapiTV — AudioCodecService
 * Sistema centralizado de detecção de compatibilidade de codecs de áudio por dispositivo/navegador.
 * Garante que fontes com codecs incompatíveis (ex: AC3/E-AC3 no Chrome/Firefox) não causem vídeos sem som.
 */

import { StremioStream } from '../stremio/stremioTypes';

export interface DeviceAudioCapabilities {
  aac: boolean;
  opus: boolean;
  mp3: boolean;
  ac3: boolean;
  eac3: boolean;
  dts: boolean;
  flac: boolean;
  browserName: 'chrome' | 'safari' | 'firefox' | 'edge' | 'smart-tv' | 'mobile' | 'other';
}

export interface StreamCodecInfo {
  codecs: string[];
  primaryCodec: string;
  isCompatible: boolean;
  isUniversal: boolean;
  confidence: number;
  reason: string;
}

class AudioCodecService {
  private cachedCapabilities: DeviceAudioCapabilities | null = null;

  /**
   * Detecta com precisão a capacidade do navegador e dispositivo atual de decodificar codecs de áudio.
   */
  public getCapabilities(): DeviceAudioCapabilities {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // Ambiente de servidor / SSR / Descoberta Automática de Catálogo:
      // Preserva compatibilidade com todos os codecs padrão da indústria (Dolby E-AC3, AC3, DTS, AAC, FLAC)
      this.cachedCapabilities = {
        aac: true,
        opus: true,
        mp3: true,
        ac3: true,
        eac3: true,
        dts: true,
        flac: true,
        browserName: 'other'
      };
      return this.cachedCapabilities;
    }

    const ua = (navigator.userAgent || '').toLowerCase();
    let browserName: DeviceAudioCapabilities['browserName'] = 'other';
    if (/smart-tv|tizen|webos|viera|bravia/i.test(ua)) browserName = 'smart-tv';
    else if (/edg\//i.test(ua)) browserName = 'edge';
    else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) browserName = 'chrome';
    else if (/firefox|fxios/i.test(ua)) browserName = 'firefox';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browserName = 'safari';
    else if (/mobile|android|iphone|ipad/i.test(ua)) browserName = 'mobile';

    let canPlay = (mimeType: string): boolean => {
      try {
        const v = document.createElement('video');
        const res = v.canPlayType(mimeType);
        return res === 'probably' || res === 'maybe';
      } catch {
        return false;
      }
    };

    // Testes específicos de container e codec
    const aac = canPlay('audio/mp4; codecs="mp4a.40.2"') || canPlay('video/mp4; codecs="mp4a.40.2"') || true;
    const opus = canPlay('audio/webm; codecs="opus"') || canPlay('audio/mp4; codecs="opus"');
    const mp3 = canPlay('audio/mpeg') || canPlay('audio/mp4; codecs="mp3"');
    
    // AC3 (Dolby Digital)
    const ac3 = canPlay('audio/mp4; codecs="ac-3"') || 
                canPlay('audio/mp4; codecs="mp4a.a5"') || 
                canPlay('video/mp4; codecs="ac-3"');

    // E-AC3 (Dolby Digital Plus / Atmos)
    const eac3 = canPlay('audio/mp4; codecs="ec-3"') || 
                 canPlay('audio/mp4; codecs="mp4a.a6"') || 
                 canPlay('video/mp4; codecs="ec-3"');

    // DTS
    const dts = canPlay('audio/mp4; codecs="dts"') || canPlay('audio/mp4; codecs="dts-"');

    // FLAC
    const flac = canPlay('audio/flac') || canPlay('audio/mp4; codecs="flac"');

    this.cachedCapabilities = {
      aac,
      opus,
      mp3,
      ac3,
      eac3,
      dts,
      flac,
      browserName
    };

    return this.cachedCapabilities;
  }

  /**
   * Inspeciona títulos, nomes e tags de um stream para identificar os codecs de áudio presentes.
   */
  public inspectStreamCodecs(stream: StremioStream): StreamCodecInfo {
    const text = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''} ${stream.url || ''}`.toLowerCase();
    const caps = this.getCapabilities();
    const foundCodecs: string[] = [];

    // Detecção estrita de codecs
    if (/\b(e-?ac-?3|ddp|dd\+|dolby\s*digital\s*plus|atmos)\b/i.test(text)) {
      foundCodecs.push('eac3');
    }
    if (/\b(ac-?3|dd\s*5\.1|dolby\s*digital)\b/i.test(text)) {
      foundCodecs.push('ac3');
    }
    if (/\b(dts(-?hd)?|truehd)\b/i.test(text)) {
      foundCodecs.push('dts');
    }
    if (/\b(opus|vorbis)\b/i.test(text)) {
      foundCodecs.push('opus');
    }
    if (/\b(aac|aac[-_]?2\.0|aac[-_]?5\.1|mp4a)\b/i.test(text)) {
      foundCodecs.push('aac');
    }
    if (/\b(flac)\b/i.test(text)) {
      foundCodecs.push('flac');
    }
    if (/\b(mp3)\b/i.test(text)) {
      foundCodecs.push('mp3');
    }

    // Se nenhum codec específico for declarado, transmissões web HLS (.m3u8) e MP4 usam AAC como padrão
    const isHls = stream.url?.includes('.m3u8') || stream.sourceType === 'hls';
    const isDirectMp4 = stream.url?.includes('.mp4') || stream.sourceType === 'mp4';
    if (foundCodecs.length === 0) {
      if (isHls || isDirectMp4) {
        foundCodecs.push('aac');
      } else {
        foundCodecs.push('unknown');
      }
    }

    const primaryCodec = foundCodecs[0] || 'aac';
    const isUniversal = primaryCodec === 'aac' || primaryCodec === 'mp3' || primaryCodec === 'opus';

    // Determina se é compatível com o dispositivo atual
    let isCompatible = true;
    let reason = 'Codec universalmente suportado';

    if (primaryCodec === 'eac3') {
      isCompatible = caps.eac3;
      reason = caps.eac3 
        ? 'Dolby Digital Plus (E-AC3) suportado nativamente pelo dispositivo' 
        : 'Incompatível: Dispositivo/navegador não suporta Dolby Digital Plus (E-AC3)';
    } else if (primaryCodec === 'ac3') {
      isCompatible = caps.ac3;
      reason = caps.ac3 
        ? 'Dolby Digital (AC3) suportado nativamente pelo dispositivo' 
        : 'Incompatível: Dispositivo/navegador não suporta áudio Dolby Digital (AC3)';
    } else if (primaryCodec === 'dts') {
      isCompatible = caps.dts;
      reason = caps.dts 
        ? 'DTS suportado nativamente' 
        : 'Incompatível: Navegador sem decodificador para trilha DTS';
    } else if (primaryCodec === 'opus') {
      isCompatible = caps.opus;
      reason = caps.opus ? 'Opus suportado' : 'Opus incompatível';
    } else if (primaryCodec === 'flac') {
      isCompatible = caps.flac;
      reason = caps.flac ? 'FLAC suportado' : 'FLAC incompatível';
    }

    return {
      codecs: foundCodecs,
      primaryCodec,
      isCompatible,
      isUniversal,
      confidence: primaryCodec === 'unknown' ? 0.6 : 0.95,
      reason
    };
  }

  /**
   * Retorna um modificador de pontuação para o ranqueamento de fontes:
   * - Bônus para fontes com áudio comprovadamente compatível com este cliente.
   * - Penalidade severa para codecs que causam vídeo mudo neste navegador específico.
   */
  public getAudioCodecScore(stream: StremioStream): { bonus: number; explanation: string } {
    const info = this.inspectStreamCodecs(stream);

    if (!info.isCompatible) {
      return {
        bonus: -70000,
        explanation: `⚠️ CODEC INCOMPATÍVEL: ${info.reason}`
      };
    }

    if (info.isUniversal) {
      return {
        bonus: 4000,
        explanation: `🔊 Áudio Universal (${info.primaryCodec.toUpperCase()})`
      };
    }

    return {
      bonus: 2000,
      explanation: `🔊 Áudio Compatível (${info.primaryCodec.toUpperCase()})`
    };
  }

  /**
   * Verifica se um codec específico é suportado pelo dispositivo atual.
   */
  public isCodecSupported(codec: string): boolean {
    const caps = this.getCapabilities();
    const c = (codec || '').toLowerCase();
    if (c === 'aac' || c === 'mp4a') return caps.aac;
    if (c === 'opus') return caps.opus;
    if (c === 'mp3') return caps.mp3;
    if (c === 'ac3' || c === 'ac-3') return caps.ac3;
    if (c === 'eac3' || c === 'ec-3' || c === 'atmos') return caps.eac3;
    if (c === 'dts') return caps.dts;
    if (c === 'flac') return caps.flac;
    return true; // Se for desconhecido, presume padrão
  }

  /**
   * Determina se existe pelo menos uma fonte com codec de áudio compatível na lista.
   */
  public hasCompatibleAudio(streams: StremioStream[]): boolean {
    if (!streams || streams.length === 0) return false;
    return streams.some(s => this.inspectStreamCodecs(s).isCompatible);
  }

  /**
   * Retorna um identificador da capacidade do dispositivo para incluir na chave de cache de seleção.
   */
  public getDeviceCacheKey(): string {
    const caps = this.getCapabilities();
    return `dev_${caps.browserName}_ac3${caps.ac3 ? 1 : 0}_eac3${caps.eac3 ? 1 : 0}`;
  }
}

export const audioCodecService = new AudioCodecService();
