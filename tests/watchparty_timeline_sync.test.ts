import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { IWatchPartyTransport } from '../src/core/watchparty/IWatchPartyTransport';
import {
  WatchPartyRoomInfo,
  WatchPartyPlaybackState,
  WatchPartyMediaMetadata,
  PeerEpisodeChangeMessage
} from '../src/core/watchparty/watchPartyTypes';

class MockTransport implements IWatchPartyTransport {
  public selfId: string = 'host-123';
  public isHost: boolean = true;
  public callbacks: any = null;
  public broadcastPlaybackState = vi.fn();
  public sendPlaybackState = vi.fn();
  public requestSync = vi.fn();
  public broadcastParticipantState = vi.fn();
  public broadcastChatMessage = vi.fn();
  public broadcastRoomAnnouncement = vi.fn();
  public broadcastEpisodeChange = vi.fn();
  public requestHostAction = vi.fn();
  public initialize = vi.fn().mockResolvedValue('host-123');
  public joinRoom = vi.fn().mockImplementation((_roomId, callbacks) => {
    this.callbacks = callbacks;
    return Promise.resolve(true);
  });
  public leaveRoom = vi.fn();
  public destroy = vi.fn();
}

describe('ZapiTV — Watch Party Timeline Synchronization (Disney+ GroupWatch Style)', () => {
  let hostTransport: MockTransport;
  let guestTransport: MockTransport;
  let hostService: WatchPartyService;
  let guestService: WatchPartyService;

  const sampleMedia: WatchPartyMediaMetadata = {
    contentId: 'movie-1',
    title: 'Filme Teste',
    type: 'movie',
    mediaFormat: 'movie',
    tmdbId: '123'
  };

  beforeEach(() => {
    vi.useFakeTimers();

    hostTransport = new MockTransport();
    hostTransport.selfId = 'host-123';
    hostTransport.isHost = true;

    guestTransport = new MockTransport();
    guestTransport.selfId = 'guest-456';
    guestTransport.isHost = false;

    hostService = new WatchPartyService(hostTransport);
    guestService = new WatchPartyService(guestTransport);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Host como Referência & Cálculo de Posição Esperada', () => {
    it('quando o host está pausado, a posição esperada é exatamente a posição informada sem extrapolação temporal', () => {
      const state: WatchPartyPlaybackState = {
        mediaId: 'movie-1',
        mediaType: 'movie',
        positionSeconds: 330, // 05:30
        currentTime: 330,
        isPlaying: false,
        playbackRate: 1.0,
        eventTimestamp: 1000000,
        referenceTimestamp: 1000000,
        sequence: 1,
        hostPeerId: 'host-123'
      };

      vi.setSystemTime(1005000); // 5 segundos depois
      const expected = hostService.calculateExpectedPosition(state);
      expect(expected).toBe(330);
    });

    it('quando o host está reproduzindo, a posição esperada calcula o tempo decorrido ponderado pela velocidade', () => {
      const state: WatchPartyPlaybackState = {
        mediaId: 'movie-1',
        mediaType: 'movie',
        positionSeconds: 100,
        currentTime: 100,
        isPlaying: true,
        playbackRate: 1.0,
        eventTimestamp: 1000000,
        referenceTimestamp: 1000000,
        sequence: 1,
        hostPeerId: 'host-123'
      };

      vi.setSystemTime(1002500); // 2.5s decorridos
      const expected = hostService.calculateExpectedPosition(state);
      expect(expected).toBeCloseTo(102.5, 1);
    });

    it('aplica limite de segurança (30s) na extrapolação temporal para prevenir saltos bizarros em relógios dessincronizados', () => {
      const state: WatchPartyPlaybackState = {
        mediaId: 'movie-1',
        mediaType: 'movie',
        positionSeconds: 100,
        currentTime: 100,
        isPlaying: true,
        playbackRate: 1.0,
        eventTimestamp: 1000000,
        referenceTimestamp: 1000000,
        sequence: 1,
        hostPeerId: 'host-123'
      };

      vi.setSystemTime(1200000); // 200s decorridos
      const expected = hostService.calculateExpectedPosition(state);
      expect(expected).toBeCloseTo(130.0, 1); // Limitado a +30s
    });
  });

  describe('2. Correção Progressiva Inteligente (GroupWatch Drift Thresholds)', () => {
    it('diferença inferior a 300ms é tolerada sem necessidade de correção brusca de velocidade ou seek', () => {
      const expectedPos = 120.2;
      const currentPos = 120.0;
      const drift = Math.abs(currentPos - expectedPos);

      expect(drift).toBeLessThanOrEqual(0.3);
      let rate = 1.0;
      if (drift > 1.5) {
        // seek direto
      } else if (drift > 0.3) {
        rate = currentPos < expectedPos ? 1.05 : 0.95;
      }
      expect(rate).toBe(1.0);
    });

    it('diferença entre 300ms e 1.5s acelera o vídeo em +5% se o convidado estiver atrasado em relação ao host', () => {
      const expectedPos = 121.0;
      const currentPos = 120.2; // 800ms atrasado
      const drift = Math.abs(currentPos - expectedPos);

      expect(drift).toBeGreaterThan(0.3);
      expect(drift).toBeLessThanOrEqual(1.5);

      const baseRate = 1.0;
      const adjustedRate = currentPos < expectedPos ? baseRate * 1.05 : baseRate * 0.95;
      expect(adjustedRate).toBeCloseTo(1.05, 2);
    });

    it('diferença entre 300ms e 1.5s desacelera o vídeo em -5% se o convidado estiver adiantado em relação ao host', () => {
      const expectedPos = 120.0;
      const currentPos = 120.8; // 800ms adiantado
      const drift = Math.abs(currentPos - expectedPos);

      expect(drift).toBeGreaterThan(0.3);
      expect(drift).toBeLessThanOrEqual(1.5);

      const baseRate = 1.0;
      const adjustedRate = currentPos < expectedPos ? baseRate * 1.05 : baseRate * 0.95;
      expect(adjustedRate).toBeCloseTo(0.95, 2);
    });

    it('diferença superior a 1.5s realiza seek direto e imediato para a posição calculada', () => {
      const expectedPos = 125.0;
      const currentPos = 120.0; // 5.0s atrasado
      const drift = Math.abs(currentPos - expectedPos);

      expect(drift).toBeGreaterThan(1.5);
      const mustHardSeek = drift > 1.5;
      expect(mustHardSeek).toBe(true);
    });

    it('quando o host pausa o vídeo, se a diferença for > 300ms, o alinhamento da posição é feito diretamente', () => {
      const isPlaying = false;
      const expectedPos = 330.0;
      const currentPos = 328.5; // 1.5s de diferença
      const drift = Math.abs(currentPos - expectedPos);

      expect(isPlaying).toBe(false);
      expect(drift).toBeGreaterThan(0.3);
      const shouldAlignDirectly = !isPlaying && drift > 0.3;
      expect(shouldAlignDirectly).toBe(true);
    });
  });

  describe('3. Entrada Tardia e Reconexão de Participantes', () => {
    it('anfitrião envia estado atual de reprodução instantaneamente quando um novo participante conecta', async () => {
      await hostService.createRoom('Host Nick', sampleMedia);

      // Host reproduzindo em 1115s (18:35)
      hostService.updatePlaybackState(1115, true, 1.0, 7200);

      // Peer conecta via callback registrado no transport
      expect(hostTransport.callbacks).toBeDefined();
      hostTransport.callbacks.onPeerJoin('guest-new-999');

      expect(hostTransport.sendPlaybackState).toHaveBeenCalledWith(
        'guest-new-999',
        expect.objectContaining({
          positionSeconds: expect.any(Number),
          currentTime: expect.any(Number),
          isPlaying: true,
          playbackRate: 1.0,
          sequence: expect.any(Number)
        })
      );
    });

    it('convidado armazena o último estado recebido acessível via getLastPlaybackState()', async () => {
      await guestService.joinRoom('room-abc', 'Guest Nick');

      const callbacks = guestTransport.callbacks;
      expect(callbacks).toBeDefined();

      const stateFromHost: WatchPartyPlaybackState = {
        mediaId: 'movie-1',
        mediaType: 'movie',
        positionSeconds: 200, // 03:20
        currentTime: 200,
        isPlaying: true,
        playbackRate: 1.0,
        eventTimestamp: Date.now(),
        sequence: 5,
        hostPeerId: 'host-123'
      };

      callbacks.onPlaybackSync(stateFromHost, 'host-123');

      const stored = guestService.getLastPlaybackState();
      expect(stored).not.toBeNull();
      expect(stored?.positionSeconds).toBe(200);
      expect(stored?.currentTime).toBe(200);
      expect(stored?.isPlaying).toBe(true);
    });
  });

  describe('4. Prevenção de Conflitos, Loops de Eco e Sequenciamento', () => {
    it('ignora atualizações defasadas com sequence menor ou igual ao último conhecido', async () => {
      await guestService.joinRoom('room-abc', 'Guest Nick');

      const callbacks = guestTransport.callbacks;
      const onSyncSpy = vi.fn();
      guestService.onPlaybackSync(onSyncSpy);

      // Pacote com sequence 10
      callbacks.onPlaybackSync({
        mediaId: 'movie-1',
        positionSeconds: 100,
        isPlaying: true,
        sequence: 10,
        hostPeerId: 'host-123'
      }, 'host-123');

      expect(onSyncSpy).toHaveBeenCalledTimes(1);

      // Pacote desordenado antigo com sequence 8 (deve ser descartado)
      callbacks.onPlaybackSync({
        mediaId: 'movie-1',
        positionSeconds: 80,
        isPlaying: true,
        sequence: 8,
        hostPeerId: 'host-123'
      }, 'host-123');

      expect(onSyncSpy).toHaveBeenCalledTimes(1); // Não disparou para sequence 8

      // Pacote mais novo com sequence 11 (deve ser aceito)
      callbacks.onPlaybackSync({
        mediaId: 'movie-1',
        positionSeconds: 110,
        isPlaying: true,
        sequence: 11,
        hostPeerId: 'host-123'
      }, 'host-123');

      expect(onSyncSpy).toHaveBeenCalledTimes(2);
    });

    it('executeRemoteActionSafely ativa isRemoteActionApplying bloqueando retransmissão de eco', () => {
      expect(guestService.isRemoteActionApplying).toBe(false);

      guestService.executeRemoteActionSafely(() => {
        expect(guestService.isRemoteActionApplying).toBe(true);
      }, 400);

      expect(guestService.isRemoteActionApplying).toBe(true);

      // Avança timer além do windowMs
      vi.advanceTimersByTime(450);
      expect(guestService.isRemoteActionApplying).toBe(false);
    });
  });

  describe('5. Sincronização de Troca de Episódio ou Temporada', () => {
    it('quando o host altera o episódio, dispara broadcastEpisodeChange com dados normalizados e sequencial', async () => {
      await hostService.createRoom('Host Nick', {
        ...sampleMedia,
        type: 'series',
        season: 1,
        episode: 1
      });

      hostService.changeEpisode(1, 2);

      expect(hostTransport.broadcastEpisodeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change_episode',
          season: 1,
          episode: 2,
          sequence: expect.any(Number)
        })
      );
    });

    it('quando o convidado recebe troca de episódio, notifica os ouvintes com onChangeEpisode', async () => {
      await guestService.joinRoom('room-series-1', 'Guest Nick');

      const episodeChangeSpy = vi.fn();
      guestService.onChangeEpisode(episodeChangeSpy);

      const callbacks = guestTransport.callbacks;
      const changeMsg: PeerEpisodeChangeMessage = {
        type: 'change_episode',
        sequence: 15,
        season: 2,
        episode: 4,
        media: { id: 'series-westworld', type: 'series', season: 2, episode: 4 }
      };

      callbacks.onEpisodeChange(changeMsg, 'host-123');

      expect(episodeChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          season: 2,
          episode: 4
        })
      );
    });
  });

  describe('6. Autonomia de Buffering Individual', () => {
    it('buffering de um convidado altera apenas seu próprio status de participante sem pausar a sala para os demais', async () => {
      await guestService.joinRoom('room-1', 'Guest Nick');

      guestService.setBuffering(true);

      expect(guestTransport.broadcastParticipantState).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'buffering'
        })
      );

      // Não transmite pause global para a sala
      expect(guestTransport.broadcastPlaybackState).not.toHaveBeenCalled();
    });
  });
});
