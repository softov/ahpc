import type { BindingPath, BoxProps, Disposable, RenderOutput, SemanticVariant, TextUIApp } from '@textui/core';
import { createBag, defineComponent, useApp, useEffect, useFocusScope, useSize, useStoreValue, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, KeyHints, List, Panel, Row, ScrollView, SearchBox, registerBuiltins } from '@textui/widgets';
import { follow, matches } from '../wire.js';
import type { WireRow } from '../wire.js';

/*
 * The wire, as a screen.
 *
 * One row per frame and nothing else on it: the time, which way it went, the
 * method or the action type, the channel. A row opens to the frame itself.
 * The file is read as it grows, so a capture `ahpd --wire` or this client is
 * still writing is watched live - which is the point: every question about
 * the wire had been answered by reading source, and this answers it by
 * looking.
 *
 * Its own screen rather than one of the conversation's, because it needs no
 * host. A capture is a file, and the file may be the other end's.
 */

export const WIRE_ROWS = '$/wire/rows' as BindingPath;
export const WIRE_FILTER = '$/wire/filter' as BindingPath;
export const WIRE_SELECTED = '$/wire/selected' as BindingPath;
export const WIRE_FOLLOW = '$/wire/follow' as BindingPath;
export const WIRE_FILE = '$/wire/file' as BindingPath;
export const WIRE_FRAME = '$/wire/frame' as BindingPath;
export const WIRE_SCOPE = 'wire.rows';

/** The most frames held. A capture of a long session is more than a screen can list, and the newest are what is being watched. */
const KEPT = 20_000;
/** Below this width the frame is a drawer over the list rather than a pane beside it. */
const SPLIT = 100;

const TONE: Record<WireRow['kind'], SemanticVariant> = {
  request: 'default',
  notification: 'default',
  response: 'muted',
  error: 'danger',
  text: 'warning',
};

/** The rows the filter keeps, from what the store holds. */
export const visibleRows = (rows: WireRow[], filter: string): WireRow[] => (filter.trim() === '' ? rows : rows.filter((row) => matches(row, filter)));

/** The frame, as lines. Capped: a snapshot can run to thousands, and the top of it is what says what it is. */
const linesOf = (frame: unknown): string[] => {
  const text = typeof frame === 'string' ? frame : JSON.stringify(frame, null, 2) ?? '';
  const lines = text.split('\n');
  return lines.length > 3000 ? [...lines.slice(0, 3000), `… ${lines.length - 3000} more lines`] : lines;
};

export interface WireListProps extends BoxProps {
  rows: WireRow[];
  selectedId?: string | null;
  onSelect?(id: string): void;
  onOpen?(id: string): void;
  emptyMessage?: string;
  focusId?: string;
  autoFocus?: boolean;
}

export const WireList: (props: WireListProps) => RenderOutput =
  defineComponent<WireListProps>('WireList', (props) => {
    const { rows, selectedId, onSelect, onOpen, emptyMessage, focusId, autoFocus, ...rest } = props;
    const theme = useTheme();
    const byId = new Map(rows.map((row) => [String(row.seq), row]));
    const items: ListItem[] = rows.map((row) => ({ id: String(row.seq), label: row.method || row.kind, tone: TONE[row.kind] }));
    return (
      <List
        items={items}
        {...(selectedId ? { selectedId } : {})}
        {...(focusId ? { focusId } : {})}
        {...(autoFocus ? { autoFocus } : {})}
        {...(onSelect ? { onSelect: (id: string) => onSelect(id) } : {})}
        {...(onOpen ? { onActivate: (id: string) => onOpen(id) } : {})}
        emptyMessage={emptyMessage ?? 'Nothing on the wire yet'}
        renderItem={(item: ListItem, state: ListItemState) => {
          const row = byId.get(item.id);
          if (row === undefined) return <text content={item.label} />;
          const time = row.at.length >= 23 ? row.at.slice(11, 23) : row.at;
          // Which way it went, drawn as an arrow between the two ends: the
          // client is on the left, the host on the right, on every row.
          const arrow = row.from === 'client' ? theme.glyphs.arrowRight : theme.glyphs.arrowLeft;
          const what = row.kind === 'response' ? `${row.method} ${theme.glyphs.check}` : row.kind === 'error' ? `${row.method} ${theme.glyphs.cross}` : row.method || row.kind;
          const dim = state.selected ? {} : { fg: 'subtle' as SemanticVariant };
          return (
            <Row gap={1}>
              <text content={time} shrink={0} {...dim} />
              <text content={arrow} shrink={0} {...(state.selected ? {} : { fg: (row.from === 'client' ? 'accent' : 'info') as SemanticVariant })} />
              <text content={what} shrink={0} bold={row.kind === 'request' || row.kind === 'notification'} {...(state.selected ? {} : { fg: TONE[row.kind] })} />
              {row.type ? <text content={row.type} shrink={0} {...(state.selected ? {} : { fg: 'accent' as SemanticVariant })} /> : null}
              {row.channel ? <text content={row.channel} shrink={2} truncate="start" {...dim} /> : null}
              <text content={row.detail} flex={1} truncate="end" {...dim} />
            </Row>
          );
        }}
        {...rest}
      />
    );
  });

