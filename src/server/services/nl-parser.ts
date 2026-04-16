/**
 * NL_Parser 自然语言解析服务
 * 封装 LLM API 调用，将自然语言文本解析为 IR JSON AST
 *
 * 需求：1.1, 1.2, 8.1, 8.2, 8.3, 10.3
 */

import { validateIR } from '@/lib/ir-validator';
import { type IR } from '@/types/ir';

// ── Interfaces ──────────────────────────────────────────────

export interface ParseRequest {
  text: string;
  language: 'zh' | 'en';
}

export interface ParseResponse {
  success: boolean;
  ir?: IR;
  error?: {
    code: 'PARSE_FAILED' | 'SCHEMA_INVALID' | 'LLM_TIMEOUT' | 'LLM_ERROR';
    message: string;
    suggestions?: string[];
  };
}

// ── Constants ───────────────────────────────────────────────

const LLM_TIMEOUT_MS = 30_000;

// ── Prompt Templates ────────────────────────────────────────

const IR_SCHEMA_DESCRIPTION = `{
  "version": "1.0",
  "metadata": {
    "title": "string (optional, brief title for the chart)",
    "createdAt": "string (ISO 8601 datetime)",
    "sourceLanguage": "zh" | "en",
    "chartType": "sequential" | "conditional" | "architecture" | "tree"
  },
  "nodes": [
    {
      "id": "string (format: node_<unique_number>, e.g. node_1)",
      "label": "string (non-empty display text)",
      "type": "process" | "decision" | "start" | "end" | "subprocess"
    }
  ],
  "edges": [
    {
      "id": "string (format: edge_<unique_number>, e.g. edge_1)",
      "source": "string (source node id)",
      "target": "string (target node id)",
      "label": "string (optional, edge label such as Yes/No)",
      "type": "normal" | "conditional"
    }
  ],
  "groups": [
    {
      "id": "string (format: group_<unique_number>, e.g. group_1)",
      "label": "string (group title)",
      "children": ["string (node or sub-group ids)"],
      "parentGroupId": "string (optional, parent group id)"
    }
  ]
}`;

const CHART_TYPE_GUIDANCE: Record<string, { zh: string; en: string }> = {
  sequential: {
    zh: '顺序流程图：使用 start → process → ... → end 的线性结构，边类型为 normal。',
    en: 'Sequential flowchart: use a linear start → process → ... → end structure with normal edges.',
  },
  conditional: {
    zh: '条件分支流程图：包含 decision 节点，每个 decision 节点必须有至少一条 conditional 类型的出边（如"是"/"否"）。',
    en: 'Conditional flowchart: include decision nodes. Each decision node MUST have at least one outgoing edge of type "conditional" (e.g. "Yes"/"No").',
  },
  architecture: {
    zh: '系统架构图（分层）：使用 groups 表达层级包含关系，节点类型多为 subprocess 和 process。',
    en: 'Architecture diagram (layered): use groups to express hierarchical containment. Node types are mostly subprocess and process.',
  },
  tree: {
    zh: '功能模块图（树形）：使用 groups 和层级边表达树形结构，从根节点向下展开。',
    en: 'Tree diagram: use groups and hierarchical edges to express a tree structure expanding from a root node.',
  },
};

function buildSystemPrompt(language: 'zh' | 'en'): string {
  if (language === 'zh') {
    return `你是一个专业的流程图结构分析助手。你的任务是将用户的自然语言描述转换为严格符合 IR JSON Schema 的 JSON AST。

规则：
1. 只输出合法的 JSON，不要输出任何其他文字、解释或 markdown 代码块标记。
2. 所有节点 id 格式为 node_<数字>，边 id 格式为 edge_<数字>，分组 id 格式为 group_<数字>。
3. 每条边的 source 和 target 必须引用已存在的节点 id。
4. 每个分组的 children 必须引用已存在的节点 id 或分组 id。
5. 不要添加用户未描述的节点或关系（不要产生幻觉内容）。
6. createdAt 使用当前时间的 ISO 8601 格式。
7. 根据用户描述自动判断最合适的 chartType。

图表类型指南：
- ${CHART_TYPE_GUIDANCE.sequential.zh}
- ${CHART_TYPE_GUIDANCE.conditional.zh}
- ${CHART_TYPE_GUIDANCE.architecture.zh}
- ${CHART_TYPE_GUIDANCE.tree.zh}

IR JSON Schema 结构：
${IR_SCHEMA_DESCRIPTION}`;
  }

  return `You are a professional flowchart structure analysis assistant. Your task is to convert the user's natural language description into a JSON AST that strictly conforms to the IR JSON Schema.

Rules:
1. Output ONLY valid JSON. Do not output any other text, explanations, or markdown code block markers.
2. All node ids must follow the format node_<number>, edge ids edge_<number>, group ids group_<number>.
3. Every edge's source and target must reference an existing node id.
4. Every group's children must reference existing node or group ids.
5. Do NOT add nodes or relationships not described by the user (no hallucinated content).
6. Use current time in ISO 8601 format for createdAt.
7. Automatically determine the most appropriate chartType based on the user's description.

Chart type guidance:
- ${CHART_TYPE_GUIDANCE.sequential.en}
- ${CHART_TYPE_GUIDANCE.conditional.en}
- ${CHART_TYPE_GUIDANCE.architecture.en}
- ${CHART_TYPE_GUIDANCE.tree.en}

IR JSON Schema structure:
${IR_SCHEMA_DESCRIPTION}`;
}

