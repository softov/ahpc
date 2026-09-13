/**
 * A wire capture, read back.
 *
 * `--wire <file>` on either end writes one line per frame, `{ at, from, peer,
 * frame }`, and this is the other half: the lines as rows a screen can list,
 * and a reader that keeps up with a file still being written. Nothing here
 * renders, and nothing here needs a host - a capture is a file, and the two
 * ends of a conversation can be read from the same shell.
 */

import { closeSync, openSync, readSync, statSync, watch } from 'node:fs';

/** One line of a capture, as written by `ahpd --wire` and `ahpc --wire`. */
export interface WireLine {
  at: string;
  from: 'client' | 'host';
  peer?: string;
  frame: unknown;
}

/** One frame, described. Everything a row shows is decided here, once. */
export interface WireRow {
  /** Its line number in the file, which is the only name a frame has. */
  seq: number;
  at: string;
  from: 'client' | 'host';
  peer: string;
  /** What kind of JSON-RPC message the frame is. */
  kind: 'request' | 'response' | 'error' | 'notification' | 'text';
  /** The method, or for a response the method of the request it answers. */
  method: string;
  /** The request id, where there is one. */
  id?: string;
  /** The channel the frame names, where it names one. */
  channel?: string;
  /** The action type, for a dispatch or an action. */
  type?: string;
  /** One line about the payload: the error message, the action, the text. */
  detail: string;
  frame: unknown;
}

const bag = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? value as Record<string, unknown> : {});
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** One line parsed, or undefined for one that is not a capture line. */
export function parseWireLine(text: string): WireLine | undefined {
  let held: unknown;
  try { held = JSON.parse(text); }
  catch { return undefined; }
  const line = bag(held);
  if (typeof line.at !== 'string' || (line.from !== 'client' && line.from !== 'host') || !('frame' in line)) return undefined;
  return { at: line.at, from: line.from, ...(typeof line.peer === 'string' ? { peer: line.peer } : {}), frame: line.frame };
}

/**
 * The frames described, in order.
 *
 * A response says nothing about what it answers, so the requests are held by
 * id and direction until their answer goes by - which is what puts a method
 * on a response row, and is why this is a reader with state rather than a
 * function of one line.
 */
export function describer(): (line: WireLine, seq: number) => WireRow {
  /** Requests waiting for an answer, by the direction they went and their id. */
  const pending = new Map<string, string>();
  return (line, seq) => {
    const frame = bag(line.frame);
    const peer = line.peer ?? '';
    if (typeof line.frame !== 'object' || line.frame === null) {
      return { seq, at: line.at, from: line.from, peer, kind: 'text', method: '', detail: String(line.frame), frame: line.frame };
    }
    const id = frame.id === undefined || frame.id === null ? undefined : String(frame.id);
    const params = bag(frame.params);
    const channel = str(params.channel);
    const action = bag(params.action);
    const type = str(action.type);
    if (typeof frame.method === 'string') {
      const method = frame.method;
      if (id !== undefined) pending.set(`${line.from}:${id}`, method);
      return {
        seq, at: line.at, from: line.from, peer,
        kind: id === undefined ? 'notification' : 'request',
        method, ...(id === undefined ? {} : { id }), ...(channel === undefined ? {} : { channel }), ...(type === undefined ? {} : { type }),
        detail: detailOf(method, params, action),
        frame: line.frame,
      };
    }
    // An answer travels the other way from the question it answers.
    const asked = line.from === 'client' ? 'host' : 'client';
    const method = id === undefined ? '' : pending.get(`${asked}:${id}`) ?? '';
    if (id !== undefined) pending.delete(`${asked}:${id}`);
    if ('error' in frame) {
      const error = bag(frame.error);
      return { seq, at: line.at, from: line.from, peer, kind: 'error', method, ...(id === undefined ? {} : { id }), detail: `${str(error.code) ?? String(error.code ?? '')} ${str(error.message) ?? ''}`.trim(), frame: line.frame };
    }
    return { seq, at: line.at, from: line.from, peer, kind: 'response', method, ...(id === undefined ? {} : { id }), detail: summaryOf(frame.result), frame: line.frame };
  };
}

