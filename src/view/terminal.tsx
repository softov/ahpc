import type { RenderOutput } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Column, Divider, Feed, List, Row, TextArea } from '@textui/widgets';
import type { ListItem } from '@textui/widgets';
import type { TerminalRow, TerminalState } from '../ahp/types.js';

/**
 * A terminal, drawn.
 *
 * Nothing here decides anything: which terminals exist, which is open and
 * what happens when a line is sent all live in `terminal.ts`, and this only
 * puts them on screen. That is the split doop uses, and it is why unmounting
 * this does not lose the shell.
 *
 * The output is plain text - the host says `isPty: false`, meaning it carries
 * no VT sequences - so it is drawn as lines rather than parsed. Anything that
 * moves a cursor will look wrong, which is the honest cost of pipes and is
 * said in the header rather than left to be discovered.
 */
export interface TerminalViewProps {
  /** Every terminal the host is running. */
  rows: TerminalRow[];
  /** Which is open, or nothing. */
  open: string | null;
  /** Its state. Null while nothing has been read yet. */
  state: TerminalState | null;
  /** What is being typed, before it is sent. */
  draft: string;
  onDraft(value: string): void;
  /** A line, complete with the newline a shell reads it by. */
  onSend(line: string): void;
  onSelect(uri: string): void;
}

export const TerminalView: (props: TerminalViewProps) => RenderOutput =
  defineComponent<TerminalViewProps>('TerminalView', ({ rows, open, state, draft, onDraft, onSend, onSelect }) => {
    const theme = useTheme();

    const items: ListItem[] = rows.map((row) => ({
      id: row.resource,
      label: row.title,
      // An exit code, once there is one: a dead terminal that looks alive is
      // one somebody types into for a while before noticing.
      ...(row.exitCode !== undefined ? { meta: `exit ${String(row.exitCode)}` } : {}),
    }));

    return (
      <Row flex={1} gap={1}>
        {rows.length > 1 ? (
          <Column width={24} border={theme.border} padding={[0, 1]}>
            <List items={items} selectedId={open ?? undefined} marker onSelect={onSelect} emptyMessage="none" />
          </Column>
        ) : null}

        <Column flex={1} gap={0}>
          {state ? (
            <Row justify="between">
              <text content={state.cwd ?? state.title} fg="muted" />
              {/* Said, not discovered. */}
              <text content={state.isPty ? '' : 'plain text'} fg="subtle" />
            </Row>
          ) : null}
          <Divider dim />

          {/* `Feed`, which is what the transcript uses: it owns the viewport
              and the tail it follows, and a terminal wants exactly that -
              stuck to the newest line until somebody scrolls up to read.
              `pageKeys: always` because the field below has the keyboard and
              page-up on this screen can mean nothing else. */}
          {/* `Feed`, which is what the transcript uses: it owns the viewport
              and the tail it follows, and a terminal wants exactly that -
              stuck to the newest line until somebody scrolls up. `pageKeys`
              is `always` because the field below has the keyboard and page-up
              on this screen can mean nothing else. */}
          <Feed flex={1} follow pageKeys="always" focusId="terminal.output">
            {state === null
              ? [<text key="wait" content="Opening…" fg="subtle" />]
              : state.output === ''
                ? [<text key="empty" content="Nothing said yet. Type a command below." fg="subtle" />]
                : state.output.replace(/\n$/, '').split('\n').map((line, index) => (
                  <text key={String(index)} content={line} />
                ))}
          </Feed>

          {state?.exitCode !== undefined
            ? <text content={`The shell exited (${String(state.exitCode)}).`} fg="danger" />
            : (
              <Column border={theme.border}>
                <TextArea
                  value={draft}
                  onChange={onDraft}
                  placeholder="A command, and enter"
                  focusId="terminal.input"
                  // The newline is what a shell reads a line by, so it is sent
                  // rather than left for whoever typed it to remember.
                  onSubmit={(line: string) => { onSend(`${line}\n`); }}
                />
              </Column>
            )}
        </Column>
      </Row>
    );
  });
