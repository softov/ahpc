import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkingUpdates, newer, readUpdate, refreshUpdate, registry, stale, updateNotice } from '../src/update.js';

/*
 * The update check, without a network.
 *
 * The comparison is a table, and the same table is in ahpd's test of its copy,
 * in the same order - the two repositories share no package, so this is how
 * they are kept from disagreeing. The request is made against a server on
 * this machine that answers whatever the case needs, and the file is written
 * under an `XDG_CONFIG_HOME` that is thrown away after each case.
 */

describe('newer', () => {
  it.each([
    ['0.6.0', '0.5.0', true],
    ['0.10.0', '0.9.0', true],
    ['1.0.0', '0.99.99', true],
    ['0.5.0', '0.5.0', false],
    ['0.5.0', '0.6.0', false],
    ['0.5.0', '0.5.0-beta.1', true],
    ['0.5.0-beta.1', '0.5.0', false],
    ['0.5.0-beta.2', '0.5.0-beta.1', false],
    ['0.6.0', 'unknown', false],
    ['unknown', '0.5.0', false],
    ['', '0.5.0', false],
    ['1.2', '0.5.0', false],
    ['0.6.0', '1.2', false],
  ])('%s over %s is %s', (latest, current, expected) => {
    expect(newer(latest, current)).toBe(expected);
  });
});

describe('registry', () => {
  it('assumes npmjs.org when nothing says otherwise', () => {
    expect(registry({})).toBe('https://registry.npmjs.org');
  });
  it('reads npm_config_registry, without its trailing slash', () => {
    expect(registry({ npm_config_registry: 'https://mirror.example/npm/' })).toBe('https://mirror.example/npm');
    expect(registry({ npm_config_registry: 'http://127.0.0.1:4873' })).toBe('http://127.0.0.1:4873');
  });
});

describe('checkingUpdates', () => {
  it('is on with nothing against it', () => { expect(checkingUpdates(true, {}, true)).toBe(true); });
  it('is off when the flag or the file said so', () => { expect(checkingUpdates(false, {}, true)).toBe(false); });
  it('is off without a terminal', () => { expect(checkingUpdates(true, {}, false)).toBe(false); });
  it('is off under NO_UPDATE_NOTIFIER, whatever it says', () => {
    expect(checkingUpdates(true, { NO_UPDATE_NOTIFIER: '1' }, true)).toBe(false);
    expect(checkingUpdates(true, { NO_UPDATE_NOTIFIER: '' }, true)).toBe(false);
  });
  it('is off on CI', () => { expect(checkingUpdates(true, { CI: 'true' }, true)).toBe(false); });
});

describe('stale', () => {
  const now = Date.parse('2026-09-18T12:00:00Z');
  it('is true with no file', () => { expect(stale(undefined, now)).toBe(true); });
  it('is false for an answer an hour old', () => {
    expect(stale({ name: 'x', latest: '1.0.0', checkedAt: '2026-09-18T11:00:00Z' }, now)).toBe(false);
  });
  it('is true for one seven hours old', () => {
    expect(stale({ name: 'x', latest: '1.0.0', checkedAt: '2026-09-18T05:00:00Z' }, now)).toBe(true);
  });
  it('is true when the date does not read', () => {
    expect(stale({ name: 'x', latest: '1.0.0', checkedAt: 'yesterday' }, now)).toBe(true);
  });
});

