/**
 * **Feature: paperflow, Property 15: 超频请求返回 429**
 *
 * 对于任意超过频率限制阈值的客户端请求，后端应返回 HTTP 429 状态码，
 * 且响应头中包含 Retry-After 字段。
 *
 * **Validates: Requirements 12.3, 12.4**
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RateLimiter, rateLimitResponse } from '../rate-limiter';

describe('Property 15: 超频请求返回 429', () => {
  it('after exhausting all tokens, the next request is rejected with allowed: false and retryAfter >= 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (maxTokens, clientId) => {
          const limiter = new RateLimiter(maxTokens, 60_000, () => 0);

          // Exhaust all tokens
          for (let i = 0; i < maxTokens; i++) {
            const result = limiter.checkRateLimit(clientId);
            expect(result.allowed).toBe(true);
          }

          // The next request should be rejected
          const rejected = limiter.checkRateLimit(clientId);
          expect(rejected.allowed).toBe(false);
          expect(rejected.retryAfter).toBeDefined();
          expect(rejected.retryAfter).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rateLimitResponse() always returns status 429 with Retry-After header for any positive integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3600 }),
        (retryAfter) => {
          const response = rateLimitResponse(retryAfter);
          expect(response.status).toBe(429);
          expect(response.headers.get('Retry-After')).toBe(String(retryAfter));
          expect(response.headers.get('Content-Type')).toBe('application/json');
        }
      ),
      { numRuns: 100 }
    );
  });
});
