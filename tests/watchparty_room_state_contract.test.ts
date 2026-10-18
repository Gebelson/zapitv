import assert from 'node:assert/strict';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';
import { WatchPartyRoomManager } from '../src/core/watchparty/WatchPartyRoomManager';

const transport = { selfId: 'local-test-peer' };
const service = new (WatchPartyService as any)(transport) as WatchPartyService;
const roomManager = (service as any).roomManager as WatchPartyRoomManager;

const idle = service.getRoomState();
assert.equal(idle.isActive, false);
assert.equal(idle.localParticipant.peerId, transport.selfId);
assert.equal(idle.localParticipant.isHost, false);
assert.equal(idle.mediaMetadata, null);

const media = WatchPartyService.normalizeMedia({ id: 'movie-1', title: 'Filme de teste', type: 'movie' });
roomManager.nickname = 'Anfitrião';
roomManager.initRoomAsHost('zapi-test', media);
roomManager.updateRoomInfo({ introStartTimestamp: 1234, introDuration: 5 });

const hosting = service.getRoomState();
assert.equal(hosting.isActive, true);
assert.equal(hosting.localParticipant.id, transport.selfId);
assert.equal(hosting.localParticipant.nickname, 'Anfitrião');
assert.equal(hosting.localParticipant.isHost, true);
assert.equal(hosting.participants.length, 1);
assert.equal(hosting.mediaMetadata?.id, media.id);
assert.equal(hosting.media, hosting.mediaMetadata);
assert.equal(hosting.introStartTimestamp, 1234);
assert.equal(hosting.introDuration, 5);

roomManager.closeRoom();
roomManager.nickname = 'Convidado';
roomManager.initRoomAsGuest('zapi-guest-test');

const joining = service.getRoomState();
assert.equal(joining.isActive, true);
assert.equal(joining.localParticipant.id, transport.selfId);
assert.equal(joining.localParticipant.nickname, 'Convidado');
assert.equal(joining.localParticipant.isHost, false);
assert.equal(joining.participants.length, 1);

console.log('Contrato do estado da Watch Party: OK');
