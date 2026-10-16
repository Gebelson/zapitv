/**
 * ZapiTV — TrysteroTransport
 * 
 * Implementação do transporte P2P para Watch Party utilizando Trystero com a estratégia Nostr.
 * Estabelece canais de dados WebRTC criptografados e comunicação direta entre peers
 * com custo zero de infraestrutura (R$ 0).
 */

import { joinRoom, selfId, Room } from 'trystero/nostr';
import { IWatchPartyTransport, TransportCallbacks } from './IWatchPartyTransport';
import {
  WatchPartyChatMessage,
  WatchPartyPlaybackState,
  PeerParticipantStateMessage,
  PeerEpisodeChangeMessage,
  PeerRoomAnnounceMessage
} from './watchPartyTypes';

const ZAPITV_APP_ID = 'zapitv-watchparty-v1';

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://nostr.oxtr.dev'
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

export class TrysteroTransport implements IWatchPartyTransport {
  public selfId: string = selfId;
  public isHost: boolean = false;

  private room: Room | null = null;
  private connectedPeers: Set<string> = new Set();
  private callbacks: TransportCallbacks | null = null;

  // Ações Trystero
  private sendPlaybackAction?: (data: WatchPartyPlaybackState, targetPeerId?: string) => Promise<any>;
  private sendSyncRequestAction?: (data: { timestamp: number }, targetPeerId?: string) => Promise<any>;
  private sendParticipantStateAction?: (data: PeerParticipantStateMessage, targetPeerId?: string) => Promise<any>;
  private sendChatMessageAction?: (data: WatchPartyChatMessage, targetPeerId?: string) => Promise<any>;
  private sendEpisodeChangeAction?: (data: PeerEpisodeChangeMessage, targetPeerId?: string) => Promise<any>;
  private sendRoomAnnouncementAction?: (data: PeerRoomAnnounceMessage, targetPeerId?: string) => Promise<any>;

  public async joinRoom(roomId: string, callbacks: TransportCallbacks): Promise<void> {
    if (this.room) {
      await this.leaveRoom();
    }

    this.callbacks = callbacks;
    this.connectedPeers.clear();

    try {
      this.room = joinRoom(
        {
          appId: ZAPITV_APP_ID,
          relayUrls: NOSTR_RELAYS,
          rtcConfig: RTC_CONFIG
        },
        roomId
      );

      // 1. Registro de Ações de Sincronização (compatível com Trystero v0.26+ e versões anteriores)
      this.sendPlaybackAction = this.registerAction<WatchPartyPlaybackState>('playback_sync', (data, peerId) => {
        this.callbacks?.onPlaybackSync(data, peerId);
      });

      this.sendSyncRequestAction = this.registerAction<{ timestamp: number }>('request_sync', (_data, peerId) => {
        this.callbacks?.onRequestSync(peerId);
      });

      this.sendParticipantStateAction = this.registerAction<PeerParticipantStateMessage>('participant_state', (data, peerId) => {
        this.callbacks?.onParticipantState(data, peerId);
      });

      this.sendChatMessageAction = this.registerAction<WatchPartyChatMessage>('chat_msg', (data) => {
        this.callbacks?.onChatMessage(data);
      });

      this.sendEpisodeChangeAction = this.registerAction<PeerEpisodeChangeMessage>('change_episode', (data, peerId) => {
        this.callbacks?.onEpisodeChange(data, peerId);
      });

      this.sendRoomAnnouncementAction = this.registerAction<PeerRoomAnnounceMessage>('room_announce', (data, peerId) => {
        this.callbacks?.onRoomAnnouncement(data, peerId);
      });

      // 2. Eventos de Conexão de Peers
      this.room.onPeerJoin = (peerId) => {
        this.connectedPeers.add(peerId);
        this.callbacks?.onPeerJoin(peerId);
      };

      this.room.onPeerLeave = (peerId) => {
        this.connectedPeers.delete(peerId);
        this.callbacks?.onPeerLeave(peerId);
      };

      // 3. Suporte a Áudio / Voz P2P Opcional
      this.room.onPeerStream = (stream, peerId) => {
        this.callbacks?.onRemoteAudioStream?.(stream, peerId);
      };
    } catch (err) {
      console.error('[TrysteroTransport] Erro ao conectar à sala P2P:', err);
      throw new Error('Falha ao conectar à sala Nostr/WebRTC. Verifique sua conexão à internet.');
    }
  }

