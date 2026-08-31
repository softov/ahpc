import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { Column, EmptyState, List, Marquee, Row } from '@textui/widgets';
import type { ResourceEntry } from '../ahp/types.js';

/**
 * One directory of the host's filesystem.
 *
 * The *host's*, which is the only thing about this screen worth stating twice:
 * the daemon may be on another machine, and the tree being walked is the one
 * the agent is working in rather than the one this terminal is sitting on. A
 * client that listed its own directory would be showing the right shape and
 * the wrong files.
 *
 * A `List` for the same reason the changeset is one - the selection, the keys,
 * the window and the highlight are the list's - and one directory at a time
 * rather than a tree, because `resourceList` answers about one directory and
 * expanding a node would be a request per node with nothing to show meanwhile.
 */

export interface FileListProps extends BoxProps {
  /** Where this is looking, as a `file://` URI on the host. */
  at: string;
  entries: ResourceEntry[];
  loading?: boolean;
  /** What the host said when it would not answer. */
  failure?: string;
  /** Enter on a row: a directory to descend into, or a file to open. */
  onOpen?(entry: ResourceEntry): void;
  /** Up out of this directory. Absent at the top of what the host serves. */
  onUp?(): void;
  focusId?: string;
  autoFocus?: boolean;
}

export const FileList: (props: FileListProps) => RenderOutput =
  defineComponent<FileListProps>('FileList', (props) => {
    const { at, entries, loading, failure, onOpen, onUp, focusId, autoFocus, ...rest } = props;
    const theme = useTheme();

    if (failure !== undefined) {
      // The host's own words. A host that serves no filesystem answers
      // `-32601`, and a blank pane would be this client looking broken for
      // something the host said plainly.
      return <EmptyState title="The host would not list it" message={failure} {...rest} />;
    }
    if (loading === true) return <EmptyState title="Reading the directory" {...rest} />;

    const items: ListItem[] = [
      // The way up, as a row rather than a key, because it is where a person
      // looks for it and because a key that only works sometimes is worse.
      ...(onUp ? [{ id: '..', icon: theme.glyphs.chevronUp, label: '..', tone: 'muted' as SemanticVariant }] : []),
      ...entries.map((entry) => ({
        id: entry.uri,
        icon: entry.kind === 'directory' ? theme.glyphs.chevronRight : ' ',
        label: entry.name,
        // Bytes only for files. A size against a directory is a number about
        // the directory entry rather than about what is in it.
        meta: entry.kind === 'directory' ? '' : String(entry.size ?? ''),
        tone: (entry.kind === 'directory' ? 'accent' : 'muted') as SemanticVariant,
      })),
    ];

    const byId = new Map(entries.map((entry) => [entry.uri, entry]));

    return (
      <Column {...rest}>
        <Marquee content={at.replace(/^file:\/\//, '')} truncate="start" fg="muted" />
        <List
          items={items}
          flex={1}
          renderItem={(item: ListItem, state: ListItemState) => (
            <Row gap={1}>
              <text
                content={item.icon ?? ' '}
                {...(state.selected ? {} : { fg: item.tone })}
                shrink={0}
              />
              <Marquee
                content={item.label}
                active={state.selected && state.focused}
                truncate="end"
                flex={1}
              />
              <text content={item.meta ?? ''} fg="muted" shrink={0} />
            </Row>
          )}
          onActivate={(id: string) => {
            if (id === '..') { onUp?.(); return; }
            const found = byId.get(id);
            if (found) onOpen?.(found);
          }}
          {...(focusId ? { focusId } : {})}
          {...(autoFocus ? { autoFocus: true } : {})}
          emptyMessage="Nothing here"
        />
      </Column>
    );
  });
