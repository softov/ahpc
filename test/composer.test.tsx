import { describe, expect, it } from 'vitest';
import { defineComponent, h, useState } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ChatComposer } from '../src/view/composer.js';
import type { Completion } from '../src/ahp/types.js';

/**
 * The completion menu above the composer, and how far down it goes.
 *
 * It showed the first six of whatever the host answered and cycled those six,
 * so a host offering thirty paths for `@src/` looked like it had six and there
 * was no key that reached the seventh. The cap is on the box and not on the
 * list, and it is eight only where eight fit: the menu sits above the field it
 * is completing and gives its rows back rather than pushing the field off.
 */

const paths = (count: number): Completion[] => Array.from({ length: count }, (_, i) => ({
  insertText: `@src/file${i}.ts`,
  label: `file${i}.ts`,
  rangeStart: 0,
  rangeEnd: 5,
}));

const open = async (width: number, height: number): Promise<Harness> => {
  const t = await renderApp({
    width,
    height,
    theme: 'workbench',
    root: h(ChatComposer, {
      value: '@src/',
      onChange: () => undefined,
      onSubmit: () => undefined,
      paths: paths(12),
      autoFocus: true,
      // The control row, so the bottom of the composer is a real row and a
      // short terminal can be asked whether it still drew it.
      options: [{ id: 'model', label: 'model', value: 'sonnet' }],
    }),
  });
  await t.settle();
  await t.settle();
  return t;
};

/** The rows the menu is currently showing. */
const shown = (t: Harness): string[] =>
  t.lines().flatMap((line) => {
    const found = /file(\d+)\.ts/.exec(line);
    return found ? [found[0] as string] : [];
  });

describe('the completion menu is a window over the whole answer', () => {
  it('scrolls to a row past the ones that fit', async () => {
    const t = await open(80, 24);
    // Eight at a time, which is the cap on the box.
    expect(shown(t)).toHaveLength(8);
    expect(shown(t)).toContain('file0.ts');
    expect(shown(t)).not.toContain('file11.ts');

    // Down past the sixth. Truncated, this cycled back to the first instead.
    for (let i = 0; i < 8; i += 1) await t.press('down');
    await t.settle();
    expect(shown(t)).toContain('file8.ts');
    expect(shown(t)).not.toContain('file0.ts');
  });

  it('reaches the last row, and wraps from there', async () => {
    const t = await open(80, 24);
    for (let i = 0; i < 11; i += 1) await t.press('down');
    await t.settle();
    expect(shown(t)).toContain('file11.ts');
    // One more is the first again: the menu wraps rather than stopping.
    await t.press('down');
    await t.settle();
    expect(shown(t)).toContain('file0.ts');
  });

  it('keeps the composer on screen on a short terminal', async () => {
    // The menu grows upward from the field, so the field is what it would
    // push off. What has to survive is the composer, not the menu: the rows
    // are worth having only while there is somewhere to type.
    const t = await open(60, 12);
    // Fewer than the eight a tall terminal gets, and still a menu.
    expect(shown(t).length).toBeGreaterThan(0);
    expect(shown(t).length).toBeLessThan(8);
    expect(shown(t)).toContain('file0.ts');

    // The field, and the bar under it - the composer's first row of content
    // and its last. Eight rows here drew the border with neither between them.
    const screen = t.lines();
    expect(screen.some((line) => line.includes('@src/ '))).toBe(true);
    expect(screen[screen.length - 2]).toContain('send');
  });
});

/*
 * Escape, and what it is closest to.
 *
 * Typing `/` opened the menu and escape left for the session list, because the
 * menu is derived from the draft and has no state to close - so the key passed
 * through it to the field and then to the screen. Escape means "the thing in
 * front of me", and the menu is in front.
 */
