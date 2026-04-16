import { describe, expect, it } from 'vitest';
import enMessages from '../en.json';
import {
    defaultLocale,
    getMessages,
    enMessages as reExportedEn,
    supportedLocales,
    zhMessages,
} from '../index';
import zhMessagesRaw from '../zh.json';

// ---------------------------------------------------------------------------
// Helper: collect all leaf keys from a nested object using dot-notation
// ---------------------------------------------------------------------------
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

// ---------------------------------------------------------------------------
// Requirement 10.1 – zh/en language packs completeness
// ---------------------------------------------------------------------------
describe('i18n language packs (Req 10.1)', () => {
  const zhKeys = collectKeys(zhMessagesRaw);
  const enKeys = collectKeys(enMessages);

  it('zh.json and en.json have the same set of keys', () => {
    expect(zhKeys).toEqual(enKeys);
  });

  it('both packs contain all required key groups', () => {
    const requiredPrefixes = [
      'editor.',
      'style.',
      'canvas.',
      'common.',
      'error.',
      'browser.',
    ];
    for (const prefix of requiredPrefixes) {
      const zhHas = zhKeys.some((k) => k.startsWith(prefix));
      const enHas = enKeys.some((k) => k.startsWith(prefix));
      expect(zhHas).toBe(true);
      expect(enHas).toBe(true);
    }
  });

  it('all leaf values are non-empty strings', () => {
    for (const key of zhKeys) {
      const val = key.split('.').reduce((o: any, k) => o?.[k], zhMessagesRaw);
      expect(typeof val).toBe('string');
      expect((val as string).length).toBeGreaterThan(0);
    }
    for (const key of enKeys) {
      const val = key.split('.').reduce((o: any, k) => o?.[k], enMessages);
      expect(typeof val).toBe('string');
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it('contains specific required keys', () => {
    const required = [
      'editor.title',
      'editor.placeholder',
      'editor.generate',
      'editor.generating',
      'style.title',
      'style.zhFont',
      'style.enFont',
      'style.fontSize',
      'style.borderWidth',
      'style.fillColor',
      'style.borderColor',
      'canvas.title',
      'canvas.placeholder',
      'canvas.loading',
      'canvas.exportSVG',
      'canvas.exportPNG',
      'common.appName',
      'common.appDescription',
      'error.parseFailed',
      'error.networkError',
      'error.exportFailed',
      'error.retry',
      'browser.unsupported',
    ];
    for (const key of required) {
      expect(zhKeys).toContain(key);
      expect(enKeys).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// index.ts exports
// ---------------------------------------------------------------------------
describe('i18n index exports', () => {
  it('exports supportedLocales with zh and en', () => {
    expect(supportedLocales).toContain('zh');
    expect(supportedLocales).toContain('en');
  });

  it('exports defaultLocale as zh', () => {
    expect(defaultLocale).toBe('zh');
  });

  it('getMessages returns zh messages for zh locale', () => {
    expect(getMessages('zh')).toEqual(zhMessages);
  });

  it('getMessages returns en messages for en locale', () => {
    expect(getMessages('en')).toEqual(reExportedEn);
  });
});

// ---------------------------------------------------------------------------
// I18nProvider source-level checks
// ---------------------------------------------------------------------------
describe('I18nProvider module', () => {
  it('exports I18nProvider as default', async () => {
    const mod = await import('../I18nProvider');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('exports I18nContext', async () => {
    const mod = await import('../I18nProvider');
    expect(mod.I18nContext).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// useI18n hook module
// ---------------------------------------------------------------------------
describe('useI18n module', () => {
  it('exports useI18n as default', async () => {
    const mod = await import('../useI18n');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// resolveKey logic (tested indirectly via I18nProvider's t function)
// We test the getMessages + manual key resolution to verify dot-notation works
// ---------------------------------------------------------------------------
describe('dot-notation key resolution', () => {
  function resolve(messages: Record<string, any>, key: string): string {
    const parts = key.split('.');
    let current: any = messages;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return key;
      current = current[part];
    }
    return typeof current === 'string' ? current : key;
  }

  it('resolves nested keys correctly for zh', () => {
    const msgs = getMessages('zh');
    expect(resolve(msgs, 'editor.title')).toBe('PaperFlow 编辑器');
    expect(resolve(msgs, 'common.appName')).toBe('PaperFlow');
  });

  it('resolves nested keys correctly for en', () => {
    const msgs = getMessages('en');
    expect(resolve(msgs, 'editor.title')).toBe('PaperFlow Editor');
    expect(resolve(msgs, 'common.appName')).toBe('PaperFlow');
  });

  it('returns the key itself for missing keys', () => {
    const msgs = getMessages('zh');
    expect(resolve(msgs, 'nonexistent.key')).toBe('nonexistent.key');
  });
});
