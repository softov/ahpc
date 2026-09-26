import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { CONTROLLER } from '../src/control.js';
import { AUTOMATION_ROW, OPEN } from '../src/state.js';

/*
 * What the host does without being asked.
 *
 * The catalogue answers "what has been said" and this answers "what will
 * happen", and until 0.9.0 the protocol carried no way to ask the second
 * question. What is checked here is that both facts a row carries are drawn -
 * the schedule somebody wrote, and whether the host will actually fire it -
 * because they are different facts and a screen that showed only the first
 * would say a switched-off automation runs every weekday.
 */

async function open(width = 90, height = 30, theme = 'dark') {
  const host = fakeHost();
  const t = await renderApp({
    width, height, shell: 'workbench', theme,
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  await t.app.execute('go.automations');
  for (let i = 0; i < 10; i++) await t.settle();
  return { t, host };
}

describe('the automations screen', () => {
  for (const width of [90, 60]) {
    it(`lists what the host holds, at ${width} columns`, async () => {
      const { t } = await open(width);
      expect(t.hasText('Nightly framework build')).toBe(true);
      expect(t.hasText('Triage new Desk cases')).toBe(true);
      await t.unmount();
    });
  }

  it('shows the schedule as written, and the zone when it is not UTC', async () => {
    const { t } = await open();
    // The expression is the client's own writing given back. A screen that
    // paraphrased it would be a screen that disagrees with the host.
    expect(t.hasText('0 9 * * 1-5')).toBe(true);
    expect(t.hasText('America/Sao_Paulo')).toBe(true);
    await t.unmount();
  });

  it('separates what is written from what will happen', async () => {
    const { t } = await open();
    // Both automations have a schedule; only one of them is going to fire.
    // The switched-off one says so rather than showing a next run it will
    // never reach.
    // The hour, not the minute: the fixture is relative to now and the row is
    // drawn a moment later, so pinning the minute would be pinning the clock.
    expect(t.hasText('in 4h')).toBe(true);
    expect(t.hasText('paused')).toBe(true);
    await t.unmount();
  });

  it('runs one, and the session it starts says what started it', async () => {
    const { t } = await open();
    t.app.store.set(AUTOMATION_ROW, 'ahp-automation:/9c4a');
    await t.app.execute('automation.run');
    for (let i = 0; i < 10; i++) await t.settle();

    // The catalogue is the other half of this: a session that appeared with
    // nobody at the keyboard has to be tellable from one somebody typed.
    await t.app.execute('go.sessions');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('by an automation')).toBe(true);
    await t.unmount();
  });

  it('will not run one the host does not offer Run for', async () => {
    const { t, host } = await open();
    const before = (await host.automations?.()) ?? [];
    const off = before.find((one) => !one.enabled);
    expect(off?.operations).not.toContain('run');

    t.app.store.set(AUTOMATION_ROW, off?.resource ?? '');
    await t.app.execute('automation.run');
    for (let i = 0; i < 8; i++) await t.settle();

    // Nothing happened, because the host said it may not. A client that
    // pressed a verb the host did not advertise would be asking to be refused.
    const after = (await host.automations?.()) ?? [];
    expect(after.find((one) => one.resource === off?.resource)?.runs).toEqual([]);
    await t.unmount();
  });

  it('switches one off, and it stops offering to run', async () => {
    const { t, host } = await open();
    t.app.store.set(AUTOMATION_ROW, 'ahp-automation:/9c4a');
    await t.app.execute('automation.toggle');
    for (let i = 0; i < 10; i++) await t.settle();

    const found = ((await host.automations?.()) ?? []).find((one) => one.resource === 'ahp-automation:/9c4a');
    expect(found?.enabled).toBe(false);
    expect(found?.operations).not.toContain('run');
    // And the screen followed, without being told to re-read.
    expect(t.hasText('in 4h')).toBe(false);
    await t.unmount();
  });

  it('says so plainly when the host serves none', async () => {
    const host = fakeHost();
    // A host that answers -32601 for the whole channel. Drawing an empty list
    // for it would claim it has no automations rather than no such thing.
    delete (host as { automations?: unknown }).automations;
    const t = await renderApp({
      width: 90, height: 30, shell: 'workbench', theme: 'dark',
      onBoot: (app) => { registerChat(app, { host }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('go.automations');
    for (let i = 0; i < 10; i++) await t.settle();

    expect(t.hasText('Nothing to schedule here')).toBe(true);
    expect(t.hasText('serves no automations')).toBe(true);
    await t.unmount();
  });
});

/*
 * Reading one.
 *
 * Enter opens the detail and `r` runs, so a stray enter never starts an agent.
 * The pane works the way the catalogue's does: right or enter to read it, left
 * back, and below the split it is the whole screen while it is out.
 */
describe('the automation detail', () => {
  const runsOf = async (host: ReturnType<typeof fakeHost>, uri: string) =>
    ((await host.automations?.()) ?? []).find((one) => one.resource === uri)?.runs.length ?? 0;

  it('opens on enter and does not run anything', async () => {
    const { t, host } = await open();
    const before = await runsOf(host, 'ahp-automation:/9c4a');
    t.press('enter');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(await runsOf(host, 'ahp-automation:/9c4a')).toBe(before);
    expect(t.app.focus.focused()).toBe('automation.details');
    await t.unmount();
  });

  it('runs on r', async () => {
    const { t, host } = await open();
    const before = await runsOf(host, 'ahp-automation:/9c4a');
    t.press('r');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(await runsOf(host, 'ahp-automation:/9c4a')).toBe(before + 1);
    await t.unmount();
  });

  for (const [width, height] of [[70, 40], [160, 40]] as const) {
    it(`shows what the automation says, where and on what, at ${width} columns`, async () => {
      const { t } = await open(width, height);
      t.press('right');
      for (let i = 0; i < 8; i++) await t.settle();

      expect(t.hasText('Build every libbrb_* library')).toBe(true);
      expect(t.hasText('/brb_main/src/brb_framework')).toBe(true);
      expect(t.hasText('claude-sonnet-5')).toBe(true);
      // The failed run says why, which is what somebody opens this to find.
      expect(t.hasText('The working directory')).toBe(true);
      // Below the split the pane is the screen; above it the list stays.
      expect(t.hasText('Triage new Desk cases')).toBe(width > 140);

      t.press('left');
      for (let i = 0; i < 8; i++) await t.settle();
      expect(t.app.focus.focused()).toBe('chat.automations');
      expect(t.hasText('Triage new Desk cases')).toBe(true);
      await t.unmount();
    });
  }

  it('opens the session a run started', async () => {
    const { t } = await open(160, 40);
    t.press('right');
    for (let i = 0; i < 6; i++) await t.settle();
    t.focus('automation.runs');
    await t.settle();
    t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();

    expect(t.app.store.get<string>(OPEN)).toBe('ahp-session:/1f0a');
    await t.unmount();
  });
});

/*
 * Writing one down.
 *
 * The half that was missing until now: this client could list, run and switch
 * off an automation and could not make one, so the only way to have any was to
 * write the daemon's own file by hand and restart it.
 */
describe('writing a new automation', () => {
  const typeInto = async (t: Awaited<ReturnType<typeof open>>['t'], label: string, text: string) => {
    t.focus(`field.${label}`);
    await t.settle();
    t.type(text);
    for (let i = 0; i < 4; i++) await t.settle();
  };

  // Twenty-four rows in the default theme, which draws no input borders; a
  // theme that boxes every input needs a taller terminal for the same form.
  for (const [width, height, theme] of [[90, 24, 'paper'], [60, 24, 'paper'], [90, 36, 'dark'], [60, 36, 'dark']] as const) {
    it(`offers the form, at ${width}x${height} in ${theme}`, async () => {
      const { t } = await open(width, height, theme);
      await t.app.execute('automation.new');
      for (let i = 0; i < 8; i++) await t.settle();
      expect(t.hasText('A new automation')).toBe(true);
      // Both halves of the choice are on screen: a schedule, or nothing and
      // run it by hand. The second is the line that changes as you type, so it
      // is the one that has to survive a narrow shell.
      expect(t.hasText('Schedule')).toBe(true);
      expect(t.hasText('Prompt')).toBe(true);
      expect(t.hasText('presses Run')).toBe(true);
      // The common ones, offered rather than left to be known.
      expect(t.hasText('By hand only')).toBe(true);
      // And the button that submits it, on screen at 24 rows - this library's
      // scroll view does not follow focus, so anything below the fold here is
      // unreachable rather than merely out of sight.
      expect(t.hasText('Create')).toBe(true);
      await t.unmount();
    });
  }

  it('writes one the host then holds', async () => {
    const { t, host } = await open();
    const before = ((await host.automations?.()) ?? []).length;

    const made = await host.createAutomation?.({
      title: 'Weekly audit',
      enabled: true,
      message: { text: 'audit the framework' },
      session: { provider: 'claude' },
      triggers: [{ id: 't1', kind: 'schedule', schedule: { expression: '0 9 * * 1', timeZone: 'UTC' } }],
    });

    const after = (await host.automations?.()) ?? [];
    expect(after).toHaveLength(before + 1);
    const one = after.find((each) => each.resource === made);
    expect(one?.title).toBe('Weekly audit');
    expect(one?.schedule?.expression).toBe('0 9 * * 1');
    // The host's answer, which is the confirmation the form is waiting for -
    // this client never works out when a schedule comes round.
    expect(typeof one?.nextRunAt).toBe('string');
    await t.unmount();
  });

  it('writes a manual-only one as an empty trigger list, not a broken schedule', async () => {
    const { t, host } = await open();
    const made = await host.createAutomation?.({
      title: 'By hand',
      enabled: true,
      message: { text: 'do the thing' },
      session: { provider: 'claude' },
      triggers: [],
    });
    const one = ((await host.automations?.()) ?? []).find((each) => each.resource === made);
    // No schedule and nothing coming, and still runnable. The protocol says an
    // empty trigger list is what manual-only means.
    expect(one?.schedule).toBeUndefined();
    expect(one?.nextRunAt).toBeUndefined();
    expect(one?.operations).toContain('run');
    await t.unmount();
  });

  it('shows the new one in the list without being told to re-read', async () => {
    const { t, host } = await open();
    await host.createAutomation?.({
      title: 'Weekly audit',
      enabled: true,
      message: { text: 'audit' },
      session: { provider: 'claude' },
      triggers: [],
    });
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Weekly audit')).toBe(true);
    await t.unmount();
  });
});

/*
 * Changing one.
 *
 * The form opens on what the host holds and sends back each field whole, so
 * what it does not draw - `_meta`, a custom agent, the schedule trigger's id
 * and misfire policy - has to reach the host unchanged.
 */
describe('editing an automation', () => {
  const held = async (host: ReturnType<typeof fakeHost>) =>
    ((await host.automations?.()) ?? []).find((one) => one.resource === 'ahp-automation:/9c4a');

  it('opens on e with what the host holds', async () => {
    const { t } = await open(110, 30, 'paper');
    t.press('e');
    for (let i = 0; i < 12; i++) await t.settle();
    expect(t.hasText('Edit Nightly framework build')).toBe(true);
    expect(t.hasText('Build every libbrb_* library')).toBe(true);
    expect(t.hasText('Sonnet 5')).toBe(true);
    expect(t.hasText('Save')).toBe(true);
    await t.unmount();
  });

  it('offers the harness, the model and the host\'s settings', async () => {
    const { t } = await open(110, 30, 'paper');
    t.press('n');
    for (let i = 0; i < 12; i++) await t.settle();
    expect(t.hasText('Harness')).toBe(true);
    expect(t.hasText('Model')).toBe(true);
    // The host's own questions, in its words.
    expect(t.hasText('Isolation')).toBe(true);
    expect(t.hasText('Permissions')).toBe(true);
    await t.unmount();
  });

  it('saves a change and keeps what the form does not draw', async () => {
    const { t, host } = await open(110, 30, 'paper');
    t.press('e');
    for (let i = 0; i < 12; i++) await t.settle();
    t.type(' v2');
    for (let i = 0; i < 4; i++) await t.settle();
    // Save is the last stop, so one step back from the first field.
    t.press('shift+tab');
    await t.settle();
    t.press('enter');
    for (let i = 0; i < 12; i++) await t.settle();

    const after = await held(host);
    expect(after?.title).toBe('Nightly framework build v2');
    const definition = after?.definition as Record<string, any>;
    expect(definition._meta).toEqual({ 'example.com/owner': 'softov' });
    expect(definition.session.agent).toEqual({ uri: 'agent://reviewer' });
    expect(definition.session.provider).toBe('claude');
    expect(definition.session.model.id).toBe('claude-sonnet-5');
    expect(definition.message.origin).toEqual({ kind: 'automation' });
    expect(definition.triggers[0].id).toBe('nightly');
    expect(definition.triggers[0].misfirePolicy).toBe('skip');
    await t.unmount();
  });

  it('will not open for one the host does not offer update on', async () => {
    const { t, host } = await open(110, 30, 'paper');
    t.app.store.set(AUTOMATION_ROW, 'ahp-automation:/2e71');
    // The fixture's switched-off one offers update, so take it away.
    const found = ((await host.automations?.()) ?? []).find((one) => one.resource === 'ahp-automation:/2e71');
    if (found) found.operations = [];
    await t.app.execute('automation.edit');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('Edit Triage')).toBe(false);
    await t.unmount();
  });

  // It has drifted twice: the prompt is a TextArea, which has no border of its
  // own, so its text has to be inset by hand to line up with a TextInput's.
  for (const theme of ['paper', 'dark'] as const) {
    it(`lines the prompt up with the name, in ${theme}`, async () => {
      const { t } = await open(110, 36, theme);
      t.press('e');
      for (let i = 0; i < 12; i++) await t.settle();
      const rows = t.text().split('\n');
      const column = (label: RegExp, word: string) => (rows.find((row) => label.test(row)) ?? '').indexOf(word);
      expect(column(/Prompt\*/, 'Build')).toBeGreaterThan(0);
      expect(column(/Prompt\*/, 'Build')).toBe(column(/Name\*/, 'Nightly'));
      await t.unmount();
    });
  }
});
