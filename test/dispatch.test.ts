/*
 * A dispatch, and the host's answer to it.
 *
 * The protocol gives a dispatch no result: the host echoes an accepted action
 * to the channel's subscribers with the origin of the client that sent it, and
 * sends a rejected one back with its reason. That echo is the whole answer,
 * which is why a dispatch that waits has to be subscribed.
 *
 * The registry is driven directly here, so what a waiter does when an echo
 * arrives is stated once rather than inferred through a command. The last case
 * goes through the live client, because the subscribe that makes an echo
 * possible is its half of the bargain.
 */

import { describe, expect, it, vi } from 'vitest';
import { openChannels } from '../src/ahp/channels.js';
import type { AddressedEvent, Channels, ChannelClient } from '../src/ahp/channels.js';
import { CHAT, SESSION, connect } from './scenario.js';

const CHANNEL = 'ahp-chat:/s1';

/** A protocol client that is fed the host's frames one at a time. */
function registry(clientId = 'ahpc-test'): {
  channels: Channels;
  send(event: AddressedEvent): Promise<void>;
  rejections: string[];
} {
  const feed: AddressedEvent[] = [];
  let notify: (() => void) | undefined;
  const client: ChannelClient = {
    subscribe: async () => ({ result: { snapshot: { state: {}, fromSeq: 0 } } }),
    unsubscribe: async () => undefined,
    events: async function* () {
      for (;;) {
        if (feed.length === 0) {
          await new Promise<void>((resolve) => { notify = resolve; });
          notify = undefined;
        }
        while (feed.length > 0) yield feed.shift() as AddressedEvent;
      }
    },
  };
  const rejections: string[] = [];
  const channels = openChannels({
    client,
    clientId,
    reason: (error) => String(error),
    onRejection: (_uri, message) => { rejections.push(message); },
  });
  channels.drain(client);
  return {
    channels,
    rejections,
    send: async (event) => {
      feed.push(event);
      const resume = notify;
      notify = undefined;
      resume?.();
      // Let the drain loop hand it to the registry before the assertion.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    },
  };
}

/** One action envelope, as a host sends it to the channel's subscribers. */
function echo(clientId: string, clientSeq: number, why?: string): AddressedEvent {
  return {
    channel: CHANNEL,
    event: {
      type: 'action',
      params: {
        channel: CHANNEL,
        action: { type: 'chat/pendingMessageRemoved', kind: 'queued', id: 'q1' },
        serverSeq: why === undefined ? 1 : 0,
        origin: { clientId, clientSeq },
        ...(why === undefined ? {} : { rejectionReason: why }),
      },
    },
  };
}

describe('a dispatch waiting for its echo', () => {
  it('resolves with no refusal when the host echoes the action', async () => {
    const { channels, send } = registry();
    const answer = channels.await(5, 10_000);

    await send(echo('ahpc-test', 5));

    await expect(answer).resolves.toEqual({});
  });

  it('takes the reason a rejection carries, and reports it only once', async () => {
    const { channels, send, rejections } = registry();
    const answer = channels.await(6, 10_000);

    await send(echo('ahpc-test', 6, 'No message with that id is waiting.'));

    await expect(answer).resolves.toEqual({ refused: 'No message with that id is waiting.' });
    expect(rejections).toEqual([]);
  });

  it('is not settled by an echo with another client\'s origin', async () => {
    const { channels, send } = registry();
    const answer = channels.await(7, 10_000);

    await send(echo('another-client', 7, 'not yours'));
    await send(echo('ahpc-test', 7));

    await expect(answer).resolves.toEqual({});
  });

  it('resolves applied when the host never answers', async () => {
    vi.useFakeTimers();
    try {
      const { channels } = registry();
      const answer = channels.await(8, 10_000);

      await vi.advanceTimersByTimeAsync(10_000);

      await expect(answer).resolves.toEqual({});
    }
    finally {
      vi.useRealTimers();
    }
  });
});

describe('a dispatch through the live client', () => {
  it('resolves when the host echoes it on the channel it holds', async () => {
    const { host } = await connect((one) => {
      one.echo = true;
      one.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
      one.states.set(CHAT, { resource: CHAT, title: 'Chat', turns: [] });
    });

    await expect(host.unqueue(SESSION as never, 'q1')).resolves.toEqual({});
    expect(host.state()).toBe('connected');

    await host.close();
  });
});
