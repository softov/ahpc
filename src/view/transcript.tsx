import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Feed, Row } from '@textui/widgets';
import type { Block } from '../blocks.js';
import { ChatBubble, Gutter, ReasoningBlock, StreamingText } from './bubble.js';
import { ToolCallRow } from './toolcall.js';

/**
 * The conversation, as blocks in a feed.
 *
 * There is no scrolling in this file. `Feed` owns the viewport, the cursor and
 * the tail it follows, because none of that is about chat: a transcript, an
 * activity stream and a list of search results with snippets are the same
 * problem, which is "entries that are not one line tall". What is left here is
 * the only part that *is* about chat - which block draws as what.
 */

export interface ChatTranscriptProps extends BoxProps {
  blocks: Block[];
  expanded: Record<string, boolean>;
  onToggle(id: string): void;
  /** Which block the cursor is on. Held by the screen, like every other state. */
  cursor?: number;
  onCursor?(index: number): void;
  /**
   * What this conversation is, as the first thing in it.
   *
   * Inside the scrolling region rather than pinned above it: a caption outside
   * costs a row of the conversation on every screen for ever, so it has to
   * earn each one - which is what forces it down to a line and then down to
   * less than it was for. Here it costs nothing after the first screen.
   *
   * It is not a block. The cursor walks the conversation and there is nothing
   * to do to a caption, so it sits ahead of the indices rather than in them.
   */
  head?: RenderOutput;
  focusId?: string;
}

export const ChatTranscript: (props: ChatTranscriptProps) => RenderOutput =
  defineComponent<ChatTranscriptProps>('ChatTranscript', (props) => {
    const {
      blocks, expanded, onToggle, cursor, onCursor, head,
      focusId = 'chat.transcript', ...rest
    } = props;

    // The caption is an entry the feed scrolls and the cursor does not visit,
    // so every index the feed reports is one further along than the block it
    // stands for. Converted here, once, rather than at each of the three
    // places that would otherwise each have to remember.
    const lead = head ? 1 : 0;

    return (
      <Feed
        focusId={focusId}
        // Page up from the composer means the conversation above it. There is
        // nothing else on this screen those keys could be for, and taking the
        // keyboard off the field to use them is what a reader is avoiding.
        pageKeys="always"
        {...(cursor !== undefined ? { selectedIndex: cursor + lead } : {})}
        {...(onCursor ? { onSelect: (index: number) => onCursor(Math.max(0, index - lead)) } : {})}
        onActivate={(index: number) => {
          const block = blocks[index - lead];
          if (block) onToggle(block.id);
        }}
        {...rest}
      >
        {head ?? null}
        {blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            expanded={expanded[block.id] ?? false}
            active={cursor !== undefined && blocks[cursor]?.id === block.id}
            onToggle={() => onToggle(block.id)}
          />
        ))}
      </Feed>
    );
  });

const BlockView = defineComponent<{
  block: Block;
  expanded: boolean;
  active: boolean;
  onToggle(): void;
}>('ChatBlockView', ({ block, expanded, active, onToggle }) => {
  const theme = useTheme();

  switch (block.kind) {
    case 'said':
      // The blank row is the turn boundary. A uniform gap between every block
      // would space a paragraph from the sentence it belongs to just as much
      // as it spaces one speaker from the next.
      return (
        <ChatBubble speaker="user" padding={[1, 0, 0, 0]}>
          <text content={block.text} wrap="word" />
        </ChatBubble>
      );
    case 'header':
      return (
        <Row gap={1} padding={[1, 0, 0, 0]}>
          <text content={theme.glyphs.bulletFilled} fg={block.state === 'running' ? 'accent' : 'muted'} />
          <text content={block.model ?? 'agent'} bold fg="accent" />
          <text content={block.meta} fg="subtle" flex={1} />
          {block.state === 'cancelled' ? <text content="stopped" fg="warning" /> : null}
          {block.state === 'failed' ? <text content="failed" fg="danger" /> : null}
        </Row>
      );
    case 'prose':
      return (
        <Row gap={1}>
          <Gutter />
          <StreamingText content={block.content} streaming={block.streaming} flex={1} />
        </Row>
      );
    case 'reasoning':
      return (
        <Row gap={1}>
          <Gutter />
          <ReasoningBlock
            content={block.content}
            expanded={expanded}
            streaming={block.streaming}
            flex={1}
            {...(active ? { bg: 'selected' as const } : {})}
          />
        </Row>
      );
    case 'notice':
      return (
        <Row gap={1}>
          <text content={theme.glyphs.info} fg="info" />
          <text content={block.content} fg="muted" wrap="word" flex={1} />
        </Row>
      );
    case 'tool':
      // No gutter. A tool call is something the agent *did*, not something it
      // said, so it sits at the turn's own left edge with a status glyph where
      // the header's bullet is - rather than indented inside the rule as
      // though it were a paragraph of the answer.
      return <ToolCallRow call={block.call} expanded={expanded} active={active} onToggle={onToggle} />;
    case 'queued':
      // Not sent. It reads as a message unless it says so, and "I typed that
      // and nothing happened" is the complaint that follows.
      return (
        <Row gap={1}>
          <text content={theme.glyphs.chevronRight} fg={active ? 'accent' : 'subtle'} />
          <text content={block.text} fg="subtle" italic wrap="word" flex={1} />
          {/* What the cursor being here is *for*. A queue you cannot take
              anything out of is a list of messages you have to let happen. */}
          <text content={active ? 'enter drops it' : 'queued'} fg="warning" />
        </Row>
      );
    default:
      return null;
  }
});
