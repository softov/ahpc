import type { RenderOutput } from '@textui/core';
import { defineComponent, useFocus, useInput, useState, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, Divider, Feed, List, Row, TextArea } from '@textui/widgets';
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
  /** The list instead of a terminal: every one, one a row, enter opens it. */
  listing?: boolean;
  /** Enter on a row of the list. */
  onOpen?(uri: string): void;
}

/** What a terminal is called on a tab or a row, with how it ended when it has. */
function labelOf(row: TerminalRow, index: number): string {
  return `${String(index + 1)} ${row.title}${row.exitCode !== undefined ? ` (exit ${String(row.exitCode)})` : ''}`;
}

interface TerminalTabsProps {
  rows: TerminalRow[];
  open: string | null;
  onSelect(uri: string): void;
}

/**
 * The terminals as tabs, and a stop on the keyboard of their own.
 *
 * `terminal.tabs`, so tab can move between here and the command field, and
 * left and right walk the terminals while it has the keyboard.
 */
const TerminalTabs: (props: TerminalTabsProps) => RenderOutput =
  defineComponent<TerminalTabsProps>('TerminalTabs', ({ rows, open, onSelect }) => {
    const focus = useFocus({ id: 'terminal.tabs' });
    const at = Math.max(0, rows.findIndex((row) => row.resource === open));
    useInput((event) => {
      const step = event.name === 'right' ? 1 : event.name === 'left' ? -1 : 0;
      if (step === 0 || event.alt || event.ctrl) return false;
      const next = rows[(at + step + rows.length) % rows.length];
      if (next) onSelect(next.resource);
      return true;
    }, { focusId: focus.id });
    return (
      <Row id={focus.id} gap={2}>
        {rows.map((row, index) => {
          const here = row.resource === open;
          return (
            <text
              key={row.resource}
              content={labelOf(row, index)}
              fg={here ? (focus.focused ? 'accent' : 'text') : 'subtle'}
              bold={here}
              underline={here && focus.focused}
              onClick={() => { onSelect(row.resource); }}
            />
          );
        })}
      </Row>
    );
  });

export const TerminalView: (props: TerminalViewProps) => RenderOutput =
  defineComponent<TerminalViewProps>('TerminalView', ({ rows, open, state, draft, onDraft, onSend, onSelect, listing, onOpen }) => {
    const theme = useTheme();
    // The list's cursor, starting on the one being read. Held here because the
    // list's `selectedId` is the selection, not where it starts.
    const [cursor, setCursor] = useState<string | null>(null);
    const on = cursor !== null && rows.some((row) => row.resource === cursor) ? cursor : open;

    if (listing) {
      const byUri = new Map(rows.map((row) => [row.resource, row]));
      const items: ListItem[] = rows.map((row, index) => ({ id: row.resource, label: labelOf(row, index) }));
      return (
        <Column flex={1} gap={0}>
          <text content={`Terminals (${String(rows.length)})`} fg="muted" bold />
          <Divider dim />
          <List
            items={items}
            flex={1}
            focusId="terminal.list"
            autoFocus
            {...(on ? { selectedId: on } : {})}
            onSelect={(uri: string) => setCursor(uri)}
            onActivate={(uri: string) => { setCursor(null); onOpen?.(uri); }}
            emptyMessage="No terminals"
            renderItem={(item: ListItem, itemState: ListItemState) => {
              const row = byUri.get(item.id);
              return (
                <Row gap={1}>
                  <text content={item.id === open ? theme.glyphs.bulletFilled : ' '} fg="accent" shrink={0} />
                  <text content={item.label} flex={1} truncate="end" {...(itemState.selected ? {} : { fg: row?.exitCode !== undefined ? 'muted' : 'text' })} />
                  <text content={row?.exitCode !== undefined ? 'ended' : 'running'} fg={row?.exitCode !== undefined ? 'danger' : 'success'} shrink={0} />
                </Row>
              );
            }}
          />
        </Column>
      );
    }
    /** The output as lines. Empty when there is none, which is not one blank line. */
    const lines = state === null || state.output === ''
      ? []
      : state.output.replace(/\n$/, '').split('\n');

    return (
      /*
       * One column, with the terminals as a row of tabs above it.
       *
       * Not a sidebar: a `Row` holding a `Column` holding the `Feed` made the
       * feed alternate between drawing its entries and not, once per frame -
       * which on a running terminal is a visible flicker rather than a
       * theoretical one. Tabs are also what a terminal usually wears, so the
       * layout that does not flicker is the one that reads better.
       */
      <Column flex={1} gap={0}>
        {/* From one terminal up, so there is always a row to tab to and
            always a place that says how many there are. */}
        {rows.length > 0 ? <TerminalTabs rows={rows} open={open} onSelect={onSelect} /> : null}
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
          {/*
            * A feed of nothing is nothing, and a note about that is not a log
            * line - so the two are drawn separately.
            *
            * Not only tidiness: a `Feed` holding one short entry alternates
            * between drawing it and not, once per frame, which on a running
            * terminal is a visible flicker. Keeping the empty state out of it
            * means the feed is either empty or holds real output.
            */}
          {lines.length === 0
            ? (
              <Column flex={1}>
                <text
                  content={state === null ? 'Opening…' : 'Nothing said yet. Type a command below.'}
                  fg="subtle"
                />
              </Column>
            )
            : (
              // `Feed` owns the viewport and the tail it follows, as it does
              // for the transcript. `pageKeys` is `always` because the field
              // below has the keyboard and page-up here can mean nothing else.
              <Feed flex={1} pageKeys="always" focusId="terminal.output">
                {lines.map((line, index) => (
                  <text key={String(index)} content={line} />
                ))}
              </Feed>
            )}

          {state?.exitCode !== undefined
            ? <text content={`The shell exited (${String(state.exitCode)}).`} fg="danger" />
            : (
              <Column border={theme.border}>
                <TextArea
                  value={draft}
                  onChange={onDraft}
                  placeholder="A command, and enter"
                  focusId="terminal.input"
                  // The keyboard's place on this screen, including on the way
                  // back from the list, where the field is only mounting.
                  autoFocus
                  // The newline is what a shell reads a line by, so it is sent
                  // rather than left for whoever typed it to remember.
                  onSubmit={(line: string) => { onSend(`${line}\n`); }}
                />
              </Column>
            )}
      </Column>
    );
  });
