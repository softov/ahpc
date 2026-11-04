#!/usr/bin/env node
/**
 * `npm run docs:pictures`: draws the pictures in `docs/img/` from ahpd's demo host.
 *
 * Starts `examples/demo` from the ahpd checkout in `AHPD_DIR`, over a demo
 * folder made fresh in a scratch folder. Makes the demo data with ahpc's own
 * commands: sessions in each state, a second chat, a terminal and five
 * automations. Draws each picture with `ahpc --static --svg`, then stops the
 * host and removes the scratch folder. Every process gets its XDG folders in
 * the scratch folder, so nothing is written to your own.
 *
 * Every name in the demo data is neutral, because the pictures are public.
 */

import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const main = join(root, 'dist', 'src', 'main.js');
const images = join(root, 'docs', 'img');

const ahpd = process.env.AHPD_DIR;
if (!ahpd) {
  process.stderr.write('docs:pictures needs AHPD_DIR, the folder of an ahpd checkout.\n');
  process.exit(1);
}

/**
 * The scratch folder: the demo folders, and every XDG folder.
 *
 * One fixed path, because the pictures show it: a path under a home folder
 * names its owner, and a random one changes every picture on every run.
 */
const scratch = '/tmp/ahpc-demo';
if (existsSync(scratch)) {
  process.stderr.write(`${scratch} is there already. Remove it, and run this again.\n`);
  process.exit(1);
}
mkdirSync(scratch);
const work = join(scratch, 'work');
const app = join(work, 'notes-app');
const site = join(work, 'website');
const env = {
  ...process.env,
  XDG_CONFIG_HOME: join(scratch, 'config'),
  XDG_DATA_HOME: join(scratch, 'data'),
  XDG_STATE_HOME: join(scratch, 'state'),
  // The shell a terminal runs, with a prompt that names nobody. A login
  // shell's own prompt shows the user and the machine.
  SHELL: '/bin/sh',
  PS1: '$ ',
};
delete env.AHPC_HOST;

/** Processes to stop at the end: the host, and turns left running. */
const started = [];

/** Stop everything this started, and remove the scratch folder. Safe to call twice. */
let finished = false;
const finish = () => {
  if (finished) return;
  finished = true;
  for (const child of started) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  rmSync(scratch, { recursive: true, force: true });
};
process.on('exit', finish);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { finish(); process.exit(130); });
}

/** Write a file, making its folder. */
const put = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

/** Run git in a folder, as a neutral author. */
const git = (cwd, ...args) => run('git', ['-c', 'user.name=Demo', '-c', 'user.email=demo@example.com', ...args], { cwd });

