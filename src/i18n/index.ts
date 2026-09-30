import type { Disposable, TextUIApp } from '@textui/core';
import type { Locale } from './locale.js';
import { commands as enCommands } from './en/commands.js';
import { screens as enScreens } from './en/screens.js';
import { views as enViews } from './en/views.js';
import { textui as enTextui } from './en/textui.js';
import { commands as ptCommands } from './pt-BR/commands.js';
import { screens as ptScreens } from './pt-BR/screens.js';
import { views as ptViews } from './pt-BR/views.js';
import { textui as ptTextui } from './pt-BR/textui.js';
import { commands as esCommands } from './es/commands.js';
import { screens as esScreens } from './es/screens.js';
import { views as esViews } from './es/views.js';
import { textui as esTextui } from './es/textui.js';

/**
 * Every message, by locale.
 *
 * One file per area and locale, so the commands, the screens and the views
 * are translated apart. `en` holds every key ahpc uses; a key missing from
 * another locale reads in English.
 */
export const MESSAGES: Record<Locale, Record<string, string>> = {
  en: { ...enCommands, ...enScreens, ...enViews, ...enTextui },
  'pt-BR': { ...ptCommands, ...ptScreens, ...ptViews, ...ptTextui },
  es: { ...esCommands, ...esScreens, ...esViews, ...esTextui },
};

/** Hand every locale's messages to the app, before anything asks for one. */
export function registerMessages(app: TextUIApp): Disposable[] {
  return (Object.keys(MESSAGES) as Locale[]).map((locale) => app.i18n.register({ locale, messages: MESSAGES[locale] }));
}
