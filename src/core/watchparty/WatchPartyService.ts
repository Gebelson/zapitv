/**
 * ZapiTV — WatchPartyService
 * 
 * Gerencia o ciclo de vida completo da Watch Party:
 * - Criação e entrada em salas com IDs de alta entropia.
 * - Sincronização temporal de alta precisão (Play, Pause, Seek, Rate) com compensação de latência.
 * - Prevenção absoluta de loops de eventos e descarte de sequências desatualizadas.
 * - Chat textual sanitizado em tempo real.
 * - Sistema completo de Voz P2P WebRTC (com VAD / detecção de fala em tempo real, cancelamento de eco,
 *   supressão de ruído, controle automático de ganho, volume individual e mute local por participante).
 * - Gerenciamento de participantes (máximo 6) e status do anfitrião.
 */

import { IWatchPartyTransport } from './IWatchPartyTransport';
import { TrysteroTransport } from './TrysteroTransport';
import {
  WatchPartyRoomInfo,
  WatchPartyParticipant,
  WatchPartyPlaybackState,
  WatchPartyChatMessage,
  WatchPartyMediaMetadata,
  PeerParticipantStateMessage,
  PeerEpisodeChangeMessage,
  PeerRoomAnnounceMessage,
  RoomLifecycleState,
  ParticipantPermissions,
  WatchPartyPermissions,
  PeerStartTransmissionMessage,
  PeerPermissionsUpdateMessage,
  PeerAdminMuteMessage,
  PeerHostTransferMessage,
  PeerRemoteControlRequestMessage,
  TransmissionMode,
  HostBroadcastStatus
} from './watchPartyTypes';

export type WatchPartyEventListener = (event: string, data?: any) => void;

export class WatchPartyService {
  private static instance: WatchPartyService;

  private transport: IWatchPartyTransport;
  private currentRoom: WatchPartyRoomInfo | null = null;
  private localNickname: string = 'Espectador';
  private participants: Map<string, WatchPartyParticipant> = new Map();
  private chatMessages: WatchPartyChatMessage[] = [];
  private listeners: Set<WatchPartyEventListener> = new Set();

  // Ciclo de Vida da Sala & Permissões
  private lifecycleState: RoomLifecycleState = 'LOBBY';
  private permissions: WatchPartyPermissions = {
    allowChat: true,
    allowVoice: true,
    participantPermissions: {}
  };

  // Estado de Reprodução
  private lastKnownSequence: number = 0;
  private isApplyingRemoteAction: boolean = false;
  private hostGraceTimer: any = null;
  private pingInterval: any = null;
  private latestPlaybackState: WatchPartyPlaybackState | null = null;
  private heartbeatInterval: any = null;
  private lastSignalTimestamp: number = 0;

  // Voz em Tempo Real & Detecção de Atividade de Voz (VAD)
  private localAudioStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private remoteScreenStream: MediaStream | null = null;
  private screenSharedPeers: Set<string> = new Set();
  private hostBroadcastCaptureMethod: 'captureStream' | 'getDisplayMedia' | null = null;
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalysers: Map<string, AnalyserNode> = new Map();
  private participantVolumes: Map<string, number> = new Map();
  private localMutedPeers: Set<string> = new Set();
  private vadInterval: any = null;
  private speakingDecayTimers: Map<string, any> = new Map();
  private isSpeakingLocal: boolean = false;

  private constructor(transport?: IWatchPartyTransport) {
    this.transport = transport || new TrysteroTransport();
    this.setupNetworkReconnectionListeners();
  }

  public static getInstance(): WatchPartyService {
    if (!WatchPartyService.instance) {
      WatchPartyService.instance = new WatchPartyService();
    }
    return WatchPartyService.instance;
  }

  /**
   * Gera um código de sala aleatório de alta entropia
   */
  public generateSecureRoomId(): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `zapi-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    }
    return `zapi-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  public get isConnected(): boolean {
    return Boolean(this.currentRoom !== null);
  }

  public isHost(): boolean {
    return Boolean(this.transport.isHost);
  }

  public isHostRole(): boolean {
    return Boolean(this.transport.isHost);
  }

  public get selfId(): string {
    return this.transport.selfId;
  }

  public get roomInfo(): WatchPartyRoomInfo | null {
    return this.currentRoom;
  }

  public get currentNickname(): string {
    return this.localNickname;
  }

  public getParticipantList(): (WatchPartyParticipant & { id: string })[] {
    return Array.from(this.participants.values()).map(p => ({
      ...p,
      id: p.peerId
    }));
  }

  public getChatHistory(): WatchPartyChatMessage[] {
    return [...this.chatMessages];
  }

  /**
   * Normaliza os metadados de mídia para garantir identidade canônica imutável
   */
  public static normalizeMedia(raw: any): WatchPartyMediaMetadata {
    if (!raw) {
      return {
        id: 'filme',
        contentId: 'filme',
        title: 'Watch Party',
        type: 'movie',
        season: 1,
        seasonNumber: 1,
        episode: 1,
        episodeNumber: 1
      };
    }
    const id = String(raw.id || raw.contentId || '').trim();
    const title = String(raw.title || 'Conteúdo ZapiTV').trim();
    const type = raw.type || 'movie';
    const season = raw.season !== undefined ? Number(raw.season) : (raw.seasonNumber !== undefined ? Number(raw.seasonNumber) : 1);
    const episode = raw.episode !== undefined ? Number(raw.episode) : (raw.episodeNumber !== undefined ? Number(raw.episodeNumber) : 1);
    const image = raw.image || raw.posterUrl || '';
    const backdrop = raw.backdrop || raw.backdropUrl || '';
    const tmdbId = raw.tmdbId ? String(raw.tmdbId) : undefined;
    const imdbId = raw.imdbId ? String(raw.imdbId) : undefined;
    const mediaFormat = raw.mediaFormat || (type === 'movie' ? 'movie' : 'series');
    const year = raw.year ? Number(raw.year) : undefined;

    return {
      id,
      contentId: id,
      title,
      type,
      mediaFormat,
      tmdbId,
      imdbId,
      season,
      seasonNumber: season,
      episode,
      episodeNumber: episode,
      year,
      image,
      posterUrl: image,
      backdrop,
      backdropUrl: backdrop
    };
  }

  public getRoomState() {
    const list = this.getParticipantList();
    const selfP = this.participants.get(this.transport.selfId) || {
      peerId: this.transport.selfId,
      nickname: this.localNickname,
      isHost: this.transport.isHost,
      status: 'ready',
      joinedAt: Date.now(),
      isAudioMuted: !this.localAudioStream || !this.localAudioStream.getAudioTracks()[0]?.enabled,
      isSpeaking: this.isSpeakingLocal,
      permissions: this.getParticipantPermissions(this.transport.selfId)
    };

    return {
      isActive: this.isConnected,
      roomId: this.currentRoom?.roomId || '',
      mediaMetadata: this.currentRoom?.media,
      lifecycleState: this.lifecycleState,
      permissions: this.permissions,
      hostPeerId: this.currentRoom?.hostPeerId || '',
      participants: list,
      introStartTimestamp: this.currentRoom?.introStartTimestamp,
      introDuration: this.currentRoom?.introDuration,
      localParticipant: {
        ...selfP,
        id: this.transport.selfId,
        permissions: this.getParticipantPermissions(this.transport.selfId)
      }
    };
  }

  // ==========================================
  // INICIALIZAÇÃO DE SALA
  // ==========================================

