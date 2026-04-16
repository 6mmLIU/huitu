/**
 * NL_Parser 自然语言解析服务
 * 封装 LLM API 调用，将自然语言文本解析为 IR JSON AST
 *
 * 需求：1.1, 1.2, 8.1, 8.2, 8.3, 10.3
 */

import { validateIR } from '@/lib/ir-validator';
import type { IR } from '@/types/ir';

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
}

IMPORTANT: The root object MUST always contain all five required fields: "version", "metadata", "nodes", "edges", "groups".
Even if there are no groups, you MUST include "groups": [].`;

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
  const trimmed = raw.trim();

  // 1. Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to fallback strategies
  }

  // 2. Markdown code block (```json ... ``` or ``` ... ```)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Find the first { ... } or [ ... ] top-level balanced block
  const jsonStr = extractBalancedJSON(trimmed);
  if (jsonStr) {
    try {
      return JSON.parse(jsonStr);
    } catch {
      // continue
    }
  }

  throw new Error('Response is not valid JSON');
}

/**
 * Extract the first balanced JSON object or array from a string
 * that may contain surrounding prose or markdown.
 */
function extractBalancedJSON(text: string): string | null {
  const startIdx = text.search(/[{[]/);
  if (startIdx === -1) return null;

  const open = text[startIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) {
      return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * Normalize LLM output to ensure required IR fields exist.
 * Some models omit empty arrays like "groups": [].
 */
function normalizeIR(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const ir = obj as Record<string, unknown>;
  if (!Array.isArray(ir.groups)) {
    ir.groups = [];
  }
  if (!Array.isArray(ir.nodes)) {
    ir.nodes = [];
  }
  if (!Array.isArray(ir.edges)) {
    ir.edges = [];
  }
  return ir;
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

// ── Fallback IR Generation ───────────────────────────────────

/** Cap label length to keep the chart readable */
const capLabel = (s: string) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

/** Remove markdown / list markers from a line, return clean text */
function stripMarkers(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')       // markdown headings
    .replace(/^\d+[\.\)、]\s*/, '')   // numbered lists: 1. 1) 1、
    .replace(/^[-*+•·]\s*/, '')      // bullet lists
    .replace(/^\s*/, '')
    .trim();
}

/**
 * Parsed line with detected heading depth.
 * depth 0 = top-level heading (#), depth 1 = ## , etc.
 * depth -1 = regular content line (leaf)
 */
interface ParsedLine {
  raw: string;
  text: string;
  depth: number; // heading depth (0-based), -1 for content
}

/**
 * Parse text into structured lines, detecting headings and hierarchy.
 */
function parseLines(text: string): ParsedLine[] {
  const lines = text.split('\n');
  const result: ParsedLine[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;

    // Markdown headings: # = depth 0, ## = depth 1, etc.
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      result.push({ raw, text: headingMatch[2].trim(), depth: headingMatch[1].length - 1 });
      continue;
    }

    // Numbered / bullet items at different indentation levels
    const indentMatch = raw.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const cleaned = stripMarkers(trimmed);
    if (cleaned.length === 0) continue;

    // Treat indented items or list items as deeper levels
    const isList = /^(\d+[\.\)、]|[-*+•·])\s/.test(trimmed);
    if (isList) {
      // indent-based depth: 0-1 spaces = depth 1, 2-3 = depth 2, etc.
      const listDepth = Math.floor(indent / 2) + 1;
      result.push({ raw, text: cleaned, depth: listDepth });
    } else {
      // Plain text line — treat as content at depth -1
      result.push({ raw, text: cleaned, depth: -1 });
    }
  }

  return result;
}

/**
 * Tree node used during fallback IR construction.
 */
interface TreeNode {
  id: string;
  label: string;
  children: TreeNode[];
  depth: number;
}

/**
 * Build a tree from parsed lines.
 * Headings / list items become parent nodes; content lines become leaves.
 */
function buildTree(parsed: ParsedLine[], language: 'zh' | 'en'): TreeNode {
  let nodeCounter = 0;
  const nextId = () => `node_${++nodeCounter}`;

  // Virtual root
  const root: TreeNode = {
    id: nextId(),
    label: '',
    children: [],
    depth: -1,
  };

  // Stack tracks the current parent chain: [root, h1, h2, ...]
  const stack: TreeNode[] = [root];

  for (const line of parsed) {
    const node: TreeNode = {
      id: nextId(),
      label: capLabel(line.text),
      children: [],
      depth: line.depth,
    };

    if (line.depth === -1) {
      // Content line → attach to current deepest parent
      stack[stack.length - 1].children.push(node);
    } else {
      // Heading / list item → find the right parent
      // Pop stack until we find a parent with lower depth
      while (stack.length > 1 && stack[stack.length - 1].depth >= line.depth) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }

  // If root has only content children and no structure, try sentence splitting
  if (root.children.length === 0 || (root.children.every(c => c.depth === -1) && root.children.length <= 2)) {
    return buildTreeFromSentences(parsed.map(p => p.text).join(' '), language, nodeCounter);
  }

  // Set root label
  if (root.children.length === 1 && root.children[0].children.length > 0) {
    // Single top-level heading → promote it as root label
    root.label = root.children[0].label;
    root.children = root.children[0].children;
  } else {
    root.label = language === 'zh' ? '主题' : 'Overview';
  }

  return root;
}

/**
 * Fallback for unstructured text: split by sentences and group by
 * topic proximity (every ~3 sentences form a group).
 */
function buildTreeFromSentences(text: string, language: 'zh' | 'en', startCounter: number): TreeNode {
  let nodeCounter = startCounter;
  const nextId = () => `node_${++nodeCounter}`;

  const sentences = text
    .split(/[。！？；\n;!?]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) {
    return {
      id: nextId(),
      label: language === 'zh' ? '流程' : 'Process',
      children: [],
      depth: 0,
    };
  }

  // If very few sentences, just make a flat tree
  if (sentences.length <= 3) {
    return {
      id: nextId(),
      label: language === 'zh' ? '概述' : 'Overview',
      children: sentences.map(s => ({
        id: nextId(),
        label: capLabel(s),
        children: [],
        depth: 1,
      })),
      depth: 0,
    };
  }

  // Group sentences into chunks of ~3 for visual structure
  const chunkSize = 3;
  const groups: TreeNode[] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize);
    const groupLabel = capLabel(chunk[0]); // Use first sentence as group title
    groups.push({
      id: nextId(),
      label: groupLabel,
      children: chunk.slice(1).map(s => ({
        id: nextId(),
        label: capLabel(s),
        children: [],
        depth: 2,
      })),
      depth: 1,
    });
  }

  return {
    id: nextId(),
    label: language === 'zh' ? '知识结构' : 'Knowledge Structure',
    children: groups,
    depth: 0,
  };
}

/**
 * Convert a tree structure into IR nodes, edges, and groups.
 */
function treeToIR(root: TreeNode, language: 'zh' | 'en'): IR {
  const nodes: IR['nodes'] = [];
  const edges: IR['edges'] = [];
  const groups: IR['groups'] = [];
  let edgeCounter = 0;
  let groupCounter = 0;

  const nextEdgeId = () => `edge_${++edgeCounter}`;
  const nextGroupId = () => `group_${++groupCounter}`;

  // Determine chart type based on tree shape
  const hasGroups = root.children.some(c => c.children.length > 0);
  const chartType = hasGroups ? 'tree' : 'sequential';

  function processNode(
    treeNode: TreeNode,
    parentGroupId?: string,
  ): void {
    const hasChildren = treeNode.children.length > 0;
    const nodeType = hasChildren ? 'subprocess' : 'process';

    nodes.push({
      id: treeNode.id,
      label: treeNode.label,
      type: nodeType,
      ...(parentGroupId ? { groupId: parentGroupId } : {}),
    });

    if (hasChildren) {
      // Create a group for this node's children
      const gid = nextGroupId();
      const childIds = treeNode.children.map(c => c.id);
      groups.push({
        id: gid,
        label: treeNode.label,
        children: childIds,
        ...(parentGroupId ? { parentGroupId } : {}),
      });

      // Process children and create edges from parent to each child
      for (const child of treeNode.children) {
        edges.push({
          id: nextEdgeId(),
          source: treeNode.id,
          target: child.id,
          type: 'normal',
        });
        processNode(child, gid);
      }
    }
  }

  // Process root
  processNode(root);

  return {
    version: '1.0',
    metadata: {
      title: root.label || (language === 'zh' ? '自动生成流程图' : 'Auto-generated flowchart'),
      createdAt: new Date().toISOString(),
      sourceLanguage: language,
      chartType,
    },
    nodes,
    edges,
    groups,
  };
}

/**
 * Build a structured fallback IR from user text.
 * Analyzes text structure (headings, lists, indentation) to produce
 * a tree/architecture chart with groups, not just a flat sequential chain.
 */
function buildFallbackIR(text: string, language: 'zh' | 'en'): IR {
  const parsed = parseLines(text);

  // If no meaningful lines were parsed, produce a minimal chart
  if (parsed.length === 0) {
    const label = language === 'zh' ? '空流程' : 'Empty process';
    return {
      version: '1.0',
      metadata: {
        title: label,
        createdAt: new Date().toISOString(),
        sourceLanguage: language,
        chartType: 'sequential',
      },
      nodes: [
        { id: 'node_1', label: language === 'zh' ? '开始' : 'Start', type: 'start' },
        { id: 'node_2', label, type: 'process' },
        { id: 'node_3', label: language === 'zh' ? '结束' : 'End', type: 'end' },
      ],
      edges: [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
      ],
      groups: [],
    };
  }

  const tree = buildTree(parsed, language);
  return treeToIR(tree, language);
}

// ── Main Entry Point ────────────────────────────────────────

export async function parseNaturalLanguage(
  request: ParseRequest,
): Promise<ParseResponse> {
  const { text, language } = request;

  // Empty input → still produce a minimal fallback chart
  if (!text || text.trim().length === 0) {
    return { success: true, ir: buildFallbackIR(language === 'zh' ? '空流程' : 'Empty process', language) };
  }

  const systemPrompt = buildSystemPrompt(language);
  const userPrompt = buildUserPrompt(text, language);

  // ── Attempt 1: call LLM ──────────────────────────────────
  let rawResponse: string | null = null;
  try {
    rawResponse = await callLLM(systemPrompt, userPrompt);
  } catch {
    // LLM call failed — will fall through to fallback
  }

  if (rawResponse) {
    // Try parse + validate
    try {
      const ir = normalizeIR(extractJSON(rawResponse));
      const validation = validateIR(ir);
      if (validation.valid) {
        return { success: true, ir: ir as IR };
      }
    } catch {
      // parse failed — try retry
    }

    // ── Attempt 2: retry once ────────────────────────────────
    try {
      const retryResponse = await callLLM(systemPrompt, userPrompt);
      const retryIR = normalizeIR(extractJSON(retryResponse));
      const retryValidation = validateIR(retryIR);
      if (retryValidation.valid) {
        return { success: true, ir: retryIR as IR };
      }
    } catch {
      // retry also failed — fall through to fallback
    }
  }

  // ── Fallback: build IR directly from user text ─────────────
  return { success: true, ir: buildFallbackIR(text, language) };
}
