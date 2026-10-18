/**
 * ZapiTV — WatchPartyRoomManager
 * 
 * Gerenciador de Sala, Presença e Permissões da Watch Party.
 * Atua como Single Source of Truth (SSOT) para o estado da sala, metadados da mídia,
 * lista canônica de participantes e sanitização rigorosa de Room IDs.
 */

import {
  WatchPartyRoomInfo,
  WatchPartyParticipant,
  WatchPartyMediaMetadata,
  WatchPartyPermissions,
  ParticipantPermissions,
  ParticipantStatus,
  TransmissionMode,
  PeerParticipantStateMessage
} from './watchPartyTypes';
import { WatchPartyStateMachine } from './WatchPartyStateMachine';

export type RoomChangeCallback = (roomInfo: WatchPartyRoomInfo | null) => void;
export type ParticipantsChangeCallback = (participants: (WatchPartyParticipant & { id: string })[]) => void;

export class WatchPartyRoomManager {
  private _selfId: string;
  private _nickname: string;
  private _isHost: boolean = false;
  private _roomInfo: WatchPartyRoomInfo | null = null;
  private _participants: Map<string, WatchPartyParticipant> = new Map();
  private _permissions: WatchPartyPermissions = {
    allowChat: true,
    allowVoice: true,
    participantPermissions: {}
  };

  private stateMachine: WatchPartyStateMachine;
  private roomChangeCallbacks: Set<RoomChangeCallback> = new Set();
  private participantChangeCallbacks: Set<ParticipantsChangeCallback> = new Set();

  constructor(selfId: string, stateMachine: WatchPartyStateMachine, defaultNickname: string = 'Gebelson') {
    this._selfId = selfId;
    this.stateMachine = stateMachine;
    this._nickname = defaultNickname;
  }

  // --- Getters & Setters ---

  public get selfId(): string {
    return this._selfId;
  }

  public get nickname(): string {
    return this._nickname;
  }

  public set nickname(val: string) {
    this._nickname = val.trim() || 'Usuário';
    this.updateLocalParticipantRecord();
  }

  public get isHost(): boolean {
    return this._isHost;
  }

  public set isHost(val: boolean) {
    this._isHost = val;
    this.updateLocalParticipantRecord();
  }

  public get roomInfo(): WatchPartyRoomInfo | null {
    return this._roomInfo;
  }

  public get permissions(): WatchPartyPermissions {
    return this._permissions;
  }

  // --- Sanitização Canônica de IDs e URLs de Sala ---

