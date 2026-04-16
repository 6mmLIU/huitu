/**
 * Unit tests for POST /api/parse route handler
 *
 * 需求：1.1, 11.1, 11.2, 11.3
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/services/nl-parser');
vi.mock('@/server/middleware/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/middleware/auth')>();
  return {
    ...actual,
    authenticateRequest: vi.fn(),
  };
});
vi.mock('@/server/middleware/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/middleware/rate-limiter')>();
  return {
    ...actual,
    checkRateLimit: vi.fn(),
  };
});

import { POST } from '@/app/api/parse/route';
import { authenticateRequest } from '@/server/middleware/auth';
import { checkRateLimit } from '@/server/middleware/rate-limiter';
import { parseNaturalLanguage } from '@/server/services/nl-parser';

const mockAuth = vi.mocked(authenticateRequest);
const mockRateLimit = vi.mocked(checkRateLimit);
const mockParse = vi.mocked(parseNaturalLanguage);

function makeRequest(body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'valid-key',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost/api/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'valid-key',
    },
    body: 'not-json{{{',
  });
}

describe('POST /api/parse', () => {
  beforeEach(() => {
    mockAuth.mockReturnValue({ authenticated: true });
    mockRateLimit.mockReturnValue({ allowed: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Auth ──────────────────────────────────────────────

  it('should return 401 when authentication fails', async () => {
    mockAuth.mockReturnValue({ authenticated: false, error: 'Missing credentials' });
    const res = await POST(makeRequest({ text: 'hello', language: 'en' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // ── Rate Limiting ─────────────────────────────────────

  it('should return 429 when rate limited', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, retryAfter: 30 });
    const res = await POST(makeRequest({ text: 'hello', language: 'en' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  // ── Request Validation ────────────────────────────────

  it('should return 400 for invalid JSON body', async () => {
    const res = await POST(makeInvalidJsonRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('should return 400 when text field is missing', async () => {
    const res = await POST(makeRequest({ language: 'en' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toContain('text');
  });

  it('should return 400 when text is empty string', async () => {
    const res = await POST(makeRequest({ text: '   ', language: 'en' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('should return 400 when language is invalid', async () => {
    const res = await POST(makeRequest({ text: 'hello', language: 'fr' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(body.error.message).toContain('language');
  });

  it('should return 400 when language is missing', async () => {
    const res = await POST(makeRequest({ text: 'hello' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  // ── Successful Parse ──────────────────────────────────

  it('should return 200 with IR on successful parse', async () => {
    const mockIR = {
      version: '1.0' as const,
      metadata: { createdAt: new Date().toISOString(), sourceLanguage: 'en' as const, chartType: 'sequential' as const },
      nodes: [{ id: 'node_1', label: 'Start', type: 'start' as const }],
      edges: [],
      groups: [],
    };
    mockParse.mockResolvedValue({ success: true, ir: mockIR });

    const res = await POST(makeRequest({ text: 'Start the process', language: 'en' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ir).toEqual(mockIR);
  });

  it('should pass correct text and language to NL_Parser', async () => {
    mockParse.mockResolvedValue({ success: true, ir: {} as any });

    await POST(makeRequest({ text: '数据处理流程', language: 'zh' }));
    expect(mockParse).toHaveBeenCalledWith({ text: '数据处理流程', language: 'zh' });
  });

  // ── Error Handling: Parse Failed (Req 11.1) ──────────

  it('should return 422 with suggestions when parse fails', async () => {
    mockParse.mockResolvedValue({
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message: 'Cannot identify flow structure',
        suggestions: ['Use clearer step descriptions'],
      },
    });

    const res = await POST(makeRequest({ text: 'random gibberish', language: 'en' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PARSE_FAILED');
    expect(body.error.message).toBeTruthy();
    expect(body.error.retryable).toBe(false);
  });

  // ── Error Handling: LLM Timeout (Req 11.2) ───────────

  it('should return 504 when LLM times out', async () => {
    mockParse.mockResolvedValue({
      success: false,
      error: { code: 'LLM_TIMEOUT', message: 'LLM API call timed out' },
    });

    const res = await POST(makeRequest({ text: 'some text', language: 'en' }));
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.code).toBe('LLM_TIMEOUT');
    expect(body.error.retryable).toBe(true);
  });

  // ── Error Handling: LLM Error (Req 11.2) ─────────────

  it('should return 502 when LLM returns an error', async () => {
    mockParse.mockResolvedValue({
      success: false,
      error: { code: 'LLM_ERROR', message: 'LLM API returned HTTP 500' },
    });

    const res = await POST(makeRequest({ text: 'some text', language: 'en' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('LLM_ERROR');
    expect(body.error.retryable).toBe(true);
  });

  // ── Error Handling: Schema Invalid (Req 11.3) ────────

  it('should return 502 when IR schema validation fails', async () => {
    mockParse.mockResolvedValue({
      success: false,
      error: { code: 'SCHEMA_INVALID', message: 'Generated result does not conform to IR Schema' },
    });

    const res = await POST(makeRequest({ text: 'some text', language: 'en' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('SCHEMA_INVALID');
    expect(body.error.retryable).toBe(true);
  });

  // ── Client IP extraction ─────────────────────────────

  it('should extract client IP from x-forwarded-for header', async () => {
    mockParse.mockResolvedValue({ success: true, ir: {} as any });

    await POST(makeRequest({ text: 'hello', language: 'en' }, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));
    expect(mockRateLimit).toHaveBeenCalledWith('1.2.3.4');
  });

  it('should use "unknown" when no IP headers present', async () => {
    mockParse.mockResolvedValue({ success: true, ir: {} as any });

    const req = new Request('http://localhost/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'valid-key' },
      body: JSON.stringify({ text: 'hello', language: 'en' }),
    });
    await POST(req);
    expect(mockRateLimit).toHaveBeenCalledWith('unknown');
  });
});
