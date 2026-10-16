/**
 * ZapiTV — HlsDownloadService
 * Gerenciador e downloader de fluxos HLS (HTTP Live Streaming - .m3u8).
 * Suporta:
 * 1. Extração de resoluções reais de Master Playlists (#EXT-X-STREAM-INF).
 * 2. Diferenciação entre DRM comercial (SAMPLE-AES, CENC) vs Criptografia de Transporte (AES-128).
 * 3. Decriptação legítima de transporte AES-128 usando Web Crypto API padrão.
 * 4. Transferência progressiva de segmentos para o driver de armazenamento (OPFS/IndexedDB).
 */

export interface HlsVariant {
  quality: string;
  resolution?: string;
  bandwidth?: number;
  uri: string;
}

export interface HlsInspectionResult {
  isHls: boolean;
  isMaster: boolean;
  variants: HlsVariant[];
  hasDrm: boolean;
  drmType?: 'widevine' | 'fairplay' | 'playready' | 'sample-aes';
  isTransportEncrypted: boolean;
  encryptionMethod?: string;
  isDownloadable: boolean;
  reason?: string;
}

export class HlsDownloadService {
  /**
   * Resolve URLs relativas contra uma URL base.
   */
  public resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  /**
   * Garante que uma URL externa passe pelo proxy local para evitar bloqueios de CORS no navegador.
   */
  public getProxiedUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  /**
   * Inspeciona um manifesto .m3u8 para identificar variantes, criptografia e viabilidade de download.
   */
  public async inspectHlsManifest(manifestUrl: string): Promise<HlsInspectionResult> {
    try {
      const proxiedUrl = this.getProxiedUrl(manifestUrl);
      const res = await fetch(proxiedUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        return {
          isHls: false,
          isMaster: false,
          variants: [],
          hasDrm: false,
          isTransportEncrypted: false,
          isDownloadable: false,
          reason: `Servidor HLS respondeu com status ${res.status}.`
        };
      }

      const content = await res.text();
      if (!content.includes('#EXTM3U')) {
        return {
          isHls: false,
          isMaster: false,
          variants: [],
          hasDrm: false,
          isTransportEncrypted: false,
          isDownloadable: false,
          reason: 'O arquivo não é uma playlist HLS válida.'
        };
      }

      // 1. Verifica DRM Comercial vs Criptografia de Transporte
      const keyLines = content.split('\n').filter(l => l.startsWith('#EXT-X-KEY:'));
      let hasDrm = false;
      let drmType: HlsInspectionResult['drmType'];
      let isTransportEncrypted = false;
      let encryptionMethod: string | undefined;

      for (const line of keyLines) {
        if (line.includes('SAMPLE-AES')) {
          hasDrm = true;
          drmType = 'sample-aes';
        } else if (line.includes('com.widevine') || line.includes('widevine')) {
          hasDrm = true;
          drmType = 'widevine';
        } else if (line.includes('com.apple.fps') || line.includes('fairplay')) {
          hasDrm = true;
          drmType = 'fairplay';
        } else if (line.includes('com.microsoft.playready')) {
          hasDrm = true;
          drmType = 'playready';
        } else if (line.includes('METHOD=AES-128')) {
          isTransportEncrypted = true;
          encryptionMethod = 'AES-128';
        }
      }

      // 2. Extrai Variantes da Master Playlist
      const isMaster = content.includes('#EXT-X-STREAM-INF');
      const variants: HlsVariant[] = [];

      if (isMaster) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const nextLine = lines[i + 1]?.trim();
            if (nextLine && !nextLine.startsWith('#')) {
              let quality = '720p';
              const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
              let resolutionStr: string | undefined;
              if (resMatch) {
                const height = parseInt(resMatch[2], 10);
                resolutionStr = `${resMatch[1]}x${resMatch[2]}`;
                if (height >= 2160) quality = '4K';
                else if (height >= 1440) quality = '1440p';
                else if (height >= 1080) quality = '1080p';
                else if (height >= 720) quality = '720p';
                else if (height >= 480) quality = '480p';
                else quality = '360p';
              }

              const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
              const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : undefined;
              const uri = this.resolveUrl(nextLine, manifestUrl);

              variants.push({
                quality,
                resolution: resolutionStr,
                bandwidth,
                uri
              });
            }
          }
        }
      }

      // Se for uma media playlist direta (não master)
      if (!isMaster && variants.length === 0) {
        variants.push({
          quality: '720p',
          uri: manifestUrl
        });
      }

      // Se possui DRM comercial que exige licença proprietária
      if (hasDrm) {
        return {
          isHls: true,
          isMaster,
          variants,
          hasDrm: true,
          drmType,
          isTransportEncrypted,
          encryptionMethod,
          isDownloadable: false,
          reason: `Conteúdo protegido por DRM comercial (${drmType?.toUpperCase()}) sem licença offline autorizada.`
        };
      }

      return {
        isHls: true,
        isMaster,
        variants,
        hasDrm: false,
        isTransportEncrypted,
        encryptionMethod,
        isDownloadable: true
      };
    } catch (e: any) {
      return {
        isHls: false,
        isMaster: false,
        variants: [],
        hasDrm: false,
        isTransportEncrypted: false,
        isDownloadable: false,
        reason: `Falha na verificação da playlist HLS: ${e.message || String(e)}`
      };
    }
  }

  /**
   * Baixa os segmentos de uma playlist HLS e grava diretamente no writer local (OPFS/IndexedDB).
   * Descriptografa com Web Crypto API se o transporte for AES-128 padrão.
   */
  public async downloadHlsStream(params: {
    mediaPlaylistUrl: string;
    writer: { write: (chunk: Uint8Array) => Promise<void>; close: () => Promise<void> };
    signal: AbortSignal;
    onProgress: (downloadedBytes: number, totalBytes: number, speedBytesPerSec: number) => void;
  }): Promise<number> {
    const { mediaPlaylistUrl, writer, signal, onProgress } = params;

    const proxiedPlaylist = this.getProxiedUrl(mediaPlaylistUrl);
    const res = await fetch(proxiedPlaylist, { signal });
    if (!res.ok) throw new Error(`Falha ao obter media playlist HLS: HTTP ${res.status}`);
    const playlistText = await res.text();

    const lines = playlistText.split('\n');
    const segmentUrls: string[] = [];
    let currentKeyUrl: string | null = null;
    let currentIv: Uint8Array | null = null;
    let cryptoKey: CryptoKey | null = null;

    // Detecta chave AES-128
    const keyLine = lines.find(l => l.startsWith('#EXT-X-KEY:'));
    if (keyLine && keyLine.includes('METHOD=AES-128')) {
      const uriMatch = keyLine.match(/URI=["']([^"']+)["']/i);
      if (uriMatch) {
        currentKeyUrl = this.resolveUrl(uriMatch[1], mediaPlaylistUrl);
        const ivMatch = keyLine.match(/IV=0x([0-9a-fA-F]+)/i);
        if (ivMatch) {
          const rawHex = ivMatch[1].padStart(32, '0');
          currentIv = new Uint8Array(16);
          for (let i = 0; i < 16; i++) {
            currentIv[i] = parseInt(rawHex.substr(i * 2, 2), 16);
          }
        }
      }
    }

    // Carrega a chave de decriptação via Web Crypto se presente
    if (currentKeyUrl && typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const keyRes = await fetch(this.getProxiedUrl(currentKeyUrl), { signal });
        if (keyRes.ok) {
          const keyBuffer = await keyRes.arrayBuffer();
          cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
          );
        }
      } catch (err) {
        console.warn('[HlsDownloadService] Não foi possível carregar chave AES-128:', err);
      }
    }

    // Extrai URLs de segmentos
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        segmentUrls.push(this.resolveUrl(line, mediaPlaylistUrl));
      }
    }

    if (segmentUrls.length === 0) {
      throw new Error('Nenhum segmento de mídia encontrado na playlist HLS.');
    }

    let downloadedBytes = 0;
    const totalSegments = segmentUrls.length;
    // Estimativa de ~600 KB por segmento de 6s
    let estimatedTotalBytes = totalSegments * 600 * 1024;
    let lastTime = Date.now();
    let lastBytes = 0;

    for (let seq = 0; seq < totalSegments; seq++) {
      if (signal.aborted) throw new Error('Download cancelado');

      const segUrl = segmentUrls[seq];
      const proxiedSegUrl = this.getProxiedUrl(segUrl);
      const segRes = await fetch(proxiedSegUrl, { signal });
      if (!segRes.ok) {
        throw new Error(`Erro ao transferir segmento ${seq + 1}/${totalSegments}: HTTP ${segRes.status}`);
      }

      let segBytes = new Uint8Array(await segRes.arrayBuffer());

      // Descriptografa com Web Crypto se a chave estiver ativa
      if (cryptoKey && crypto.subtle) {
        try {
          const iv = currentIv || this.createSequenceIv(seq);
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv },
            cryptoKey,
            segBytes
          );
          segBytes = new Uint8Array(decrypted);
        } catch (e) {
          // Se falhar a decriptação, grava o buffer original
        }
      }

      await writer.write(segBytes);
      downloadedBytes += segBytes.length;

      const now = Date.now();
      if (now - lastTime > 400 || seq === totalSegments - 1) {
        const elapsedSec = (now - lastTime) / 1000;
        const speed = elapsedSec > 0 ? Math.round((downloadedBytes - lastBytes) / elapsedSec) : 0;
        lastBytes = downloadedBytes;
        lastTime = now;
        onProgress(downloadedBytes, Math.max(downloadedBytes, estimatedTotalBytes), speed);
      }
    }

    return downloadedBytes;
  }

  private createSequenceIv(seq: number): Uint8Array {
    const iv = new Uint8Array(16);
    const view = new DataView(iv.buffer);
    view.setUint32(12, seq, false);
    return iv;
  }
}

export const hlsDownloadService = new HlsDownloadService();
