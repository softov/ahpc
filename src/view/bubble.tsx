import type { BoxProps, RenderOutput, SemanticVariant, StyleColor } from '@textui/core';
import { defineComponent, useFrame, useStoreValue, useTheme } from '@textui/core';
import { Column, MarkdownView, Row } from '@textui/widgets';
import { MARKDOWN } from '../state.js';

/**
 * One thing said, and the two ways it is still being said.
 *
 * A bubble in a terminal is not a rounded rectangle. It is a gutter that says
 * who is speaking and a body that owns the rest of the width - because the
 * width is 80 cells and half of it spent on alignment is half the conversation
 * gone.
 */

export type Speaker = 'user' | 'agent' | 'system';

/**
 * The rule down the left of everything one speaker said.
 *
 * A box that fills rather than a `text`: the text is one row tall and the
 * paragraph beside it is nine, so a rule written as a character marks the
 * first line of a wrapped answer and abandons the rest of it.
 */
export const Gutter: (props: BoxProps) => RenderOutput = defineComponent<BoxProps>('ChatGutter', (props) => {
  const theme = useTheme();
  // `alignSelf` because `Row` centres its children: a one-cell box in a
  // centred row is one cell tall, wherever the rule was meant to reach.
  return <box width={1} alignSelf="stretch" fill={theme.borderChars().left} fg="borderSubtle" {...props} />;
});

export interface ChatBubbleProps extends BoxProps {
  speaker: Speaker;
  /** The name, when the speaker is not enough: a model, a person, a host. */
  author?: string;
  /** Right of the author line: a time, a duration, a model. */
  meta?: string;
  tone?: SemanticVariant;
  /** The transcript's cursor is on this block. */
  active?: boolean;
  children?: unknown;
}

const SPEAKER: Record<Speaker, { fg: StyleColor; label: string }> = {
  user: { fg: 'primary', label: 'you' },
  agent: { fg: 'accent', label: 'agent' },
  system: { fg: 'muted', label: 'system' },
};

export const ChatBubble: (props: ChatBubbleProps) => RenderOutput =
  defineComponent<ChatBubbleProps>('ChatBubble', (props) => {
    const { speaker, author, meta, tone, active, children, ...rest } = props;
    const theme = useTheme();
    const look = SPEAKER[speaker];
    const glyph = speaker === 'user' ? theme.glyphs.chevronRight
      : speaker === 'agent' ? theme.glyphs.bulletFilled
        : theme.glyphs.info;

    // The gutter is one column of glyph and one of rule. It is what makes a
    // wrapped paragraph read as one person talking rather than as the page
    // starting again, and it survives losing colour - which a tinted
    // background does not.
    return (
      <Column {...rest} {...(active ? { bg: 'selected' as const } : {})}>
        <Row gap={1}>
          <text content={glyph} fg={tone ?? look.fg} />
          <text content={author ?? look.label} bold fg={tone ?? look.fg} />
          {meta ? <text content={meta} fg="subtle" flex={1} truncate="end" /> : <text content="" flex={1} />}
        </Row>
        <Row gap={1} flex={1}>
          <Gutter />
          <Column flex={1} gap={1}>{children}</Column>
        </Row>
      </Column>
    );
  });

export interface StreamingTextProps extends BoxProps {
  content: string;
  /** Still arriving. Draws a caret and keeps it on the last word. */
  streaming?: boolean;
  quiet?: boolean;
  maxLines?: number;
  /**
   * Draw it as markdown, or as the characters that arrived.
   *
   * Unstated it follows the application's own switch, which is what the key
   * that toggles it moves - so a caller has to say something here only when
   * it wants one or the other regardless.
   */
  markdown?: boolean;
}

/**
 * Text that is still being said.
 *
 * The caret is part of the content rather than a node beside it, because a
 * caret placed after the block sits under the last line instead of at the end
 * of it - and the end of the sentence is the only place it means anything.
 *
 * It blinks on the theme's own ticker, so animation being off (a pipe, a test,
 * a `--static` capture) leaves a steady caret rather than a missing one.
 */
export const StreamingText: (props: StreamingTextProps) => RenderOutput =
  defineComponent<StreamingTextProps>('StreamingText', (props) => {
    const { content, streaming, quiet, maxLines, markdown, ...rest } = props;
    const theme = useTheme();
    // Only while something is arriving. A ticker marks its component dirty
    // whether or not the frame it produces differs, so an unconditional one
    // here meant every settled paragraph in the transcript asked the
    // application to redraw twice a second, for ever - a conversation that
    // got heavier to sit in the longer it got.
    const frame = useFrame(2, { enabled: streaming === true });
    const caret = streaming && frame % 2 === 0 ? theme.glyphs.caret : '';
    // Read unconditionally: `??` short-circuits, and a hook that is only
    // reached when a prop is absent is a hook that changes position between
    // renders. The prop still wins - it is just decided after the read.
    const preference = useStoreValue<boolean>(MARKDOWN, true) ?? true;
    const rendered = markdown ?? preference;
    const shown = streaming ? `${content}${caret}` : content;

    // Raw is a `text`, not a `MarkdownView` that was told not to parse: the
    // point of turning it off is to see the characters that arrived, and
    // anything that lays the document out has already decided some of them
    // were structure. `wrap` rather than truncate, because the lines being
    // read are the long ones - a fenced block and a table are exactly what is
    // wider than the pane.
    if (!rendered) {
      return (
        <text
          content={shown}
          wrap="word"
          {...(quiet ? { fg: 'muted' as const } : {})}
          {...rest}
        />
      );
    }

    return (
      <MarkdownView
        content={shown}
        {...(quiet ? { quiet: true } : {})}
        {...(maxLines !== undefined ? { maxLines } : {})}
        {...rest}
      />
    );
  });

export interface ReasoningBlockProps extends BoxProps {
  content: string;
  expanded?: boolean;
  streaming?: boolean;
  /** Shown collapsed: "thought for 12s". */
  summary?: string;
}

/**
 * What the agent was thinking, folded away.
 *
 * Reasoning is prose the host sends like any other, and it is not what the
 * reader came for - so it is one row until it is asked for. Dropping it
 * instead loses the only account of *why* a turn did what it did.
 */
export const ReasoningBlock: (props: ReasoningBlockProps) => RenderOutput =
  defineComponent<ReasoningBlockProps>('ReasoningBlock', (props) => {
    const { content, expanded, streaming, summary, ...rest } = props;
    const theme = useTheme();
    const chevron = expanded ? theme.glyphs.chevronDown : theme.glyphs.chevronRight;
    const words = content.trim().split(/\s+/).filter(Boolean).length;

    return (
      <Column {...rest}>
        <Row gap={1}>
          <text content={chevron} fg="subtle" />
          <text content={summary ?? (streaming ? 'thinking' : `thought, ${words} words`)} fg="subtle" italic />
        </Row>
        {expanded ? (
          <Row gap={1}>
            <text content=" " />
            <StreamingText content={content} quiet flex={1} {...(streaming ? { streaming: true } : {})} />
          </Row>
        ) : null}
      </Column>
    );
  });