/** What a request or a notification is about, in a few words. */
const detailOf = (method: string, params: Record<string, unknown>, action: Record<string, unknown>): string => {
  // The action type is the row's own field; what is left is what the action
  // carried, where it carried words.
  if (method === 'dispatchAction' || method === 'action') {
    const text = str(bag(action.message).text) ?? str(action.text) ?? str(action.title);
    return text === undefined ? '' : text.replace(/\s+/g, ' ').slice(0, 80);
  }
  if (method === 'initialize') return str(params.clientId) ?? '';
  if (method === 'createSession') return `${str(params.provider) ?? ''} ${str(params.channel) ?? ''}`.trim();
  // The channel is the row's own field too; what else the request names.
  return str(params.uri) ?? str(params.session) ?? str(params.resource) ?? str(params.provider) ?? '';
};

/** What a result is, in a few words: its keys, or the value when it is one. */
const summaryOf = (result: unknown): string => {
  if (result === undefined || result === null) return '';
  if (typeof result !== 'object') return String(result);
  if (Array.isArray(result)) return `${result.length} item${result.length === 1 ? '' : 's'}`;
  const keys = Object.keys(result);
  return keys.length === 0 ? '{}' : keys.slice(0, 6).join(', ') + (keys.length > 6 ? ', …' : '');
};

/** Whether a row is one the filter keeps. A substring of anything a row shows, the way the catalogue filters. */
export const matches = (row: WireRow, query: string): boolean => {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return true;
  return [row.method, row.channel ?? '', row.type ?? '', row.kind, row.from, row.id ?? '', row.detail, row.peer]
    .some((field) => field.toLowerCase().includes(wanted));
};

export interface Follower {
  /** Stop reading. */
  close(): void;
}

/**
 * The file, as it grows.
 *
 * Read from the top, then from wherever the last read stopped whenever the
 * file changes - `fs.watch` where the platform has it, and a poll beside it
 * because a watcher on a file being appended to by another process is not
 * something every platform delivers. A line still being written is kept
 * until its newline arrives, so a frame is never handed over in halves. A
 * file cut back to nothing, which is what a new `--wire` run does, starts
 * over rather than reading past its end.
 */
export function follow(path: string, onRows: (rows: WireRow[]) => void, options: { interval?: number } = {}): Follower {
  const describe = describer();
  let offset = 0;
  let seq = 0;
  let partial = '';
  let closed = false;

  const read = (): void => {
    if (closed) return;
    let size: number;
    try { size = statSync(path).size; }
    catch { return; }
    if (size < offset) { offset = 0; partial = ''; }
    if (size === offset) return;
    const fd = openSync(path, 'r');
    let chunk: Buffer;
    try {
      chunk = Buffer.alloc(size - offset);
      readSync(fd, chunk, 0, chunk.length, offset);
    }
    finally { closeSync(fd); }
    offset = size;
    const text = partial + chunk.toString('utf8');
    const lines = text.split('\n');
    partial = lines.pop() ?? '';
    const rows: WireRow[] = [];
    for (const line of lines) {
      if (line.trim() === '') continue;
      const parsed = parseWireLine(line);
      seq += 1;
      if (parsed === undefined) {
        rows.push({ seq, at: '', from: 'client', peer: '', kind: 'text', method: '', detail: line.slice(0, 120), frame: line });
        continue;
      }
      rows.push(describe(parsed, seq));
    }
    if (rows.length > 0) onRows(rows);
  };

  read();
  const timer = setInterval(read, options.interval ?? 250);
  timer.unref?.();
  let watcher: ReturnType<typeof watch> | undefined;
  try {
    watcher = watch(path, () => { read(); });
    watcher.unref?.();
    watcher.on('error', () => { watcher = undefined; });
  }
  catch { watcher = undefined; }
  return {
    close: () => {
      closed = true;
      clearInterval(timer);
      watcher?.close();
    },
  };
}

/** A row as one line of text, for a shell that is not a terminal. */
export const rowText = (row: WireRow): string => {
  const time = row.at.length >= 23 ? row.at.slice(11, 23) : row.at;
  const arrow = row.from === 'client' ? '->' : '<-';
  const what = row.kind === 'response' ? `${row.method} ok` : row.kind === 'error' ? `${row.method} error` : row.method;
  return [time, arrow, what || row.kind, row.type ?? '', row.channel ?? '', row.detail].filter((one) => one !== '').join('  ');
};
