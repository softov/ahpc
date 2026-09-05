/*
 * Everything this client says, checked against what the protocol declares.
 *
 * Not a committed fixture. The frames are the ones this run just produced,
 * recorded on the way past and checked in the same process - so there is
 * nothing to keep up to date, nothing to regenerate, and no way for the check
 * to go green against a recording of yesterday's behaviour. A capture on disk
 * is for reading by hand; this is the one that fails a build.
 *
 * It exists because reading the source cannot answer the question. A
 * conditional spread - `...(x ? { k } : {})` - is not excess-property-checked
 * by TypeScript, so this client can be typed against the package and still put
 * an undeclared field on the wire. Two were found that way within an hour of
 * being written: a resource watch reading `kind` where `ResourceChange`
 * declares `type`, and a terminal claim sent as a string where `TerminalClaim`
 * is an object and required. Both typechecked.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';
// The same checker `npm run wire` is, over the same generated schema.
// @ts-expect-error - a tool, in JavaScript, deliberately outside the build
import { findings } from '../tools/validate.mjs';

const ROOT = 'ahp-root://';
const SESSION = 'ahp-session:/c1';
const CHAT = 'ahp-chat:/c1';
const TERMINAL = 'ahp-terminal:/c1';

/**
 * A host that answers everything and asserts nothing.
 *
 * Deliberately permissive: what is under test is what this client *sends*, and
 * a host that refused would stop the client sending the rest of it.
 */
function scripted(transport: AhpTransport): void {
  const states: Record<string, Record<string, unknown>> = {
    [ROOT]: {
      agents: [{
        provider: 'claude',
        displayName: 'Claude',
        description: 'scripted',
        models: [{ id: 'opus', name: 'Opus', provider: 'claude' }],
        protectedResources: [{ resource: 'https://api.anthropic.com' }],
      }],
      terminals: [],
    },
    [SESSION]: { defaultChat: CHAT, chats: [], lifecycle: 'ready', provider: 'claude', title: 'x' },
    [CHAT]: { turns: [] },
    [TERMINAL]: { title: 'bash', content: [] },
  };

  void (async () => {
    for (;;) {
      const frame = await transport.recv().catch(() => null);
      if (frame === null) return;
      // The transport hands back one of three shapes; only the two that carry
      // a message are of any use here.
      const text = frame.kind === 'text'
        ? frame.text
        : frame.kind === 'parsed' ? JSON.stringify(frame.message) : '';
      let message: Record<string, unknown>;
      try { message = JSON.parse(text) as Record<string, unknown>; }
      catch { continue; }
      const { id, method } = message as { id?: number; method?: string };
      if (id === undefined || method === undefined) continue;

      const channel = (message.params as { channel?: string } | undefined)?.channel ?? '';
      const result = method === 'initialize'
        ? { protocolVersion: '0.9.0', serverSeq: 1, snapshots: [{ resource: ROOT, state: states[ROOT], fromSeq: 1 }] }
        : method === 'subscribe'
          ? { snapshot: { resource: channel, state: states[channel] ?? {}, fromSeq: 1 } }
          : method === 'listSessions' ? { items: [] }
            : method === 'resourceResolve' ? { uri: 'file:///x', type: 'file', etag: 'v1' }
              : method === 'resourceList' ? { entries: [] }
                : method === 'resourceRead' ? { data: '', encoding: 'utf-8' }
                  : method === 'createResourceWatch' ? { channel: 'ahp-resource-watch:/w' }
                    : method === 'listAutomationTriggerDefinitions' ? { items: [] }
                      : method === 'fetchAutomationRuns' ? { runs: [] }
                        : method === 'sessionConfigCompletions' ? { items: [] }
                          : method === 'resolveSessionConfig' ? { schema: { type: 'object', properties: {} }, values: {} }
                            : method === 'completions' ? { items: [] }
                              : method === 'createTerminal' ? null
                                : {};
      await transport.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }
  })();
}

let capture = '';
let where = '';

