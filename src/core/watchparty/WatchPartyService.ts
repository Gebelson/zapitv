/**
 * ZapiTV — WatchPartyService (Orchestrator Façade)
 * 
 * Orquestrador central e fachada de arquitetura para a Watch Party do ZapiTV.
 * Integra e coordena os módulos de domínio especializados:
 * - WatchPartyStateMachine: Máquina formal de estados finitos
 * - WatchPartyRoomManager: Single Source of Truth para sala, participantes e permissões
 * - WatchPartyChatService: Histórico, deduplicação e canal de mensagens
 * - WatchPartyVoiceService: Plano de mídia de voz, microfone, VAD e áudio remoto
 * - WatchPartyBroadcastService: Plano de mídia audiovisual do Anfitrião (Host Broadcast)
 * - WatchPartyPlaybackSyncService: Sincronização de timeline e compensação de drift
 * - TrysteroTransport / IWatchPartyTransport: Camada P2P de transporte de dados
 */

import { IWatchPartyTransport, TransportCallbacks } from './IWatchPartyTransport';
import { TrysteroTransport } from './TrysteroTransport';
import {
  WatchPartyRoomInfo,
  WatchPartyParticipant,
  WatchPartyPlaybackState,
  WatchPartyChatMessage,
  WatchPartyMediaMetadata,
  PeerParticipantStateMessage,
  RoomLifecycleState,
  ParticipantPermissions,
  WatchPartyPermissions,
  PeerStartTransmissionMessage,
  PeerAdminMuteMessage,
  PeerRemoteControlRequestMessage,
  TransmissionMode,
  HostBroadcastStatus,
  ConnectionDiagnosticStep,
  PeerConnectionHealth
} from './watchPartyTypes';

import { WatchPartyStateMachine } from './WatchPartyStateMachine';
import { WatchPartyRoomManager } from './WatchPartyRoomManager';
import { WatchPartyChatService } from './WatchPartyChatService';
import { WatchPartyVoiceService } from './WatchPartyVoiceService';
import { WatchPartyBroadcastService } from './WatchPartyBroadcastService';
import { WatchPartyPlaybackSyncService } from './WatchPartyPlaybackSyncService';

export type WatchPartyEventListener = (event: string, data?: any) => void;

export class WatchPartyService {
  private static instance: WatchPartyService;

  // Serviços Especializados
  private transport: IWatchPartyTransport;
  private stateMachine: WatchPartyStateMachine;
  private roomManager: WatchPartyRoomManager;
  private chatService: WatchPartyChatService;
  private voiceService: WatchPartyVoiceService;
  private broadcastService: WatchPartyBroadcastService;
  private playbackSyncService: WatchPartyPlaybackSyncService;

  // Listeners de eventos de alto nível
  private listeners: Set<WatchPartyEventListener> = new Set();

  // Timers & Diagnóstico
  private heartbeatInterval: any = null;
  private pingInterval: any = null;
  private diagnosticLogs: { step: ConnectionDiagnosticStep; timestamp: number; details?: any }[] = [];
  private peerHealthMap: Map<string, PeerConnectionHealth> = new Map();

  private constructor(transport?: IWatchPartyTransport) {
    this.transport = transport || new TrysteroTransport();
    this.stateMachine = new WatchPartyStateMachine('LOBBY');
    this.roomManager = new WatchPartyRoomManager(this.transport.selfId, this.stateMachine, 'Gebelson');
    this.chatService = new WatchPartyChatService();
    this.voiceService = new WatchPartyVoiceService();
    this.broadcastService = new WatchPartyBroadcastService();
    this.playbackSyncService = new WatchPartyPlaybackSyncService();

    this.wireInternalSubservices();
    this.setupNetworkReconnectionListeners();
  }

  public static getInstance(): WatchPartyService {
    if (!WatchPartyService.instance) {
      WatchPartyService.instance = new WatchPartyService();
    }
    return WatchPartyService.instance;
  }

  // ==========================================
  // CONEXÃO E INTEGRAÇÃO DE SUB-SERVIÇOS
  // ==========================================

