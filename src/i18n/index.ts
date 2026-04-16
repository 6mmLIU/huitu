// PaperFlow internationalization (next-intl)
// zh/en language support

import enMessages from './en.json';
import zhMessages from './zh.json';

export type Locale = 'zh' | 'en';

export const supportedLocales: Locale[] = ['zh', 'en'];

export const defaultLocale: Locale = 'zh';

export type Messages = typeof zhMessages;

export { enMessages, zhMessages };

export function getMessages(locale: Locale): Messages {
  switch (locale) {
    case 'en':
      return enMessages;
    case 'zh':
    default:
      return zhMessages;
  }
}
