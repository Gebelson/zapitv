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
  PeerRoomAnnounceMessage
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

  // Estado de Reprodução
  private lastKnownSequence: number = 0;
  private isApplyingRemoteAction: boolean = false;
  private hostGraceTimer: any = null;
  private pingInterval: any = null;

  // Voz em Tempo Real & Detecção de Atividade de Voz (VAD)
  private localAudioStream: MediaStream | null = null;
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

  public getRoomState() {
    const list = this.getParticipantList();
    const selfP = this.participants.get(this.transport.selfId) || {
      peerId: this.transport.selfId,
      nickname: this.localNickname,
      isHost: this.transport.isHost,
      status: 'ready',
      joinedAt: Date.now(),
      isAudioMuted: !this.localAudioStream || !this.localAudioStream.getAudioTracks()[0]?.enabled,
      isSpeaking: this.isSpeakingLocal
    };

    return {
      isActive: this.isConnected,
      roomId: this.currentRoom?.roomId || '',
      mediaMetadata: this.currentRoom?.media,
      participants: list,
      localParticipant: {
        ...selfP,
        id: this.transport.selfId
      }
    };
  }

  // ==========================================
  // INICIALIZAÇÃO DE SALA
  // ==========================================

  public async createRoom(
    arg1: string | WatchPartyMediaMetadata,
    arg2?: string | WatchPartyMediaMetadata,
    customRoomId?: string
  ): Promise<string> {
    let media: WatchPartyMediaMetadata;
    let nickname: string;

    if (typeof arg1 === 'string') {
      nickname = arg1;
      media = (arg2 as WatchPartyMediaMetadata) || {
        id: 'filme',
        title: 'Watch Party',
        type: 'movie'
      };
    } else {
      media = arg1;
      nickname = (arg2 as string) || 'Anfitrião';
    }

    const roomId = customRoomId || this.generateSecureRoomId();
    this.localNickname = (nickname || 'Anfitrião').trim().slice(0, 24);

    const roomInfo: WatchPartyRoomInfo = {
      roomId,
      hostPeerId: this.transport.selfId,
      media,
      createdAt: Date.now(),
      maxParticipants: 6
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
      audioVolume: 1.0
    });

    this.notify('room_created', roomInfo);
    this.notify('state_changed', this.getRoomState());
    return roomId;
  }

  public async joinRoom(
    roomId: string,
    nickname: string,
    fallbackMedia?: WatchPartyMediaMetadata
  ): Promise<string> {
    this.localNickname = (nickname || 'Amigo').trim().slice(0, 24);
    this.transport.isHost = false;

    await this.connectTransport(roomId, false);

    this.currentRoom = {
      roomId,
      hostPeerId: '',
      media: fallbackMedia || {
        id: 'carregando',
        title: 'Aguardando sincronização da sala...',
        type: 'movie'
      },
      createdAt: Date.now(),
      maxParticipants: 6
    };

    this.lastKnownSequence = 0;
    this.addParticipant({
      peerId: this.transport.selfId,
      nickname: this.localNickname,
      isHost: false,
      status: 'connected',
      joinedAt: Date.now(),
      isAudioMuted: true,
      isSpeaking: false,
      audioVolume: 1.0
    });

    setTimeout(() => {
      this.transport.requestSync();
    }, 600);

    this.notify('room_joined', this.currentRoom);
    this.notify('state_changed', this.getRoomState());
    return roomId;
  }

  public async leaveRoom(): Promise<void> {
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

    this.notify('room_left');
    this.notify('state_changed', this.getRoomState());
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

        this.notify('peer_connected', peerId);
        this.notify('participants_updated', this.getParticipantList());
        this.notify('state_changed', this.getRoomState());
      },

      onPeerLeave: (peerId) => {
        const leaving = this.participants.get(peerId);
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
        if (this.currentRoom && this.currentRoom.hostPeerId && senderId !== this.currentRoom.hostPeerId) {
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

        this.notify('playback_sync', state);
      },

      onRequestSync: (senderId) => {
        if (this.transport.isHost && this.currentRoom) {
          this.transport.broadcastRoomAnnouncement({
            type: 'room_announcement',
            roomInfo: this.currentRoom
          });
          this.notify('host_sync_requested', senderId);
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
        } else {
          this.participants.set(senderId, {
            peerId: senderId,
            nickname: state.nickname || 'Convidado',
            isHost: isHostPeer,
            status: state.status,
            joinedAt: Date.now(),
            isAudioMuted: state.isAudioMuted,
            isSpeaking: state.isSpeaking,
            audioVolume: this.participantVolumes.get(senderId) ?? 1.0,
            isLocallyMuted: this.localMutedPeers.has(senderId)
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

      onChatMessage: (message) => {
        const cleanMsg: WatchPartyChatMessage = {
          id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId: message.senderId,
          senderNickname: String(message.senderNickname || 'Anônimo').slice(0, 24),
          isHost: Boolean(message.isHost),
          text: String(message.text || '').slice(0, 280),
          timestamp: message.timestamp || Date.now()
        };

        this.chatMessages.push(cleanMsg);
        if (this.chatMessages.length > 200) {
          this.chatMessages.shift();
        }
        this.notify('chat_message', cleanMsg);
      },

      onEpisodeChange: (change, senderId) => {
        if (this.currentRoom && this.currentRoom.hostPeerId && senderId !== this.currentRoom.hostPeerId) {
          return;
        }
        if (change.sequence <= this.lastKnownSequence) return;
        this.lastKnownSequence = change.sequence;

        if (this.currentRoom) {
          this.currentRoom.media = change.media;
        }
        this.notify('episode_changed', change);
        this.notify('state_changed', this.getRoomState());
      },

      onRoomAnnouncement: (announcement, senderId) => {
        if (!this.transport.isHost && announcement.roomInfo) {
          this.currentRoom = announcement.roomInfo;
          this.currentRoom.hostPeerId = announcement.roomInfo.hostPeerId || senderId;

          const hostP = this.participants.get(this.currentRoom.hostPeerId);
          if (hostP) hostP.isHost = true;

          this.notify('room_announced', announcement.roomInfo);
          this.notify('state_changed', this.getRoomState());
        }
      },

      onRemoteAudioStream: (stream, peerId) => {
        this.attachRemoteAudio(peerId, stream);
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

  public broadcastHostPlayback(positionSeconds: number, isPlaying: boolean, playbackRate: number = 1.0): void {
    if (!this.transport.isHost || !this.currentRoom || this.isApplyingRemoteAction) return;

    this.lastKnownSequence += 1;
    const state: WatchPartyPlaybackState = {
      mediaId: this.currentRoom.media.id,
      mediaType: String(this.currentRoom.media.type),
      season: this.currentRoom.media.season,
      episode: this.currentRoom.media.episode,
      positionSeconds,
      isPlaying,
      playbackRate,
      eventTimestamp: Date.now(),
      sequence: this.lastKnownSequence,
      hostPeerId: this.transport.selfId
    };

    this.transport.broadcastPlaybackState(state);
  }

  public updatePlaybackState(positionSeconds: number, isPlaying: boolean, playbackRate: number = 1.0): void {
    this.broadcastHostPlayback(positionSeconds, isPlaying, playbackRate);
  }

  public setBuffering(isBuffering: boolean): void {
    this.reportLocalStatus(isBuffering ? 'buffering' : 'ready');
  }

  public sendPlaybackToPeer(peerId: string, positionSeconds: number, isPlaying: boolean): void {
    if (!this.transport.isHost || !this.currentRoom) return;

    const state: WatchPartyPlaybackState = {
      mediaId: this.currentRoom.media.id,
      mediaType: String(this.currentRoom.media.type),
      season: this.currentRoom.media.season,
      episode: this.currentRoom.media.episode,
      positionSeconds,
      isPlaying,
      playbackRate: 1.0,
      eventTimestamp: Date.now(),
      sequence: this.lastKnownSequence,
      hostPeerId: this.transport.selfId
    };

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
      isSpeaking: this.isSpeakingLocal
    });
  }

  public changeEpisode(newMediaOrSeason: WatchPartyMediaMetadata | number, episodeNumber?: number): void {
    if (!this.transport.isHost || !this.currentRoom) return;

    let newMedia: WatchPartyMediaMetadata;
    if (typeof newMediaOrSeason === 'number') {
      newMedia = {
        ...this.currentRoom.media,
        season: newMediaOrSeason,
        episode: episodeNumber || 1
      };
    } else {
      newMedia = newMediaOrSeason;
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

  public executeRemoteActionSafely(action: () => void): void {
    this.isApplyingRemoteAction = true;
    try {
      action();
    } finally {
      setTimeout(() => {
        this.isApplyingRemoteAction = false;
      }, 80);
    }
  }

  public sendChatMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

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

  public onChatMessage(callback: (msg: WatchPartyChatMessage) => void): () => void {
    const fn: WatchPartyEventListener = (event, data) => {
      if (event === 'chat_message') callback(data);
    };
    return this.subscribe(fn);
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
   * Constrói a URL canônica compartilhável do convite
   */
  public getInviteUrl(roomId?: string): string {
    const targetId = roomId || this.currentRoom?.roomId;
    if (!targetId) return '';
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://zapitv-kappa.vercel.app';
    return `${origin}/sala/${targetId}`;
  }
}

export const watchPartyService = WatchPartyService.getInstance();
