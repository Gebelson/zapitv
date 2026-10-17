import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { IWatchPartyTransport, TransportCallbacks } from '../src/core/watchparty/IWatchPartyTransport';
import {
  WatchPartyMediaMetadata,
  PeerRoomAnnounceMessage,
  PeerStartTransmissionMessage,
  PeerRemoteControlRequestMessage,
  TransmissionMode
} from '../src/core/watchparty/watchPartyTypes';

class MockWatchPartyTransport implements IWatchPartyTransport {
  public selfId: string = 'host-peer-123';
  public isHost: boolean = false;
  public callbacks: TransportCallbacks | null = null;
  public broadcastedTransmissions: PeerStartTransmissionMessage[] = [];
  public broadcastedAnnouncements: PeerRoomAnnounceMessage[] = [];
  public sentRemoteControlRequests: { targetHostId: string; request: PeerRemoteControlRequestMessage }[] = [];
  public addedStreams: { stream: MediaStream; targetPeerId?: string }[] = [];
  public removedStreams: MediaStream[] = [];

  public async joinRoom(roomId: string, callbacks: TransportCallbacks): Promise<void> {
    this.callbacks = callbacks;
  }

  public async leaveRoom(): Promise<void> {
    this.callbacks = null;
  }

  public broadcastPlaybackState(state: any): void {}
  public sendPlaybackState(targetPeerId: string, state: any): void {}
  public requestSync(targetPeerId?: string): void {}
  public broadcastParticipantState(state: any): void {}
  public sendChatMessage(message: any): void {}
  public broadcastEpisodeChange(change: any): void {}
  public broadcastRoomAnnouncement(announcement: PeerRoomAnnounceMessage): void {
    this.broadcastedAnnouncements.push(announcement);
  }
  public broadcastStartTransmission(message: PeerStartTransmissionMessage): void {
    this.broadcastedTransmissions.push(message);
  }
  public broadcastPermissionsUpdate(message: any): void {}
  public broadcastAdminMute(message: any): void {}
  public broadcastHostTransfer(message: any): void {}
  public getConnectedPeers(): string[] {
    return ['guest-peer-456'];
  }

  public addLocalMediaStream?(stream: MediaStream, targetPeerId?: string): void {
    this.addedStreams.push({ stream, targetPeerId });
  }

  public removeLocalMediaStream?(stream: MediaStream): void {
    this.removedStreams.push(stream);
  }

  public sendRemoteControlRequest?(targetHostId: string, request: PeerRemoteControlRequestMessage): void {
    this.sentRemoteControlRequests.push({ targetHostId, request });
  }
}

