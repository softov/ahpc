import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, EmptyState, List, Marquee, Row } from '@textui/widgets';
import type { Changeset } from '../ahp/types.js';

/**
 * What the session changed on disk.
 *
 * Not read off the tool calls: a provider decides whether to send `fileEdit`
 * blocks and this one sends none, so a client that reads them reports that a
 * turn which created one file and rewrote another touched nothing. The account
 * is the changeset channel, and `computing` is worth showing rather than
 * swallowing - a partial answer read as a complete one is the wrong kind of
 * wrong.
 *
 * A `List` rather than a column of rows, because the rows became openable: the
 * selection, the keys, the window and the highlight are the list's, and a
 * hand-rolled cursor over a changeset of two hundred files is the mistake the
 * catalogue already made once.
 */

export interface ChangesListProps extends BoxProps {
  changes: Changeset;
  /** Enter on a row. Absent leaves the list a read-only account. */
  onOpen?(uri: string): void;
  focusId?: string;
  autoFocus?: boolean;
}

export const ChangesList: (props: ChangesListProps) => RenderOutput =
  defineComponent<ChangesListProps>('ChangesList', (props) => {
    const { changes, onOpen, focusId, autoFocus, ...rest } = props;
    const theme = useTheme();

    if (changes.files.length === 0) {
      return (
        <EmptyState
          title={changes.status === 'computing' ? 'Working out what changed' : 'Nothing changed'}
          message={changes.status === 'computing' ? 'The host is still computing the changeset.' : 'No file was created, edited or deleted.'}
          {...rest}
        />
      );
    }

    const byUri = new Map(changes.files.map((file) => [file.uri, file]));

    const items: ListItem[] = changes.files.map((file) => {
      const kind = !file.before ? 'new' : !file.after ? 'deleted' : 'edited';
      return {
        id: file.uri,
        icon: kind === 'new' ? '+' : kind === 'deleted' ? '-' : theme.glyphs.chevronRight,
        label: file.uri.replace(/^file:\/\//, ''),
        meta: `+${file.diff.added} -${file.diff.removed}`,
        tone: (kind === 'new' ? 'success' : kind === 'deleted' ? 'danger' : 'muted') as SemanticVariant,
      };
    });

    return (
      <Column {...rest}>
        {changes.status === 'computing' ? (
          <text content={`${theme.glyphs.ellipsis} still computing - this is not the whole list`} fg="warning" />
        ) : null}
        <List
          items={items}
          flex={1}
          renderItem={(item: ListItem, state: ListItemState) => (
            <Row gap={1}>
              <text
                content={item.icon ?? ''}
                {...(state.selected ? {} : { fg: item.tone })}
                shrink={0}
              />
              {/* The path truncates at the *front*, so what survives is the
                  filename rather than the six directories every row shares. */}
              <Marquee
                content={item.label}
                active={state.selected && state.focused}
                truncate="start"
                flex={1}
              />
              <text content={`+${byUri.get(item.id)?.diff.added ?? 0}`} fg="success" shrink={0} />
              <text content={`-${byUri.get(item.id)?.diff.removed ?? 0}`} fg="danger" shrink={0} />
            </Row>
          )}
          {...(onOpen ? { onActivate: (uri: string) => onOpen(uri) } : {})}
          {...(focusId ? { focusId } : {})}
          {...(autoFocus ? { autoFocus: true } : {})}
          emptyMessage="Nothing changed"
        />
      </Column>
    );
  });
