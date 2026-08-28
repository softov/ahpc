import type { TextUIApp } from '@textui/core';

/**
 * The palette, moved.
 *
 * A chip on the composer's control row asks one question - which harness,
 * which model, how much it may do without asking, which workspace - and every
 * one of those is a command with an argument. The command palette already
 * knows how to ask about exactly that: `openAt` drills straight into an
 * argument, `choices` may be a list, a function or a promise, an argument
 * *without* choices is answered by typing, and `preview` shows what a
 * highlighted value would do.
 *
 * So this is not a second overlay. It is the same one, anchored above the
 * control that asked, and shown one command's question rather than the whole
 * registry. Anything registered later - a workspace list, a thinking level, a
 * subagent - is a command with an argument and needs nothing here.
 */

export const PICKER = 'chat.picker';

export interface PickerOptions {
  /** The command whose argument is being asked about. */
  commandId: string;
  /** The node the panel sits above: the chip's own focus id. */
  anchorId: string;
  /**
   * A fixed width. Left off, the panel is as wide as its widest answer, up to
   * `maxWidth` - which is what a chip wants: "Worktree" and "Step-by-step
   * collaboration" are the same question asked at two very different widths.
   */
  width?: number;
  maxWidth?: number;
  visibleRows?: number;
  /**
   * Put each value's sentence on its own line.
   *
   * For the questions whose answers are two words apart - "Accept edits" and
   * "Plan only" - and told apart entirely by the line under them. Inline,
   * that line shares the width with the label and shows the same truncated
   * half of every answer.
   */
  descriptions?: 'inline' | 'below';
}

export function openPicker(app: TextUIApp, options: PickerOptions): void {
  const command = app.commands.get(options.commandId);
  if (!command) return;

  // The chip that opened this one closes it. A control whose panel is already
  // showing is a toggle - clicking it again to make it go away is the first
  // thing anybody tries, and reopening it looks like the click did nothing.
  const showing = app.layers.entries().find((entry) => entry.id === PICKER);
  const already = showing?.node as { openAt?: string } | undefined;
  if (already?.openAt === options.commandId) {
    app.layers.close(PICKER);
    return;
  }

  // Closed first, so opening a second chip's panel replaces the first rather
  // than stacking two of them with the same id.
  app.layers.close(PICKER);
  app.layers.open({
    id: PICKER,
    // Floating, not modal: there is no scrim, because the row it is asking
    // about has to stay readable underneath it. Which value is in force is
    // half of what makes the question answerable.
    layer: 'floating',
    trapFocus: true,
    dismissOnEscape: true,
    dismissOnOutsideClick: true,
    // Above the chip, aligned to its left edge - so it rises out of the
    // control rather than appearing somewhere else on the screen. A composer
    // sits at the bottom, so `top` is the side with room.
    position: { kind: 'anchor', targetId: options.anchorId, side: 'top', align: 'start' },
    node: {
      component: 'CommandPalette',
      ...(options.width !== undefined ? { width: options.width } : {}),
      maxWidth: options.maxWidth ?? 52,
      visibleRows: options.visibleRows ?? 6,
      // One command, so the panel opens on its values instead of on a search
      // box with everything in it.
      commands: [command],
      openAt: options.commandId,
      ...(options.descriptions ? { descriptions: options.descriptions } : {}),
      onClose: { handler: () => app.layers.close(PICKER) },
    },
    // Back to the chip that asked, however it was closed.
    //
    // The layer's own scope restores focus when a choice is made, and does not
    // when the panel is dismissed with escape - which strands the keyboard on
    // a node inside a layer that is no longer there, and the next tab starts
    // from nowhere. Saying where focus goes is cheaper than depending on which
    // of the two paths ran.
    // Back to the chip that asked, whichever way it was closed. The layer's
    // own scope restores focus after a choice; a dismissal would otherwise
    // leave the keyboard on a node that is no longer mounted.
    onClose: () => app.focus.focus(options.anchorId),
  });
}
