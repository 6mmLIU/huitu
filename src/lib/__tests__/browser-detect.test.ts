import { describe, expect, it } from 'vitest';
import {
    MIN_BROWSER_VERSIONS,
    checkBrowserCompatibility,
    isBrowserSupported,
    parseBrowserInfo,
} from '../browser-detect';

// ---------------------------------------------------------------------------
// parseBrowserInfo
// ---------------------------------------------------------------------------
describe('parseBrowserInfo', () => {
  it('detects Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseBrowserInfo(ua)).toEqual({ name: 'Chrome', version: 120 });
  });

  it('detects Firefox', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0';
    expect(parseBrowserInfo(ua)).toEqual({ name: 'Firefox', version: 115 });
  });

  it('detects Safari', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
    expect(parseBrowserInfo(ua)).toEqual({ name: 'Safari', version: 17 });
  });

  it('detects Edge', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    expect(parseBrowserInfo(ua)).toEqual({ name: 'Edge', version: 120 });
  });

  it('returns null for empty string', () => {
    expect(parseBrowserInfo('')).toBeNull();
  });

  it('returns null for unrecognised UA', () => {
    expect(parseBrowserInfo('SomeRandomBot/1.0')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isBrowserSupported
// ---------------------------------------------------------------------------
describe('isBrowserSupported', () => {
  it('returns true for supported Chrome version', () => {
    expect(isBrowserSupported({ name: 'Chrome', version: 90 })).toBe(true);
    expect(isBrowserSupported({ name: 'Chrome', version: 120 })).toBe(true);
  });

  it('returns false for unsupported Chrome version', () => {
    expect(isBrowserSupported({ name: 'Chrome', version: 89 })).toBe(false);
  });

  it('returns true for supported Firefox version', () => {
    expect(isBrowserSupported({ name: 'Firefox', version: 90 })).toBe(true);
  });

  it('returns false for unsupported Firefox version', () => {
    expect(isBrowserSupported({ name: 'Firefox', version: 89 })).toBe(false);
  });

  it('returns true for supported Safari version', () => {
    expect(isBrowserSupported({ name: 'Safari', version: 15 })).toBe(true);
  });

  it('returns false for unsupported Safari version', () => {
    expect(isBrowserSupported({ name: 'Safari', version: 14 })).toBe(false);
  });

  it('returns true for supported Edge version', () => {
    expect(isBrowserSupported({ name: 'Edge', version: 90 })).toBe(true);
  });

  it('returns false for unsupported Edge version', () => {
    expect(isBrowserSupported({ name: 'Edge', version: 89 })).toBe(false);
  });

  it('returns false for unknown browser', () => {
    expect(isBrowserSupported({ name: 'Opera', version: 100 })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBrowserSupported(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkBrowserCompatibility
// ---------------------------------------------------------------------------
describe('checkBrowserCompatibility', () => {
  it('returns supported=true for a modern Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = checkBrowserCompatibility(ua);
    expect(result.supported).toBe(true);
    expect(result.browser).toEqual({ name: 'Chrome', version: 120 });
    expect(result.message).toBeUndefined();
  });

  it('returns upgrade message for old Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36';
    const result = checkBrowserCompatibility(ua);
    expect(result.supported).toBe(false);
    expect(result.message).toBe('请升级浏览器至最新版本');
  });

  it('returns upgrade message for old Safari', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15';
    const result = checkBrowserCompatibility(ua);
    expect(result.supported).toBe(false);
    expect(result.message).toBe('请升级浏览器至最新版本');
  });

  it('returns unsupported for unrecognised UA', () => {
    const result = checkBrowserCompatibility('UnknownBot/1.0');
    expect(result.supported).toBe(false);
    expect(result.browser).toBeNull();
    expect(result.message).toBe('请升级浏览器至最新版本');
  });

  it('handles empty UA gracefully', () => {
    const result = checkBrowserCompatibility('');
    expect(result.supported).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MIN_BROWSER_VERSIONS constant
// ---------------------------------------------------------------------------
describe('MIN_BROWSER_VERSIONS', () => {
  it('defines expected minimum versions', () => {
    expect(MIN_BROWSER_VERSIONS).toEqual({
      Chrome: 90,
      Firefox: 90,
      Safari: 15,
      Edge: 90,
    });
  });
});