beforeAll(async () => {
  where = await mkdtemp(path.join(tmpdir(), 'ahpc-conformance-'));
  const file = path.join(where, 'wire.jsonl');
  const was = process.env.AHPC_RECORD;
  process.env.AHPC_RECORD = file;
  try {
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-conformance',
      backoff: [0],
      keepaliveMs: 0,
      lingerMs: 0,
      connect: async (): Promise<AhpTransport> => {
        const [mine, theirs] = InMemoryTransport.pair();
        scripted(theirs);
        return mine;
      },
    });

    /*
     * Everything this client can send, once each.
     *
     * A list rather than a scenario: what is under test is the shape of each
     * frame, and a payload that is never sent is a payload nothing checks.
     */
    host.subscribe(SESSION as never, () => undefined);
    await settle();

    host.say(SESSION as never, 'hello', { id: 'opus', config: { thinkingLevel: 'high' } });
    host.queue(SESSION as never, 'later', { id: 'opus' });
    host.unqueue(SESSION as never, 'q1');
    host.setDraft(SESSION as never, 'half typed');
    host.setDraft(SESSION as never, '');
    host.setArchived(SESSION as never, true);
    host.setRead(SESSION as never, true);
    host.setConfig(SESSION as never, 'permissionMode', 'auto');
    host.stopTurn(SESSION as never);

    host.writeTerminal(TERMINAL, 'ls\n');
    host.resizeTerminal(TERMINAL, 120, 40);
    host.clearTerminal(TERMINAL);
    host.renameTerminal(TERMINAL, 'build');
    host.claimTerminal(TERMINAL);

    await host.listSessions();
    await host.agents();
    await host.createSession({ provider: 'claude' });
    await host.resourceResolve?.('file:///x/a.txt');
    await host.resourceWrite?.('file:///x/a.txt', 'body', { ifMatch: 'v1' });
    await host.resourceDelete?.('file:///x/a.txt', { recursive: true });
    await host.resourceMkdir?.('file:///x/sub');
    await host.resourceMove?.('file:///x/a.txt', 'file:///x/b.txt');
    await host.resourceCopy?.('file:///x/b.txt', 'file:///x/c.txt');
    await host.authenticate?.('https://api.anthropic.com', 'tok', { expiresIn: 60 });
    await host.configCompletions?.({ property: 'branch', provider: 'claude' });
    await host.automationTriggers?.();
    await host.automationRuns?.('ahp-automation:/a1');
    await settle();
    await host.close();
  }
  finally {
    if (was === undefined) delete process.env.AHPC_RECORD; else process.env.AHPC_RECORD = was;
  }
  capture = await readFile(file, 'utf8');
});

afterAll(async () => { await rm(where, { recursive: true, force: true }); });

async function settle(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => { setTimeout(resolve, 1); });
}

/** Only what this client sent. What the scripted host answered is not under test. */
function outbound(text: string): string {
  return text.split('\n').filter((line) => {
    try { return (JSON.parse(line) as { from?: string }).from === 'client'; }
    catch { return false; }
  }).join('\n');
}

describe('every frame this client sends is one the protocol declares', () => {
  it('sends a payload the schema recognises for each method it uses', () => {
    const report = findings(outbound(capture)) as {
      checked: number;
      unroutable: string[];
    };
    // If this drops to nothing the run above stopped exercising anything, and
    // a check over no payloads passes for the wrong reason.
    expect(report.checked).toBeGreaterThan(20);
    // A method whose params have no declaration is either a typo here or a
    // name this client made up.
    expect(report.unroutable).toEqual([]);
  });

  it('puts no undeclared field on the wire, and leaves no required one out', () => {
    const report = findings(outbound(capture)) as {
      found: { what: string; count: number }[];
    };
    /*
     * One known exception, and it is a version skew rather than a defect.
     *
     * `authenticate` carries `expiresIn`, which `authentication.md` has four
     * MUSTs about and which the *published* package does not declare - the
     * specification repository is ahead of it. Named here rather than
     * suppressed by pattern, so the day it publishes this line fails and
     * somebody deletes it.
     */
    const known = 'AuthenticateParams / undeclared key `expiresIn`';
    const real = report.found.filter((one) => one.what !== known);
    expect(real.map((one) => one.what)).toEqual([]);
    expect(report.found.some((one) => one.what === known)).toBe(true);
  });
});
