import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { HOST_ERROR, PROVIDER } from '../src/state.js';
import type { Agent } from '../src/ahp/types.js';

/**
 * The provider a new session starts on.
 *
 * It is the first agent the host lists, never a name this client chose. A
 * host with no `claude` agent refused every settings read for `claude`, and
 * every screen drew that refusal on its status row.
 */

const agent = (provider: string): Agent => ({ provider, displayName: provider, models: [] });

/** The scripted host with the agents given, and a settings read that refuses any other provider. */
async function boot(agents: Agent[]): Promise<{ t: Harness; asked: string[] }> {
  const host = fakeHost();
  const asked: string[] = [];
  host.agents = async () => agents;
  const resolve = host.resolveConfig.bind(host);
  host.resolveConfig = async (params) => {
    asked.push(params.provider);
    if (!agents.some((one) => one.provider === params.provider)) {
      throw new Error(`No provider called ${params.provider} (-32002)`);
    }
    return resolve(params);
  };
  const t = await renderApp({
    width: 100,
    height: 30,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  t.app.screens.push('new');
  for (let i = 0; i < 8; i++) await t.settle();
  return { t, asked };
}

describe('the provider of a new session', () => {
  it('is the first agent the host lists', async () => {
    const { t, asked } = await boot([agent('notes'), agent('echo')]);
    expect(t.app.store.get<string>(PROVIDER)).toBe('notes');
    expect(asked).not.toContain('claude');
    expect(t.app.store.get<string>(HOST_ERROR) ?? '').toBe('');
    await t.unmount();
  });

  it('stays empty on a host with no agents, and reads no settings', async () => {
    const { t, asked } = await boot([]);
    expect(t.app.store.get<string>(PROVIDER)).toBe('');
    expect(asked).toEqual([]);
    expect(t.app.store.get<string>(HOST_ERROR) ?? '').toBe('');
    await t.unmount();
  });

  it('is claude on the scripted host as it is, whose first agent is claude', async () => {
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host: fakeHost() }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.app.store.get<string>(PROVIDER)).toBe('claude');
    await t.unmount();
  });
});
