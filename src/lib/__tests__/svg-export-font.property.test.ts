/**
 * Feature: paperflow, Property 9: SVG 导出包含内嵌字体
 *
 * Validates: Requirements 5.1
 *
 * For any valid IR document, the exported SVG file content must contain
 * font definition information (@font-face declarations or embedded font data).
 */
import { exportFlowchart } from '@/lib/export-service';
import { render } from '@/lib/render-engine';
import { generateSVG } from '@/lib/svg-generator';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { arbIR } from './arbitraries';

/**
 * Set up minimal DOM mocks required by exportFlowchart's triggerDownload.
 */
function setupDOMMocks() {
  const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn() };
  globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
  globalThis.document = {
    createElement: vi.fn().mockReturnValue(anchor),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  } as unknown as Document;
}

describe('Property 9: SVG 导出包含内嵌字体', () => {
  it('exported SVG contains @font-face declarations with SimSun and Times New Roman', async () => {
    setupDOMMocks();

    await fc.assert(
      fc.asyncProperty(arbIR, async (ir) => {
        // 1. Render layout
        const result = await render({
          ir,
          style: ACADEMIC_DEFAULT_STYLE,
          layoutEngine: 'dagre',
        });

        // 2. Generate SVG string
        const { svgString } = generateSVG({
          layout: result.layout,
          style: ACADEMIC_DEFAULT_STYLE,
        });

        // 3. Export as SVG with font embedding (default behavior)
        const blob = await exportFlowchart({
          svgString,
          format: 'svg',
          embedFonts: true,
        });

        // 4. Read the exported SVG content
        const svgContent = await blob.text();

        // 5. Verify @font-face declarations are present
        expect(svgContent).toContain('@font-face');

        // 6. Verify both academic fonts are declared
        expect(svgContent).toContain("font-family: 'SimSun'");
        expect(svgContent).toContain("font-family: 'Times New Roman'");

        // 7. Verify the font declarations are inside a <style> block
        expect(svgContent).toContain('<style');
        expect(svgContent).toContain('</style>');
      }),
      { numRuns: 100 },
    );
  });
});
