/**
 * 请求频率限制中间件
 * 使用令牌桶算法按客户端 IP 限制请求频率
 *
 * 配置：每个客户端最多 10 次请求/分钟
 * 超频请求返回 HTTP 429，响应头包含 Retry-After 字段
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next token is available
}

interface TokenBucket {
  tokens: number;
  lastRefillTime: number; // ms timestamp
}

const DEFAULT_MAX_TOKENS = 10;
const DEFAULT_REFILL_INTERVAL_MS = 60_000; // 60 seconds

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(
    maxTokens: number = DEFAULT_MAX_TOKENS,
    refillIntervalMs: number = DEFAULT_REFILL_INTERVAL_MS,
    private readonly now: () => number = Date.now
  ) {
    this.maxTokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
  }

  /**
   * Check whether a request from the given client is allowed.
   * Consumes one token if allowed.
   */
  checkRateLimit(clientId: string): RateLimitResult {
    const currentTime = this.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefillTime: currentTime };
      this.buckets.set(clientId, bucket);
    }

    // Refill tokens based on elapsed time
    this.refill(bucket, currentTime);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate seconds until next token
    const elapsedSinceLastRefill = currentTime - bucket.lastRefillTime;
    const msPerToken = this.refillIntervalMs / this.maxTokens;
    const msUntilNextToken = msPerToken - elapsedSinceLastRefill;
    const retryAfter = Math.max(1, Math.ceil(msUntilNextToken / 1000));

    return { allowed: false, retryAfter };
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   */
  private refill(bucket: TokenBucket, currentTime: number): void {
    const elapsed = currentTime - bucket.lastRefillTime;
    if (elapsed <= 0) return;

    const msPerToken = this.refillIntervalMs / this.maxTokens;
    const newTokens = Math.floor(elapsed / msPerToken);

    if (newTokens > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + newTokens);
      bucket.lastRefillTime = bucket.lastRefillTime + newTokens * msPerToken;
    }
  }

  /** Reset all buckets (useful for testing). */
  reset(): void {
    this.buckets.clear();
  }
}

/** Shared singleton for the application */
export const rateLimiter = new RateLimiter();

/**
 * Convenience function using the shared singleton.
 */
export function checkRateLimit(clientId: string): RateLimitResult {
  return rateLimiter.checkRateLimit(clientId);
}

/**
 * Create an HTTP 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试',
        retryable: true,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  );
}
