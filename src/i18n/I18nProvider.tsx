'use client';

import {
    createContext,
    useCallback,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { defaultLocale, getMessages, type Locale, type Messages } from './index';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

function resolveKey(messages: Messages, key: string): string {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = messages;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return key;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : key;
}

export interface I18nProviderProps {
  defaultLocale?: Locale;
  children: ReactNode;
}

export default function I18nProvider({
  defaultLocale: initialLocale = defaultLocale,
  children,
}: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (key: string): string => resolveKey(messages, key),
    [messages],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
