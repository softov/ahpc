import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Badge, Column, MarkdownView, Row } from '@textui/widgets';
import type { ToolCall } from '../ahp/types.js';

/**
 * A tool call, as a row.
 *
 * Twenty of these in a turn look identical unless the *command* is on the row,
 * so the input is the row and the display name is a prefix. What it meant to
 * do is markdown, like everything else a host writes for a person; what came
 * back is not, and is shown as it arrived.
 *
 * The status is a glyph and a colour together. A 16-colour session, a piped
 * log and a colourblind reader all lose the colour and keep the glyph.
 *
 * It sits at the turn's own left edge rather than inside the gutter, with its
 * status glyph where the header's bullet is. A tool call is something the
 * agent *did*; indenting it inside the rule filed it under what the agent was
 * saying, which is the one thing it is not.
 */

export interface ToolCallRowProps extends BoxProps {
  call: ToolCall;
  expanded?: boolean;
  /** The transcript's cursor is on this row. */
  active?: boolean;
  /** Clicking the row opens it. */
  onToggle?(): void;
}

type StatusGlyph = 'bulletHollow' | 'bulletHalf' | 'bulletFilled' | 'check' | 'cross';

const LOOK: Record<string, { tone: SemanticVariant; glyph: StatusGlyph }> = {
  pending: { tone: 'muted', glyph: 'bulletHollow' },
  'pending-confirmation': { tone: 'warning', glyph: 'bulletHalf' },
  running: { tone: 'accent', glyph: 'bulletFilled' },
  completed: { tone: 'success', glyph: 'check' },
  failed: { tone: 'danger', glyph: 'cross' },
  cancelled: { tone: 'muted', glyph: 'cross' },
};

/**
 * The input, as one line.
 *
 * A tool's arguments are often JSON, and JSON arrives with newlines in it. Put
 * straight on the row, a three-line object makes the row three lines tall and
 * every other cell in it vertically centred - so the name floats beside the
 * middle line of a brace-delimited block. The whole thing is on its own lines
 * once the row is opened; this is the part that fits beside a name.
 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export const ToolCallRow: (props: ToolCallRowProps) => RenderOutput =
  defineComponent<ToolCallRowProps>('ToolCallRow', (props) => {
    const { call, expanded, active, onToggle, ...rest } = props;
    const theme = useTheme();
    const look = LOOK[call.status] ?? { tone: 'muted' as SemanticVariant, glyph: 'bulletHollow' as StatusGlyph };
    const glyph = theme.glyphs[look.glyph];
    const chevron = expanded ? theme.glyphs.chevronDown : theme.glyphs.chevronRight;
    const failed = call.status === 'failed' || (call.exitCode !== undefined && call.exitCode !== 0);
    const summary = oneLine(call.input ?? call.intention ?? '');
    // Only when there is something under it. A chevron on a row that opens on
    // to nothing is a promise the row cannot keep.
    const opens = Boolean(call.intention ?? call.input ?? call.output ?? call.outcome
      ?? (call.files && call.files.length > 0));

    return (
      <Column {...rest} {...(active ? { bg: 'selected' as const } : {})}>
        <Row
          gap={1}
          {...(opens && onToggle ? { onClick: onToggle } : {})}
          // The whole row lights up, not the glyph the pointer happens to be
          // over: the row is the thing that opens.
          style={{ hover: { bg: 'hover' } }}
        >
          <text content={glyph} fg={look.tone} />
          <text content={call.name} bold />
          <text content={summary} fg="muted" flex={1} truncate="middle" />
          {call.status === 'pending-confirmation' ? <Badge label="asks" tone="warning" icon={theme.glyphs.warning} /> : null}
          {failed ? <Badge label={`exit ${call.exitCode ?? 1}`} tone="danger" /> : null}
          {/* Trailing, like a disclosure triangle - the row says what it is
              first and how to see more of it last. */}
          {opens ? <text content={chevron} fg="subtle" /> : null}
        </Row>

        {expanded ? (
          // Indented to the row's own text, which starts one glyph and one gap
          // in - so what opened out of a row lines up under it.
          <Column padding={[0, 0, 0, 2]} gap={0}>
            {call.intention ? <MarkdownView content={call.intention} quiet /> : null}
            {call.input ? (
              // On its own lines, wrapped as written. This is where the JSON
              // goes: whole, and not sharing a row with the name.
              <Column bg="surfaceAlt" padding={[0, 1]}>
                {call.input.split('\n').map((line, i) => (
                  <text key={i} content={line} fg="text" wrap="word" />
                ))}
              </Column>
            ) : null}
            {call.output ? (
              <Column>
                {call.output.split('\n').slice(0, 12).map((line, i) => (
                  <text key={i} content={line} fg="muted" truncate="end" />
                ))}
                {call.output.split('\n').length > 12 ? (
                  <text content={`${theme.glyphs.ellipsis} ${call.output.split('\n').length - 12} more lines`} fg="subtle" />
                ) : null}
              </Column>
            ) : null}
            {call.files && call.files.length > 0 ? (
              <Column>
                {call.files.map((file) => (
                  <text key={file} content={`${theme.glyphs.chevronRight} ${file}`} fg="info" />
                ))}
              </Column>
            ) : null}
            {call.outcome ? <text content={call.outcome} fg="subtle" /> : null}
          </Column>
        ) : null}
      </Column>
    );
  });
