/** Who is holding which channel open, and what the host is saying on it. */

/** One thing the host said on a channel: an action, or a protocol notification. */
export interface ChannelEvent {
  type: string;
  params?: unknown;
}

/** A channel event with the channel it arrived on. */
export interface AddressedEvent {
  channel: string;
  event: ChannelEvent;
}

/** State as the host holds it, before this client has read anything out of it. */
export type ChannelState = Record<string, unknown> | null;

/**
 * One reader of one channel.
 *
 * `opened` arrives before any `event`, and arrives *again* after a reconnect
 * that could not be closed by replay: a consumer rebuilds from the state it is
 * handed rather than assuming the one it had is still the truth.
 */
export interface Consumer {
  /** The channel's state, as of the moment this reader joined it. */
  opened(state: ChannelState): void;
  /** Everything the host sends on the channel, in the order it sent it. */
  event(event: ChannelEvent): void;
  /** The host would not serve the channel, in the words it used. */
  refused?(message: string): void;
}

/** What this registry needs of a protocol client. */
export interface ChannelClient {
  subscribe(uri: string): Promise<{ result: { snapshot?: { state?: unknown } | null } }>;
  unsubscribe(uri: string): Promise<void>;
  events(): AsyncIterableIterator<AddressedEvent>;
}

/** A reader's hold on a channel, given up by calling `release`. */
export interface Hold {
  release(): void;
}

/** A snapshot the host handed back for one channel during a reconnect. */
export interface ResumedSnapshot {
  resource: string;
  state?: unknown;
}

export interface Channels {
  /**
   * Take a hold on a channel and start reading it.
   *
   * Synchronous, because every caller is a screen being drawn: the subscribe
   * happens behind this and the consumer hears about it through `opened`. A
   * hold released before the subscribe lands never subscribes at all.
   */
  open(uri: string, consumer: Consumer): Hold;
  /**
   * The channel's state now, without holding it open afterwards.
   *
   * A read rather than a watch: this subscribes, takes the state, and
   * unsubscribes again unless somebody else is holding the channel. A host
   * has no other way to answer "what is in there" - there is no `getState` -
   * so the subscription is the question and letting go is the whole point.
   */
  state(uri: string): Promise<ChannelState>;
  /** Every channel held right now, which is what `reconnect` has to be told. */
  held(): string[];
  /** The highest `serverSeq` this client has seen on any channel. */
  seq(): number;
  /**
   * Read one channel's refusal, if it was refused.
   *
   * A refusal is an answer about what the host is - `-32001` for a session
   * whose agent has gone - and asking again on every keystroke turns one
   * refusal into a stream of them.
   */
  refusal(uri: string): string | undefined;
  /**
   * Let a refusal be asked again: one channel, or every one of them.
   *
   * What a host refuses can stop being refused - a session is created, an
   * agent comes back - and the answer is only worth keeping until something
   * happens that could have changed it.
   */
  forget(uri?: string): void;
  /** Start reading a connection's event stream. Ends when the stream does. */
  drain(client: ChannelClient): void;
  /**
   * Take up the same channels again on a new connection.
   *
   * `replayed` is the branch where the host could name everything missed:
   * the envelopes go to their consumers in order and nobody is re-opened.
   * `resumed` is the branch where it could not, and every consumer is handed
   * a fresh state. `missing` is refused either way.
   */
  resume(client: ChannelClient, result: {
    replayed?: readonly unknown[];
    resumed?: readonly ResumedSnapshot[];
    missing?: readonly string[];
  }): void;
  /**
   * Take a channel the handshake already opened, with the state it answered.
   *
   * `initialize` accepts `initialSubscriptions` and answers with a snapshot
   * for each, which leaves the channel subscribed at the host before anything
   * here has asked for it. Without this the first reader would subscribe again
   * - the round trip the handshake exists to save, and a second `subscribe`
   * for a channel this connection already holds.
   */
  adopt(uri: string, state: ChannelState): void;
  /** Forget every subscription without unsubscribing: the socket is already gone. */
  detach(): void;
}

interface Held {
  /** How many readers are holding it. Zero means it is on its way out. */
  uses: number;
  consumers: Set<Consumer>;
  /** True once the host has answered a subscribe for this channel. */
  opened: boolean;
  /** True once consumers have been handed the snapshot that answer carried. */
  told: boolean;
  /** What arrived while the subscribe was still in flight. */
  waiting: ChannelEvent[];
  /** The release waiting to happen, if the last reader has gone. */
  leaving?: ReturnType<typeof setTimeout>;
  /** The `subscribe` already out for this channel, which a second reader waits on. */
  pending?: Promise<ChannelState>;
  /** A snapshot the handshake answered with, waiting for its first reader. */
  initial?: ChannelState;
}