  private wireInternalSubservices(): void {
    // 1. Estado da Sala & Ciclo de Vida
    this.stateMachine.subscribe((newState, prev, reason) => {
      if (this.roomManager.roomInfo) {
        this.roomManager.roomInfo.lifecycleState = newState;
      }
      this.notify('lifecycle_changed', newState);
      this.notify('state_changed', this.getRoomState());
    });

    this.roomManager.onRoomChange((roomInfo) => {
      this.notify('room_changed', roomInfo);
      this.notify('state_changed', this.getRoomState());
    });

    this.roomManager.onParticipantsChange((participants) => {
      this.notify('participants_updated', participants);
      this.notify('state_changed', this.getRoomState());
    });

    // 2. Chat
    this.chatService.onMessage((msg) => {
      this.notify('chat_message_received', msg);
    });

    // 3. Voz & VAD
    this.voiceService.onVoiceStateChange((data) => {
      const selfP = this.roomManager.getParticipantList().find(p => p.peerId === this.selfId);
      if (selfP) {
        selfP.isAudioMuted = data.isMuted;
      }
      this.transport.broadcastParticipantState({
        type: 'participant_state',
        nickname: this.currentNickname,
        status: selfP?.status || 'ready',
        isAudioMuted: data.isMuted,
        isSpeaking: false
      });
      this.notify('voice_state_changed', data);
      this.notify('state_changed', this.getRoomState());
    });

    this.voiceService.onSpeakingChange((peerId, isSpeaking) => {
      if (peerId === 'local') {
        this.roomManager.setParticipantSpeaking(this.selfId, isSpeaking);
        this.transport.broadcastParticipantState({
          type: 'participant_state',
          nickname: this.currentNickname,
          status: 'ready',
          isAudioMuted: this.isMicrophoneMuted(),
          isSpeaking
        });
      } else {
        this.roomManager.setParticipantSpeaking(peerId, isSpeaking);
      }
      this.notify('state_changed', this.getRoomState());
    });

    // 4. Broadcast
    this.broadcastService.onBroadcastStart((data) => {
      this.notify('host_broadcast_started', data);
    });

    this.broadcastService.onBroadcastStop(() => {
      this.notify('host_broadcast_stopped');
    });

    this.broadcastService.onHostStream((stream) => {
      this.notify('host_stream_received', stream);
      this.notify('screen_stream_changed', stream);
    });

    this.broadcastService.onStreamConnection((data) => {
      this.notify('stream_connection_changed', data);
    });

    // 5. Timeline Sync
    this.playbackSyncService.onPlaybackSync((state) => {
      this.notify('playback_synced', state);
      this.notify('state_changed', this.getRoomState());
    });
  }

  // ==========================================
  // DIAGNÓSTICO E TELEMETRIA
  // ==========================================

  public logDiagnostic(step: ConnectionDiagnosticStep, details?: any): void {
    const entry = { step, timestamp: Date.now(), details };
    this.diagnosticLogs.push(entry);
    if (this.diagnosticLogs.length > 100) this.diagnosticLogs.shift();
    console.log(`[WatchParty Diagnostic] ${step}:`, details || '');
    this.notify('diagnostic_step', entry);
  }

  public getDiagnosticEvents() {
    return [...this.diagnosticLogs];
  }

  public getPeerHealth(peerId: string): PeerConnectionHealth | undefined {
    return this.peerHealthMap.get(peerId);
  }

  // ==========================================
  // MÉTODOS ESTÁTICOS E UTILITÁRIOS
  // ==========================================