export const WireScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('WireScreen', () => {
    const app = useApp();
    const theme = useTheme();
    useFocusScope({ id: WIRE_SCOPE });
    const rows = useStoreValue<WireRow[]>(WIRE_ROWS, []) ?? [];
    const filter = useStoreValue<string>(WIRE_FILTER, '') ?? '';
    const selected = useStoreValue<string | null>(WIRE_SELECTED, null) ?? null;
    const following = useStoreValue<boolean>(WIRE_FOLLOW, true) ?? true;
    const file = useStoreValue<string>(WIRE_FILE, '') ?? '';
    const drawer = useStoreValue<boolean>(WIRE_FRAME, false) ?? false;
    const shown = visibleRows(rows, filter);
    const width = useSize().width;
    const wide = width >= SPLIT;
    const open = wide || drawer;

    // Following: the highlight stays on the newest row the filter keeps, so
    // a live capture reads like a tail. Stopped by moving the highlight.
    const last = shown.at(-1);
    useEffect(() => {
      if (shown.length === 0) return;
      if (following) { app.store.set(WIRE_SELECTED, String(last?.seq ?? '')); return; }
      if (selected !== null && shown.some((row) => String(row.seq) === selected)) return;
      app.store.set(WIRE_SELECTED, String(last?.seq ?? ''));
    }, [last?.seq ?? 0, following, filter]);

    const current = shown.find((row) => String(row.seq) === selected) ?? null;
    const aside = Math.max(40, Math.min(80, Math.round(width * 0.45)));

    const list = (
      <Panel
        title="Wire"
        {...(open && wide ? { width: width - aside - 1 } : { flex: 1 })}
        meta={`${shown.length}${shown.length === rows.length ? '' : ` of ${rows.length}`} frames${following ? `  ${theme.glyphs.bulletFilled} following` : ''}`}
      >
        <SearchBox
          value={filter}
          placeholder="method, action type, channel, id"
          focusId="wire.filter"
          onChange={(value: string) => app.store.set(WIRE_FILTER, value)}
        />
        <WireList
          rows={shown}
          selectedId={selected}
          focusId="wire.list"
          autoFocus
          flex={1}
          onSelect={(id: string) => {
            if (id !== selected && id !== String(last?.seq ?? '')) app.store.set(WIRE_FOLLOW, false);
            app.store.set(WIRE_SELECTED, id);
          }}
          onOpen={() => { app.store.set(WIRE_FRAME, true); app.focus.focus('wire.frame'); }}
          emptyMessage={rows.length === 0 ? `Nothing in ${file || 'the capture'} yet` : 'Nothing matches'}
        />
        <text content={file} fg="subtle" truncate="start" />
      </Panel>
    );

    const frame = current ? (
      <Panel
        title={`${current.from === 'client' ? 'client' : 'host'} ${current.from === 'client' ? theme.glyphs.arrowRight : theme.glyphs.arrowLeft} ${current.method || current.kind}`}
        {...(wide ? { width: aside } : { flex: 1 })}
        meta={current.id !== undefined ? `id ${current.id}` : current.kind}
      >
        <Row gap={1}>
          <text content={current.at} fg="subtle" shrink={0} />
          {current.peer ? <text content={current.peer} fg="muted" flex={1} truncate="start" /> : null}
        </Row>
        <ScrollView flex={1} focusId="wire.frame">
          <Column>
            {linesOf(current.frame).map((line, index) => (
              <text key={index} content={line} wrap="none" truncate="end" {...(current.kind === 'error' && index === 0 ? { fg: 'danger' as SemanticVariant } : {})} />
            ))}
          </Column>
        </ScrollView>
      </Panel>
    ) : (
      <Panel title="Frame" {...(wide ? { width: aside } : { flex: 1 })}>
        <text content="No frame under the highlight." fg="subtle" />
      </Panel>
    );

    if (!wide) return open ? frame : list;
    return (
      <Row flex={1} gap={1}>
        {list}
        {open ? frame : null}
      </Row>
    );
  });

