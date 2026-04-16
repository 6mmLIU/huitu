/**
 * Feature: paperflow, Property 2: IR 结构完整性
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 *
 * For any valid IR document, the following must hold:
 * (a) All node IDs are unique
 * (b) Every edge's source and target reference existing node IDs
 * (c) Every group's children IDs reference existing nodes or groups
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbIR, arbIRWithGroups } from './arbitraries';

describe('Property 2: IR 结构完整性', () => {
  it('(a) all node IDs are unique', () => {
    fc.assert(
      fc.property(arbIR, (ir) => {
        const ids = ir.nodes.map((n) => n.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }),
      { numRuns: 100 },
    );
  });

  it('(b) every edge source and target reference existing node IDs', () => {
    fc.assert(
      fc.property(arbIR, (ir) => {
        const nodeIds = new Set(ir.nodes.map((n) => n.id));
        for (const edge of ir.edges) {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('(c) every group children ID references an existing node or group', () => {
    fc.assert(
      fc.property(arbIRWithGroups, (ir) => {
        const nodeIds = new Set(ir.nodes.map((n) => n.id));
        const groupIds = new Set(ir.groups.map((g) => g.id));
        const validIds = new Set([...nodeIds, ...groupIds]);

        for (const group of ir.groups) {
          for (const childId of group.children) {
            expect(validIds.has(childId)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
