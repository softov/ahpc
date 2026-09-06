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
 * was no key that reached the seventh. The menu is six rows tall because it
 * sits above the field it is completing and must not push it off a short
 * terminal - which is a cap on the box, not on the list.
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
    // Six at a time, which is the cap on the box.
    expect(shown(t)).toHaveLength(6);
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
    // push off. Six rows plus the composer is what has to fit in twelve.
    const t = await open(60, 12);
    expect(shown(t).length).toBeLessThanOrEqual(6);
    expect(t.lines().join('\n')).toContain('file0.ts');
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
