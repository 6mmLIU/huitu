/**
 * **Feature: paperflow, Property 16: 解析失败返回错误信息**
 *
 * 对于任意无法被解析为有效流程结构的输入文本，NL_Parser 应返回包含非空错误消息和输入建议的错误响应。
 *
 * **Validates: Requirements 11.1**
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseNaturalLanguage } from '../nl-parser';

/**
 * Helper: create a mock fetch that returns a given body string as the LLM
 * chat-completion response. This lets us control what `callLLM` receives
 * without hitting a real API.
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
 * Asserts that a ParseResponse represents a proper error with non-empty
 * message and non-empty suggestions array.
 */
function assertErrorWithSuggestions(result: {
  success: boolean;
  error?: { message: string; suggestions?: string[] };
}) {
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
  expect(result.error!.message).toBeTruthy();
  expect(result.error!.message.length).toBeGreaterThan(0);
  expect(result.error!.suggestions).toBeDefined();
  expect(Array.isArray(result.error!.suggestions)).toBe(true);
  expect(result.error!.suggestions!.length).toBeGreaterThan(0);
  for (const s of result.error!.suggestions!) {
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  }
}

describe('Property 16: 解析失败返回错误信息', () => {
  beforeEach(() => {
    // Provide a fake API key so callLLM doesn't bail out early
    process.env.OPENAI_API_KEY = 'test-key-for-property-test';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it('returns error with non-empty message and suggestions when LLM returns non-JSON gibberish', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Random non-empty text as user input
        fc.string({ minLength: 1, maxLength: 100 }),
        // Random non-JSON string that the LLM "returns"
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

          // If the input is whitespace-only, the service rejects it before calling LLM
          // Either way, the result must be an error with suggestions
          assertErrorWithSuggestions(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns error with non-empty message and suggestions when LLM returns invalid IR JSON', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Non-empty user input text
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        // Generate JSON that is NOT a valid IR (missing required fields)
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
          // Both the first attempt and the retry return the same invalid IR
          vi.stubGlobal('fetch', mockFetchWithContent(invalidIRJson));

          const result = await parseNaturalLanguage({ text: inputText, language });

          assertErrorWithSuggestions(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns error with non-empty message and suggestions for empty/whitespace-only input', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate empty or whitespace-only strings
        fc.constantFrom('', ' ', '  ', '\t', '\n', '\r\n', '   \t\n  '),
        fc.constantFrom('zh' as const, 'en' as const),
        async (whitespace, language) => {
          const result = await parseNaturalLanguage({ text: whitespace, language });

          assertErrorWithSuggestions(result);
        },
      ),
      { numRuns: 100 },
    );
  });
});
