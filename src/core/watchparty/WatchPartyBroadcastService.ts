/**
 * ZapiTV — WatchPartyBroadcastService
 * 
 * Serviço isolado do plano de mídia audiovisual do Anfitrião (Host Broadcast).
 * Responsável por capturar o fluxo do player do host (vídeo + áudio via Web Audio / captureStream)
 * ou tela (getDisplayMedia), publicar para os peers e entregar ao player dos convidados.
 */

import { TransmissionMode, HostBroadcastStatus } from './watchPartyTypes';

export type BroadcastStartCallback = (data: { mode: TransmissionMode; captureMethod: string; stream: MediaStream }) => void;
export type BroadcastStopCallback = () => void;
export type HostStreamCallback = (stream: MediaStream | null) => void;
export type StreamConnectionCallback = (data: { status: 'good' | 'fair' | 'poor'; message: string }) => void;

export class WatchPartyBroadcastService {
  private localBroadcastStream: MediaStream | null = null;
  private remoteBroadcastStream: MediaStream | null = null;
  private captureMethod: 'captureStream' | 'getDisplayMedia' | null = null;
  private sharedPeers: Set<string> = new Set();
  private audioContext: AudioContext | null = null;

  private broadcastStartListeners: Set<BroadcastStartCallback> = new Set();
  private broadcastStopListeners: Set<BroadcastStopCallback> = new Set();
  private hostStreamListeners: Set<HostStreamCallback> = new Set();
  private streamConnectionListeners: Set<StreamConnectionCallback> = new Set();

  public getHostStream(): MediaStream | null {
    return this.remoteBroadcastStream || this.localBroadcastStream;
  }

  public getLocalStream(): MediaStream | null {
    return this.localBroadcastStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteBroadcastStream;
  }

  public getBroadcastStatus(currentMode: TransmissionMode = 'host_broadcast'): HostBroadcastStatus {
    const stream = this.localBroadcastStream || this.remoteBroadcastStream;
    return {
      isBroadcasting: Boolean(stream && stream.active),
      mode: currentMode,
      captureMethod: this.captureMethod || undefined,
      videoTracks: stream ? stream.getVideoTracks().length : 0,
      audioTracks: stream ? stream.getAudioTracks().length : 0,
      connectionQuality: 'good'
    };
  }

