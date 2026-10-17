import { describe, it, expect, beforeEach } from 'vitest';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { IWatchPartyTransport, TransportCallbacks } from '../src/core/watchparty/IWatchPartyTransport';
import { 
  WatchPartyMediaMetadata, 
  WatchPartyPlaybackState,
  PeerRoomAnnounceMessage,
  PeerStartTransmissionMessage,
  PeerPermissionsUpdateMessage,
  WatchPartyRoomInfo,
  RoomLifecycleState
} from '../src/core/watchparty/watchPartyTypes';

class MockWatchPartyTransport implements IWatchPartyTransport {
  public selfId: string = 'host-peer-123';
  public isHost: boolean = false;
  public callbacks: TransportCallbacks | null = null;
  public broadcastedPlayback: any[] = [];
  public broadcastedAnnouncements: any[] = [];
  public broadcastedEpisodes: any[] = [];
  public broadcastedTransmissions: any[] = [];
  public broadcastedPermissions: any[] = [];
  public broadcastedAdminMutes: any[] = [];
  public broadcastedHostTransfers: any[] = [];
  public sentChat: any[] = [];

  public async joinRoom(roomId: string, callbacks: TransportCallbacks): Promise<void> {
    this.callbacks = callbacks;
  }

  public async leaveRoom(): Promise<void> {
    this.callbacks = null;
  }

  public broadcastPlaybackState(state: WatchPartyPlaybackState): void {
    this.broadcastedPlayback.push(state);
  }

  public sendPlaybackState(targetPeerId: string, state: WatchPartyPlaybackState): void {
    this.broadcastedPlayback.push({ targetPeerId, ...state });
  }

  public requestSync(targetPeerId?: string): void {}
  public broadcastParticipantState(state: any): void {}

  public sendChatMessage(message: any): void {
    this.sentChat.push(message);
  }

  public broadcastEpisodeChange(change: any): void {
    this.broadcastedEpisodes.push(change);
  }

  public broadcastRoomAnnouncement(announcement: PeerRoomAnnounceMessage): void {
    this.broadcastedAnnouncements.push(announcement);
  }

  public broadcastStartTransmission(message: PeerStartTransmissionMessage): void {
    this.broadcastedTransmissions.push(message);
  }

  public broadcastPermissionsUpdate(message: PeerPermissionsUpdateMessage): void {
    this.broadcastedPermissions.push(message);
  }

  public broadcastAdminMute(message: any): void {
    this.broadcastedAdminMutes.push(message);
  }

  public broadcastHostTransfer(message: any): void {
    this.broadcastedHostTransfers.push(message);
  }

  public getConnectedPeers(): string[] {
    return [];
  }
}

