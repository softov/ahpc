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
  'help', 'status', 'config', 'session', 'chat', 'terminal', 'resource',
  'agents', 'models', 'commands', 'customizations', 'completions', 'changes', 'content',
  'prompt', 'exec', 'cancel', 'queue', 'unqueue',
  'watch', 'confirm', 'answer', 'dispatch',
]);

/**
 * Flags that take no value, so what follows one is not its value.
 *
 * Kept here rather than imported, because importing it would load the CLI to
 * decide whether to load the CLI.
 */
const SWITCHES = new Set([
  '--static', '-s', '--settled', '--approve', '--answer', '--bood',
  '--help', '-h', '--json', '--full', '--archived', '--unread', '--undo',
  '--off', '--deny', '--reject', '--chat',
]);

/**
 * The command, wherever it is.
 *
 * `ahpc --claude status` and `ahpc status --claude` mean the same thing, so
 * this is a scan rather than a look at the first word - reading only the first
 * one made every flag before a command silently open the screen instead.
 * A flag that takes a value swallows the next word, or `--path status` would
 * be a command.
 */
const commandIn = (argv: string[]): string | undefined => {
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i] as string;
    if (word.startsWith('-')) {
      if (!SWITCHES.has(word)) i++;
      continue;
    }
    return COMMANDS.has(word) ? word : undefined;
  }
  return undefined;
};

const argv = process.argv.slice(2);
const first = commandIn(argv);

if (first !== undefined) {
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
