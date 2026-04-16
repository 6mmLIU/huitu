/**
 * Unified Error Handler — ErrorResponse interface, error codes, and helpers
 *
 * Defines the standard error response shape used across the frontend,
 * error code constants for each failure category, and utility functions
 * for creating typed error responses.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

// ---------------------------------------------------------------------------
// ErrorResponse interface
// ---------------------------------------------------------------------------

export interface ErrorDetail {
  /** Machine-readable error code, e.g. 'PARSE_FAILED' */
  code: string;
  /** Human-readable error description */
  message: string;
  /** Optional input suggestions (provided on parse failures) */
  suggestions?: string[];
  /** Whether the operation can be retried */
  retryable: boolean;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetail;
}

// ---------------------------------------------------------------------------
// Error code constants
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  /** NL_Parser cannot extract flow structure from input */
  PARSE_FAILED: 'PARSE_FAILED',
  /** IR does not match JSON Schema after retry */
  SCHEMA_INVALID: 'SCHEMA_INVALID',
  /** LLM API response exceeded 30s timeout */
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  /** LLM API returned 4xx/5xx */
  LLM_ERROR: 'LLM_ERROR',
  /** SVG/PNG export error */
  EXPORT_FAILED: 'EXPORT_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ---------------------------------------------------------------------------
// Default user-facing messages (Chinese)
// ---------------------------------------------------------------------------

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.PARSE_FAILED]: '无法识别流程结构，请尝试使用更明确的步骤描述',
  [ERROR_CODES.SCHEMA_INVALID]: '生成结果异常，请重试',
  [ERROR_CODES.LLM_TIMEOUT]: '服务响应超时，请稍后重试',
  [ERROR_CODES.LLM_ERROR]: '服务暂时不可用，请点击重试',
  [ERROR_CODES.EXPORT_FAILED]: '导出失败，请检查流程图是否完整',
};

// ---------------------------------------------------------------------------
// Helper: create an ErrorResponse from a code
// ---------------------------------------------------------------------------

/**
 * Build a standardised ErrorResponse for a given error code.
 * Automatically fills in the default message and retryable flag.
 */
export function createErrorResponse(
  code: ErrorCode,
  overrides?: { message?: string; suggestions?: string[] },
): ErrorResponse {
  const retryable = code !== ERROR_CODES.PARSE_FAILED;

  return {
    success: false,
    error: {
      code,
      message: overrides?.message ?? ERROR_MESSAGES[code],
      ...(overrides?.suggestions ? { suggestions: overrides.suggestions } : {}),
      retryable,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: determine if an unknown API response is an ErrorResponse
// ---------------------------------------------------------------------------

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.success === false &&
    typeof obj.error === 'object' &&
    obj.error !== null &&
    typeof (obj.error as Record<string, unknown>).code === 'string' &&
    typeof (obj.error as Record<string, unknown>).message === 'string'
  );
}