  public async leaveRoom(): Promise<void> {
    if (this.room) {
      try {
        await this.room.leave();
      } catch (e) {
        console.warn('[TrysteroTransport] Aviso ao sair da sala:', e);
      }
      this.room = null;
    }
    this.connectedPeers.clear();
    this.callbacks = null;
  }

  public broadcastPlaybackState(state: WatchPartyPlaybackState): void {
    if (this.sendPlaybackAction) {
      this.sendPlaybackAction(state).catch(e => console.warn('[Trystero] Erro ao transmitir reprodução:', e));
    }
  }

  public sendPlaybackState(targetPeerId: string, state: WatchPartyPlaybackState): void {
    if (this.sendPlaybackAction) {
      this.sendPlaybackAction(state, targetPeerId).catch(e => console.warn(`[Trystero] Erro ao enviar reprodução para ${targetPeerId}:`, e));
    }
  }

  public requestSync(targetPeerId?: string): void {
    if (this.sendSyncRequestAction) {
      this.sendSyncRequestAction({ timestamp: Date.now() }, targetPeerId).catch(() => {});
    }
  }

  public broadcastParticipantState(state: PeerParticipantStateMessage): void {
    if (this.sendParticipantStateAction) {
      this.sendParticipantStateAction(state).catch(() => {});
    }
  }

  public sendChatMessage(message: WatchPartyChatMessage): void {
    if (this.sendChatMessageAction) {
      this.sendChatMessageAction(message).catch(e => console.warn('[Trystero] Erro ao enviar chat:', e));
    }
  }

  public broadcastEpisodeChange(change: PeerEpisodeChangeMessage): void {
    if (this.sendEpisodeChangeAction) {
      this.sendEpisodeChangeAction(change).catch(e => console.warn('[Trystero] Erro ao trocar episódio:', e));
    }
  }

  public broadcastRoomAnnouncement(announcement: PeerRoomAnnounceMessage): void {
    if (this.sendRoomAnnouncementAction) {
      this.sendRoomAnnouncementAction(announcement).catch(() => {});
    }
  }

  public addLocalAudioStream(stream: MediaStream): void {
    if (this.room) {
      this.room.addStream(stream);
    }
  }

  public removeLocalAudioStream(stream: MediaStream): void {
    if (this.room) {
      this.room.removeStream(stream);
    }
  }

  public async getPing(peerId: string): Promise<number> {
    if (this.room) {
      try {
        return await this.room.ping(peerId);
      } catch {
        return 999;
      }
    }
    return 999;
  }

  private registerAction<T>(
    actionName: string,
    onReceiveCallback: (data: T, peerId: string) => void
  ): (data: T, targetPeerId?: string) => Promise<any> {
    if (!this.room) return async () => {};
    const rawAction: any = (this.room as any).makeAction(actionName);

    if (Array.isArray(rawAction)) {
      const [send, get] = rawAction;
      if (typeof get === 'function') {
        get(onReceiveCallback);
      }
      return typeof send === 'function' ? send : async () => {};
    }

    if (rawAction && typeof rawAction === 'object') {
      if ('onReceive' in rawAction) {
        rawAction.onReceive = onReceiveCallback;
      } else if ('onMessage' in rawAction) {
        rawAction.onMessage = onReceiveCallback;
      }
      if (typeof rawAction.send === 'function') {
        return rawAction.send.bind(rawAction);
      }
    }

    return async () => {};
  }

  public getConnectedPeers(): string[] {
    return Array.from(this.connectedPeers);
  }
}
