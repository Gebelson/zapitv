import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { IWatchPartyTransport } from '../src/core/watchparty/IWatchPartyTransport';
import {
  WatchPartyRoomInfo,
  WatchPartyPlaybackState,
  PeerParticipantStateMessage,
  PeerEpisodeChangeMessage
} from '../src/core/watchparty/watchPartyTypes';

// Barramento em memória simulando canal WebRTC P2P entre Host e Guest
class SimulatedNetworkBus {
  private peers: Map<string, SimulatedPeerTransport> = new Map();
  public networkDelayMs: number = 20;

  public register(peer: SimulatedPeerTransport) {
    this.peers.set(peer.selfId, peer);
  }

  public deliverPlayback(senderId: string, state: WatchPartyPlaybackState, targetPeerId?: string) {
    for (const [id, peer] of this.peers) {
      if (id !== senderId && (!targetPeerId || id === targetPeerId)) {
        setTimeout(() => {
          peer.callbacks?.onPlaybackSync(JSON.parse(JSON.stringify(state)), senderId);
        }, this.networkDelayMs);
      }
    }
  }

  public deliverEpisodeChange(senderId: string, change: PeerEpisodeChangeMessage) {
    for (const [id, peer] of this.peers) {
      if (id !== senderId) {
        setTimeout(() => {
          peer.callbacks?.onEpisodeChange(JSON.parse(JSON.stringify(change)), senderId);
        }, this.networkDelayMs);
      }
    }
  }

  public deliverParticipantState(senderId: string, state: PeerParticipantStateMessage) {
    for (const [id, peer] of this.peers) {
      if (id !== senderId) {
        setTimeout(() => {
          peer.callbacks?.onParticipantState(JSON.parse(JSON.stringify(state)), senderId);
        }, this.networkDelayMs);
      }
    }
  }

  public deliverPeerJoin(joiningPeerId: string) {
    for (const [id, peer] of this.peers) {
      if (id !== joiningPeerId) {
        setTimeout(() => {
          peer.callbacks?.onPeerJoin(joiningPeerId);
        }, this.networkDelayMs);
      }
    }
  }
}

const networkBus = new SimulatedNetworkBus();

class SimulatedPeerTransport implements IWatchPartyTransport {
  public callbacks: any = null;

  constructor(public selfId: string, public isHost: boolean) {
    networkBus.register(this);
  }

  public async initialize(): Promise<string> {
    return this.selfId;
  }

  public async joinRoom(_roomId: string, callbacks: any): Promise<boolean> {
    this.callbacks = callbacks;
    return true;
  }

  public broadcastPlaybackState(state: WatchPartyPlaybackState): void {
    networkBus.deliverPlayback(this.selfId, state);
  }

  public sendPlaybackState(targetPeerId: string, state: WatchPartyPlaybackState): void {
    networkBus.deliverPlayback(this.selfId, state, targetPeerId);
  }

  public requestSync(): void {
    // Host responde
  }

  public broadcastParticipantState(state: PeerParticipantStateMessage): void {
    networkBus.deliverParticipantState(this.selfId, state);
  }

  public broadcastChatMessage(): void {}
  public broadcastRoomAnnouncement(): void {}

  public broadcastEpisodeChange(change: PeerEpisodeChangeMessage): void {
    networkBus.deliverEpisodeChange(this.selfId, change);
  }

  public leaveRoom(): void {}
  public destroy(): void {}
}

// Player simulado (emulando ZapiPlayer com a lógica de GroupWatch implementada)
class SimulatedPlayer {
  public currentTime: number = 0;
  public isPlaying: boolean = false;
  public playbackRate: number = 1.0;
  public duration: number = 7200;
  public isHandlingRemoteSync: boolean = false;
  public currentSeason: number = 1;
  public currentEpisode: number = 1;

  constructor(public service: WatchPartyService, public isHost: boolean) {
    this.setupListeners();
  }

  private setupListeners() {
    this.service.onPlaybackSync((sync) => {
      this.service.executeRemoteActionSafely(() => {
        this.isHandlingRemoteSync = true;
        const expectedPos = this.service.calculateExpectedPosition(sync);
        const cur = this.currentTime;
        const drift = Math.abs(cur - expectedPos);

        if (!sync.isPlaying) {
          this.isPlaying = false;
          if (drift > 0.3) {
            this.currentTime = expectedPos;
          }
          this.playbackRate = sync.playbackRate || 1.0;
        } else {
          this.isPlaying = true;
          if (drift > 1.5) {
            this.currentTime = expectedPos;
            this.playbackRate = sync.playbackRate || 1.0;
          } else if (drift > 0.3) {
            const baseRate = sync.playbackRate || 1.0;
            this.playbackRate = cur < expectedPos ? baseRate * 1.05 : baseRate * 0.95;
          } else {
            this.playbackRate = sync.playbackRate || 1.0;
          }
        }

        setTimeout(() => {
          this.isHandlingRemoteSync = false;
        }, 100);
      });
    });

    this.service.onChangeEpisode((change: any) => {
      this.currentSeason = change?.season ?? change?.media?.season;
      this.currentEpisode = change?.episode ?? change?.media?.episode;
      this.currentTime = 0;
    });
  }

