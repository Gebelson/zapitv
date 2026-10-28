import assert from 'node:assert/strict';

const data = new Map<string, string>();
const storage = { getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); },
  clear: () => data.clear(), key: (n: number) => [...data.keys()][n] ?? null, get length() { return data.size; } };
Object.assign(globalThis, { localStorage: storage, window: { localStorage: storage, location: { origin: 'https://test.invalid' },
  addEventListener() {}, removeEventListener() {} } });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });

async function run() {
  const { SyncQueueManager } = await import('../src/core/sync/syncQueue');
  const queues: InstanceType<typeof SyncQueueManager>[] = [];
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let response: (body: any) => any = () => ({});
  globalThis.fetch = async (_url, options) => { calls++; return Response.json(await response(JSON.parse(String(options?.body || '{}')))); };
  const queue = (profile = 'profile_A', account = 'account_A') => {
    const q = new SyncQueueManager(); queues.push(q); q.setAccountScope(account, profile); return q;
  };
  const seed = (q: InstanceType<typeof SyncQueueManager>, profile: string, type: 'progress' | 'history' | 'my_list' | 'favorites', age = 0) => {
    (navigator as any).onLine = false;
    const item = q.enqueue(profile, { type, action: 'save', data: { canonicalId: `${type}-work`, positionSec: 12 } });
    if (age) {
      item.timestamp -= age;
      storage.setItem(q.getStorageKey(profile), JSON.stringify(q.getQueue(profile)));
    }
    return structuredClone(item);
  };
  try {
    const q = queue();
    const ok = seed(q, 'profile_A', 'progress');
    const expired = seed(q, 'profile_A', 'favorites', 8 * 86400000);
    const transient = seed(q, 'profile_A', 'history');
    response = () => ({ success: true, processed: 3, results: [
      { id: transient.id, success: false, error: 'TEMPORARY_FAILURE' },
      { id: expired.id, success: false, error: 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP' },
      { id: ok.id, success: true }, { id: 'unrequested-uuid', success: true }
    ] });
    (navigator as any).onLine = true;
    await q.flush('profile_A');
    assert.equal(q.getQueue('profile_A').length, 2, 'only individually acknowledged UUID can disappear');
    assert.equal(q.getConflicts('profile_A').length, 1);
    assert.equal(q.getPendingCount('profile_A'), 1);
    assert.equal(q.getConflicts('profile_A')[0].timestamp, expired.timestamp);
    assert.deepEqual(q.getConflicts('profile_A')[0].data, expired.data);
    q.pauseAndUnloadQueues();
    const reloaded = queue();
    assert.equal(reloaded.getConflicts('profile_A')[0].id, expired.id, 'F5 retains conflict');
    assert.equal(reloaded.getPendingCount('profile_A'), 1);
    reloaded.setAccountScope('account_B', 'profile_B');
    const beforeOtherAccount = calls;
    await reloaded.flush('profile_A', 'account_A');
    assert.equal(calls, beforeOtherAccount, 'other account cannot submit old queue');
    assert.equal(reloaded.getConflicts('profile_A', 'account_A').length, 0);
    reloaded.setAccountScope('account_A', 'profile_A');
    assert.equal(reloaded.getConflicts('profile_A').length, 1, 'logout/relogin retains original record');
    response = () => ({ success: true, results: [{ id: transient.id, success: true, duplicate: true }] });
    await reloaded.flush('profile_A');
    assert.equal(reloaded.getPendingCount('profile_A'), 0);
    const afterAck = calls;
    await reloaded.flush('profile_A'); reloaded.flushAllActiveQueues();
    assert.equal(calls, afterAck, 'permanent rejection is never automatically resent');

    const incomplete = queue('partial');
    const missing = seed(incomplete, 'partial', 'my_list');
    response = () => ({ success: true, results: [] });
    (navigator as any).onLine = true; await incomplete.flush('partial');
    assert.equal(incomplete.getQueue('partial')[0].id, missing.id);
    response = () => ({ success: true, results: [{ id: missing.id, success: false, duplicate: true }] });
    await incomplete.flush('partial');
    assert.equal(incomplete.getPendingCount('partial'), 1, 'contradictory result is not confirmation');
    globalThis.fetch = async () => { throw new TypeError('Network offline'); };
    await incomplete.flush('partial');
    assert.equal(incomplete.getQueue('partial')[0].id, missing.id);
    incomplete.pauseAndUnloadQueues();

    const review = queue();
    globalThis.fetch = async () => Response.json({ profileId: 'profile_A', serverTime: Date.now(), progress: [], history: [], myList: [],
      favorites: [{ canonicalId: expired.data.canonicalId, isRemoved: 1, updatedAt: Date.now() }] });
    const comparison = await review.reviewConflicts('profile_A', 'account_A');
    assert.equal(comparison?.[0].remote?.isRemoved, 1);
    assert.equal(review.getConflicts('profile_A')[0].id, expired.id);
    assert.equal(review.getPendingCount('profile_A'), 0, 'review never creates a replacement mutation');
    review.setAccountScope('account_A', 'different-profile');
    assert.equal(review.getConflicts('profile_A').length, 0);
    const bounded = queue('bounded');
    const retryItem = seed(bounded, 'bounded', 'progress');
    let failures = 0;
    globalThis.fetch = async () => { failures++; throw new TypeError('Offline'); };
    (navigator as any).onLine = true;
    for (let n = 0; n < 12; n++) await bounded.flush('bounded');
    assert.equal(failures, 5, 'automatic retries are bounded');
    assert.equal(bounded.getQueue('bounded')[0].id, retryItem.id);
    bounded.pauseAndUnloadQueues();
    const boundedReload = queue('bounded');
    await boundedReload.flush('bounded');
    assert.equal(failures, 5, 'reload does not reset exhausted retry budget');
    await boundedReload.retryPending('bounded');
    assert.equal(failures, 6, 'a new explicit retry is allowed');
    boundedReload.pauseAndUnloadQueues();

    const flight = queue('flight');
    const first = seed(flight, 'flight', 'progress');
    let release!: (response: Response) => void;
    globalThis.fetch = () => new Promise(resolve => { release = resolve; });
    (navigator as any).onLine = true;
    const sending = flight.flush('flight');
    const next = seed(flight, 'flight', 'progress');
    assert.notEqual(first.id, next.id, 'new intent cannot mutate an in-flight UUID');
    release(Response.json({ success: true, results: [{ id: first.id, success: true }] }));
    await sending;
    assert.equal(flight.getQueue('flight')[0].id, next.id);
    flight.pauseAndUnloadQueues();

    const switched = queue('switch');
    const beforeSwitch = seed(switched, 'switch', 'my_list');
    globalThis.fetch = () => new Promise(resolve => { release = resolve; });
    (navigator as any).onLine = true;
    const inFlight = switched.flush('switch');
    switched.setAccountScope('account_B', 'other-profile');
    release(Response.json({ success: true, results: [{ id: beforeSwitch.id, success: true }] }));
    await inFlight;
    switched.setAccountScope('account_A', 'switch');
    assert.equal(switched.getQueue('switch')[0].id, beforeSwitch.id, 'late response after logout cannot erase pending data');
    const timeoutQueue = queue('timeout');
    const timed = seed(timeoutQueue, 'timeout', 'history');
    const previousTimeout = (await import('../src/core/sync/syncClient')).syncClient as any;
    const milliseconds = previousTimeout.timeoutMs;
    previousTimeout.timeoutMs = 10;
    globalThis.fetch = (_url, options) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(Response.json({ success: true, results: [{ id: timed.id, success: true }] })), 40);
      options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });
    (navigator as any).onLine = true;
    try {
      await timeoutQueue.flush('timeout');
      assert.equal(timeoutQueue.getQueue('timeout')[0]?.id, timed.id, 'request deadline still applies with a logout signal');
    } finally { previousTimeout.timeoutMs = milliseconds; }
    console.log('Outbox: mixed/incomplete batches, network, duplicates, expiry, reload, isolation and read-only review passed.');
  } finally {
    globalThis.fetch = originalFetch;
    queues.forEach(q => q.pauseAndUnloadQueues());
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
