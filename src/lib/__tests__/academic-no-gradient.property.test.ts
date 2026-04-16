/**
 * Feature: paperflow, Property 6: 学术模板无渐变无阴影
 *
 * Validates: Requirements 3.1
 *
 * For any valid IR document rendered with the academic-default template,
 * the SVG output must NOT contain linearGradient, radialGradient,
 * <filter, or filter= elements/attributes (marker-end is allowed).
 */
import { render } from '@/lib/render-engine';
import { generateSVG } from '@/lib/svg-generator';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbIR } from './arbitraries';

describe('Property 6: 学术模板无渐变无阴影', () => {
  it('SVG rendered with academic-default does NOT contain gradients or shadow filters', async () => {
    await fc.assert(
      fc.asyncProperty(arbIR, async (ir) => {
        // 1. Render layout
        const result = await render({
          ir,
          style: ACADEMIC_DEFAULT_STYLE,
          layoutEngine: 'dagre',
        });

        // 2. Generate SVG
        const { svgString } = generateSVG({
          layout: result.layout,
          style: ACADEMIC_DEFAULT_STYLE,
        });

        // 3. Verify no gradient elements
        expect(svgString).not.toContain('linearGradient');
        expect(svgString).not.toContain('radialGradient');

        // 4. Verify no filter elements (e.g. <filter ...>)
        expect(svgString).not.toContain('<filter');

        // 5. Verify no inline filter attributes (e.g. filter="url(#shadow)")
        //    but allow marker-end which is a valid arrowhead reference
        const filterAttrRegex = /\bfilter\s*=/i;
        expect(filterAttrRegex.test(svgString)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