  public async createRoom(
    arg1: string | WatchPartyMediaMetadata,
    arg2?: string | WatchPartyMediaMetadata,
    customRoomId?: string,
    transmissionMode: TransmissionMode = 'host_broadcast'
  ): Promise<string> {
    let rawMedia: any;
    let nickname: string;

    if (typeof arg1 === 'string') {
      nickname = arg1;
      rawMedia = arg2;
    } else {
      rawMedia = arg1;
      nickname = (arg2 as string) || 'Anfitrião';
    }

    const media = WatchPartyService.normalizeMedia(rawMedia);
    const roomId = customRoomId || this.generateSecureRoomId();
    this.localNickname = (nickname || 'Anfitrião').trim().slice(0, 24);

    this.lifecycleState = 'LOBBY';
    this.permissions = {
      allowChat: true,
      allowVoice: true,
      participantPermissions: {}
    };

    const roomInfo: WatchPartyRoomInfo = {
      roomId,
      hostPeerId: this.transport.selfId,
      hostNickname: this.localNickname,
      media,
      createdAt: Date.now(),
      maxParticipants: 6,
      lifecycleState: 'LOBBY',
      transmissionMode,
      permissions: this.permissions
    };

    this.transport.isHost = true;
    await this.connectTransport(roomId, true, roomInfo);

    this.currentRoom = roomInfo;
    this.lastKnownSequence = 0;
    this.addParticipant({
      peerId: this.transport.selfId,
      nickname: this.localNickname,
      isHost: true,
      status: 'ready',
      joinedAt: Date.now(),
      isAudioMuted: true,
      isSpeaking: false,
      audioVolume: 1.0,
      permissions: {
        canPlayPause: true,
        canSeek: true,
        canChangeEpisode: true,
        canSkip: true
      }
    });

    // Registra a presença da sala no servidor
    try {
      await fetch('/api/watchparty/room/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          hostPeerId: this.transport.selfId,
          hostNickname: this.localNickname,
          media,
          transmissionMode,
          lifecycleState: 'LOBBY'
        })
      });
    } catch (e) {
      console.warn('[WatchPartyService] Aviso: registro HTTP da sala falhou, usando apenas P2P:', e);
    }

    this.startHeartbeatLoop(roomId, true);

    this.notify('room_created', roomInfo);
    this.notify('state_changed', this.getRoomState());
    return roomId;
  }

  public async joinRoom(
    roomId: string,
    nickname: string,
    fallbackMedia?: WatchPartyMediaMetadata
  ): Promise<string> {
    const cleanRoomId = roomId.trim();
    if (!cleanRoomId) {
      throw new Error('Código de sala inválido.');
    }

    this.localNickname = (nickname || 'Amigo').trim().slice(0, 24);
    this.transport.isHost = false;

    this.lifecycleState = 'LOBBY';
    this.permissions = {
      allowChat: true,
      allowVoice: true,
      participantPermissions: {}
    };

    // 1. Consulta o estado autoritativo da sala no servidor antes de criar estado local fictício
    let serverRoom: any = null;
    try {
      const res = await fetch(`/api/watchparty/room/${encodeURIComponent(cleanRoomId)}`);
      if (res.status === 404) {
        throw new Error('Sala não encontrada ou encerrada pelo anfitrião. Verifique o link e tente novamente.');
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && data?.room) {
          serverRoom = data.room;
        }
      }
    } catch (err: any) {
      if (err.message?.includes('não encontrada')) {
        throw err;
      }
      console.warn('[WatchPartyService] Aviso: consulta ao servidor falhou, tentando P2P direto:', err);
    }

    // Se o servidor retornou os dados da sala, usamos a mídia real, o anfitrião real e o modo real
    const authoritativeMedia = serverRoom?.media
      ? WatchPartyService.normalizeMedia(serverRoom.media)
      : (fallbackMedia ? WatchPartyService.normalizeMedia(fallbackMedia) : {
          id: 'carregando',
          contentId: 'carregando',
          title: 'Aguardando sincronização da sala...',
          type: 'movie',
          season: 1,
          seasonNumber: 1,
          episode: 1,
          episodeNumber: 1
        });

    const hostPeerId = serverRoom?.hostPeerId || '';
    const hostNickname = serverRoom?.hostNickname || 'Anfitrião';
    const transmissionMode: TransmissionMode = serverRoom?.transmissionMode || 'host_broadcast';

    this.currentRoom = {
      roomId: cleanRoomId,
      hostPeerId,
      hostNickname,
      media: authoritativeMedia,
      createdAt: serverRoom?.createdAt || Date.now(),
      maxParticipants: 6,
      lifecycleState: serverRoom?.lifecycleState || 'LOBBY',
      transmissionMode,
      permissions: this.permissions
    };

    this.participants.clear();

    // Se o anfitrião já foi identificado pelo servidor, inclui-o imediatamente
    if (hostPeerId) {
      this.participants.set(hostPeerId, {
        peerId: hostPeerId,
        nickname: hostNickname,
        isHost: true,
        status: 'ready',
        joinedAt: serverRoom?.createdAt || Date.now(),
        isAudioMuted: true,
        isSpeaking: false,
        audioVolume: 1.0,
        permissions: {
          canPlayPause: true,
          canSeek: true,
          canChangeEpisode: true,
          canSkip: true
        }
      });
    }

    // Se houver outros participantes conhecidos no servidor, inclui-os
    if (serverRoom?.participants && Array.isArray(serverRoom.participants)) {
      for (const p of serverRoom.participants) {
        if (p.peerId && p.peerId !== this.transport.selfId && !this.participants.has(p.peerId)) {
          this.participants.set(p.peerId, {
            peerId: p.peerId,
            nickname: p.nickname || 'Participante',
            isHost: Boolean(p.isHost),
            status: p.status || 'ready',
            joinedAt: Date.now(),
            isAudioMuted: true,
            isSpeaking: false,
            audioVolume: 1.0,
            permissions: this.getParticipantPermissions(p.peerId)
          });
        }
      }
    }

    // Adiciona o participante local (convidado)
    this.addParticipant({
      peerId: this.transport.selfId,
      nickname: this.localNickname,
      isHost: false,
      status: 'connected',
      joinedAt: Date.now(),
      isAudioMuted: true,
      isSpeaking: false,
      audioVolume: 1.0,
      permissions: {
        canPlayPause: false,
        canSeek: false,
        canChangeEpisode: false,
        canSkip: false
      }
    });

    // 2. Conecta ao transporte P2P
    await this.connectTransport(cleanRoomId, false);

    // 3. Notifica presença e solicita handshake no servidor e P2P
    try {
      await fetch(`/api/watchparty/room/${encodeURIComponent(cleanRoomId)}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderPeerId: this.transport.selfId,
          targetPeerId: hostPeerId || undefined,
          type: 'join',
          data: {
            nickname: this.localNickname
          }
        })
      });
    } catch {}

    this.startHeartbeatLoop(cleanRoomId, false);

    setTimeout(() => {
      this.transport.requestSync();
    }, 400);

    this.notify('room_joined', this.currentRoom);
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
    return cleanRoomId;
  }

  public async leaveRoom(): Promise<void> {
    this.stopHeartbeatLoop();
    const oldRoomId = this.currentRoom?.roomId;
    const isHost = this.transport.isHost;

    if (isHost && oldRoomId) {
      try {
        fetch(`/api/watchparty/room/${encodeURIComponent(oldRoomId)}?peerId=${encodeURIComponent(this.transport.selfId)}`, {
          method: 'DELETE'
        }).catch(() => {});
      } catch {}
    }

    this.stopScreenShare();
    this.remoteScreenStream = null;
    this.notify('screen_stream_changed', null);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.hostGraceTimer) {
      clearTimeout(this.hostGraceTimer);
      this.hostGraceTimer = null;
    }

    this.stopVoiceChat();
    await this.transport.leaveRoom();

    this.currentRoom = null;
    this.participants.clear();
    this.chatMessages = [];
    this.lastKnownSequence = 0;
    this.isApplyingRemoteAction = false;
    this.lifecycleState = 'LOBBY';
    this.permissions = {
      allowChat: true,
      allowVoice: true,
      participantPermissions: {}
    };

    this.notify('room_left');
    this.notify('state_changed', this.getRoomState());
  }

  private startHeartbeatLoop(roomId: string, isHost: boolean): void {
    this.stopHeartbeatLoop();
    this.lastSignalTimestamp = Date.now();

    const doHeartbeatAndSignals = async () => {
      if (!this.currentRoom || this.currentRoom.roomId !== roomId) return;

      // 1. Heartbeat
      try {
        const hbRes = await fetch(`/api/watchparty/room/${encodeURIComponent(roomId)}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peerId: this.transport.selfId,
            nickname: this.localNickname,
            isHost,
            status: 'ready'
          })
        });

        if (hbRes.ok) {
          const hbData = await hbRes.json();
          if (hbData?.room?.participants && Array.isArray(hbData.room.participants)) {
            let participantsChanged = false;
            for (const sp of hbData.room.participants) {
              if (sp.peerId === this.transport.selfId) continue;
              const existing = this.participants.get(sp.peerId);
              if (!existing) {
                this.participants.set(sp.peerId, {
                  peerId: sp.peerId,
                  nickname: sp.nickname || (sp.isHost ? (hbData.room.hostNickname || 'Anfitrião') : 'Convidado'),
                  isHost: Boolean(sp.isHost),
                  status: sp.status || 'ready',
                  joinedAt: Date.now(),
                  isAudioMuted: true,
                  isSpeaking: false,
                  audioVolume: 1.0,
                  permissions: this.getParticipantPermissions(sp.peerId)
                });
                participantsChanged = true;
              } else {
                if (sp.nickname && existing.nickname !== sp.nickname) {
                  existing.nickname = sp.nickname;
                  participantsChanged = true;
                }
                if (existing.isHost !== Boolean(sp.isHost)) {
                  existing.isHost = Boolean(sp.isHost);
                  participantsChanged = true;
                }
              }
            }

            // Se for convidado e o anfitrião atualizou a mídia ou o modo de transmissão
            if (!isHost && hbData.room) {
              if (hbData.room.media && this.currentRoom) {
                const norm = WatchPartyService.normalizeMedia(hbData.room.media);
                if (this.currentRoom.media.title !== norm.title || this.currentRoom.media.id !== norm.id) {
                  this.currentRoom.media = norm;
                  participantsChanged = true;
                }
              }
              if (hbData.room.transmissionMode && this.currentRoom.transmissionMode !== hbData.room.transmissionMode) {
                this.currentRoom.transmissionMode = hbData.room.transmissionMode;
                participantsChanged = true;
              }
              if (hbData.room.hostPeerId && (!this.currentRoom.hostPeerId || this.currentRoom.hostPeerId !== hbData.room.hostPeerId)) {
                this.currentRoom.hostPeerId = hbData.room.hostPeerId;
                this.currentRoom.hostNickname = hbData.room.hostNickname;
                participantsChanged = true;
              }
            }

            if (participantsChanged) {
              this.notify('participants_updated', this.getParticipantList());
              this.notify('state_changed', this.getRoomState());
            }
          }
        }
      } catch {}

      // 2. Poll de sinais pendentes
      try {
        const sigRes = await fetch(`/api/watchparty/room/${encodeURIComponent(roomId)}/signals/${encodeURIComponent(this.transport.selfId)}?since=${this.lastSignalTimestamp}`);
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          if (sigData?.signals && Array.isArray(sigData.signals) && sigData.signals.length > 0) {
            this.lastSignalTimestamp = sigData.now || Date.now();
            for (const sig of sigData.signals) {
              this.handleFallbackSignal(sig);
            }
          }
        }
      } catch {}
    };

    setTimeout(doHeartbeatAndSignals, 400);
    this.heartbeatInterval = setInterval(doHeartbeatAndSignals, 3000);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleFallbackSignal(sig: any): void {
    if (!sig || !sig.type) return;

    if (sig.type === 'join' && this.transport.isHost && this.currentRoom) {
      const peerId = sig.senderPeerId;
      const nickname = sig.data?.nickname || 'Convidado';
      if (!this.participants.has(peerId)) {
        this.participants.set(peerId, {
          peerId,
          nickname,
          isHost: false,
          status: 'ready',
          joinedAt: Date.now(),
          isAudioMuted: true,
          isSpeaking: false,
          audioVolume: 1.0,
          permissions: this.getParticipantPermissions(peerId)
        });
        this.notify('peer_connected', peerId);
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      }
      this.transport.broadcastRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: this.currentRoom
      });
      fetch(`/api/watchparty/room/${encodeURIComponent(this.currentRoom.roomId)}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderPeerId: this.transport.selfId,
          targetPeerId: peerId,
          type: 'announce',
          data: { roomInfo: this.currentRoom }
        })
      }).catch(() => {});
    } else if (sig.type === 'announce' && !this.transport.isHost) {
      const roomInfo = sig.data?.roomInfo;
      if (roomInfo && this.currentRoom) {
        this.currentRoom = {
          ...this.currentRoom,
          ...roomInfo,
          media: WatchPartyService.normalizeMedia(roomInfo.media),
          hostPeerId: roomInfo.hostPeerId || sig.senderPeerId,
          hostNickname: roomInfo.hostNickname || 'Anfitrião',
          transmissionMode: roomInfo.transmissionMode || this.currentRoom.transmissionMode
        };
        const hostP = this.participants.get(this.currentRoom.hostPeerId);
        if (hostP) {
          hostP.isHost = true;
          if (roomInfo.hostNickname) hostP.nickname = roomInfo.hostNickname;
        } else if (this.currentRoom.hostPeerId) {
          this.participants.set(this.currentRoom.hostPeerId, {
            peerId: this.currentRoom.hostPeerId,
            nickname: roomInfo.hostNickname || 'Anfitrião',
            isHost: true,
            status: 'ready',
            joinedAt: Date.now(),
            isAudioMuted: true,
            isSpeaking: false,
            audioVolume: 1.0,
            permissions: { canPlayPause: true, canSeek: true, canChangeEpisode: true, canSkip: true }
          });
        }
        this.notify('room_announced', this.currentRoom);
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      }
    }
  }

  // ==========================================
  // PROTOCOLO & TRANSPORTE P2P
  // ==========================================

  private async connectTransport(roomId: string, isHost: boolean, initialInfo?: WatchPartyRoomInfo): Promise<void> {
    await this.transport.joinRoom(roomId, {
      onPeerJoin: (peerId) => {
        if (this.participants.size >= 6) {
          console.warn('[WatchParty] Limite de 6 participantes atingido.');
        }

        if (!this.participants.has(peerId)) {
          this.participants.set(peerId, {
            peerId,
            nickname: 'Convidado',
            isHost: false,
            status: 'connected',
            joinedAt: Date.now(),
            isAudioMuted: true,
            isSpeaking: false,
            audioVolume: 1.0,
            isLocallyMuted: false
          });
        }

        if (this.transport.isHost && this.currentRoom) {
          this.transport.broadcastRoomAnnouncement({
            type: 'room_announcement',
            roomInfo: this.currentRoom
          });
        }

        this.transport.broadcastParticipantState({
          type: 'participant_state',
          nickname: this.localNickname,
          status: 'ready',
          isAudioMuted: !this.localAudioStream || !this.localAudioStream.getAudioTracks()[0]?.enabled,
          isSpeaking: this.isSpeakingLocal
        });

        // Se o microfone local já estiver ativo, compartilha a stream de áudio com o novo peer
        if (this.localAudioStream && this.transport.addLocalAudioStream) {
          this.transport.addLocalAudioStream(this.localAudioStream);
        }
        if (this.localScreenStream && this.transport.addLocalMediaStream && !this.screenSharedPeers.has(peerId)) {
          this.transport.addLocalMediaStream(this.localScreenStream, peerId);
          this.screenSharedPeers.add(peerId);
        }

        this.notify('peer_connected', peerId);
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());

        // Se somos o anfitrião, anuncia a sala e envia imediatamente a posição atual ao novo participante
        if (this.transport.isHost && this.currentRoom) {
          this.transport.broadcastRoomAnnouncement({
            type: 'room_announcement',
            roomInfo: this.currentRoom
          });
          if (this.latestPlaybackState) {
            const currentEstTime = this.calculateExpectedPosition(this.latestPlaybackState);
            this.sendPlaybackToPeer(
              peerId,
              currentEstTime,
              this.latestPlaybackState.isPlaying,
              this.latestPlaybackState.playbackRate,
              this.latestPlaybackState.duration
            );
          }
        }
      },

      onPeerLeave: (peerId) => {
        const leaving = this.participants.get(peerId);
        this.screenSharedPeers.delete(peerId);
        if (leaving?.isHost && this.remoteScreenStream) {
          this.remoteScreenStream = null;
          this.notify('screen_stream_changed', null);
        }
        this.participants.delete(peerId);

        if (leaving?.isHost) {
          this.handleHostDisconnected();
        }

        const audio = this.remoteAudioElements.get(peerId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          this.remoteAudioElements.delete(peerId);
        }
        this.remoteAnalysers.delete(peerId);
        if (this.speakingDecayTimers.has(peerId)) {
          clearTimeout(this.speakingDecayTimers.get(peerId));
          this.speakingDecayTimers.delete(peerId);
        }

        this.notify('peer_disconnected', { peerId, nickname: leaving?.nickname });
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      },

      onPlaybackSync: (state, senderId) => {
        const isFromHost = Boolean(this.currentRoom && (senderId === this.currentRoom.hostPeerId || !this.currentRoom.hostPeerId));
        const hasPermission = this.canPeerControl(senderId, 'canPlayPause') || this.canPeerControl(senderId, 'canSeek');

        if (!isFromHost && !hasPermission) {
          console.warn(`[WatchParty] Comando de reprodução ignorado de peer sem autorização: ${senderId}`);
          return;
        }

        if (this.currentRoom && !this.currentRoom.hostPeerId) {
          this.currentRoom.hostPeerId = senderId;
          const participant = this.participants.get(senderId);
          if (participant) participant.isHost = true;
        }

        if (state.sequence <= this.lastKnownSequence) {
          return;
        }
        this.lastKnownSequence = state.sequence;

        // Normalização de campos garantindo compatibilidade total (positionSeconds e currentTime)
        const normPos = typeof state.positionSeconds === 'number'
          ? state.positionSeconds
          : (typeof state.currentTime === 'number' ? state.currentTime : 0);

        const normalizedState: WatchPartyPlaybackState = {
          ...state,
          positionSeconds: normPos,
          currentTime: normPos,
          playbackRate: state.playbackRate || 1.0,
          eventTimestamp: state.eventTimestamp || Date.now(),
          referenceTimestamp: state.referenceTimestamp || state.eventTimestamp || Date.now()
        };

        this.latestPlaybackState = normalizedState;
        this.notify('playback_sync', normalizedState);
      },

      onRequestSync: (senderId) => {
        if (this.transport.isHost && this.currentRoom) {
          this.transport.broadcastRoomAnnouncement({
            type: 'room_announcement',
            roomInfo: this.currentRoom
          });
          if (this.latestPlaybackState) {
            const currentEstTime = this.calculateExpectedPosition(this.latestPlaybackState);
            this.sendPlaybackToPeer(
              senderId,
              currentEstTime,
              this.latestPlaybackState.isPlaying,
              this.latestPlaybackState.playbackRate,
              this.latestPlaybackState.duration
            );
          }
          this.notify('host_sync_requested', senderId);
          if (this.localScreenStream && this.transport.addLocalMediaStream && !this.screenSharedPeers.has(senderId)) {
            this.transport.addLocalMediaStream(this.localScreenStream, senderId);
            this.screenSharedPeers.add(senderId);
          }
        }
      },

      onParticipantState: (state, senderId) => {
        const isHostPeer = Boolean(this.currentRoom && this.currentRoom.hostPeerId === senderId);
        const existing = this.participants.get(senderId);

        if (existing) {
          if (state.nickname) existing.nickname = state.nickname;
          existing.status = state.status;
          if (state.isAudioMuted !== undefined) existing.isAudioMuted = state.isAudioMuted;
          if (state.isSpeaking !== undefined) existing.isSpeaking = state.isSpeaking;
          if (state.isAdminMuted !== undefined) existing.isAdminMuted = state.isAdminMuted;
        } else {
          this.participants.set(senderId, {
            peerId: senderId,
            nickname: state.nickname || 'Convidado',
            isHost: isHostPeer,
            status: state.status,
            joinedAt: Date.now(),
            isAudioMuted: state.isAudioMuted,
            isSpeaking: state.isSpeaking,
            isAdminMuted: state.isAdminMuted,
            audioVolume: this.participantVolumes.get(senderId) ?? 1.0,
            isLocallyMuted: this.localMutedPeers.has(senderId),
            permissions: this.getParticipantPermissions(senderId)
          });
        }

        if (state.status === 'buffering') {
          this.notify('buffering_changed', { peerId: senderId, isBuffering: true });
        } else {
          this.notify('buffering_changed', { peerId: senderId, isBuffering: false });
        }

        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      },

      onChatMessage: (message, senderId) => {
        if (!message || typeof message.text !== 'string' || !message.text.trim() ||
            this.chatMessages.some(existing => existing.id === message.id)) return;
        const sender = this.participants.get(senderId);
        if (!this.permissions.allowChat && !sender?.isHost) {
          return;
        }

        const cleanMsg: WatchPartyChatMessage = {
          id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId,
          senderNickname: String(sender?.nickname || message.senderNickname || 'Convidado').slice(0, 24),
          isHost: Boolean(sender?.isHost),
          text: message.text.trim().slice(0, 280),
          timestamp: message.timestamp || Date.now()
        };

        this.chatMessages.push(cleanMsg);
        if (this.chatMessages.length > 200) {
          this.chatMessages.shift();
        }
        this.notify('chat_message', cleanMsg);
      },

      onEpisodeChange: (change, senderId) => {
        const isFromHost = Boolean(this.currentRoom && (senderId === this.currentRoom.hostPeerId || !this.currentRoom.hostPeerId));
        const hasPermission = this.canPeerControl(senderId, 'canChangeEpisode');

        if (!isFromHost && !hasPermission) {
          console.warn(`[WatchParty] Troca de episódio rejeitada de peer sem autorização: ${senderId}`);
          return;
        }

        if (change.sequence <= this.lastKnownSequence) return;
        this.lastKnownSequence = change.sequence;

        if (this.currentRoom) {
          this.currentRoom.media = WatchPartyService.normalizeMedia(change.media);
        }
        this.notify('episode_changed', change);
        this.notify('state_changed', this.getRoomState());
      },

      onRoomAnnouncement: (announcement, senderId) => {
        if (!this.transport.isHost && announcement.roomInfo) {
          const rawInfo = announcement.roomInfo;
          const media = WatchPartyService.normalizeMedia(rawInfo.media);

          this.currentRoom = {
            ...rawInfo,
            media,
            hostPeerId: rawInfo.hostPeerId || senderId,
            lifecycleState: rawInfo.lifecycleState || 'LOBBY',
            permissions: rawInfo.permissions || {
              allowChat: true,
              allowVoice: true,
              participantPermissions: {}
            }
          };

          this.lifecycleState = this.currentRoom.lifecycleState;
          this.permissions = this.currentRoom.permissions;

          const hostP = this.participants.get(this.currentRoom.hostPeerId);
          if (hostP) {
            hostP.isHost = true;
            if (rawInfo.hostNickname) hostP.nickname = rawInfo.hostNickname;
          }

          // Atualiza permissões dos participantes
          this.participants.forEach((p, peerId) => {
            p.permissions = this.getParticipantPermissions(peerId);
          });

          this.notify('room_announced', this.currentRoom);
          this.notify('lifecycle_changed', this.lifecycleState);
          this.notify('permissions_updated', this.permissions);
          this.notify('state_changed', this.getRoomState());

          if (
            this.lifecycleState === 'PLAYING_INTRO' ||
            this.lifecycleState === 'PLAYING_CONTENT' ||
            this.lifecycleState === 'PLAYING' ||
            this.lifecycleState === 'STARTING'
          ) {
            this.notify('transmission_started', {
              media: this.currentRoom.media,
              mode: this.currentRoom.transmissionMode || 'source',
              lifecycleState: this.lifecycleState,
              startTimestamp: this.currentRoom.introStartTimestamp,
              introDuration: this.currentRoom.introDuration
            });
          }
        }
      },

      onStartTransmission: (message, senderId) => {
        if (this.currentRoom && this.currentRoom.hostPeerId && senderId !== this.currentRoom.hostPeerId) {
          return;
        }
        const state: RoomLifecycleState = message.lifecycleState || 'PLAYING_INTRO';
        this.lifecycleState = state;
        if (this.currentRoom) {
          this.currentRoom.lifecycleState = state;
          this.currentRoom.transmissionMode = message.mode || 'source';
          this.currentRoom.introStartTimestamp = message.introStartTimestamp || message.timestamp;
          this.currentRoom.introDuration = message.introDuration || 5.0;
          if (message.media) {
            this.currentRoom.media = WatchPartyService.normalizeMedia(message.media);
          }
        }
        this.notify('transmission_started', {
          media: this.currentRoom?.media,
          mode: message.mode || 'source',
          lifecycleState: state,
          startTimestamp: this.currentRoom?.introStartTimestamp,
          introDuration: this.currentRoom?.introDuration
        });
        this.notify('state_changed', this.getRoomState());
      },

      onPermissionsUpdate: (message, senderId) => {
        if (this.currentRoom && this.currentRoom.hostPeerId && senderId !== this.currentRoom.hostPeerId) {
          return;
        }
        if (message.permissions) {
          this.permissions = message.permissions;
          if (this.currentRoom) {
            this.currentRoom.permissions = message.permissions;
          }
          this.participants.forEach((p, peerId) => {
            p.permissions = this.getParticipantPermissions(peerId);
          });
          this.notify('permissions_updated', this.permissions);
          this.notify('participants_updated', this.getParticipantList());
          this.notify('state_changed', this.getRoomState());
        }
      },

      onAdminMute: (message, senderId) => {
        if (this.currentRoom && this.currentRoom.hostPeerId && senderId !== this.currentRoom.hostPeerId) {
          return;
        }
        if (message.targetPeerId === this.transport.selfId) {
          if (message.isMuted) {
            if (this.localAudioStream) {
              const track = this.localAudioStream.getAudioTracks()[0];
              if (track) track.enabled = false;
            }
            this.setLocalSpeaking(false);
            const selfP = this.participants.get(this.transport.selfId);
            if (selfP) {
              selfP.isAudioMuted = true;
              selfP.isAdminMuted = true;
            }
            this.notify('voice_state_changed', { isVoiceActive: this.isVoiceActive(), isMuted: true });
            this.notify('admin_muted', { isMuted: true });
          }
        }
        const targetP = this.participants.get(message.targetPeerId);
        if (targetP) {
          targetP.isAdminMuted = message.isMuted;
          if (message.isMuted) targetP.isAudioMuted = true;
        }
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      },

      onHostTransfer: (message, senderId) => {
        if (this.currentRoom && this.currentRoom.hostPeerId && senderId !== this.currentRoom.hostPeerId) {
          return;
        }
        const oldHost = this.participants.get(message.previousHostPeerId);
        if (oldHost) oldHost.isHost = false;
        const newHost = this.participants.get(message.newHostPeerId);
        if (newHost) newHost.isHost = true;
        if (this.currentRoom) {
          this.currentRoom.hostPeerId = message.newHostPeerId;
        }
        if (message.newHostPeerId === this.transport.selfId) {
          this.transport.isHost = true;
        } else if (message.previousHostPeerId === this.transport.selfId) {
          this.transport.isHost = false;
        }
        this.notify('host_transferred', message);
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      },

      onRemoteAudioStream: (stream, peerId) => {
        if (stream.getVideoTracks().length > 0) {
          if (!this.transport.isHost && (!this.currentRoom?.hostPeerId || this.currentRoom.hostPeerId === peerId)) {
            const audio = this.remoteAudioElements.get(peerId);
            if (audio?.srcObject === stream) {
              audio.pause();
              audio.srcObject = null;
              this.remoteAudioElements.delete(peerId);
            }
            this.remoteScreenStream = stream;
            
            // Monitora estabilidade da conexão da transmissão
            const vt = stream.getVideoTracks()[0];
            if (vt) {
              vt.onmute = () => {
                this.notify('stream_connection_changed', { status: 'poor', message: 'Conexão oscilando...' });
              };
              vt.onunmute = () => {
                this.notify('stream_connection_changed', { status: 'good', message: 'Conexão restabelecida' });
              };
            }

            this.notify('screen_stream_changed', stream);
            this.notify('host_stream_received', stream);
          }
        } else {
          this.attachRemoteAudio(peerId, stream);
        }
      },

      onRemoteControlRequest: (request, senderId) => {
        if (!this.transport.isHost) return;

        let permNeeded: keyof ParticipantPermissions = 'canPlayPause';
        if (request.action === 'seek') permNeeded = 'canSeek';
        if (request.action === 'next_episode') permNeeded = 'canChangeEpisode';

        if (!this.canPeerControl(senderId, permNeeded)) {
          console.warn(`[WatchParty] Comando remoto ${request.action} rejeitado de ${senderId}: sem permissão ${permNeeded}`);
          return;
        }

        console.log(`[WatchParty] Executando comando remoto ${request.action} autorizado para participante ${senderId}`);
        this.notify('remote_control_received', { ...request, senderId });
      }
    });
  }

  private handleHostDisconnected(): void {
    if (this.hostGraceTimer) clearTimeout(this.hostGraceTimer);
    this.notify('host_disconnected', 'O anfitrião perdeu temporariamente a conexão.');

    this.hostGraceTimer = setTimeout(() => {
      this.notify('room_closed', 'O anfitrião encerrou a sessão.');
      this.leaveRoom();
    }, 30000);
  }

  private setupNetworkReconnectionListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[WatchParty] Conexão com a rede restabelecida. Re-sincronizando participantes...');
      if (!this.currentRoom) return;

      this.transport.broadcastParticipantState({
        type: 'participant_state',
        nickname: this.localNickname,
        status: 'ready',
        isAudioMuted: !this.localAudioStream || !this.localAudioStream.getAudioTracks()[0]?.enabled,
        isSpeaking: this.isSpeakingLocal
      });

      if (this.localAudioStream && this.transport.addLocalAudioStream) {
        this.transport.addLocalAudioStream(this.localAudioStream);
      }

      if (this.transport.isHost) {
        this.transport.broadcastRoomAnnouncement({
          type: 'room_announcement',
          roomInfo: this.currentRoom
        });
      } else {
        this.transport.requestSync();
      }

      this.notify('state_changed', this.getRoomState());
    });
  }

  private addParticipant(p: WatchPartyParticipant): void {
    this.participants.set(p.peerId, p);
    this.notify('participants_updated', this.getParticipantList());
  }

  // ==========================================
  // COMANDOS DE REPRODUÇÃO (ANFITRIÃO COMANDA)
  // ==========================================

  public getLastPlaybackState(): WatchPartyPlaybackState | null {
    return this.latestPlaybackState;
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

  public broadcastHostPlayback(
    positionSeconds: number,
    isPlaying: boolean,
    playbackRate: number = 1.0,
    duration?: number
  ): void {
    if (!this.currentRoom || this.isApplyingRemoteAction) return;

    // Apenas Host ou participantes com permissão explícita podem transmitir
    const isHost = this.transport.isHost;
    const canControl = isHost || this.canLocalControl('canPlayPause') || this.canLocalControl('canSeek');
    if (!canControl) return;

    this.lastKnownSequence += 1;
    const now = Date.now();
    const safePos = Math.max(0, positionSeconds || 0);
    const state: WatchPartyPlaybackState = {
      mediaId: this.currentRoom.media.id,
      mediaType: String(this.currentRoom.media.type),
      season: this.currentRoom.media.season,
      episode: this.currentRoom.media.episode,
      positionSeconds: safePos,
      currentTime: safePos,
      isPlaying,
      playbackState: isPlaying ? 'playing' : 'paused',
      playbackRate: playbackRate || 1.0,
      eventTimestamp: now,
      referenceTimestamp: now,
      sequence: this.lastKnownSequence,
      hostPeerId: this.currentRoom.hostPeerId || this.transport.selfId,
      duration: duration || undefined,
      sessionId: this.currentRoom.roomId,
      roomId: this.currentRoom.roomId
    };

    this.latestPlaybackState = state;
    this.transport.broadcastPlaybackState(state);
  }

  public updatePlaybackState(
    positionSeconds: number,
    isPlaying: boolean,
    playbackRate: number = 1.0,
    duration?: number
  ): void {
    this.broadcastHostPlayback(positionSeconds, isPlaying, playbackRate, duration);
  }

  public setBuffering(isBuffering: boolean): void {
    this.reportLocalStatus(isBuffering ? 'buffering' : 'ready');
  }

  public sendPlaybackToPeer(
    peerId: string,
    positionSeconds: number,
    isPlaying: boolean,
    playbackRate: number = 1.0,
    duration?: number
  ): void {
    if (!this.transport.isHost || !this.currentRoom) return;

    this.lastKnownSequence += 1;
    const now = Date.now();
    const safePos = Math.max(0, positionSeconds || 0);
    const state: WatchPartyPlaybackState = {
      mediaId: this.currentRoom.media.id,
      mediaType: String(this.currentRoom.media.type),
      season: this.currentRoom.media.season,
      episode: this.currentRoom.media.episode,
      positionSeconds: safePos,
      currentTime: safePos,
      isPlaying,
      playbackState: isPlaying ? 'playing' : 'paused',
      playbackRate: playbackRate || 1.0,
      eventTimestamp: now,
      referenceTimestamp: now,
      sequence: this.lastKnownSequence,
      hostPeerId: this.transport.selfId,
      duration: duration || undefined,
      sessionId: this.currentRoom.roomId,
      roomId: this.currentRoom.roomId
    };

    this.latestPlaybackState = state;
    this.transport.sendPlaybackState(peerId, state);
  }

  public reportLocalStatus(status: 'connected' | 'buffering' | 'ready'): void {
    const selfParticipant = this.participants.get(this.transport.selfId);
    if (selfParticipant) {
      selfParticipant.status = status;
      this.notify('participants_updated', this.getParticipantList());
    }

    this.transport.broadcastParticipantState({
      type: 'participant_state',
      nickname: this.localNickname,
      status,
      isAudioMuted: !this.localAudioStream || !this.localAudioStream.getAudioTracks()[0]?.enabled,
      isSpeaking: this.isSpeakingLocal,
      isAdminMuted: selfParticipant?.isAdminMuted
    });
  }

  public changeEpisode(newMediaOrSeason: WatchPartyMediaMetadata | number, episodeNumber?: number): void {
    if (!this.currentRoom) return;

    const isHost = this.transport.isHost;
    const canControl = isHost || this.canLocalControl('canChangeEpisode');
    if (!canControl) {
      console.warn('[WatchParty] Permissão negada para troca de episódios.');
      return;
    }

    let newMedia: WatchPartyMediaMetadata;
    if (typeof newMediaOrSeason === 'number') {
      newMedia = {
        ...this.currentRoom.media,
        season: newMediaOrSeason,
        episode: episodeNumber || 1
      };
    } else {
      newMedia = WatchPartyService.normalizeMedia(newMediaOrSeason);
    }

    this.currentRoom.media = newMedia;
    this.lastKnownSequence += 1;

    this.transport.broadcastEpisodeChange({
      type: 'change_episode',
      sequence: this.lastKnownSequence,
      season: newMedia.season || 1,
      episode: newMedia.episode || 1,
      media: newMedia
    });

    this.notify('episode_changed', { media: newMedia });
    this.notify('state_changed', this.getRoomState());
  }

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

  public get isRemoteActionApplying(): boolean {
    return this.isApplyingRemoteAction;
  }

  public sendChatMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!this.permissions.allowChat && !this.transport.isHost) {
      console.warn('[WatchParty] Envio de mensagens bloqueado pelo anfitrião.');
      return;
    }

    const message: WatchPartyChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: this.transport.selfId,
      senderNickname: this.localNickname,
      isHost: this.transport.isHost,
      text: trimmed.slice(0, 280),
      timestamp: Date.now()
    };

    this.chatMessages.push(message);
    if (this.chatMessages.length > 200) {
      this.chatMessages.shift();
    }

    this.transport.sendChatMessage(message);
    this.notify('chat_message', message);
  }

  // ==========================================
  // VOZ EM TEMPO REAL COM WEBRTC & VAD (SPEECH DETECTION)
  // ==========================================

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  public isVoiceActive(): boolean {
    return Boolean(this.localAudioStream !== null);
  }

  public isMicrophoneMuted(): boolean {
    if (!this.localAudioStream) return true;
    const track = this.localAudioStream.getAudioTracks()[0];
    return !track || !track.enabled;
  }

  public async startVoiceChat(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microfone não suportado neste navegador.');
    }

    const selfP = this.participants.get(this.transport.selfId);
    if (selfP?.isAdminMuted) {
      throw new Error('Seu microfone foi silenciado pelo anfitrião da sala.');
    }

    if (!this.permissions.allowVoice && !this.transport.isHost) {
      throw new Error('O chat de voz foi desativado pelo anfitrião.');
    }

    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      if (this.transport.addLocalAudioStream) {
        this.transport.addLocalAudioStream(this.localAudioStream);
      }

      const selfP = this.participants.get(this.transport.selfId);
      if (selfP) {
        selfP.isAudioMuted = false;
        selfP.isSpeaking = false;
      }

      this.startLocalVad();

      this.transport.broadcastParticipantState({
        type: 'participant_state',
        nickname: this.localNickname,
        status: selfP?.status || 'ready',
        isAudioMuted: false,
        isSpeaking: false
      });

      this.notify('voice_state_changed', { isVoiceActive: true, isMuted: false });
      this.notify('participants_updated', this.getParticipantList());
      this.notify('state_changed', this.getRoomState());
      return true;
    } catch (err) {
      console.warn('[WatchParty] Permissão de microfone negada ou erro:', err);
      return false;
    }
  }

  public stopVoiceChat(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    this.speakingDecayTimers.forEach(t => clearTimeout(t));
    this.speakingDecayTimers.clear();

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(t => t.stop());
      if (this.transport.removeLocalAudioStream) {
        this.transport.removeLocalAudioStream(this.localAudioStream);
      }
      this.localAudioStream = null;
    }

    this.isSpeakingLocal = false;

    this.remoteAudioElements.forEach(el => {
      el.pause();
      el.srcObject = null;
    });
    this.remoteAudioElements.clear();
    this.remoteAnalysers.clear();

    const selfP = this.participants.get(this.transport.selfId);
    if (selfP) {
      selfP.isAudioMuted = true;
      selfP.isSpeaking = false;
    }

    this.transport.broadcastParticipantState({
      type: 'participant_state',
      nickname: this.localNickname,
      status: selfP?.status || 'ready',
      isAudioMuted: true,
      isSpeaking: false
    });

    this.notify('voice_state_changed', { isVoiceActive: false, isMuted: true });
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
  }

  public toggleMuteVoice(): boolean {
    if (!this.localAudioStream) return true;
    const audioTrack = this.localAudioStream.getAudioTracks()[0];
    if (!audioTrack) return true;

    audioTrack.enabled = !audioTrack.enabled;
    const isMuted = !audioTrack.enabled;

    if (isMuted) {
      this.setLocalSpeaking(false);
    }

    const selfP = this.participants.get(this.transport.selfId);
    if (selfP) {
      selfP.isAudioMuted = isMuted;
    }

    this.transport.broadcastParticipantState({
      type: 'participant_state',
      nickname: this.localNickname,
      status: 'ready',
      isAudioMuted: isMuted,
      isSpeaking: false
    });

    this.notify('voice_state_changed', { isVoiceActive: true, isMuted });
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
    return isMuted;
  }

  private startLocalVad(): void {
    if (!this.localAudioStream) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaStreamSource(this.localAudioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      this.localAnalyser = analyser;

      if (this.vadInterval) clearInterval(this.vadInterval);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      this.vadInterval = setInterval(() => {
        if (!this.localAudioStream || !this.localAnalyser) return;
        const track = this.localAudioStream.getAudioTracks()[0];
        if (!track || !track.enabled) {
          if (this.isSpeakingLocal) {
            this.setLocalSpeaking(false);
          }
          return;
        }

        this.localAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const speakingNow = avg > 14;

        if (speakingNow) {
          if (!this.isSpeakingLocal) {
            this.setLocalSpeaking(true);
          }
          if (this.speakingDecayTimers.has('local')) {
            clearTimeout(this.speakingDecayTimers.get('local'));
          }
          const timer = setTimeout(() => {
            this.setLocalSpeaking(false);
          }, 450);
          this.speakingDecayTimers.set('local', timer);
        }
      }, 70);
    } catch (e) {
      console.warn('[WatchParty] Falha ao iniciar VAD local:', e);
    }
  }

  private setLocalSpeaking(isSpeaking: boolean): void {
    if (this.isSpeakingLocal === isSpeaking) return;
    this.isSpeakingLocal = isSpeaking;

    const selfP = this.participants.get(this.transport.selfId);
    if (selfP) {
      selfP.isSpeaking = isSpeaking;
      this.notify('participants_updated', this.getParticipantList());
      this.notify('state_changed', this.getRoomState());
    }

    this.transport.broadcastParticipantState({
      type: 'participant_state',
      nickname: this.localNickname,
      status: selfP?.status || 'ready',
      isAudioMuted: selfP?.isAudioMuted,
      isSpeaking
    });
  }

  private attachRemoteAudio(peerId: string, stream: MediaStream): void {
    let audio = this.remoteAudioElements.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      (audio as any).playsInline = true;
      this.remoteAudioElements.set(peerId, audio);
    }

    audio.srcObject = stream;
    const vol = this.participantVolumes.get(peerId) ?? 1.0;
    const isLocallyMuted = this.localMutedPeers.has(peerId);
    audio.volume = isLocallyMuted ? 0 : vol;
    audio.muted = isLocallyMuted;

    audio.play().catch(e => {
      console.warn('[WatchParty] Áudio remoto aguardando gesto do usuário:', e);
      const unlockAudio = () => {
        audio?.play().catch(() => {});
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
      };
      document.addEventListener('click', unlockAudio, { once: true });
      document.addEventListener('keydown', unlockAudio, { once: true });
    });

    const ctx = this.ensureAudioContext();
    if (ctx) {
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        this.remoteAnalysers.set(peerId, analyser);

        const buf = new Uint8Array(analyser.frequencyBinCount);
        const remoteVad = setInterval(() => {
          if (!this.remoteAudioElements.has(peerId)) {
            clearInterval(remoteVad);
            return;
          }
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length;
          if (avg > 14) {
            const p = this.participants.get(peerId);
            if (p && !p.isSpeaking) {
              p.isSpeaking = true;
              this.notify('participants_updated', this.getParticipantList());
              this.notify('state_changed', this.getRoomState());
            }
            if (this.speakingDecayTimers.has(peerId)) {
              clearTimeout(this.speakingDecayTimers.get(peerId));
            }
            const timer = setTimeout(() => {
              const p = this.participants.get(peerId);
              if (p && p.isSpeaking) {
                p.isSpeaking = false;
                this.notify('participants_updated', this.getParticipantList());
                this.notify('state_changed', this.getRoomState());
              }
            }, 450);
            this.speakingDecayTimers.set(peerId, timer);
          }
        }, 100);
      } catch (e) {
        console.warn('[WatchParty] Falha ao iniciar VAD remoto:', e);
      }
    }
  }

  public setParticipantAudioVolume(peerId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.participantVolumes.set(peerId, clamped);

    const audio = this.remoteAudioElements.get(peerId);
    const isLocallyMuted = this.localMutedPeers.has(peerId);
    if (audio) {
      audio.volume = isLocallyMuted ? 0 : clamped;
    }

    const p = this.participants.get(peerId);
    if (p) {
      p.audioVolume = clamped;
    }
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
  }

  public toggleMuteParticipantLocally(peerId: string): boolean {
    if (this.localMutedPeers.has(peerId)) {
      this.localMutedPeers.delete(peerId);
    } else {
      this.localMutedPeers.add(peerId);
    }
    const isLocallyMuted = this.localMutedPeers.has(peerId);

    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      audio.muted = isLocallyMuted;
      audio.volume = isLocallyMuted ? 0 : (this.participantVolumes.get(peerId) ?? 1.0);
    }

    const p = this.participants.get(peerId);
    if (p) {
      p.isLocallyMuted = isLocallyMuted;
    }
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
    return isLocallyMuted;
  }

  public isParticipantLocallyMuted(peerId: string): boolean {
    return this.localMutedPeers.has(peerId);
  }

  // ==========================================
  // CONTROLE DE TRANSMISSÃO & MÁQUINA DE ESTADOS
  // ==========================================

  public getLifecycleState(): RoomLifecycleState {
    return this.lifecycleState;
  }

  public isHostBroadcastMode(): boolean {
    return this.currentRoom?.transmissionMode === 'host_broadcast' || this.currentRoom?.transmissionMode === 'screen';
  }

  public getTransmissionMode(): TransmissionMode {
    return this.currentRoom?.transmissionMode || 'source';
  }

  public setTransmissionMode(mode: TransmissionMode): void {
    if (this.currentRoom) {
      this.currentRoom.transmissionMode = mode;
      if (this.transport.isHost) {
        this.transport.broadcastRoomAnnouncement({
          type: 'room_announcement',
          roomInfo: this.currentRoom
        });
        fetch('/api/watchparty/room/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.currentRoom.roomId,
            hostPeerId: this.transport.selfId,
            hostNickname: this.localNickname,
            media: this.currentRoom.media,
            transmissionMode: mode,
            lifecycleState: this.lifecycleState
          })
        }).catch(() => {});
      }
      this.notify('transmission_mode_changed', mode);
      this.notify('state_changed', this.getRoomState());
    }
  }

  public async startHostBroadcast(videoEl?: HTMLVideoElement | null): Promise<MediaStream> {
    if (!this.transport.isHost || !this.currentRoom) {
      throw new Error('Apenas o anfitrião pode iniciar a transmissão da sala.');
    }

    let stream: MediaStream | null = null;
    let captureMethod: 'captureStream' | 'getDisplayMedia' = 'captureStream';

    // 1. Tentar captura direta de vídeo e áudio via captureStream() no elemento <video>
    if (videoEl) {
      try {
        const captureFn = (videoEl as any).captureStream || (videoEl as any).mozCaptureStream;
        if (typeof captureFn === 'function') {
          const directStream = captureFn.call(videoEl, 30) as MediaStream;
          if (directStream && directStream.getVideoTracks().length > 0) {
            const vt = directStream.getVideoTracks()[0];
            // Validar se o track está ativo e funcional
            if (vt && vt.readyState === 'live') {
              // Validar se tem trilha de áudio
              if (directStream.getAudioTracks().length > 0) {
                stream = directStream;
                captureMethod = 'captureStream';
              }
            }
          }
        }
      } catch (err) {
        console.warn('[WatchParty] captureStream() direto falhou (CORS ou restrição de origem), tentando fallback getDisplayMedia:', err);
      }
    }

    // 2. Se captureStream não retornou stream completo com áudio, usar getDisplayMedia
    if (!stream) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
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
        captureMethod = 'getDisplayMedia';
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          throw new Error('Compartilhamento cancelado pelo anfitrião. Para transmitir, selecione a aba e marque "Compartilhar áudio da guia".');
        }
        throw err;
      }

      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('Para transmitir com som, selecione esta aba e marque "Compartilhar áudio da guia".');
      }
    }

    if (!stream.getVideoTracks().length) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('Nenhuma faixa de vídeo encontrada na captura.');
    }

    // Configuração de qualidade e desempenho (fluidez com motion hint)
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      (videoTrack as any).contentHint = 'motion';
    }

    this.localScreenStream = stream;
    this.hostBroadcastCaptureMethod = captureMethod;
    this.screenSharedPeers.clear();

    try {
      for (const peerId of this.transport.getConnectedPeers()) {
        if (this.transport.addLocalMediaStream) {
          this.transport.addLocalMediaStream(stream, peerId);
          this.screenSharedPeers.add(peerId);
        }
      }

      videoTrack.addEventListener('ended', () => {
        this.stopHostBroadcast();
      }, { once: true });

      this.startTransmission('host_broadcast');
      this.notify('host_broadcast_started', { mode: 'host_broadcast', captureMethod, stream });
      return stream;
    } catch (err) {
      this.stopHostBroadcast();
      throw err;
    }
  }

  public stopHostBroadcast(): void {
    const stream = this.localScreenStream;
    if (!stream) return;
    this.localScreenStream = null;
    this.hostBroadcastCaptureMethod = null;
    this.screenSharedPeers.clear();
    this.transport.removeLocalMediaStream?.(stream);
    stream.getTracks().forEach(track => {
      try { track.stop(); } catch {}
    });
    this.notify('host_broadcast_stopped');
  }

  // Compatibilidade com código anterior
  public async startScreenShare(): Promise<void> {
    await this.startHostBroadcast(null);
  }

  public stopScreenShare(): void {
    this.stopHostBroadcast();
  }

  public getScreenStream(): MediaStream | null {
    return this.getHostStream();
  }

  public getHostStream(): MediaStream | null {
    return this.remoteScreenStream || this.localScreenStream;
  }

  public getBroadcastStatus(): HostBroadcastStatus {
    const stream = this.localScreenStream || this.remoteScreenStream;
    return {
      isBroadcasting: Boolean(stream && stream.active),
      mode: this.getTransmissionMode(),
      captureMethod: this.hostBroadcastCaptureMethod || undefined,
      videoTracks: stream ? stream.getVideoTracks().length : 0,
      audioTracks: stream ? stream.getAudioTracks().length : 0,
      connectionQuality: 'good'
    };
  }

  public requestScreenStream(): void {
    this.transport.requestSync();
  }

  public requestHostPlaybackAction(
    action: 'play' | 'pause' | 'seek' | 'next_episode',
    payload?: { positionSeconds?: number; season?: number; episode?: number }
  ): void {
    if (this.transport.isHost) {
      this.notify('remote_control_received', {
        type: 'remote_control_request',
        action,
        payload,
        senderPeerId: this.transport.selfId,
        senderNickname: this.localNickname,
        timestamp: Date.now()
      });
      return;
    }

    const hostId = this.currentRoom?.hostPeerId;
    if (!hostId) {
      console.warn('[WatchParty] Não foi possível solicitar ação: ID do anfitrião não identificado.');
      return;
    }

    let permNeeded: keyof ParticipantPermissions = 'canPlayPause';
    if (action === 'seek') permNeeded = 'canSeek';
    if (action === 'next_episode') permNeeded = 'canChangeEpisode';

    if (!this.canLocalControl(permNeeded)) {
      console.warn(`[WatchParty] Ação ${action} não permitida: você não possui permissão ${permNeeded}`);
      return;
    }

    const req: PeerRemoteControlRequestMessage = {
      type: 'remote_control_request',
      action,
      payload,
      senderPeerId: this.transport.selfId,
      senderNickname: this.localNickname,
      timestamp: Date.now()
    };

    if (this.transport.sendRemoteControlRequest) {
      this.transport.sendRemoteControlRequest(hostId, req);
    }
  }

  public startTransmission(mode: TransmissionMode = 'source'): void {
    if (!this.transport.isHost || !this.currentRoom) {
      console.warn('[WatchParty] Apenas o anfitrião pode iniciar a transmissão da sala.');
      return;
    }

    const startTimestamp = Date.now() + 350;
    const introDuration = 5.0;

    this.lifecycleState = 'PLAYING_INTRO';
    this.currentRoom.lifecycleState = 'PLAYING_INTRO';
    this.currentRoom.transmissionMode = mode;
    this.currentRoom.introStartTimestamp = startTimestamp;
    this.currentRoom.introDuration = introDuration;

    const msg: PeerStartTransmissionMessage = {
      type: 'start_transmission',
      hostPeerId: this.transport.selfId,
      timestamp: startTimestamp,
      media: this.currentRoom.media,
      mode,
      lifecycleState: 'PLAYING_INTRO',
      introStartTimestamp: startTimestamp,
      introDuration
    };

    if (this.transport.broadcastStartTransmission) {
      this.transport.broadcastStartTransmission(msg);
    }

    this.transport.broadcastRoomAnnouncement({
      type: 'room_announcement',
      roomInfo: this.currentRoom
    });

    this.notify('transmission_started', {
      media: this.currentRoom.media,
      mode,
      lifecycleState: 'PLAYING_INTRO',
      startTimestamp,
      introDuration
    });
    this.notify('state_changed', this.getRoomState());
  }

  public setLifecycleState(state: RoomLifecycleState): void {
    this.lifecycleState = state;
    if (this.currentRoom) {
      this.currentRoom.lifecycleState = state;
    }
    if (this.transport.isHost && this.currentRoom) {
      this.transport.broadcastRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: this.currentRoom
      });
    }
    this.notify('lifecycle_changed', state);
    this.notify('state_changed', this.getRoomState());
  }

  // ==========================================
  // GESTÃO DE PERMISSÕES DA SALA (ANFITRIÃO)
  // ==========================================

  public getPermissions(): WatchPartyPermissions {
    return { ...this.permissions };
  }

  public getParticipantPermissions(peerId: string): ParticipantPermissions {
    if (this.currentRoom && peerId === this.currentRoom.hostPeerId) {
      return {
        canPlayPause: true,
        canSeek: true,
        canChangeEpisode: true,
        canSkip: true
      };
    }
    return this.permissions.participantPermissions[peerId] || {
      canPlayPause: false,
      canSeek: false,
      canChangeEpisode: false,
      canSkip: false
    };
  }

  public canLocalControl(perm: keyof ParticipantPermissions): boolean {
    if (this.transport.isHost) return true;
    return Boolean(this.getParticipantPermissions(this.transport.selfId)[perm]);
  }

  public canPeerControl(peerId: string, perm: keyof ParticipantPermissions): boolean {
    if (this.currentRoom && peerId === this.currentRoom.hostPeerId) return true;
    return Boolean(this.getParticipantPermissions(peerId)[perm]);
  }

  public setParticipantPermission(peerId: string, permission: keyof ParticipantPermissions, value: boolean): void {
    if (!this.transport.isHost) {
      console.warn('[WatchParty] Apenas o anfitrião pode alterar permissões de participantes.');
      return;
    }

    const current = this.getParticipantPermissions(peerId);
    this.permissions.participantPermissions[peerId] = {
      ...current,
      [permission]: value
    };

    const target = this.participants.get(peerId);
    if (target) {
      target.permissions = this.permissions.participantPermissions[peerId];
    }

    if (this.currentRoom) {
      this.currentRoom.permissions = this.permissions;
    }

    if (this.transport.broadcastPermissionsUpdate) {
      this.transport.broadcastPermissionsUpdate({
        type: 'permissions_update',
        permissions: this.permissions
      });
    }

    this.notify('permissions_updated', this.permissions);
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
  }

  public updateParticipantPermissions(peerId: string, perms: Partial<ParticipantPermissions>): void {
    if (!this.transport.isHost) {
      console.warn('[WatchParty] Apenas o anfitrião pode alterar permissões de participantes.');
      return;
    }

    const current = this.getParticipantPermissions(peerId);
    this.permissions.participantPermissions[peerId] = {
      ...current,
      ...perms
    };

    const target = this.participants.get(peerId);
    if (target) {
      target.permissions = this.permissions.participantPermissions[peerId];
    }

    if (this.currentRoom) {
      this.currentRoom.permissions = this.permissions;
    }

    if (this.transport.broadcastPermissionsUpdate) {
      this.transport.broadcastPermissionsUpdate({
        type: 'permissions_update',
        permissions: this.permissions
      });
    }

    this.notify('permissions_updated', this.permissions);
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
  }

  public setRoomConfig(config: { allowChat?: boolean; allowVoice?: boolean }): void {
    if (!this.transport.isHost) {
      console.warn('[WatchParty] Apenas o anfitrião pode configurar as opções globais da sala.');
      return;
    }

    if (config.allowChat !== undefined) {
      this.permissions.allowChat = config.allowChat;
    }
    if (config.allowVoice !== undefined) {
      this.permissions.allowVoice = config.allowVoice;
    }

    if (this.currentRoom) {
      this.currentRoom.permissions = this.permissions;
    }

    if (this.transport.broadcastPermissionsUpdate) {
      this.transport.broadcastPermissionsUpdate({
        type: 'permissions_update',
        permissions: this.permissions
      });
    }

    this.notify('permissions_updated', this.permissions);
    this.notify('state_changed', this.getRoomState());
  }

  public setAdminMute(peerId: string, isMuted: boolean): void {
    if (!this.transport.isHost) return;

    if (this.transport.broadcastAdminMute) {
      this.transport.broadcastAdminMute({
        type: 'admin_mute',
        targetPeerId: peerId,
        isMuted
      });
    }

    const targetP = this.participants.get(peerId);
    if (targetP) {
      targetP.isAdminMuted = isMuted;
      if (isMuted) targetP.isAudioMuted = true;
    }

    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
  }

  public transferHost(newHostPeerId: string): void {
    if (!this.transport.isHost || !this.currentRoom || !newHostPeerId) return;

    const oldHostId = this.transport.selfId;
    this.transport.isHost = false;
    this.currentRoom.hostPeerId = newHostPeerId;

    const oldHostP = this.participants.get(oldHostId);
    if (oldHostP) oldHostP.isHost = false;
    const newHostP = this.participants.get(newHostPeerId);
    if (newHostP) newHostP.isHost = true;

    if (this.transport.broadcastHostTransfer) {
      this.transport.broadcastHostTransfer({
        type: 'host_transfer',
        previousHostPeerId: oldHostId,
        newHostPeerId
      });
    }

    this.notify('host_transferred', { previousHostPeerId: oldHostId, newHostPeerId });
    this.notify('participants_updated', this.getParticipantList());
    this.notify('state_changed', this.getRoomState());
  }

  // ==========================================
  // ASSINATURAS DE EVENTOS & CONVENIENCE API
  // ==========================================

  public subscribe(listener: WatchPartyEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onStateChange(callback: (state: any) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'state_changed' || event === 'room_created' || event === 'room_joined' || event === 'room_left') {
        callback(this.getRoomState());
      }
    };
    return this.subscribe(fn);
  }

  public onTransmissionStart(callback: (data: { media?: WatchPartyMediaMetadata; mode?: TransmissionMode; lifecycleState?: RoomLifecycleState; startTimestamp?: number; introDuration?: number }) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'transmission_started') callback(data);
    };
    return this.subscribe(fn);
  }

  public onLifecycleChange(callback: (state: RoomLifecycleState) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'lifecycle_changed') callback(data);
    };
    return this.subscribe(fn);
  }

  public onPermissionsChange(callback: (perms: WatchPartyPermissions) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'permissions_updated') callback(data);
    };
    return this.subscribe(fn);
  }

  public onChatMessage(callback: (msg: WatchPartyChatMessage) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'chat_message') callback(data);
    };
    return this.subscribe(fn);
  }

  public onScreenStreamChange(callback: (stream: MediaStream | null) => void): () => void {
    return this.subscribe((event, data) => {
      if (event === 'screen_stream_changed') callback(data);
    });
  }

  public onParticipantChange(callback: (participants: (WatchPartyParticipant & { id: string })[]) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'participants_updated' || event === 'peer_connected' || event === 'peer_disconnected') {
        callback(this.getParticipantList());
      }
    };
    return this.subscribe(fn);
  }

  public onPlaybackSync(callback: (sync: WatchPartyPlaybackState) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'playback_sync') callback(data);
    };
    return this.subscribe(fn);
  }

  public onChangeEpisode(callback: (data: any) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'episode_changed') callback(data);
    };
    return this.subscribe(fn);
  }

  public onBufferingChange(callback: (peerId: string, isBuffering: boolean) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'buffering_changed') callback(data.peerId, data.isBuffering);
    };
    return this.subscribe(fn);
  }

  public onVoiceStateChange(callback: (data: { isVoiceActive: boolean; isMuted: boolean }) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'voice_state_changed') callback(data);
    };
    return this.subscribe(fn);
  }

  public onHostStreamReceived(callback: (stream: MediaStream | null) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'host_stream_received' || event === 'screen_stream_changed') callback(data);
    };
    return this.subscribe(fn);
  }

  public onStreamConnectionChange(callback: (data: { status: 'good' | 'fair' | 'poor'; message: string }) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'stream_connection_changed') callback(data);
    };
    return this.subscribe(fn);
  }

  public onRemoteControlReceived(callback: (request: PeerRemoteControlRequestMessage) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'remote_control_received') callback(data);
    };
    return this.subscribe(fn);
  }

  public onHostBroadcastStart(callback: (data: { mode: TransmissionMode; captureMethod: string; stream: MediaStream }) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'host_broadcast_started') callback(data);
    };
    return this.subscribe(fn);
  }

  public onHostBroadcastStop(callback: () => void): () => void {
    const fn: WatchPartyEventListener = (event) => {
      if (event === 'host_broadcast_stopped') callback();
    };
    return this.subscribe(fn);
  }

  public on(targetEvent: string, callback: (data?: any) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === targetEvent) callback(data);
    };
    return this.subscribe(fn);
  }

  private notify(event: string, data?: any): void {
    this.listeners.forEach(fn => {
      try {
        fn(event, data);
      } catch (e) {
        console.error('[WatchParty] Erro em listener:', e);
      }
    });
  }

  /**
   * Constrói a URL canônica compartilhável do convite sem depender de localhost
   */
  public getInviteUrl(roomId?: string): string {
    const targetId = roomId || this.currentRoom?.roomId;
    if (!targetId) return '';
    
    let origin = 'https://zapitv-stream.vercel.app';
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      origin = window.location.origin;
    }
    return `${origin}/sala/${targetId}`;
  }
}

export const watchPartyService = WatchPartyService.getInstance();
