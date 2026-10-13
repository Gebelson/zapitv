/**
 * ZapiTV — LiveTVPlayerController
 * Controlador de ciclo de vida de reprodução de TV ao vivo.
 * Garante que apenas um stream esteja ativo por vez, evitando duplicação de áudio,
 * vazamentos de memória e tratando reconexões automáticas.
 */

import Hls from 'hls.js';
import { LiveChannel } from './types';
import { channelHealthService } from './channelHealthService';
import { liveTvPreferences } from './liveTvPreferences';

export interface PlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  isMuted: boolean;
  volume: number;
  availableQualities: string[];
  selectedQuality: string;
}

export class LiveTVPlayerController {
  private activeHls: Hls | null = null;
  private activeVideoElement: HTMLVideoElement | null = null;
  private currentChannel: LiveChannel | null = null;
  private stateListeners = new Set<(state: PlayerState) => void>();

  private state: PlayerState = {
    isPlaying: false,
    isLoading: true,
    hasError: false,
    errorMessage: '',
    isMuted: true,
    volume: liveTvPreferences.getState().volume,
    availableQualities: ['Auto'],
    selectedQuality: 'Auto'
  };

  public getState(): PlayerState {
    return { ...this.state };
  }

  public attachVideo(video: HTMLVideoElement, channel: LiveChannel, initialMuted = true): void {
    // Se o canal for o mesmo e o elemento for o mesmo, não reinicia
    if (this.currentChannel?.id === channel.id && this.activeVideoElement === video && this.state.isPlaying) {
      return;
    }

    this.cleanup();
    this.activeVideoElement = video;
    this.currentChannel = channel;
    this.state.isMuted = initialMuted;
    this.state.volume = liveTvPreferences.getState().volume;
    this.updateState({ isLoading: true, hasError: false, errorMessage: '' });

    const streamUrl = channelHealthService.getPlayableUrl(channel);
    if (!streamUrl) {
      this.updateState({ isLoading: false, hasError: true, errorMessage: 'Endereço de transmissão não configurado.' });
      return;
    }

    video.muted = this.state.isMuted;
    video.volume = this.state.volume;

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 20,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000
      });

      this.activeHls = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const heights = data.levels.map(l => `${l.height}p`).filter(Boolean);
        const unique = Array.from(new Set(heights));
        this.updateState({
          isLoading: false,
          availableQualities: ['Auto', ...unique]
        });

        video.play().then(() => {
          this.updateState({ isPlaying: true });
        }).catch(() => {
          video.muted = true;
          this.updateState({ isMuted: true });
          video.play().then(() => this.updateState({ isPlaying: true })).catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              this.cleanup();
              this.updateState({
                hasError: true,
                isLoading: false,
                errorMessage: 'Transmissão ao vivo temporariamente instável.'
              });
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.onloadedmetadata = () => {
        this.updateState({ isLoading: false });
        video.play().then(() => this.updateState({ isPlaying: true })).catch(() => {
          video.muted = true;
          this.updateState({ isMuted: true });
          video.play().catch(() => {});
        });
      };
      video.onerror = () => {
        this.updateState({ hasError: true, isLoading: false, errorMessage: 'Falha ao reproduzir fluxo HLS nativo.' });
      };
    } else {
      this.updateState({ hasError: true, isLoading: false, errorMessage: 'Formato não suportado pelo navegador.' });
    }
  }

  public setVolume(vol: number): void {
    this.state.volume = vol;
    liveTvPreferences.setVolume(vol);
    if (this.activeVideoElement) {
      this.activeVideoElement.volume = vol;
      if (vol > 0 && this.state.isMuted) {
        this.setMuted(false);
      }
    }
    this.notify();
  }

  public setMuted(muted: boolean): void {
    this.state.isMuted = muted;
    liveTvPreferences.setIsMuted(muted);
    if (this.activeVideoElement) {
      this.activeVideoElement.muted = muted;
    }
    this.notify();
  }

  public toggleMute(): void {
    this.setMuted(!this.state.isMuted);
  }

  public togglePlay(): void {
    if (!this.activeVideoElement) return;
    if (this.activeVideoElement.paused) {
      this.activeVideoElement.play().then(() => this.updateState({ isPlaying: true })).catch(() => {});
    } else {
      this.activeVideoElement.pause();
      this.updateState({ isPlaying: false });
    }
  }

  public setQuality(quality: string): void {
    this.state.selectedQuality = quality;
    if (this.activeHls) {
      if (quality === 'Auto') {
        this.activeHls.currentLevel = -1;
      } else {
        const height = parseInt(quality.replace('p', ''), 10);
        const idx = this.activeHls.levels.findIndex(l => l.height === height);
        if (idx !== -1) this.activeHls.currentLevel = idx;
      }
    }
    this.notify();
  }

  public cleanup(): void {
    if (this.activeHls) {
      this.activeHls.destroy();
      this.activeHls = null;
    }
    if (this.activeVideoElement) {
      this.activeVideoElement.pause();
      this.activeVideoElement.removeAttribute('src');
      this.activeVideoElement.load();
      this.activeVideoElement = null;
    }
    this.currentChannel = null;
    this.state.isPlaying = false;
  }

  public subscribe(listener: (state: PlayerState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private updateState(partial: Partial<PlayerState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  private notify(): void {
    const copy = { ...this.state };
    this.stateListeners.forEach(fn => fn(copy));
  }
}

export const liveTVPlayerController = new LiveTVPlayerController();
