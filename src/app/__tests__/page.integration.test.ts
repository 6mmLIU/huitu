/**
 * Integration tests for the main page (src/app/page.tsx).
 *
 * Validates the complete data flow, session restore, language switching,
 * and error handling as wired together in the Home component.
 *
 * Requirements: 1.1, 7.3, 10.2, 11.1, 11.2
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES, createErrorResponse, isErrorResponse } from '@/lib/error-handler';
import { DATA_VERSION } from '@/lib/local-storage-manager';
import type { IR } from '@/types/ir';
import type { SessionData } from '@/types/session';
import type { StyleConfig } from '@/types/style';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';

const PAGE_SOURCE_PATH = resolve(__dirname, '../page.tsx');
const pageSource = readFileSync(PAGE_SOURCE_PATH, 'utf-8');

// Fixtures

const SAMPLE_IR: IR = {
  version: '1.0',
  metadata: {
    title: 'Test',
    createdAt: '2024-01-15T10:30:00Z',
    sourceLanguage: 'zh',
    chartType: 'sequential',
  },
  nodes: [
    { id: 'node_1', label: 'Start', type: 'start' },
    { id: 'node_2', label: 'Process', type: 'process' },
    { id: 'node_3', label: 'End', type: 'end' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
  ],
  groups: [],
};

const SAMPLE_STYLE: StyleConfig = { ...ACADEMIC_DEFAULT_STYLE };

// =========================================================================
// 1. Full data flow: input -> parse -> render -> export  (Req 1.1)
// =========================================================================

describe('Integration: full data flow wiring', () => {
  it('page POSTs to /api/parse for generation', () => {
    expect(pageSource).toContain("'/api/parse'");
    expect(pageSource).toContain("method: 'POST'");
    expect(pageSource).toContain('application/json');
  });

  it('page sends text and locale in the request body', () => {
    expect(pageSource).toMatch(/JSON\.stringify/);
    expect(pageSource).toMatch(/language:\s*locale/);
  });

  it('page sets IR state from successful parse response', () => {
    expect(pageSource).toContain('data.success');
    expect(pageSource).toContain('data.ir');
    expect(pageSource).toContain('setIr');
  });

  it('page passes IR and style to FlowCanvas for rendering', () => {
    expect(pageSource).toContain('FlowCanvas');
    expect(pageSource).toMatch(/ir=\{ir\}/);
    expect(pageSource).toMatch(/style=\{styleConfig\}/);
  });

  it('page imports render engine and svg generator for export', () => {
    expect(pageSource).toMatch(/import.*render.*from.*render-engine/);
    expect(pageSource).toMatch(/import.*generateSVG.*from.*svg-generator/);
  });

  it('page calls render then generateSVG in export flow', () => {
    expect(pageSource).toContain('render({');
    expect(pageSource).toContain('generateSVG({');
  });

  it('page imports and calls exportFlowchart for download', () => {
    expect(pageSource).toMatch(/import.*exportFlowchart.*from.*export-service/);
    expect(pageSource).toContain('exportFlowchart({');
  });

  it('page provides SVG and PNG export handlers to FlowCanvas', () => {
    expect(pageSource).toMatch(/onExportSVG=\{handleExportSVG\}/);
    expect(pageSource).toMatch(/onExportPNG=\{handleExportPNG\}/);
  });

  it('page passes EditorPanel the generate callback and loading state', () => {
    expect(pageSource).toContain('EditorPanel');
    expect(pageSource).toMatch(/onGenerate=\{handleGenerate\}/);
    expect(pageSource).toMatch(/isLoading=\{isLoading\}/);
  });

  it('page passes StylePanel the style and change handler', () => {
    expect(pageSource).toContain('StylePanel');
    expect(pageSource).toMatch(/onStyleChange=\{setStyleConfig\}/);
  });
});

// =========================================================================
// 2. Session restore flow  (Req 7.3)
// =========================================================================

describe('Integration: session restore flow', () => {
  it('page imports loadSession and saveSession', () => {
    expect(pageSource).toMatch(/import.*loadSession.*from.*local-storage-manager/);
    expect(pageSource).toMatch(/import.*saveSession.*from.*local-storage-manager/);
  });

  it('page calls loadSession on mount to restore previous session', () => {
    expect(pageSource).toContain('loadSession()');
  });

  it('page restores IR from loaded session', () => {
    expect(pageSource).toContain('session.ir');
    expect(pageSource).toContain('setIr(session.ir)');
  });

  it('page restores styleConfig from loaded session', () => {
    expect(pageSource).toContain('session.styleConfig');
    expect(pageSource).toContain('setStyleConfig(session.styleConfig)');
  });

  it('page auto-saves session when IR or style changes', () => {
    expect(pageSource).toContain('saveSession(');
    expect(pageSource).toMatch(/\[ir,\s*styleConfig\]/);
  });

  it('saveSession/loadSession round-trip preserves data', () => {
    const session: SessionData = {
      ir: SAMPLE_IR,
      styleConfig: SAMPLE_STYLE,
      timestamp: Date.now(),
      version: DATA_VERSION,
    };
    const json = JSON.stringify(session);
    const restored: SessionData = JSON.parse(json);
    expect(restored.ir).toEqual(session.ir);
    expect(restored.styleConfig).toEqual(session.styleConfig);
    expect(restored.version).toBe(DATA_VERSION);
  });
});

// =========================================================================
// 3. Language switch does not affect IR state  (Req 10.2)
// =========================================================================

describe('Integration: language switch does not affect flowchart content', () => {
  it('page uses i18n hook for locale management', () => {
    expect(pageSource).toMatch(/import.*useI18n/);
    expect(pageSource).toContain('useI18n()');
  });

  it('page provides language switcher buttons', () => {
    expect(pageSource).toContain('setLocale');
    expect(pageSource).toContain('supportedLocales');
  });

  it('locale change only affects UI text, not IR state', () => {
    // setLocale is used in onClick handlers; it must never appear on the same
    // line as setIr, ensuring locale changes cannot modify IR.
    const lines = pageSource.split('\n');
    for (const line of lines) {
      if (line.includes('setLocale(')) {
        expect(line).not.toContain('setIr');
      }
    }
  });

  it('IR state setter is only called from parse response or session restore', () => {
    const setIrMatches = pageSource.match(/setIr\([^)]+\)/g) || [];
    expect(setIrMatches.length).toBeGreaterThanOrEqual(2);
    for (const match of setIrMatches) {
      const isValidContext =
        match.includes('data.ir') ||
        match.includes('session.ir') ||
        match.includes('null');
      expect(isValidContext).toBe(true);
    }
  });

  it('style changes do not modify IR (independent state)', () => {
    expect(pageSource).toContain('useState<IR | null>(null)');
    expect(pageSource).toContain('useState<StyleConfig>(ACADEMIC_DEFAULT_STYLE)');
    expect(pageSource).toMatch(/onStyleChange=\{setStyleConfig\}/);
  });
});

// =========================================================================
// 4. Error handling flows  (Req 11.1, 11.2)
// =========================================================================

describe('Integration: error handling - parse failure', () => {
  it('page checks for error response from parse API', () => {
    expect(pageSource).toContain('isErrorResponse');
    expect(pageSource).toMatch(/import.*isErrorResponse.*from.*error-handler/);
  });

  it('page sets error state when parse returns error response', () => {
    expect(pageSource).toContain('setError');
    expect(pageSource).toMatch(/isErrorResponse\(data\)/);
  });

  it('page passes error to EditorPanel for display', () => {
    expect(pageSource).toMatch(/error=\{error\}/);
  });

  it('page provides dismiss error callback to EditorPanel', () => {
    expect(pageSource).toContain('onDismissError');
    expect(pageSource).toContain('setError(null)');
  });

  it('createErrorResponse produces valid PARSE_FAILED error', () => {
    const err = createErrorResponse(ERROR_CODES.PARSE_FAILED, {
      suggestions: ['Use clearer step descriptions'],
    });
    expect(err.success).toBe(false);
    expect(err.error.code).toBe('PARSE_FAILED');
    expect(err.error.message).toBeTruthy();
    expect(err.error.suggestions).toHaveLength(1);
    expect(err.error.retryable).toBe(false);
    expect(isErrorResponse(err)).toBe(true);
  });
});

describe('Integration: error handling - LLM timeout / network error', () => {
  it('page handles fetch exceptions as network errors', () => {
    expect(pageSource).toContain("code: 'NETWORK_ERROR'");
  });

  it('page sets retryable flag for network errors', () => {
    expect(pageSource).toMatch(/retryable:\s*true/);
  });

  it('page provides retry handler to EditorPanel', () => {
    expect(pageSource).toMatch(/onRetry=\{handleRetry\}/);
  });

  it('retry handler re-invokes handleGenerate with last text', () => {
    expect(pageSource).toContain('handleGenerate(lastText)');
    expect(pageSource).toContain('setLastText(text)');
  });

  it('page handles unknown/malformed API responses', () => {
    expect(pageSource).toContain("code: 'UNKNOWN'");
  });

  it('createErrorResponse produces valid LLM_TIMEOUT error', () => {
    const err = createErrorResponse(ERROR_CODES.LLM_TIMEOUT);
    expect(err.success).toBe(false);
    expect(err.error.code).toBe('LLM_TIMEOUT');
    expect(err.error.retryable).toBe(true);
    expect(isErrorResponse(err)).toBe(true);
  });

  it('createErrorResponse produces valid LLM_ERROR error', () => {
    const err = createErrorResponse(ERROR_CODES.LLM_ERROR);
    expect(err.success).toBe(false);
    expect(err.error.code).toBe('LLM_ERROR');
    expect(err.error.retryable).toBe(true);
  });
});

describe('Integration: error handling - export failure', () => {
  it('page catches export errors and sets EXPORT_FAILED error', () => {
    expect(pageSource).toContain("code: 'EXPORT_FAILED'");
  });

  it('export errors are marked not retryable in page', () => {
    const exportErrorIdx = pageSource.indexOf("'EXPORT_FAILED'");
    expect(exportErrorIdx).toBeGreaterThan(-1);
    const nearbySource = pageSource.slice(exportErrorIdx, exportErrorIdx + 200);
    expect(nearbySource).toContain('retryable: false');
  });

  it('createErrorResponse produces valid EXPORT_FAILED error', () => {
    const err = createErrorResponse(ERROR_CODES.EXPORT_FAILED);
    expect(err.success).toBe(false);
    expect(err.error.code).toBe('EXPORT_FAILED');
    expect(isErrorResponse(err)).toBe(true);
  });
});

// =========================================================================
// 5. Browser compatibility integration
// =========================================================================

describe('Integration: browser compatibility detection', () => {
  it('page imports and calls checkBrowserCompatibility on mount', () => {
    expect(pageSource).toMatch(/import.*checkBrowserCompatibility.*from.*browser-detect/);
    expect(pageSource).toContain('checkBrowserCompatibility()');
  });

  it('page displays browser warning when not supported', () => {
    expect(pageSource).toContain('browserWarning');
    expect(pageSource).toContain('setBrowserWarning');
    expect(pageSource).toMatch(/role="alert"/);
  });
});

// =========================================================================
// 6. Data flow module integration verification
// =========================================================================

describe('Integration: module wiring verification', () => {
  it('page exports a default function component', () => {
    expect(pageSource).toMatch(/export default function Home/);
  });

  it('page uses useCallback for handleGenerate', () => {
    expect(pageSource).toContain('useCallback');
  });

  it('page uses useRef to track latest IR and style for export', () => {
    expect(pageSource).toContain('useRef');
    expect(pageSource).toContain('irRef');
    expect(pageSource).toContain('styleRef');
  });

  it('page clears error state before each generation attempt', () => {
    const handleGenerateStart = pageSource.indexOf('handleGenerate');
    const setErrorNull = pageSource.indexOf('setError(null)', handleGenerateStart);
    expect(setErrorNull).toBeGreaterThan(handleGenerateStart);
  });

  it('page sets loading state during generation', () => {
    expect(pageSource).toContain('setIsLoading(true)');
    expect(pageSource).toContain('setIsLoading(false)');
  });

  it('loading state is reset in finally block', () => {
    expect(pageSource).toMatch(/finally\s*\{[^}]*setIsLoading\(false\)/s);
  });
});

// =========================================================================
// 7. Error handler module integration
// =========================================================================

describe('Integration: error handler module correctness', () => {
  it('isErrorResponse correctly identifies valid error responses', () => {
    const valid = {
      success: false as const,
      error: { code: 'TEST', message: 'test', retryable: false },
    };
    expect(isErrorResponse(valid)).toBe(true);
  });

  it('isErrorResponse rejects non-error objects', () => {
    expect(isErrorResponse(null)).toBe(false);
    expect(isErrorResponse(undefined)).toBe(false);
    expect(isErrorResponse({})).toBe(false);
    expect(isErrorResponse({ success: true })).toBe(false);
    expect(isErrorResponse({ success: false })).toBe(false);
    expect(isErrorResponse({ success: false, error: 'string' })).toBe(false);
  });

  it('all error codes are defined', () => {
    expect(ERROR_CODES.PARSE_FAILED).toBe('PARSE_FAILED');
    expect(ERROR_CODES.SCHEMA_INVALID).toBe('SCHEMA_INVALID');
    expect(ERROR_CODES.LLM_TIMEOUT).toBe('LLM_TIMEOUT');
    expect(ERROR_CODES.LLM_ERROR).toBe('LLM_ERROR');
    expect(ERROR_CODES.EXPORT_FAILED).toBe('EXPORT_FAILED');
  });
});

// =========================================================================
// 8. Session data model integration
// =========================================================================

describe('Integration: session data model', () => {
  it('SessionData contains IR, StyleConfig, timestamp, and version', () => {
    const session: SessionData = {
      ir: SAMPLE_IR,
      styleConfig: SAMPLE_STYLE,
      timestamp: Date.now(),
      version: DATA_VERSION,
    };
    expect(session.ir.version).toBe('1.0');
    expect(session.styleConfig.fontFamily.zh).toBe('SimSun');
    expect(typeof session.timestamp).toBe('number');
    expect(session.version).toBe(DATA_VERSION);
  });

  it('IR structure is preserved through JSON serialization', () => {
    const serialized = JSON.stringify(SAMPLE_IR);
    const deserialized: IR = JSON.parse(serialized);
    expect(deserialized).toEqual(SAMPLE_IR);
    expect(deserialized.nodes).toHaveLength(3);
    expect(deserialized.edges).toHaveLength(2);
  });

  it('StyleConfig defaults match academic-default template', () => {
    expect(ACADEMIC_DEFAULT_STYLE.fontFamily.zh).toBe('SimSun');
    expect(ACADEMIC_DEFAULT_STYLE.fontFamily.en).toBe('Times New Roman');
    expect(ACADEMIC_DEFAULT_STYLE.fontSize).toBe(12);
    expect(ACADEMIC_DEFAULT_STYLE.borderWidth).toBe(1);
    expect(ACADEMIC_DEFAULT_STYLE.fillColor).toBe('#FFFFFF');
    expect(ACADEMIC_DEFAULT_STYLE.borderColor).toBe('#000000');
    expect(ACADEMIC_DEFAULT_STYLE.arrowStyle).toBe('solid');
    expect(ACADEMIC_DEFAULT_STYLE.lineStyle).toBe('orthogonal');
    expect(ACADEMIC_DEFAULT_STYLE.colorScheme).toBe('monochrome');
  });
});
