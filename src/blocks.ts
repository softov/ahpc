import type { QueuedMessage, ToolCall, Turn } from './ahp/types.js';

/**
 * A conversation, flattened into the rows a viewport scrolls.
 *
 * A turn is not a box. It is a run of rows - a header, some prose, a tool
 * call, more prose - and the transcript has to be able to put its cursor on
 * one of them, measure it, and scroll to it. Nesting each turn inside a
 * container would mean the transcript could only ever scroll to a whole turn,
 * and a turn can be four hundred rows long.
 *
 * The order is the host's order. `responseParts` interleaves prose and calls
 * in one stream, and "let me search for those" means something before the
 * searches and nothing after them.
 */
export type Block =
  | { kind: 'said'; id: string; turnId: string; text: string }
  | {
    kind: 'header'; id: string; turnId: string; model?: string;
    /**
     * What the turn was asked for besides the model, in the host's words.
     *
     * The values rather than the keys: `thinkingLevel` is one host's name for
     * a property whose *answers* are what a person reads, and a header that
     * spelled out the key would be twice as long and no clearer.
     */
    settings?: string;
    meta: string; state: Turn['state'];
  }
  | { kind: 'prose'; id: string; turnId: string; content: string; streaming: boolean }
  | { kind: 'reasoning'; id: string; turnId: string; content: string; streaming: boolean }
  | { kind: 'notice'; id: string; turnId: string; content: string }
  | { kind: 'failure'; id: string; turnId: string; content: string; resumable: boolean }
  | { kind: 'tool'; id: string; turnId: string; call: ToolCall }
  | { kind: 'queued'; id: string; messageId: string; text: string };

/**
 * Everything in a block that a person could be looking for.
 *
 * A tool call is its name, its command and what came back, because all three
 * are things somebody searches a transcript for - the file a command touched
 * is in the output and nowhere else. A header is the model and the settings,
 * which is how "where did I switch to opus" is answered.
 */
export function blockText(block: Block): string {
  switch (block.kind) {
    case 'said':
    case 'queued':
      return block.text;
    case 'prose':
    case 'reasoning':
    case 'notice':
    case 'failure':
      return block.content;
    case 'header':
      return [block.model, block.settings, block.meta].filter(Boolean).join(' ');
    case 'tool':
      return [
        block.call.name, block.call.toolName, block.call.input,
        block.call.intention, block.call.outcome, block.call.output,
        ...(block.call.files ?? []),
      ].filter(Boolean).join(' ');
  }
}

/**
 * Where in the conversation a query appears, as block indices in order.
 *
 * Case-insensitive, and a blank query matches nothing rather than everything:
 * a find with no term is a find that has not been typed yet, and lighting up
 * every block for it is the opposite of what the box is for.
 */
export function findBlocks(blocks: Block[], query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const found: number[] = [];
  blocks.forEach((block, index) => {
    if (blockText(block).toLowerCase().includes(needle)) found.push(index);
  });
  return found;
}

/** Blocks the cursor stops on: the ones that do something when activated. */
export function selectable(block: Block): boolean {
  // A queued message among them, because taking one back is something you do
  // to it - and the cursor is how anything in the transcript is reached.
  return block.kind === 'tool' || block.kind === 'reasoning' || block.kind === 'queued';
}

export function toBlocks(turns: Turn[], queued: QueuedMessage[] = []): Block[] {
  const blocks: Block[] = [];

  for (const turn of turns) {
    if (turn.role === 'user') {
      blocks.push({ kind: 'said', id: `${turn.id}:said`, turnId: turn.id, text: turn.message ?? '' });
      continue;
    }

    const running = turn.state === 'running';
    blocks.push({
      kind: 'header',
      id: `${turn.id}:head`,
      turnId: turn.id,
      ...(turn.model ? { model: turn.model.id } : {}),
      ...(turn.model?.config ? { settings: Object.values(turn.model.config).join(' · ') } : {}),
      meta: running ? 'running' : turn.elapsedMs ? `${(turn.elapsedMs / 1000).toFixed(1)}s` : '',
      state: turn.state,
    });

    turn.parts.forEach((part, index) => {
      const last = index === turn.parts.length - 1;
      switch (part.kind) {
        case 'markdown':
          blocks.push({ kind: 'prose', id: part.id, turnId: turn.id, content: part.content, streaming: running && last });
          break;
        case 'reasoning':
          blocks.push({ kind: 'reasoning', id: part.id, turnId: turn.id, content: part.content, streaming: running && last });
          break;
        case 'systemNotification':
          blocks.push({ kind: 'notice', id: part.id, turnId: turn.id, content: part.content });
          break;
        case 'toolCall':
          blocks.push({ kind: 'tool', id: part.id, turnId: turn.id, call: part.call });
          break;
        case 'error':
          blocks.push({ kind: 'failure', id: part.id, turnId: turn.id, content: part.message, resumable: part.resumable });
          break;
        default:
          break;
      }
    });
  }

  // What the person typed while the agent was busy. Below the conversation
  // because that is when it will be said, and visibly not sent yet.
  // Keyed by the host's own id, not by position: the queue is the host's, the
  // head leaves it whenever the running turn ends, and an index would name a
  // different message every time one did.
  for (const message of queued) {
    blocks.push({ kind: 'queued', id: `queued:${message.id}`, messageId: message.id, text: message.text });
  }

  return blocks;
}