function buildUserPrompt(text: string, language: 'zh' | 'en'): string {
  if (language === 'zh') {
    return `请将以下描述转换为 IR JSON：\n\n${text}`;
  }
  return `Please convert the following description into IR JSON:\n\n${text}`;
}

// ── LLM API Call ────────────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

  if (!apiKey) {
    throw new LLMError('LLM_ERROR', 'OPENAI_API_KEY environment variable is not set');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new LLMError(
        'LLM_ERROR',
        `LLM API returned HTTP ${response.status}: ${body}`,
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new LLMError('LLM_ERROR', 'LLM returned empty response');
    }

    return content;
  } catch (err: unknown) {
    if (err instanceof LLMError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new LLMError('LLM_TIMEOUT', 'LLM API call timed out after 30 seconds');
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new LLMError('LLM_ERROR', `LLM API call failed: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Error Class ─────────────────────────────────────────────

class LLMError extends Error {
  constructor(
    public code: 'LLM_TIMEOUT' | 'LLM_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// ── JSON Extraction ─────────────────────────────────────────

function extractJSON(raw: string): unknown {
  // Try direct parse first
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try extracting from markdown code block
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }
    throw new Error('Response is not valid JSON');
  }
}

// ── Suggestions ─────────────────────────────────────────────

function getSuggestions(language: 'zh' | 'en'): string[] {
  if (language === 'zh') {
    return [
      '请使用更明确的步骤描述，例如："首先…，然后…，最后…"',
      '尝试描述具体的流程节点和它们之间的关系',
      '如果包含条件判断，请明确说明条件和分支结果',
    ];
  }
  return [
    'Use clearer step descriptions, e.g. "First..., then..., finally..."',
    'Try describing specific process nodes and their relationships',
    'If there are conditions, clearly state the condition and branch outcomes',
  ];
}

// ── Main Entry Point ────────────────────────────────────────

export async function parseNaturalLanguage(
  request: ParseRequest,
): Promise<ParseResponse> {
  const { text, language } = request;

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message: language === 'zh' ? '输入文本不能为空' : 'Input text cannot be empty',
        suggestions: getSuggestions(language),
      },
    };
  }

  const systemPrompt = buildSystemPrompt(language);
  const userPrompt = buildUserPrompt(text, language);

  let rawResponse: string;
  try {
    rawResponse = await callLLM(systemPrompt, userPrompt);
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      return {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'LLM_ERROR',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // First attempt: parse and validate
  let ir: unknown;
  try {
    ir = extractJSON(rawResponse);
  } catch {
    return {
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message:
          language === 'zh'
            ? '无法解析 LLM 返回的 JSON 结构'
            : 'Failed to parse JSON from LLM response',
        suggestions: getSuggestions(language),
      },
    };
  }

  const firstValidation = validateIR(ir);
  if (firstValidation.valid) {
    return { success: true, ir: ir as IR };
  }

  // Retry once on schema validation failure
  try {
    const retryResponse = await callLLM(systemPrompt, userPrompt);
    const retryIR = extractJSON(retryResponse);
    const retryValidation = validateIR(retryIR);

    if (retryValidation.valid) {
      return { success: true, ir: retryIR as IR };
    }

    return {
      success: false,
      error: {
        code: 'SCHEMA_INVALID',
        message:
          language === 'zh'
            ? `生成结果不符合 IR Schema 规范：${retryValidation.errors?.join('; ') ?? ''}`
            : `Generated result does not conform to IR Schema: ${retryValidation.errors?.join('; ') ?? ''}`,
        suggestions: getSuggestions(language),
      },
    };
  } catch (err: unknown) {
    if (err instanceof LLMError) {
      return {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'SCHEMA_INVALID',
        message:
          language === 'zh'
            ? `生成结果不符合 IR Schema 规范：${firstValidation.errors?.join('; ') ?? ''}`
            : `Generated result does not conform to IR Schema: ${firstValidation.errors?.join('; ') ?? ''}`,
        suggestions: getSuggestions(language),
      },
    };
  }
}
