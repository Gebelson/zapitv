import assert from 'node:assert/strict';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { WatchPartyRoomManager } from '../src/core/watchparty/WatchPartyRoomManager';
import type { PeerStartTransmissionMessage } from '../src/core/watchparty/watchPartyTypes';

let sent: PeerStartTransmissionMessage | undefined;
let sentCount = 0;
const transport = {
  selfId: 'host-peer',
  broadcastRoomAnnouncement() {},
  getConnectedPeers() { return []; },
  broadcastStartTransmission(message: PeerStartTransmissionMessage) { sent = message; sentCount += 1; }
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('{}', { status: 200 });

try {
  assert.throws(() => WatchPartyService.normalizeMedia(null), /conteúdo válido/i);
  assert.throws(() => WatchPartyService.normalizeMedia({ id: '', title: 'Outra obra', type: 'movie' }), /identidade válida/i);
  const host = new (WatchPartyService as any)(transport) as WatchPartyService;
  const hostRoom = (host as any).roomManager as WatchPartyRoomManager;
  const media = WatchPartyService.normalizeMedia({ id: 'series-1', title: 'Série de teste', type: 'series', season: 1, episode: 1 });
  hostRoom.initRoomAsHost('zapi-intro-test', media);
  host.startTransmission('source');
  host.startTransmission('source');
  assert.equal(sentCount, 1, 'O início repetido não deve reiniciar a vinheta ou abrir o player novamente');

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

  const broadcastHost = new (WatchPartyService as any)(transport) as WatchPartyService;
  (broadcastHost as any).roomManager.initRoomAsHost('zapi-broadcast-test', media);
  let captureCalls = 0;
  const liveStream = { active: true } as MediaStream;
  (broadcastHost as any).broadcastService.startHostBroadcast = async () => {
    captureCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    return liveStream;
  };
  const [first, second] = await Promise.all([
    broadcastHost.startHostBroadcast(), broadcastHost.startHostBroadcast()
  ]);
  assert.equal(first, liveStream);
  assert.equal(second, liveStream);
  assert.equal(captureCalls, 1, 'Capturas simultâneas devem ser deduplicadas');
  assert.equal(sentCount, 2, 'Cada sala deve anunciar a intro uma vez');
  console.log('Intro sincronizada no estado do anfitrião e convidado: OK');
} finally {
  globalThis.fetch = originalFetch;
}
