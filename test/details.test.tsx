import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { SessionDetails } from '../src/view/details.js';
import type { DetailField } from '../src/view/details.js';

/**
 * The detail pane, where the values are the answer.
 *
 * It exists so a session URI, a chat URI and a workspace path can be read in
 * full and pasted somewhere - which makes the two things worth testing here
 * the two things a narrow pane does to a long value: where it puts it, and
 * what it takes the room from.
 */

const FIELDS: DetailField[] = [
  { id: 'status', label: 'Status', value: 'idle' },
  { id: 'permissions', label: 'Permissions', value: 'Ask each time' },
  { id: 'workspace', label: 'Workspace', value: '/github/textui.worktrees/testing-nothing-branch' },
  { id: 'chat', label: 'Chat', value: 'ahp-chat://default/YWhwLXNlc3Npb246LzlkYmQ2Zjc0LTg0NDgtNDFkZC04Yw' },
];

const open = async (props: Record<string, unknown> = {}): Promise<Harness> => {
  const t = await renderApp({
    width: 52,
    height: 16,
    theme: 'workbench',
    root: h(SessionDetails, { fields: FIELDS, ...props }),
  });
  await t.settle();
  await t.settle();
  return t;
};

/** A row's own line, past the marker column. */
const rowFor = (t: Harness, label: string): string =>
  t.lines().find((l) => l.replace(/^\s*[\u25b8\u25be]?\s*/, '').startsWith(label)) ?? '';

/** Where a row's value starts. */
const valueAt = (t: Harness, label: string): number => {
  const line = rowFor(t, label);
  const after = line.indexOf(label) + label.length;
  return after + line.slice(after).search(/\S/);
};

describe('a detail row with a value too long for it', () => {
  /**
   * `width` is a starting size, not a floor - shrink is 1 unless it is said.
   * So a value with nowhere to break was squeezing the column beside it, and
   * `Chat` started its value four cells left of `Permissions`. A column that
   * moves per row is not a column.
   */
  it('keeps every label in one column', async () => {
    const t = await open();
    expect(valueAt(t, 'Permissions')).toBe(valueAt(t, 'Status'));
    expect(valueAt(t, 'Chat')).toBe(valueAt(t, 'Status'));
    expect(valueAt(t, 'Workspace')).toBe(valueAt(t, 'Status'));
    await t.unmount();
  });

  /**
   * A wrapped value makes the row two lines tall and the label is one.
   * Centred - which is what a row does unasked - the label drifted down to
   * sit beside the *second* line of a URI, with nothing beside the first.
   */
  it('starts the value on the label’s own line', async () => {
    const t = await open({ values: 'all' });
    const lines = t.lines();
    const y = lines.findIndex((l) => l.replace(/^\s*[\u25b8\u25be]?\s*/, '').startsWith('Chat'));
    expect(lines[y]).toContain('ahp-chat://');
    // ...and the rest of it is under that, not above it.
    expect(lines[y + 1]?.trim()).not.toBe('');
    expect(lines[y - 1] ?? '').not.toContain('ahp-chat://');
    await t.unmount();
  });

  it('shows one row whole by default, and all of them when asked', async () => {
    const quiet = await open();
    // Only the cursor's row wraps, so every other long value is cut.
    expect(quiet.hasText('…')).toBe(true);
    const short = quiet.lines().filter((l) => l.trim() !== '').length;
    await quiet.unmount();

    const loud = await open({ values: 'all' });
    // The values are the answer here: a pane that shows the first half of the
    // one you are looking for has made you walk to it to find out.
    expect(loud.hasText('…')).toBe(false);
    expect(loud.lines().filter((l) => l.trim() !== '').length).toBeGreaterThan(short);
    await loud.unmount();
  });
});
