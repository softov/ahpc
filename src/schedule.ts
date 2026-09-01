/** The protocol's five-field cron, checked for grammar and nothing else. */

/**
 * Why this is here at all, and why it stops where it does.
 *
 * A schedule is protocol-defined - five whitespace-separated fields, minute
 * through day-of-week, with names for months and weekdays - so checking one is
 * reading the protocol rather than knowing anything about a particular host.
 * That is the line this client does not cross, and this stays on the right
 * side of it.
 *
 * It checks **grammar, not meaning**. It will not tell you when an expression
 * next comes round, because that is the host's answer: the host evaluates the
 * expression, in the zone, against its own clock, and says so by sending back
 * `nextRunAt`. A client that computed its own would be a second answer to a
 * question somebody is going to be woken up by.
 *
 * What it is for is the moment of typing. The daemon keeps a definition whose
 * expression it could not read - losing the whole thing over a typo helps
 * nobody - and reports the problem to its own log, where the person who made
 * the typo will never see it. Without this, a mistyped schedule is silence
 * until the morning it does not run.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface Field {
  name: string;
  min: number;
  max: number;
  names?: string[];
}

const FIELDS: Field[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: MONTHS },
  // 0 and 7 both mean Sunday, which is what the protocol says and what every
  // crontab accepts.
  { name: 'day of week', min: 0, max: 7, names: DAYS },
];

/** One value, by number or by name. Undefined when it is neither. */
function valueOf(text: string, field: Field): number | undefined {
  const named = field.names?.indexOf(text.toLowerCase()) ?? -1;
  if (named >= 0) return named + (field.names === MONTHS ? 1 : 0);
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value < field.min || value > field.max ? undefined : value;
}

/** What is wrong with one field, or nothing. */
function checkField(text: string, field: Field): string | undefined {
  for (const term of text.split(',')) {
    if (term === '') return `${field.name} has an empty entry`;
    const parts = term.split('/');
    if (parts.length > 2) return `${term} has more than one step`;
    const [range, step] = parts as [string, string | undefined];
    if (step !== undefined && (!/^\d+$/.test(step) || Number(step) === 0)) {
      return `${step} is not a step - a step must be a positive whole number`;
    }
    if (range === '*') continue;
    if (range.includes('-')) {
      const ends = range.split('-');
      if (ends.length > 2) return `${range} is not a range`;
      const [a, b] = ends as [string, string];
      const from = valueOf(a, field);
      const to = valueOf(b, field);
      if (from === undefined) return `${a} is not a ${field.name}`;
      if (to === undefined) return `${b} is not a ${field.name}`;
      if (to < from) return `${range} runs backwards`;
      continue;
    }
    if (valueOf(range, field) === undefined) return `${range} is not a ${field.name}`;
  }
  return undefined;
}

/**
 * What is wrong with an expression, in a sentence, or nothing.
 *
 * A sentence rather than a boolean because it is shown under the field being
 * typed into, and "invalid" tells somebody only that they are not finished.
 */
export function scheduleProblem(expression: string): string | undefined {
  const trimmed = expression.trim();
  if (trimmed === '') return 'A schedule needs five fields, like 0 9 * * 1-5';
  if (trimmed.startsWith('@')) return 'AHP has no @daily or @hourly - write the five fields out';
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    return `A schedule has five fields - minute, hour, day, month, weekday - and this has ${fields.length}`;
  }
  for (let at = 0; at < FIELDS.length; at++) {
    const problem = checkField(fields[at] as string, FIELDS[at] as Field);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

/**
 * Whether a zone is one this machine knows.
 *
 * Asked of `Intl`, which is the only thing here that holds a tz database, and
 * asked by trying it: there is no list to check against. A zone this client
 * does not know may still be one the host knows, so this is a warning about a
 * likely typo rather than a refusal - which is why it is separate from
 * `scheduleProblem` and reads as a question.
 */
export function zoneIsKnownHere(timeZone: string): boolean {
  if (timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  }
  catch { return false; }
}
