/**
 * POST /api/parse — 自然语言解析端点
 * 接收 ParseRequest（text + language），返回 ParseResponse（IR 或错误信息）
 *
 * 需求：1.1, 11.1, 11.2, 11.3
 */

import { authenticateRequest, unauthorizedResponse } from '@/server/middleware/auth';
import { checkRateLimit, rateLimitResponse } from '@/server/middleware/rate-limiter';
import { parseNaturalLanguage } from '@/server/services/nl-parser';

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; take the first one
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

export async function POST(request: Request) {
  // 1. Auth check
  const authResult = authenticateRequest(request);
  if (!authResult.authenticated) {
    return unauthorizedResponse(authResult.error ?? 'Unauthorized');
  }

  // 2. Rate limit check
  const clientIP = getClientIP(request);
  const rateResult = checkRateLimit(clientIP);
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.retryAfter ?? 60);
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must be valid JSON',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return Response.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must be a JSON object',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  const { text, language } = body as Record<string, unknown>;

  if (typeof text !== 'string' || text.trim().length === 0) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Field "text" is required and must be a non-empty string',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  if (language !== 'zh' && language !== 'en') {
    return Response.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Field "language" is required and must be "zh" or "en"',
          retryable: false,
        },
      },
      { status: 400 }
    );
  }

  // 4. Call NL_Parser service
  const result = await parseNaturalLanguage({ text, language });

  if (result.success) {
    return Response.json(result, { status: 200 });
  }

  // 5. Map error codes to HTTP status codes
  const statusMap: Record<string, number> = {
    PARSE_FAILED: 422,
    SCHEMA_INVALID: 502,
    LLM_TIMEOUT: 504,
    LLM_ERROR: 502,
  };

  const status = statusMap[result.error?.code ?? ''] ?? 500;

  return Response.json(
    {
      success: false,
      error: {
        ...result.error,
        retryable: result.error?.code !== 'PARSE_FAILED',
      },
    },
    { status }
  );
}
