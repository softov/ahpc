import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { DRAFT, OPEN } from '../src/state.js';
import { fakeHost } from '../src/ahp/fake.js';
import type { SessionUri } from '../src/ahp/types.js';

/*
 * What happens to the draft when a message is sent.
 *
 * The draft is synced to the host on a debounce, so at the moment a message
 * goes there is usually a timer holding the text that was just sent. Left to
 * fire, it told the host that text was the draft; the host stored it and
 * echoed a snapshot back, and the message reappeared in the composer a moment
 * after being sent - which reads as the send having failed.
 */

const opened = async () => {
  const host = fakeHost();
  const t = await renderApp({
    width: 100,
    height: 28,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i += 1) await t.settle();
  const controller = t.app.services.require(CONTROLLER);
  const sessions = await host.listSessions();
  controller.open((sessions[0] as { resource: string }).resource as SessionUri);
  for (let i = 0; i < 8; i += 1) await t.settle();
  return { t, controller };
};

/** Past the draft debounce, so a timer left running has fired. */
const afterTheDebounce = async (t: { settle(): Promise<void> }): Promise<void> => {
  await new Promise((resolve) => { setTimeout(resolve, 750); });
  for (let i = 0; i < 8; i += 1) await t.settle();
};

describe('sending a message leaves the composer empty', () => {
  it('does not let the pending draft sync put it back', async () => {
    const { t, controller } = await opened();
    expect(t.app.store.get<string>(OPEN)).toBeTruthy();

    // Typed, which is what starts the debounce.
    t.app.store.set(DRAFT, 'the message');
    controller.draft('the message');
    for (let i = 0; i < 2; i += 1) await t.settle();

    controller.send('the message');
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<string>(DRAFT)).toBe('');

    // The moment the timer would have fired, and a while after.
    await afterTheDebounce(t);
    expect(t.app.store.get<string>(DRAFT)).toBe('');
    await t.unmount();
  });

  it('still takes a draft the host had from somewhere else', async () => {
    const { t, controller } = await opened();
    // The clearing on send is about this client's own pending sync, not about
    // refusing what the host says: a draft typed in another client is still
    // taken when there is nothing here to lose.
    controller.draft('typed elsewhere');
    await afterTheDebounce(t);
    expect(t.app.store.get<string>(DRAFT)).toBe('typed elsewhere');
    await t.unmount();
  });
});
