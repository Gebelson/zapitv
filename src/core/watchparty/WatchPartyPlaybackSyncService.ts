/**
 * ZapiTV — WatchPartyPlaybackSyncService
 * 
 * Serviço isolado para a Sincronização de Reprodução (Timeline Sync) da Watch Party.
 * Responsável pelo estado autoritativo de timeline (position, isPlaying, rate, duration),
 * algoritmo de compensação de drift (Disney+ GroupWatch style), bloqueio contra feedback loops
 * (executeRemoteActionSafely) e numeração de sequência monotônica.
 */

import { WatchPartyPlaybackState, WatchPartyMediaMetadata } from './watchPartyTypes';

export type PlaybackSyncCallback = (state: WatchPartyPlaybackState) => void;

export class WatchPartyPlaybackSyncService {
  private latestPlaybackState: WatchPartyPlaybackState | null = null;
  private lastKnownSequence: number = 0;
  private isApplyingRemoteAction: boolean = false;
  private listeners: Set<PlaybackSyncCallback> = new Set();

  public get isRemoteActionApplying(): boolean {
    return this.isApplyingRemoteAction;
  }

  public getLastPlaybackState(): WatchPartyPlaybackState | null {
    return this.latestPlaybackState;
  }

  /**
   * Executa uma ação de reprodução remota prevenindo disparos acidentais
   * de eventos locais de volta para os peers durante a janela especificada.
   */
  public executeRemoteActionSafely(action: () => void, windowMs: number = 400): void {
    this.isApplyingRemoteAction = true;
    try {
      action();
    } finally {
      setTimeout(() => {
        this.isApplyingRemoteAction = false;
      }, windowMs);
    }
  }

  /**
   * Calcula a posição esperada do vídeo considerando o tempo decorrido desde o timestamp de referência
   * e a velocidade de reprodução do anfitrião (Disney+ GroupWatch style).
   */
  public calculateExpectedPosition(state: WatchPartyPlaybackState): number {
    const basePos = typeof state.positionSeconds === 'number'
      ? state.positionSeconds
      : (typeof state.currentTime === 'number' ? state.currentTime : 0);

    if (!state.isPlaying) {
      return Math.max(0, basePos);
    }

    const now = Date.now();
    const refTime = state.referenceTimestamp || state.eventTimestamp || now;
    const elapsedMs = Math.max(0, now - refTime);
    // Limite superior de 30s de extrapolação para proteção contra relógios muito dessincronizados
    const safeElapsed = Math.min(Math.max(0, elapsedMs / 1000), 30);
    const pos = basePos + (safeElapsed * (state.playbackRate || 1.0));
    return Math.max(0, pos);
  }

  /**
   * Cria um objeto de estado de reprodução autoritativo com sequência monotônica
   */
  public createPlaybackState(
    media: WatchPartyMediaMetadata,
    positionSeconds: number,
    isPlaying: boolean,
    playbackRate: number = 1.0,
    hostPeerId: string,
    roomId: string,
    duration?: number
  ): WatchPartyPlaybackState {
    this.lastKnownSequence += 1;
    const now = Date.now();
    const safePos = Math.max(0, positionSeconds || 0);

    const state: WatchPartyPlaybackState = {
      mediaId: media.id,
      mediaType: String(media.type),
      season: media.season,
      episode: media.episode,
      positionSeconds: safePos,
      currentTime: safePos,
      isPlaying,
      playbackState: isPlaying ? 'playing' : 'paused',
      playbackRate: playbackRate || 1.0,
      eventTimestamp: now,
      referenceTimestamp: now,
      sequence: this.lastKnownSequence,
      hostPeerId,
      duration: duration || undefined,
      sessionId: roomId,
      roomId
    };

    this.latestPlaybackState = state;
    return state;
  }

  /**
   * Recebe um estado de sincronização remoto. Valida sequência e descarta pacotes antigos.
   */
  public handleIncomingPlaybackSync(state: WatchPartyPlaybackState): boolean {
    if (!state) return false;

    // Se vier com sequência menor que a última conhecida, descarta pacote fora de ordem
    if (typeof state.sequence === 'number' && state.sequence < this.lastKnownSequence) {
      console.warn(`[WatchPartyPlaybackSyncService] Pacote de sincronização descartado por sequência obsoleta: ${state.sequence} < ${this.lastKnownSequence}`);
      return false;
    }

    if (typeof state.sequence === 'number') {
      this.lastKnownSequence = Math.max(this.lastKnownSequence, state.sequence);
    }

    this.latestPlaybackState = state;
    this.notify(state);
    return true;
  }

  /**
   * Avalia drift entre o currentTime local e o estado remoto
   */
  public evaluateDrift(localCurrentTime: number, syncState: WatchPartyPlaybackState): {
    inSync: boolean;
    diff: number;
    targetPosition: number;
    action: 'none' | 'rate_adjust' | 'hard_seek';
    recommendedRate?: number;
  } {
    const targetPosition = this.calculateExpectedPosition(syncState);
    const diff = Math.abs(localCurrentTime - targetPosition);

    if (diff < 0.3) {
      return { inSync: true, diff, targetPosition, action: 'none' };
    }

    if (diff <= 1.5 && syncState.isPlaying) {
      // Ajuste suave de velocidade sem engasgos
      const recommendedRate = localCurrentTime < targetPosition ? 1.05 : 0.95;
      return { inSync: false, diff, targetPosition, action: 'rate_adjust', recommendedRate };
    }

    return { inSync: false, diff, targetPosition, action: 'hard_seek' };
  }

  public reset(): void {
    this.latestPlaybackState = null;
    this.lastKnownSequence = 0;
    this.isApplyingRemoteAction = false;
  }

  public onPlaybackSync(callback: PlaybackSyncCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(state: WatchPartyPlaybackState): void {
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.error('[WatchPartyPlaybackSyncService] Erro no callback de playback sync:', e);
      }
    });
  }
}