function bag(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export interface ChannelsOptions {
  client: ChannelClient;
  /** Told when a channel is refused, so the reason reaches a person. */
  onRefusal?(uri: string, message: string): void;
  /** Told when the host refuses an action this client dispatched. */
  onRejection?(uri: string, message: string): void;
  /**
   * This client's id, as `initialize` gave it.
   *
   * Only so that a refusal can be told from somebody else's: an envelope
   * naming another client is still not applied, and is not reported here.
   */
  clientId?: string;
  /** The host's own words for a failure, as a client would show them. */
  reason(error: unknown): string;
  /**
   * How long to keep a channel nobody is reading, in milliseconds.
   *
   * Not laziness about letting go - a pause before it. Reading a snapshot and
   * opening a view are two holds on the same channel a moment apart, and
   * navigating away and back is two more, so releasing on the instant the
   * count reaches zero puts an `unsubscribe` between every pair of them. A
   * host is entitled to act on that: the reference one evicts a session from
   * memory when its last subscriber leaves and restores it from disk on the
   * next subscribe, and a client that unsubscribes and immediately subscribes
   * again is racing that restore. `0` releases at once.
   */
  lingerMs?: number;
}

export function openChannels(options: ChannelsOptions): Channels {
  const held = new Map<string, Held>();
  const refused = new Map<string, string>();
  let client = options.client;
  let seen = 0;
  /**
   * Which connection the current holds belong to.
   *
   * A subscribe in flight when the socket dies would otherwise land on the
   * next connection and open a channel twice; it compares this instead.
   */
  let generation = 0;
  const linger = options.lingerMs ?? 0;

  const entry = (uri: string): Held => {
    const found = held.get(uri);
    if (found) return found;
    const made: Held = { uses: 0, consumers: new Set(), opened: false, told: false, waiting: [] };
    held.set(uri, made);
    return made;
  };

  /** Note the host's counter, which advances with state rather than with messages. */
  const note = (event: ChannelEvent): void => {
    if (event.type !== 'action') return;
    const seq = bag(event.params)?.serverSeq;
    if (typeof seq === 'number' && seq > seen) seen = seq;
  };

  /**
   * An action the host refused, which is not an action that happened.
   *
   * A rejected envelope carries the action the host declined to apply, so a
   * consumer that reduced it would make the very change it was just told did
   * not happen - worse than the silence, because the screen then disagrees
   * with the host until something else moves it. It is reported and dropped.
   *
   * `serverSeq` is not read off it either. The counter advances with state,
   * and a refusal moved none: the number on the envelope is the one this host
   * is still at, and taking it as progress would leave a gap on the next
   * reconnect that nothing can fill.
   *
   * A rejection answers one client's dispatch. One attributed to another
   * client is nothing to say to the person sitting here, so it is dropped
   * without being reported; one with no origin at all is taken as ours,
   * because the alternative is losing the message a host that omits it sent.
   */
  const rejected = (uri: string, event: ChannelEvent): boolean => {
    if (event.type !== 'action') return false;
    const envelope = bag(event.params);
    const why = envelope?.rejectionReason;
    if (typeof why !== 'string') return false;
    const from = bag(envelope?.origin)?.clientId;
    const mine = options.clientId === undefined || typeof from !== 'string' || from === options.clientId;
    if (mine) options.onRejection?.(uri, why);
    return true;
  };

  const deliver = (uri: string, event: ChannelEvent): void => {
    if (rejected(uri, event)) return;
    note(event);
    const channel = held.get(uri);
    if (!channel) return;
    // Before the snapshot has landed there is nothing to apply this to. The
    // host starts sending the moment it accepts the subscribe, which is
    // earlier than it answers one.
    if (!channel.opened) { channel.waiting.push(event); return; }
    for (const consumer of channel.consumers) consumer.event(event);
  };

  /**
   * Record a refusal, and give it to whoever is entitled to it.
   *
   * A reader that supplied `refused` has an opinion about what the refusal
   * means to it - a session draws it in the transcript, an automations
   * channel takes it as "this host serves none" - and reporting it to the
   * connection as well makes an expected answer look like a fault. Only a
   * refusal nobody claimed goes to `onRefusal`.
   */
  const refuse = (uri: string, message: string): void => {
    refused.set(uri, message);
    const channel = held.get(uri);
    let claimed = false;
    for (const consumer of channel?.consumers ?? []) {
      if (!consumer.refused) continue;
      consumer.refused(message);
      claimed = true;
    }
    if (!claimed) options.onRefusal?.(uri, message);
  };

  /** Read a connection's whole event stream until it ends or is superseded. */
  const drain = (next: ChannelClient, era: number): void => {
    client = next;
    void (async () => {
      try {
        for await (const addressed of next.events()) {
          if (era !== generation) return;
          deliver(addressed.channel, addressed.event);
        }
      }
      catch { /* the connection going is the supervisor's to notice */ }
    })();
  };

  /**
   * One `subscribe` per channel at a time, however many readers arrive.
   *
   * Not an optimisation, and specifically about two being *in flight*. The
   * reference host puts a pending marker under the channel while it restores
   * the session; a subscribe arriving while that marker is unresolved
   * replaces it, and the first then finds itself no longer current and is
   * answered `-32001 Resource not found`, naming a channel that exists. A
   * re-subscribe to a channel already open is idempotent there - it is only
   * the overlap that collides. Reading a row's detail and opening the view on
   * it are two readers a keystroke apart, which is exactly that overlap, and
   * each was sending its own. They share this instead.
   *
   * The promise is dropped once it settles rather than kept: it is here to
   * make concurrent readers into one request, not to hand the second reader
   * an answer from before it asked.
   */
  const ask = (uri: string): Promise<ChannelState> => {
    const channel = entry(uri);
    if (channel.pending) return channel.pending;
    channel.told = false;
    const era = generation;
    const asking = client.subscribe(uri).then(({ result }) => {
      if (era === generation && held.get(uri) === channel) channel.opened = true;
      return bag(result.snapshot?.state);
    });
    channel.pending = asking;
    const done = (): void => { if (channel.pending === asking) channel.pending = undefined; };
    asking.then(done, done);
    return asking;
  };

  /** Ask the host for a channel, and give what comes back to whoever is waiting. */
  const start = (uri: string, era: number): void => {
    void (async () => {
      try {
        const state = await ask(uri);
        if (era !== generation) return;
        const channel = held.get(uri);
        if (!channel || channel.uses === 0 || channel.told) return;
        channel.told = true;
        for (const consumer of channel.consumers) consumer.opened(state);
        const queued = channel.waiting.splice(0);
        for (const event of queued) {
          for (const consumer of channel.consumers) consumer.event(event);
        }
      }
      catch (error) {
        if (era !== generation) return;
        refuse(uri, options.reason(error));
      }
    })();
  };

  /** Let the host know nobody is reading, which is the only handle a watch has. */
  /** Let the host know nobody is reading, once nobody has been for a while. */
  const drop = (uri: string): void => {
    const channel = held.get(uri);
    if (!channel || channel.uses > 0) return;
    const era = generation;
    const release = (): void => {
      if (era !== generation || held.get(uri) !== channel) return;
      const now = held.get(uri);
      // Somebody took it back while this was waiting, which is the whole
      // reason for waiting.
      if (!now || now.uses > 0) return;
      // Keep the entry until the request answers. A reader returning meanwhile
      // shares it; otherwise its successful subscribe still needs releasing.
      if (now.pending) { void now.pending.then(release, release); return; }
      held.delete(uri);
      if (!now.opened) return;
      void client.unsubscribe(uri).catch(() => undefined);
    };
    if (linger <= 0) { release(); return; }
    clearTimeout(channel.leaving);
    channel.leaving = setTimeout(() => { channel.leaving = undefined; release(); }, linger);
  };

  return {
    open: (uri, consumer) => {
      const known = refused.get(uri);
      if (known !== undefined) {
        // Answered already. Told on the way out rather than on the way in, so
        // a caller that only wanted the handle still gets one.
        queueMicrotask(() => consumer.refused?.(known));
        return { release: () => undefined };
      }

      const channel = entry(uri);
      // Taking it back before the release fired is what keeps the
      // subscription alive across a screen closing and opening again.
      clearTimeout(channel.leaving);
      channel.leaving = undefined;
      channel.consumers.add(consumer);
      /*
       * Alone, rather than the only hold. A snapshot read holds the channel
       * too, and counting it as a reader left a view opened during one with
       * nobody to hand it the state: `state` does not deliver to consumers,
       * and the view was not first, so nothing did. What arrived was a pane
       * with a session's name on it and none of the session in it.
       *
       * Still a fresh subscribe, even when the channel was only lingering:
       * asking again is how this reader gets a snapshot, and the host is
       * still holding the channel because no `unsubscribe` went out. Where a
       * subscribe is already out, `ask` hands back that one instead of
       * sending a second - which is the request the host answers by
       * cancelling the first.
       */
      const alone = channel.consumers.size === 1;
      channel.uses += 1;
      if (alone && channel.initial !== undefined) {
        // The handshake already asked, and this is the answer it got.
        const opening = channel.initial;
        channel.initial = undefined;
        channel.told = true;
        queueMicrotask(() => {
          if (!channel.consumers.has(consumer)) return;
          consumer.opened(opening);
          const queued = channel.waiting.splice(0);
          for (const event of queued) for (const one of channel.consumers) one.event(event);
        });
      }
      else if (alone) { channel.told = false; start(uri, generation); }
      else if (channel.told) {
        // Somebody is already reading it. This one needs the state as it
        // stands, and the host will not send a second snapshot for it.
        queueMicrotask(() => { if (channel.consumers.has(consumer)) consumer.opened(null); });
      }

      let holding = true;
      return {
        release: () => {
          if (!holding) return;
          holding = false;
          channel.consumers.delete(consumer);
          channel.uses -= 1;
          if (channel.uses === 0) drop(uri);
        },
      };
    },

    state: async (uri) => {
      const known = refused.get(uri);
      if (known !== undefined) return null;
      /*
       * A read is a hold that is given up straight away, not a subscribe
       * followed by an unsubscribe.
       *
       * The difference is what the host sees. Reading a session's snapshot
       * and then opening the view on it are a moment apart, and releasing the
       * first the instant it is done puts an `unsubscribe` between them - at
       * which point a host that evicts on the last subscriber leaving is
       * restoring the session from disk exactly as the view asks for it. Going
       * through the same counting and the same pause as any other reader means
       * the two coalesce into one subscription and nothing is let go in the
       * middle.
       */
      const channel = entry(uri);
      clearTimeout(channel.leaving);
      channel.leaving = undefined;
      channel.uses += 1;
      try {
        return await ask(uri);
      }
      catch (error) {
        refuse(uri, options.reason(error));
        return null;
      }
      finally {
        channel.uses -= 1;
        if (channel.uses === 0) drop(uri);
      }
    },

    held: () => [...held.keys()].filter((uri) => (held.get(uri)?.uses ?? 0) > 0),
    seq: () => seen,
    refusal: (uri) => refused.get(uri),
    forget: (uri) => { if (uri === undefined) refused.clear(); else refused.delete(uri); },

    drain: (next) => { drain(next, generation); },

    resume: (next, result) => {
      generation += 1;
      client = next;
      // Whatever was in flight belonged to the socket that went. Kept, it
      // would be handed to the first reader on the new one as an answer that
      // is never coming.
      for (const channel of held.values()) channel.pending = undefined;
      // Before anything is applied, so an action the host sends while this is
      // still catching up is queued rather than dropped on the floor.
      drain(next, generation);

      const gone = new Set(result.missing ?? []);
      for (const uri of gone) {
        const channel = held.get(uri);
        if (!channel) continue;
        held.delete(uri);
        for (const consumer of channel.consumers) {
          consumer.refused?.('This session is no longer on the host.');
        }
      }

      // Replay: the host could name everything this client missed, so the
      // mirrors it has are still good and only the gap needs filling.
      for (const envelope of result.replayed ?? []) {
        const uri = bag(envelope)?.channel;
        if (typeof uri !== 'string') continue;
        const channel = held.get(uri);
        if (!channel) continue;
        const event: ChannelEvent = { type: 'action', params: envelope };
        note(event);
        for (const consumer of channel.consumers) consumer.event(event);
      }

      if (result.replayed !== undefined) {
        // Replay is what the host sends *instead of* a fresh snapshot, so the
        // subscriptions behind it are ones it restored itself and none of them
        // needs asking for again.
        for (const channel of held.values()) {
          if (channel.uses === 0 || channel.opened) continue;
          channel.opened = true;
          channel.told = true;
          const queued = channel.waiting.splice(0);
          for (const event of queued) {
            for (const consumer of channel.consumers) consumer.event(event);
          }
        }
      }

      // Snapshot: the gap was longer than the host's buffer, so every mirror
      // is stale and every reader is handed the state rather than a delta.
      for (const snapshot of result.resumed ?? []) {
        const channel = held.get(snapshot.resource);
        if (!channel) continue;
        channel.opened = true;
        channel.told = true;
        channel.waiting.length = 0;
        for (const consumer of channel.consumers) consumer.opened(bag(snapshot.state));
      }

      for (const [uri, channel] of held) {
        if (channel.uses === 0) continue;
        // A channel the host restored but sent no snapshot for is still being
        // served; one it never restored has to be asked for again.
        if (!channel.opened) start(uri, generation);
      }
    },

    adopt: (uri, state) => {
      const channel = entry(uri);
      channel.opened = true;
      channel.told = false;
      channel.initial = state;
    },

    detach: () => {
      generation += 1;
      for (const [uri, channel] of held) {
        if (channel.uses === 0) {
          clearTimeout(channel.leaving);
          held.delete(uri);
        }
        channel.opened = false;
        channel.told = false;
        channel.waiting.length = 0;
        channel.pending = undefined;
      }
    },
  };
}
