import { describe, expect, it } from 'vitest';
import { renderStill } from '@textui/terminal';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { CONTROLLER } from '../src/control.js';
import { answered } from '../src/tui.js';
import { ROOT, SESSION, connect, settle } from './scenario.js';

/*
 * A still against a live host draws once the host has answered.
 *
 * On 2026-11-04 a still of the changes screen said "Nothing changed" while
 * `ahpc changes` listed three files from the same host at the same moment:
 * the frame was taken before the answer arrived.
 */

describe('idle on a live connection', () => {
  it('answers false at once when nothing is open', async () => {
    const { host } = await connect();
    await settle();
    expect(await host.idle?.(1000)).toBe(false);
    await host.close();
  });

  it('waits for a subscribe the host holds, and answers true once it is answered', async () => {
    const { host, scripted, read } = await connect();
    scripted.states.set(SESSION, { defaultChat: 'ahp-chat:/x', chats: [], status: 1 });
    scripted.slow.add(SESSION);
    const reader = read();
    await settle();

    let done = false;
    const waiting = host.idle?.(5000).then((value) => { done = true; return value; });
    await settle();
    expect(done).toBe(false);

    await scripted.release();
    expect(await waiting).toBe(true);
    reader.close();
    await host.close();
  });

  it('gives up at the limit on a subscribe that is never answered', async () => {
    const { host, scripted, read } = await connect();
    scripted.slow.add(SESSION);
    const reader = read();
    await settle();

    const began = Date.now();
    expect(await host.idle?.(50)).toBe(true);
    expect(Date.now() - began).toBeGreaterThanOrEqual(45);
    expect(scripted.stillOpen()).toContain(ROOT);
    reader.close();
    await host.close();
  });
});

/** The scripted host, with the catalogue, the session and its changes answered late, and `idle` counting them. */
function late(delayMs: number, never = false) {
  const host = fakeHost();
  let open = 0;
  const quiet = new Set<() => void>();
  /** The same answer, `delayMs` later, and counted until then. */
  const slowly = <T,>(answer: () => Promise<T>): Promise<T> => {
    open += 1;
    return new Promise<T>((resolve, reject) => {
      if (never) return;
      setTimeout(() => {
        answer().then(resolve, reject).finally(done);
      }, delayMs);
    });
  };
  /** One answer fewer open, and the waiters told. */
  const done = (): void => {
    open -= 1;
    for (const wake of [...quiet]) wake();
  };
  const join = host.subscribe.bind(host);
  // A session's events, which a live host starts to send once it answers the
  // subscribe: held until then, and passed on as they come after it.
  host.subscribe = (uri, observer, chat) => {
    open += 1;
    let held: Parameters<typeof observer>[0][] | undefined = [];
    if (!never) {
      setTimeout(() => {
        const waiting = held ?? [];
        held = undefined;
        for (const event of waiting) observer(event);
        done();
      }, delayMs);
    }
    return join(uri, (event) => {
      if (held) held.push(event);
      else observer(event);
    }, chat);
  };
  const listed = host.listSessions.bind(host);
  host.listSessions = () => slowly(listed);
  const sets = host.changesets?.bind(host);
  const watch = host.watchChanges.bind(host);
  // The first answer of a watch is its snapshot, which a live host sends
  // after the subscribe is answered.
  host.watchChanges = (changeset, observer) => {
    open += 1;
    let first = true;
    return watch(changeset, (found) => {
      if (!first) { observer(found); return; }
      first = false;
      if (never) return;
      setTimeout(() => { observer(found); done(); }, delayMs);
    });
  };
  const files = host.changes.bind(host);
  if (sets) host.changesets = (uri) => slowly(() => sets(uri));
  host.changes = (uri, wanted) => slowly(() => files(uri, wanted));
  host.idle = (limitMs) => {
    if (open === 0) return Promise.resolve(false);
    return new Promise((done) => {
      const wake = (): void => { clearTimeout(timer); quiet.delete(wake); done(true); };
      const timer = setTimeout(wake, limitMs);
      quiet.add(wake);
    });
  };
  return host;
}

/** A still of the changes screen of the scripted session with edits, waiting as `still` waits. */
async function still(host: ReturnType<typeof fakeHost>, limitMs: number): Promise<string> {
  const { text } = await renderStill({
    width: 100,
    height: 30,
    theme: 'workbench',
    shell: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
    before: async (app) => {
      const end = Date.now() + limitMs;
      app.services.require(CONTROLLER).open('ahp-session:/4e18');
      await answered(app, host, end - Date.now());
      app.screens.push('changes');
      await answered(app, host, end - Date.now());
    },
  });
  return text;
}

describe('a still of a screen the host answers late', () => {
  it('lists the files a host answers after 300 ms', async () => {
    const text = await still(late(300), 10_000);
    expect(text).not.toContain('Nothing changed');
    expect(text).toContain('compileLinux.sh');
  });

  it('draws after the cap when the host never answers', async () => {
    const began = Date.now();
    await still(late(0, true), 200);
    expect(Date.now() - began).toBeLessThan(5000);
  });
});