describe('the file', () => {
  let home: string;
  let had: string | undefined;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'ahpc-update-'));
    had = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = home;
  });
  afterEach(() => {
    if (had === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = had;
    rmSync(home, { recursive: true, force: true });
  });
  const at = (): string => join(home, 'ahpc', 'update.json');
  const put = (text: string): void => {
    mkdirSync(join(home, 'ahpc'), { recursive: true });
    writeFileSync(at(), text);
  };

  it('reads nothing when there is no file', () => {
    expect(readUpdate()).toBeUndefined();
  });
  it('reads nothing from a broken file', () => {
    put('{not json');
    expect(readUpdate()).toBeUndefined();
  });
  it('reads nothing from a file of the wrong shape', () => {
    put(JSON.stringify({ latest: 5 }));
    expect(readUpdate()).toBeUndefined();
  });
  it('reads a good file', () => {
    put(JSON.stringify({ name: '@softov/ahpc', latest: '9.9.9', checkedAt: '2026-09-18T12:00:00Z' }));
    expect(readUpdate()).toEqual({ name: '@softov/ahpc', latest: '9.9.9', checkedAt: '2026-09-18T12:00:00Z' });
  });

  describe('updateNotice', () => {
    const self = { name: '@softov/ahpc', version: '0.5.0' };
    it('says nothing with no file', () => { expect(updateNotice(self)).toBeNull(); });
    it('says nothing about another package', () => {
      put(JSON.stringify({ name: '@ahpd/server', latest: '9.9.9', checkedAt: '2026-09-18T12:00:00Z' }));
      expect(updateNotice(self)).toBeNull();
    });
    it('says nothing when this one is not behind', () => {
      put(JSON.stringify({ name: '@softov/ahpc', latest: '0.5.0', checkedAt: '2026-09-18T12:00:00Z' }));
      expect(updateNotice(self)).toBeNull();
      put(JSON.stringify({ name: '@softov/ahpc', latest: '0.4.0', checkedAt: '2026-09-18T12:00:00Z' }));
      expect(updateNotice(self)).toBeNull();
    });
    it('says the one sentence when it is', () => {
      put(JSON.stringify({ name: '@softov/ahpc', latest: '0.6.0', checkedAt: '2026-09-18T12:00:00Z' }));
      expect(updateNotice(self)).toBe('@softov/ahpc 0.6.0 is on npm, this is 0.5.0');
    });
  });

  describe('refreshUpdate', () => {
    let server: Server | undefined;
    afterEach(async () => { await new Promise<void>((done) => server ? server.close(() => done()) : done()); server = undefined; });
    const serve = async (answer: (path: string, respond: (status: number, body?: string) => void) => void): Promise<string> => {
      server = createServer((request, response) => {
        answer(request.url ?? '', (status, body) => {
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(body);
        });
      });
      await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
      return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
    };

    it('writes what the registry said, at the dist-tags path', async () => {
      let asked = '';
      const base = await serve((path, respond) => { asked = path; respond(200, '{"latest":"9.9.9","next":"10.0.0-rc.1"}'); });
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      expect(asked).toBe('/-/package/@softov/ahpc/dist-tags');
      const written = JSON.parse(readFileSync(at(), 'utf8')) as { name: string; latest: string; checkedAt: string };
      expect(written.name).toBe('@softov/ahpc');
      expect(written.latest).toBe('9.9.9');
      expect(Number.isNaN(Date.parse(written.checkedAt))).toBe(false);
    });
    it('replaces an old answer with the new one', async () => {
      put(JSON.stringify({ name: '@softov/ahpc', latest: '0.6.0', checkedAt: '2026-09-18T12:00:00Z' }));
      const base = await serve((_, respond) => respond(200, '{"latest":"0.7.0"}'));
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      const written = JSON.parse(readFileSync(at(), 'utf8')) as { latest: string; checkedAt: string };
      expect(written.latest).toBe('0.7.0');
      expect(written.checkedAt).not.toBe('2026-09-18T12:00:00Z');
    });
    it('writes nothing on a 404', async () => {
      const base = await serve((_, respond) => respond(404, '{"error":"Not found"}'));
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      expect(existsSync(at())).toBe(false);
    });
    it('leaves the old answer alone when the registry fails', async () => {
      const before = JSON.stringify({ name: '@softov/ahpc', latest: '0.6.0', checkedAt: '2026-09-18T12:00:00Z' });
      put(before);
      const base = await serve((_, respond) => respond(503, '{"error":"down"}'));
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      expect(readFileSync(at(), 'utf8')).toBe(before);
    });
    it('leaves the old answer alone when nothing answers', async () => {
      const before = JSON.stringify({ name: '@softov/ahpc', latest: '0.6.0', checkedAt: '2026-09-18T12:00:00Z' });
      put(before);
      const base = await serve((_, respond) => respond(200, '{}'));
      await new Promise<void>((done) => server?.close(() => done()));
      server = undefined;
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      expect(readFileSync(at(), 'utf8')).toBe(before);
    });
    it('writes nothing when the body is not what was asked for', async () => {
      const base = await serve((_, respond) => respond(200, '<html>sign in</html>'));
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      expect(existsSync(at())).toBe(false);
    });
    it('writes nothing and gives up when nothing answers', async () => {
      const base = await serve(() => { /* never responds */ });
      const began = Date.now();
      await refreshUpdate({ name: '@softov/ahpc', registry: base, timeoutMs: 200 });
      expect(Date.now() - began).toBeLessThan(2000);
      expect(existsSync(at())).toBe(false);
    });
    it('writes nothing when the port is closed', async () => {
      const base = await serve((_, respond) => respond(200, '{}'));
      await new Promise<void>((done) => server?.close(() => done()));
      server = undefined;
      await refreshUpdate({ name: '@softov/ahpc', registry: base });
      expect(existsSync(at())).toBe(false);
    });
  });
});
