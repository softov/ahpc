import type { UnicodeLevel } from '@textui/core';

/**
 * A mark for a setting, and for the value it is set to.
 *
 * These are hints, not decisions, and the distinction is the whole design.
 * The settings a session has are the *host's* - their keys, their titles,
 * their values and the sentence under each one all arrive over the wire, and
 * a client that switched on them would be back to working against one host.
 * So nothing here is required to match: an unrecognised setting gets a
 * neutral mark and keeps every word the host gave it.
 *
 * What the mark buys is a row that survives being squeezed. The control row
 * truncates labels from the right as the terminal narrows, and a chip that is
 * only a label truncates to nothing legible; a chip that leads with a mark
 * still says which question it is at four cells wide.
 *
 * Matched on the key *and* on the label, because hosts disagree about both:
 * the same question is `permissionMode` on one and `autoApprove` on the next,
 * and is titled "Approvals" by one of them and "Agent Mode" by the other.
 */

interface Mark {
  full: string;
  ascii: string;
}

const pick = (mark: Mark, unicode: UnicodeLevel): string =>
  (unicode === 'ascii' ? mark.ascii : mark.full);

/** Which question. Ordered: the first that matches wins. */
const SETTINGS: { when: RegExp; mark: Mark }[] = [
  { when: /harness|provider|agent(?!\s*mode)/, mark: { full: '◆', ascii: '@' } },
  { when: /model/, mark: { full: '◇', ascii: '#' } },
  { when: /branch/, mark: { full: '⋔', ascii: 'Y' } },
  { when: /workspace|director|folder|cwd|path/, mark: { full: '⌂', ascii: '~' } },
  { when: /isolat|worktree|target/, mark: { full: '▣', ascii: '=' } },
  { when: /approv|permission|mode/, mark: { full: '◉', ascii: '%' } },
];

const OTHER_SETTING: Mark = { full: '▪', ascii: '-' };

/**
 * Which answer.
 *
 * The approval modes are the reason this exists: five of them, all named in
 * the same two words - "Auto Mode", "Plan Mode", "Ask Before Edits" - and a
 * list of five look-alike labels is a list you read twice. The marks put them
 * in an order you can see, from "asks about everything" to "asks about
 * nothing".
 *
 * Ordered, and the value is tested before the label: `bypassPermissions` and
 * `autoApprove` both contain "auto", and only one of them means "decide for
 * yourself".
 */
const VALUES: { when: RegExp; mark: Mark }[] = [
  { when: /bypass|approveall|autoapprove|allow all|yolo/, mark: { full: '⚠', ascii: '!' } },
  { when: /plan/, mark: { full: '≡', ascii: '=' } },
  { when: /auto|assist/, mark: { full: '⊙', ascii: 'o' } },
  { when: /accept|edit|write/, mark: { full: '✓', ascii: 'v' } },
  { when: /ask|default|manual|interactive|confirm/, mark: { full: '?', ascii: '?' } },
  { when: /worktree/, mark: { full: '⋔', ascii: 'Y' } },
  // Not the house, which is the *workspace* chip's mark. Working in place and
  // the directory being worked in are two chips side by side, and giving them
  // the same mark is the one thing a mark is supposed to prevent.
  { when: /folder|workspace|inplace|in place/, mark: { full: '▣', ascii: '=' } },
  { when: /observe|readonly|read only/, mark: { full: '◌', ascii: '.' } },
];

const OTHER_VALUE: Mark = { full: '·', ascii: '-' };

const normalise = (text: string): string => text.toLowerCase().replace(/[\s_-]+/g, '');

function match(table: { when: RegExp; mark: Mark }[], ...against: (string | undefined)[]): Mark | null {
  for (const text of against) {
    if (!text) continue;
    const flat = normalise(text);
    // Both spellings: `when` clauses like /allow all/ want the words apart and
    // /autoapprove/ wants them together, and which one a host used is not
    // something to have an opinion about.
    const spaced = text.toLowerCase();
    const found = table.find((entry) => entry.when.test(flat) || entry.when.test(spaced));
    if (found) return found.mark;
  }
  return null;
}

/** The mark for one of the host's questions. Never absent. */
export function settingIcon(unicode: UnicodeLevel, key: string, title?: string): string {
  return pick(match(SETTINGS, key, title) ?? OTHER_SETTING, unicode);
}

/**
 * The mark for one of its answers.
 *
 * Absent rather than neutral when nothing matches *and* the setting is not one
 * whose values are worth marking - a branch name is not a mode, and a column
 * of identical dots beside a list of branches is noise with a shape.
 */
export function valueIcon(
  unicode: UnicodeLevel,
  value: string,
  label?: string,
  options: { fallback?: boolean } = {},
): string | undefined {
  const found = match(VALUES, value, label);
  if (found) return pick(found, unicode);
  return options.fallback === true ? pick(OTHER_VALUE, unicode) : undefined;
}