const WireHeader = defineComponent<Record<string, never>>('WireHeader', () => {
  const theme = useTheme();
  const file = useStoreValue<string>(WIRE_FILE, '') ?? '';
  return (
    <Row gap={1}>
      <text content="Wire" bold fg="accent" shrink={0} />
      <text content={theme.glyphs.separator} fg="subtle" shrink={0} />
      <text content={file} fg="muted" flex={1} truncate="start" />
    </Row>
  );
});

const WireHints = defineComponent<BoxProps>('WireHints', (props) => {
  const theme = useTheme();
  const following = useStoreValue<boolean>(WIRE_FOLLOW, true) ?? true;
  return (
    <KeyHints
      {...props}
      hints={[
        { keys: `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`, label: 'frame' },
        { keys: 'enter', label: 'open' },
        { keys: 'esc', label: 'back' },
        { keys: 'f', label: following ? 'stop following' : 'follow' },
        { keys: 'ctrl+f', label: 'filter' },
        { keys: 'ctrl+c', label: 'quit' },
      ]}
    />
  );
});

export interface WireOptions {
  /** The capture to read. */
  file: string;
  /** How often to look for more of it, in milliseconds. */
  interval?: number;
  builtins?: boolean;
}

/**
 * The wire screen on an application, reading one file.
 *
 * The same shape as `registerChat`, and nothing shared with it: no host, no
 * controller, no sessions. What comes back takes the reader down with it.
 */
export function registerWire(app: TextUIApp, options: WireOptions): Disposable {
  const bag = createBag();
  if (options.builtins !== false) bag.add(registerBuiltins(app));
  app.store.set(WIRE_FILE, options.file);
  app.store.set(WIRE_ROWS, []);
  app.store.set(WIRE_FOLLOW, true);
  app.store.set(WIRE_FRAME, false);

  for (const [component, render] of [
    ['WireList', WireList],
    ['WireScreen', WireScreen],
    ['WireHeader', WireHeader],
    ['WireHints', WireHints],
  ] as const) {
    bag.add(app.components.register({ component, category: 'template', renderer: { kind: 'function', render: render as never } }));
  }
  bag.add(app.surfaces.open({ surface: 'header', key: 'title', target: { component: 'WireHeader' } }));
  bag.add(app.surfaces.open({ surface: 'status', key: 'status', target: { component: 'WireHints' } }));
  bag.add(app.screens.register({ id: 'wire', component: 'WireScreen' }));

  bag.add(app.commands.register({
    id: 'wire.follow',
    title: 'Follow the wire',
    category: 'Wire',
    description: 'Keep the highlight on the newest frame',
    slots: ['palette'],
    keepOpen: true,
    checked: WIRE_FOLLOW,
    run: () => app.store.set(WIRE_FOLLOW, !(app.store.get<boolean>(WIRE_FOLLOW) ?? true)),
  }));
  bag.add(app.commands.register({
    id: 'wire.filter',
    title: 'Filter the wire',
    category: 'Wire',
    description: 'Keep the frames whose method, action type or channel match',
    slots: ['palette'],
    run: () => app.focus.focus('wire.filter'),
  }));
  bag.add(app.commands.register({
    id: 'wire.openFrame',
    title: 'Open the frame',
    category: 'Wire',
    description: 'Read the frame under the highlight',
    slots: ['palette'],
    run: () => { app.store.set(WIRE_FRAME, true); app.focus.focus('wire.frame'); },
  }));
  bag.add(app.commands.register({
    id: 'wire.closeFrame',
    title: 'Back to the list',
    category: 'Wire',
    description: 'Put the frame away',
    slots: ['palette'],
    run: () => { app.store.set(WIRE_FRAME, false); app.focus.focus('wire.list'); },
  }));
  for (const binding of [
    { keys: 'f', commandId: 'wire.follow', scopeId: WIRE_SCOPE },
    { keys: 'ctrl+f', commandId: 'wire.filter' },
    { keys: 'right', commandId: 'wire.openFrame', scopeId: WIRE_SCOPE },
    { keys: 'left', commandId: 'wire.closeFrame', scopeId: WIRE_SCOPE },
    { keys: 'escape', commandId: 'wire.closeFrame', scopeId: WIRE_SCOPE },
  ]) bag.add(app.keybindings.register(binding));

  // The file, folded in as it grows. Kept to the newest `KEPT`, and the
  // sequence numbers keep counting so a row's name never changes under it.
  const reader = follow(options.file, (rows) => {
    const held = app.store.get<WireRow[]>(WIRE_ROWS) ?? [];
    const next = [...held, ...rows];
    app.store.set(WIRE_ROWS, next.length > KEPT ? next.slice(next.length - KEPT) : next);
  }, options.interval === undefined ? {} : { interval: options.interval });
  bag.add({ dispose: () => reader.close() });

  app.screens.reset('wire');
  return bag;
}
