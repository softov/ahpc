/**
 * An automation as a file: ahpd's own `.automation.md`, and VS Code's.
 *
 * `ahpc automation export` writes one and `ahpc automation import` reads one,
 * so a file moves between this client, `ahpd automation` and VS Code. Both
 * formats are copies of ahpd's, which keeps them in
 * `packages/server/src/records.ts` and `packages/server/src/scheduled.ts`
 * (its own) and `packages/server/src/blueprint.ts` (VS Code's). A change to
 * either format is a change to make there the same day. The fixtures in
 * `test/fixtures/automation*.md` are files ahpd wrote.
 *
 * ahpd's own file holds the whole definition: the fields as YAML frontmatter,
 * and the message's text as the body. VS Code's holds a name, a prompt and a
 * schedule, and VS Code refuses a file with any other key.
 */

import { parseYaml, stringifyYaml } from '@cofold/yaml';

type Bag = Record<string, unknown>;

const isRecord = (value: unknown): value is Bag =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bag = (value: unknown): Bag => (isRecord(value) ? value : {});

/* ahpd's own file. Copied from ahpd's `records.ts` and `scheduled.ts`. */

/** The line that opens and closes the frontmatter. */
const FENCE = '---';
/** The field the body of ahpd's file holds. */
const BODY = 'message.text';

/** One record as the text of its file: the fields as YAML, then the body field's text. */
function recordFile(record: Bag, body: string): string {
  const fields: Bag = { ...record };
  const held = fields[body];
  delete fields[body];
  if (held !== undefined && typeof held !== 'string') throw new Error(`the field ${body} is the body, so it is text`);
  const text = held ?? '';
  return `${FENCE}\n${stringifyYaml(fields)}${FENCE}\n${text === '' ? '' : `${text}\n`}`;
}

/** One record from the text of its file. Throws with what is wrong. */
function readRecordFile(text: string, body: string): Bag {
  const opened = /^---\r?\n/.exec(text);
  if (opened === null) throw new Error('it does not open with a --- line');
  const rest = text.slice(opened[0].length);
  const closed = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (closed === null) throw new Error('its frontmatter has no closing --- line');
  const fields = parseYaml(rest.slice(0, closed.index));
  if (!isRecord(fields)) throw new Error('its frontmatter is not a mapping of fields');
  const record: Bag = { ...fields };
  const below = rest.slice(closed.index + closed[0].length);
  record[body] = below.endsWith('\r\n') ? below.slice(0, -2) : below.endsWith('\n') ? below.slice(0, -1) : below;
  return record;
}

/**
 * One automation as the text of ahpd's file, as `ahpd automation export` writes it.
 *
 * The message's text is the body. Whatever else the message carries stays in
 * the frontmatter, and a message that is only its text is left out there.
 */
export function automationFile(definition: Bag): string {
  const fields: Bag = {};
  for (const [key, value] of Object.entries(definition)) {
    if (value !== undefined) fields[key] = value;
  }
  const message = bag(fields.message);
  const text = typeof message.text === 'string' ? message.text : '';
  const rest = { ...message };
  delete rest.text;
  if (Object.keys(rest).length === 0) delete fields.message;
  else fields.message = rest;
  fields[BODY] = text;
  return recordFile(fields, BODY);
}

/**
 * One automation's definition from the text of ahpd's file.
 *
 * The owner, the time it was made and any id the file names are dropped: the
 * host that imports it gives the new automation its own. Throws with what is
 * wrong.
 */
export function readAutomationFile(text: string): Bag {
  const { [BODY]: body, owner: _owner, createdAt: _createdAt, id: _id, ...definition } = readRecordFile(text, BODY);
  return { ...definition, message: { ...bag(definition.message), text: typeof body === 'string' ? body : '' } };
}

/** Whether ahpd's reading of a file found VS Code's file: a schedule and no triggers. */
export function isVsCodeFile(definition: Bag): boolean {
  return definition.schedule !== undefined && definition.triggers === undefined;
}

