import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, stringWidth, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, List, Marquee, Row } from '@textui/widgets';
import type { Customization, McpState } from '../ahp/types.js';

/**
 * What the host handed this session, as a list.
 *
 * One component for both panels, because a skill and an MCP server differ in
 * what there is to say about them and not in how they are read: a name, where
 * it came from, whether it is on, and - when the host has something to say
 * about why it is not working - what it said. Two components would be the same
 * two-line row twice with a different word in the third column.
 *
 * The list is flat and the container is the `from` column rather than a parent
 * row, which is the arrangement the protocol's nesting does not survive
 * anyway: an MCP server can be contributed by a plugin *or* by the host
 * directly, and a tree would have to draw the second at a depth that means
 * nothing. Sorting is the caller's.
 */

export interface CustomizationListProps extends BoxProps {
  items: Customization[];
  /** Enter on a row. Absent leaves the list read-only. */
  onToggle?(item: Customization): void;
  onSelect?(id: string): void;
  selectedId?: string | null;
  emptyMessage?: string;
  focusId?: string;
  autoFocus?: boolean;
}

/** What an MCP server's state means, in a word and a colour. */
const MCP: Record<McpState, { label: string; tone: SemanticVariant }> = {
  starting: { label: 'starting', tone: 'warning' },
  ready: { label: 'ready', tone: 'success' },
  // Not an error: the server is reachable and nobody has signed in, which is
  // something a person can go and fix rather than something that broke.
  authRequired: { label: 'sign in', tone: 'warning' },
  error: { label: 'failed', tone: 'danger' },
  stopped: { label: 'stopped', tone: 'muted' },
};

export const CustomizationList: (props: CustomizationListProps) => RenderOutput =
  defineComponent<CustomizationListProps>('CustomizationList', (props) => {
    const {
      items, onToggle, onSelect, selectedId, emptyMessage, focusId, autoFocus, ...rest
    } = props;
    const theme = useTheme();

    const dot = `  ${theme.glyphs.separator}  `;
    const byId = new Map(items.map((item) => [item.id, item]));

    const rows: ListItem[] = items.map((item) => {
      const mcp = item.state ? MCP[item.state] : null;
      // The switch first, so the answer to "is this on" is in the same column
      // on every row and findable without reading any of them.
      const icon = item.enabled ? theme.glyphs.checkboxOn : theme.glyphs.checkboxOff;
      return {
        id: item.id,
        icon,
        label: item.name,
        description: [
          item.from ?? '',
          item.description ?? '',
          // Last, because it is the one that is usually not there and the one
          // worth reading when it is.
          item.problem ?? '',
        ].filter(Boolean).join(dot),
        meta: mcp?.label ?? (item.enabled ? '' : 'off'),
        tone: (item.problem && !mcp
          ? 'danger'
          : mcp?.tone ?? (item.enabled ? 'muted' : 'subtle')) as SemanticVariant,
      };
    });

    return (
      <List
        items={rows}
        itemHeight={2}
        renderItem={(row: ListItem, state: ListItemState) => {
          const item = byId.get(row.id);
          return (
            <Column>
              <Row gap={1}>
                <text
                  content={row.icon ?? ''}
                  {...(state.selected ? {} : { fg: item?.enabled ? 'success' : 'subtle' })}
                  shrink={0}
                />
                <Marquee content={row.label} active={state.selected && state.focused} flex={1} />
                <text
                  content={row.meta ?? ''}
                  {...(state.selected ? {} : { fg: row.tone })}
                  shrink={0}
                />
              </Row>
              <Row>
                {/* Under the name rather than under the switch: the second
                    line qualifies the thing the first one names. */}
                <text content={' '.repeat(stringWidth(row.icon ?? '') + 1)} shrink={0} />
                <Marquee
                  content={row.description ?? ''}
                  active={state.selected && state.focused}
                  {...(state.selected ? {} : { fg: 'muted' as const })}
                  flex={1}
                />
              </Row>
            </Column>
          );
        }}
        {...(selectedId ? { selectedId } : {})}
        emptyMessage={emptyMessage ?? 'The host contributed none'}
        {...(onSelect ? { onSelect } : {})}
        {...(onToggle
          ? {
            onActivate: (id: string) => {
              const item = byId.get(id);
              if (item) onToggle(item);
            },
          }
          : {})}
        {...(focusId ? { focusId } : {})}
        {...(autoFocus ? { autoFocus: true } : {})}
        {...rest}
      />
    );
  });
