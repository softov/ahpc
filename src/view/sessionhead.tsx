import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Column, KeyValue, Row } from '@textui/widgets';
import type { SessionSummary } from '../ahp/types.js';
import { decodeStatus } from '../ahp/status.js';

/**
 * What this conversation *is*, at the top of it.
 *
 * The first thing in the transcript rather than a band above it, and that is
 * the whole design: a caption pinned outside the scrolling region costs a row
 * of the conversation on every screen for ever, so it has to earn each one -
 * which meant one line, which meant dropping most of what it is for. Scrolled
 * with the conversation it costs nothing after the first screen and can say
 * everything, the way the top of a printed letter does.
 *
 * The identifiers are the point. They are what gets pasted into a shell or a
 * bug report, they are exactly what does not fit anywhere else, and the
 * catalogue's detail pane - the only other place they appear - is a screen
 * away from the conversation they belong to.
 */

export interface ChatSessionHeadProps extends BoxProps {
  session: SessionSummary;
  /** What the last turn ran on. A session has no model; each message has one. */
  model?: string;
  /** The chat uri, when the host has said which one this dispatches to. */
  chat?: string | null;
  /** The settings in force, by the host's own labels. */
  settings?: { label: string; value: string }[];
}

/**
 * A timestamp a person can read, in whatever this machine calls a date.
 *
 * The host sends ISO, which is unambiguous and not what anybody wants to read
 * off a caption. An unparseable one is passed through rather than shown as
 * "Invalid Date": what the host said is more useful than what we made of it.
 */
function when(iso: string | undefined): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const ChatSessionHead: (props: ChatSessionHeadProps) => RenderOutput =
  defineComponent<ChatSessionHeadProps>('ChatSessionHead', (props) => {
    const { session, model, chat, settings = [], ...rest } = props;
    const theme = useTheme();
    const status = decodeStatus(session.status);
    const started = when(session.createdAt);
    const updated = when(session.modifiedAt);

    // Only what is known. A row of empty values is what building this from a
    // fixed list produces, and it reads as a session the host would not talk
    // about rather than as one nobody has asked yet.
    const rows: { label: string; value: string; tone?: SemanticVariant }[] = [
      { label: 'Harness', value: [session.provider, model].filter(Boolean).join(`  ${theme.glyphs.separator}  `) },
      ...settings.filter((setting) => setting.value).map((setting) => ({ ...setting })),
      { label: 'Workspace', value: session.workingDirectories.map((dir) => dir.replace(/^file:\/\//, '')).join(', ') },
      {
        label: 'Started',
        value: started && updated && updated !== started
          ? `${started}  ${theme.glyphs.separator}  updated ${updated}`
          : started,
      },
      // Last, and in full. A uri you can read half of is worse than one you
      // cannot see at all: it looks like the whole thing.
      { label: 'Session', value: session.resource },
      ...(chat ? [{ label: 'Chat', value: chat }] : []),
    ].filter((row) => row.value !== '');

    return (
      <Column {...rest} gap={0}>
        <Row gap={1}>
          <text content={theme.glyphs[status.glyph]} fg={status.tone as SemanticVariant} shrink={0} />
          <text content={session.title} bold wrap="word" flex={1} />
          <text content={status.label} fg={status.tone as SemanticVariant} shrink={0} />
        </Row>
        <KeyValue items={rows} />
      </Column>
    );
  });
