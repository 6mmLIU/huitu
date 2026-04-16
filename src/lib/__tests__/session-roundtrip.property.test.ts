/**
 * Feature: paperflow, Property 8: 会话持久化往返一致性
 *
 * Validates: Requirements 7.2, 7.3
 *
 * For any SessionData (IR + StyleConfig), calling saveSession followed by
 * loadSession should return data deeply equal to the original.
 */
import type { SessionData } from '@/types/session';
import type { StyleConfig } from '@/types/style';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, loadSession, saveSession } from '../local-storage-manager';
import { arbIR } from './arbitraries';

/** Arbitrary for StyleConfig */
const arbStyleConfig: fc.Arbitrary<StyleConfig> = fc.record({
  fontFamily: fc.record({
    zh: fc.constantFrom('SimSun', 'KaiTi', 'FangSong'),
    en: fc.constantFrom('Times New Roman', 'Arial', 'Helvetica'),
  }),
  fontSize: fc.integer({ min: 8, max: 72 }),
  borderWidth: fc.integer({ min: 1, max: 10 }),
  borderColor: fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 6, maxLength: 6 })
    .map((chars) => `#${chars.join('')}`),
  fillColor: fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 6, maxLength: 6 })
    .map((chars) => `#${chars.join('')}`),
  arrowStyle: fc.constant('solid' as const),
  lineStyle: fc.constant('orthogonal' as const),
  colorScheme: fc.constant('monochrome' as const),
});

/** Arbitrary for SessionData */
const arbSessionData: fc.Arbitrary<SessionData> = fc
  .tuple(arbIR, arbStyleConfig, fc.integer({ min: 0, max: 2_000_000_000_000 }))
  .map(([ir, styleConfig, timestamp]) => ({
    ir,
    styleConfig,
    timestamp,
    version: '1.0',
  }));

describe('Property 8: 会话持久化往返一致性', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
    };
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saveSession → loadSession roundtrip preserves SessionData equality', () => {
    fc.assert(
      fc.property(arbSessionData, (data) => {
        clearSession();
        saveSession(data);
        const loaded = loadSession();
        expect(loaded).toEqual(data);
      }),
      { numRuns: 100 },
    );
  });
});
