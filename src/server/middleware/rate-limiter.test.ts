import { describe, expect, it } from 'vitest';
import {
    checkRateLimit,
    RateLimiter,
    rateLimiter,
    rateLimitResponse,
} from './rate-limiter';

describe('RateLimiter', () => {
  it('should allow requests within the limit', () => {
    const limiter = new RateLimiter(10, 60_000, () => 0);
    for (let i = 0; i < 10; i++) {
      const result = limiter.checkRateLimit('client-1');
      expect(result.allowed).toBe(true);
    }
  });

  it('should reject the 11th request', () => {
    const limiter = new RateLimiter(10, 60_000, () => 0);
    for (let i = 0; i < 10; i++) {
      limiter.checkRateLimit('client-1');
    }
    const result = limiter.checkRateLimit('client-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('should track clients independently', () => {
    const limiter = new RateLimiter(2, 60_000, () => 0);
    limiter.checkRateLimit('client-a');
    limiter.checkRateLimit('client-a');
    // client-a exhausted
    expect(limiter.checkRateLimit('client-a').allowed).toBe(false);
    // client-b still has tokens
    expect(limiter.checkRateLimit('client-b').allowed).toBe(true);
  });

  it('should refill tokens over time', () => {
    let time = 0;
    const limiter = new RateLimiter(10, 60_000, () => time);

    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      limiter.checkRateLimit('client-1');
    }
    expect(limiter.checkRateLimit('client-1').allowed).toBe(false);

    // Advance time by 6 seconds (enough for 1 token at 10 tokens/60s = 1 token per 6s)
    time = 6_000;
    const result = limiter.checkRateLimit('client-1');
    expect(result.allowed).toBe(true);
  });

  it('should not refill beyond max tokens', () => {
    let time = 0;
    const limiter = new RateLimiter(3, 60_000, () => time);

    // Use 1 token
    limiter.checkRateLimit('client-1');

    // Advance time by a full interval (should refill to max, not beyond)
    time = 120_000;
    // Should have 3 tokens (max), not more
    for (let i = 0; i < 3; i++) {
      expect(limiter.checkRateLimit('client-1').allowed).toBe(true);
    }
    expect(limiter.checkRateLimit('client-1').allowed).toBe(false);
  });

  it('should return retryAfter >= 1 when rate limited', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0);
    limiter.checkRateLimit('client-1');
    const result = limiter.checkRateLimit('client-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('should reset all buckets', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0);
    limiter.checkRateLimit('client-1');
    expect(limiter.checkRateLimit('client-1').allowed).toBe(false);
    limiter.reset();
    expect(limiter.checkRateLimit('client-1').allowed).toBe(true);
  });
});

describe('checkRateLimit (singleton)', () => {
  it('should use the shared rateLimiter instance', () => {
    rateLimiter.reset();
    const result = checkRateLimit('singleton-test');
    expect(result.allowed).toBe(true);
    rateLimiter.reset();
  });
});

describe('rateLimitResponse', () => {
  it('should return 429 status', () => {
    const res = rateLimitResponse(30);
    expect(res.status).toBe(429);
  });

  it('should include Retry-After header', () => {
    const res = rateLimitResponse(42);
    expect(res.headers.get('Retry-After')).toBe('42');
  });

  it('should set Content-Type to application/json', () => {
    const res = rateLimitResponse(10);
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('should return JSON body with error details', async () => {
    const res = rateLimitResponse(5);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试',
        retryable: true,
      },
    });
  });
});
