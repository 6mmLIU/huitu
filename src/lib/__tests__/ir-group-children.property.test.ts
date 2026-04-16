/**
 * Feature: paperflow, Property 12: 分组子元素引用有效性
 *
 * Validates: Requirements 8.3
 *
 * For any valid IR document containing groups, every child ID in each group's
 * children array must correspond to an existing node ID or group ID.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbIRWithGroups } from './arbitraries';

describe('Property 12: 分组子元素引用有效性', () => {
  it('every group child ID references an existing node or group', () => {
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