  public static sanitizeRoomId(rawId: string): string {
    if (!rawId) return '';
    let clean = String(rawId).trim();
    // Decodifica se houver URI encode repetido
    try {
      if (clean.includes('%')) {
        clean = decodeURIComponent(clean);
      }
    } catch {
      // Ignora erro de URI malformado
    }
    // Remove colchetes acidentais, aspas, espaços e sufixos codificados como %5B, %5D
    clean = clean.replace(/%5b/gi, '').replace(/%5d/gi, '');
    clean = clean.replace(/[\[\]"'`]/g, '');
    clean = clean.replace(/[\s\r\n\t]+/g, '');
    // Se for URL completa, extrai a parte final
    if (clean.includes('/sala/')) {
      const parts = clean.split('/sala/');
      clean = parts[parts.length - 1];
    } else if (clean.includes('room=')) {
      const match = clean.match(/room=([^&]+)/);
      if (match) clean = match[1];
    }
    // Remove qualquer query string ou hash restante
    clean = clean.split('?')[0].split('#')[0];
    return clean;
  }

  public getInviteUrl(roomId?: string): string {
    const id = WatchPartyRoomManager.sanitizeRoomId(roomId || this._roomInfo?.roomId || '');
    if (!id) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://zapitv.vercel.app';
    return `${base}/sala/${id}`;
  }

  // --- Inicialização de Sala (Host e Convidado) ---

  public initRoomAsHost(
    roomId: string,
    media: WatchPartyMediaMetadata,
    options?: {
      maxParticipants?: number;
      transmissionMode?: TransmissionMode;
      allowChat?: boolean;
      allowVoice?: boolean;
    }
  ): WatchPartyRoomInfo {
    const cleanId = WatchPartyRoomManager.sanitizeRoomId(roomId);
    this._isHost = true;

    this._permissions = {
      allowChat: options?.allowChat ?? true,
      allowVoice: options?.allowVoice ?? true,
      participantPermissions: {}
    };

    this.stateMachine.reset('LOBBY');

    this._roomInfo = {
      roomId: cleanId,
      hostPeerId: this._selfId,
      hostNickname: this._nickname,
      media,
      createdAt: Date.now(),
      maxParticipants: options?.maxParticipants || 6,
      lifecycleState: 'LOBBY',
      transmissionMode: options?.transmissionMode || 'source',
      permissions: this._permissions
    };

    this._participants.clear();
    this.updateLocalParticipantRecord();
    this.notifyRoomChange();
    this.notifyParticipantChange();

    return this._roomInfo;
  }

  public initRoomAsGuest(
    roomId: string,
    initialMedia?: WatchPartyMediaMetadata
  ): WatchPartyRoomInfo {
    const cleanId = WatchPartyRoomManager.sanitizeRoomId(roomId);
    this._isHost = false;

    this.stateMachine.reset('LOBBY');

    this._roomInfo = {
      roomId: cleanId,
      hostPeerId: '', // Preenchido no anúncio da sala
      hostNickname: 'Host',
      media: initialMedia || { id: 'pending', title: 'Carregando sala...', type: 'movie' },
      createdAt: Date.now(),
      maxParticipants: 6,
      lifecycleState: 'LOBBY',
      transmissionMode: 'source',
      permissions: this._permissions
    };

    this._participants.clear();
    this.updateLocalParticipantRecord();
    this.notifyRoomChange();
    this.notifyParticipantChange();

    return this._roomInfo;
  }

  public updateRoomInfo(partial: Partial<WatchPartyRoomInfo>): void {
    if (!this._roomInfo) return;
    this._roomInfo = {
      ...this._roomInfo,
      ...partial
    };

    if (partial.lifecycleState) {
      this.stateMachine.transitionTo(partial.lifecycleState, 'room_info_update', true);
    }
    if (partial.permissions) {
      this._permissions = partial.permissions;
    }
    this.notifyRoomChange();
  }

  public closeRoom(): void {
    this._roomInfo = null;
    this._participants.clear();
    this._isHost = false;
    this.stateMachine.reset('ENDED');
    this.notifyRoomChange();
    this.notifyParticipantChange();
  }

  // --- Gerenciamento de Participantes ---

  private updateLocalParticipantRecord(): void {
    const localPerms = this.getParticipantPermissions(this._selfId);
    this._participants.set(this._selfId, {
      peerId: this._selfId,
      nickname: this._nickname,
      isHost: this._isHost,
      status: 'connected',
      joinedAt: this._participants.get(this._selfId)?.joinedAt || Date.now(),
      permissions: localPerms
    });
  }

  public handlePeerJoin(peerId: string): void {
    if (!this._participants.has(peerId)) {
      const defaultPerms: ParticipantPermissions = {
        canPlayPause: true,
        canSeek: true,
        canChangeEpisode: false,
        canSkip: true
      };
      this._participants.set(peerId, {
        peerId,
        nickname: peerId === this._roomInfo?.hostPeerId ? (this._roomInfo?.hostNickname || 'Host') : `Convidado ${peerId.slice(0, 4)}`,
        isHost: peerId === this._roomInfo?.hostPeerId,
        status: 'connected',
        joinedAt: Date.now(),
        permissions: defaultPerms
      });
      this.notifyParticipantChange();
    }
  }

  public handlePeerLeave(peerId: string): void {
    if (this._participants.has(peerId)) {
      this._participants.delete(peerId);
      this.notifyParticipantChange();
    }
  }

  public handlePeerStateMessage(peerId: string, state: PeerParticipantStateMessage): void {
    const existing = this._participants.get(peerId);
    const isHostPeer = peerId === this._roomInfo?.hostPeerId;

    const updated: WatchPartyParticipant = {
      peerId,
      nickname: state.nickname || existing?.nickname || `Convidado ${peerId.slice(0, 4)}`,
      isHost: isHostPeer,
      status: state.status || existing?.status || 'connected',
      joinedAt: existing?.joinedAt || Date.now(),
      isAudioMuted: state.isAudioMuted ?? existing?.isAudioMuted,
      isSpeaking: state.isSpeaking ?? existing?.isSpeaking,
      isAdminMuted: state.isAdminMuted ?? existing?.isAdminMuted,
      isLocallyMuted: existing?.isLocallyMuted,
      audioVolume: existing?.audioVolume ?? 1.0,
      permissions: existing?.permissions || this.getParticipantPermissions(peerId)
    };

    this._participants.set(peerId, updated);

    // Se o peer for host e informou um nickname, atualiza na sala
    if (isHostPeer && this._roomInfo && state.nickname) {
      this._roomInfo.hostNickname = state.nickname;
    }

    this.notifyParticipantChange();
  }

  public getParticipantList(): (WatchPartyParticipant & { id: string })[] {
    return Array.from(this._participants.values()).map(p => ({
      ...p,
      id: p.peerId
    }));
  }

  public setParticipantStatus(peerId: string, status: ParticipantStatus): void {
    const p = this._participants.get(peerId);
    if (p) {
      p.status = status;
      this.notifyParticipantChange();
    }
  }

  public setParticipantSpeaking(peerId: string, isSpeaking: boolean): void {
    const p = this._participants.get(peerId);
    if (p && p.isSpeaking !== isSpeaking) {
      p.isSpeaking = isSpeaking;
      this.notifyParticipantChange();
    }
  }

  // --- Permissões e Moderação ---

  public getParticipantPermissions(peerId: string): ParticipantPermissions {
    if (peerId === this._selfId && this._isHost) {
      return { canPlayPause: true, canSeek: true, canChangeEpisode: true, canSkip: true };
    }
    const perms = this._permissions.participantPermissions[peerId];
    if (perms) return perms;
    return {
      canPlayPause: true,
      canSeek: true,
      canChangeEpisode: false,
      canSkip: true
    };
  }

  public setParticipantPermission(peerId: string, perm: keyof ParticipantPermissions, value: boolean): void {
    if (!this._permissions.participantPermissions[peerId]) {
      this._permissions.participantPermissions[peerId] = { ...this.getParticipantPermissions(peerId) };
    }
    this._permissions.participantPermissions[peerId][perm] = value;
    const p = this._participants.get(peerId);
    if (p) {
      p.permissions = this._permissions.participantPermissions[peerId];
      this.notifyParticipantChange();
    }
  }

  public updateParticipantPermissions(peerId: string, perms: Partial<ParticipantPermissions>): void {
    if (!this._permissions.participantPermissions[peerId]) {
      this._permissions.participantPermissions[peerId] = { ...this.getParticipantPermissions(peerId) };
    }
    Object.assign(this._permissions.participantPermissions[peerId], perms);
    const p = this._participants.get(peerId);
    if (p) {
      p.permissions = this._permissions.participantPermissions[peerId];
      this.notifyParticipantChange();
    }
  }

  public setRoomConfig(config: { allowChat?: boolean; allowVoice?: boolean }): void {
    if (typeof config.allowChat === 'boolean') this._permissions.allowChat = config.allowChat;
    if (typeof config.allowVoice === 'boolean') this._permissions.allowVoice = config.allowVoice;
    if (this._roomInfo) {
      this._roomInfo.permissions = this._permissions;
      this.notifyRoomChange();
    }
  }

  public transferHost(newHostPeerId: string): void {
    if (!this._roomInfo) return;
    this._roomInfo.hostPeerId = newHostPeerId;
    const newHost = this._participants.get(newHostPeerId);
    if (newHost) {
      this._roomInfo.hostNickname = newHost.nickname;
      newHost.isHost = true;
    }
    if (this._selfId !== newHostPeerId) {
      this._isHost = false;
    }
    this.updateLocalParticipantRecord();
    this.notifyRoomChange();
    this.notifyParticipantChange();
  }

  // --- Subscrições ---

  public onRoomChange(cb: RoomChangeCallback): () => void {
    this.roomChangeCallbacks.add(cb);
    return () => this.roomChangeCallbacks.delete(cb);
  }

  public onParticipantsChange(cb: ParticipantsChangeCallback): () => void {
    this.participantChangeCallbacks.add(cb);
    return () => this.participantChangeCallbacks.delete(cb);
  }

  private notifyRoomChange(): void {
    this.roomChangeCallbacks.forEach(cb => {
      try {
        cb(this._roomInfo);
      } catch (e) {
        console.error('[WatchPartyRoomManager] Erro no callback de room change:', e);
      }
    });
  }

  private notifyParticipantChange(): void {
    const list = this.getParticipantList();
    this.participantChangeCallbacks.forEach(cb => {
      try {
        cb(list);
      } catch (e) {
        console.error('[WatchPartyRoomManager] Erro no callback de participant change:', e);
      }
    });
  }
}
