import type { Block } from '@textui/chat';
import type { QueuedMessage, ToolCall, Turn } from './ahp/types.js';

export type { Block } from '@textui/chat';
export { selectable } from '@textui/chat';

/**
 * What a call waiting on a sign-in says, in one sentence.
 *
 * The call and then the server, because which tool stopped is the first thing
 * a person wants and the resource is where the token goes. The host's own
 * readable name comes with the URL rather than instead of it, since the URL is
 * what `authenticate` names.
 */
function signIn(call: ToolCall): string {
  const server = call.auth === undefined
    ? ''
    : call.auth.name === undefined ? call.auth.resource : `${call.auth.name} (${call.auth.resource})`;
  const why = call.auth?.description ?? call.auth?.reason;
  return `${call.name} needs a sign-in: ${server}${why === undefined ? '' : ` (${why})`}`;
}

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
export function toBlocks(turns: Turn[], queued: QueuedMessage[] = []): Block[] {
  const blocks: Block[] = [];

  for (const turn of turns) {
    if (turn.role === 'user') {
      blocks.push({ kind: 'said', id: `${turn.id}:said`, turnId: turn.id, text: turn.message ?? '' });
      continue;
    }

    const running = turn.state === 'running';
    // What this turn's own results changed. Read off the calls rather than
    // kept on the turn, because the count belongs to the result that earned it
    // and a turn has no diff of its own.
    const edits = turn.parts.reduce(
      (total, part) => (part.kind === 'toolCall' && part.call.edits
        ? { added: total.added + part.call.edits.added, removed: total.removed + part.call.edits.removed }
        : total),
      { added: 0, removed: 0 },
    );
    const elapsed = running ? 'running' : turn.elapsedMs ? `${(turn.elapsedMs / 1000).toFixed(1)}s` : '';
    const meta = edits.added > 0 || edits.removed > 0
      ? `${elapsed}${elapsed === '' ? '' : ' '}+${edits.added} -${edits.removed}`
      : elapsed;
    blocks.push({
      kind: 'header',
      id: `${turn.id}:head`,
      turnId: turn.id,
      ...(turn.model ? { model: turn.model.id } : {}),
      ...(turn.model?.config ? { settings: Object.values(turn.model.config).join(' · ') } : {}),
      meta,
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
        case 'roundEnded': {
          // The host closed the round. The part above it is no longer last, so
          // its stream is already off; this says the same thing in the drawing
          // code rather than leaving it to the index arithmetic.
          const above = blocks[blocks.length - 1];
          if (above !== undefined && (above.kind === 'reasoning' || above.kind === 'prose')) above.streaming = false;
          break;
        }
        case 'toolCall':
          if (part.call.status === 'auth-required') {
            // Not a running call and not a failed turn: the turn is waiting on
            // a person, and a notice is the row that says so without claiming
            // either. `@textui/chat` has no `auth-required` tool status, so it
            // is drawn from the block kind that already exists.
            blocks.push({ kind: 'notice', id: part.id, turnId: turn.id, content: signIn(part.call) });
            break;
          }
          blocks.push({ kind: 'tool', id: part.id, turnId: turn.id, call: { ...part.call, status: part.call.status } });
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
