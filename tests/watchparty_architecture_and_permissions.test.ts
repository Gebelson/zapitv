import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { IWatchPartyTransport, TransportCallbacks } from '../src/core/watchparty/IWatchPartyTransport';
import { 
  WatchPartyMediaMetadata, 
  WatchPartyPlaybackState,
  PeerRoomAnnounceMessage,
  PeerStartTransmissionMessage,
  PeerPermissionsUpdateMessage
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

describe('ZapiTV — Watch Party Architecture & Permissions Suite', () => {
  let transport: MockWatchPartyTransport;
  let service: WatchPartyService;

  beforeEach(() => {
    transport = new MockWatchPartyTransport();
    // Injeção de dependência via constructor (instância isolada para testes)
    service = new (WatchPartyService as any)(transport);
  });

  describe('1. Identidade Canônica Imutável de Mídia', () => {
    it('normaliza corretamente metadados de anime como Frieren prevenindo discrepâncias', () => {
      const rawAnime = {
        contentId: 'anime-frieren',
        title: 'Frieren e a Jornada para o Além',
        type: 'anime',
        mediaFormat: 'series',
        tmdbId: '209867',
        imdbId: 'tt22067694',
        seasonNumber: 1,
        episodeNumber: 12,
        posterUrl: 'https://image.tmdb.org/t/p/w500/frieren.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/frieren-backdrop.jpg',
        year: 2023
      };

      const normalized = WatchPartyService.normalizeMedia(rawAnime);

      expect(normalized.id).toBe('anime-frieren');
      expect(normalized.contentId).toBe('anime-frieren');
      expect(normalized.title).toBe('Frieren e a Jornada para o Além');
      expect(normalized.type).toBe('anime');
      expect(normalized.season).toBe(1);
      expect(normalized.episode).toBe(12);
      expect(normalized.image).toBe('https://image.tmdb.org/t/p/w500/frieren.jpg');
      expect(normalized.tmdbId).toBe('209867');
      expect(normalized.imdbId).toBe('tt22067694');
    });

    it('ao criar a sala, a mídia canônica de Frieren é gravada e anunciada para todos os convidados', async () => {
      const media = WatchPartyService.normalizeMedia({
        id: 'anime-frieren',
        title: 'Frieren e a Jornada para o Além',
        type: 'anime',
        season: 1,
        episode: 1
      });

      const roomId = await service.createRoom(media, 'Host Anime');
      expect(service.isConnected).toBe(true);
      expect(service.isHost()).toBe(true);

      const state = service.getRoomState();
      expect(state.mediaMetadata?.title).toBe('Frieren e a Jornada para o Além');
      expect(state.mediaMetadata?.id).toBe('anime-frieren');
      expect(state.mediaMetadata?.type).toBe('anime');
      expect(state.lifecycleState).toBe('LOBBY');
    });

    it('um convidado que entra e recebe o room_announcement adota a mídia exata do host sem qualquer fallback', async () => {
      transport.selfId = 'guest-peer-456';
      await service.joinRoom('zapi-test-room', 'Convidado');

      expect(service.isHost()).toBe(false);
      expect(service.getRoomState().lifecycleState).toBe('LOBBY');

      // Simula anúncio recebido do Host transmitindo Frieren
      const hostRoomInfo = {
        roomId: 'zapi-test-room',
        hostPeerId: 'host-peer-123',
        hostNickname: 'Mestre Host',
        media: WatchPartyService.normalizeMedia({
          id: 'anime-frieren',
          title: 'Frieren e a Jornada para o Além',
          type: 'anime',
          season: 1,
          episode: 5,
          tmdbId: '209867'
        }),
        createdAt: Date.now(),
        maxParticipants: 6,
        lifecycleState: 'LOBBY' as const,
        permissions: {
          allowChat: true,
          allowVoice: true,
          participantPermissions: {}
        }
      };

      transport.callbacks?.onRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: hostRoomInfo
      }, 'host-peer-123');

      const updatedState = service.getRoomState();
      expect(updatedState.mediaMetadata?.title).toBe('Frieren e a Jornada para o Além');
      expect(updatedState.mediaMetadata?.id).toBe('anime-frieren');
      expect(updatedState.mediaMetadata?.season).toBe(1);
      expect(updatedState.mediaMetadata?.episode).toBe(5);
      // NUNCA cai em Brasil Hoje: Salvador Histórica!
      expect(updatedState.mediaMetadata?.title).not.toContain('Brasil Hoje');
    });
  });

  describe('2. Sala de Espera (Lobby) e Controle Estrito de Início pelo Host', () => {
    it('inicia obrigatoriamente no estado LOBBY tanto para o host quanto para o convidado', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'filme-1', title: 'Matrix', type: 'movie' });
      await service.createRoom(media, 'Host');
      expect(service.getLifecycleState()).toBe('LOBBY');

      const guestTransport = new MockWatchPartyTransport();
      guestTransport.selfId = 'guest-1';
      const guestService = new (WatchPartyService as any)(guestTransport);
      await guestService.joinRoom('sala-123', 'Guest');
      expect(guestService.getLifecycleState()).toBe('LOBBY');
    });

    it('convidado NÃO pode disparar a transmissão', async () => {
      transport.selfId = 'guest-peer-456';
      await service.joinRoom('sala-123', 'Guest');

      service.startTransmission();
      expect(service.getLifecycleState()).toBe('LOBBY');
      expect(transport.broadcastedTransmissions.length).toBe(0);
    });

    it('apenas o anfitrião pode disparar a transmissão, transitando a sala para PLAYING', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'filme-1', title: 'Interestelar', type: 'movie' });
      await service.createRoom(media, 'Host');
      expect(service.getLifecycleState()).toBe('LOBBY');

      let transmissionFired = false;
      service.onTransmissionStart((data) => {
        transmissionFired = true;
      });

      service.startTransmission();
      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');
      expect(service.getRoomState().lifecycleState).toBe('PLAYING_INTRO');
      expect(transport.broadcastedTransmissions.length).toBe(1);
      expect(transmissionFired).toBe(true);
    });

    it('quando o convidado recebe start_transmission do host, transiciona imediatamente para PLAYING_INTRO', async () => {
      transport.selfId = 'guest-peer-456';
      await service.joinRoom('sala-123', 'Guest');
      service.roomInfo!.hostPeerId = 'host-peer-123';

      let guestTransmissionFired = false;
      service.onTransmissionStart(() => {
        guestTransmissionFired = true;
      });

      transport.callbacks?.onStartTransmission?.({
        type: 'start_transmission',
        hostPeerId: 'host-peer-123',
        timestamp: Date.now(),
        lifecycleState: 'PLAYING_INTRO',
        media: WatchPartyService.normalizeMedia({ id: 'anime-frieren', title: 'Frieren', type: 'anime' })
      }, 'host-peer-123');

      expect(service.getLifecycleState()).toBe('PLAYING_INTRO');
      expect(guestTransmissionFired).toBe(true);
    });
  });

  describe('3. Sistema Granular de Permissões', () => {
    it('por padrão, convidado não tem autoridade para controlar Play, Pause, Seek ou Episódios', async () => {
      transport.selfId = 'guest-peer-456';
      await service.joinRoom('sala-123', 'Guest');
      service.roomInfo!.hostPeerId = 'host-peer-123';

      expect(service.canLocalControl('canPlayPause')).toBe(false);
      expect(service.canLocalControl('canSeek')).toBe(false);
      expect(service.canLocalControl('canChangeEpisode')).toBe(false);
    });

    it('o anfitrião possui todas as permissões ativas nativamente', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'm1', title: 'Teste', type: 'movie' });
      await service.createRoom(media, 'Host');

      expect(service.canLocalControl('canPlayPause')).toBe(true);
      expect(service.canLocalControl('canSeek')).toBe(true);
      expect(service.canLocalControl('canChangeEpisode')).toBe(true);
      expect(service.canLocalControl('canSkip')).toBe(true);
    });

    it('host pode conceder e revogar permissões individuais para participantes', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'm1', title: 'Teste', type: 'movie' });
      await service.createRoom(media, 'Host');

      const guestId = 'guest-peer-999';
      expect(service.canPeerControl(guestId, 'canPlayPause')).toBe(false);

      // Concede permissão de pausar/retomar
      service.setParticipantPermission(guestId, 'canPlayPause', true);
      expect(service.canPeerControl(guestId, 'canPlayPause')).toBe(true);
      expect(service.canPeerControl(guestId, 'canSeek')).toBe(false);
      expect(transport.broadcastedPermissions.length).toBe(1);

      // Revoga permissão
      service.setParticipantPermission(guestId, 'canPlayPause', false);
      expect(service.canPeerControl(guestId, 'canPlayPause')).toBe(false);
    });

    it('rejeita comandos de sincronização de reprodução vindos de participantes sem permissão', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'm1', title: 'Teste', type: 'movie' });
      await service.createRoom(media, 'Host');

      let syncApplied = false;
      service.onPlaybackSync(() => {
        syncApplied = true;
      });

      // Tentativa de participante sem permissão
      transport.callbacks?.onPlaybackSync({
        mediaId: 'm1',
        mediaType: 'movie',
        positionSeconds: 150,
        isPlaying: false,
        playbackRate: 1.0,
        eventTimestamp: Date.now(),
        sequence: 10,
        hostPeerId: 'guest-unauthorized'
      }, 'guest-unauthorized');

      expect(syncApplied).toBe(false);

      // Agora concede permissão e tenta novamente
      service.setParticipantPermission('guest-authorized', 'canPlayPause', true);
      transport.callbacks?.onPlaybackSync({
        mediaId: 'm1',
        mediaType: 'movie',
        positionSeconds: 200,
        isPlaying: false,
        playbackRate: 1.0,
        eventTimestamp: Date.now(),
        sequence: 11,
        hostPeerId: 'guest-authorized'
      }, 'guest-authorized');

      expect(syncApplied).toBe(true);
    });

    it('permite que o host desative o chat global da sala', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'm1', title: 'Teste', type: 'movie' });
      await service.createRoom(media, 'Host');

      expect(service.getPermissions().allowChat).toBe(true);

      service.setRoomConfig({ allowChat: false });
      expect(service.getPermissions().allowChat).toBe(false);
      expect(transport.broadcastedPermissions.length).toBe(1);
    });

    it('permite que o host silencie administrativamente um participante (admin mute)', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'm1', title: 'Teste', type: 'movie' });
      await service.createRoom(media, 'Host');

      service.setAdminMute('noisy-peer', true);
      expect(transport.broadcastedAdminMutes.length).toBe(1);
      expect(transport.broadcastedAdminMutes[0].targetPeerId).toBe('noisy-peer');
      expect(transport.broadcastedAdminMutes[0].isMuted).toBe(true);
    });
  });

  describe('4. Convites com Links Públicos Robustos (Sem Localhost)', () => {
    it('nunca gera link contendo localhost mesmo se chamado em ambiente local', () => {
      const url = service.getInviteUrl('zapi-abcd-1234');
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('127.0.0.1');
      expect(url).toContain('/sala/zapi-abcd-1234');
      expect(url).toMatch(/^https:\/\/[a-zA-Z0-9.-]+\/sala\/zapi-abcd-1234$/);
    });
  });

  describe('5. Prevenção de Loops de Eventos e Tolerância a Falhas', () => {
    it('ignora sequências desatualizadas na sincronização de reprodução', async () => {
      const media = WatchPartyService.normalizeMedia({ id: 'm1', title: 'Teste', type: 'movie' });
      await service.createRoom(media, 'Host');

      let count = 0;
      service.onPlaybackSync(() => count++);

      // Aplica sequência 5
      transport.callbacks?.onPlaybackSync({
        mediaId: 'm1',
        mediaType: 'movie',
        positionSeconds: 50,
        isPlaying: true,
        playbackRate: 1.0,
        eventTimestamp: Date.now(),
        sequence: 5,
        hostPeerId: 'host-peer-123'
      }, 'host-peer-123');
      expect(count).toBe(1);

      // Tenta aplicar sequência 4 (desatualizada) -> deve ser descartada!
      transport.callbacks?.onPlaybackSync({
        mediaId: 'm1',
        mediaType: 'movie',
        positionSeconds: 40,
        isPlaying: true,
        playbackRate: 1.0,
        eventTimestamp: Date.now(),
        sequence: 4,
        hostPeerId: 'host-peer-123'
      }, 'host-peer-123');
      expect(count).toBe(1);
    });
  });
});
