import { describe, expect, it } from 'vitest';
import { detectLocale, shipped } from '../src/i18n/locale.js';

const none = () => undefined;

describe('the language ahpc starts in', () => {
  it('reads a tag the way people write one', () => {
    expect(shipped('pt-br')).toBe('pt-BR');
    expect(shipped('pt_BR.UTF-8')).toBe('pt-BR');
    expect(shipped('es_AR.UTF-8')).toBe('es');
    expect(shipped('fr_FR.UTF-8')).toBe('en');
  });

  it('takes the flag over the file, and the file over the system', () => {
    const env = { LANG: 'es_ES.UTF-8' };
    expect(detectLocale('pt-br', 'es', env, none)).toBe('pt-BR');
    expect(detectLocale(undefined, 'pt-br', env, none)).toBe('pt-BR');
    expect(detectLocale(undefined, undefined, env, none)).toBe('es');
  });

  it('asks LC_ALL, then LC_MESSAGES, then LANG', () => {
    expect(detectLocale(undefined, undefined, { LC_ALL: 'pt_BR.UTF-8', LANG: 'es_ES.UTF-8' }, none)).toBe('pt-BR');
    expect(detectLocale(undefined, undefined, { LC_MESSAGES: 'es_MX', LANG: 'pt_BR' }, none)).toBe('es');
    expect(detectLocale(undefined, undefined, { LC_ALL: '', LANG: 'es_ES' }, none)).toBe('es');
  });

  it('is English for C, for a language not shipped, and for nothing at all', () => {
    expect(detectLocale(undefined, undefined, { LANG: 'C.UTF-8' }, none)).toBe('en');
    expect(detectLocale(undefined, undefined, { LANG: 'POSIX' }, none)).toBe('en');
    expect(detectLocale(undefined, undefined, { LANG: 'de_DE.UTF-8' }, none)).toBe('en');
    expect(detectLocale(undefined, undefined, {}, none)).toBe('en');
  });

  it('falls to Intl when the environment says nothing', () => {
    expect(detectLocale(undefined, undefined, {}, () => 'pt-BR')).toBe('pt-BR');
  });
});
