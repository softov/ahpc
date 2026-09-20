import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';

/*
 * The usage screen.
 *
 * The numbers it draws are already on the wire: a turn carries a usage report
 * and the model the host advertises carries its context window. What is worth
 * checking here is that a session which spent something reads differently from
 * one whose host reported nothing, that the row names the model the turn
 * billed rather than the one it asked for, and that the window is paired with
 * the most recent turn rather than with a total.
 */

/** An idle claude session, with turns already in it that report no usage. */
const IDLE = 'ahp-session:/2d55';

async function mounted(): Promise<{ t: Harness; host: ReturnType<typeof fakeHost> }> {
  const host = fakeHost();
  const t = await renderApp({
    width: 120,
    height: 30,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  t.app.services.require(CONTROLLER).open(IDLE);
  for (let i = 0; i < 8; i++) await t.settle();
  return { t, host };
}

/** The fixture's script to its end, rendering as it goes. */
async function run(host: ReturnType<typeof fakeHost>, t: Harness): Promise<void> {
  for (let i = 0; i < 100_000; i++) if (!host.pump()) break;
  for (let i = 0; i < 8; i++) await t.settle();
}

describe('reaching the usage screen', () => {
  it('opens from the palette command', async () => {
    const { t } = await mounted();
    await t.app.execute('go.usage');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('usage');
    await t.unmount();
  });

  it('opens on u from the chat', async () => {
    const { t } = await mounted();
    t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await t.settle();
    // Out of the composer, which swallows letters while it has the keyboard.
    t.focus('chat.transcript');
    await t.settle();
    await t.press('u');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('usage');
    await t.unmount();
  });
});

describe('what a session has spent', () => {
  it('draws a row with the billed model, both counts and the cost', async () => {
    const { t, host } = await mounted();
    t.app.services.require(CONTROLLER).send('hello');
    await run(host, t);
    await t.app.execute('go.usage');
    for (let i = 0; i < 8; i++) await t.settle();

    // The model the turn billed to, from the fixture's own catalogue.
    expect(t.hasText('claude-opus-5')).toBe(true);
    expect(t.hasText('in 12400')).toBe(true);
    expect(t.hasText('out 830')).toBe(true);
    expect(t.hasText('cached 9600')).toBe(true);
    expect(t.hasText('0.42 credits')).toBe(true);
    await t.unmount();
  });

  it('pairs the context window with the latest turn that used a model', async () => {
    const { t, host } = await mounted();
    t.app.services.require(CONTROLLER).send('hello');
    await run(host, t);
    await t.app.execute('go.usage');
    for (let i = 0; i < 8; i++) await t.settle();

    // 12,400 prompt tokens against the 1,000,000 the opus row advertises.
    expect(t.hasText('12400 / 1000000')).toBe(true);
    await t.unmount();
  });

  it('takes the session total the host reports over adding the rows up', async () => {
    const { t, host } = await mounted();
    t.app.services.require(CONTROLLER).send('hello');
    await run(host, t);
    await t.app.execute('go.usage');
    for (let i = 0; i < 8; i++) await t.settle();

    // The fixture reports 1.25 against the session even though the single row
    // cost 0.42, and the total is the host's number rather than a sum.
    expect(t.hasText('1.25 credits')).toBe(true);
    await t.unmount();
  });
});

describe('a host that reports nothing', () => {
  it('says so per turn and draws no context line', async () => {
    const { t } = await mounted();
    await t.app.execute('go.usage');
    for (let i = 0; i < 8; i++) await t.settle();

    // The seeded turns carry no usage at all.
    expect(t.hasText('A turn reported nothing.')).toBe(true);
    expect(t.hasText('The host has reported no session total.')).toBe(true);
    expect(t.hasText('The current model holds')).toBe(false);
    await t.unmount();
  });
});
