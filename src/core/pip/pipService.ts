/**
 * ZapiTV Picture-in-Picture & Media Session Service
 * 
 * Gerencia a ativação e controle do Picture-in-Picture (PiP) nativo,
 * sincronização com Media Session API do navegador e preferências do usuário.
 */

const AUTO_PIP_STORAGE_KEY = 'zapitv_auto_pip_on_blur';
const AUTO_PIP_EVENT = 'zapitv_auto_pip_changed';

export interface MediaSessionConfig {
  title: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  duration?: number;
  currentTime?: number;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
}

class PipService {
  private autoPipOnBlur: boolean;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    this.autoPipOnBlur = this.loadAutoPipPreference();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === AUTO_PIP_STORAGE_KEY) {
          this.autoPipOnBlur = e.newValue === 'true';
          this.notify();
        }
      });
      window.addEventListener(AUTO_PIP_EVENT, (e: any) => {
        if (typeof e.detail?.enabled === 'boolean') {
          this.autoPipOnBlur = e.detail.enabled;
          this.notify();
        }
      });
    }
  }

  private loadAutoPipPreference(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(AUTO_PIP_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.autoPipOnBlur));
  }

  /**
   * Verifica se a API nativa de Picture-in-Picture é suportada pelo navegador.
   */
  public isPipSupported(): boolean {
    if (typeof document === 'undefined') return false;
    return Boolean(
      'pictureInPictureEnabled' in document &&
      (document as any).pictureInPictureEnabled
    );
  }

  /**
   * Verifica se Document Picture-in-Picture API está disponível no navegador.
   */
  public isDocumentPipSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'documentPictureInPicture' in window;
  }

  /**
   * Retorna se a opção de PiP automático ao trocar de aba está ativa.
   */
  public isAutoPipOnBlurEnabled(): boolean {
    return this.autoPipOnBlur;
  }

  /**
   * Define e persiste a preferência de PiP automático ao trocar de aba.
   */
  public setAutoPipOnBlurEnabled(enabled: boolean): void {
    this.autoPipOnBlur = enabled;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTO_PIP_STORAGE_KEY, enabled ? 'true' : 'false');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTO_PIP_EVENT, { detail: { enabled } }));
      }
    } catch (err) {
      console.warn('Erro ao salvar preferência de PiP automático:', err);
    }
    this.notify();
  }

  /**
   * Assina notificações de alteração da preferência de PiP automático.
   */
  public subscribeAutoPipPreference(callback: (enabled: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Solicita abertura da janela Picture-in-Picture para o elemento de vídeo.
   */
  public async requestPictureInPicture(video: HTMLVideoElement): Promise<PictureInPictureWindow | null> {
    if (!video) throw new Error('Elemento de vídeo não fornecido');
    if (!this.isPipSupported()) {
      throw new Error('Picture-in-Picture não é suportado pelo seu navegador');
    }

    if (document.pictureInPictureElement === video) {
      // Já está em PiP
      return null;
    }

    // Se o vídeo ainda não carregou metadados, aguarda
    if (video.readyState < 1) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Tempo limite ao preparar vídeo para Imagem em Imagem'));
        }, 5000);

        const onLoaded = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error('Falha ao carregar metadados do vídeo'));
        };

        const cleanup = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('canplay', onLoaded);
          video.removeEventListener('error', onError);
        };

        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('canplay', onLoaded);
        video.addEventListener('error', onError);
      });
    }

    return await video.requestPictureInPicture();
  }

  /**
   * Fecha a janela Picture-in-Picture se estiver ativa.
   */
  public async exitPictureInPicture(): Promise<void> {
    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  }

  /**
   * Alterna o estado do Picture-in-Picture.
   */
  public async togglePictureInPicture(video: HTMLVideoElement): Promise<boolean> {
    if (typeof document !== 'undefined' && document.pictureInPictureElement === video) {
      await this.exitPictureInPicture();
      return false;
    } else {
      await this.requestPictureInPicture(video);
      return true;
    }
  }

  /**
   * Configura e atualiza metadados e ações da Media Session API do navegador.
   * Isso fornece controles nativos de Play/Pause/Avançar no PiP e no Windows Media Flyout.
   */
  public updateMediaSession(config: MediaSessionConfig): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const artworks: MediaImage[] = [];
      if (config.artworkUrl) {
        artworks.push(
          { src: config.artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: config.artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: config.artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: config.artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: config.title || 'ZapiTV',
        artist: config.artist || 'ZapiTV',
        album: config.album || 'Streaming',
        artwork: artworks
      });

      navigator.mediaSession.playbackState = config.isPlaying ? 'playing' : 'paused';

      // Atualizar posição para a barra de scrubber do sistema
      if (
        config.duration !== undefined &&
        config.duration > 0 &&
        config.currentTime !== undefined &&
        'setPositionState' in navigator.mediaSession
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, config.duration),
            playbackRate: 1.0,
            position: Math.max(0, Math.min(config.duration, config.currentTime))
          });
        } catch {
          // Ignore
        }
      }

      // Handlers de Ações
      if (config.onPlay) {
        navigator.mediaSession.setActionHandler('play', () => config.onPlay?.());
      }
      if (config.onPause) {
        navigator.mediaSession.setActionHandler('pause', () => config.onPause?.());
      }
      if (config.onSeek) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) config.onSeek?.(details.seekTime);
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const offset = details.seekOffset || 10;
          if (config.currentTime !== undefined) config.onSeek?.(Math.max(0, config.currentTime - offset));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const offset = details.seekOffset || 10;
          if (config.currentTime !== undefined && config.duration !== undefined) {
            config.onSeek?.(Math.min(config.duration, config.currentTime + offset));
          }
        });
      }
      if (config.onNextEpisode) {
        navigator.mediaSession.setActionHandler('nexttrack', () => config.onNextEpisode?.());
      } else {
        try { navigator.mediaSession.setActionHandler('nexttrack', null); } catch {}
      }
      if (config.onPreviousEpisode) {
        navigator.mediaSession.setActionHandler('previoustrack', () => config.onPreviousEpisode?.());
      } else {
        try { navigator.mediaSession.setActionHandler('previoustrack', null); } catch {}
      }
    } catch (err) {
      console.warn('Erro ao configurar MediaSession:', err);
    }
  }

  /**
   * Sincroniza legendas ativas com uma TextTrack nativa no elemento <video>.
   * Quando o PiP é aberto, o navegador renderiza nativamente as legendas na janela flutuante!
   */
  public syncSubtitlesToNativeTrack(
    video: HTMLVideoElement,
    cues: Array<{ start: number; end: number; text: string }>,
    isVisibleInPip: boolean,
    delay = 0
  ): void {
    if (!video || !('VTTCue' in window)) return;

    try {
      let track = Array.from(video.textTracks).find(t => t.label === 'ZapiTV PiP Subtitles');
      if (!track) {
        track = video.addTextTrack('subtitles', 'ZapiTV PiP Subtitles', 'pt');
      }

      // Limpar cues anteriores
      if (track.cues) {
        const existingCues = Array.from(track.cues);
        existingCues.forEach(c => track!.removeCue(c));
      }

      // Adicionar novas cues calibradas com delay
      if (cues && cues.length > 0) {
        cues.forEach(cue => {
          try {
            const adjustedStart = Math.max(0, cue.start - delay);
            const adjustedEnd = Math.max(adjustedStart + 0.3, cue.end - delay);
            const vttCue = new VTTCue(adjustedStart, adjustedEnd, cue.text);
            track!.addCue(vttCue);
          } catch {
            // ignore
          }
        });
      }

      // Se PiP estiver ativo, exibe nativamente na janela flutuante. Se não, oculta para dar lugar ao overlay estilizado.
      track.mode = isVisibleInPip ? 'showing' : 'hidden';
    } catch (err) {
      console.warn('Erro ao sincronizar legendas nativas para PiP:', err);
    }
  }
}

export const pipService = new PipService();