/** A port on this machine, `wanted` when it is free: the header of a picture shows it. */
const freePort = (wanted) => new Promise((done, failed) => {
  const server = createServer();
  server.once('error', (error) => {
    if (wanted === 0) failed(error);
    else freePort(0).then(done, failed);
  });
  server.listen(wanted, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => done(port));
  });
});

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** The demo folders: a small app with every kind of change, and a website. */
async function folders() {
  put(join(work, 'ideas.md'), 'Sort the notes by name.\nAdd a search box.\nKeep the list short.\n');
  put(join(app, 'README.md'), '# Notes app\n\nA small app that keeps notes.\n');
  put(join(app, 'src', 'app', 'main.ts'), "import { format } from './lib/format.js';\n\nexport const title = format('Notes');\n");
  put(join(app, 'src', 'app', 'lib', 'format.ts'), 'export const format = (text: string): string => text.trim();\n');
  put(join(app, 'src', 'app', 'lib', 'parse.ts'), 'export const parse = (text: string): string[] => text.split("\\n");\n');
  put(join(app, 'docs', 'guide', 'getting-started.md'), '# Getting started\n\nRun the app and write a note.\n');
  put(join(app, 'notes', 'old.md'), 'An old note.\n');
  put(join(app, 'src', 'app', 'ui', 'list', 'view.ts'), "export const view = (rows: string[]): string => rows.join('\\n');\n");
  put(join(app, 'package.json'), '{\n  "name": "notes-app",\n  "version": "0.1.0"\n}\n');
  await git(app, 'init', '-q', '-b', 'main');
  await git(app, 'add', '.');
  await git(app, 'commit', '-q', '-m', 'First version');
  // Edited, deleted, new, and one change staged.
  put(join(app, 'src', 'app', 'main.ts'), "import { format } from './lib/format.js';\nimport { parse } from './lib/parse.js';\n\nexport const title = format('Notes');\nexport const lines = parse('one\\ntwo');\n");
  rmSync(join(app, 'notes', 'old.md'));
  put(join(app, 'docs', 'guide', 'faq.md'), '# Questions\n\nWhere are the notes kept? In the notes folder.\n');
  put(join(app, 'README.md'), '# Notes app\n\nA small app that keeps notes, and finds them again.\n');
  put(join(app, 'src', 'app', 'ui', 'list', 'view.ts'), "export const view = (rows: string[]): string => rows.map((row) => `- ${row}`).join('\\n');\n");
  put(join(app, 'src', 'app', 'lib', 'search.ts'), 'export const search = (rows: string[], word: string): string[] => rows.filter((row) => row.includes(word));\n');
  put(join(app, 'notes', 'drafts', 'today.md'), 'Buy bread.\n');
  put(join(app, 'package.json'), '{\n  "name": "notes-app",\n  "version": "0.2.0"\n}\n');
  await git(app, 'add', 'README.md', 'package.json');

  put(join(site, 'index.html'), '<h1>Notes</h1>\n');
  put(join(site, 'style.css'), 'h1 { color: teal; }\n');
  await git(site, 'init', '-q', '-b', 'main');
  await git(site, 'add', '.');
  await git(site, 'commit', '-q', '-m', 'First page');
  put(join(site, 'style.css'), 'h1 { color: teal; font-weight: 600; }\n');
}

/** Start the demo host, and wait until it answers. */
async function host(port) {
  const child = spawn('pnpm', ['--dir', ahpd, 'demo', '--', '--port', String(port), '--path', work], {
    env, detached: true, stdio: ['ignore', 'ignore', 'pipe'],
  });
  started.push(child);
  let said = '';
  child.stderr.on('data', (chunk) => { said += String(chunk); });
  for (let i = 0; i < 60; i++) {
    try {
      await ahpc(port, 'agents');
      return;
    }
    catch {
      if (child.exitCode !== null) break;
      await sleep(500);
    }
  }
  throw new Error(`The demo host did not start.\n${said}`);
}

/** One ahpc command against the host, and what it printed. */
async function ahpc(port, ...args) {
  const { stdout } = await run(process.execPath, [main, '--host', `ws://127.0.0.1:${String(port)}`, ...args], { env, timeout: 30_000 });
  return stdout.trim();
}

/** One ahpc command left running, such as a turn that streams for a minute. */
function background(port, ...args) {
  const child = spawn(process.execPath, [main, '--host', `ws://127.0.0.1:${String(port)}`, ...args], {
    env, detached: true, stdio: 'ignore',
  });
  started.push(child);
}

/** A session in a folder, with the demo agent. */
const session = async (port, cwd) => (await ahpc(port, 'session', 'new', '--agent', 'demo', '--cwd', cwd)).split('\n').pop();

/** Wait until a session wants a person. */
const waiting = (port, uri) => ahpc(port, 'watch', uri, '--until', 'input', '--timeout', '20');

/** The rows a picture is drawn at first, and the fewest a fitted one keeps. */
const ROWS = 30;
const FEWEST = 12;

/**
 * How many rows a screen needs: drawn once as text at `ROWS`, less its longest
 * run of empty rows, which is the space a screen grows to fill. One empty row
 * of that run stays.
 */
async function fitted(port, flags) {
  const text = await ahpc(port, '--static', ...flags, '--height', String(ROWS));
  // eslint-disable-next-line no-control-regex
  const rows = text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').split('\n');
  const empty = (row) => row.replace(/[│║┃\s]/g, '') === '';
  while (rows.length > 0 && empty(rows[rows.length - 1])) rows.pop();
  let blank = 0;
  let run = 0;
  for (const row of rows) {
    run = empty(row) ? run + 1 : 0;
    blank = Math.max(blank, run);
  }
  return Math.max(FEWEST, ROWS - Math.max(0, blank - 1));
}