/** A definition without ahpd's note of the chat a pinned automation keeps, which is on its own host. */
export function unpinned(definition: Bag): Bag {
  const meta = bag(definition._meta);
  const ahpd = bag(meta.ahpd);
  if (ahpd.pinnedSession === undefined) return definition;
  const { pinnedSession: _pinned, ...rest } = ahpd;
  return { ...definition, _meta: { ...meta, ahpd: rest } };
}

/* VS Code's file. Copied from ahpd's `blueprint.ts`, which follows VS Code's `automationBlueprint.ts`. */

export const AUTOMATION_BLUEPRINT_FILE_SUFFIX = '.automation.md';
export const AUTOMATION_BLUEPRINT_VERSION = 1;

const AUTOMATION_BLUEPRINT_ID_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const AUTOMATION_BLUEPRINT_PROPERTIES = new Set(['version', 'id', 'name', 'description', 'schedule']);
const AUTOMATION_BLUEPRINT_MANUAL_SCHEDULE_PROPERTIES = new Set(['kind']);
const AUTOMATION_BLUEPRINT_HOURLY_SCHEDULE_PROPERTIES = new Set(['kind']);
const AUTOMATION_BLUEPRINT_CRON_SCHEDULE_PROPERTIES = new Set(['kind', 'expression', 'timeZone']);

/** The schedules a blueprint holds, as VS Code's editor names them. */
export type AutomationInterval = 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly';

/** When a blueprint runs, in the importer's own time zone. */
export interface AutomationSchedule {
  readonly interval: AutomationInterval;
  /** Hour of the day, 0-23. Ignored for `manual` and `hourly`. */
  readonly scheduleHour: number;
  /** Minute of the hour, 0-59. Ignored for `manual` and `hourly`. */
  readonly scheduleMinute: number;
  /** Day of the week, 0 (Sunday) through 6 (Saturday). Only used for `weekly`. */
  readonly scheduleDay: number;
}

/** A portable automation definition, without a target or any run state. */
export interface AutomationBlueprint {
  readonly version: typeof AUTOMATION_BLUEPRINT_VERSION;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly prompt: string;
  readonly schedule: AutomationSchedule;
}

export type AutomationBlueprintParseErrorCode =
  | 'invalidFrontmatter'
  | 'unknownProperty'
  | 'invalidField'
  | 'unsupportedVersion'
  | 'invalidId'
  | 'unsupportedSchedule'
  | 'unsupportedTimeZone'
  | 'missingPrompt';

/** The sentence VS Code shows for each refusal of a file. */
const parseErrorMessage = (code: AutomationBlueprintParseErrorCode, property = ''): string => {
  switch (code) {
    case 'invalidFrontmatter': return 'The file must start with valid YAML frontmatter.';
    case 'unknownProperty': return `The property '${property}' is not supported.`;
    case 'invalidField': return `The property '${property}' is missing or invalid.`;
    case 'unsupportedVersion': return `Automation blueprint version ${property} is not supported.`;
    case 'invalidId': return `The blueprint id '${property}' is invalid.`;
    case 'unsupportedSchedule': return `The cron expression '${property}' cannot be represented by the current Automation editor.`;
    case 'unsupportedTimeZone': return `The time zone '${property}' is not supported. Use 'local' so the schedule follows the importing user's time zone.`;
    case 'missingPrompt': return 'The Automation prompt must follow the frontmatter.';
  }
};

/** A file the format refuses, with VS Code's code and its sentence. */
export class AutomationBlueprintParseError extends Error {
  readonly code: AutomationBlueprintParseErrorCode;
  readonly property: string | undefined;

  constructor(code: AutomationBlueprintParseErrorCode, property?: string) {
    super(parseErrorMessage(code, property));
    this.code = code;
    this.property = property;
  }
}

