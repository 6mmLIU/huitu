/**
 * Feature: paperflow, Property 13: 图表类型决定布局策略
 *
 * Validates: Requirements 8.4
 *
 * For any valid IR document, Render_Engine should select the corresponding
 * layout strategy based on metadata.chartType:
 * - sequential → rankdir: 'TB', compound: false
 * - conditional → rankdir: 'TB', compound: false
 * - tree → rankdir: 'TB', compound: false, wider nodesep than sequential
 * - architecture → rankdir: 'TB', compound: true
 */
import { getLayoutStrategy } from '@/lib/render-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbChartType } from './arbitraries';

describe('Property 13: 图表类型决定布局策略', () => {
  it('getLayoutStrategy returns correct strategy for every chartType', () => {
    const sequentialStrategy = getLayoutStrategy('sequential');

    fc.assert(
      fc.property(arbChartType, (chartType) => {
        const strategy = getLayoutStrategy(chartType);

        // All chart types use top-to-bottom layout
        expect(strategy.rankdir).toBe('TB');

        switch (chartType) {
          case 'sequential':
          case 'conditional':
            expect(strategy.compound).toBe(false);
            break;
          case 'tree':
            expect(strategy.compound).toBe(false);
            // Tree should have wider nodesep than sequential
            expect(strategy.nodesep).toBeGreaterThan(sequentialStrategy.nodesep);
            break;
          case 'architecture':
            expect(strategy.compound).toBe(true);
            break;
        }
      }),
      { numRuns: 100 },
    );
  });
});
