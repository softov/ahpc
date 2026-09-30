import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../src/i18n/index.js';

/*
 * The catalogues agree with each other and with the code.
 *
 * A key only in Portuguese is dead; one only in English reads in English to a
 * Portuguese reader, which is visible but still a gap. A placeholder that
 * differs between the two is a sentence that prints `{count}` literally.
 */

const own = (messages: Record<string, string>): string[] =>
  Object.keys(messages).filter((key) => !key.startsWith('textui.')).sort();

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the message catalogues', () => {
  for (const locale of ['pt-BR', 'es'] as const) {
    it(`${locale} has every key English has, and no other`, () => {
      expect(own(MESSAGES[locale])).toEqual(own(MESSAGES.en));
    });

    it(`${locale} keeps each message's placeholders`, () => {
      for (const [key, text] of Object.entries(MESSAGES[locale])) {
        const english = MESSAGES.en[key];
        if (english === undefined) continue;
        expect(placeholders(text), key).toEqual(placeholders(english));
      }
    });
  }

  it('translates the same textui chrome in every language it translates', () => {
    const textui = (messages: Record<string, string>): string[] =>
      Object.keys(messages).filter((key) => key.startsWith('textui.')).sort();
    expect(textui(MESSAGES.es)).toEqual(textui(MESSAGES['pt-BR']));
  });

  it('has an English message for every key the code asks for', () => {
    const asked = new Set<string>();
    for (const file of sources('src')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-z][\w.-]*)'/g)) asked.add(match[1] as string);
    }
    const missing = [...asked].filter((key) => !key.startsWith('textui.') && MESSAGES.en[key] === undefined);
    expect(missing).toEqual([]);
  });

  it('has no English message the code never asks for', () => {
    const text = sources('src').map((file) => readFileSync(file, 'utf8')).join('\n');
    const unused = own(MESSAGES.en).filter((key) => !text.includes(`'${key}'`) && !text.includes(`\`${key}`));
    expect(unused).toEqual([]);
  });
});
