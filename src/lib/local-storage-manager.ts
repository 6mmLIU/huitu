/**
 * LocalStorage_Manager — 本地存储管理器
 *
 * 管理 IR 和样式配置的浏览器 LocalStorage 持久化。
 * 包含数据格式版本字段，支持未来迁移。
 * 不进行服务端持久化存储。
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */

import type { SessionData } from '@/types/session';

/** LocalStorage key for PaperFlow session data */
export const STORAGE_KEY = 'paperflow_session';

/** Current data format version for migration support */
export const DATA_VERSION = '1.0';

/**
 * Save session data (IR + style config) to LocalStorage.
 * Gracefully handles SSR, disabled localStorage, or quota exceeded.
 */
export function saveSession(data: SessionData): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const payload = JSON.stringify(data);
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // localStorage may be full, disabled, or unavailable — fail silently
  }
}

/**
 * Load session data from LocalStorage.
 * Returns null if no data exists, data is corrupted, or localStorage is unavailable.
 */
export function loadSession(): SessionData | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: SessionData = JSON.parse(raw);
    // Basic shape validation
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.ir ||
      !parsed.styleConfig ||
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.version !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    // Corrupted JSON or other errors — return null
    return null;
  }
}

/**
 * Clear session data from LocalStorage.
 * Gracefully handles SSR or disabled localStorage.
 */
export function clearSession(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}
