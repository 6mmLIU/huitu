/**
 * Shared fast-check arbitraries for IR types.
 * Reusable across all property-based tests.
 */
import type { IR } from '@/types/ir';
import fc from 'fast-check';

export const arbNodeType = fc.constantFrom(
  'process' as const,
  'decision' as const,
  'start' as const,
  'end' as const,
  'subprocess' as const,
);

export const arbEdgeType = fc.constantFrom('normal' as const, 'conditional' as const);

export const arbChartType = fc.constantFrom(
  'sequential' as const,
  'conditional' as const,
  'architecture' as const,
  'tree' as const,
);

export const arbNode = fc.record({
  id: fc.uuid().map((u) => `node_${u}`),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  type: arbNodeType,
});

export const arbIR: fc.Arbitrary<IR> = fc
  .tuple(fc.array(arbNode, { minLength: 1, maxLength: 20 }), arbChartType)
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
 * Extended IR arbitrary that generates groups with valid children references.
 * Children reference existing node IDs or sibling group IDs.
 */
export const arbIRWithGroups: fc.Arbitrary<IR> = fc
  .tuple(fc.array(arbNode, { minLength: 1, maxLength: 20 }), arbChartType)
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

    // Generate 0-5 groups with unique IDs, then assign children from nodeIds + groupIds
    const arbGroupBase = fc.array(
      fc.tuple(
        fc.uuid().map((u) => `group_${u}`),
        fc.string({ minLength: 1, maxLength: 30 }),
      ),
      { minLength: 0, maxLength: 5 },
    );

    return fc
      .tuple(fc.array(arbEdge, { maxLength: 30 }), arbGroupBase)
      .chain(([edges, groupBases]) => {
        const groupIds = groupBases.map(([id]) => id);
        const validChildIds = [...nodeIds, ...groupIds];

        const arbGroups = groupBases.length === 0
          ? fc.constant([] as IR['groups'])
          : fc
              .tuple(
                ...groupBases.map(() =>
                  fc.subarray(validChildIds, { minLength: 0 }),
                ),
              )
              .map((childrenArrays) =>
                groupBases.map(([id, label], i) => ({
                  id,
                  label,
                  children: (childrenArrays as string[][])[i],
                })),
              );

        return arbGroups.map((groups) => ({
          version: '1.0' as const,
          metadata: {
            createdAt: new Date().toISOString(),
            sourceLanguage: 'zh' as const,
            chartType,
          },
          nodes,
          edges,
          groups,
        }));
      });
  });
