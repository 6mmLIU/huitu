import { describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../error-handler';
import {
    ERROR_CODES,
    ERROR_MESSAGES,
    createErrorResponse,
    isErrorResponse,
} from '../error-handler';

describe('ERROR_CODES', () => {
  it('defines all five error codes', () => {
    expect(ERROR_CODES.PARSE_FAILED).toBe('PARSE_FAILED');
    expect(ERROR_CODES.SCHEMA_INVALID).toBe('SCHEMA_INVALID');
    expect(ERROR_CODES.LLM_TIMEOUT).toBe('LLM_TIMEOUT');
    expect(ERROR_CODES.LLM_ERROR).toBe('LLM_ERROR');
    expect(ERROR_CODES.EXPORT_FAILED).toBe('EXPORT_FAILED');
  });
});

describe('ERROR_MESSAGES', () => {
  it('has a default message for every error code', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof ERROR_MESSAGES[code]).toBe('string');
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

describe('createErrorResponse', () => {
  it('creates an ErrorResponse with default message', () => {
    const res = createErrorResponse(ERROR_CODES.PARSE_FAILED);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('PARSE_FAILED');
    expect(res.error.message).toBe(ERROR_MESSAGES.PARSE_FAILED);
    expect(res.error.retryable).toBe(false);
  });

  it('marks PARSE_FAILED as not retryable', () => {
    expect(createErrorResponse(ERROR_CODES.PARSE_FAILED).error.retryable).toBe(false);
  });

  it('marks LLM_TIMEOUT as retryable', () => {
    expect(createErrorResponse(ERROR_CODES.LLM_TIMEOUT).error.retryable).toBe(true);
  });

  it('marks LLM_ERROR as retryable', () => {
    expect(createErrorResponse(ERROR_CODES.LLM_ERROR).error.retryable).toBe(true);
  });

  it('marks SCHEMA_INVALID as retryable', () => {
    expect(createErrorResponse(ERROR_CODES.SCHEMA_INVALID).error.retryable).toBe(true);
  });

  it('marks EXPORT_FAILED as retryable', () => {
    expect(createErrorResponse(ERROR_CODES.EXPORT_FAILED).error.retryable).toBe(true);
  });

  it('allows overriding message', () => {
    const res = createErrorResponse(ERROR_CODES.LLM_ERROR, { message: 'Custom msg' });
    expect(res.error.message).toBe('Custom msg');
  });

  it('includes suggestions when provided', () => {
    const suggestions = ['Try shorter input', 'Use step-by-step format'];
    const res = createErrorResponse(ERROR_CODES.PARSE_FAILED, { suggestions });
    expect(res.error.suggestions).toEqual(suggestions);
  });

  it('omits suggestions key when not provided', () => {
    const res = createErrorResponse(ERROR_CODES.LLM_TIMEOUT);
    expect(res.error).not.toHaveProperty('suggestions');
  });
});

describe('isErrorResponse', () => {
  it('returns true for a valid ErrorResponse', () => {
    const err: ErrorResponse = {
      success: false,
      error: { code: 'PARSE_FAILED', message: 'fail', retryable: false },
    };
    expect(isErrorResponse(err)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  it('returns false for a success response', () => {
    expect(isErrorResponse({ success: true })).toBe(false);
  });

  it('returns false when error.code is missing', () => {
    expect(isErrorResponse({ success: false, error: { message: 'x' } })).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isErrorResponse('string')).toBe(false);
    expect(isErrorResponse(42)).toBe(false);
    expect(isErrorResponse(undefined)).toBe(false);
  });
});
