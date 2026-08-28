import { SessionFlag } from './types.js';
import type { SessionSummary } from './types.js';

/**
 * The status bitset, decoded once.
 *
 * `InputNeeded` is 24 and carries `InProgress` (8), so testing `InProgress`
 * first swallows it: a session blocked on a confirmation reads as merely
 * running, and the one state that wants a person is the one nobody sees.
 * Order matters here and nowhere else, which is why it is one function.
 */
export type Activity = 'input' | 'running' | 'error' | 'idle';

export interface Status {
  activity: Activity;
  archived: boolean;
  read: boolean;
  /** The word. Never the only carrier of the meaning. */
  label: string;
  /** The colour. Also never the only carrier. */
  tone: 'warning' | 'accent' | 'danger' | 'muted';
  /** The shape a 16-colour session, a piped log and a colourblind reader keep. */
  glyph: 'bulletHalf' | 'bulletFilled' | 'cross' | 'bulletHollow';
}

export function decodeStatus(status: number): Status {
  const archived = (status & SessionFlag.IsArchived) !== 0;
  const read = (status & SessionFlag.IsRead) !== 0;

  // Most specific first.
  const activity: Activity =
    (status & SessionFlag.InputNeeded) === SessionFlag.InputNeeded ? 'input'
      : (status & SessionFlag.InProgress) !== 0 ? 'running'
        : (status & SessionFlag.Error) !== 0 ? 'error'
          : 'idle';

  const shown = {
    input: { label: 'waiting on you', tone: 'warning', glyph: 'bulletHalf' },
    running: { label: 'running', tone: 'accent', glyph: 'bulletFilled' },
    error: { label: 'error', tone: 'danger', glyph: 'cross' },
    idle: { label: 'idle', tone: 'muted', glyph: 'bulletHollow' },
  } as const;

  return { activity, archived, read, ...shown[activity] };
}

/** Sessions worth answering first, then worth watching, then the rest. */
const RANK: Record<Activity, number> = { input: 0, running: 1, error: 2, idle: 3 };

export function byUrgency(a: SessionSummary, b: SessionSummary): number {
  const rank = RANK[decodeStatus(a.status).activity] - RANK[decodeStatus(b.status).activity];
  return rank !== 0 ? rank : b.modifiedAt.localeCompare(a.modifiedAt);
}
