import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  automationFile, automationToBlueprint, isVsCodeFile, parseAutomationBlueprint, readAutomationFile,
  serializeAutomationBlueprint,
} from '../src/automation-file.js';

/*
 * The two automation files, against files ahpd wrote.
 *
 * `test/fixtures/automation.md` is what `ahpd automation export` writes, and
 * `automation-vscode.md` what `ahpd automation export --vscode` writes, for
 * the same automation. Both formats here are copies of ahpd's, so reading one
 * of its files and writing it back gives the same text.
 */

const OWN = readFileSync(new URL('fixtures/automation.md', import.meta.url), 'utf8');
const VSCODE = readFileSync(new URL('fixtures/automation-vscode.md', import.meta.url), 'utf8');

describe("ahpd's own file", () => {
  it('reads to the definition ahpd wrote', () => {
    const definition = readAutomationFile(OWN);
    expect(definition.title).toBe('Tidy the notes');
    expect(definition.message).toEqual({
      origin: { kind: 'automation' },
      text: 'Read every note in the folder.\n\nSort them by name, and say which ones are empty.',
    });
    expect(definition.session).toEqual({ provider: 'demo', model: { id: 'demo-fast' }, workingDirectories: ['file:///srv/demo'] });
    expect(definition.triggers).toEqual([
      { id: 't1', kind: 'schedule', schedule: { expression: '0 9 * * 1-5', timeZone: 'UTC' }, misfirePolicy: 'runOnce' },
    ]);
    expect(isVsCodeFile(definition)).toBe(false);
  });

  it('writes back the same text', () => {
    expect(automationFile(readAutomationFile(OWN))).toBe(OWN);
  });

  it('drops an owner, a time and an id the file names', () => {
    const named = OWN.replace('title: Tidy the notes', 'id: old\nowner: someone\ncreatedAt: 2026-01-01T00:00:00Z\ntitle: Tidy the notes');
    const definition = readAutomationFile(named);
    expect(definition).not.toHaveProperty('id');
    expect(definition).not.toHaveProperty('owner');
    expect(definition).not.toHaveProperty('createdAt');
  });

  it("tells VS Code's file, read as ahpd's, from ahpd's", () => {
    expect(isVsCodeFile(readAutomationFile(VSCODE))).toBe(true);
  });
});

describe("VS Code's file", () => {
  it('reads and writes back the same text', () => {
    const blueprint = parseAutomationBlueprint(VSCODE);
    expect(blueprint.name).toBe('Tidy the notes');
    expect(blueprint.schedule).toEqual({ interval: 'weekdays', scheduleHour: 9, scheduleMinute: 0, scheduleDay: 0 });
    expect(serializeAutomationBlueprint(blueprint)).toBe(VSCODE);
  });

  it("is what ahpd's own file becomes", () => {
    const definition = readAutomationFile(OWN);
    expect(serializeAutomationBlueprint(automationToBlueprint({ resource: 'ahp-automation:/tidy', definition }))).toBe(VSCODE);
  });

  it('refuses an automation with an event trigger', () => {
    const definition = { ...readAutomationFile(OWN), triggers: [{ id: 'e1', kind: 'event', type: 'session', events: [{ id: 'idle' }] }] };
    expect(() => automationToBlueprint({ resource: 'ahp-automation:/tidy', definition }))
      .toThrow('tidy has an event trigger, and a VS Code automation file holds only a schedule.');
  });
});
