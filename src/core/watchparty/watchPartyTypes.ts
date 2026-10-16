/**
 * ZapiTV — Watch Party Types & Protocol Definitions
 * 
 * Define o modelo de dados para sincronização P2P, estados de reprodução,
 * participantes, mensagens de chat e eventos de controle via Trystero/WebRTC.
 */

import { ContentType } from '../../../types';

export type ParticipantStatus = 'connected' | 'buffering' | 'ready' | 'disconnected';

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
}

export interface WatchPartyPlaybackState {
  mediaId: string;
  mediaType: string;
  season?: number;
  episode?: number;
  positionSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  eventTimestamp: number;
  sequence: number;
  hostPeerId: string;
}

export interface WatchPartyChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  isHost: boolean;
  text: string;
  timestamp: number;
}

export interface WatchPartyRoomInfo {
  roomId: string;
  hostPeerId: string;
  media: WatchPartyMediaMetadata;
  createdAt: number;
  maxParticipants: number;
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
