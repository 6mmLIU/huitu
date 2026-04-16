import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    authenticateRequest,
    unauthorizedResponse,
} from './auth';

const VALID_KEY = 'test-api-key-12345';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers,
  });
}

describe('authenticateRequest', () => {
  beforeEach(() => {
    process.env.PAPERFLOW_API_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.PAPERFLOW_API_KEY;
  });

  it('should authenticate with valid x-api-key header', () => {
    const req = makeRequest({ 'x-api-key': VALID_KEY });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should authenticate with valid Bearer token', () => {
    const req = makeRequest({ Authorization: `Bearer ${VALID_KEY}` });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject request with no credentials', () => {
    const req = makeRequest();
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should reject request with invalid x-api-key', () => {
    const req = makeRequest({ 'x-api-key': 'wrong-key' });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('should reject request with invalid Bearer token', () => {
    const req = makeRequest({ Authorization: 'Bearer wrong-token' });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('should reject malformed Authorization header (no Bearer prefix)', () => {
    const req = makeRequest({ Authorization: VALID_KEY });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should reject empty Authorization Bearer value', () => {
    const req = makeRequest({ Authorization: 'Bearer ' });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should prefer x-api-key over Authorization header', () => {
    const req = makeRequest({
      'x-api-key': VALID_KEY,
      Authorization: 'Bearer wrong-token',
    });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(true);
  });

  it('should fail when PAPERFLOW_API_KEY env var is not set', () => {
    delete process.env.PAPERFLOW_API_KEY;
    const req = makeRequest({ 'x-api-key': 'any-key' });
    const result = authenticateRequest(req);
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('API key not set');
  });
});

describe('unauthorizedResponse', () => {
  it('should return 401 status', async () => {
    const res = unauthorizedResponse('test error');
    expect(res.status).toBe(401);
  });

  it('should return JSON body with error details', async () => {
    const res = unauthorizedResponse('test error');
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'test error',
        retryable: false,
      },
    });
  });

  it('should set Content-Type to application/json', () => {
    const res = unauthorizedResponse('test error');
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });
});
