#!/usr/bin/env node

/**
 * The entry point, and the one decision it makes.
 *
 * `ahpc` is two front ends over one client: a screen, and a shell. Which one
 * runs is decided by the first word of argv and nothing else - so this file
 * imports neither. Both are loaded on demand, because the screen pulls in a
 * whole renderer and `ahpc session list --json` should not pay for one.
 */

/**
 * The words that mean "no screen".
 *
 * A closed set rather than "anything that is not a flag": every other argument
 * shape has always started the screen, and a typo becoming a silent CLI run
 * would be a worse answer than a refusal.
 */
const COMMANDS = new Set([
  'help', 'status', 'session', 'chat', 'terminal', 'resource',
  'agents', 'models', 'commands', 'completions', 'changes', 'content',
  'prompt', 'exec', 'cancel', 'queue', 'unqueue',
  'watch', 'confirm', 'answer', 'dispatch',
]);

const argv = process.argv.slice(2);
const first = argv[0];

if (first !== undefined && COMMANDS.has(first)) {
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
    process.exitCode = await cli(argv);
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
