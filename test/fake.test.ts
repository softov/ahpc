import { expect, it } from 'vitest';
import { fakeHost } from '../src/ahp/fake.js';
import { operate } from '../src/ahp/operate.js';
import type { HostConnection } from '../src/ahp/connection.js';
import type { HostEvent } from '../src/ahp/connection.js';
import type { Changeset } from '../src/ahp/types.js';

/*
 * The scripted host, against the seam it implements.
 *
 * `--static` draws this and most of the suite runs against it, so anything on
 * `HostConnection` that the fake does not implement is a feature that can only
 * be tested against a real daemon - which is to say not tested. What is checked
 * here is the half that was added to the seam after the fake was written, plus
 * the fact that it is all there at all.
 */

/** The seeded session that has changes. The only one with a changeset to scope. */
const WITH_CHANGES = 'ahp-session:/4e18';
const DIR = '/brb_main/src/brb_backend';

it('implements every optional method on the seam', () => {
  const host = fakeHost();
  // Named rather than counted, so a method added to `HostConnection` and not
  // to the fake fails here instead of being noticed a screen later.
  const optional: (keyof HostConnection)[] = [
    'changesets', 'review', 'resourceList', 'resourceRead', 'dispatch', 'flush',
    'invoke', 'requestResource',
    'automations', 'onAutomations', 'createAutomation', 'runAutomation', 'setAutomationEnabled', 'removeAutomation',
  ];
  for (const name of optional) expect(typeof host[name], name).toBe('function');
  // `close` is the one that stays absent, and on purpose: it exists for a host
  // holding a socket or a subprocess, and this one is a pile of objects that
  // ends when the process does.
  expect(host.close).toBeUndefined();
});

it('says what each harness offers before any session exists', async () => {
  const host = fakeHost();
  const [claude, copilot] = await host.agents();
  // The protocol puts the list here as well as on a session, and says entries
  // here are propagated into a session's own. So they have to be the same list
  // or the fixture is lying about the relationship it exists to show.
  const offered = claude?.customizations ?? [];
  expect(offered.length).toBeGreaterThan(0);
  expect(offered.map((one) => one.id).sort())
    .toEqual((await host.customizations('ahp-session:/4e18')).map((one) => one.id).sort());
  // A harness nobody has signed into enumerates no models and no
  // customizations. Both halves of "none" have to be scriptable.
  expect(copilot?.models).toEqual([]);
  expect(copilot?.customizations).toBeUndefined();
});

it('offers four scopes, two of them templates still to be filled in', async () => {
  const host = fakeHost();
  const scopes = await host.changesets?.(WITH_CHANGES) ?? [];
  expect(scopes.map((one) => one.changeKind)).toEqual(['session', 'uncommitted', 'turn', 'compare-turns']);
  // A template with variables left in it is not a URI, and a client that
  // subscribed to one verbatim would ask for a channel with braces in it.
  expect(scopes.filter((one) => one.variables.length > 0).map((one) => one.variables))
    .toEqual([['turnId'], ['originalTurnId', 'modifiedTurnId']]);
  // The working tree is not reviewable and the rest are, which is the case a
  // screen has to draw differently.
  expect(scopes.map((one) => one.reviewable === true)).toEqual([true, false, true, true]);
});

it('says nothing for a session that changed nothing', async () => {
  const host = fakeHost();
  const rows = await host.listSessions();
  const quiet = rows.find((row) => row.changes === undefined);
  expect(quiet).toBeDefined();
  expect(await host.changesets?.(quiet?.resource ?? '')).toEqual([]);
});

it('answers a different changeset per scope, which is the point of having scopes', async () => {
  const host = fakeHost();
  const scopes = await host.changesets?.(WITH_CHANGES) ?? [];
  const session = await host.changes(WITH_CHANGES, `${WITH_CHANGES}/changeset/session`);
  const tree = await host.changes(WITH_CHANGES, `${WITH_CHANGES}/changeset/uncommitted`);
  expect(session.files.length).toBeGreaterThan(0);
  // The working tree holds work nobody's agent did. If these two were the same
  // list, a picker would be switching between two identical screens.
  expect(tree.files.length).toBe(session.files.length + 1);
  expect(tree.files.some((file) => file.uri.endsWith('notes.todo'))).toBe(true);

  // And a turn's, reached by filling in the template the way a client does -
  // from a turn it can already see, which is where the id is.
  const seen: HostEvent[] = [];
  host.subscribe(WITH_CHANGES, (event) => seen.push(event)).close();
  const opening = seen.find((event) => event.type === 'snapshot') as { turns: { id: string; role: string }[] } | undefined;
  const spoken = opening?.turns.find((turn) => turn.role === 'agent');
  expect(spoken).toBeDefined();
  const template = scopes.find((one) => one.changeKind === 'turn');
  const one = await host.changes(
    WITH_CHANGES,
    (template?.uriTemplate ?? '').replace('{turnId}', spoken?.id ?? ''),
  );
  expect(one.files).toHaveLength(1);
});

