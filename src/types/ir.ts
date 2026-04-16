/**
 * IR (Intermediate Representation) — JSON AST 格式
 * 连接 NL_Parser 和 Render_Engine 的核心数据结构
 */

export interface IRMetadata {
  title?: string;
  createdAt: string; // ISO 8601
  sourceLanguage: 'zh' | 'en';
  chartType: 'sequential' | 'conditional' | 'architecture' | 'tree';
}

export interface IRNode {
  id: string; // node_<uuid>
  label: string;
  type: 'process' | 'decision' | 'start' | 'end' | 'subprocess';
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  groupId?: string;
}

export interface IREdge {
  id: string; // edge_<uuid>
  source: string;
  target: string;
  label?: string;
  type: 'normal' | 'conditional';
}

export interface IRGroup {
  id: string; // group_<uuid>
  label: string;
  children: string[];
  parentGroupId?: string;
}

export interface IR {
  version: '1.0';
  metadata: IRMetadata;
  nodes: IRNode[];
  edges: IREdge[];
  groups: IRGroup[];
}