/**
 * One picture: a screen against the host, 100 columns wide.
 *
 * `height` fixes the rows, for the pictures `README.md` shows at one size.
 * Without it, the picture is fitted to what the screen holds. `command` runs
 * a command before the frame, such as `app.palette`.
 */
async function picture(port, name, screen, options = {}) {
  const { session: uri, command, height } = options;
  const flags = ['--screen', screen, ...(uri ? ['--session', uri] : []), ...(command ? ['--command', command] : []), '--width', '100'];
  const rows = height ?? await fitted(port, flags);
  await ahpc(port, '--static', '--svg', join(images, name), ...flags, '--height', String(rows));
  process.stdout.write(`${name} ${String(rows)} rows\n`);
}

try {
  await folders();
  const port = await freePort(9210);
  await host(port);

  // A finished turn with a tool call, and the picture of it.
  const read = await session(port, app);
  await ahpc(port, 'prompt', read, 'read ideas');

  // Waiting on a permission, waiting on a question, running, and in error.
  const writes = await session(port, app);
  background(port, 'prompt', writes, 'write todo buy bread and milk');
  await waiting(port, writes);
  const asks = await session(port, site);
  background(port, 'prompt', asks, 'read');
  await waiting(port, asks);
  const runs = await session(port, site);
  background(port, 'prompt', runs, 'slow');
  const fails = await session(port, app);
  await ahpc(port, 'prompt', fails, 'fail').catch(() => undefined);
  await sleep(2000);

  // The three `README.md` shows, at the sizes it shows them.
  await picture(port, 'sessions.svg', 'sessions', { height: 30 });
  await picture(port, 'transcript.svg', 'chat', { session: read, height: 30 });
  await picture(port, 'compose.svg', 'new', { height: 26 });
  // The palette and a picker open over their screen, which needs its rows.
  await picture(port, 'keys.svg', 'sessions', { command: 'app.palette', height: 30 });
  await picture(port, 'agents.svg', 'new', { command: 'model.choose', height: 26 });
  await picture(port, 'turns.svg', 'chat', { session: writes });
  await picture(port, 'changes.svg', 'changes', { session: read });
  await picture(port, 'resources.svg', 'files', { session: read });
  await picture(port, 'customizations.svg', 'skills', { session: read });

  // A second chat in the first session.
  await ahpc(port, 'chat', 'new', read, 'help');
  await sleep(1000);
  await picture(port, 'chats.svg', 'chat', { session: read });

  // A shell with some output.
  const shell = await ahpc(port, 'terminal', 'new', '--cwd', app, '--name', 'shell');
  const terminal = shell.split('\n').pop();
  await ahpc(port, 'terminal', 'send', terminal, 'git status --short');
  await sleep(500);
  await ahpc(port, 'terminal', 'send', terminal, 'ls src/app');
  await sleep(1500);
  await picture(port, 'terminals.svg', 'terminal');

  // Five automations: four schedules and an event. One is switched off, and one has a run.
  const automation = (title, prompt, ...trigger) => ahpc(port, 'automation', 'new', '--title', title,
    '--prompt', prompt, ...trigger, '--agent', 'demo', '--folder', app);
  const morning = await automation('Morning summary', 'Read the ideas and sum them up', '--schedule', '0 9 * * 1-5', '--time-zone', 'UTC');
  await automation('Nightly tidy', 'Sort the notes by name', '--schedule', '30 22 * * *', '--time-zone', 'UTC');
  await automation('Weekly report', 'Say what changed this week', '--schedule', '0 8 * * 1', '--time-zone', 'UTC');
  const hourly = await automation('Hourly check', 'Read the drafts', '--schedule', '0 * * * *', '--time-zone', 'UTC');
  await automation('When a turn fails', 'Say what went wrong', '--on', 'session:turnFailed');
  await ahpc(port, 'automation', 'disable', hourly);
  await ahpc(port, 'automation', 'run', morning);
  await sleep(2000);
  await picture(port, 'automations.svg', 'automations');
}
finally {
  finish();
}