  /**
   * Inicia a captura e transmissão do player do Anfitrião
   */
  public async startHostBroadcast(
    videoEl?: HTMLVideoElement | null,
    publishToPeer?: (stream: MediaStream, peerId?: string) => void,
    connectedPeers: string[] = []
  ): Promise<MediaStream> {
    let stream: MediaStream | null = null;
    let method: 'captureStream' | 'getDisplayMedia' = 'captureStream';

    // 1. Tentar captura direta de vídeo e áudio via captureStream() no elemento <video>
    if (videoEl) {
      try {
        const captureFn = (videoEl as any).captureStream || (videoEl as any).mozCaptureStream;
        if (typeof captureFn === 'function') {
          const directStream = captureFn.call(videoEl, 30) as MediaStream;
          if (directStream && directStream.getVideoTracks().length > 0) {
            const vt = directStream.getVideoTracks()[0];
            if (vt && vt.readyState === 'live') {
              // Se não tiver faixa de áudio nativa capturada, usa Web Audio para extrair sem erro de permissão
              if (directStream.getAudioTracks().length === 0) {
                try {
                  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                  if (AudioCtx) {
                    if (!this.audioContext || this.audioContext.state === 'closed') {
                      this.audioContext = new AudioCtx();
                    }
                    if (this.audioContext.state === 'suspended') {
                      this.audioContext.resume().catch(() => {});
                    }
                    const source = this.audioContext.createMediaElementSource(videoEl);
                    const destination = this.audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    source.connect(this.audioContext.destination); // Mantém som local para o host
                    destination.stream.getAudioTracks().forEach(track => {
                      directStream.addTrack(track);
                    });
                  }
                } catch (audioPipelineErr) {
                  console.warn('[WatchPartyBroadcastService] Pipeline Web Audio de áudio capturado:', audioPipelineErr);
                }
              }

              stream = directStream;
              method = 'captureStream';
            }
          }
        }
      } catch (err) {
        console.warn('[WatchPartyBroadcastService] captureStream direto indisponível, usando fallback:', err);
      }
    }

    // 2. Se captureStream não retornou stream utilizável, tenta getDisplayMedia
    if (!stream) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Este navegador não suporta compartilhamento WebRTC de vídeo e áudio.');
      }

      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 }
          },
          audio: true,
          preferCurrentTab: true,
          selfBrowserSurface: 'include'
        } as any);
        method = 'getDisplayMedia';
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          throw new Error('Compartilhamento cancelado pelo anfitrião. Para transmitir, selecione a aba e marque "Compartilhar áudio da guia".');
        }
        throw err;
      }
    }

    if (!stream.getVideoTracks().length) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('Nenhuma faixa de vídeo encontrada na captura.');
    }

    // Configuração de fluidez (motion hint)
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      (videoTrack as any).contentHint = 'motion';
    }

    this.localBroadcastStream = stream;
    this.captureMethod = method;
    this.sharedPeers.clear();

    // Notifica quando o usuário encerra o stream pelo navegador
    videoTrack.addEventListener('ended', () => {
      this.stopHostBroadcast();
    }, { once: true });

    // Publica o stream para os peers conectados
    if (publishToPeer) {
      for (const peerId of connectedPeers) {
        publishToPeer(stream, peerId);
        this.sharedPeers.add(peerId);
      }
    }

    this.notifyBroadcastStart(method, stream);
    this.notifyHostStream(stream);

    return stream;
  }

  public stopHostBroadcast(removeMediaStream?: (stream: MediaStream) => void): void {
    const stream = this.localBroadcastStream;
    if (!stream) return;

    this.localBroadcastStream = null;
    this.captureMethod = null;
    this.sharedPeers.clear();

    if (removeMediaStream) {
      removeMediaStream(stream);
    }

    stream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch {}
    });

    this.notifyBroadcastStop();
    this.notifyHostStream(null);
  }

  /**
   * Convidado recebe o stream do anfitrião
   */
  public handleRemoteMediaStream(stream: MediaStream, _peerId: string): void {
    if (!stream || stream.getVideoTracks().length === 0) return;
    this.remoteBroadcastStream = stream;
    this.notifyHostStream(stream);
    this.notifyConnectionState('good', 'Fluxo audiovisual conectado em alta qualidade.');
  }

  public clearRemoteStream(): void {
    this.remoteBroadcastStream = null;
    this.notifyHostStream(null);
  }

  // --- Subscrições ---

  public onBroadcastStart(cb: BroadcastStartCallback): () => void {
    this.broadcastStartListeners.add(cb);
    return () => this.broadcastStartListeners.delete(cb);
  }

  public onBroadcastStop(cb: BroadcastStopCallback): () => void {
    this.broadcastStopListeners.add(cb);
    return () => this.broadcastStopListeners.delete(cb);
  }

  public onHostStream(cb: HostStreamCallback): () => void {
    this.hostStreamListeners.add(cb);
    return () => this.hostStreamListeners.delete(cb);
  }

  public onStreamConnection(cb: StreamConnectionCallback): () => void {
    this.streamConnectionListeners.add(cb);
    return () => this.streamConnectionListeners.delete(cb);
  }

  private notifyBroadcastStart(captureMethod: string, stream: MediaStream): void {
    this.broadcastStartListeners.forEach(cb => {
      try {
        cb({ mode: 'host_broadcast', captureMethod, stream });
      } catch (e) {
        console.error('[WatchPartyBroadcastService] Erro no callback broadcast start:', e);
      }
    });
  }

  private notifyBroadcastStop(): void {
    this.broadcastStopListeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('[WatchPartyBroadcastService] Erro no callback broadcast stop:', e);
      }
    });
  }

  private notifyHostStream(stream: MediaStream | null): void {
    this.hostStreamListeners.forEach(cb => {
      try {
        cb(stream);
      } catch (e) {
        console.error('[WatchPartyBroadcastService] Erro no callback host stream:', e);
      }
    });
  }

  private notifyConnectionState(status: 'good' | 'fair' | 'poor', message: string): void {
    this.streamConnectionListeners.forEach(cb => {
      try {
        cb({ status, message });
      } catch (e) {
        console.error('[WatchPartyBroadcastService] Erro no callback connection state:', e);
      }
    });
  }
}