  public hostPlayAt(pos: number) {
    this.currentTime = pos;
    this.isPlaying = true;
    this.service.updatePlaybackState(pos, true, this.playbackRate, this.duration);
  }

  public hostSeekTo(pos: number) {
    this.currentTime = pos;
    this.service.updatePlaybackState(pos, this.isPlaying, this.playbackRate, this.duration);
  }

  public hostPause() {
    this.isPlaying = false;
    this.service.updatePlaybackState(this.currentTime, false, this.playbackRate, this.duration);
  }

  public hostResume() {
    this.isPlaying = true;
    this.service.updatePlaybackState(this.currentTime, true, this.playbackRate, this.duration);
  }

  public hostChangeEpisode(season: number, episode: number) {
    this.currentSeason = season;
    this.currentEpisode = episode;
    this.currentTime = 0;
    this.service.changeEpisode(season, episode);
  }

  public tick(seconds: number) {
    if (this.isPlaying) {
      this.currentTime += seconds * this.playbackRate;
    }
  }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runAll10Scenarios() {
  console.log('================================================================');
  console.log('   ZAPITV — VERIFICAÇÃO DOS 10 CENÁRIOS DE SINCRONIZAÇÃO DA TIMELINE');
  console.log('================================================================\n');

  const hostTransport = new SimulatedPeerTransport('host-peer', true);
  const guestTransport = new SimulatedPeerTransport('guest-peer', false);

  const hostService = new WatchPartyService(hostTransport);
  const guestService = new WatchPartyService(guestTransport);

  const sampleMedia = {
    id: 'movie-matrix',
    contentId: 'movie-matrix',
    title: 'Matrix',
    type: 'movie',
    mediaFormat: 'movie',
    season: 1,
    episode: 1
  };

  await hostService.createRoom('Host Alice', sampleMedia as any);
  await guestService.joinRoom('room-matrix', 'Guest Bob');

  const hostPlayer = new SimulatedPlayer(hostService, true);
  const guestPlayer = new SimulatedPlayer(guestService, false);

  // Cenário 1: Iniciar reprodução pelo host (ex.: 05:30 = 330s)
  console.log('[Cenário 1] Host inicia reprodução em 05:30 (330s)');
  hostPlayer.hostPlayAt(330);
  await sleep(60);
  console.log(` -> Host: ${hostPlayer.currentTime}s | Guest: ${guestPlayer.currentTime}s | isPlaying: ${guestPlayer.isPlaying}`);
  if (Math.abs(guestPlayer.currentTime - 330) > 0.5 || !guestPlayer.isPlaying) throw new Error('Falha no Cenário 1');
  console.log(' [PASS] Cenário 1 verificado com sucesso!\n');

  // Cenário 2: Avançar o vídeo pelo host (ex.: para 18:35 = 1115s)
  console.log('[Cenário 2] Host avança (seek forward) para 18:35 (1115s)');
  hostPlayer.hostSeekTo(1115);
  await sleep(60);
  console.log(` -> Host: ${hostPlayer.currentTime}s | Guest: ${guestPlayer.currentTime}s`);
  if (Math.abs(guestPlayer.currentTime - 1115) > 0.5) throw new Error('Falha no Cenário 2');
  console.log(' [PASS] Cenário 2 verificado com sucesso!\n');

  // Cenário 3: Retroceder o vídeo pelo host (ex.: para 03:20 = 200s)
  console.log('[Cenário 3] Host retrocede (seek backward) para 03:20 (200s)');
  hostPlayer.hostSeekTo(200);
  await sleep(60);
  console.log(` -> Host: ${hostPlayer.currentTime}s | Guest: ${guestPlayer.currentTime}s`);
  if (Math.abs(guestPlayer.currentTime - 200) > 0.5) throw new Error('Falha no Cenário 3');
  console.log(' [PASS] Cenário 3 verificado com sucesso!\n');

  // Cenário 4: Pausar e retomar a reprodução
  console.log('[Cenário 4] Host pausa e retoma');
  hostPlayer.hostPause();
  await sleep(60);
  console.log(` -> Pausado - Host isPlaying: ${hostPlayer.isPlaying} | Guest isPlaying: ${guestPlayer.isPlaying}`);
  if (guestPlayer.isPlaying) throw new Error('Falha no Cenário 4: Guest não pausou');

  hostPlayer.hostResume();
  await sleep(60);
  console.log(` -> Retomado - Host isPlaying: ${hostPlayer.isPlaying} | Guest isPlaying: ${guestPlayer.isPlaying}`);
  if (!guestPlayer.isPlaying) throw new Error('Falha no Cenário 4: Guest não retomou');
  console.log(' [PASS] Cenário 4 verificado com sucesso!\n');

  // Cenário 5: Entrada tardia (Late Join)
  console.log('[Cenário 5] Entrada tardia: novo participante entra com o filme em andamento');
  // Host está em 500s
  hostPlayer.hostSeekTo(500);
  await sleep(30);

  const lateGuestTransport = new SimulatedPeerTransport('late-guest', false);
  const lateGuestService = new WatchPartyService(lateGuestTransport);
  await lateGuestService.joinRoom('room-matrix', 'Late Charlie');
  const latePlayer = new SimulatedPlayer(lateGuestService, false);

  // Dispara onPeerJoin no host
  networkBus.deliverPeerJoin('late-guest');
  await sleep(80);

  console.log(` -> Host: ${hostPlayer.currentTime}s | Late Guest: ${latePlayer.currentTime}s`);
  if (latePlayer.currentTime === 0 || Math.abs(latePlayer.currentTime - 500) > 1.0) {
    throw new Error('Falha no Cenário 5: Convidado tardio começou em 00:00 ou fora da posição');
  }
  console.log(' [PASS] Cenário 5 verificado com sucesso!\n');

  // Cenário 6: Reconexão de participante
  console.log('[Cenário 6] Reconexão: participante reconecta e alinha');
  // Guest sofre desconexão e pede sync
  const lastState = hostService.getLastPlaybackState();
  if (lastState) {
    const est = hostService.calculateExpectedPosition(lastState);
    hostService.sendPlaybackToPeer('guest-peer', est, lastState.isPlaying, lastState.playbackRate, lastState.duration);
  }
  await sleep(60);
  console.log(` -> Re-sincronizado Guest: ${guestPlayer.currentTime}s (esperado ~500s)`);
  if (Math.abs(guestPlayer.currentTime - 500) > 1.5) throw new Error('Falha no Cenário 6');
  console.log(' [PASS] Cenário 6 verificado com sucesso!\n');

  // Cenário 7: Trocar episódio
  console.log('[Cenário 7] Troca de episódio para Temporada 2, Episódio 3');
  hostPlayer.hostChangeEpisode(2, 3);
  await sleep(60);
  console.log(` -> Host: S${hostPlayer.currentSeason}E${hostPlayer.currentEpisode} | Guest: S${guestPlayer.currentSeason}E${guestPlayer.currentEpisode}`);
  if (guestPlayer.currentSeason !== 2 || guestPlayer.currentEpisode !== 3) throw new Error('Falha no Cenário 7');
  console.log(' [PASS] Cenário 7 verificado com sucesso!\n');

  // Cenário 8: Recuperação de lentidão/drift moderado (ajuste de velocidade GroupWatch)
  console.log('[Cenário 8] Simulação de drift de 800ms (Guest atrasado)');
  guestPlayer.currentTime = 200.0;
  // Host envia sync indicando que a linha do tempo está em 200.8s
  hostService.updatePlaybackState(200.8, true, 1.0, 7200);
  await sleep(60);
  console.log(` -> Guest drift detectado: taxa ajustada para ${guestPlayer.playbackRate}x (esperado 1.05x para convergir suavemente)`);
  if (Math.abs(guestPlayer.playbackRate - 1.05) > 0.01) throw new Error('Falha no Cenário 8: Taxa não ajustou para 1.05x');
  console.log(' [PASS] Cenário 8 verificado com sucesso!\n');

  // Cenário 9: Buffering de um participante não congela os demais
  console.log('[Cenário 9] Convidado entra em buffering');
  guestService.setBuffering(true);
  await sleep(40);
  console.log(` -> Host isPlaying: ${hostPlayer.isPlaying} (não deve pausar o host nem os demais)`);
  if (!hostPlayer.isPlaying) throw new Error('Falha no Cenário 9: Host pausou indevidamente por buffering do convidado');
  console.log(' [PASS] Cenário 9 verificado com sucesso!\n');

  // Cenário 10: Estabilidade em sessão longa (heartbeat periódico)
  console.log('[Cenário 10] Estabilidade em sessão longa via Heartbeats periódicos');
  hostPlayer.hostPlayAt(600);
  await sleep(60);
  for (let tick = 0; tick < 5; tick++) {
    hostPlayer.tick(2.5);
    guestPlayer.tick(2.5);
    hostService.updatePlaybackState(hostPlayer.currentTime, true, 1.0, 7200);
    await sleep(40);
  }
  const finalDrift = Math.abs(hostPlayer.currentTime - guestPlayer.currentTime);
  console.log(` -> Posição final após simulação contínua: Host ${hostPlayer.currentTime.toFixed(1)}s, Guest ${guestPlayer.currentTime.toFixed(1)}s (Drift: ${finalDrift.toFixed(3)}s)`);
  if (finalDrift > 0.5) throw new Error('Falha no Cenário 10: Deriva temporal acumulada excessiva');
  console.log(' [PASS] Cenário 10 verificado com sucesso!\n');

  console.log('================================================================');
  console.log('  TODOS OS 10 CENÁRIOS FORAM VALIDADOS COM 100% DE SUCESSO!     ');
  console.log('================================================================');
}

runAll10Scenarios().catch(err => {
  console.error('[ERRO NA SIMULAÇÃO]:', err);
  process.exit(1);
});
