'use client';

import { EditorPanel, FlowCanvas, StylePanel } from '@/components';
import type { Locale } from '@/i18n';
import { supportedLocales } from '@/i18n';
import useI18n from '@/i18n/useI18n';
import { checkBrowserCompatibility } from '@/lib/browser-detect';
import { isErrorResponse, type ErrorResponse } from '@/lib/error-handler';
import { exportFlowchart } from '@/lib/export-service';
import { DATA_VERSION, loadSession, saveSession } from '@/lib/local-storage-manager';
import { render } from '@/lib/render-engine';
import { generateSVG } from '@/lib/svg-generator';
import type { IR } from '@/types/ir';
import type { StyleConfig } from '@/types/style';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const { locale, setLocale, t } = useI18n();

  // Core state
  const [ir, setIr] = useState<IR | null>(null);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>(ACADEMIC_DEFAULT_STYLE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [lastText, setLastText] = useState('');

  // Ref to track the latest IR and style for export
  const irRef = useRef<IR | null>(null);
  const styleRef = useRef<StyleConfig>(ACADEMIC_DEFAULT_STYLE);

  // Keep refs in sync with state
  useEffect(() => {
    irRef.current = ir;
  }, [ir]);
  useEffect(() => {
    styleRef.current = styleConfig;
  }, [styleConfig]);

  // Browser compatibility warning
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Browser compatibility check on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    const result = checkBrowserCompatibility();
    if (!result.supported && result.message) {
      setBrowserWarning(result.message);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Restore session from LocalStorage on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setIr(session.ir);
      setStyleConfig(session.styleConfig);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Auto-save session to LocalStorage when IR or style changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (ir) {
      saveSession({
        ir,
        styleConfig,
        timestamp: Date.now(),
        version: DATA_VERSION,
      });
    }
  }, [ir, styleConfig]);

  // -----------------------------------------------------------------------
  // Generate flowchart: POST to /api/parse
  // -----------------------------------------------------------------------
  const handleGenerate = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);
      setLastText(text);

      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.NEXT_PUBLIC_PAPERFLOW_API_KEY
              ? { 'x-api-key': process.env.NEXT_PUBLIC_PAPERFLOW_API_KEY }
              : {}),
          },
          body: JSON.stringify({ text, language: locale }),
        });

        const data = await res.json();

        if (data.success && data.ir) {
          setIr(data.ir);
        } else if (isErrorResponse(data)) {
          setError(data);
        } else {
          setError({
            success: false,
            error: {
              code: 'UNKNOWN',
              message: t('error.networkError'),
              retryable: true,
            },
          });
        }
      } catch {
        setError({
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: t('error.networkError'),
            retryable: true,
          },
        });
      } finally {
        setIsLoading(false);
      }
    },
    [locale, t],
  );

  // -----------------------------------------------------------------------
  // Retry last generation
  // -----------------------------------------------------------------------
  const handleRetry = useCallback(() => {
    if (lastText) {
      handleGenerate(lastText);
    }
  }, [lastText, handleGenerate]);

  // -----------------------------------------------------------------------
  // Generate SVG string on-demand for export
  // -----------------------------------------------------------------------
  const generateSVGForExport = useCallback(async (): Promise<string | null> => {
    const currentIr = irRef.current;
    const currentStyle = styleRef.current;
    if (!currentIr) return null;
    try {
      const result = await render({ ir: currentIr, style: currentStyle, layoutEngine: 'dagre' });
      const svgResult = generateSVG({ layout: result.layout, style: currentStyle });
      return svgResult.svgString;
    } catch {
      return null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Export handlers
  // -----------------------------------------------------------------------
  const handleExportSVG = useCallback(async () => {
    const svg = await generateSVGForExport();
    if (!svg) return;
    exportFlowchart({ svgString: svg, format: 'svg' }).catch(() => {
      setError({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: t('error.exportFailed'),
          retryable: false,
        },
      });
    });
  }, [generateSVGForExport, t]);

  const handleExportPNG = useCallback(async () => {
    const svg = await generateSVGForExport();
    if (!svg) return;
    exportFlowchart({ svgString: svg, format: 'png', dpi: 300 }).catch(() => {
      setError({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: t('error.exportFailed'),
          retryable: false,
        },
      });
    });
  }, [generateSVGForExport, t]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <main className={styles.main}>
      {/* Browser compatibility warning */}
      {browserWarning && (
        <div className={styles.browserWarning} role="alert">
          {browserWarning}
          <button
            className={styles.dismissWarning}
            onClick={() => setBrowserWarning(null)}
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top bar with app name and language switcher */}
      <header className={styles.header}>
        <h1 className={styles.appName}>{t('common.appName')}</h1>
        <p className={styles.appDescription}>{t('common.appDescription')}</p>
        <div className={styles.langSwitcher}>
          {supportedLocales.map((loc: Locale) => (
            <button
              key={loc}
              className={`${styles.langButton}${locale === loc ? ` ${styles.langActive}` : ''}`}
              onClick={() => setLocale(loc)}
              aria-label={`Switch to ${loc}`}
            >
              {loc === 'zh' ? '中文' : 'EN'}
            </button>
          ))}
        </div>
      </header>

      {/* Main content area */}
      <div className={styles.content}>
        {/* Left panel: Editor + Style */}
        <div className={styles.leftPanel}>
          <EditorPanel
            onGenerate={handleGenerate}
            isLoading={isLoading}
            error={error}
            onRetry={handleRetry}
            onDismissError={() => setError(null)}
          />
          <StylePanel style={styleConfig} onStyleChange={setStyleConfig} />
        </div>

        {/* Right panel: Flow Canvas */}
        <div className={styles.rightPanel}>
          <FlowCanvas
            ir={ir}
            style={styleConfig}
            onExportSVG={handleExportSVG}
            onExportPNG={handleExportPNG}
          />
        </div>
      </div>
    </main>
  );
}
