import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';
import type { FakeHost } from '../src/ahp/fake.js';
import { HOST_ERROR } from '../src/state.js';
import type { SessionUri } from '../src/ahp/types.js';

/*
 * The credential prompt, over the host that refuses until it is given one.
 *
 * What is checked is the whole loop: a refusal opens the prompt over whatever
 * screen is up, one accepted credential runs the refused act exactly once
 * more, a credential the host turns down keeps the prompt open, and two acts
 * refused at once are both answered by one sign-in rather than one of them
 * waiting forever.
 *
 * The catalogue is read by the application itself before a test touches
 * anything, so a count is stated against what boot already did rather than
 * against zero.
 */

const RESOURCE = 'https://api.anthropic.com';
const OTHER = 'https://api.github.com';
const SEEDED = 'ahp-session:/1f0a';

/** A `-32007` in the shape the SDK throws, naming one resource. */
function refused(resource?: string, words = 'Authentication required'): Error {
  return Object.assign(new Error(words), {
    code: -32007,
    ...(resource === undefined ? {} : { data: { resources: [{ resource, resource_name: 'Anthropic API' }] } }),
  });
}

/**
 * A running application, with whatever the host should do before it boots.
 *
 * `setup` runs before the first frame, so a host that refuses is one the very
 * first catalogue read is refused by - the case a person actually meets, and
 * the one a fixture that only refused later would hide.
 */
async function open(setup: (host: FakeHost) => void = (host) => { host.protect(RESOURCE, 'Anthropic API'); }): Promise<{ t: Harness; host: FakeHost }> {
  const host = fakeHost();
  setup(host);
  const t = await renderApp({
    width: 100,
    height: 30,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 10; i++) await t.settle();
  return { t, host };
}

/** Watch what the prompt pushes, without changing what the host answers. */
function watchSignIn(host: FakeHost): { resource: string; token: string }[] {
  const pushed: { resource: string; token: string }[] = [];
  const real = host.authenticate;
  host.authenticate = async (resource, token) => {
    pushed.push({ resource, token });
    return await real?.call(host, resource, token);
  };
  return pushed;
}

async function submit(t: Harness, token: string): Promise<void> {
  t.focus('field.token');
  await t.settle();
  t.type(token);
  for (let i = 0; i < 4; i++) await t.settle();
  t.press('enter');
  for (let i = 0; i < 12; i++) await t.settle();
}

const controllerOf = (t: Harness) => t.app.services.require(CONTROLLER);

describe('the credential prompt', () => {
  it('draws the resource and the host words, then runs the refused act once more', async () => {
    const { t, host } = await open();
    const pushed = watchSignIn(host);
    const before = host.asked('listSessions');

    // Boot refused the catalogue, and the prompt is over whatever screen is up.
    expect(before).toBe(1);
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(1);
    expect(t.hasText('Anthropic API')).toBe(true);
    expect(t.hasText('Authentication required')).toBe(true);

    await submit(t, 'tok-secret');

    // The token went to the host for the resource it named, and the catalogue
    // was served on the one more attempt.
    expect(pushed).toEqual([{ resource: RESOURCE, token: 'tok-secret' }]);
    expect(host.asked('listSessions')).toBe(before + 1);
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);

    await t.unmount();
  });

  it('keeps the prompt open, with the host words, when the credential is refused', async () => {
    const { t, host } = await open();
    host.authenticate = async () => { throw new Error('that token is not good'); };
    const before = host.asked('listSessions');

    await submit(t, 'wrong');

    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(1);
    expect(t.hasText('that token is not good')).toBe(true);
    // The refused act did not run again.
    expect(host.asked('listSessions')).toBe(before);

    await t.unmount();
  });

  it('stops at the second refusal instead of asking a third time', async () => {
    let attempts = 0;
    const { t } = await open((host) => {
      host.listSessions = async () => {
        attempts += 1;
        throw refused(RESOURCE, attempts === 1 ? 'the first no' : 'the second no');
      };
    });

    // The boot read was refused, and opened the prompt.
    expect(attempts).toBe(1);
    await submit(t, 'tok');

    // One more attempt, refused: the host has answered.
    expect(attempts).toBe(2);
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);
    // And the first refusal is what a person is shown, not the second.
    expect(t.app.store.get<string>(HOST_ERROR)).toContain('the first no');

    await t.unmount();
  });

  it('runs nothing when the prompt is dismissed', async () => {
    const { t, host } = await open();
    const pushed = watchSignIn(host);
    const before = host.asked('listSessions');

    t.press('escape');
    for (let i = 0; i < 10; i++) await t.settle();

    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);
    expect(host.asked('listSessions')).toBe(before);
    expect(pushed).toEqual([]);

    await t.unmount();
  });

  it('stays dismissed when the catalogue ticks, and comes back for ctrl+r', async () => {
    const { t, host } = await open();

    t.press('escape');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);

    // A tick rereads the catalogue behind the person's back; a refusal there
    // is said on the status bar, never asked about.
    const before = host.asked('listSessions');
    host.rename(SEEDED as SessionUri, 'moved');
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    for (let i = 0; i < 10; i++) await t.settle();
    expect(host.asked('listSessions')).toBeGreaterThan(before);
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);

    await controllerOf(t).refresh();
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);

    t.press('ctrl+r');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(1);

    await t.unmount();
  });

  it('opens nothing for a refusal that names no resource', async () => {
    const { t } = await open((host) => {
      host.listSessions = async () => { throw refused(); };
    });

    // A wall with no door is drawn, never guessed at: there is no resource to
    // ask for, so nothing is asked for and the footer keeps the words.
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(0);
    expect(t.app.store.get<string>(HOST_ERROR)).toContain('Authentication required');

    await t.unmount();
  });

  it('holds every waiter, and one credential answers only the matching one', async () => {
    let scopes = 0;
    let changes = 0;
    // Nothing protected at boot: this case makes its own two refusals.
    const { t, host } = await open(() => undefined);
    // A credential is taken for either resource, so whichever refusal the
    // prompt ends up showing can be answered.
    host.authenticate = async () => undefined;
    const pushed = watchSignIn(host);
    host.changesets = async () => { scopes += 1; throw refused(RESOURCE, 'no scopes'); };
    host.changes = async () => { changes += 1; throw refused(OTHER, 'no changes'); };

    const controller = controllerOf(t);
    // Caught where they are made: both are refusals by design, and a rejection
    // with no handler at the moment it happens is a different failure.
    const first = controller.changesets(SEEDED as SessionUri).catch((error: unknown) => error);
    const second = controller.changesAt(SEEDED as SessionUri).catch((error: unknown) => error);
    for (let i = 0; i < 8; i++) await t.settle();

    // One layer, one prompt, however many acts are waiting.
    expect(t.getAllByComponent('SignInPrompt')).toHaveLength(1);

    await submit(t, 'tok');

    // The newest refusal is what the prompt draws, so the credential is pushed
    // for the resource `changesAt` was refused for and not the other one.
    expect(pushed).toEqual([{ resource: OTHER, token: 'tok' }]);
    // Exactly the matching act ran again. Counting the two apart is the whole
    // point: a sum would read the same if the wrong waiter had been answered.
    expect(changes).toBe(2);
    expect(scopes).toBe(1);
    expect(await first).toMatchObject({ code: -32007 });
    expect(await second).toMatchObject({ code: -32007 });

    await t.unmount();
  });
});