/** The zone a blueprint's `local` means here, as VS Code reads it. */
export const localTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** One blueprint from the text of its file. Throws `AutomationBlueprintParseError`. */
export function parseAutomationBlueprint(content: string): AutomationBlueprint {
  const { header, body } = parseFrontMatter(content);

  assertKnownProperties(header, AUTOMATION_BLUEPRINT_PROPERTIES);
  const version = readRequiredInteger(header, 'version');
  if (version !== AUTOMATION_BLUEPRINT_VERSION) {
    throw new AutomationBlueprintParseError('unsupportedVersion', String(version));
  }

  const id = readRequiredString(header, 'id');
  if (id.length > 64 || !AUTOMATION_BLUEPRINT_ID_PATTERN.test(id)) {
    throw new AutomationBlueprintParseError('invalidId', id);
  }

  const name = readRequiredString(header, 'name');
  const description = readOptionalString(header, 'description');
  const schedule = readSchedule(header);
  const prompt = body.trim();
  if (!prompt) {
    throw new AutomationBlueprintParseError('missingPrompt');
  }

  return {
    version: AUTOMATION_BLUEPRINT_VERSION,
    id,
    name,
    ...(description ? { description } : {}),
    prompt,
    schedule,
  };
}

/** One blueprint as the text of its file, exactly as VS Code writes it. */
export function serializeAutomationBlueprint(blueprint: AutomationBlueprint): string {
  const lines = [
    '---',
    `version: ${String(AUTOMATION_BLUEPRINT_VERSION)}`,
    `id: ${quoteYamlString(blueprint.id)}`,
    `name: ${quoteYamlString(blueprint.name)}`,
  ];
  if (blueprint.description) {
    lines.push(`description: ${quoteYamlString(blueprint.description)}`);
  }
  lines.push('schedule:');
  switch (blueprint.schedule.interval) {
    case 'manual':
      lines.push('  kind: manual');
      break;
    case 'hourly':
      lines.push('  kind: hourly');
      break;
    case 'daily':
    case 'weekdays':
    case 'weekly':
      lines.push(
        '  kind: cron',
        `  expression: ${quoteYamlString(toCronExpression(blueprint.schedule))}`,
        '  timeZone: local',
      );
      break;
  }
  lines.push('---', '', blueprint.prompt.trim(), '');
  return lines.join('\n');
}

/**
 * One automation as a blueprint, or a refusal that says what the format cannot
 * hold.
 *
 * The name is the title and the id is made from it, as VS Code's export does.
 * The folder, the provider and whether it is on are left out: a blueprint has
 * no target. The schedule keeps its hour and minute and drops its zone.
 */
export function automationToBlueprint(automation: { resource: string; definition: Bag }): AutomationBlueprint {
  const named = automation.resource.replace(/^ahp-automation:\//u, '');
  const definition = bag(automation.definition);
  const title = typeof definition.title === 'string' ? definition.title.trim() : '';
  const name = title || named;
  const text = bag(definition.message).text;
  const prompt = typeof text === 'string' ? text.trim() : '';
  if (!prompt) throw new Error(`${named} has no message, and a VS Code automation file needs one.`);
  return {
    version: AUTOMATION_BLUEPRINT_VERSION,
    id: createAutomationBlueprintId(name),
    name,
    prompt,
    schedule: projectSchedule(named, definition.triggers),
  };
}

/** The file name VS Code gives an automation's blueprint. */
export function createAutomationBlueprintFileName(name: string): string {
  return `${createAutomationBlueprintId(name)}${AUTOMATION_BLUEPRINT_FILE_SUFFIX}`;
}

/**
 * The triggers a blueprint's schedule becomes, as VS Code's agent host store
 * writes them: none for `manual`, and one schedule in `zone` otherwise.
 */
export function scheduleTrigger(schedule: AutomationSchedule, zone: string = localTimeZone()): Bag[] {
  if (schedule.interval === 'manual') return [];
  const expression = schedule.interval === 'hourly' ? `${String(schedule.scheduleMinute)} * * * *` : toCronExpression(schedule);
  return [{
    id: 'schedule',
    kind: 'schedule',
    schedule: { expression, timeZone: zone },
    misfirePolicy: 'runOnce',
  }];
}

function createAutomationBlueprintId(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/--+|\.\.+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, 64)
    .replace(/[^a-z0-9]+$/g, '');
  return normalized || 'automation';
}

/**
 * An automation's triggers as a blueprint schedule, refused where the format
 * cannot hold them: one schedule or none, that runs on the hour, daily, on
 * weekdays or weekly, and catches a missed run up.
 */
