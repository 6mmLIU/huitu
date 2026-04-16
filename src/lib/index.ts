export { validateIR } from './ir-validator';
export type { ValidationResult } from './ir-validator';

export { DATA_VERSION, STORAGE_KEY, clearSession, loadSession, saveSession } from './local-storage-manager';

export { embedFontsInSVG, exportFlowchart, triggerDownload } from './export-service';
export type { ExportOptions } from './export-service';

export {
    ERROR_CODES,
    ERROR_MESSAGES,
    createErrorResponse,
    isErrorResponse
} from './error-handler';
export type { ErrorCode, ErrorDetail, ErrorResponse } from './error-handler';


export {
    MIN_BROWSER_VERSIONS,
    checkBrowserCompatibility,
    isBrowserSupported,
    parseBrowserInfo
} from './browser-detect';
export type { BrowserInfo, CompatibilityResult } from './browser-detect';

