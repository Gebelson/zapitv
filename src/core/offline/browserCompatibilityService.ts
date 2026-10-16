/**
 * ZapiTV — BrowserCompatibilityService
 * Detecta capacidades de mídia e armazenamento offline específicas de cada navegador e SO.
 * Cobre: Chrome, Edge, Firefox, Safari, Android e iOS.
 * Avalia:
 * 1. Suporte OPFS (Origin Private File System) vs IndexedDB
 * 2. Suporte EME e licenças persistentes (DRM legítimo offline sem extração de chaves)
 * 3. Suporte a criptografia de transporte (Web Crypto AES-128 / AES-CBC)
 * 4. Suporte a formatos de contêiner e codecs de vídeo (MP4, WebM, HLS/DASH)
 */

export interface BrowserOfflineCapabilities {
  browserName: 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';
  osName: 'windows' | 'mac' | 'android' | 'ios' | 'linux' | 'other';
  isMobile: boolean;
  opfsSupported: boolean;
  opfsWritableSupported: boolean;
  indexedDbSupported: boolean;
  webCryptoSupported: boolean;
  supportsPersistentWidevine: boolean;
  supportsPersistentPlayReady: boolean;
  supportsPersistentFairPlay: boolean;
  recommendedStorageDriver: 'opfs' | 'idb';
  supportedContainerFormats: ('mp4' | 'webm' | 'hls')[];
}

class BrowserCompatibilityService {
  private cachedCapabilities: BrowserOfflineCapabilities | null = null;

  public async getCapabilities(): Promise<BrowserOfflineCapabilities> {
    if (this.cachedCapabilities) return this.cachedCapabilities;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    
    // Identificação de Plataforma e Navegador
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isMac = !isIOS && /macintosh|mac os x/i.test(ua);
    const isWindows = /windows/i.test(ua);
    const isLinux = !isAndroid && /linux/i.test(ua);

    let osName: BrowserOfflineCapabilities['osName'] = 'other';
    if (isAndroid) osName = 'android';
    else if (isIOS) osName = 'ios';
    else if (isWindows) osName = 'windows';
    else if (isMac) osName = 'mac';
    else if (isLinux) osName = 'linux';

    let browserName: BrowserOfflineCapabilities['browserName'] = 'other';
    if (ua.includes('edg/')) browserName = 'edge';
    else if (ua.includes('chrome/') || ua.includes('crios/')) browserName = 'chrome';
    else if (ua.includes('firefox/') || ua.includes('fxios/')) browserName = 'firefox';
    else if (ua.includes('safari/') && !ua.includes('chrome/')) browserName = 'safari';

    // 1. Verificação de OPFS e WritableHandle
    let opfsSupported = false;
    let opfsWritableSupported = false;

    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
      try {
        const root = await navigator.storage.getDirectory();
        opfsSupported = true;
        // Safari no iOS e em algumas versões não suporta createWritable() na thread principal
        const testFile = await root.getFileHandle('__probe_cap__', { create: true });
        if (typeof (testFile as any).createWritable === 'function') {
          try {
            const w = await (testFile as any).createWritable();
            await w.close();
            opfsWritableSupported = true;
          } catch {
            opfsWritableSupported = false;
          }
        }
        await root.removeEntry('__probe_cap__').catch(() => {});
      } catch {
        opfsSupported = false;
        opfsWritableSupported = false;
      }
    }

    // 2. Verificação de IndexedDB
    let indexedDbSupported = false;
    try {
      indexedDbSupported = typeof indexedDB !== 'undefined' || (typeof window !== 'undefined' && !!window.indexedDB);
    } catch {
      indexedDbSupported = false;
    }

    // 3. Verificação de Web Crypto (usado para decriptação de transporte HLS AES-128 legítima)
    let webCryptoSupported = false;
    try {
      webCryptoSupported = typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.decrypt === 'function';
    } catch {
      webCryptoSupported = false;
    }

    // 4. Verificação legítima de EME Persistent Licenses (W3C standard)
    const supportsPersistentWidevine = await this.probePersistentKeySystem('com.widevine.alpha');
    const supportsPersistentPlayReady = await this.probePersistentKeySystem('com.microsoft.playready');
    const supportsPersistentFairPlay = await this.probePersistentKeySystem('com.apple.fps');

    // Recomendação de Driver: Safari/iOS usa IndexedDB, outros com OPFS Writable usam OPFS
    let recommendedStorageDriver: 'opfs' | 'idb' = 'idb';
    if (opfsWritableSupported && !isIOS) {
      recommendedStorageDriver = 'opfs';
    }

    // Formatos compatíveis por contêiner
    const supportedContainerFormats: ('mp4' | 'webm' | 'hls')[] = ['mp4'];
    if (browserName !== 'safari' || isMac) {
      supportedContainerFormats.push('webm');
    }
    // HLS é compatível via MediaSource ou HLS parser/downloader em todos
    supportedContainerFormats.push('hls');

    this.cachedCapabilities = {
      browserName,
      osName,
      isMobile,
      opfsSupported,
      opfsWritableSupported,
      indexedDbSupported,
      webCryptoSupported,
      supportsPersistentWidevine,
      supportsPersistentPlayReady,
      supportsPersistentFairPlay,
      recommendedStorageDriver,
      supportedContainerFormats
    };

    return this.cachedCapabilities;
  }

  /**
   * Consulta a API W3C EME (requestMediaKeySystemAccess) para verificar suporte legítimo
   * a licenças offline persistentes no dispositivo do usuário.
   */
  private async probePersistentKeySystem(keySystem: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.requestMediaKeySystemAccess) {
      return false;
    }

    const configs: MediaKeySystemConfiguration[] = [
      {
        initDataTypes: ['cenc'],
        audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }],
        videoCapabilities: [{ contentType: 'video/mp4;codecs="avc1.42E01E"' }],
        sessionTypes: ['persistent-license']
      }
    ];

    try {
      const access = await navigator.requestMediaKeySystemAccess(keySystem, configs);
      return Boolean(access);
    } catch {
      return false;
    }
  }
}

export const browserCompatibilityService = new BrowserCompatibilityService();
