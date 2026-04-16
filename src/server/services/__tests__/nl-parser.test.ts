/**
 * NL_Parser 单元测试
 *
 * 测试各图表类型的具体输入/输出示例、中英文双语解析、LLM 超时/错误重试和提示逻辑
 *
 * Validates: Requirements 1.2, 8.1, 10.3, 11.2, 11.3
 */
import type { IR } from '@/types/ir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseNaturalLanguage } from '../nl-parser';

// ── Helpers ─────────────────────────────────────────────────

/** Build a valid IR fixture for a given chart type */
function makeIR(overrides: Partial<IR> & { metadata: IR['metadata'] }): IR {
  return {
    version: '1.0',
    metadata: overrides.metadata,
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    groups: overrides.groups ?? [],
  };
}

/** Mock global fetch to return a given JSON content string as LLM response */
function mockLLMResponse(content: string) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );
}

/** Mock global fetch to reject with an abort error (timeout simulation) */
function mockLLMTimeout() {
  return vi.fn().mockImplementation(() => {
    const err = new DOMException('The operation was aborted', 'AbortError');
    return Promise.reject(err);
  });
}

/** Mock global fetch to return an HTTP error status */
function mockLLMHttpError(status: number, body = '') {
  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(body, { status, headers: { 'Content-Type': 'text/plain' } }),
    ),
  );
}

// ── Fixtures ────────────────────────────────────────────────