describe('ZapiTV — Watch Party Host Broadcast (WebRTC) Suite', () => {
  let transport: MockWatchPartyTransport;
  let service: WatchPartyService;

  const sampleMedia: WatchPartyMediaMetadata = {
    contentId: 'movie-matrix',
    title: 'Matrix',
    type: 'movie',
    mediaFormat: 'movie',
    tmdbId: '603',
    imdbId: 'tt0133093',
    posterUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg'
  };

  beforeEach(() => {
    transport = new MockWatchPartyTransport();
    service = new (WatchPartyService as any)(transport);
  });

  describe('1. Modos de Transmissão & Seletor de Modo', () => {
    it('inicia por padrão com o modo "source" (Modo Sincronizado)', () => {
      expect(service.getTransmissionMode()).toBe('source');
      expect(service.isHostBroadcastMode()).toBe(false);
    });

    it('permite alternar entre "source" e "host_broadcast" (Transmissão do Host)', async () => {
      transport.isHost = true;
      await service.createRoom('Host Nick', sampleMedia, undefined, 'host_broadcast');

      expect(service.getTransmissionMode()).toBe('host_broadcast');
      expect(service.isHostBroadcastMode()).toBe(true);

      service.setTransmissionMode('source');
      expect(service.getTransmissionMode()).toBe('source');
      expect(service.isHostBroadcastMode()).toBe(false);
    });

    it('ao iniciar transmissão com modo host_broadcast, propaga o modo na mensagem start_transmission', async () => {
      transport.isHost = true;
      await service.createRoom('Host Nick', sampleMedia, undefined, 'host_broadcast');

      service.startTransmission('host_broadcast');

      expect(transport.broadcastedTransmissions.length).toBe(1);
      expect(transport.broadcastedTransmissions[0].mode).toBe('host_broadcast');
      expect(transport.broadcastedTransmissions[0].hostPeerId).toBe(transport.selfId);
    });
  });

  describe('2. Sala de Espera (Lobby) & Propagação para Convidado', () => {
    it('o convidado recebe o anúncio da sala com o modo host_broadcast e fica no Lobby até o host iniciar', async () => {
      transport.isHost = false;
      await service.joinRoom('room-123', 'Guest Nick');

      expect(service.getLifecycleState()).toBe('LOBBY');

      transport.callbacks?.onRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: {
          roomId: 'room-123',
          hostPeerId: 'host-peer-123',
          hostNickname: 'Host Nick',
          title: 'Sala do Host',
          media: sampleMedia,
          createdAt: Date.now(),
          lifecycleState: 'LOBBY',
          transmissionMode: 'host_broadcast',
          permissions: {
            allowChat: true,
            allowVoice: true,
            participantPermissions: {}
          }
        }
      }, 'host-peer-123');

      expect(service.isHostBroadcastMode()).toBe(true);
      expect(service.getLifecycleState()).toBe('LOBBY');
    });

    it('quando o host envia start_transmission com host_broadcast, o convidado transiciona para PLAYING', async () => {
      transport.isHost = false;
      await service.joinRoom('room-123', 'Guest Nick');

      let transmissionStartedPayload: any = null;
      service.onTransmissionStart((data) => {
        transmissionStartedPayload = data;
      });

      transport.callbacks?.onStartTransmission({
        type: 'start_transmission',
        hostPeerId: 'host-peer-123',
        timestamp: Date.now(),
        media: sampleMedia,
        mode: 'host_broadcast',
        lifecycleState: 'PLAYING_INTRO'
      }, 'host-peer-123');

      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');
      expect(service.isHostBroadcastMode()).toBe(true);
      expect(transmissionStartedPayload?.mode).toBe('host_broadcast');
    });
  });

  describe('3. Controle Delegado (Remote Control via WebRTC)', () => {
    it('impede convidado sem permissão de solicitar ações de reprodução ao host', async () => {
      transport.isHost = false;
      transport.selfId = 'guest-peer-456';
      await service.joinRoom('room-123', 'Guest Nick');

      transport.callbacks?.onRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: {
          roomId: 'room-123',
          hostPeerId: 'host-peer-123',
          hostNickname: 'Host',
          title: 'Sala',
          media: sampleMedia,
          createdAt: Date.now(),
          lifecycleState: 'PLAYING',
          transmissionMode: 'host_broadcast',
          permissions: {
            allowChat: true,
            allowVoice: true,
            participantPermissions: {
              'guest-peer-456': {
                canPlayPause: false,
                canSeek: false,
                canChangeEpisode: false
              }
            }
          }
        }
      }, 'host-peer-123');

      service.requestHostPlaybackAction('play');
      service.requestHostPlaybackAction('seek', { positionSeconds: 120 });
      service.requestHostPlaybackAction('next_episode');

      expect(transport.sentRemoteControlRequests.length).toBe(0);
    });

    it('permite convidado com permissão enviar comando de seek e play/pause diretamente ao host', async () => {
      transport.isHost = false;
      transport.selfId = 'guest-peer-456';
      await service.joinRoom('room-123', 'Guest Nick');

      transport.callbacks?.onRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: {
          roomId: 'room-123',
          hostPeerId: 'host-peer-123',
          hostNickname: 'Host',
          title: 'Sala',
          media: sampleMedia,
          createdAt: Date.now(),
          lifecycleState: 'PLAYING',
          transmissionMode: 'host_broadcast',
          permissions: {
            allowChat: true,
            allowVoice: true,
            participantPermissions: {
              'guest-peer-456': {
                canPlayPause: true,
                canSeek: true,
                canChangeEpisode: true
              }
            }
          }
        }
      }, 'host-peer-123');

      service.requestHostPlaybackAction('seek', { positionSeconds: 300 });

      expect(transport.sentRemoteControlRequests.length).toBe(1);
      expect(transport.sentRemoteControlRequests[0].targetHostId).toBe('host-peer-123');
      expect(transport.sentRemoteControlRequests[0].request.action).toBe('seek');
      expect(transport.sentRemoteControlRequests[0].request.payload?.positionSeconds).toBe(300);
    });

    it('quando o host recebe solicitação de peer com permissão, dispara evento onRemoteControlReceived', async () => {
      transport.isHost = true;
      transport.selfId = 'host-peer-123';
      await service.createRoom('Host Nick', sampleMedia, undefined, 'host_broadcast');

      // Concede permissão para guest-peer-456
      service.updateParticipantPermissions('guest-peer-456', { canPlayPause: true, canSeek: true });

      let receivedRequest: PeerRemoteControlRequestMessage | null = null;
      service.onRemoteControlReceived((req) => {
        receivedRequest = req;
      });

      transport.callbacks?.onRemoteControlRequest?.({
        type: 'remote_control_request',
        action: 'pause',
        senderPeerId: 'guest-peer-456',
        senderNickname: 'Guest Nick',
        timestamp: Date.now()
      }, 'guest-peer-456');

      expect(receivedRequest).not.toBeNull();
      expect((receivedRequest as any)?.action).toBe('pause');
      expect((receivedRequest as any)?.senderNickname).toBe('Guest Nick');
    });

    it('rejeita solicitação remota de convidado sem permissão no host', async () => {
      transport.isHost = true;
      transport.selfId = 'host-peer-123';
      await service.createRoom('Host Nick', sampleMedia, undefined, 'host_broadcast');

      service.updateParticipantPermissions('guest-peer-456', { canPlayPause: false, canSeek: false });

      let receivedRequest: any = null;
      service.onRemoteControlReceived((req) => {
        receivedRequest = req;
      });

      transport.callbacks?.onRemoteControlRequest?.({
        type: 'remote_control_request',
        action: 'play',
        senderPeerId: 'guest-peer-456',
        senderNickname: 'Guest Nick',
        timestamp: Date.now()
      }, 'guest-peer-456');

      expect(receivedRequest).toBeNull();
    });
  });

  describe('4. Isolamento de Áudio da Transmissão e Microfones', () => {
    it('o fluxo audiovisual é transmitido via addLocalMediaStream sem misturar com microfones', () => {
      const mockVideoTrack = { kind: 'video', readyState: 'live', stop: vi.fn(), addEventListener: vi.fn() };
      const mockAudioTrack = { kind: 'audio', readyState: 'live', stop: vi.fn() };
      const mockScreenStream = {
        getVideoTracks: () => [mockVideoTrack],
        getAudioTracks: () => [mockAudioTrack],
        getTracks: () => [mockVideoTrack, mockAudioTrack],
        active: true
      } as any;

      (service as any).localScreenStream = mockScreenStream;

      const status = service.getBroadcastStatus();
      expect(status.videoTracks).toBe(1);
      expect(status.audioTracks).toBe(1);
      expect(status.isBroadcasting).toBe(true);

      // Parar transmissão limpa os tracks e notifica os peers
      service.stopHostBroadcast();
      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(mockAudioTrack.stop).toHaveBeenCalled();
      expect(service.getBroadcastStatus().isBroadcasting).toBe(false);
    });

    it('o convidado pode ajustar o volume do participante individualmente sem afetar o player principal', () => {
      service.setParticipantAudioVolume('peer-voice-1', 0.5);
      expect((service as any).participantVolumes.get('peer-voice-1')).toBe(0.5);

      const isMuted = service.toggleMuteParticipantLocally('peer-voice-1');
      expect(isMuted).toBe(true);
      expect(service.isParticipantLocallyMuted('peer-voice-1')).toBe(true);

      const unmuted = service.toggleMuteParticipantLocally('peer-voice-1');
      expect(unmuted).toBe(false);
      expect(service.isParticipantLocallyMuted('peer-voice-1')).toBe(false);
    });
  });
});
