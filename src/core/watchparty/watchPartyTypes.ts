/**
 * ZapiTV — Watch Party Types & Protocol Definitions
 * 
 * Define o modelo de dados para sincronização P2P, estados de reprodução,
 * participantes, mensagens de chat e eventos de controle via Trystero/WebRTC.
 */

import { ContentType } from '../../../types';

export type ParticipantStatus = 'connected' | 'buffering' | 'ready' | 'disconnected';

export type RoomLifecycleState =
  | 'CREATING'
  | 'LOBBY'
  | 'PREPARING'
  | 'READY'
  | 'STARTING'
  | 'PLAYING_INTRO'
  | 'PLAYING_CONTENT'
  | 'PAUSED'
  | 'RECONNECTING'
  | 'ENDED'
  | 'ERROR'
  | 'PLAYING';

export type ConnectionDiagnosticStep =
  | 'ROOM_CREATE'
  | 'ROOM_REGISTER'
  | 'ROOM_LOOKUP'
  | 'PEER_DISCOVERY'
  | 'ROOM_JOIN'
  | 'JOIN_ACK'
  | 'STATE_SYNC'
  | 'SIGNALING_READY'
  | 'MEDIA_NEGOTIATION'
  | 'ICE_CONNECTED'
  | 'REMOTE_TRACK_RECEIVED'
  | 'REMOTE_MEDIA_PLAYING';

export interface PeerConnectionHealth {
  peerId: string;
  iceState?: string;
  connectionState?: string;
  hasAudioTrack: boolean;
  hasVideoTrack: boolean;
  lastActivityTimestamp: number;
}

export interface ParticipantPermissions {
  canPlayPause: boolean;
  canSeek: boolean;
  canChangeEpisode: boolean;
  canSkip: boolean;
}

export interface WatchPartyPermissions {
  allowChat: boolean;
  allowVoice: boolean;
  participantPermissions: Record<string, ParticipantPermissions>;
}

export interface WatchPartyMediaMetadata {
  id: string;
  title: string;
  type: ContentType | string;
  mediaFormat?: 'movie' | 'series';
  tmdbId?: string;
  imdbId?: string;
  season?: number;
  episode?: number;
  year?: number;
  image?: string;
  backdrop?: string;
  // Aliases compatíveis com outros módulos
  contentId?: string;
  posterUrl?: string;
  backdropUrl?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface WatchPartyParticipant {
  peerId: string;
  nickname: string;
  isHost: boolean;
  status: ParticipantStatus;
  joinedAt: number;
  isAudioMuted?: boolean;
  isSpeaking?: boolean;
  audioVolume?: number; // 0.0 a 1.0
  isLocallyMuted?: boolean;
  isAdminMuted?: boolean;
  permissions?: ParticipantPermissions;
}

export interface WatchPartyPlaybackState {
  mediaId: string;
  mediaType: string;
  season?: number;
  episode?: number;
  positionSeconds: number;
  currentTime: number; // alias para positionSeconds garantindo compatibilidade total
  isPlaying: boolean;
  playbackState?: 'playing' | 'paused' | 'buffering';
  playbackRate: number;
  eventTimestamp: number;
  referenceTimestamp?: number;
  sequence: number;
  hostPeerId: string;
  duration?: number;
  sessionId?: string;
  roomId?: string;
}

export interface WatchPartyChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  isHost: boolean;
  text: string;
  timestamp: number;
}

export type TransmissionMode = 'source' | 'host_broadcast' | 'screen';

export interface WatchPartyRoomInfo {
  roomId: string;
  hostPeerId: string;
  hostNickname?: string;
  media: WatchPartyMediaMetadata;
  createdAt: number;
  maxParticipants: number;
  lifecycleState: RoomLifecycleState;
  transmissionMode?: TransmissionMode;
  permissions: WatchPartyPermissions;
  introStartTimestamp?: number;
  introDuration?: number;
}

export interface PeerSyncMessage {
  type: 'playback_state';
  state: WatchPartyPlaybackState;
}

export interface PeerRequestSyncMessage {
  type: 'request_sync';
  senderPeerId: string;
}

export interface PeerParticipantStateMessage {
  type: 'participant_state';
  nickname: string;
  status: ParticipantStatus;
  isAudioMuted?: boolean;
  isSpeaking?: boolean;
  isAdminMuted?: boolean;
  isMediaReady?: boolean;
}

export interface PeerEpisodeChangeMessage {
  type: 'change_episode';
  sequence: number;
  season: number;
  episode: number;
  media: WatchPartyMediaMetadata;
}

export interface PeerRoomAnnounceMessage {
  type: 'room_announcement';
  roomInfo: WatchPartyRoomInfo;
}

export interface PeerHostTransferMessage {
  type: 'host_transfer';
  previousHostPeerId: string;
  newHostPeerId: string;
  authSignature?: string;
}

export interface PeerStartTransmissionMessage {
  type: 'start_transmission';
  hostPeerId: string;
  timestamp: number;
  media: WatchPartyMediaMetadata;
  mode?: TransmissionMode;
  lifecycleState?: RoomLifecycleState;
  introStartTimestamp?: number;
  introDuration?: number;
}

export interface PeerPermissionsUpdateMessage {
  type: 'permissions_update';
  permissions: WatchPartyPermissions;
}

export interface PeerAdminMuteMessage {
  type: 'admin_mute';
  targetPeerId: string;
  isMuted: boolean;
}

export interface PeerRemoteControlRequestMessage {
  type: 'remote_control_request';
  action: 'play' | 'pause' | 'seek' | 'next_episode';
  payload?: {
    positionSeconds?: number;
    season?: number;
    episode?: number;
  };
  senderPeerId: string;
  senderNickname?: string;
  timestamp: number;
}

export interface HostBroadcastStatus {
  isBroadcasting: boolean;
  mode: TransmissionMode;
  captureMethod?: 'captureStream' | 'getDisplayMedia';
  videoTracks: number;
  audioTracks: number;
  connectionQuality?: 'good' | 'fair' | 'poor';
}

