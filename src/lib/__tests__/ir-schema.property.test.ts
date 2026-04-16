/**
 * **Feature: paperflow, Property 3: IR Schema 校验一致性**
 *
 * **Validates: Requirements 1.1, 2.4**
 *
 * For any randomly generated valid IR document, the ajv-based schema
 * validator should report it as valid. This ensures the IR JSON Schema
 * and the arbitraries are aligned.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateIR } from '../ir-validator';
import { arbIR, arbIRWithGroups } from './arbitraries';

describe('Property 3: IR Schema 校验一致性', () => {
  it('all randomly generated IR documents (no groups) pass schema validation', () => {
    fc.assert(
      fc.property(arbIR, (ir) => {
        const result = validateIR(ir);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('all randomly generated IR documents (with groups) pass schema validation', () => {
    fc.assert(
      fc.property(arbIRWithGroups, (ir) => {
        const result = validateIR(ir);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
