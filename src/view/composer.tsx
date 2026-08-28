import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useState, useTheme } from '@textui/core';
import type { ListItem } from '@textui/widgets';
import { Column, Divider, List, TextArea } from '@textui/widgets';
import type { SlashCommand } from '../ahp/types.js';
import { ComposerBar } from './controls.js';
import type { ComposerOption } from './controls.js';

/**
 * What you type, and one line saying what it will be sent as.
 *
 * The field itself is `TextArea` from the catalog - growing, scrolling and
 * giving back the keys it does not want is not a chat problem. What is here is
 * the rest of a composer: what enter means while a turn is running, the slash
 * menu over what has already been typed, and the control row.
 *
 * The row used to be four ghost buttons naming their own keys - `send enter`,
 * `newline alt+enter`, `stop ctrl+c`, `commands ctrl+p` - which spent the one
 * line under the field on a keyboard legend. The keys belong in the footer,
 * which already lists them and changes with where the focus is. The line under
 * the field is worth more as *what is about to happen*: which harness, which
 * model, what it may do without asking, where it runs.
 */

export interface ChatComposerProps extends BoxProps {
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  onCancel?(): void;
  onHistory?(direction: -1 | 1): void;
  /** Left off the front of the field: out of the composer entirely. */
  onLeave?(): void;
  /** A turn is running: enter queues rather than sends, and stop is offered. */
  running?: boolean;
  queued?: number;
  /** The control row. Each is a value, and each may open a picker. */
  options?: ComposerOption[];
  onOption?(option: ComposerOption, anchorId: string): void;
  placeholder?: string;
  /** Offered when the draft starts with a slash. */
  commands?: SlashCommand[];
  /**
   * One of `commands` was chosen from the slash menu.
   *
   * The whole command rather than its id, because the two kinds go different
   * places and only the command knows which it is. A `client` command is
   * *ours*: it opens a screen, changes a setting or picks a theme, and none of
   * that is a message - sending it down the session channel would put
   * "/theme" in the transcript and ask the agent to make sense of it. A
   * `session` command is a skill the host contributed, and the only way to
   * invoke one is to send its name as the message.
   *
   * A slash the menu does not match is left alone and sent, which is how a
   * command the host offers but did not list still reaches it.
   */
  onCommand?(command: SlashCommand): void;
  autoFocus?: boolean;
  focusId?: string;
}

export const ChatComposer: (props: ChatComposerProps) => RenderOutput =
  defineComponent<ChatComposerProps>('ChatComposer', (props) => {
    const {
      value, onChange, onSubmit, onCancel, onHistory, onLeave, running, queued = 0,
      options = [], onOption, placeholder, commands = [], onCommand, autoFocus,
      focusId = 'chat.composer', ...rest
    } = props;
    const theme = useTheme();

    // A slash menu is a completion over what is already typed, not a mode.
    const slash = value.startsWith('/') && !value.includes(' ') ? value.slice(1).toLowerCase() : null;
    const found = slash === null ? [] : commands
      .filter((command) => command.id.toLowerCase().includes(slash) || command.title.toLowerCase().includes(slash))
      // What the host contributed first. A person typing a slash into a chat
      // is usually reaching for a skill, and the client's own commands - which
      // are also in the palette, on their own key - would otherwise fill the
      // six rows there is room for.
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'session' ? -1 : 1))
      .slice(0, 6);
    const byId = new Map(found.map((command) => [command.id, command]));
    const matches: ListItem[] = found.map((command) => ({
      id: command.id,
      label: `/${command.id}`,
      ...(command.description ? { description: command.description } : {}),
      // Where it came from, when something did: two plugins can contribute a
      // `/review`, and the title alone does not say which this is.
      meta: command.from ?? command.title,
    }));

    // Which completion is under the cursor. Clamped rather than reset, so a
    // list that shrinks as more is typed keeps a valid row instead of
    // snapping back to the top on every keystroke.
    const [highlight, setHighlight] = useState(0);
    const index = Math.max(0, Math.min(highlight, matches.length - 1));
    const chosen = matches[index];

    /**
     * Up and down, while the menu is open.
     *
     * They arrive as `onOverflow` - the field reports the key rather than
     * handling it once there is no row above or below the caret, which for a
     * `/word` draft is immediately. The same pair walks the history when there
     * is no menu, and the menu is the nearer of the two things they could
     * mean.
     */
    const step = (direction: -1 | 1): void => {
      setHighlight((matches.length + index + direction) % matches.length);
    };

    return (
      <Column {...rest} gap={0}>
        {matches.length > 0 ? (
          // The theme's border, never a named one. A hardcoded `single` draws
          // a box-drawing frame inside an ascii one on a terminal that cannot
          // do either, and an airy theme gets a line it deliberately does not
          // draw anywhere else.
          <Column border={theme.border} padding={[0, 1]}>
            <List
              items={matches}
              focusable={false}
              selectedId={chosen?.id}
              marker
              // Not focusable, so this is the click: a completion clicked is a
              // completion chosen, and there is nowhere for a merely
              // highlighted row to lead.
              onSelect={(id: string) => {
                const command = byId.get(id);
                if (command) onCommand?.(command);
              }}
              emptyMessage="no command"
            />
          </Column>
        ) : null}

        <Column border={theme.border}>
          <Divider dim />
          <TextArea
            value={value}
            onChange={onChange}
            // A slash the menu matched runs here; anything else is a message,
            // which is what lets a command the agent offers through.
            onSubmit={(next: string) => {
              const command = chosen ? byId.get(chosen.id) : undefined;
              if (command && onCommand) { onCommand(command); return; }
              onSubmit(next);
            }}
            {...(onCancel ? { onCancel } : {})}
            onOverflow={(direction: -1 | 1) => {
              if (matches.length > 0) { step(direction); return; }
              onHistory?.(direction);
            }}
            {...(onLeave ? { onEdge: (edge: 'start' | 'end') => { if (edge === 'start') onLeave(); } } : {})}
            placeholder={placeholder
              ?? (running ? 'The agent is working. Type to queue a message.' : 'Ask the agent anything…')}
            focusId={focusId}
            // The caret is the one thing on this screen saying where typing
            // goes, and this field is the point of the screen.
            caretTone="accent"
            {...(autoFocus ? { autoFocus: true } : {})}
          />
          {/* Inside the same frame, so the field and what it will be sent as
              read as one control rather than two stacked boxes. */}
          <Divider dim />
          <ComposerBar
            options={options}
            onOpen={(option, anchorId) => onOption?.(option, anchorId)}
            onSend={() => onSubmit(value)}
            {...(running ? { running: true } : {})}
            queued={queued}
            sendDisabled={value.trim() === ''}
          />
        </Column>
      </Column>
    );
  });
