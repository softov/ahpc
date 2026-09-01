import { describe, expect, it } from 'vitest';
import { PRESETS, presetFor, scheduleProblem, zoneIsKnownHere } from '../src/schedule.js';

/*
 * Grammar, and deliberately not meaning.
 *
 * This exists for the moment of typing: the daemon keeps a definition whose
 * expression it could not read, and reports the problem to its own log, where
 * the person who made the typo will never see it. What is checked here is that
 * the sentence shown under the field is worth reading - "invalid" tells
 * somebody only that they are not finished.
 */

describe('an expression that is fine', () => {
  it.each([
    ['0 9 * * 1-5', 'weekdays at nine'],
    ['*/15 * * * *', 'a step'],
    ['0 0 1 * *', 'the first of the month'],
    ['30 9 * JAN SUN', 'names'],
    ['0 0 * * 7', 'the other Sunday'],
    ['1,3,8-10 * * * *', 'a list with a range in it'],
    ['0 0-23/2 * * *', 'a step on a range'],
  ])('takes %j - %s', (expression) => {
    expect(scheduleProblem(expression)).toBeUndefined();
  });
});

describe('an expression that is not', () => {
  it('says how many fields it found, not just that it is wrong', () => {
    expect(scheduleProblem('* * * *')).toContain('this has 4');
  });

  it('names the field and the value', () => {
    expect(scheduleProblem('60 * * * *')).toBe('60 is not a minute');
    expect(scheduleProblem('* 24 * * *')).toBe('24 is not a hour');
    expect(scheduleProblem('* * * * 8')).toBe('8 is not a day of week');
  });

  it('says what a step has to be', () => {
    expect(scheduleProblem('*/0 * * * *')).toContain('positive whole number');
  });

  it('says a range runs backwards rather than that it is invalid', () => {
    expect(scheduleProblem('5-1 * * * *')).toBe('5-1 runs backwards');
  });

  it('says what to write instead of a macro', () => {
    // The one mistake somebody arrives with from another scheduler, so it is
    // worth answering rather than rejecting.
    expect(scheduleProblem('@daily')).toContain('write the five fields out');
  });

  it('asks for five fields when there are none', () => {
    expect(scheduleProblem('   ')).toContain('five fields');
  });
});

describe('the zone', () => {
  it('knows the ones this machine has', () => {
    expect(zoneIsKnownHere('UTC')).toBe(true);
    expect(zoneIsKnownHere('America/Sao_Paulo')).toBe(true);
  });

  it('does not know a typo', () => {
    expect(zoneIsKnownHere('America/Sao Paulo')).toBe(false);
    expect(zoneIsKnownHere('')).toBe(false);
  });
});

describe('the common ones', () => {
  it('offers manual-only first, because it is a real choice', () => {
    expect(PRESETS[0]?.expression).toBe('');
  });

  it('offers expressions this same file accepts', () => {
    // A preset that does not parse would be a screen handing somebody a
    // schedule its own field then refuses.
    for (const preset of PRESETS) {
      if (preset.expression === '') continue;
      expect(scheduleProblem(preset.expression), preset.label).toBeUndefined();
    }
  });

  it('recognises one written out by hand', () => {
    // Matched on the expression, not remembered as a choice - so typing what a
    // preset would have written is still that preset.
    expect(presetFor('0 2 * * *')?.label).toBe('Every day at 02:00');
    expect(presetFor('  0 2 * * *  ')?.id).toBe('daily');
  });

  it('says nothing about an expression that is somebody own', () => {
    // The gloss is a label read off a known expression. An edited preset is
    // not one any more, and this screen will not put words in their mouth.
    expect(presetFor('0 2 * * 3')).toBeUndefined();
  });
});
