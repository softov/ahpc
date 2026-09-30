/**
 * The languages this client ships, and which one a person reads.
 *
 * English is the default and the fallback: a key a translation has not caught
 * up with reads in English rather than as the key.
 */
export const LOCALES = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * The language to start in: the flag, then the config file, then the system.
 *
 * The system is asked the way gettext asks it - `LC_ALL`, `LC_MESSAGES`, then
 * `LANG` - and then `Intl`, which is what a machine with none of them set
 * still answers. The first that names a language this client ships wins; `C`
 * and `POSIX` name none, and one that is not shipped falls to English rather
 * than to the next variable, because it is still what the person chose.
 */
export function detectLocale(
  flag: string | undefined,
  configured: string | undefined,
  env: Record<string, string | undefined> = process.env,
  system: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().locale,
): Locale {
  for (const asked of [flag, configured, env.LC_ALL, env.LC_MESSAGES, env.LANG]) {
    if (asked === undefined || asked.trim() === '') continue;
    if (/^(C|POSIX)([._@].*)?$/i.test(asked.trim())) return 'en';
    return shipped(asked);
  }
  const fromIntl = system();
  return fromIntl ? shipped(fromIntl) : 'en';
}

/** `pt_BR.UTF-8`, `pt-br` and `pt` are `pt-BR`; `es_AR` is `es`; anything else is `en`. */
export function shipped(tag: string): Locale {
  const lang = (tag.trim().split(/[-_.@]/)[0] ?? '').toLowerCase();
  if (lang === 'pt') return 'pt-BR';
  if (lang === 'es') return 'es';
  return 'en';
}
