/**
 * **Feature: paperflow, Property 14: 未授权请求返回 401**
 *
 * 对于任意不携带有效鉴权凭证的 API 请求，后端应返回 HTTP 401 状态码。
 *
 * **Validates: Requirements 12.1, 12.2**
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authenticateRequest, unauthorizedResponse } from '../auth';

const VALID_KEY = 'valid-secret-key-for-testing';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers,
  });
}

describe('Property 14: 未授权请求返回 401', () => {
  beforeEach(() => {
    process.env.PAPERFLOW_API_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.PAPERFLOW_API_KEY;
  });

  it('requests with no credentials result in authenticated: false', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          const req = makeRequest();
          const result = authenticateRequest(req);
          expect(result.authenticated).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('requests with random invalid x-api-key result in authenticated: false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s !== VALID_KEY),
        (invalidKey) => {
          const req = makeRequest({ 'x-api-key': invalidKey });
          const result = authenticateRequest(req);
          expect(result.authenticated).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('requests with random invalid Bearer token result in authenticated: false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s !== VALID_KEY && !/\s/.test(s)),
        (invalidToken) => {
          const req = makeRequest({ Authorization: `Bearer ${invalidToken}` });
          const result = authenticateRequest(req);
          expect(result.authenticated).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('unauthorizedResponse() always returns status 401 for any error string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (errorMessage) => {
          const response = unauthorizedResponse(errorMessage);
          expect(response.status).toBe(401);
          expect(response.headers.get('Content-Type')).toBe('application/json');
        }
      ),
      { numRuns: 100 }
    );
  });
});