function projectSchedule(named: string, raw: unknown): AutomationSchedule {
  const triggers = Array.isArray(raw) ? raw.map((one) => bag(one)) : [];
  if (triggers.some((trigger) => trigger.kind !== 'schedule')) {
    throw new Error(`${named} has an event trigger, and a VS Code automation file holds only a schedule.`);
  }
  if (triggers.length > 1) {
    throw new Error(`${named} has more than one schedule, and a VS Code automation file holds one.`);
  }
  const trigger = triggers[0];
  if (trigger === undefined) return { interval: 'manual', scheduleHour: 0, scheduleMinute: 0, scheduleDay: 0 };
  const held = bag(trigger.schedule);
  if (trigger.misfirePolicy === 'skip') {
    throw new Error(`${named} skips a missed run, and a VS Code automation file always catches one up.`);
  }
  const expression = typeof held.expression === 'string' ? held.expression.trim() : '';
  const refused = (): never => {
    throw new Error(`${named} runs on "${expression}", and a VS Code automation file holds only hourly, daily, weekday and weekly schedules.`);
  };
  const [minuteValue, hourValue, dayOfMonth, month, dayValue, ...remaining] = expression.split(/\s+/);
  if (remaining.length > 0 || dayOfMonth !== '*' || month !== '*') return refused();
  const scheduleMinute = parseCronValue(minuteValue, 0, 59) ?? refused();
  if (hourValue === '*' && dayValue === '*') {
    if (scheduleMinute !== 0) {
      throw new Error(`${named} runs at minute ${String(scheduleMinute)} of each hour, and a VS Code automation file runs hourly on the hour.`);
    }
    return { interval: 'hourly', scheduleHour: 0, scheduleMinute: 0, scheduleDay: 0 };
  }
  const scheduleHour = parseCronValue(hourValue, 0, 23) ?? refused();
  if (dayValue === '*') return { interval: 'daily', scheduleHour, scheduleMinute, scheduleDay: 0 };
  if (dayValue === '1-5' || dayValue?.toUpperCase() === 'MON-FRI' || dayValue === '1,2,3,4,5') {
    return { interval: 'weekdays', scheduleHour, scheduleMinute, scheduleDay: 0 };
  }
  const scheduleDay = parseCronValue(dayValue, 0, 7) ?? refused();
  return { interval: 'weekly', scheduleHour, scheduleMinute, scheduleDay: scheduleDay === 7 ? 0 : scheduleDay };
}

/** The frontmatter as a mapping, and the text below it. Every scalar is read as its text, as VS Code reads it. */
function parseFrontMatter(content: string): { header: Bag; body: string } {
  const opened = /^---[ \t]*\r?\n/.exec(content);
  if (opened === null) throw new AutomationBlueprintParseError('invalidFrontmatter');
  const rest = content.slice(opened[0].length);
  const closed = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (closed === null) throw new AutomationBlueprintParseError('invalidFrontmatter');
  let header: unknown;
  try {
    header = parseYaml(rest.slice(0, closed.index));
  }
  catch {
    throw new AutomationBlueprintParseError('invalidFrontmatter');
  }
  if (!isRecord(header)) throw new AutomationBlueprintParseError('invalidFrontmatter');
  return { header, body: rest.slice(closed.index + closed[0].length) };
}

function readSchedule(root: Bag): AutomationSchedule {
  const node = root.schedule;
  if (!isRecord(node)) {
    throw new AutomationBlueprintParseError('invalidField', 'schedule');
  }

  const kind = readRequiredString(node, 'kind');
  if (kind === 'manual') {
    assertKnownProperties(node, AUTOMATION_BLUEPRINT_MANUAL_SCHEDULE_PROPERTIES, 'schedule.');
    return { interval: 'manual', scheduleHour: 0, scheduleMinute: 0, scheduleDay: 0 };
  }
  if (kind === 'hourly') {
    assertKnownProperties(node, AUTOMATION_BLUEPRINT_HOURLY_SCHEDULE_PROPERTIES, 'schedule.');
    return { interval: 'hourly', scheduleHour: 0, scheduleMinute: 0, scheduleDay: 0 };
  }
  if (kind !== 'cron') {
    throw new AutomationBlueprintParseError('invalidField', 'schedule.kind');
  }

  assertKnownProperties(node, AUTOMATION_BLUEPRINT_CRON_SCHEDULE_PROPERTIES, 'schedule.');
  const expression = readRequiredString(node, 'expression');
  const timeZone = readRequiredString(node, 'timeZone');
  if (timeZone !== 'local') {
    throw new AutomationBlueprintParseError('unsupportedTimeZone', timeZone);
  }
  return fromCronExpression(expression);
}

