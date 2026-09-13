/**
 * `agent-host-session://` links, which are how one session names another.
 *
 * The reference host's session tools answer with one - `create_session`,
 * `list_sessions` and `send_message` each put an `openLink` in their result -
 * and its window turns the link into a click that opens the session or the
 * chat. A terminal has no click, so here the same link is something to pick:
 * the links in the open transcript are offered as a list, and one chosen
 * opens what it names. The shape is the reference host's
 * (`common/openSessionLink.ts`): `agent-host-session://<provider>/<id>`, with
 * `?chat=<chatId>` for one chat of it and `&turn=<turnId>` for one turn.
 */

import type { SessionSummary, Turn } from './ahp/types.js';

export interface SessionLink {
  provider: string;
  id: string;
  chatId?: string;
  turnId?: string;
}

const LINK = /^agent-host-session:\/\/([^/?#]+)\/([^?#]+)(?:\?([^#]*))?(?:#.*)?$/i;
/** A link wherever it sits in prose: up to the whitespace or the bracket that ends it. */
const IN_TEXT = /agent-host-session:\/\/[^\s<>()\[\]"'`]+/gi;

const param = (query: string, name: string): string | undefined => {
  const found = new RegExp(`(?:^|&)${name}=([^&]*)`).exec(query)?.[1];
  if (found === undefined) return undefined;
  try { return decodeURIComponent(found); }
  catch { return found; }
};

/** The link read, or undefined for text that is not one. */
export function parseSessionLink(text: string): SessionLink | undefined {
  const found = LINK.exec(text.trim());
  if (found === null) return undefined;
  let id: string;
  try { id = decodeURIComponent(found[2] ?? ''); }
  catch { id = found[2] ?? ''; }
  if (id === '') return undefined;
  const query = found[3] ?? '';
  const chatId = param(query, 'chat');
  const turnId = param(query, 'turn');
  return {
    provider: found[1] ?? '',
    id,
    // The default chat is the session itself, which is how the reference
    // host builds the link: it leaves the query off for it.
    ...(chatId !== undefined && chatId !== '' && chatId !== 'default' ? { chatId } : {}),
    ...(turnId !== undefined && turnId !== '' ? { turnId } : {}),
  };
}

/** The id inside a session URI, whatever scheme it is under: `ahp-session:/x` and `claude:/x` are both `x`. */
export const idOf = (uri: string): string => {
  const colon = uri.indexOf(':');
  return (colon < 0 ? uri : uri.slice(colon + 1)).replace(/^\/+/, '');
};

/**
 * The row a link names.
 *
 * Matched on the id and the provider, whichever scheme the row is under: a
 * session this client started is `ahp-session:/` and one read off the host's
 * catalogue is `<provider>:/`, and the link says neither.
 */
export const sessionOfLink = (link: SessionLink, rows: SessionSummary[]): SessionSummary | undefined =>
  rows.find((row) => idOf(row.resource) === link.id && row.provider === link.provider)
  ?? rows.find((row) => idOf(row.resource) === link.id);

/** One link found in a transcript, and where. */
export interface FoundLink {
  link: string;
  /** What was around it, for the row that offers it. */
  context: string;
  turnId: string;
}

/**
 * Every link in the transcript, once each, in the order they appear.
 *
 * Read from what a person can see: the prose, the tool calls' outcomes and
 * outputs, and the host's notices. A tool answering `create_session` puts the
 * link in its output, which is where somebody reading the transcript finds it.
 */
export function linksIn(turns: Turn[]): FoundLink[] {
  const found: FoundLink[] = [];
  const seen = new Set<string>();
  const take = (text: string | undefined, turnId: string): void => {
    if (!text) return;
    for (const match of text.matchAll(IN_TEXT)) {
      const link = match[0].replace(/[.,;:!?]+$/, '');
      if (seen.has(link) || parseSessionLink(link) === undefined) continue;
      seen.add(link);
      const from = Math.max(0, (match.index ?? 0) - 40);
      const context = text.slice(from, match.index ?? 0).replace(/\s+/g, ' ').trim();
      found.push({ link, context, turnId });
    }
  };
  for (const turn of turns) {
    take(turn.message, turn.id);
    for (const part of turn.parts) {
      if (part.kind === 'markdown' || part.kind === 'systemNotification') take(part.content, turn.id);
      else if (part.kind === 'toolCall') { take(part.call.outcome, turn.id); take(part.call.output, turn.id); }
    }
  }
  return found;
}

/**
 * Whether a chat URI is the chat a link names.
 *
 * The id is the URI's authority where it has one - `ahp-chat://<chatId>/<session>`,
 * which is how the reference host and ahpd spell a chat - and the path
 * otherwise, `ahp-chat:/<id>`, which is the protocol's own shape.
 */
export const chatMatches = (chatUri: string, chatId: string): boolean => {
  const found = /^[^:]+:\/\/([^/]+)\//.exec(chatUri)?.[1] ?? idOf(chatUri);
  if (found === '') return false;
  try { return decodeURIComponent(found) === chatId; }
  catch { return found === chatId; }
};