  public static sanitizeRoomId(raw: string): string {
    if (!raw || typeof raw !== 'string') return '';
    let str = raw.trim();

    // 1. Decodificação recursiva de URI (%5B -> [, etc.)
    for (let i = 0; i < 3; i++) {
      try {
        const decoded = decodeURIComponent(str);
        if (decoded === str) break;
        str = decoded;
      } catch {
        break;
      }
    }

    // 2. Extração de rotas /sala/ ou queries sala=
    if (str.includes('/sala/')) {
      const parts = str.split('/sala/');
      str = parts[parts.length - 1];
    } else if (str.includes('sala=')) {
      const match = str.match(/sala=([^&#\s]+)/);
      if (match && match[1]) {
        str = match[1];
      }
    }

    // 3. Remove query strings e hashes
    str = str.split('?')[0].split('#')[0].trim();

    // 4. Padrão canônico zapi-...
    const canonicalMatch = str.match(/(zapi-[a-zA-Z0-9_-]+)/i);
    if (canonicalMatch && canonicalMatch[1]) {
      return canonicalMatch[1].replace(/[^a-zA-Z0-9]+$/, '').toLowerCase();
    }

    // 5. Fallback para códigos personalizados
    str = str.replace(/^[\[\(\{<"'\s]+|[\]\)\}>"'\s,\.;:]+$/g, '');
    str = str.replace(/[^a-zA-Z0-9_-]/g, '');

    return str.toLowerCase();
  }

  public generateSecureRoomId(): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `zapi-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    }
    return `zapi-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }

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
      backdrop
    };
  }

  // ==========================================
  // GETTERS PRINCIPAIS & COMPATIBILIDADE
  // ==========================================

  public get isConnected(): boolean {
    return Boolean(this.roomManager.roomInfo !== null);
  }

  public isHost(): boolean {
    return this.roomManager.isHost;
  }

  public isHostRole(): boolean {
    return this.roomManager.isHost;
  }

  public get selfId(): string {
    return this.transport.selfId;
  }

  public get roomInfo(): WatchPartyRoomInfo | null {
    return this.roomManager.roomInfo;
  }

  public get currentNickname(): string {
    return this.roomManager.nickname;
  }

  public get isRemoteActionApplying(): boolean {
    return this.playbackSyncService.isRemoteActionApplying;
  }

  public get remoteAudioElements(): Map<string, HTMLAudioElement> {
    return this.voiceService.getRemoteAudioElements();
  }

  public getParticipantList(): (WatchPartyParticipant & { id: string })[] {
    return this.roomManager.getParticipantList();
  }

  public getChatHistory(): WatchPartyChatMessage[] {
    return this.chatService.getHistory();
  }

  public getRoomState() {
    return {
      roomId: this.roomManager.roomInfo?.roomId || '',
      roomInfo: this.roomManager.roomInfo,
      media: this.roomManager.roomInfo?.media || null,
      isHost: this.isHost(),
      participants: this.getParticipantList(),
      lifecycleState: this.stateMachine.getState(),
      transmissionMode: this.getTransmissionMode(),
      permissions: this.getPermissions(),
      isVoiceActive: this.isVoiceActive(),
      isMuted: this.isMicrophoneMuted(),
      lastPlaybackState: this.playbackSyncService.getLastPlaybackState()
    };
  }

  public getInviteUrl(roomId?: string): string {
    return this.roomManager.getInviteUrl(roomId);
  }

  // ==========================================
  // CRIAÇÃO E ENTRADA NA SALA
  // ==========================================

  public async createRoom(
    media: WatchPartyMediaMetadata,
    hostNickname: string = 'Gebelson',
    customRoomId?: string,
    transmissionMode: TransmissionMode = 'source',
    options?: { maxParticipants?: number; allowChat?: boolean; allowVoice?: boolean }
  ): Promise<string> {
    const rawId = customRoomId || this.generateSecureRoomId();
    const cleanRoomId = WatchPartyService.sanitizeRoomId(rawId);

    this.logDiagnostic('ROOM_CREATE', { roomId: cleanRoomId, host: hostNickname });

    this.roomManager.nickname = hostNickname;
    const normalizedMedia = WatchPartyService.normalizeMedia(media);

    this.roomManager.initRoomAsHost(cleanRoomId, normalizedMedia, {
      maxParticipants: options?.maxParticipants || 6,
      transmissionMode,
      allowChat: options?.allowChat ?? true,
      allowVoice: options?.allowVoice ?? true
    });

    this.chatService.clear();
    this.playbackSyncService.reset();

    // 1. Conecta ao transporte P2P
    await this.connectTransport(cleanRoomId);

    // 2. Anuncia sala na API local/servidor
    this.announceRoomToServer(cleanRoomId, normalizedMedia, transmissionMode, hostNickname);

    // 3. Inicia rotina de heartbeat
    this.startHeartbeatLoop(cleanRoomId);

    this.logDiagnostic('ROOM_REGISTER', { roomId: cleanRoomId, ok: true });
    this.notify('room_created', this.roomManager.roomInfo);
    this.notify('state_changed', this.getRoomState());

    return cleanRoomId;
  }

  public async joinRoom(roomId: string, guestNickname: string = 'Zapi Amigo'): Promise<WatchPartyRoomInfo> {
    const cleanRoomId = WatchPartyService.sanitizeRoomId(roomId);
    if (!cleanRoomId) {
      throw new Error('Código de sala inválido.');
    }

    this.logDiagnostic('ROOM_LOOKUP', { roomId: cleanRoomId });

    this.roomManager.nickname = guestNickname;
    this.roomManager.initRoomAsGuest(cleanRoomId);
    this.chatService.clear();
    this.playbackSyncService.reset();

    // 1. Conecta ao transporte P2P
    await this.connectTransport(cleanRoomId);

    // 2. Tenta obter anúncio da API como fallback rápido
    this.fetchRoomFromServer(cleanRoomId);

    // 3. Solicita sincronização imediata aos peers
    this.transport.requestSync();

    // 4. Inicia rotina de heartbeat
    this.startHeartbeatLoop(cleanRoomId);

    this.logDiagnostic('ROOM_JOIN', { roomId: cleanRoomId, ok: true });
    this.notify('room_joined', this.roomManager.roomInfo);
    this.notify('state_changed', this.getRoomState());

    return this.roomManager.roomInfo!;
  }

  public async leaveRoom(): Promise<void> {
    this.stopHeartbeatLoop();
    this.voiceService.stopVoiceChat();
    this.broadcastService.stopHostBroadcast();

    if (this.roomManager.roomInfo) {
      const rid = this.roomManager.roomInfo.roomId;
      fetch(`/api/watchparty/room/${rid}`, { method: 'DELETE' }).catch(() => {});
    }

    await this.transport.leaveRoom();
    this.roomManager.closeRoom();
    this.chatService.clear();
    this.playbackSyncService.reset();

    this.notify('room_left');
    this.notify('state_changed', this.getRoomState());
  }

  // ==========================================
  // INTEGRAÇÃO DE TRANSPORTE E CALLBACKS
  // ==========================================

  private async connectTransport(roomId: string): Promise<void> {
    const callbacks: TransportCallbacks = {
      onPeerJoin: (peerId) => this.handlePeerJoin(peerId),
      onPeerLeave: (peerId) => this.handlePeerLeave(peerId),
      onPlaybackSync: (state, senderId) => this.handleIncomingPlaybackSync(state, senderId),
      onRequestSync: (senderId) => this.handleRequestSync(senderId),
      onParticipantState: (state, senderId) => this.handleIncomingParticipantState(state, senderId),
      onChatMessage: (message, senderId) => this.handleIncomingChatMessage(message, senderId),
      onEpisodeChange: (change, senderId) => this.handleIncomingEpisodeChange(change, senderId),
      onRoomAnnouncement: (announcement, senderId) => this.handleIncomingRoomAnnouncement(announcement, senderId),
      onStartTransmission: (message, senderId) => this.handleIncomingStartTransmission(message, senderId),
      onPermissionsUpdate: (message, senderId) => this.handleIncomingPermissionsUpdate(message, senderId),
      onAdminMute: (message, senderId) => this.handleIncomingAdminMute(message, senderId),
      onHostTransfer: (message, senderId) => this.handleIncomingHostTransfer(message, senderId),
      onRemoteControlRequest: (request, senderId) => this.handleIncomingRemoteControl(request, senderId),
      onRemoteAudioStream: (stream, peerId) => this.handleIncomingRemoteAudio(stream, peerId),
      onRemoteMediaStream: (stream, peerId) => this.handleIncomingRemoteMedia(stream, peerId)
    };

    await this.transport.joinRoom(roomId, callbacks);
    this.logDiagnostic('SIGNALING_READY', { roomId, selfId: this.selfId });
  }

  private handlePeerJoin(peerId: string): void {
    this.logDiagnostic('PEER_DISCOVERY', { peerId });
    this.roomManager.handlePeerJoin(peerId);

    // Se sou o Host, envio o estado atual completo ao novo participante
    if (this.isHost() && this.roomManager.roomInfo) {
      this.transport.broadcastRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: this.roomManager.roomInfo
      });

      const currentPlayback = this.playbackSyncService.getLastPlaybackState();
      if (currentPlayback) {
        this.transport.sendPlaybackState(peerId, currentPlayback);
      }

      // Se estou transmitindo áudio/vídeo, envio o stream ao novo peer
      const broadcastStream = this.broadcastService.getLocalStream();
      if (broadcastStream && this.transport.addLocalMediaStream) {
        this.transport.addLocalMediaStream(broadcastStream, peerId);
      }
    }

    // Se meu microfone estiver aberto, adiciono a faixa para o peer
    const localAudio = this.voiceService.getLocalAudioStream();
    if (localAudio && this.transport.addLocalAudioStream) {
      this.transport.addLocalAudioStream(localAudio, peerId);
    }

    this.notify('peer_joined', peerId);
    this.notify('state_changed', this.getRoomState());
  }

  private handlePeerLeave(peerId: string): void {
    this.roomManager.handlePeerLeave(peerId);
    this.voiceService.removeRemoteAudio(peerId);
    this.peerHealthMap.delete(peerId);
    this.notify('peer_left', peerId);
    this.notify('state_changed', this.getRoomState());
  }

  private handleIncomingPlaybackSync(state: WatchPartyPlaybackState, _senderId: string): void {
    this.playbackSyncService.handleIncomingPlaybackSync(state);
  }

  private handleRequestSync(senderId: string): void {
    if (this.isHost() && this.roomManager.roomInfo) {
      this.transport.broadcastRoomAnnouncement({
        type: 'room_announcement',
        roomInfo: this.roomManager.roomInfo
      });

      const currentPlayback = this.playbackSyncService.getLastPlaybackState();
      if (currentPlayback) {
        this.transport.sendPlaybackState(senderId, currentPlayback);
      }
    }
  }

  private handleIncomingParticipantState(state: PeerParticipantStateMessage, senderId: string): void {
    this.roomManager.handlePeerStateMessage(senderId, state);
  }

  public handleIncomingChatMessage(message: WatchPartyChatMessage, _senderId?: string): void {
    this.chatService.addMessage(message);
  }

  private handleIncomingEpisodeChange(change: any, _senderId: string): void {
    if (change?.media && this.roomManager.roomInfo) {
      this.roomManager.roomInfo.media = change.media;
      this.notify('episode_changed', { media: change.media });
      this.notify('state_changed', this.getRoomState());
    }
  }

  private handleIncomingRoomAnnouncement(announcement: any, _senderId: string): void {
    if (announcement?.roomInfo) {
      const incoming = announcement.roomInfo;
      this.roomManager.updateRoomInfo({
        hostPeerId: incoming.hostPeerId,
        hostNickname: incoming.hostNickname,
        media: incoming.media,
        transmissionMode: incoming.transmissionMode,
        lifecycleState: incoming.lifecycleState,
        permissions: incoming.permissions
      });

      if (incoming.lifecycleState) {
        this.stateMachine.transitionTo(incoming.lifecycleState, 'room_announcement', true);
      }

      this.logDiagnostic('STATE_SYNC', { hostPeerId: incoming.hostPeerId });
    }
  }

  private handleIncomingStartTransmission(message: PeerStartTransmissionMessage, _senderId: string): void {
    if (message.mode) {
      this.setTransmissionMode(message.mode);
    }
    const targetState = message.lifecycleState || 'PLAYING_CONTENT';
    this.stateMachine.transitionTo(targetState, 'start_transmission_command', true);
    this.notify('transmission_started', message);
    this.notify('state_changed', this.getRoomState());
  }

  private handleIncomingPermissionsUpdate(message: any, _senderId: string): void {
    if (message.permissions) {
      this.roomManager.updateRoomInfo({ permissions: message.permissions });
      this.notify('permissions_updated', message.permissions);
    }
  }

  private handleIncomingAdminMute(message: PeerAdminMuteMessage, _senderId: string): void {
    if (message.targetPeerId === this.selfId && message.isMuted) {
      if (this.isVoiceActive() && !this.isMicrophoneMuted()) {
        this.toggleMuteVoice();
      }
      this.chatService.addSystemMessage('Seu microfone foi silenciado pelo anfitrião.');
    }
  }

  private handleIncomingHostTransfer(message: any, _senderId: string): void {
    if (message.newHostPeerId) {
      this.roomManager.transferHost(message.newHostPeerId);
    }
  }

  private handleIncomingRemoteControl(request: PeerRemoteControlRequestMessage, _senderId: string): void {
    this.notify('remote_control_received', request);
  }

  private handleIncomingRemoteAudio(stream: MediaStream, peerId: string): void {
    if (peerId === this.selfId) return; // Zero loopback
    this.logDiagnostic('REMOTE_TRACK_RECEIVED', { peerId, trackKind: 'audio' });
    this.voiceService.attachRemoteAudio(peerId, stream);
    this.updatePeerHealth(peerId, { hasAudioTrack: true });
  }

  private handleIncomingRemoteMedia(stream: MediaStream, peerId: string): void {
    if (peerId === this.selfId) return; // Zero loopback
    this.logDiagnostic('REMOTE_MEDIA_PLAYING', { peerId, tracks: stream.getTracks().map(t => t.kind) });
    this.broadcastService.handleRemoteMediaStream(stream, peerId);
    this.updatePeerHealth(peerId, { hasVideoTrack: true });
  }

  private updatePeerHealth(peerId: string, partial: Partial<PeerConnectionHealth>): void {
    const existing = this.peerHealthMap.get(peerId) || {
      peerId,
      hasAudioTrack: false,
      hasVideoTrack: false,
      lastActivityTimestamp: Date.now()
    };
    Object.assign(existing, partial);
    existing.lastActivityTimestamp = Date.now();
    this.peerHealthMap.set(peerId, existing);
  }

  // ==========================================
  // PLAYBACK & TIMELINE SYNCHRONIZATION
  // ==========================================

  public getLastPlaybackState(): WatchPartyPlaybackState | null {
    return this.playbackSyncService.getLastPlaybackState();
  }

  public calculateExpectedPosition(state: WatchPartyPlaybackState): number {
    return this.playbackSyncService.calculateExpectedPosition(state);
  }

  public broadcastHostPlayback(
    positionSeconds: number,
    isPlaying: boolean,
    playbackRate: number = 1.0,
    duration?: number
  ): void {
    if (!this.roomManager.roomInfo || this.playbackSyncService.isRemoteActionApplying) return;

    const isHost = this.isHost();
    const canControl = isHost || this.canLocalControl('canPlayPause') || this.canLocalControl('canSeek');
    if (!canControl) return;

    const state = this.playbackSyncService.createPlaybackState(
      this.roomManager.roomInfo.media,
      positionSeconds,
      isPlaying,
      playbackRate,
      this.roomManager.roomInfo.hostPeerId || this.selfId,
      this.roomManager.roomInfo.roomId,
      duration
    );

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
    if (!this.isHost() || !this.roomManager.roomInfo) return;

    const state = this.playbackSyncService.createPlaybackState(
      this.roomManager.roomInfo.media,
      positionSeconds,
      isPlaying,
      playbackRate,
      this.selfId,
      this.roomManager.roomInfo.roomId,
      duration
    );

    this.transport.sendPlaybackState(peerId, state);
  }

  public reportLocalStatus(status: 'connected' | 'buffering' | 'ready'): void {
    this.roomManager.setParticipantStatus(this.selfId, status);
    this.transport.broadcastParticipantState({
      type: 'participant_state',
      nickname: this.currentNickname,
      status,
      isAudioMuted: this.isMicrophoneMuted(),
      isSpeaking: false
    });
  }

  public changeEpisode(newMediaOrSeason: WatchPartyMediaMetadata | number, episodeNumber?: number): void {
    if (!this.isHost() || !this.roomManager.roomInfo) return;

    let newMedia: WatchPartyMediaMetadata;
    if (typeof newMediaOrSeason === 'object') {
      newMedia = WatchPartyService.normalizeMedia(newMediaOrSeason);
    } else {
      newMedia = {
        ...this.roomManager.roomInfo.media,
        season: newMediaOrSeason,
        seasonNumber: newMediaOrSeason,
        episode: episodeNumber || 1,
        episodeNumber: episodeNumber || 1
      };
    }

    this.roomManager.roomInfo.media = newMedia;
    this.transport.broadcastEpisodeChange({
      type: 'change_episode',
      sequence: Date.now(),
      season: newMedia.season || 1,
      episode: newMedia.episode || 1,
      media: newMedia
    });

    this.notify('episode_changed', { media: newMedia });
    this.notify('state_changed', this.getRoomState());
  }

  public executeRemoteActionSafely(action: () => void, windowMs: number = 400): void {
    this.playbackSyncService.executeRemoteActionSafely(action, windowMs);
  }

  // ==========================================
  // CHAT TEXTUAL
  // ==========================================

  public sendChatMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!this.getPermissions().allowChat && !this.isHost()) {
      throw new Error('O chat foi temporariamente desativado pelo anfitrião.');
    }

    const msg = this.chatService.createMessage(trimmed, this.selfId, this.currentNickname, this.isHost());
    this.chatService.addMessage(msg);
    this.transport.sendChatMessage(msg);
  }

  // ==========================================
  // CHAT DE VOZ & VAD
  // ==========================================

  public isVoiceActive(): boolean {
    return this.voiceService.isVoiceActive();
  }

  public isMicrophoneMuted(): boolean {
    return this.voiceService.isMicrophoneMuted();
  }

  public async startVoiceChat(): Promise<boolean> {
    const selfP = this.roomManager.getParticipantList().find(p => p.peerId === this.selfId);
    if (selfP?.isAdminMuted) {
      throw new Error('Seu microfone foi silenciado pelo anfitrião da sala.');
    }
    if (!this.getPermissions().allowVoice && !this.isHost()) {
      throw new Error('O chat de voz foi desativado pelo anfitrião.');
    }

    const stream = await this.voiceService.startVoiceChat();
    if (!stream) return false;

    if (this.transport.addLocalAudioStream) {
      this.transport.addLocalAudioStream(stream);
    }

    return true;
  }

  public stopVoiceChat(): void {
    const localStream = this.voiceService.getLocalAudioStream();
    if (localStream && this.transport.removeLocalAudioStream) {
      this.transport.removeLocalAudioStream(localStream);
    }
    this.voiceService.stopVoiceChat();
  }

  public toggleMuteVoice(): boolean {
    return this.voiceService.toggleMuteVoice();
  }

  public unlockRemoteAudio(): void {
    this.voiceService.unlockRemoteAudio();
  }

  public setParticipantAudioVolume(peerId: string, volume: number): void {
    this.voiceService.setParticipantAudioVolume(peerId, volume);
  }

  public toggleMuteParticipantLocally(peerId: string): boolean {
    return this.voiceService.toggleMuteParticipantLocally(peerId);
  }

  public isParticipantLocallyMuted(peerId: string): boolean {
    return this.voiceService.isParticipantLocallyMuted(peerId);
  }

  // ==========================================
  // TRANSMISSÃO DO ANFITRIÃO (HOST BROADCAST)
  // ==========================================

  public isHostBroadcastMode(): boolean {
    return this.getTransmissionMode() === 'host_broadcast';
  }

  public getTransmissionMode(): TransmissionMode {
    return this.roomManager.roomInfo?.transmissionMode || 'source';
  }

  public setTransmissionMode(mode: TransmissionMode): void {
    if (this.roomManager.roomInfo) {
      this.roomManager.roomInfo.transmissionMode = mode;
      if (this.isHost()) {
        this.transport.broadcastRoomAnnouncement({
          type: 'room_announcement',
          roomInfo: this.roomManager.roomInfo
        });
        fetch('/api/watchparty/room/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.roomManager.roomInfo.roomId,
            hostPeerId: this.selfId,
            hostNickname: this.currentNickname,
            media: this.roomManager.roomInfo.media,
            transmissionMode: mode,
            lifecycleState: this.stateMachine.getState()
          })
        }).catch(() => {});
      }
      this.notify('transmission_mode_changed', mode);
      this.notify('state_changed', this.getRoomState());
    }
  }

  public async startHostBroadcast(videoEl?: HTMLVideoElement | null): Promise<MediaStream> {
    if (!this.isHost() || !this.roomManager.roomInfo) {
      throw new Error('Apenas o anfitrião pode iniciar a transmissão da sala.');
    }

    const stream = await this.broadcastService.startHostBroadcast(
      videoEl,
      (str, peerId) => {
        if (this.transport.addLocalMediaStream) {
          this.transport.addLocalMediaStream(str, peerId);
        }
      },
      this.transport.getConnectedPeers()
    );

    this.startTransmission('host_broadcast');
    return stream;
  }

  public stopHostBroadcast(): void {
    this.broadcastService.stopHostBroadcast((str) => {
      this.transport.removeLocalMediaStream?.(str);
    });
  }

  public async startScreenShare(): Promise<void> {
    await this.startHostBroadcast(null);
  }

  public stopScreenShare(): void {
    this.stopHostBroadcast();
  }

  public getScreenStream(): MediaStream | null {
    return this.broadcastService.getHostStream();
  }

  public getHostStream(): MediaStream | null {
    return this.broadcastService.getHostStream();
  }

  public getBroadcastStatus(): HostBroadcastStatus {
    return this.broadcastService.getBroadcastStatus(this.getTransmissionMode());
  }

  public requestScreenStream(): void {
    this.transport.requestSync();
  }

  public requestHostPlaybackAction(
    action: 'play' | 'pause' | 'seek' | 'next_episode',
    payload?: { positionSeconds?: number; season?: number; episode?: number }
  ): void {
    if (this.isHost() || !this.roomManager.roomInfo?.hostPeerId) return;

    if (action === 'play' || action === 'pause') {
      if (!this.canLocalControl('canPlayPause')) return;
    } else if (action === 'seek') {
      if (!this.canLocalControl('canSeek')) return;
    } else if (action === 'next_episode') {
      if (!this.canLocalControl('canChangeEpisode')) return;
    }

    const msg: PeerRemoteControlRequestMessage = {
      type: 'remote_control_request',
      action,
      payload,
      senderPeerId: this.selfId,
      senderNickname: this.currentNickname,
      timestamp: Date.now()
    };

    if (this.transport.sendRemoteControlRequest) {
      this.transport.sendRemoteControlRequest(this.roomManager.roomInfo.hostPeerId, msg);
    }
  }

  public startTransmission(mode: TransmissionMode = 'source'): void {
    if (!this.isHost() || !this.roomManager.roomInfo) return;

    this.setTransmissionMode(mode);
    const startTimestamp = Date.now();
    const introDuration = 6.0;

    const startMsg: PeerStartTransmissionMessage = {
      type: 'start_transmission',
      hostPeerId: this.selfId,
      timestamp: startTimestamp,
      media: this.roomManager.roomInfo.media,
      mode,
      lifecycleState: 'PLAYING_INTRO',
      introStartTimestamp: startTimestamp,
      introDuration
    };

    this.stateMachine.transitionTo('PLAYING_INTRO', 'start_transmission');

    if (this.transport.broadcastStartTransmission) {
      this.transport.broadcastStartTransmission(startMsg);
    }

    this.notify('transmission_started', startMsg);
    this.notify('state_changed', this.getRoomState());
  }

  // ==========================================
  // ESTADOS DO CICLO DE VIDA (LIFECYCLE)
  // ==========================================

  public getLifecycleState(): RoomLifecycleState {
    return this.stateMachine.getState();
  }

  public setLifecycleState(state: RoomLifecycleState): void {
    if (this.roomManager.roomInfo) {
      this.stateMachine.transitionTo(state, 'manual_set');
      if (this.isHost()) {
        this.transport.broadcastRoomAnnouncement({
          type: 'room_announcement',
          roomInfo: this.roomManager.roomInfo
        });
      }
    }
  }

  // ==========================================
  // PERMISSÕES E ADMINISTRAÇÃO
  // ==========================================

  public getPermissions(): WatchPartyPermissions {
    return this.roomManager.permissions;
  }

  public getParticipantPermissions(peerId: string): ParticipantPermissions {
    return this.roomManager.getParticipantPermissions(peerId);
  }

  public canLocalControl(perm: keyof ParticipantPermissions): boolean {
    if (this.isHost()) return true;
    return this.getParticipantPermissions(this.selfId)[perm] ?? false;
  }

  public canPeerControl(peerId: string, perm: keyof ParticipantPermissions): boolean {
    if (peerId === this.roomManager.roomInfo?.hostPeerId) return true;
    return this.getParticipantPermissions(peerId)[perm] ?? false;
  }

  public setParticipantPermission(peerId: string, permission: keyof ParticipantPermissions, value: boolean): void {
    if (!this.isHost()) return;
    this.roomManager.setParticipantPermission(peerId, permission, value);
    if (this.transport.broadcastPermissionsUpdate) {
      this.transport.broadcastPermissionsUpdate({
        type: 'permissions_update',
        permissions: this.roomManager.permissions
      });
    }
  }

  public updateParticipantPermissions(peerId: string, perms: Partial<ParticipantPermissions>): void {
    if (!this.isHost()) return;
    this.roomManager.updateParticipantPermissions(peerId, perms);
    if (this.transport.broadcastPermissionsUpdate) {
      this.transport.broadcastPermissionsUpdate({
        type: 'permissions_update',
        permissions: this.roomManager.permissions
      });
    }
  }

  public setRoomConfig(config: { allowChat?: boolean; allowVoice?: boolean }): void {
    if (!this.isHost()) return;
    this.roomManager.setRoomConfig(config);
    if (this.transport.broadcastPermissionsUpdate) {
      this.transport.broadcastPermissionsUpdate({
        type: 'permissions_update',
        permissions: this.roomManager.permissions
      });
    }
  }

  public setAdminMute(peerId: string, isMuted: boolean): void {
    if (!this.isHost()) return;
    if (this.transport.broadcastAdminMute) {
      this.transport.broadcastAdminMute({
        type: 'admin_mute',
        targetPeerId: peerId,
        isMuted
      });
    }
  }

  public transferHost(newHostPeerId: string): void {
    if (!this.isHost() || !this.roomManager.roomInfo) return;
    this.roomManager.transferHost(newHostPeerId);
    if (this.transport.broadcastHostTransfer) {
      this.transport.broadcastHostTransfer({
        type: 'host_transfer',
        previousHostPeerId: this.selfId,
        newHostPeerId
      });
    }
  }

  // ==========================================
  // EVENTOS E SUBSCRIÇÕES
  // ==========================================

  public subscribe(listener: WatchPartyEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public on(targetEvent: string, callback: (data?: any) => void): () => void {
    const handler: WatchPartyEventListener = (event, data) => {
      if (event === targetEvent) {
        callback(data);
      }
    };
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  public onStateChange(callback: (state: any) => void): () => void {
    return this.on('state_changed', callback);
  }

  public onTransmissionStart(callback: (data: any) => void): () => void {
    return this.on('transmission_started', callback);
  }

  public onLifecycleChange(callback: (state: RoomLifecycleState) => void): () => void {
    return this.on('lifecycle_changed', callback);
  }

  public onPermissionsChange(callback: (perms: WatchPartyPermissions) => void): () => void {
    return this.on('permissions_updated', callback);
  }

  public onChatMessage(callback: (msg: WatchPartyChatMessage) => void): () => void {
    return this.on('chat_message_received', callback);
  }

  public onScreenStreamChange(callback: (stream: MediaStream | null) => void): () => void {
    return this.on('screen_stream_changed', callback);
  }

  public onParticipantChange(callback: (participants: (WatchPartyParticipant & { id: string })[]) => void): () => void {
    return this.on('participants_updated', callback);
  }

  public onPlaybackSync(callback: (sync: WatchPartyPlaybackState) => void): () => void {
    return this.on('playback_synced', callback);
  }

  public onChangeEpisode(callback: (data: any) => void): () => void {
    return this.on('episode_changed', callback);
  }

  public onBufferingChange(callback: (peerId: string, isBuffering: boolean) => void): () => void {
    return this.on('buffering_changed', (data: any) => {
      if (data) callback(data.peerId, data.isBuffering);
    });
  }

  public onVoiceStateChange(callback: (data: { isVoiceActive: boolean; isMuted: boolean }) => void): () => void {
    return this.on('voice_state_changed', callback);
  }

  public onHostStreamReceived(callback: (stream: MediaStream | null) => void): () => void {
    return this.on('host_stream_received', callback);
  }

  public onStreamConnectionChange(callback: (data: { status: 'good' | 'fair' | 'poor'; message: string }) => void): () => void {
    return this.on('stream_connection_changed', callback);
  }

  public onRemoteControlReceived(callback: (request: PeerRemoteControlRequestMessage) => void): () => void {
    return this.on('remote_control_received', callback);
  }

  public onHostBroadcastStart(callback: (data: { mode: TransmissionMode; captureMethod: string; stream: MediaStream }) => void): () => void {
    return this.on('host_broadcast_started', callback);
  }

  public onHostBroadcastStop(callback: () => void): () => void {
    return this.on('host_broadcast_stopped', callback);
  }

  private notify(event: string, data?: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (err) {
        console.error(`[WatchPartyService] Erro no listener do evento "${event}":`, err);
      }
    });
  }

  // ==========================================
  // HEARTBEAT & SINCRONIZAÇÃO COM SERVIDOR HTTP
  // ==========================================

  private startHeartbeatLoop(roomId: string): void {
    this.stopHeartbeatLoop();

    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected || !this.roomManager.roomInfo) return;

      // 1. Heartbeat via API REST
      fetch(`/api/watchparty/room/${roomId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: this.selfId,
          nickname: this.currentNickname,
          isHost: this.isHost(),
          status: 'ready'
        })
      }).catch(() => {});

      // 2. Broadcast P2P de Presença
      this.transport.broadcastParticipantState({
        type: 'participant_state',
        nickname: this.currentNickname,
        status: 'ready',
        isAudioMuted: this.isMicrophoneMuted(),
        isSpeaking: false
      });
    }, 4000);

    // Ping para telemetria de rede
    this.pingInterval = setInterval(async () => {
      if (this.transport.getPing) {
        for (const peerId of this.transport.getConnectedPeers()) {
          const rtt = await this.transport.getPing(peerId);
          this.updatePeerHealth(peerId, { connectionState: rtt < 300 ? 'excellent' : 'fair' });
        }
      }
    }, 10000);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private announceRoomToServer(
    roomId: string,
    media: WatchPartyMediaMetadata,
    mode: TransmissionMode,
    nickname: string
  ): void {
    fetch('/api/watchparty/room/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        hostPeerId: this.selfId,
        hostNickname: nickname,
        media,
        transmissionMode: mode,
        lifecycleState: 'LOBBY'
      })
    }).catch(() => {});
  }

  private fetchRoomFromServer(roomId: string): void {
    fetch(`/api/watchparty/room/${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data?.ok && data.room) {
          this.roomManager.updateRoomInfo({
            hostPeerId: data.room.hostPeerId,
            hostNickname: data.room.hostNickname || 'Host',
            media: data.room.media,
            transmissionMode: data.room.transmissionMode || 'source',
            lifecycleState: data.room.lifecycleState || 'LOBBY'
          });
          this.notify('room_announcement_received', data.room);
          this.notify('state_changed', this.getRoomState());
        }
      })
      .catch(() => {});
  }

  private setupNetworkReconnectionListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      if (this.isConnected) {
        this.logDiagnostic('SIGNALING_READY', { reason: 'network_online' });
        this.stateMachine.transitionTo('RECONNECTING', 'network_online', true);
        this.transport.requestSync();
        setTimeout(() => {
          this.stateMachine.transitionTo('LOBBY', 'reconnected', true);
        }, 1500);
      }
    });

    window.addEventListener('offline', () => {
      if (this.isConnected) {
        this.stateMachine.transitionTo('RECONNECTING', 'network_offline', true);
      }
    });
  }
}

export const watchPartyService = WatchPartyService.getInstance();
