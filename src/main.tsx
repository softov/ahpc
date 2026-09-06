#!/usr/bin/env node

/**
 * The entry point, and the one decision it makes.
 *
 * `ahpc` is two front ends over one client: a screen, and a shell. Which one
 * runs is decided by the first word of argv and nothing else - so this file
 * imports neither. Both are loaded on demand, because the screen pulls in a
 * whole renderer and `ahpc session list --json` should not pay for one.
 */

// Both tables live in a leaf of their own: three components read this
// vocabulary and holding a copy each is what let them disagree. Importing it
// does not load a front end, which is the reason they were copied here.
import { commandIn } from './flags.js';

const argv = process.argv.slice(2);

/*
 * Answered before anything is loaded.
 *
 * `--version` with no command would otherwise open the screen, which is a
 * question answered by a whole renderer starting up and then being read off a
 * status bar. Neither front end is imported to answer it.
 */
const asked = argv.includes('--version') || argv.includes('-v');
const first = asked ? undefined : commandIn(argv);

if (asked) {
  const { version } = await import('./version.js');
  process.stdout.write(`${version()}\n`);
}
else if (first !== undefined) {
  /*
   * A closed pipe is not an error.
   *
   * `ahpc session list | head` closes stdout part-way through the writing,
   * and Node turns that into an unhandled EPIPE that prints a stack trace
   * over the output the reader actually wanted. Every command here is a
   * writer, so every one of them can be cut short this way.
   */
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
  const { cli, Fault } = await import('./cli/main.js');
  try {
    // The command word taken out, so what is left is only flags and the
    // command's own arguments - wherever in the line it happened to sit.
    const at = argv.indexOf(first);
    process.exitCode = await cli(first, [...argv.slice(0, at), ...argv.slice(at + 1)]);
  }
  catch (error) {
    // A `Fault` is a sentence written for the person who typed the command;
    // anything else is this client going wrong, and hiding its stack would
    // make that indistinguishable from the first kind.
    if (error instanceof Fault) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
    else {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
else {
  const { tui } = await import('./tui.js');
  await tui(argv);
}
