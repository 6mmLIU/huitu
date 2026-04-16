/**
 * Feature: paperflow, Property 7: 样式变更不影响 IR
 *
 * Validates: Requirements 4.4, 10.2
 *
 * For any valid IR and any sequence of style change operations
 * (font switching, font size adjustment, border width adjustment,
 * fill color replacement), the IR after operations must be deeply
 * equal to the original IR.
 */
import { render } from '@/lib/render-engine';
import type { StyleConfig } from '@/types/style';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbIR } from './arbitraries';

/**
 * Arbitrary that generates random StyleConfig values.
 */
const arbStyleConfig: fc.Arbitrary<StyleConfig> = fc.record({
  fontFamily: fc.record({
    zh: fc.constantFrom('SimSun', 'Microsoft YaHei', 'KaiTi', 'FangSong'),
    en: fc.constantFrom('Times New Roman', 'Arial', 'Helvetica', 'Georgia'),
  }),
  fontSize: fc.integer({ min: 8, max: 36 }),
  borderWidth: fc.integer({ min: 1, max: 5 }),
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

describe('Property 7: 样式变更不影响 IR', () => {
  it('IR remains deeply equal after render with random style change sequences', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbIR,
        fc.array(arbStyleConfig, { minLength: 1, maxLength: 5 }),
        async (ir, styleSequence) => {
          // 1. Snapshot the IR as a JSON string (canonical form)
          const originalJSON = JSON.stringify(ir);

          // 2. Apply each random style config through render
          for (const style of styleSequence) {
            await render({ ir, style, layoutEngine: 'dagre' });
          }

          // 3. Verify the IR is still deeply equal to the original
          expect(JSON.stringify(ir)).toBe(originalJSON);
        },
      ),
      { numRuns: 100 },
    );
  });
});
