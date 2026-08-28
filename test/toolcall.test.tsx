import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { h } from '@textui/core';
import { ToolCallRow } from '../src/view/toolcall.js';
import type { ToolCall } from '../src/ahp/types.js';

/*
 * A tool call is something the agent did.
 *
 * It used to be drawn inside the speech gutter, one indent in, as though it
 * were a paragraph of the answer - and its input went straight onto the row,
 * newlines and all, so a three-line JSON object made the row three lines tall
 * with the tool's name floating beside the middle of it.
 */

const CALL: ToolCall = {
  id: 'c1',
  name: 'Run MCP tool advisor__case_show',
  toolName: 'advisor__case_show',
  status: 'completed',
  input: '{\n  "id": 1\n}',
  output: 'case 1: open\nreported by softov',
};

async function open(call: Partial<ToolCall> = {}, props: Record<string, unknown> = {}) {
  const t = await renderApp({
    width: 70,
    height: 12,
    root: h(ToolCallRow, { call: { ...CALL, ...call }, ...props }),
  });
  await t.settle();
  return t;
}

describe('a tool call row', () => {
  it('starts at the left edge, with its status glyph where a bullet goes', async () => {
    const t = await open();
    // Column zero is the status, not a gutter rule and not a space.
    expect(t.line(0).startsWith('✓ Run MCP tool')).toBe(true);
    await t.unmount();
  });

  it('puts the input on the row as one line, however many it has', async () => {
    const t = await open();
    expect(t.line(0)).toContain('{ "id": 1 }');
    // One row, not three: the line under it belongs to nothing yet.
    expect(t.line(1).trim()).toBe('');
    await t.unmount();
  });

  it('trails a chevron, and only when there is something under it', async () => {
    const t = await open();
    expect(t.line(0).trimEnd().endsWith('▸')).toBe(true);
    await t.unmount();

    const bare = await open({ input: undefined, output: undefined, intention: undefined });
    expect(bare.line(0).trimEnd().endsWith('▸')).toBe(false);
    await bare.unmount();
  });

  it('opens the input onto its own lines, whole', async () => {
    const t = await open({}, { expanded: true });
    const lines = t.lines().map((line) => line.trim());

    // The braces are where they were written, not squashed onto the row.
    expect(lines).toContain('{');
    expect(lines).toContain('"id": 1');
    expect(lines).toContain('}');
    await t.unmount();
  });

  it('opens when the row is clicked', async () => {
    let toggled = 0;
    const t = await open({}, { onToggle: () => { toggled += 1; } });

    t.click(4, 0);
    await t.settle();
    expect(toggled).toBe(1);
    await t.unmount();
  });

  it('does not offer a click when there is nothing to open', async () => {
    let toggled = 0;
    const t = await open(
      { input: undefined, output: undefined, intention: undefined },
      { onToggle: () => { toggled += 1; } },
    );

    t.click(4, 0);
    await t.settle();
    expect(toggled).toBe(0);
    await t.unmount();
  });

  it('lights up under the pointer', async () => {
    const t = await open();
    const bg = (): string => JSON.stringify(t.app.buffer().get(4, 0)?.bg ?? null);
    const resting = bg();

    t.moveMouse(4, 0);
    await t.settle();
    const hovered = bg();
    expect(hovered).not.toBe(resting);

    // And puts it back when the pointer leaves.
    t.moveMouse(4, 8);
    await t.settle();
    expect(bg()).toBe(resting);
    await t.unmount();
  });
});
