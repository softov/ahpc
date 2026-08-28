import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, stringWidth, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Badge, Column, List, Marquee, Row } from '@textui/widgets';
import type { SessionSummary } from '../ahp/types.js';
import { decodeStatus } from '../ahp/status.js';
import { workspaceName } from '../state.js';

/**
 * The catalogue.
 *
 * Still a `List` - the selection, the keys, the window and the highlight are
 * all the list's, and reimplementing them here is what the transcript already
 * proved is a mistake. What is ours is the row, because a session does not fit
 * the one-line shape a list gives you for free.
 *
 * It takes two lines, and the first one is why. A title, a harness, a
 * workspace and a status sharing a pane that is also sharing the terminal
 * with the detail panel leaves every one of them truncated:
 * `Draft replies for desk-produ…` beside `1b444e78-d050-4fb5-a5…` names
 * neither the conversation nor the directory it is in. So the title gets the
 * width, and everything that qualifies it goes underneath.
 */

export interface SessionListProps extends BoxProps {
  sessions: SessionSummary[];
  selectedId?: string | null;
  onSelect?(uri: string): void;
  onOpen?(uri: string): void;
  emptyMessage?: string;
  focusId?: string;
  autoFocus?: boolean;
}

export const SessionList: (props: SessionListProps) => RenderOutput =
  defineComponent<SessionListProps>('SessionList', (props) => {
    const { sessions, selectedId, onSelect, onOpen, emptyMessage, focusId, autoFocus, ...rest } = props;
    const theme = useTheme();

    const dot = `  ${theme.glyphs.separator}  `;

    const items: ListItem[] = sessions.map((session) => {
      const status = decodeStatus(session.status);
      const changes = session.changes;
      return {
        id: session.resource,
        // Glyph first, so the one that wants a person is findable in a piped
        // log, a 16-colour session and by a reader who cannot see the colour.
        icon: theme.glyphs[status.glyph],
        label: session.title,
        // The second line, in the order it gets read: which harness, then
        // where, then what it has to show for it.
        //
        // The harness stands where a model would. The catalogue does not carry
        // one: `listSessions` answers with a `SessionSummary`, and the model
        // AHP knows is the one on the *last message*, which lives on the
        // session channel. A model per row would be a subscription per row.
        description: [
          session.provider,
          workspaceName(session.workingDirectories[0]),
          changes?.files
            ? `${changes.files} files  +${changes.additions ?? 0} -${changes.deletions ?? 0}`
            : '',
          // What the host says it is doing, in its own words. Last, because it
          // is the one that is usually not there.
          session.activity ?? '',
          status.archived ? 'archived' : '',
        ].filter(Boolean).join(dot),
        meta: status.label,
        tone: status.tone as SemanticVariant,
      };
    });

    return (
      <List
        items={items}
        itemHeight={2}
        renderItem={(item: ListItem, state: ListItemState) => (
          <Column>
            <Row gap={1}>
              <text
                content={item.icon ?? ''}
                {...(state.selected ? {} : { fg: item.tone })}
                shrink={0}
              />
              {/* The row under the cursor reads itself out; the rest are
                  truncated and still. A title is the one thing on this screen
                  that is arbitrarily long and the one thing you are looking
                  for, so the row you have stopped on says all of it. */}
              <Marquee content={item.label} active={state.selected && state.focused} flex={1} />
              <text content={item.meta ?? ''} {...(state.selected ? {} : { fg: 'muted' })} shrink={0} />
            </Row>
            <Row>
              {/* Under the title, not under the glyph: the second line
                  qualifies the thing the first one names. */}
              <text content={' '.repeat(stringWidth(item.icon ?? '') + 1)} shrink={0} />
              <Marquee
                content={item.description ?? ''}
                active={state.selected && state.focused}
                {...(state.selected ? {} : { fg: 'muted' as const })}
                flex={1}
              />
            </Row>
          </Column>
        )}
        {...(selectedId ? { selectedId } : {})}
        emptyMessage={emptyMessage ?? 'No sessions on this host'}
        onSelect={(id: string) => onSelect?.(id)}
        onActivate={(id: string) => onOpen?.(id)}
        {...(focusId ? { focusId } : {})}
        {...(autoFocus ? { autoFocus: true } : {})}
        {...rest}
      />
    );
  });

export interface ConnectionBadgeProps extends BoxProps {
  url: string;
  state: 'connecting' | 'connected' | 'offline';
  sessions?: number;
}

/** Which host, and whether it is answering. */
export const ConnectionBadge: (props: ConnectionBadgeProps) => RenderOutput =
  defineComponent<ConnectionBadgeProps>('ConnectionBadge', (props) => {
    const { url, state, sessions, ...rest } = props;
    const theme = useTheme();
    const look = {
      connected: { tone: 'success' as SemanticVariant, glyph: theme.glyphs.bulletFilled },
      connecting: { tone: 'warning' as SemanticVariant, glyph: theme.glyphs.bulletHalf },
      offline: { tone: 'danger' as SemanticVariant, glyph: theme.glyphs.cross },
    }[state];

    return (
      <Row gap={1} {...rest}>
        <text content={look.glyph} fg={look.tone} />
        <text content={url} fg="muted" truncate="start" />
        {sessions !== undefined ? <Badge label={`${sessions} sessions`} tone="muted" /> : null}
      </Row>
    );
  });
