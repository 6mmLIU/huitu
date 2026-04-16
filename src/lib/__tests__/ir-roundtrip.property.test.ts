/**
 * Feature: paperflow, Property 1: IR 序列化往返一致性
 *
 * Validates: Requirements 2.5
 *
 * For any valid IR document, serializing to JSON and deserializing back
 * should produce an object deeply equal to the original.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbIR } from './arbitraries';

describe('Property 1: IR 序列化往返一致性', () => {
  it('JSON.stringify → JSON.parse roundtrip preserves IR equality', () => {
    fc.assert(
      fc.property(arbIR, (ir) => {
        const serialized = JSON.stringify(ir);
        const deserialized = JSON.parse(serialized);
        expect(deserialized).toEqual(ir);
      }),
      { numRuns: 100 },
    );
  });
});
