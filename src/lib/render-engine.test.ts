/**
 * Unit tests for Render_Engine layout calculation module.
 *
 * Validates: Requirements 1.3, 8.4
 */
import type { IR } from '@/types/ir';
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import { describe, expect, it } from 'vitest';
import {
    getLayoutStrategy,
    render,
    type RenderOptions,
} from './render-engine';

// ---------------------------------------------------------------------------
// Helper: build a minimal IR
// ---------------------------------------------------------------------------

function makeIR(
  chartType: IR['metadata']['chartType'],
  nodes: IR['nodes'],
  edges: IR['edges'] = [],
  groups: IR['groups'] = [],
): IR {
  return {
    version: '1.0',
    metadata: {
      createdAt: new Date().toISOString(),
      sourceLanguage: 'zh',
      chartType,
    },
    nodes,
    edges,
    groups,
  };
}

// ---------------------------------------------------------------------------
// getLayoutStrategy tests
// ---------------------------------------------------------------------------

describe('getLayoutStrategy', () => {
  it('sequential uses TB layout', () => {
    const s = getLayoutStrategy('sequential');
    expect(s.rankdir).toBe('TB');
  });

  it('conditional uses TB layout', () => {
    const s = getLayoutStrategy('conditional');
    expect(s.rankdir).toBe('TB');
  });

  it('tree uses TB layout with wider spacing', () => {
    const s = getLayoutStrategy('tree');
    expect(s.rankdir).toBe('TB');
    expect(s.nodesep).toBeGreaterThan(getLayoutStrategy('sequential').nodesep);
  });

  it('architecture uses TB layout with compound enabled', () => {
    const s = getLayoutStrategy('architecture');
    expect(s.rankdir).toBe('TB');
    expect(s.compound).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dagre layout tests
// ---------------------------------------------------------------------------

describe('render with dagre', () => {
  it('positions a single node', async () => {
    const ir = makeIR('sequential', [
      { id: 'node_1', label: 'Start', type: 'start' },
    ]);
    const opts: RenderOptions = {
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'dagre',
    };
    const result = await render(opts);

    expect(result.layout.nodes).toHaveLength(1);
    const n = result.layout.nodes[0];
    expect(n.position.x).toBeTypeOf('number');
    expect(n.position.y).toBeTypeOf('number');
    expect(n.size.width).toBeGreaterThan(0);
    expect(n.size.height).toBeGreaterThan(0);
    expect(result.dimensions.width).toBeGreaterThan(0);
    expect(result.dimensions.height).toBeGreaterThan(0);
  });

  it('positions a sequential flow with edges', async () => {
    const ir = makeIR(
      'sequential',
      [
        { id: 'node_1', label: 'Start', type: 'start' },
        { id: 'node_2', label: 'Process', type: 'process' },
        { id: 'node_3', label: 'End', type: 'end' },
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
      ],
    );
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'dagre',
    });

    expect(result.layout.nodes).toHaveLength(3);
    expect(result.layout.edges).toHaveLength(2);

    // In TB layout, y should increase along the flow
    const ys = result.layout.nodes.map((n) => n.position.y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('positions a conditional flow with decision node', async () => {
    const ir = makeIR(
      'conditional',
      [
        { id: 'node_1', label: '开始', type: 'start' },
        { id: 'node_2', label: '条件判断？', type: 'decision' },
        { id: 'node_3', label: '是分支', type: 'process' },
        { id: 'node_4', label: '否分支', type: 'process' },
        { id: 'node_5', label: '结束', type: 'end' },
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', label: '是', type: 'conditional' },
        { id: 'edge_3', source: 'node_2', target: 'node_4', label: '否', type: 'conditional' },
        { id: 'edge_4', source: 'node_3', target: 'node_5', type: 'normal' },
        { id: 'edge_5', source: 'node_4', target: 'node_5', type: 'normal' },
      ],
    );
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'dagre',
    });

    expect(result.layout.nodes).toHaveLength(5);
    // Decision node should be above the two branches
    const decision = result.layout.nodes.find((n) => n.id === 'node_2')!;
    const branch1 = result.layout.nodes.find((n) => n.id === 'node_3')!;
    const branch2 = result.layout.nodes.find((n) => n.id === 'node_4')!;
    expect(decision.position.y).toBeLessThan(branch1.position.y);
    expect(decision.position.y).toBeLessThan(branch2.position.y);
  });

  it('produces no overlapping nodes', async () => {
    const ir = makeIR(
      'sequential',
      [
        { id: 'node_1', label: 'A', type: 'start' },
        { id: 'node_2', label: 'B', type: 'process' },
        { id: 'node_3', label: 'C', type: 'process' },
        { id: 'node_4', label: 'D', type: 'end' },
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
        { id: 'edge_3', source: 'node_3', target: 'node_4', type: 'normal' },
      ],
    );
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'dagre',
    });

    const nodes = result.layout.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const overlapX =
          a.position.x < b.position.x + b.size.width &&
          a.position.x + a.size.width > b.position.x;
        const overlapY =
          a.position.y < b.position.y + b.size.height &&
          a.position.y + a.size.height > b.position.y;
        expect(
          overlapX && overlapY,
          `Nodes ${a.id} and ${b.id} overlap`,
        ).toBe(false);
      }
    }
  });

  it('handles architecture chart with groups', async () => {
    const ir = makeIR(
      'architecture',
      [
        { id: 'node_1', label: 'Frontend', type: 'subprocess', groupId: 'group_1' },
        { id: 'node_2', label: 'Backend', type: 'subprocess', groupId: 'group_2' },
        { id: 'node_3', label: 'Database', type: 'process', groupId: 'group_2' },
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
      ],
      [
        { id: 'group_1', label: '表示层', children: ['node_1'] },
        { id: 'group_2', label: '服务层', children: ['node_2', 'node_3'] },
      ],
    );
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'dagre',
    });

    expect(result.layout.nodes).toHaveLength(3);
    // All nodes should have valid positions
    for (const node of result.layout.nodes) {
      expect(node.position.x).toBeTypeOf('number');
      expect(node.position.y).toBeTypeOf('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });

  it('preserves original node metadata', async () => {
    const ir = makeIR('sequential', [
      { id: 'node_1', label: '测试节点', type: 'process' },
    ]);
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'dagre',
    });

    const n = result.layout.nodes[0];
    expect(n.id).toBe('node_1');
    expect(n.label).toBe('测试节点');
    expect(n.type).toBe('process');
  });
});

