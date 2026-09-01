import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, EmptyState, List, Marquee, Row } from '@textui/widgets';
import type { Automation } from '../ahp/types.js';

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

/** The schedule as written, with the zone only when it is not the obvious one. */
export function scheduleOf(automation: Automation): string {
  if (!automation.schedule) return 'manual only';
  const { expression, timeZone } = automation.schedule;
  return timeZone && timeZone !== 'UTC' ? `${expression}  ${timeZone}` : expression;
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
  /** Enter on a row. */
  onOpen?(uri: string): void;
  focusId?: string;
  autoFocus?: boolean;
}

export const AutomationList: (props: AutomationListProps) => RenderOutput =
  defineComponent<AutomationListProps>('AutomationList', (props) => {
    const { automations, onSelect, onOpen, focusId, autoFocus, ...rest } = props;
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
                  content={one?.nextRunAt ? `${theme.glyphs.separator} ${until(one.nextRunAt)}` : `${theme.glyphs.separator} nothing scheduled`}
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
