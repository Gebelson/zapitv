import { describe, expect, it, vi } from 'vitest';
import { TrysteroTransport } from '../src/core/watchparty/TrysteroTransport';

describe('Watch Party Trystero 0.26 protocol', () => {
  it('receives messages with the real peer ID and uses the targeted send options', async () => {
    const action = { onReceive: null, onMessage: null as null | ((data: unknown, context: { peerId: string }) => void), send: vi.fn().mockResolvedValue(undefined) };
    const transport = new TrysteroTransport();
    (transport as any).room = { makeAction: () => action };
    const receive = vi.fn();
    const send = (transport as any).registerAction('participant_state', receive);

    action.onMessage?.({ nickname: 'Maria' }, { peerId: 'guest-1' });
    expect(receive).toHaveBeenCalledWith({ nickname: 'Maria' }, 'guest-1');
    expect(action.onReceive).toBeNull();

    await send({ nickname: 'Host' }, 'guest-1');
    expect(action.send).toHaveBeenCalledWith({ nickname: 'Host' }, { target: 'guest-1' });
  });
});
