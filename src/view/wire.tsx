import type { BindingPath, BoxProps, Disposable, I18n, RenderOutput, SemanticVariant, TextUIApp } from '@textui/core';
import { createBag, defineComponent, useApp, useEffect, useFocusScope, useI18n, useSize, useStoreValue, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, KeyHints, List, Panel, Row, ScrollView, SearchBox, registerBuiltins } from '@textui/widgets';
import { follow, matches } from '../wire.js';
import type { WireRow } from '../wire.js';
import { registerMessages } from '../i18n/index.js';

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
const linesOf = (frame: unknown, i18n: I18n): string[] => {
  const text = typeof frame === 'string' ? frame : JSON.stringify(frame, null, 2) ?? '';
  const lines = text.split('\n');
  return lines.length > 3000
    ? [...lines.slice(0, 3000), i18n.plural(lines.length - 3000, {
      one: i18n.t('views.wire.moreLines.one'),
      other: i18n.t('views.wire.moreLines.other'),
    })]
    : lines;
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
    const i18n = useI18n();
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
        emptyMessage={emptyMessage ?? i18n.t('views.wire.empty')}
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
    const i18n = useI18n();
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
        title={i18n.t('views.wire.title')}
        {...(open && wide ? { width: width - aside - 1 } : { flex: 1 })}
        meta={shown.length === rows.length
          ? following
            ? i18n.plural(shown.length, {
              one: i18n.t('views.wire.framesFollowing.one'),
              other: i18n.t('views.wire.framesFollowing.other'),
            }, { bullet: theme.glyphs.bulletFilled })
            : i18n.plural(shown.length, {
              one: i18n.t('views.wire.frames.one'),
              other: i18n.t('views.wire.frames.other'),
            })
          : following
            ? i18n.plural(rows.length, {
              one: i18n.t('views.wire.framesOfFollowing.one'),
              other: i18n.t('views.wire.framesOfFollowing.other'),
            }, { shown: shown.length, total: rows.length, bullet: theme.glyphs.bulletFilled })
            : i18n.plural(rows.length, {
              one: i18n.t('views.wire.framesOf.one'),
              other: i18n.t('views.wire.framesOf.other'),
            }, { shown: shown.length, total: rows.length })}
      >
        <SearchBox
          value={filter}
          placeholder={i18n.t('views.wire.filterPlaceholder')}
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
          emptyMessage={rows.length === 0
            ? file ? i18n.t('views.wire.nothingIn', { file }) : i18n.t('views.wire.nothingInCapture')
            : i18n.t('views.wire.noMatch')}
        />
        <text content={file} fg="subtle" truncate="start" />
      </Panel>
    );

    const frame = current ? (
      <Panel
        title={current.from === 'client'
          ? i18n.t('views.wire.fromClient', { arrow: theme.glyphs.arrowRight, method: current.method || current.kind })
          : i18n.t('views.wire.fromHost', { arrow: theme.glyphs.arrowLeft, method: current.method || current.kind })}
        {...(wide ? { width: aside } : { flex: 1 })}
        meta={current.id !== undefined ? i18n.t('views.wire.frameId', { id: current.id }) : current.kind}
      >
        <Row gap={1}>
          <text content={current.at} fg="subtle" shrink={0} />
          {current.peer ? <text content={current.peer} fg="muted" flex={1} truncate="start" /> : null}
        </Row>
        <ScrollView flex={1} focusId="wire.frame">
          <Column>
            {linesOf(current.frame, i18n).map((line, index) => (
              <text key={index} content={line} wrap="none" truncate="end" {...(current.kind === 'error' && index === 0 ? { fg: 'danger' as SemanticVariant } : {})} />
            ))}
          </Column>
        </ScrollView>
      </Panel>
    ) : (
      <Panel title={i18n.t('views.wire.frameTitle')} {...(wide ? { width: aside } : { flex: 1 })}>
        <text content={i18n.t('views.wire.noFrame')} fg="subtle" />
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
  const i18n = useI18n();
  const file = useStoreValue<string>(WIRE_FILE, '') ?? '';
  return (
    <Row gap={1}>
      <text content={i18n.t('views.wire.title')} bold fg="accent" shrink={0} />
      <text content={theme.glyphs.separator} fg="subtle" shrink={0} />
      <text content={file} fg="muted" flex={1} truncate="start" />
    </Row>
  );
});

const WireHints = defineComponent<BoxProps>('WireHints', (props) => {
  const theme = useTheme();
  const i18n = useI18n();
  const following = useStoreValue<boolean>(WIRE_FOLLOW, true) ?? true;
  return (
    <KeyHints
      {...props}
      hints={[
        { keys: `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`, label: i18n.t('views.wire.hintFrame') },
        { keys: 'enter', label: i18n.t('views.wire.hintOpen') },
        { keys: 'esc', label: i18n.t('views.wire.hintBack') },
        { keys: 'f', label: following ? i18n.t('views.wire.hintStopFollowing') : i18n.t('views.wire.hintFollow') },
        { keys: 'ctrl+f', label: i18n.t('views.wire.hintFilter') },
        { keys: 'ctrl+c', label: i18n.t('views.wire.hintQuit') },
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
  for (const bundle of registerMessages(app)) bag.add(bundle);
  if (options.builtins !== false) bag.add(registerBuiltins(app));
  const t = app.i18n.t.bind(app.i18n);
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
    title: t('views.wire.followTitle'),
    category: t('views.wire.category'),
    description: t('views.wire.followDescription'),
    slots: ['palette'],
    keepOpen: true,
    checked: WIRE_FOLLOW,
    run: () => app.store.set(WIRE_FOLLOW, !(app.store.get<boolean>(WIRE_FOLLOW) ?? true)),
  }));
  bag.add(app.commands.register({
    id: 'wire.filter',
    title: t('views.wire.filterTitle'),
    category: t('views.wire.category'),
    description: t('views.wire.filterDescription'),
    slots: ['palette'],
    run: () => app.focus.focus('wire.filter'),
  }));
  bag.add(app.commands.register({
    id: 'frame.open',
    title: t('views.wire.openTitle'),
    category: t('views.wire.category'),
    description: t('views.wire.openDescription'),
    slots: ['palette'],
    run: () => { app.store.set(WIRE_FRAME, true); app.focus.focus('wire.frame'); },
  }));
  bag.add(app.commands.register({
    id: 'frame.close',
    title: t('views.wire.closeTitle'),
    category: t('views.wire.category'),
    description: t('views.wire.closeDescription'),
    slots: ['palette'],
    run: () => { app.store.set(WIRE_FRAME, false); app.focus.focus('wire.list'); },
  }));
  for (const binding of [
    { keys: 'f', commandId: 'wire.follow', scopeId: WIRE_SCOPE },
    { keys: 'ctrl+f', commandId: 'wire.filter' },
    { keys: 'right', commandId: 'frame.open', scopeId: WIRE_SCOPE },
    { keys: 'left', commandId: 'frame.close', scopeId: WIRE_SCOPE },
    { keys: 'escape', commandId: 'frame.close', scopeId: WIRE_SCOPE },
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
