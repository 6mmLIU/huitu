/**
 * Feature: paperflow, Property 4: 布局无重叠
 *
 * Validates: Requirements 1.3
 *
 * For any valid IR document, after layout computation by Render_Engine,
 * no two node bounding boxes should overlap.
 */
import { render } from '@/lib/render-engine';
import type { IR } from '@/types/ir';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbChartType, arbEdgeType, arbNode } from './arbitraries';

/**
 * IR arbitrary that generates 1-30 nodes for layout stress testing.
 */
const arbIRForLayout: fc.Arbitrary<IR> = fc
  .tuple(fc.array(arbNode, { minLength: 1, maxLength: 30 }), arbChartType)
  .chain(([nodes, chartType]) => {
    const nodeIds = nodes.map((n) => n.id);
    const arbEdge = fc.record({
      id: fc.uuid().map((u) => `edge_${u}`),
      source: fc.constantFrom(...nodeIds),
      target: fc.constantFrom(...nodeIds),
      label: fc
        .option(fc.string({ maxLength: 20 }))
        .map((v) => v ?? undefined),
      type: arbEdgeType,
    });
    return fc.record({
      version: fc.constant('1.0' as const),
      metadata: fc.record({
        createdAt: fc.constant(new Date().toISOString()),
        sourceLanguage: fc.constantFrom('zh' as const, 'en' as const),
        chartType: fc.constant(chartType),
      }),
      nodes: fc.constant(nodes),
      edges: fc.array(arbEdge, { maxLength: 30 }),
      groups: fc.constant([] as IR['groups']),
    });
  });

/**
 * Check whether two axis-aligned bounding boxes overlap.
 * Each box is defined by top-left (x, y) and (width, height).
 * Uses a small epsilon to ignore floating-point rounding touches.
 */
function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  const EPS = 0.01;
  return (
    a.x + a.w > b.x + EPS &&
    b.x + b.w > a.x + EPS &&
    a.y + a.h > b.y + EPS &&
    b.y + b.h > a.y + EPS
  );
}

describe('Property 4: 布局无重叠', () => {
  it('after dagre layout, no two node bounding boxes overlap', async () => {
    await fc.assert(
      fc.asyncProperty(arbIRForLayout, async (ir) => {
        const result = await render({
          ir,
          style: ACADEMIC_DEFAULT_STYLE,
          layoutEngine: 'dagre',
        });

        const nodes = result.layout.nodes;

        // Check all pairs for overlap
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const overlap = boxesOverlap(
              { x: a.position.x, y: a.position.y, w: a.size.width, h: a.size.height },
              { x: b.position.x, y: b.position.y, w: b.size.width, h: b.size.height },
            );
            expect(overlap).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
