/**
 * Feature: paperflow, Property 11: 条件分支节点必有条件边
 *
 * Validates: Requirements 8.2
 *
 * For any valid IR document containing decision nodes, every decision node
 * must have at least one outgoing edge with type 'conditional'.
 */
import type { IR, IREdge, IRNode } from '@/types/ir';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbChartType } from './arbitraries';

/**
 * Custom arbitrary that generates IR documents with at least one decision node,
 * ensuring every decision node has at least one conditional outgoing edge.
 */
const arbIRWithDecisionEdges: fc.Arbitrary<IR> = fc
  .tuple(
    // Generate 0-5 non-decision nodes
    fc.array(
      fc.record({
        id: fc.uuid().map((u) => `node_${u}`),
        label: fc.string({ minLength: 1, maxLength: 50 }),
        type: fc.constantFrom(
          'process' as const,
          'start' as const,
          'end' as const,
          'subprocess' as const,
        ),
      }),
      { minLength: 0, maxLength: 5 },
    ),
    // Generate 1-5 decision nodes (at least one)
    fc.array(
      fc.record({
        id: fc.uuid().map((u) => `node_${u}`),
        label: fc.string({ minLength: 1, maxLength: 50 }),
        type: fc.constant('decision' as const),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    arbChartType,
  )
  .chain(([otherNodes, decisionNodes, chartType]) => {
    const allNodes: IRNode[] = [...otherNodes, ...decisionNodes];
    const allNodeIds = allNodes.map((n) => n.id);

    // For each decision node, generate at least one conditional outgoing edge
    const conditionalEdgeArbs = decisionNodes.map((dn) =>
      fc
        .tuple(
          // At least 1 conditional edge from this decision node
          fc.array(
            fc.record({
              id: fc.uuid().map((u) => `edge_${u}`),
              source: fc.constant(dn.id),
              target: fc.constantFrom(...allNodeIds),
              label: fc
                .option(fc.string({ maxLength: 20 }))
                .map((v) => v ?? undefined),
              type: fc.constant('conditional' as const),
            }),
            { minLength: 1, maxLength: 3 },
          ),
          // Optional additional normal edges from this decision node
          fc.array(
            fc.record({
              id: fc.uuid().map((u) => `edge_${u}`),
              source: fc.constant(dn.id),
              target: fc.constantFrom(...allNodeIds),
              label: fc
                .option(fc.string({ maxLength: 20 }))
                .map((v) => v ?? undefined),
              type: fc.constant('normal' as const),
            }),
            { minLength: 0, maxLength: 2 },
          ),
        )
        .map(([condEdges, normalEdges]) => [...condEdges, ...normalEdges]),
    );

    // Optional extra edges between any nodes
    const extraEdgesArb = fc.array(
      fc.record({
        id: fc.uuid().map((u) => `edge_${u}`),
        source: fc.constantFrom(...allNodeIds),
        target: fc.constantFrom(...allNodeIds),
        label: fc
          .option(fc.string({ maxLength: 20 }))
          .map((v) => v ?? undefined),
        type: fc.constantFrom('normal' as const, 'conditional' as const),
      }),
      { minLength: 0, maxLength: 5 },
    );

    return fc
      .tuple(fc.tuple(...conditionalEdgeArbs), extraEdgesArb)
      .map(([decisionEdgeArrays, extraEdges]) => {
        const allEdges: IREdge[] = [
          ...(decisionEdgeArrays as IREdge[][]).flat(),
          ...extraEdges,
        ];

        return {
          version: '1.0' as const,
          metadata: {
            createdAt: new Date().toISOString(),
            sourceLanguage: 'zh' as const,
            chartType,
          },
          nodes: allNodes,
          edges: allEdges,
          groups: [] as IR['groups'],
        };
      });
  });

describe('Property 11: 条件分支节点必有条件边', () => {
  it('every decision node has at least one conditional outgoing edge', () => {
    fc.assert(
      fc.property(arbIRWithDecisionEdges, (ir) => {
        const decisionNodes = ir.nodes.filter((n) => n.type === 'decision');

        // The IR must contain at least one decision node
        expect(decisionNodes.length).toBeGreaterThanOrEqual(1);

        for (const dn of decisionNodes) {
          const conditionalOutEdges = ir.edges.filter(
            (e) => e.source === dn.id && e.type === 'conditional',
          );
          expect(conditionalOutEdges.length).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 100 },
    );
  });
});