function toCronExpression(schedule: AutomationSchedule): string {
  switch (schedule.interval) {
    case 'manual':
      throw new Error('Manual Automation schedules do not have cron expressions.');
    case 'hourly':
      throw new Error('Hourly Automation schedules do not have cron expressions.');
    case 'daily':
      return `${String(schedule.scheduleMinute)} ${String(schedule.scheduleHour)} * * *`;
    case 'weekdays':
      return `${String(schedule.scheduleMinute)} ${String(schedule.scheduleHour)} * * 1-5`;
    case 'weekly':
      return `${String(schedule.scheduleMinute)} ${String(schedule.scheduleHour)} * * ${String(schedule.scheduleDay)}`;
  }
}

function fromCronExpression(expression: string): AutomationSchedule {
  const [minuteValue, hourValue, dayOfMonth, month, dayValue, ...remaining] = expression.trim().split(/\s+/);
  if (remaining.length > 0 || dayOfMonth !== '*' || month !== '*') {
    throw new AutomationBlueprintParseError('unsupportedSchedule', expression);
  }
  const scheduleMinute = parseCronValue(minuteValue, 0, 59);
  if (scheduleMinute === undefined) {
    throw new AutomationBlueprintParseError('unsupportedSchedule', expression);
  }
  const scheduleHour = parseCronValue(hourValue, 0, 23);
  if (scheduleHour === undefined) {
    throw new AutomationBlueprintParseError('unsupportedSchedule', expression);
  }
  if (dayValue === '*') {
    return { interval: 'daily', scheduleHour, scheduleMinute, scheduleDay: 0 };
  }
  if (dayValue === '1-5') {
    return { interval: 'weekdays', scheduleHour, scheduleMinute, scheduleDay: 0 };
  }
  const scheduleDay = parseCronValue(dayValue, 0, 7);
  if (scheduleDay === undefined) {
    throw new AutomationBlueprintParseError('unsupportedSchedule', expression);
  }
  return { interval: 'weekly', scheduleHour, scheduleMinute, scheduleDay: scheduleDay === 7 ? 0 : scheduleDay };
}

function parseCronValue(value: string | undefined, minimum: number, maximum: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function assertKnownProperties(node: Bag, known: ReadonlySet<string>, prefix = ''): void {
  const unknown = Object.keys(node).find((key) => !known.has(key));
  if (unknown !== undefined) {
    throw new AutomationBlueprintParseError('unknownProperty', `${prefix}${unknown}`);
  }
}

/** A scalar's text, as VS Code's YAML reads every scalar; nothing for a mapping or a list. */
function scalarOf(value: unknown): string | undefined {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function readRequiredString(node: Bag, name: string): string {
  const value = readOptionalString(node, name);
  if (!value) {
    throw new AutomationBlueprintParseError('invalidField', name);
  }
  return value;
}

function readOptionalString(node: Bag, name: string): string | undefined {
  if (!(name in node)) {
    return undefined;
  }
  const value = scalarOf(node[name]);
  if (value === undefined) {
    throw new AutomationBlueprintParseError('invalidField', name);
  }
  return value.trim();
}

function readRequiredInteger(node: Bag, name: string): number {
  const value = name in node ? scalarOf(node[name]) : undefined;
  if (value === undefined || !/^-?\d+$/.test(value)) {
    throw new AutomationBlueprintParseError('invalidField', name);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AutomationBlueprintParseError('invalidField', name);
  }
  return parsed;
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}