describe('escape closes the menu before it leaves anything', () => {
  const withMenu = async (value: string, onCancel: () => void): Promise<Harness> => {
    const t = await renderApp({
      width: 80,
      height: 24,
      theme: 'workbench',
      root: h(ChatComposer, {
        value,
        onChange: () => undefined,
        onSubmit: () => undefined,
        onCancel,
        paths: paths(12),
        autoFocus: true,
      }),
    });
    await t.settle();
    await t.settle();
    return t;
  };

  it('shuts the menu and stays where it is', async () => {
    let left = 0;
    const t = await withMenu('@src/', () => { left += 1; });
    expect(shown(t).length).toBeGreaterThan(0);

    await t.press('escape');
    await t.settle();
    expect(shown(t)).toEqual([]);
    // The screen is the *next* escape, not this one.
    expect(left).toBe(0);
  });

  it('leaves on the escape after that', async () => {
    let left = 0;
    const t = await withMenu('@src/', () => { left += 1; });
    await t.press('escape');
    await t.settle();
    await t.press('escape');
    await t.settle();
    expect(left).toBe(1);
  });

  it('brings the menu back after the draft that was dismissed is retyped', async () => {
    /*
     * Dismissing at `/`, deleting it and typing `/` again is the same text and
     * a different question. Remembering only the text kept the menu shut until
     * the screen was left and come back to, which is the shape of a bug people
     * work around rather than report.
     *
     * The slash menu rather than the path one, because that is where it was
     * found and because it is computed from the draft here - the host has no
     * say in whether it is showing.
     */
    const commands = [
      { id: 'compact', kind: 'session' as const, title: 'compact' },
      { id: 'review', kind: 'session' as const, title: 'review' },
    ];
    const Retyping = defineComponent<Record<string, never>>('Retype', () => {
      const [value, setValue] = useState('/');
      return h(ChatComposer, {
        value,
        onChange: setValue,
        onSubmit: () => undefined,
        commands,
        autoFocus: true,
      });
    });
    const t = await renderApp({ width: 80, height: 24, theme: 'workbench', root: h(Retyping, {}) });
    await t.settle();
    await t.settle();
    const menu = (): boolean => t.lines().some((line) => line.includes('/compact'));
    expect(menu()).toBe(true);

    await t.press('escape');
    await t.settle();
    expect(menu()).toBe(false);

    // The slash goes, and with it the menu that was dismissed.
    await t.press('backspace');
    await t.settle();
    expect(menu()).toBe(false);

    // Typed again, and it is a new question rather than the old one.
    await t.press('/');
    await t.settle();
    expect(menu()).toBe(true);
  });

  it('brings the menu back when the question changes', async () => {
    // Stateful, because the draft is the component's input: a fixed `value`
    // would mean typing changed nothing and the menu stayed shut for a
    // reason that is this test's rather than the code's.
    const Typing = defineComponent<Record<string, never>>('Typing', () => {
      const [value, setValue] = useState('@src/');
      return h(ChatComposer, {
        value,
        onChange: setValue,
        onSubmit: () => undefined,
        paths: paths(12),
        autoFocus: true,
      });
    });
    const t = await renderApp({ width: 80, height: 24, theme: 'workbench', root: h(Typing, {}) });
    await t.settle();
    await t.settle();
    expect(shown(t).length).toBeGreaterThan(0);

    await t.press('escape');
    await t.settle();
    expect(shown(t)).toEqual([]);

    // A dismissal is about the draft it was dismissed at, so another
    // character is another question and the menu answers it.
    await t.press('f');
    await t.settle();
    expect(shown(t).length).toBeGreaterThan(0);
  });
});

/*
 * What goes after the name.
 *
 * A menu row is the command's name, so a command that takes an argument has
 * nowhere in the list to say so and `/autocompact` reads as complete. It goes
 * on the rule under the list: one line for the whole menu, following the
 * highlight instead of being repeated down every row.
 */

const withHint = async (): Promise<Harness> => {
  const t = await renderApp({
    width: 80,
    height: 24,
    theme: 'workbench',
    root: h(ChatComposer, {
      value: '/auto',
      onChange: () => undefined,
      onSubmit: () => undefined,
      commands: [
        { id: 'autocompact', kind: 'client' as const, title: 'Autocompact', hint: '[tokens]' },
        { id: 'autorun', kind: 'client' as const, title: 'Autorun' },
      ],
      autoFocus: true,
    }),
  });
  await t.settle();
  await t.settle();
  return t;
};

describe('a command that takes an argument says so', () => {
  it('writes the mask into the rule under the list', async () => {
    const t = await withHint();
    expect(t.lines().join('\n')).toContain('/autocompact [tokens]');
  });

  it('drops it for a command that takes nothing', async () => {
    const t = await withHint();
    await t.press('down');
    await t.settle();
    const screen = t.lines().join('\n');
    expect(screen).toContain('/autorun');
    expect(screen).not.toContain('[tokens]');
  });
});