it('refuses a scope that is not one of them, rather than answering empty', async () => {
  const host = fakeHost();
  // An empty changeset and a changeset that does not exist are different
  // answers, and a client that showed "no changes" for the second is one
  // nobody can tell a typo from a clean tree on.
  await expect(host.changes(WITH_CHANGES, `${WITH_CHANGES}/changeset/turn/never-happened`))
    .rejects.toThrow();
});

it('keeps a tick, tells whoever is watching, and takes it back', async () => {
  const host = fakeHost();
  const changeset = `${WITH_CHANGES}/changeset/session`;
  const seen: HostEvent[] = [];
  const watch = host.subscribe(WITH_CHANGES, (event) => seen.push(event));
  const first = (await host.changes(WITH_CHANGES, changeset)).files[0];
  expect(first?.reviewed).toBeUndefined();

  host.review?.(changeset, [first?.uri ?? ''], true);
  const after = seen.filter((event) => event.type === 'changes').pop() as { changes: Changeset } | undefined;
  // The host says it, rather than the client keeping its own copy: two clients
  // on one changeset have to agree, and only the host can make them.
  expect(after?.changes.files[0]?.reviewed).toBe(true);
  expect((await host.changes(WITH_CHANGES, changeset)).files[0]?.reviewed).toBe(true);

  host.review?.(changeset, [first?.uri ?? ''], false);
  // Gone, not `false`. Absent is what the protocol calls not-yet-reviewed.
  expect('reviewed' in ((await host.changes(WITH_CHANGES, changeset)).files[0] ?? {})).toBe(false);
  watch.close();
});

it('lists and reads the same tree the at-sign completes against', async () => {
  const host = fakeHost();
  const top = await host.resourceList?.(`file://${DIR}`) ?? [];
  expect(top.map((entry) => entry.name)).toEqual(['src', 'test', 'README.md', 'package.json']);
  expect(top.filter((entry) => entry.kind === 'directory').map((entry) => entry.name)).toEqual(['src', 'test']);

  const inside = await host.resourceList?.(`file://${DIR}/src/ahp`) ?? [];
  expect(inside.map((entry) => entry.name)).toEqual(['fake.ts', 'live.ts', 'types.ts']);

  // Every leaf opens. A tree that lists nine files and reads two makes a
  // viewer look broken for a reason that is in the fixture.
  for (const entry of inside) {
    const read = await host.resourceRead?.(entry.uri);
    expect(read?.data.length, entry.uri).toBeGreaterThan(0);
    expect(read?.encoding).toBe('utf-8');
  }
});

it('refuses a path it does not serve, and a directory asked for as a file', async () => {
  const host = fakeHost();
  await expect(host.resourceRead?.('file:///etc/shadow')).rejects.toThrow();
  await expect(host.resourceRead?.(`file://${DIR}/src`)).rejects.toThrow();
  await expect(host.resourceList?.(`file://${DIR}/README.md`)).rejects.toThrow();
});

it('records every dispatched action and carries out the ones it knows', async () => {
  const host = fakeHost();
  const quiet = (await host.listSessions()).find((row) => (row.status & 32) !== 0);
  const uri = quiet?.resource ?? '';

  host.dispatch?.(uri, { type: 'session/isReadChanged', isRead: false });
  // One it has no behaviour for. A real host ignores what it does not handle;
  // the record is what makes that distinguishable from dropping it.
  host.dispatch?.(uri, { type: 'chat/truncated', turnId: 'nope' }, true);

  const sent = host.dispatched();
  expect(sent.map((one) => one.action.type)).toEqual(['session/isReadChanged', 'chat/truncated']);
  expect(sent[1]?.chat).toBe(true);
  // And the one it does know took effect, on the catalogue rather than only in
  // the record.
  const again = (await host.listSessions()).find((row) => row.resource === uri);
  expect((again?.status ?? 0) & 32).toBe(0);
});

