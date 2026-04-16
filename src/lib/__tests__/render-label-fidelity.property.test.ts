/**
 * Feature: paperflow, Property 5: 渲染标签保真
 *
 * Validates: Requirements 1.4
 *
 * For any valid IR document, the set of text labels in the generated SVG
 * must match the set of all node labels + edge labels (where edge.label
 * is defined) from the IR exactly — no more, no less.
 */
import { render } from '@/lib/render-engine';
import { extractLabelsFromSVG, generateSVG } from '@/lib/svg-generator';
import type { IR } from '@/types/ir';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbChartType, arbEdgeType, arbNodeType } from './arbitraries';

/**
 * Arbitrary that generates labels with various Unicode characters:
 * ASCII, CJK, accented Latin, Cyrillic, symbols, emoji, etc.
 */
const arbUnicodeLabel = fc.oneof(
  fc.string({ minLength: 1, maxLength: 30 }),
  fc.constantFrom(
    '数据处理',
    '开始',
    '结束',
    '判断条件？',
    'Ñoño',
    'Ünïcödé',
    'Привет',
    '日本語テスト',
    '한국어',
    'α β γ δ',
    '1 + 2 = 3',
    'A & B',
    'x < y > z',
    "it's a test",
    'quote "test"',
  ),
);

/**
 * Node arbitrary with Unicode labels for label fidelity testing.
 */
const arbUnicodeNode = fc.record({
  id: fc.uuid().map((u) => `node_${u}`),
  label: arbUnicodeLabel,
  type: arbNodeType,
});

/**
 * IR arbitrary with Unicode labels for label fidelity testing.
 */
const arbIRForLabels: fc.Arbitrary<IR> = fc
  .tuple(fc.array(arbUnicodeNode, { minLength: 1, maxLength: 20 }), arbChartType)
  .chain(([nodes, chartType]) => {
    const nodeIds = nodes.map((n) => n.id);
    const arbEdge = fc.record({
      id: fc.uuid().map((u) => `edge_${u}`),
      source: fc.constantFrom(...nodeIds),
      target: fc.constantFrom(...nodeIds),
      label: fc
        .option(arbUnicodeLabel)
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

describe('Property 5: 渲染标签保真', () => {
  it('SVG text labels match IR node labels + edge labels exactly', async () => {
    await fc.assert(
      fc.asyncProperty(arbIRForLabels, async (ir) => {
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

        // 3. Extract labels from SVG
        const svgLabels = extractLabelsFromSVG(svgString);

        // 4. Build expected label set from IR
        const expectedLabels: string[] = [];
        for (const node of ir.nodes) {
          expectedLabels.push(node.label);
        }
        for (const edge of ir.edges) {
          if (edge.label !== undefined) {
            expectedLabels.push(edge.label);
          }
        }

        // 5. Compare as sorted arrays (multisets) — duplicates matter
        const sortedSvg = [...svgLabels].sort();
        const sortedExpected = [...expectedLabels].sort();

        expect(sortedSvg).toEqual(sortedExpected);
      }),
      { numRuns: 100 },
    );
  });
});
