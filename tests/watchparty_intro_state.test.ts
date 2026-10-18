import assert from 'node:assert/strict';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { WatchPartyRoomManager } from '../src/core/watchparty/WatchPartyRoomManager';
import type { PeerStartTransmissionMessage } from '../src/core/watchparty/watchPartyTypes';

let sent: PeerStartTransmissionMessage | undefined;
const transport = {
  selfId: 'host-peer',
  broadcastRoomAnnouncement() {},
  broadcastStartTransmission(message: PeerStartTransmissionMessage) { sent = message; }
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('{}', { status: 200 });

try {
  const host = new (WatchPartyService as any)(transport) as WatchPartyService;
  const hostRoom = (host as any).roomManager as WatchPartyRoomManager;
  const media = WatchPartyService.normalizeMedia({ id: 'series-1', title: 'Série de teste', type: 'series', season: 1, episode: 1 });
  hostRoom.initRoomAsHost('zapi-intro-test', media);
  host.startTransmission('source');

  const hostState = host.getRoomState();
  assert.equal(hostState.lifecycleState, 'PLAYING_INTRO');
  assert.ok(hostState.introStartTimestamp);
  assert.equal(hostState.introStartTimestamp, sent?.introStartTimestamp);
  assert.equal(hostState.introDuration, sent?.introDuration);

  const guest = new (WatchPartyService as any)({ selfId: 'guest-peer' }) as WatchPartyService;
  const guestRoom = (guest as any).roomManager as WatchPartyRoomManager;
  guestRoom.initRoomAsGuest('zapi-intro-test', media);
  (guest as any).handleIncomingStartTransmission(sent!, 'host-peer');

  const guestState = guest.getRoomState();
  assert.equal(guestState.lifecycleState, 'PLAYING_INTRO');
  assert.equal(guestState.introStartTimestamp, hostState.introStartTimestamp);
  assert.equal(guestState.introDuration, hostState.introDuration);
  console.log('Intro sincronizada no estado do anfitrião e convidado: OK');
} finally {
  globalThis.fetch = originalFetch;
}
