/*
 * The words the command line is made of, in one place.
 *
 * Three components need to know which flags take a value: the entry point,
 * which scans for a command word and must not read a flag's value as one; the
 * CLI, whose positionals are whatever is left after the flags; and the screen,
 * whose parser consumes the next word for some flags and not others. Held as
 * three tables it was three vocabularies - the entry point knew 18 flags, the
 * CLI knew 18, and only 10 were shared, so `ahpc --force resource write ...`
 * swallowed the command word and opened the screen, which then refused a flag
 * that was never meant for it. Seven flags behaved that way.
 *
 * This file imports nothing on purpose. The entry point decides which front
 * end to load and must not load either one to decide, which is why the tables
 * were copied there rather than imported in the first place; a leaf with no
 * dependencies costs it nothing.
 */

/**
 * The words that mean "no screen".
 *
 * A closed set rather than "anything that is not a flag": every other argument
 * shape has always started the screen, and a typo becoming a silent CLI run
 * would be a worse answer than a refusal.
 */
export const COMMANDS: ReadonlySet<string> = new Set([
  'help', 'status', 'config', 'session', 'chat', 'terminal', 'resource',
  'agents', 'models', 'commands', 'customizations', 'completions', 'changes', 'content',
  'prompt', 'exec', 'cancel', 'queue', 'unqueue',
  'watch', 'confirm', 'answer', 'dispatch',
  'mcp', 'serve',
]);

/**
 * Every flag that takes no value, in either front end.
 *
 * One set rather than one per component, because a flag takes a value or it
 * does not - that is a fact about the flag, not about who is reading it. What
 * each component does with the answer differs: the entry point stops itself
 * swallowing the next word, the CLI keeps a positional a positional, and the
 * screen matches its own arms.
 */
export const SWITCHES: ReadonlySet<string> = new Set([
  // The screen's own.
  '--static', '-s', '--settled', '--approve', '--answer', '--bood', '--help', '-h',
  // Shape and scope, on both sides.
  '--json', '--full', '--all', '--archived', '--unread', '--undo',
  '--off', '--deny', '--reject', '--claude', '--chat',
  // The write half's, which take no value: without them a positional after one
  // is read as that flag's argument and disappears.
  '--create-only', '--recursive', '--fail-if-exists', '--follow', '--force',
  // What this client serves back to the host.
  '--publish-writable',
  // Output shape, on the two commands that offer a second one.
  '--operations', '--markdown',
  // Asking rather than doing, and agreeing in advance.
  '--list', '--yes',
  // Which transport the tool server speaks. Neither takes a value, and the
  // ports it listens on are `--serve-host` and `--serve-port`, which do.
  '--stdio', '--http',
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
export const commandIn = (argv: string[]): string | undefined => {
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
