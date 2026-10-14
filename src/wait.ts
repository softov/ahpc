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

/**
 * A turn, as a line of prose rather than a tree of parts.
 *
 * The answer only. A turn that failed carries the reason as an `error` part
 * and this drops it, which is right here and wrong for anybody who has to
 * report the failure - `failure` is what they read instead.
 */
export const spoken = (turn: Turn): string => turn.parts
  .map((part) => (part.kind === 'markdown' ? part.content : ''))
  .join('')
  .trim();

/**
 * Why a turn failed, in the host's own words, one message per error part.
 *
 * Empty for a turn that did not fail, which is the common case. A part that
 * says nothing is left out rather than reported as an empty line: the host
 * said there was a failure and named no reason, and a blank sentence is worse
 * than the absence of one.
 */
export const failure = (turn: Turn): string[] => turn.parts.flatMap((part) => (
  part.kind === 'error' && part.message !== '' ? [part.message] : []
));

/**
 * A message arriving where a turn is already running.
 *
 * Thrown rather than answered as `undefined`, which means the wait ran out:
 * a caller told "stopped waiting" here would be describing a wait that never
 * began. The sentence is the plain fact, because what a caller can do about it
 * differs - a shell names its flags, a tool names its input.
 */
export class TurnRunning extends Error {
  constructor() {
    super('A turn is running.');
    this.name = 'TurnRunning';
  }
}

/** What a caller wants told while a turn is running, and how long to wait. */
export interface TurnOptions {
  model?: ModelSelection;
  timeoutSeconds?: number;
  /**
   * What to do where the session is already in a turn.
   *
   * `queue` sends the message behind it and waits for the turn that starts;
   * `steer` sends it into that turn and waits for that one to end. Left out,
   * a session in a turn is refused rather than sent to.
   */
  busy?: 'queue' | 'steer';
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
 * What one event says about a turn running, or `undefined` where it says
 * nothing about turns at all.
 *
 * Two vocabularies, because a host may speak either: `live.ts` rebuilds the
 * whole view into a snapshot after every action, `fake.ts` sends what changed.
 * `present` and `chats` come before both and name no turn, so neither is an
 * answer to "is one running".
 */
const running = (event: HostEvent): { busy: boolean; id: string | undefined } | undefined => {
  if (event.type === 'snapshot') {
    return event.active === undefined ? { busy: false, id: undefined } : { busy: true, id: event.active.id };
  }
  if (event.type === 'turnStarted') return { busy: true, id: event.turn.id };
  // A token or a tool call is a turn being written, without saying which.
  if (event.type === 'delta' || event.type === 'toolCall') return { busy: true, id: undefined };
  if (event.type === 'turnComplete') return { busy: false, id: undefined };
  return undefined;
};

/**
 * Say something, and block until the turn it starts has finished.
 *
 * Subscribed before saying anything: the first snapshot is the baseline that
 * says which turns were already there, and one taken afterwards would count
 * the new turn among them.
 *
 * The message waits for the first event that says what the session is doing,
 * and is then said, queued or steered. Sent before that it could start a
 * second turn on a session already in one, which is what a host answers by
 * dropping the first turn - and the session's own state is the only thing
 * that knows.
 *
 * "Finished" is a turn of *ours* having ended - one that was not in the
 * baseline - rather than the last in the list, which is a different session's
 * answer when two people are talking in the same chat. A turn that stops to
 * ask a person something is not finished and is not this caller's to answer,
 * so the wait runs on until whoever is answering has. A message sent behind
 * the running turn adds that turn's id to the baseline, and a steered one
 * waits for that turn instead, since it starts none of its own.
 *
 * Answers `undefined` where the timeout ran out, which is a caller's to
 * report rather than to throw: the turn is still going and the session is
 * still there. Throws `TurnRunning` where the session was in a turn and this
 * caller named nothing to do about it, which is not a wait at all.
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
  /** Whether the message has gone, which waits for the first word on the session. */
  let sent = false;
  /** A session in a turn, where nothing was asked for and it is refused. */
  let refused = false;
  /** The turn the message was sent behind, which is not this caller's to read. */
  let behind: string | undefined;
  /** The turn a steering message went into, whose end is the answer. */
  let steering: string | undefined;
  /** The turn being streamed, so a change of turn starts its text over. */
  let streaming: string | undefined;
  /** Tool calls already reported, so a snapshot rebuilt per token says each once. */
  const stepped = new Set<string>();
  const step = (call: { id: string; name: string }): void => {
    if (stepped.has(call.id)) return;
    stepped.add(call.id);
    options.onStep?.(call);
  };

  const finished = until(host, uri, (event) => {
    /*
     * The turns that were already there, taken from the first snapshot.
     *
     * Added to rather than replaced: the running turn's id is put in here
     * where the message goes behind it, and a snapshot that replaced the set
     * would drop it again - leaving that turn's end to be read as the answer.
     */
    if (event.type === 'snapshot' && first) {
      first = false;
      for (const one of event.turns) before.add(one.id);
    }

    /*
     * Nothing is sent until the session has said what it is doing.
     *
     * An idle session is said to whatever was asked for, so the flags mean
     * "where it is busy" rather than "always". A busy one is refused unless
     * this caller said what to do, and then the message goes behind the turn
     * or into it.
     */
    if (!sent) {
      const state = running(event);
      if (state !== undefined) {
        sent = true;
        if (!state.busy) host.say(uri, text, options.model);
        else if (options.busy === undefined) { refused = true; return true; }
        else if (options.busy === 'queue') {
          // Its end is somebody else's answer, so its id joins the baseline.
          if (state.id !== undefined) before.add(state.id);
          behind = state.id;
          host.queue(uri, text, options.model);
        }
        else {
          steering = state.id;
          host.steer(uri, text, options.model);
        }
      }
    }

    /*
     * Nothing of the turn the message went behind is read.
     *
     * A queued message starts when that turn ends, so what happens in between
     * belongs to somebody else's answer - printed, the two run together as one
     * reply. Its end is what lifts this, and the two vocabularies say it
     * differently: a `turnComplete` naming it, and a snapshot that has moved
     * it out of the active turn.
     */
    if (behind !== undefined) {
      if (event.type === 'turnComplete' && event.turn.id === behind) behind = undefined;
      else if (event.type === 'snapshot'
        && (event.active?.id !== behind || event.turns.some((one) => one.id === behind))) behind = undefined;
      if (behind !== undefined) return false;
    }

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
      // A steered turn starts none of its own, so its end is the answer.
      if (steering !== undefined) {
        if (event.turn.id !== steering) return false;
        answer = event.turn;
        return true;
      }
      if (before.has(event.turn.id)) return false;
      answer = event.turn;
      return true;
    }
    if (event.type !== 'snapshot') return false;

    if (event.active) {
      sawActive = true;
      // A new turn starts its text over: a length kept from another turn would
      // hide the beginning of this one.
      if (event.active.id !== streaming) { streaming = event.active.id; given = 0; }
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

  await finished;
  if (refused) throw new TurnRunning();
  return answer;
}
