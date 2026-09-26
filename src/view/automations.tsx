import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, EmptyState, List, Marquee, Row } from '@textui/widgets';
import type { DetailField } from '@textui/chat';
import type { Automation, AutomationRun } from '../ahp/types.js';

/**
 * What the host will do without being asked.
 *
 * The catalogue is sessions somebody started; this is the other half - the
 * ones that start themselves. Both halves are the host's, and a client that
 * drew only the first makes a session appearing at nine in the morning look
 * like something nobody can account for.
 *
 * Two facts per row and they are not the same fact. The **schedule** is what
 * was written down and is true whatever the host does with it; **next run** is
 * what the host will actually do. A host with no clock, an automation switched
 * off and an expression the host could not read all say the same thing here -
 * a schedule with nothing coming - and that is worth showing rather than
 * hiding behind the expression.
 */

/** "in 4h 12m". A next run is only ever ahead, so there is no past tense. */
export function until(iso: string, from: number = Date.now()): string {
  const ms = new Date(iso).getTime() - from;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'due';
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${rest}m`;
  return `in ${rest}m`;
}

/** "4h ago". The past half of `until`, for runs that have happened. */
export function since(iso: string, from: number = Date.now()): string {
  const ms = from - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * What fires it, as written: the schedule and the zone when it is not the
 * obvious one, then each event trigger by title. Neither is manual only.
 */
export function scheduleOf(automation: Automation): string {
  const parts: string[] = [];
  if (automation.schedule) {
    const { expression, timeZone } = automation.schedule;
    parts.push(timeZone && timeZone !== 'UTC' ? `${expression}  ${timeZone}` : expression);
  }
  parts.push(...automation.events.map((title) => `on ${title}`));
  return parts.length > 0 ? parts.join(', ') : 'manual only';
}

/** What happens next: a time, "paused" for one switched off, or nothing. */
export function nextOf(automation: Automation, from: number = Date.now()): string {
  if (automation.nextRunAt) return until(automation.nextRunAt, from);
  if (!automation.enabled && (automation.schedule || automation.events.length > 0)) return 'paused';
  return 'nothing scheduled';
}

/** One run in a line: its outcome, when, and why when it failed. */
export function runLine(run: AutomationRun, from: number = Date.now()): string {
  const at = run.completedAt ?? run.createdAt;
  const how = run.triggered ? (run.catchUp ? 'catch-up' : 'scheduled') : 'by hand';
  return [run.status, at ? since(at, from) : '', how, run.error ?? '']
    .filter((part) => part !== '')
    .join('  ');
}

/**
 * Every fact the host holds about one automation, for the detail pane.
 *
 * The definition first, because it is what somebody wrote and will want to
 * read back: what it says, where, on what. Then what the host did with it.
 */
export function automationFields(automation: Automation, from: number = Date.now()): DetailField[] {
  const last = automation.runs[0];
  const config = Object.entries(automation.config ?? {})
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('  ');
  return [
    { id: 'state', label: 'State', value: automation.enabled ? 'on' : 'off', tone: automation.enabled ? 'success' : 'muted' },
    { id: 'prompt', label: 'Prompt', value: automation.prompt ?? '', absent: 'none' },
    { id: 'runs', label: 'Runs', value: scheduleOf(automation) },
    ...(automation.schedule
      ? [{ id: 'misfire', label: 'Missed', value: automation.misfire === 'skip' ? 'skipped' : 'run once on return' }]
      : []),
    { id: 'next', label: 'Next', value: nextOf(automation, from), tone: automation.nextRunAt ? 'info' : 'muted' },
    {
      id: 'last',
      label: 'Last',
      value: last ? runLine(last, from) : '',
      absent: 'never run',
      ...(last ? { tone: RUN_TONE[last.status] ?? 'muted' } : {}),
    },
    {
      id: 'directory',
      label: 'In',
      value: automation.workingDirectories.map((one) => one.replace(/^file:\/\//, '')).join('  '),
      absent: 'no workspace',
    },
    { id: 'provider', label: 'Harness', value: automation.provider ?? '', absent: "the host's default" },
    { id: 'model', label: 'Model', value: automation.model ?? '', absent: "the harness's default" },
    ...(config ? [{ id: 'config', label: 'Settings', value: config }] : []),
    ...(automation.createdAt ? [{ id: 'created', label: 'Created', value: since(automation.createdAt, from) }] : []),
    ...(automation.modifiedAt && automation.modifiedAt !== automation.createdAt
      ? [{ id: 'modified', label: 'Changed', value: since(automation.modifiedAt, from) }]
      : []),
    { id: 'uri', label: 'URI', value: automation.resource },
  ];
}

const RUN_TONE: Record<string, SemanticVariant> = {
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
  running: 'accent',
  pending: 'muted',
};

export interface AutomationListProps extends BoxProps {
  automations: Automation[];
  /** The cursor moved. What a key acting on "this one" needs. */
  onSelect?(uri: string): void;
  /** Enter on a row: open its detail. */
  onOpen?(uri: string): void;
  /** The row the cursor starts on, so a list redrawn keeps its place. */
  selectedId?: string | null;
  focusId?: string;
  autoFocus?: boolean;
}

export const AutomationList: (props: AutomationListProps) => RenderOutput =
  defineComponent<AutomationListProps>('AutomationList', (props) => {
    const { automations, onSelect, onOpen, selectedId, focusId, autoFocus, ...rest } = props;
    const theme = useTheme();

    if (automations.length === 0) {
      return (
        <EmptyState
          title="No automations"
          message="This host holds none. One that fires on a schedule starts a session with nobody at the keyboard."
          {...rest}
        />
      );
    }

    const byUri = new Map(automations.map((one) => [one.resource, one]));

    const items: ListItem[] = automations.map((one) => ({
      id: one.resource,
      // Filled for one that will fire, hollow for one that will not. The
      // switch and the clock are different questions and this answers the
      // first; the meta answers the second.
      icon: one.enabled ? theme.glyphs.bulletFilled : theme.glyphs.bulletHollow,
      label: one.title,
      meta: scheduleOf(one),
      tone: (one.enabled ? 'default' : 'muted') as SemanticVariant,
    }));

    return (
      <List
        items={items}
        flex={1}
        {...(selectedId ? { selectedId } : {})}
        {...(focusId ? { focusId } : {})}
        {...(autoFocus ? { autoFocus } : {})}
        {...(onSelect ? { onSelect: (id: string) => onSelect(id) } : {})}
        {...(onOpen ? { onActivate: (id: string) => onOpen(id) } : {})}
        renderItem={(item: ListItem, state: ListItemState) => {
          const one = byUri.get(item.id);
          const runs = one?.runs.slice(0, 3) ?? [];
          return (
            <Column>
              <Row gap={1}>
                <text
                  content={item.icon ?? ''}
                  {...(state.selected ? {} : { fg: one?.enabled ? 'accent' as SemanticVariant : 'muted' as SemanticVariant })}
                  shrink={0}
                />
                <Marquee
                  content={item.label}
                  active={state.selected && state.focused}
                  flex={1}
                  {...(one?.enabled ? {} : { fg: 'muted' as SemanticVariant })}
                />
                {one?.enabled === false ? <text content="off" fg="muted" shrink={0} /> : null}
              </Row>
              <Row gap={1}>
                {/* Indented under the title, where the bullet was. */}
                <text content=" " shrink={0} />
                <text content={item.meta ?? ''} fg="subtle" shrink={0} />
                <text
                  content={`${theme.glyphs.separator} ${one ? nextOf(one) : ''}`}
                  {...(one?.nextRunAt ? { fg: 'info' as SemanticVariant } : { fg: 'subtle' as SemanticVariant })}
                  shrink={0}
                />
                {/* What it has done, newest first. A history of one failure
                    is the thing somebody opened this screen to find. */}
                {runs.map((run) => (
                  <text
                    key={run.resource}
                    content={run.status === 'completed'
                      ? theme.glyphs.check
                      : run.status === 'failed'
                        ? theme.glyphs.cross
                        : theme.glyphs.bulletFilled}
                    fg={RUN_TONE[run.status] ?? 'muted'}
                    shrink={0}
                  />
                ))}
              </Row>
            </Column>
          );
        }}
        {...rest}
      />
    );
  });

export interface AutomationRunsProps extends BoxProps {
  runs: AutomationRun[];
  /** More runs than these are held on the host. */
  more?: boolean;
  /** Enter on a run that has a session: open it. */
  onOpen?(session: string): void;
  focusId?: string;
}

/**
 * What one automation has done, newest first, one run a row.
 *
 * A run is worth opening for the session it started, so enter opens that; a
 * run with no session yet, or one that failed before it had one, is a row to
 * read and nothing more.
 */
export const AutomationRuns: (props: AutomationRunsProps) => RenderOutput =
  defineComponent<AutomationRunsProps>('AutomationRuns', (props) => {
    const { runs, more, onOpen, focusId, ...rest } = props;
    const theme = useTheme();
    const byUri = new Map(runs.map((run) => [run.resource, run]));
    const now = Date.now();

    if (runs.length === 0) return <text content="It has not run yet." fg="subtle" {...rest} />;

    const items: ListItem[] = runs.map((run) => ({
      id: run.resource,
      icon: run.status === 'completed'
        ? theme.glyphs.check
        : run.status === 'failed' ? theme.glyphs.cross : theme.glyphs.bulletFilled,
      label: runLine(run, now),
      tone: RUN_TONE[run.status] ?? 'muted',
    }));

    return (
      <Column {...rest}>
        <List
          items={items}
          flex={1}
          {...(focusId ? { focusId } : {})}
          onActivate={(id: string) => {
            const session = byUri.get(id)?.session;
            if (session) onOpen?.(session);
          }}
          renderItem={(item: ListItem, state: ListItemState) => (
            <Row gap={1}>
              <text content={item.icon ?? ''} {...(state.selected ? {} : { fg: item.tone })} shrink={0} />
              <Marquee content={item.label} active={state.selected && state.focused} flex={1} />
              {byUri.get(item.id)?.session ? <text content={theme.glyphs.chevronRight} fg="muted" shrink={0} /> : null}
            </Row>
          )}
        />
        {more ? <text content="Older runs are on the host." fg="subtle" /> : null}
      </Column>
    );
  });
