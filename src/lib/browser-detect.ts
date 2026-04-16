/**
 * Browser compatibility detection utility.
 *
 * Supported browsers:
 *   Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
 *
 * When an unsupported browser is detected the module returns an upgrade
 * prompt message: "请升级浏览器至最新版本"
 */

export interface BrowserInfo {
  name: string;
  version: number;
}

export interface CompatibilityResult {
  supported: boolean;
  browser: BrowserInfo | null;
  message?: string;
}

/** Minimum supported browser versions. */
export const MIN_BROWSER_VERSIONS: Record<string, number> = {
  Chrome: 90,
  Firefox: 90,
  Safari: 15,
  Edge: 90,
};

const UPGRADE_MESSAGE = '请升级浏览器至最新版本';

/**
 * Parse a user-agent string and return the detected browser name + major version.
 * Returns `null` when the browser cannot be identified.
 */
export function parseBrowserInfo(ua: string): BrowserInfo | null {
  if (!ua) return null;

  // Order matters – Edge must be checked before Chrome because Edge UA
  // also contains "Chrome/…".
  const patterns: { name: string; regex: RegExp }[] = [
    { name: 'Edge', regex: /Edg(?:e|A|iOS)?\/(\d+)/ },
    { name: 'Firefox', regex: /Firefox\/(\d+)/ },
    { name: 'Safari', regex: /Version\/(\d+)(?:\.\d+)* Safari/ },
    { name: 'Chrome', regex: /Chrome\/(\d+)/ },
  ];

  for (const { name, regex } of patterns) {
    const match = ua.match(regex);
    if (match) {
      return { name, version: parseInt(match[1], 10) };
    }
  }

  return null;
}

/**
 * Check whether the given {@link BrowserInfo} meets the minimum version
 * requirements defined in {@link MIN_BROWSER_VERSIONS}.
 *
 * Unknown browsers are treated as unsupported.
 */
export function isBrowserSupported(info: BrowserInfo | null): boolean {
  if (!info) return false;
  const minVersion = MIN_BROWSER_VERSIONS[info.name];
  if (minVersion === undefined) return false;
  return info.version >= minVersion;
}

/**
 * High-level compatibility check.
 *
 * Parses the provided (or current) user-agent string, determines whether the
 * browser is supported, and returns a {@link CompatibilityResult}.
 *
 * @param ua – User-agent string. When omitted the function tries to read
 *   `navigator.userAgent` (browser environment only).
 */
export function checkBrowserCompatibility(ua?: string): CompatibilityResult {
  const userAgent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const browser = parseBrowserInfo(userAgent);
  const supported = isBrowserSupported(browser);

  return {
    supported,
    browser,
    ...(supported ? {} : { message: UPGRADE_MESSAGE }),
  };
}
