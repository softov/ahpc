import { expect, it } from 'vitest';
import { openChannels, type ChannelClient, type Consumer } from '../src/ahp/channels.js';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const reader = (): Consumer => ({ opened() {}, event() {} });
function deferred() {
  const requests: { resolve(value: { result: { snapshot: { state: object } } }): void; reject(error: Error): void }[] = [];
  const released: string[] = [];
  const client: ChannelClient = {
    subscribe: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    unsubscribe: async (uri) => { released.push(uri); },
    async *events() {},
  };
  const answer = () => requests.shift()!.resolve({ result: { snapshot: { state: { title: 'here' } } } });
  return { client, requests, released, answer };
}

it('releases an abandoned subscribe when it finally succeeds', async () => {
  const wire = deferred();
  const channels = openChannels({ client: wire.client, reason: String });
  channels.open('one', reader()).release();
  expect(wire.released).toEqual([]);
  wire.answer(); await tick();
  expect(wire.released).toEqual(['one']);
  expect(channels.held()).toEqual([]);
});

it('lets a returning reader take back the pending subscription', async () => {
  const wire = deferred();
  const channels = openChannels({ client: wire.client, reason: String });
  channels.open('one', reader()).release();
  const hold = channels.open('one', reader());
  expect(wire.requests).toHaveLength(1);
  wire.answer(); await tick();
  expect(wire.released).toEqual([]);
  hold.release(); await tick();
  expect(wire.released).toEqual(['one']);
});

it('does not unsubscribe a request that failed', async () => {
  const wire = deferred();
  const channels = openChannels({ client: wire.client, reason: String });
  channels.open('one', reader()).release();
  wire.requests.shift()!.reject(new Error('gone')); await tick();
  expect(wire.released).toEqual([]);
  expect(channels.held()).toEqual([]);
});

it('does not let an old response release a new connection', async () => {
  const old = deferred(); const next = deferred();
  const channels = openChannels({ client: old.client, reason: String });
  channels.open('one', reader()).release();
  channels.detach(); channels.resume(next.client, {});
  const hold = channels.open('one', reader());
  old.answer(); await tick();
  expect(next.released).toEqual([]);
  next.answer(); await tick(); hold.release();
  expect(next.released).toEqual(['one']);
});

it('does not replay into a fresh baseline an action it already contains', async () => {
  let answer!: (value: { result: { snapshot: { state: object; fromSeq: number } } }) => void;
  const client: ChannelClient = {
    subscribe: () => new Promise((resolve) => { answer = resolve; }),
    unsubscribe: async () => {},
    async *events() {
      yield { channel: 'one', event: { type: 'action', params: { serverSeq: 5 } } };
      yield { channel: 'one', event: { type: 'action', params: { serverSeq: 6 } } };
    },
  };
  const channels = openChannels({ client, reason: String });
  let value = 0;
  const hold = channels.open('one', {
    opened: (state) => { value = state?.value as number; },
    event: () => { value += 1; },
  });
  channels.drain(client); await tick();
  answer({ result: { snapshot: { state: { value: 5 }, fromSeq: 5 } } });
  await tick();
  expect(value).toBe(6);
  hold.release();
});
