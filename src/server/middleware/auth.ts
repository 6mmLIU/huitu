/**
 * API Gateway 鉴权中间件
 * 验证 API Key / Bearer Token，用于保护后端 API 端点
 *
 * 支持两种鉴权方式：
 * 1. x-api-key 请求头
 * 2. Authorization: Bearer <token> 请求头
 *
 * 有效 key 通过环境变量 PAPERFLOW_API_KEY 配置
 */

export interface AuthResult {
  authenticated: boolean;
  error?: string;
}

/**
 * 从请求头中提取 API key 或 Bearer token
 */
function extractCredential(request: Request): string | null {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return apiKey;
  }

  const authorization = request.headers.get('authorization');
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * 验证请求的鉴权凭证
 *
 * @param request - 标准 Web Request 对象
 * @returns AuthResult 表示鉴权是否通过，失败时包含错误信息
 */
export function authenticateRequest(request: Request): AuthResult {
  const expectedKey = process.env.PAPERFLOW_API_KEY;

  if (!expectedKey) {
    return {
      authenticated: false,
      error: 'Server misconfiguration: API key not set',
    };
  }

  const credential = extractCredential(request);

  if (!credential) {
    return {
      authenticated: false,
      error: 'Missing authentication credentials. Provide x-api-key header or Authorization: Bearer <token>.',
    };
  }

  if (credential !== expectedKey) {
    return {
      authenticated: false,
      error: 'Invalid authentication credentials.',
    };
  }

  return { authenticated: true };
}

/**
 * 创建 HTTP 401 未授权响应
 */
export function unauthorizedResponse(error: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error,
        retryable: false,
      },
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
