/**
 * ZapiTV — IWatchPartyTransport
 * 
 * Interface desacoplada de transporte de dados para a Watch Party.
 * Permite alternar transparentemente entre Trystero (P2P WebRTC/Nostr)
 * e futuros transportes baseados em servidores WebSockets (ex: PartyServer).
 */

import {
  WatchPartyChatMessage,
  WatchPartyPlaybackState,
  PeerParticipantStateMessage,
  PeerEpisodeChangeMessage,
  PeerRoomAnnounceMessage
} from './watchPartyTypes';

export interface TransportCallbacks {
  onPeerJoin: (peerId: string) => void;
  onPeerLeave: (peerId: string) => void;
  onPlaybackSync: (state: WatchPartyPlaybackState, senderId: string) => void;
  onRequestSync: (senderId: string) => void;
  onParticipantState: (state: PeerParticipantStateMessage, senderId: string) => void;
  onChatMessage: (message: WatchPartyChatMessage) => void;
  onEpisodeChange: (change: PeerEpisodeChangeMessage, senderId: string) => void;
  onRoomAnnouncement: (announcement: PeerRoomAnnounceMessage, senderId: string) => void;
  onRemoteAudioStream?: (stream: MediaStream, peerId: string) => void;
}

export interface IWatchPartyTransport {
  selfId: string;
  isHost: boolean;
  
  joinRoom(roomId: string, callbacks: TransportCallbacks): Promise<void>;
  leaveRoom(): Promise<void>;
  
  broadcastPlaybackState(state: WatchPartyPlaybackState): void;
  sendPlaybackState(targetPeerId: string, state: WatchPartyPlaybackState): void;
  requestSync(targetPeerId?: string): void;
  
  broadcastParticipantState(state: PeerParticipantStateMessage): void;
  sendChatMessage(message: WatchPartyChatMessage): void;
  broadcastEpisodeChange(change: PeerEpisodeChangeMessage): void;
  broadcastRoomAnnouncement(announcement: PeerRoomAnnounceMessage): void;
  
  // Áudio / WebRTC de Voz Opcional
  addLocalAudioStream?(stream: MediaStream): void;
  removeLocalAudioStream?(stream: MediaStream): void;
  
  getPing?(peerId: string): Promise<number>;
  getConnectedPeers(): string[];
}
