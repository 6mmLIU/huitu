/**
 * Unit tests for LocalStorage_Manager
 *
 * Tests saveSession, loadSession, clearSession functions
 * with mocked localStorage (vitest runs in Node, not browser).
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */
import type { SessionData } from '@/types/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, clearSession, loadSession, saveSession } from '../local-storage-manager';

/** Helper: create a valid SessionData fixture */
function makeSessionData(): SessionData {
  return {
    ir: {
      version: '1.0',
      metadata: {
        createdAt: '2024-01-15T10:30:00Z',
        sourceLanguage: 'zh',
        chartType: 'sequential',
      },
      nodes: [
        { id: 'node_1', label: '开始', type: 'start' },
        { id: 'node_2', label: '结束', type: 'end' },
      ],
      edges: [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
      ],
      groups: [],
    },
    styleConfig: {
      fontFamily: { zh: 'SimSun', en: 'Times New Roman' },
      fontSize: 12,
      borderWidth: 1,
      borderColor: '#000000',
      fillColor: '#FFFFFF',
      arrowStyle: 'solid',
      lineStyle: 'orthogonal',
      colorScheme: 'monochrome',
    },
    timestamp: Date.now(),
    version: '1.0',
  };
}

describe('LocalStorage_Manager', () => {
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

  it('saveSession stores data as JSON under the correct key', () => {
    const data = makeSessionData();
    saveSession(data);

    const stored = store[STORAGE_KEY];
    expect(stored).toBeDefined();
    expect(JSON.parse(stored)).toEqual(data);
  });

  it('loadSession retrieves previously stored data', () => {
    const data = makeSessionData();
    saveSession(data);

    const loaded = loadSession();
    expect(loaded).toEqual(data);
  });

  it('loadSession returns null when no data exists', () => {
    expect(loadSession()).toBeNull();
  });

  it('loadSession returns null for corrupted JSON', () => {
    store[STORAGE_KEY] = '{not valid json!!!';
    expect(loadSession()).toBeNull();
  });

  it('loadSession returns null for data missing required fields', () => {
    store[STORAGE_KEY] = JSON.stringify({ ir: null, styleConfig: null });
    expect(loadSession()).toBeNull();
  });

  it('clearSession removes the stored data', () => {
    const data = makeSessionData();
    saveSession(data);
    expect(store[STORAGE_KEY]).toBeDefined();

    clearSession();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('loadSession returns null after clearSession', () => {
    saveSession(makeSessionData());
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('saveSession includes version field for future migration', () => {
    const data = makeSessionData();
    saveSession(data);

    const parsed = JSON.parse(store[STORAGE_KEY]);
    expect(parsed.version).toBe('1.0');
  });
});
