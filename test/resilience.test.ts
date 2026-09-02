import { describe, expect, it } from 'vitest';
import { createStore } from '@textui/core';
import { applyAction } from '../src/ahp/live.js';
import {
  HOST_ERROR, INPUT_STATUS, applyEvent, sendingInput,
} from '../src/state.js';
import type { InputStatus } from '../src/state.js';

/**
 * What a client does with a word it cannot read.
 *
 * Both of these were found the same way: an agent fired two tools at once, a
 * host answered in a shape this client's reducer threw on, and the client
 * stopped listening to that session without ever saying that was what had
 * happened. The block stayed on screen, Approve did nothing, and the reason
 * was a sentence about a property of undefined on the last row of the screen.
 */

describe('an action this client cannot read', () => {
  it('drops the action and keeps the state it had', () => {
    const said: string[] = [];
    const before = { status: 24, inputNeeded: [{ id: 'a' }] };
    // What the reducer does with `session/inputNeededSet` carrying no
    // `request`: `action.request.id`, on undefined.
    const after = applyAction(
      (_state: typeof before, action: never) => {
        const bad = action as { request: { id: string } };
        return { status: 1, inputNeeded: [{ id: bad.request.id }] };
      },
      before,
      { type: 'session/inputNeededSet', inputNeeded: [{ id: 'b' }] },
      (message) => said.push(message),
    );

    expect(after).toBe(before);
    expect(said).toHaveLength(1);
    // Named, so the sentence says which word rather than only that there was
    // one. "Cannot read properties of undefined" on its own is not a report.
    expect(said[0]).toContain('session/inputNeededSet');
  });

  it('applies the ones it can read', () => {
    const said: string[] = [];
    const after = applyAction(
      (state: { n: number }) => ({ n: state.n + 1 }),
      { n: 1 },
      { type: 'session/statusChanged' },
      (message) => said.push(message),
    );
    expect(after).toEqual({ n: 2 });
    expect(said).toHaveLength(0);
  });
});

describe('a refusal that answers an answer', () => {
  it('lands on the row above the composer, not only in the footer', () => {
    const store = createStore();
    sendingInput(store, 'Approving...');

    applyEvent(store, { type: 'error', message: 'the host sent something unreadable' }, []);

    // The footer still has it - it is the application's last refusal either
    // way - but so does the row the button was pressed on.
    expect(store.get<string>(HOST_ERROR)).toBe('the host sent something unreadable');
    const status = store.get<InputStatus>(INPUT_STATUS);
    expect(status?.state).toBe('failed');
    expect(status?.text).toBe('the host sent something unreadable');
  });

  it('leaves the row alone when no answer was in flight', () => {
    const store = createStore();
    applyEvent(store, { type: 'error', message: 'this session has no chat to speak to' }, []);
    expect(store.get<string>(HOST_ERROR)).toBe('this session has no chat to speak to');
    expect(store.get(INPUT_STATUS) ?? null).toBeNull();
  });
});
