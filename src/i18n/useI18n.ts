'use client';

import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nProvider';

export default function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (context === null) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