// ---------------------------------------------------------------------------
// ELK layout tests
// ---------------------------------------------------------------------------

describe('render with elk', () => {
  it('positions a simple sequential flow', async () => {
    const ir = makeIR(
      'sequential',
      [
        { id: 'node_1', label: 'Start', type: 'start' },
        { id: 'node_2', label: 'Process', type: 'process' },
        { id: 'node_3', label: 'End', type: 'end' },
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal' },
      ],
    );
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'elk',
    });

    expect(result.layout.nodes).toHaveLength(3);
    for (const node of result.layout.nodes) {
      expect(node.position.x).toBeTypeOf('number');
      expect(node.position.y).toBeTypeOf('number');
      expect(node.size.width).toBeGreaterThan(0);
      expect(node.size.height).toBeGreaterThan(0);
    }
    expect(result.dimensions.width).toBeGreaterThan(0);
    expect(result.dimensions.height).toBeGreaterThan(0);
  });

  it('produces no overlapping nodes', async () => {
    const ir = makeIR(
      'conditional',
      [
        { id: 'node_1', label: 'Start', type: 'start' },
        { id: 'node_2', label: 'Check?', type: 'decision' },
        { id: 'node_3', label: 'Yes', type: 'process' },
        { id: 'node_4', label: 'No', type: 'process' },
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal' },
        { id: 'edge_2', source: 'node_2', target: 'node_3', label: 'Yes', type: 'conditional' },
        { id: 'edge_3', source: 'node_2', target: 'node_4', label: 'No', type: 'conditional' },
      ],
    );
    const result = await render({
      ir,
      style: ACADEMIC_DEFAULT_STYLE,
      layoutEngine: 'elk',
    });

    const nodes = result.layout.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const overlapX =
          a.position.x < b.position.x + b.size.width &&
          a.position.x + a.size.width > b.position.x;
        const overlapY =
          a.position.y < b.position.y + b.size.height &&
          a.position.y + a.size.height > b.position.y;
        expect(
          overlapX && overlapY,
          `Nodes ${a.id} and ${b.id} overlap`,
        ).toBe(false);
      }
    }
  });
});
