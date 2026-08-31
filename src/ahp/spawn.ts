/** Claude Code, through a host of its own rather than through this process. */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { liveHost } from './live.js';
import type { HostConnection } from './connection.js';

/** Said when there is no `ahpd` to run, which is a thing to install rather than a bug. */
export class MissingHost extends Error {}

export interface SpawnOptions {
  /** Where the agent works. This machine, because the host is this machine. */
  path: string;
  /** The command to run. `ahpd` unless something says otherwise. */
  command?: string;
  onRefusal?(uri: string, message: string): void;
  onState?(state: 'connecting' | 'connected' | 'offline'): void;
}

/**
 * Start an `ahpd` and talk to it, instead of talking to the SDK here.
 *
 * This client used to hold its own translation from the Claude Agent SDK to
 * the protocol - about eleven hundred lines of it - beside a daemon that does
 * the same job. Two implementations of one translation is two answers to every
 * question, and the one nobody is looking at is the one that drifts: a bug
 * found here in `chat/reasoning` had gone unnoticed precisely because this
 * client's own reducer was lenient about it and no conformant client had ever
 * rendered the same screen.
 *
 * So `--claude` spawns one of these now. The seam is unchanged - everything
 * above `HostConnection` cannot tell a spawned host from one somebody else is
 * running - which is the whole reason the seam was worth having.
 *
 * The daemon is private to this process: a port the operating system picks, a
 * token nobody else is told, and killed when this client goes.
 */
export async function spawnedHost(options: SpawnOptions): Promise<HostConnection> {
  const command = options.command ?? process.env.AHPD ?? 'ahpd';
  const token = randomUUID();

  const child = spawn(
    command,
    // Port zero because two clients on one machine must not fight over one,
    // and a token because a daemon nobody else asked for should not answer
    // anybody else - loopback is not by itself an audience of one.
    ['--port', '0', '--path', options.path, '--connection-token', token],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  /** Whatever it said before it was ready, so a failure can say why. */
  let complaint = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { complaint += chunk; });

  const url = await new Promise<string>((answer, fail) => {
    let said = '';
    const enough = setTimeout(() => fail(new Error('it started but never said where it was listening')), 20_000);
    const done = (run: () => void): void => { clearTimeout(enough); run(); };

    child.once('error', (error: NodeJS.ErrnoException) => done(() => {
      if (error.code === 'ENOENT') {
        fail(new MissingHost(
          `\`${command}\` is not installed, and --claude runs one.\n`
          + 'Install it with `npm i -g ahpd`, or say where it is with AHPD=/path/to/ahpd.\n'
          + 'Or point this client at a host somebody else is running: --host ws://…',
        ));
        return;
      }
      fail(error);
    }));
    child.once('exit', (code) => done(() => {
      fail(new Error(`it exited with ${String(code)} before it was ready${complaint ? `:\n${complaint.trim()}` : ''}`));
    }));

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      said += chunk;
      // Its first line names the address it actually bound, which is the only
      // way to know: the port was chosen by the operating system, not here.
      const found = /ws:\/\/[^\s,]+/.exec(said);
      if (found) done(() => answer(found[0]));
    });
  }).catch((error: unknown) => {
    child.kill('SIGKILL');
    throw error;
  });

  const host = await liveHost({
    url,
    token,
    ...(options.onRefusal ? { onRefusal: options.onRefusal } : {}),
    ...(options.onState ? { onState: options.onState } : {}),
  });

  return {
    ...host,
    /*
     * The daemon goes when this client does.
     *
     * It was started for this process and nothing else knows it is there, so
     * leaving it running leaves an agent host on a port nobody can find and a
     * CLI subprocess under it.
     */
    close: async () => {
      await host.close?.();
      child.kill();
    },
  };
}
