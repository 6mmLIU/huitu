/**
 * Render_Engine — 布局计算模块
 *
 * Integrates Dagre (default) and ELK (complex graphs) layout algorithms.
 * Selects layout strategy based on IR chartType:
 *   - sequential / conditional → top-to-bottom (TB)
 *   - tree → hierarchical layout (TB with wider spacing)
 *   - architecture → layered layout (LR with compound groups)
 *
 * Requirements: 1.3, 8.4
 */

import type { IR, IRNode } from '@/types/ir';
import type { StyleConfig } from '@/types/style';
import dagre from 'dagre';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RenderOptions {
  ir: IR;
  style: StyleConfig;
  layoutEngine: 'dagre' | 'elk';
}

/** A node with resolved position and size after layout. */
export interface PositionedNode extends IRNode {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** Edge routing points produced by the layout engine. */
export interface PositionedEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'normal' | 'conditional';
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  dimensions: { width: number; height: number };
}

export interface RenderResult {
  layout: LayoutResult;
  dimensions: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Layout strategy configuration
// ---------------------------------------------------------------------------

export type LayoutDirection = 'TB' | 'LR';

export interface LayoutStrategy {
  rankdir: LayoutDirection;
  nodesep: number;
  ranksep: number;
  edgesep: number;
  compound: boolean;
}

/**
 * Returns the layout strategy for a given chartType.
 * - sequential / conditional: top-to-bottom, standard spacing
 * - tree: top-to-bottom, wider horizontal spacing for hierarchy
 * - architecture: left-to-right, compound grouping enabled
 */
export function getLayoutStrategy(
  chartType: IR['metadata']['chartType'],
): LayoutStrategy {
  switch (chartType) {
    case 'sequential':
    case 'conditional':
      return {
        rankdir: 'TB',
        nodesep: 50,
        ranksep: 60,
        edgesep: 20,
        compound: false,
      };
    case 'tree':
      return {
        rankdir: 'TB',
        nodesep: 80,
        ranksep: 70,
        edgesep: 20,
        compound: false,
      };
    case 'architecture':
      return {
        rankdir: 'TB',
        nodesep: 60,
        ranksep: 80,
        edgesep: 20,
        compound: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Node sizing helpers
// ---------------------------------------------------------------------------

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;
const DECISION_NODE_WIDTH = 160;
const DECISION_NODE_HEIGHT = 70;
const START_END_WIDTH = 100;
const START_END_HEIGHT = 40;

function getNodeSize(node: IRNode): { width: number; height: number } {
  // Estimate width based on label length (rough heuristic)
  const labelWidth = Math.max(node.label.length * 10, 60);

  switch (node.type) {
    case 'decision':
      return {
        width: Math.max(DECISION_NODE_WIDTH, labelWidth + 40),
        height: DECISION_NODE_HEIGHT,
      };
    case 'start':
    case 'end':
      return {
        width: Math.max(START_END_WIDTH, labelWidth + 20),
        height: START_END_HEIGHT,
      };
    case 'process':
    case 'subprocess':
    default:
      return {
        width: Math.max(DEFAULT_NODE_WIDTH, labelWidth + 20),
        height: DEFAULT_NODE_HEIGHT,
      };
  }
}

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------

function layoutWithDagre(ir: IR, strategy: LayoutStrategy): LayoutResult {
  const g = new dagre.graphlib.Graph({ compound: strategy.compound });

  g.setGraph({
    rankdir: strategy.rankdir,
    nodesep: strategy.nodesep,
    ranksep: strategy.ranksep,
    edgesep: strategy.edgesep,
    marginx: 20,
    marginy: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  for (const node of ir.nodes) {
    const size = getNodeSize(node);
    g.setNode(node.id, {
      label: node.label,
      width: size.width,
      height: size.height,
    });
  }

  // Add edges
  for (const edge of ir.edges) {
    // Only add edge if both source and target exist
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target, {
        label: edge.label ?? '',
      });
    }
  }

  // Set up compound groups (architecture charts)
  if (strategy.compound && ir.groups.length > 0) {
    for (const group of ir.groups) {
      g.setNode(group.id, { label: group.label, clusterLabelPos: 'top' });
      for (const childId of group.children) {
        g.setParent(childId, group.id);
      }
      if (group.parentGroupId) {
        g.setParent(group.id, group.parentGroupId);
      }
    }
  }

  // Run dagre layout
  dagre.layout(g);

  // Extract positioned nodes
  const positionedNodes: PositionedNode[] = ir.nodes.map((node) => {
    const layoutNode = g.node(node.id);
    const size = getNodeSize(node);
    return {
      ...node,
      position: {
        // dagre returns center coordinates; convert to top-left
        x: layoutNode.x - size.width / 2,
        y: layoutNode.y - size.height / 2,
      },
      size: {
        width: size.width,
        height: size.height,
      },
    };
  });

  // Extract positioned edges
  const positionedEdges: PositionedEdge[] = ir.edges
    .filter(
      (edge) => g.hasNode(edge.source) && g.hasNode(edge.target),
    )
    .map((edge) => {
      const layoutEdge = g.edge(edge.source, edge.target);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
        points: layoutEdge?.points ?? [],
      };
    });

  // Calculate overall dimensions
  const graphLabel = g.graph();
  const dimensions = {
    width: (graphLabel.width ?? 0) + 40,
    height: (graphLabel.height ?? 0) + 40,
  };

  return { nodes: positionedNodes, edges: positionedEdges, dimensions };
}

// ---------------------------------------------------------------------------
// ELK layout
// ---------------------------------------------------------------------------

async function layoutWithElk(
  ir: IR,
  strategy: LayoutStrategy,
): Promise<LayoutResult> {
  // Dynamic import to avoid bundling ELK when not needed
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELK();

  const elkDirection =
    strategy.rankdir === 'LR' ? 'RIGHT' : 'DOWN';

  // Build ELK graph
  const elkChildren = ir.nodes.map((node) => {
    const size = getNodeSize(node);
    return {
      id: node.id,
      width: size.width,
      height: size.height,
      labels: [{ text: node.label }],
    };
  });

  const elkEdges = ir.edges
    .filter((edge) =>
      ir.nodes.some((n) => n.id === edge.source) &&
      ir.nodes.some((n) => n.id === edge.target),
    )
    .map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      labels: edge.label ? [{ text: edge.label }] : [],
    }));

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': String(strategy.nodesep),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(strategy.ranksep),
      'elk.layered.spacing.edgeEdgeBetweenLayers': String(strategy.edgesep),
      'elk.padding': '[top=20,left=20,bottom=20,right=20]',
    },
    children: elkChildren,
    edges: elkEdges,
  };

  const layoutResult = await elk.layout(elkGraph);

  // Extract positioned nodes
  const positionedNodes: PositionedNode[] = ir.nodes.map((node) => {
    const elkNode = layoutResult.children?.find((c) => c.id === node.id);
    const size = getNodeSize(node);
    return {
      ...node,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0,
      },
      size: {
        width: elkNode?.width ?? size.width,
        height: elkNode?.height ?? size.height,
      },
    };
  });

  // Extract positioned edges (ELK uses sections with start/end/bend points)
  const positionedEdges: PositionedEdge[] = ir.edges
    .filter((edge) =>
      ir.nodes.some((n) => n.id === edge.source) &&
      ir.nodes.some((n) => n.id === edge.target),
    )
    .map((edge) => {
      // ELK returns sections at runtime but its TS types don't include them
      const elkEdge = layoutResult.edges?.find((e) => e.id === edge.id) as
        | { sections?: Array<{ startPoint: { x: number; y: number }; endPoint: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }> }> }
        | undefined;
      const points: Array<{ x: number; y: number }> = [];
      if (elkEdge?.sections) {
        for (const section of elkEdge.sections) {
          points.push(section.startPoint);
          if (section.bendPoints) {
            points.push(...section.bendPoints);
          }
          points.push(section.endPoint);
        }
      }
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
        points,
      };
    });

  // ELK layout result includes width/height at runtime but TS types don't declare them
  const elkResult = layoutResult as { width?: number; height?: number };
  const dimensions = {
    width: (elkResult.width ?? 0) + 40,
    height: (elkResult.height ?? 0) + 40,
  };

  return { nodes: positionedNodes, edges: positionedEdges, dimensions };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Compute layout for the given IR using the specified layout engine.
 *
 * Returns positioned nodes and edges with computed coordinates,
 * plus overall diagram dimensions.
 */
export async function render(options: RenderOptions): Promise<RenderResult> {
  const { ir, layoutEngine } = options;
  const strategy = getLayoutStrategy(ir.metadata.chartType);

  let layoutResult: LayoutResult;

  if (layoutEngine === 'elk') {
    layoutResult = await layoutWithElk(ir, strategy);
  } else {
    layoutResult = layoutWithDagre(ir, strategy);
  }

  return {
    layout: layoutResult,
    dimensions: layoutResult.dimensions,
  };
}
