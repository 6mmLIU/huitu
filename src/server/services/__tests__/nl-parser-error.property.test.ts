/**
 * **Feature: paperflow, Property 16: 解析始终返回有效 IR（fallback 兜底）**
 *
 * 对于任意输入文本，无论 LLM 返回什么内容（非 JSON、无效 IR、空内容），
 * NL_Parser 都应返回 success: true 并附带一个合法的 IR 结构。
 *
 * **Validates: Requirements 11.1**
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseNaturalLanguage } from '../nl-parser';

/**
 * Helper: create a mock fetch that returns a given body string as the LLM
 * chat-completion response.
 */
function mockFetchWithContent(content: string) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
}

/**
 * Asserts that a ParseResponse is successful with a structurally valid IR.
 */
function assertValidFallbackIR(result: {
  success: boolean;
  ir?: {
    version: string;
    metadata: { chartType: string; sourceLanguage: string };
    nodes: unknown[];
    edges: unknown[];
    groups: unknown[];
  };
}) {
  expect(result.success).toBe(true);
  expect(result.ir).toBeDefined();
  expect(result.ir!.version).toBe('1.0');
  expect(result.ir!.metadata).toBeDefined();
  expect(['sequential', 'conditional', 'architecture', 'tree']).toContain(
    result.ir!.metadata.chartType,
  );
  expect(Array.isArray(result.ir!.nodes)).toBe(true);
  expect(result.ir!.nodes.length).toBeGreaterThanOrEqual(1);
  expect(Array.isArray(result.ir!.edges)).toBe(true);
  expect(Array.isArray(result.ir!.groups)).toBe(true);
}


describe('Property 16: 任意输入始终返回有效 IR', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key-for-property-test';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it('returns valid fallback IR when LLM returns non-JSON gibberish', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => {
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        fc.constantFrom('zh' as const, 'en' as const),
        async (inputText, gibberishLLMResponse, language) => {
          vi.stubGlobal('fetch', mockFetchWithContent(gibberishLLMResponse));

          const result = await parseNaturalLanguage({ text: inputText, language });

          assertValidFallbackIR(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns valid fallback IR when LLM returns invalid IR JSON', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        fc.oneof(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ maxLength: 20 }),
          ),
          fc.array(fc.integer()),
          fc.record({
            version: fc.string({ minLength: 1 }).filter((s) => s !== '1.0'),
          }),
        ).map((obj) => JSON.stringify(obj)),
        fc.constantFrom('zh' as const, 'en' as const),
        async (inputText, invalidIRJson, language) => {
          vi.stubGlobal('fetch', mockFetchWithContent(invalidIRJson));

          const result = await parseNaturalLanguage({ text: inputText, language });

          assertValidFallbackIR(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns valid fallback IR for empty/whitespace-only input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('', ' ', '  ', '\t', '\n', '\r\n', '   \t\n  '),
        fc.constantFrom('zh' as const, 'en' as const),
        async (whitespace, language) => {
          const result = await parseNaturalLanguage({ text: whitespace, language });

          assertValidFallbackIR(result);
        },
      ),
      { numRuns: 100 },
    );
  });
});