it('starts a turn dispatched as an action, the same as one said', async () => {
  const host = fakeHost();
  const uri = (await host.listSessions())[0]?.resource ?? '';
  const seen: HostEvent[] = [];
  const watch = host.subscribe(uri, (event) => seen.push(event));
  host.dispatch?.(uri, { type: 'chat/turnStarted', turnId: 't', message: { text: 'what changed?' } }, true);
  await host.flush?.();
  // `flush` is the promise that what was dispatched has happened, which on a
  // socket is bytes leaving and here is the script running out.
  expect(seen.some((event) => event.type === 'turnComplete')).toBe(true);
  expect(host.pending()).toBe(0);
  watch.close();
});

it('advertises different verbs per scope, and refuses one it did not', async () => {
  const host = fakeHost();
  const tree = await host.changes(WITH_CHANGES, `${WITH_CHANGES}/changeset/uncommitted`);
  const session = await host.changes(WITH_CHANGES, `${WITH_CHANGES}/changeset/session`);
  // The working tree can be committed and a conversation cannot; what a turn
  // changed can be put back because both sides of it were captured.
  expect((tree.operations ?? []).map((one) => one.id)).toEqual(['commit', 'discard']);
  expect((session.operations ?? []).map((one) => one.id)).toEqual(['revert']);
  // The advertised list is the access model, not a hint.
  await expect(host.invoke?.(`${WITH_CHANGES}/changeset/session`, 'commit'))
    .rejects.toMatchObject({ code: -32602 });
});

it('carries the confirmation, because a client MUST show it', async () => {
  const host = fakeHost();
  const tree = await host.changes(WITH_CHANGES, `${WITH_CHANGES}/changeset/uncommitted`);
  const discard = (tree.operations ?? []).find((one) => one.id === 'discard');
  expect(discard?.confirmation).toBeDefined();
  // And the one that is not destructive must not grow one.
  expect((tree.operations ?? []).find((one) => one.id === 'commit')?.confirmation).toBeUndefined();
});

it('refuses a write until it is asked for, and names the request that would do it', async () => {
  const host = fakeHost();
  const changeset = `${WITH_CHANGES}/changeset/uncommitted`;
  const denied = await host.invoke?.(changeset, 'commit').then(() => undefined, (e: unknown) => e) as {
    code: number; data: { request: { uri: string; write: boolean } };
  };
  expect(denied.code).toBe(-32009);
  expect(denied.data.request.write).toBe(true);
  expect(host.invoked()).toEqual([]);
});

it('negotiates once and then runs it, the same way against either host', async () => {
  const host = fakeHost();
  const changeset = `${WITH_CHANGES}/changeset/uncommitted`;
  const asked: string[] = [];
  const done = await operate(host, changeset, 'commit', { ask: (r) => { asked.push(r.uri); return true; } });
  expect(asked).toHaveLength(1);
  expect(done.message).toContain('Committed');
  // It ran *after* the grant rather than despite the gate.
  expect(host.invoked().map((one) => one.operationId)).toEqual(['commit']);
  // And what it did comes back on the changeset, not in that answer.
  expect((await host.changes(WITH_CHANGES, changeset)).files).toEqual([]);
});

it('lets somebody say no, and leaves the refusal standing', async () => {
  const host = fakeHost();
  const changeset = `${WITH_CHANGES}/changeset/uncommitted`;
  // Somebody asked whether to let a host write to their repository and said
  // no. That is an outcome, not a failure to handle.
  await expect(operate(host, changeset, 'commit', { ask: () => false }))
    .rejects.toMatchObject({ code: -32009 });
  expect(host.invoked()).toEqual([]);
});

it('delivers the opening snapshot inside subscribe, which is what a waiting caller must survive', async () => {
  const host = fakeHost();
  let arrived = false;
  // A host holding the state already has no reason to wait a tick, and this
  // one does not. Every caller that closes its subscription on the first event
  // has to cope with having no handle yet - which `until()` did not, so every
  // waiting command failed here and worked against a socket.
  const held = host.subscribe(WITH_CHANGES, (event) => { if (event.type === 'snapshot') arrived = true; });
  expect(arrived).toBe(true);
  held.close();
});