describe('ZapiTV — Watch Party Intro Synchronization Suite', () => {
  let transport: MockWatchPartyTransport;
  let service: WatchPartyService;

  const sampleMedia: WatchPartyMediaMetadata = {
    id: 'anime-frieren',
    contentId: 'anime-frieren',
    title: 'Frieren e a Jornada para o Além',
    type: 'anime',
    season: 1,
    episode: 1
  };

  beforeEach(() => {
    transport = new MockWatchPartyTransport();
    service = new (WatchPartyService as any)(transport);
  });

  describe('1. Ciclo de Vida da Sala & Estados Compartilhados', () => {
    it('inicia no estado LOBBY e não inicia a intro no lobby', async () => {
      await service.createRoom('Anfitrião', sampleMedia, 'sala-test');
      expect(service.getLifecycleState()).toBe('LOBBY');
      expect(service.getRoomState().lifecycleState).toBe('LOBBY');
    });

    it('quando o host inicia transmissão, transiciona para PLAYING_INTRO com timestamp e duração sincronizados', async () => {
      await service.createRoom('Anfitrião', sampleMedia, 'sala-test');
      const now = Date.now();

      service.startTransmission('source');

      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');
      const state = service.getRoomState();
      expect(state.lifecycleState).toBe('PLAYING_INTRO');
      expect(state.introStartTimestamp).toBeGreaterThanOrEqual(now);
      expect(state.introDuration).toBe(5.0);

      expect(transport.broadcastedTransmissions.length).toBe(1);
      const msg = transport.broadcastedTransmissions[0];
      expect(msg.lifecycleState).toBe('PLAYING_INTRO');
      expect(msg.introStartTimestamp).toBe(state.introStartTimestamp);
      expect(msg.introDuration).toBe(5.0);
    });

    it('o convidado recebe start_transmission e transiciona para PLAYING_INTRO com parâmetros idênticos', async () => {
      transport.selfId = 'guest-456';
      await service.joinRoom('sala-test', 'Convidado');
      service.roomInfo!.hostPeerId = 'host-123';

      const introTimestamp = Date.now() + 350;
      let startPayload: any = null;
      service.onTransmissionStart((data) => {
        startPayload = data;
      });

      transport.callbacks?.onStartTransmission?.({
        type: 'start_transmission',
        hostPeerId: 'host-123',
        timestamp: introTimestamp,
        media: sampleMedia,
        mode: 'source',
        lifecycleState: 'PLAYING_INTRO',
        introStartTimestamp: introTimestamp,
        introDuration: 5.0
      }, 'host-123');

      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');
      expect(service.getRoomState().introStartTimestamp).toBe(introTimestamp);
      expect(service.getRoomState().introDuration).toBe(5.0);
      expect(startPayload).toBeTruthy();
      expect(startPayload.lifecycleState).toBe('PLAYING_INTRO');
    });
  });

  describe('2. Sincronização e Cálculo de Tempo Decorrido da Intro', () => {
    it('para participante no lobby que recebe transmissão futura, calcula atraso programado', async () => {
      const scheduledStart = Date.now() + 300;
      const roomInfo: WatchPartyRoomInfo = {
        roomId: 'sala-test',
        hostPeerId: 'host-123',
        hostNickname: 'Host',
        media: sampleMedia as any,
        createdAt: Date.now(),
        maxParticipants: 6,
        lifecycleState: 'PLAYING_INTRO',
        transmissionMode: 'source',
        introStartTimestamp: scheduledStart,
        introDuration: 5.0,
        permissions: { allowChat: true, allowVoice: true, participantPermissions: {} }
      };

      transport.selfId = 'guest-456';
      await service.joinRoom('sala-test', 'Convidado');

      transport.callbacks?.onRoomAnnouncement?.({
        type: 'room_announcement',
        roomInfo
      });

      const diffMs = (service.getRoomState().introStartTimestamp || 0) - Date.now();
      expect(diffMs).toBeGreaterThan(0);
      expect(diffMs).toBeLessThanOrEqual(350);
    });

    it('para participante que entra durante a vinheta (segundo 2 de 5), calcula elapsed para seek sincronizado', async () => {
      const introStart = Date.now() - 2000; // Começou há 2 segundos
      const roomInfo: WatchPartyRoomInfo = {
        roomId: 'sala-test',
        hostPeerId: 'host-123',
        hostNickname: 'Host',
        media: sampleMedia as any,
        createdAt: Date.now() - 5000,
        maxParticipants: 6,
        lifecycleState: 'PLAYING_INTRO',
        transmissionMode: 'source',
        introStartTimestamp: introStart,
        introDuration: 5.0,
        permissions: { allowChat: true, allowVoice: true, participantPermissions: {} }
      };

      transport.selfId = 'guest-late';
      await service.joinRoom('sala-test', 'Convidado Atrasado');

      transport.callbacks?.onRoomAnnouncement?.({
        type: 'room_announcement',
        roomInfo
      });

      const state = service.getRoomState();
      expect(state.lifecycleState).toBe('PLAYING_INTRO');
      const elapsed = (Date.now() - (state.introStartTimestamp || 0)) / 1000;
      expect(elapsed).toBeGreaterThanOrEqual(1.8);
      expect(elapsed).toBeLessThanOrEqual(2.5);
      expect(elapsed).toBeLessThan(state.introDuration || 5.0);
    });

    it('para participante que entra após o fim da vinheta (> 5s ou PLAYING_CONTENT), o estado é PLAYING_CONTENT', async () => {
      const introStart = Date.now() - 8000; // Começou há 8 segundos (intro de 5s já acabou)
      const roomInfo: WatchPartyRoomInfo = {
        roomId: 'sala-test',
        hostPeerId: 'host-123',
        hostNickname: 'Host',
        media: sampleMedia as any,
        createdAt: Date.now() - 10000,
        maxParticipants: 6,
        lifecycleState: 'PLAYING_CONTENT',
        transmissionMode: 'source',
        introStartTimestamp: introStart,
        introDuration: 5.0,
        permissions: { allowChat: true, allowVoice: true, participantPermissions: {} }
      };

      transport.selfId = 'guest-very-late';
      await service.joinRoom('sala-test', 'Convidado Muito Atrasado');

      transport.callbacks?.onRoomAnnouncement?.({
        type: 'room_announcement',
        roomInfo
      });

      expect(service.getLifecycleState()).toBe('PLAYING_CONTENT');
    });
  });

  describe('3. Transição Suave e Isolamento da Linha do Tempo', () => {
    it('quando o host termina a intro, transiciona para PLAYING_CONTENT e anuncia a sala', async () => {
      await service.createRoom('Anfitrião', sampleMedia, 'sala-test');
      service.startTransmission('source');
      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');

      let lifecycleEvent: RoomLifecycleState | null = null;
      service.onLifecycleChange((state) => {
        lifecycleEvent = state;
      });

      service.setLifecycleState('PLAYING_CONTENT');
      expect(service.getLifecycleState()).toBe('PLAYING_CONTENT');
      expect(lifecycleEvent).toBe('PLAYING_CONTENT');

      // Verifica anúncio de sala propagado para convidados
      const lastAnnouncement = transport.broadcastedAnnouncements[transport.broadcastedAnnouncements.length - 1];
      expect(lastAnnouncement.roomInfo.lifecycleState).toBe('PLAYING_CONTENT');
    });

    it('quando a sala está em PLAYING_INTRO, sync de playback com posição 0 mantém o estado PLAYING_INTRO', async () => {
      transport.selfId = 'guest-456';
      await service.joinRoom('sala-test', 'Convidado');
      service.roomInfo!.hostPeerId = 'host-123';
      service.setLifecycleState('PLAYING_INTRO');

      let receivedSync: any = null;
      service.onPlaybackSync((sync) => {
        receivedSync = sync;
      });

      transport.callbacks?.onPlaybackSync?.({
        positionSeconds: 0,
        isPlaying: true,
        playbackRate: 1.0,
        duration: 1400,
        sequence: 1,
        timestamp: Date.now()
      }, 'host-123');

      expect(receivedSync).toBeTruthy();
      expect(receivedSync.positionSeconds).toBe(0);
      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');
    });

    it('se o host pular a intro, convidados recebem o novo anúncio de PLAYING_CONTENT', async () => {
      transport.selfId = 'guest-456';
      await service.joinRoom('sala-test', 'Convidado');
      service.roomInfo!.hostPeerId = 'host-123';
      service.setLifecycleState('PLAYING_INTRO');

      let notifiedState: RoomLifecycleState | null = null;
      service.onLifecycleChange((st) => {
        notifiedState = st;
      });

      // Host anuncia nova fase da sala
      transport.callbacks?.onRoomAnnouncement?.({
        type: 'room_announcement',
        roomInfo: {
          roomId: 'sala-test',
          hostPeerId: 'host-123',
          hostNickname: 'Host',
          media: sampleMedia as any,
          createdAt: Date.now(),
          maxParticipants: 6,
          lifecycleState: 'PLAYING_CONTENT',
          transmissionMode: 'source',
          permissions: { allowChat: true, allowVoice: true, participantPermissions: {} }
        }
      });

      expect(service.getLifecycleState()).toBe('PLAYING_CONTENT');
      expect(notifiedState).toBe('PLAYING_CONTENT');
    });
  });

  describe('4. Permissões de Controle da Intro', () => {
    it('convidado comum NÃO tem permissão canSkip por padrão', async () => {
      transport.selfId = 'guest-456';
      await service.joinRoom('sala-test', 'Convidado');
      service.roomInfo!.hostPeerId = 'host-123';

      expect(service.canLocalControl('canSkip')).toBe(false);
    });

    it('anfitrião possui permissão canSkip nativamente', async () => {
      await service.createRoom('Anfitrião', sampleMedia, 'sala-test');
      expect(service.canLocalControl('canSkip')).toBe(true);
    });

    it('quando o host concede permissão canSkip ao convidado, canLocalControl retorna true', async () => {
      transport.selfId = 'guest-456';
      await service.joinRoom('sala-test', 'Convidado');
      service.roomInfo!.hostPeerId = 'host-123';

      transport.callbacks?.onPermissionsUpdate?.({
        type: 'permissions_update',
        permissions: {
          allowChat: true,
          allowVoice: true,
          participantPermissions: {
            'guest-456': {
              canPlayPause: true,
              canSeek: true,
              canChangeEpisode: true,
              canSkip: true
            }
          }
        }
      }, 'host-123');

      expect(service.canLocalControl('canSkip')).toBe(true);
    });
  });
});