const sequentialIR: IR = makeIR({
  metadata: {
    createdAt: '2024-01-15T10:00:00Z',
    sourceLanguage: 'zh',
    chartType: 'sequential',
  },
  nodes: [
    { id: 'node_1', label: '开始', type: 'start' },
    { id: 'node_2', label: '收集数据', type: 'process' },
    { id: 'node_3', label: '分析数据', type: 'process' },
    { id: 'node_4', label: '结束', type: 'end' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
    { id: 'edge_3', source: 'node_3', target: 'node_4', type: 'normal' },
  ],
  groups: [],
});

const conditionalIR: IR = makeIR({
  metadata: {
    createdAt: '2024-01-15T10:00:00Z',
    sourceLanguage: 'zh',
    chartType: 'conditional',
  },
  nodes: [
    { id: 'node_1', label: '开始', type: 'start' },
    { id: 'node_2', label: '数据有效？', type: 'decision' },
    { id: 'node_3', label: '处理数据', type: 'process' },
    { id: 'node_4', label: '报告错误', type: 'process' },
    { id: 'node_5', label: '结束', type: 'end' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_2', target: 'node_3', label: '是', type: 'conditional' },
    { id: 'edge_3', source: 'node_2', target: 'node_4', label: '否', type: 'conditional' },
    { id: 'edge_4', source: 'node_3', target: 'node_5', type: 'normal' },
    { id: 'edge_5', source: 'node_4', target: 'node_5', type: 'normal' },
  ],
  groups: [],
});

const architectureIR: IR = makeIR({
  metadata: {
    createdAt: '2024-01-15T10:00:00Z',
    sourceLanguage: 'en',
    chartType: 'architecture',
  },
  nodes: [
    { id: 'node_1', label: 'Frontend', type: 'subprocess', groupId: 'group_1' },
    { id: 'node_2', label: 'Backend', type: 'subprocess', groupId: 'group_2' },
    { id: 'node_3', label: 'Database', type: 'process', groupId: 'group_2' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
  ],
  groups: [
    { id: 'group_1', label: 'Presentation Layer', children: ['node_1'] },
    { id: 'group_2', label: 'Data Layer', children: ['node_2', 'node_3'] },
  ],
});

const treeIR: IR = makeIR({
  metadata: {
    createdAt: '2024-01-15T10:00:00Z',
    sourceLanguage: 'en',
    chartType: 'tree',
  },
  nodes: [
    { id: 'node_1', label: 'Root Module', type: 'process' },
    { id: 'node_2', label: 'Auth Module', type: 'process' },
    { id: 'node_3', label: 'Data Module', type: 'process' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_1', target: 'node_3', type: 'normal' },
  ],
  groups: [],
});

const englishSequentialIR: IR = makeIR({
  metadata: {
    createdAt: '2024-01-15T10:00:00Z',
    sourceLanguage: 'en',
    chartType: 'sequential',
  },
  nodes: [
    { id: 'node_1', label: 'Start', type: 'start' },
    { id: 'node_2', label: 'Collect Data', type: 'process' },
    { id: 'node_3', label: 'End', type: 'end' },
  ],
  edges: [
    { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
    { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
  ],
  groups: [],
});

// ── Tests ───────────────────────────────────────────────────

describe('NL_Parser 单元测试', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  // ── 1. Chart type input/output examples (Req 1.2, 8.1) ──

  describe('各图表类型解析示例', () => {
    it('sequential: 解析顺序流程描述并返回 sequential IR', async () => {
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(sequentialIR)));

      const result = await parseNaturalLanguage({
        text: '首先收集数据，然后分析数据',
        language: 'zh',
      });

      expect(result.success).toBe(true);
      expect(result.ir).toBeDefined();
      expect(result.ir!.metadata.chartType).toBe('sequential');
      expect(result.ir!.nodes.length).toBe(4);
      expect(result.ir!.edges.every((e) => e.type === 'normal')).toBe(true);
    });

    it('conditional: 解析条件分支描述并返回含 decision 节点的 IR', async () => {
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(conditionalIR)));

      const result = await parseNaturalLanguage({
        text: '读取数据后判断数据是否有效，如果有效则处理数据，否则报告错误',
        language: 'zh',
      });

      expect(result.success).toBe(true);
      expect(result.ir!.metadata.chartType).toBe('conditional');
      const decisionNodes = result.ir!.nodes.filter((n) => n.type === 'decision');
      expect(decisionNodes.length).toBeGreaterThanOrEqual(1);
      const conditionalEdges = result.ir!.edges.filter((e) => e.type === 'conditional');
      expect(conditionalEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('architecture: 解析系统架构描述并返回含 groups 的 IR', async () => {
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(architectureIR)));

      const result = await parseNaturalLanguage({
        text: 'The system has a frontend presentation layer and a backend data layer with a database',
        language: 'en',
      });

      expect(result.success).toBe(true);
      expect(result.ir!.metadata.chartType).toBe('architecture');
      expect(result.ir!.groups.length).toBeGreaterThanOrEqual(1);
    });

    it('tree: 解析树形模块描述并返回 tree IR', async () => {
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(treeIR)));

      const result = await parseNaturalLanguage({
        text: 'Root module contains auth module and data module',
        language: 'en',
      });

      expect(result.success).toBe(true);
      expect(result.ir!.metadata.chartType).toBe('tree');
      expect(result.ir!.nodes.length).toBe(3);
    });
  });

  // ── 2. Bilingual parsing examples (Req 10.3) ─────────────

  describe('中英文双语解析', () => {
    it('正确解析中文输入并返回 sourceLanguage=zh', async () => {
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(sequentialIR)));

      const result = await parseNaturalLanguage({
        text: '首先收集数据，然后分析数据',
        language: 'zh',
      });

      expect(result.success).toBe(true);
      expect(result.ir!.metadata.sourceLanguage).toBe('zh');
    });

    it('正确解析英文输入并返回 sourceLanguage=en', async () => {
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(englishSequentialIR)));

      const result = await parseNaturalLanguage({
        text: 'First collect data, then end',
        language: 'en',
      });

      expect(result.success).toBe(true);
      expect(result.ir!.metadata.sourceLanguage).toBe('en');
    });

    it('中文输入返回中文错误提示', async () => {
      const result = await parseNaturalLanguage({
        text: '',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('不能为空');
    });

    it('英文输入返回英文错误提示', async () => {
      const result = await parseNaturalLanguage({
        text: '',
        language: 'en',
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('cannot be empty');
    });
  });

  // ── 3. LLM timeout/error retry and prompt logic (Req 11.2, 11.3) ──

  describe('LLM 超时/错误处理', () => {
    it('LLM 超时返回 LLM_TIMEOUT 错误码', async () => {
      vi.stubGlobal('fetch', mockLLMTimeout());

      const result = await parseNaturalLanguage({
        text: '测试超时',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LLM_TIMEOUT');
    });

    it('LLM HTTP 500 返回 LLM_ERROR 错误码', async () => {
      vi.stubGlobal('fetch', mockLLMHttpError(500, 'Internal Server Error'));

      const result = await parseNaturalLanguage({
        text: '测试服务器错误',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LLM_ERROR');
      expect(result.error!.message).toContain('500');
    });

    it('LLM HTTP 429 返回 LLM_ERROR 错误码', async () => {
      vi.stubGlobal('fetch', mockLLMHttpError(429, 'Rate limited'));

      const result = await parseNaturalLanguage({
        text: 'test rate limit',
        language: 'en',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LLM_ERROR');
    });

    it('缺少 OPENAI_API_KEY 时返回 LLM_ERROR', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await parseNaturalLanguage({
        text: '测试缺少 API Key',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LLM_ERROR');
    });

    it('LLM 返回空内容时返回 LLM_ERROR', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({ choices: [{ message: { content: '' } }] }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          ),
        ),
      );

      const result = await parseNaturalLanguage({
        text: '测试空响应',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LLM_ERROR');
    });
  });

  // ── 4. Schema validation failure auto-retry (Req 11.3) ───

  describe('Schema 校验失败自动重试', () => {
    it('首次校验失败后重试成功则返回有效 IR', async () => {
      const invalidIR = { version: '1.0', metadata: {}, nodes: [] };
      let callCount = 0;

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          const content =
            callCount === 1
              ? JSON.stringify(invalidIR)
              : JSON.stringify(sequentialIR);
          return Promise.resolve(
            new Response(
              JSON.stringify({ choices: [{ message: { content } }] }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }),
      );

      const result = await parseNaturalLanguage({
        text: '首先收集数据，然后分析数据',
        language: 'zh',
      });

      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.ir).toBeDefined();
    });

    it('两次校验均失败则返回 SCHEMA_INVALID 错误', async () => {
      const invalidIR = { version: '1.0', metadata: {}, nodes: [] };
      vi.stubGlobal('fetch', mockLLMResponse(JSON.stringify(invalidIR)));

      const result = await parseNaturalLanguage({
        text: '首先收集数据，然后分析数据',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('SCHEMA_INVALID');
      expect(result.error!.suggestions).toBeDefined();
      expect(result.error!.suggestions!.length).toBeGreaterThan(0);
    });

    it('首次校验失败、重试时 LLM 超时则返回 LLM_TIMEOUT', async () => {
      const invalidIR = { version: '1.0', metadata: {}, nodes: [] };
      let callCount = 0;

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  choices: [{ message: { content: JSON.stringify(invalidIR) } }],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              ),
            );
          }
          return Promise.reject(
            new DOMException('The operation was aborted', 'AbortError'),
          );
        }),
      );

      const result = await parseNaturalLanguage({
        text: '测试重试超时',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('LLM_TIMEOUT');
    });

    it('LLM 返回非 JSON 内容时返回 PARSE_FAILED 并附带建议', async () => {
      vi.stubGlobal('fetch', mockLLMResponse('This is not JSON at all'));

      const result = await parseNaturalLanguage({
        text: '测试非 JSON 响应',
        language: 'zh',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('PARSE_FAILED');
      expect(result.error!.suggestions).toBeDefined();
      expect(result.error!.suggestions!.length).toBeGreaterThan(0);
    });
  });
});
