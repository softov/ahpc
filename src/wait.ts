/*
 * Watching one session until it does something, for whoever is asking.
 *
 * The CLI and the tool server both say a thing and then block until the turn
 * it started has finished, and both need the same answer to "finished" - which
 * is not "the last turn in the list" and not "nothing is running". Written
 * once here, because the two disagreeing would mean a tool that returned
 * before the reply was complete while the same command in a shell waited.
 */

import type { HostConnection, HostEvent } from './ahp/connection.js';
import type { ModelSelection, SessionUri, Turn } from './ahp/types.js';

/**
 * Watch one session until it does something, then stop watching.
 *
 * Every streaming command is this with a different stopping condition. The
 * subscription is always closed - a caller that left one open would be a
 * process that never exits, which is the one thing a shell cannot work around.
 */
export function until(
  host: HostConnection,
  uri: SessionUri,
  done: (event: HostEvent) => boolean,
  options: { onEvent?(event: HostEvent): void; timeoutSeconds?: number } = {},
): Promise<HostEvent | undefined> {
  return new Promise((answer) => {
    let closed = false;
    /*
     * The handle may not exist yet when this runs.
     *
     * A host is entitled to deliver the opening snapshot *synchronously*
     * inside `subscribe` - the scripted one does, and it is the honest thing
     * for a host holding the state already - so a condition satisfied by that
     * first event fires before `subscribe` has returned anything to close.
     * Reading the handle there threw, which made every waiting command fail
     * against the scripted host and work against a socket, purely because one
     * of them answers a tick later.
     */
    let handle: { close(): void } | undefined;
    const finish = (event: HostEvent | undefined): void => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      handle?.close();
      answer(event);
    };
    const timer = setTimeout(
      () => finish(undefined),
      Math.max(1, (options.timeoutSeconds ?? 900)) * 1000,
    );
    timer.unref?.();
    handle = host.subscribe(uri, (event) => {
      options.onEvent?.(event);
      if (done(event)) finish(event);
    });
    // Already over, before there was a handle to close. Closing it now is what
    // `finish` could not do.
    if (closed) handle.close();
  });
}

/** A turn, as a line of prose rather than a tree of parts. */
export const spoken = (turn: Turn): string => turn.parts
  .map((part) => (part.kind === 'markdown' ? part.content : ''))
  .join('')
  .trim();

/** What a caller wants told while a turn is running, and how long to wait. */
export interface TurnOptions {
  model?: ModelSelection;
  timeoutSeconds?: number;
  /** Text the agent has said that the caller has not been given yet. */
  onDelta?(text: string): void;
  /** A tool call the agent is blocked on, said once per call. */
  onWaiting?(call: { id: string; name: string }): void;
  /**
   * A tool the agent has started using, said once per call.
   *
   * Every tool call rather than only the ones that stop for a person, because
   * this is what a caller watching a long turn has to go on: `onWaiting` fires
   * on an approval and most turns never ask for one.
   */
  onStep?(call: { id: string; name: string }): void;
}

/**
 * Say something, and block until the turn it starts has finished.
 *
 * Subscribed before saying anything: the first snapshot is the baseline that
 * says which turns were already there, and one taken afterwards would count
 * the new turn among them.
 *
 * "Finished" is a turn of *ours* having ended - one that was not in the
 * baseline - rather than the last in the list, which is a different session's
 * answer when two people are talking in the same chat. A turn that stops to
 * ask a person something is not finished and is not this caller's to answer,
 * so the wait runs on until whoever is answering has.
 *
 * Answers `undefined` where the timeout ran out, which is a caller's to
 * report rather than to throw: the turn is still going and the session is
 * still there.
 */
export async function turn(
  host: HostConnection,
  uri: SessionUri,
  text: string,
  options: TurnOptions = {},
): Promise<Turn | undefined> {
  let given = 0;
  let sawActive = false;
  let before = new Set<string>();
  let first = true;
  let noted: string | undefined;
  let answer: Turn | undefined;
  /** Tool calls already reported, so a snapshot rebuilt per token says each once. */
  const stepped = new Set<string>();
  const step = (call: { id: string; name: string }): void => {
    if (stepped.has(call.id)) return;
    stepped.add(call.id);
    options.onStep?.(call);
  };

  const finished = until(host, uri, (event) => {
    /*
     * Two vocabularies, because a host may speak either.
     *
     * `live.ts` rebuilds the whole view and sends a `snapshot` after every
     * action; `fake.ts` sends what changed - `turnStarted`, `delta`,
     * `turnComplete`. Both are `HostEvent` and both are legal, and a caller
     * that read only snapshots waited for ever on the scripted host, which
     * this client offers as the one that needs nothing installed.
     */
    if (event.type === 'turnStarted') { sawActive = true; return false; }
    if (event.type === 'delta') {
      if (event.kind === 'markdown') options.onDelta?.(event.text);
      return false;
    }
    if (event.type === 'toolCall') {
      step({ id: event.call.id, name: event.call.name });
      if (event.call.status === 'pending-confirmation' && noted !== event.call.id) {
        noted = event.call.id;
        options.onWaiting?.({ id: event.call.id, name: event.call.name });
      }
      return false;
    }
    if (event.type === 'turnComplete') {
      if (before.has(event.turn.id)) return false;
      answer = event.turn;
      return true;
    }
    if (event.type !== 'snapshot') return false;
    if (first) { first = false; before = new Set(event.turns.map((one) => one.id)); }

    if (event.active) {
      sawActive = true;
      const now = spoken(event.active);
      if (now.length > given) { options.onDelta?.(now.slice(given)); given = now.length; }
      for (const part of event.active.parts) {
        if (part.kind === 'toolCall') step({ id: part.call.id, name: part.call.name });
      }
      const call = event.active.parts.find((part) => part.kind === 'toolCall'
        && part.call.status === 'pending-confirmation');
      if (call?.kind === 'toolCall' && noted !== call.call.id) {
        noted = call.call.id;
        options.onWaiting?.({ id: call.call.id, name: call.call.name });
      }
      return false;
    }
    // Something wants a person. Not finished, and not this caller's to answer.
    if (event.input) return false;

    const fresh = event.turns.filter((one) => one.role === 'agent' && !before.has(one.id));
    if (!sawActive && fresh.length === 0) return false;
    answer = fresh[fresh.length - 1];
    return true;
  }, { ...(options.timeoutSeconds === undefined ? {} : { timeoutSeconds: options.timeoutSeconds }) });

  host.say(uri, text, options.model);
  await finished;
  return answer;
}
