/**
 * Unit tests for SVG Generator — IR → SVG conversion
 *
 * Validates: Requirements 1.4, 3.1, 3.2, 3.3, 3.4, 3.5
 */
import { ACADEMIC_DEFAULT_STYLE } from '@/types/style';
import { describe, expect, it } from 'vitest';
import type { LayoutResult, PositionedEdge, PositionedNode } from './render-engine';
import { extractLabelsFromSVG, generateSVG } from './svg-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePositionedNode(
  overrides: Partial<PositionedNode> & { id: string; label: string; type: PositionedNode['type'] },
): PositionedNode {
  return {
    position: { x: 0, y: 0 },
    size: { width: 150, height: 50 },
    ...overrides,
  };
}

function makeLayout(
  nodes: PositionedNode[],
  edges: PositionedEdge[] = [],
  dimensions = { width: 400, height: 300 },
): LayoutResult {
  return { nodes, edges, dimensions };
}

// ---------------------------------------------------------------------------
// Basic SVG structure
// ---------------------------------------------------------------------------

describe('generateSVG', () => {
  it('produces valid SVG with correct namespace and viewBox', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Start', type: 'start', position: { x: 50, y: 20 } }),
    ]);
    const result = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE });

    expect(result.svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result.svgString).toContain('viewBox="0 0');
    expect(result.svgString).toMatch(/^<svg /);
    expect(result.svgString).toMatch(/<\/svg>$/);
  });


  it('includes arrowhead marker definition', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'A', type: 'process', position: { x: 10, y: 10 } }),
    ]);
    const result = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE });

    expect(result.svgString).toContain('<defs>');
    expect(result.svgString).toContain('<marker id="arrowhead"');
    expect(result.svgString).toContain('</defs>');
  });

  it('provides toElement function', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'A', type: 'process', position: { x: 10, y: 10 } }),
    ]);
    const result = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE });

    expect(typeof result.toElement).toBe('function');
    expect(typeof result.svgString).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Node shape rendering
// ---------------------------------------------------------------------------

describe('node shapes', () => {
  it('renders process node as rectangle', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Process', type: 'process', position: { x: 20, y: 30 }, size: { width: 150, height: 50 } }),
    ]);
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).toContain('<rect x="20" y="30" width="150" height="50"');
    expect(svg).not.toContain('rx='); // No rounding for process
  });

  it('renders subprocess node as double-bordered rectangle', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Sub', type: 'subprocess', position: { x: 20, y: 30 }, size: { width: 150, height: 50 } }),
    ]);
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    // Should have two rects: outer and inner
    const rectMatches = svg.match(/<rect /g);
    expect(rectMatches?.length).toBe(2);
  });

  it('renders decision node as diamond polygon', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Check?', type: 'decision', position: { x: 20, y: 30 }, size: { width: 160, height: 70 } }),
    ]);
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).toContain('<polygon points="');
    // Match the diamond polygon (not the arrowhead marker polygon)
    const polygonMatches = [...svg.matchAll(/<polygon points="([^"]+)"/g)];
    // There should be at least 2 polygons: arrowhead marker + diamond
    const diamondPolygon = polygonMatches.find(m => {
      const pts = m[1].trim().split(/\s+/);
      return pts.length === 4; // Diamond has exactly 4 vertices
    });
    expect(diamondPolygon).toBeTruthy();
  });

  it('renders start/end nodes as rounded rectangles', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Start', type: 'start', position: { x: 20, y: 30 }, size: { width: 100, height: 40 } }),
      makePositionedNode({ id: 'node_2', label: 'End', type: 'end', position: { x: 20, y: 120 }, size: { width: 100, height: 40 } }),
    ]);
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    // Both should have rx/ry for rounding
    const rxMatches = svg.match(/rx="/g);
    expect(rxMatches?.length).toBeGreaterThanOrEqual(2);
  });
});


// ---------------------------------------------------------------------------
// Edge rendering
// ---------------------------------------------------------------------------

describe('edge rendering', () => {
  it('renders edges as polylines with arrowhead marker', () => {
    const layout = makeLayout(
      [
        makePositionedNode({ id: 'node_1', label: 'A', type: 'start', position: { x: 50, y: 20 } }),
        makePositionedNode({ id: 'node_2', label: 'B', type: 'end', position: { x: 50, y: 120 } }),
      ],
      [
        {
          id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal',
          points: [{ x: 125, y: 70 }, { x: 125, y: 90 }, { x: 125, y: 120 }],
        },
      ],
    );
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).toContain('<polyline');
    expect(svg).toContain('marker-end="url(#arrowhead)"');
  });

  it('renders edge labels at midpoint', () => {
    const layout = makeLayout(
      [
        makePositionedNode({ id: 'node_1', label: 'A', type: 'decision', position: { x: 50, y: 20 }, size: { width: 160, height: 70 } }),
        makePositionedNode({ id: 'node_2', label: 'B', type: 'process', position: { x: 50, y: 150 } }),
      ],
      [
        {
          id: 'edge_1', source: 'node_1', target: 'node_2', label: '是', type: 'conditional',
          points: [{ x: 130, y: 90 }, { x: 130, y: 120 }, { x: 130, y: 150 }],
        },
      ],
    );
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).toContain('>是</text>');
  });

  it('skips edges with fewer than 2 points', () => {
    const layout = makeLayout(
      [makePositionedNode({ id: 'node_1', label: 'A', type: 'process', position: { x: 10, y: 10 } })],
      [{ id: 'edge_1', source: 'node_1', target: 'node_1', type: 'normal', points: [{ x: 10, y: 10 }] }],
    );
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).not.toContain('<polyline');
  });
});

// ---------------------------------------------------------------------------
// Label fidelity (Requirement 1.4)
// ---------------------------------------------------------------------------

describe('label fidelity', () => {
  it('SVG text labels match IR node labels exactly', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: '开始', type: 'start', position: { x: 10, y: 10 } }),
      makePositionedNode({ id: 'node_2', label: '数据处理', type: 'process', position: { x: 10, y: 80 } }),
      makePositionedNode({ id: 'node_3', label: '条件判断？', type: 'decision', position: { x: 10, y: 160 }, size: { width: 160, height: 70 } }),
      makePositionedNode({ id: 'node_4', label: '结束', type: 'end', position: { x: 10, y: 260 } }),
    ]);
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;
    const labels = extractLabelsFromSVG(svg);

    expect(labels).toContain('开始');
    expect(labels).toContain('数据处理');
    expect(labels).toContain('条件判断？');
    expect(labels).toContain('结束');
  });

  it('SVG text labels match IR edge labels exactly', () => {
    const layout = makeLayout(
      [
        makePositionedNode({ id: 'node_1', label: 'A', type: 'decision', position: { x: 50, y: 20 }, size: { width: 160, height: 70 } }),
        makePositionedNode({ id: 'node_2', label: 'B', type: 'process', position: { x: 0, y: 150 } }),
        makePositionedNode({ id: 'node_3', label: 'C', type: 'process', position: { x: 200, y: 150 } }),
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', label: '是', type: 'conditional', points: [{ x: 50, y: 90 }, { x: 50, y: 150 }] },
        { id: 'edge_2', source: 'node_1', target: 'node_3', label: '否', type: 'conditional', points: [{ x: 200, y: 90 }, { x: 200, y: 150 }] },
      ],
    );
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;
    const labels = extractLabelsFromSVG(svg);

    expect(labels).toContain('是');
    expect(labels).toContain('否');
  });

  it('handles special XML characters in labels', () => {
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'A & B < C > D', type: 'process', position: { x: 10, y: 10 } }),
    ]);
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    // Should be escaped in SVG
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&gt;');

    // extractLabelsFromSVG should unescape back
    const labels = extractLabelsFromSVG(svg);
    expect(labels).toContain('A & B < C > D');
  });
});


// ---------------------------------------------------------------------------
// Academic template compliance (Requirements 3.1, 3.2, 3.3, 3.4)
// ---------------------------------------------------------------------------

describe('academic-default template', () => {
  const complexLayout = makeLayout(
    [
      makePositionedNode({ id: 'node_1', label: '开始', type: 'start', position: { x: 100, y: 20 } }),
      makePositionedNode({ id: 'node_2', label: '处理数据', type: 'process', position: { x: 80, y: 100 } }),
      makePositionedNode({ id: 'node_3', label: '有效？', type: 'decision', position: { x: 70, y: 200 }, size: { width: 160, height: 70 } }),
      makePositionedNode({ id: 'node_4', label: '子流程', type: 'subprocess', position: { x: 80, y: 320 } }),
      makePositionedNode({ id: 'node_5', label: '结束', type: 'end', position: { x: 100, y: 420 } }),
    ],
    [
      { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'normal', points: [{ x: 150, y: 60 }, { x: 150, y: 100 }] },
      { id: 'edge_2', source: 'node_2', target: 'node_3', type: 'normal', points: [{ x: 150, y: 150 }, { x: 150, y: 200 }] },
      { id: 'edge_3', source: 'node_3', target: 'node_4', label: '是', type: 'conditional', points: [{ x: 150, y: 270 }, { x: 150, y: 320 }] },
      { id: 'edge_4', source: 'node_4', target: 'node_5', type: 'normal', points: [{ x: 150, y: 370 }, { x: 150, y: 420 }] },
    ],
    { width: 400, height: 500 },
  );

  it('does NOT contain any gradient elements (Req 3.1)', () => {
    const svg = generateSVG({ layout: complexLayout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).not.toContain('linearGradient');
    expect(svg).not.toContain('radialGradient');
  });

  it('does NOT contain any shadow/filter elements (Req 3.1)', () => {
    const svg = generateSVG({ layout: complexLayout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).not.toContain('<filter');
    expect(svg).not.toContain('filter=');
    // The only allowed filter-like attribute is marker-end for arrows
  });

  it('uses SimSun and Times New Roman fonts (Req 3.2)', () => {
    const svg = generateSVG({ layout: complexLayout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    expect(svg).toContain('SimSun');
    expect(svg).toContain('Times New Roman');
  });

  it('uses solid arrowheads (Req 3.3)', () => {
    const svg = generateSVG({ layout: complexLayout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    // Arrow marker should be a filled polygon (solid)
    expect(svg).toContain('<marker id="arrowhead"');
    expect(svg).toContain('<polygon');
  });

  it('uses monochrome color scheme (Req 3.4)', () => {
    const svg = generateSVG({ layout: complexLayout, style: ACADEMIC_DEFAULT_STYLE }).svgString;

    // With academic-default, fill should be white, stroke should be black
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('stroke="#000000"');
  });
});

// ---------------------------------------------------------------------------
// Style customization
// ---------------------------------------------------------------------------

describe('custom style application', () => {
  it('applies custom fill and border colors', () => {
    const customStyle = {
      ...ACADEMIC_DEFAULT_STYLE,
      fillColor: '#F0F0F0',
      borderColor: '#333333',
    };
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Test', type: 'process', position: { x: 10, y: 10 } }),
    ]);
    const svg = generateSVG({ layout, style: customStyle }).svgString;

    expect(svg).toContain('fill="#F0F0F0"');
    expect(svg).toContain('stroke="#333333"');
  });

  it('applies custom font size', () => {
    const customStyle = { ...ACADEMIC_DEFAULT_STYLE, fontSize: 16 };
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Test', type: 'process', position: { x: 10, y: 10 } }),
    ]);
    const svg = generateSVG({ layout, style: customStyle }).svgString;

    expect(svg).toContain('font-size="16"');
  });

  it('applies custom border width', () => {
    const customStyle = { ...ACADEMIC_DEFAULT_STYLE, borderWidth: 2 };
    const layout = makeLayout([
      makePositionedNode({ id: 'node_1', label: 'Test', type: 'process', position: { x: 10, y: 10 } }),
    ]);
    const svg = generateSVG({ layout, style: customStyle }).svgString;

    expect(svg).toContain('stroke-width="2"');
  });
});

// ---------------------------------------------------------------------------
// extractLabelsFromSVG utility
// ---------------------------------------------------------------------------

describe('extractLabelsFromSVG', () => {
  it('extracts all labels from a generated SVG', () => {
    const layout = makeLayout(
      [
        makePositionedNode({ id: 'node_1', label: 'Alpha', type: 'start', position: { x: 10, y: 10 } }),
        makePositionedNode({ id: 'node_2', label: 'Beta', type: 'process', position: { x: 10, y: 80 } }),
      ],
      [
        { id: 'edge_1', source: 'node_1', target: 'node_2', label: 'next', type: 'normal', points: [{ x: 85, y: 50 }, { x: 85, y: 80 }] },
      ],
    );
    const svg = generateSVG({ layout, style: ACADEMIC_DEFAULT_STYLE }).svgString;
    const labels = extractLabelsFromSVG(svg);

    expect(labels).toEqual(expect.arrayContaining(['Alpha', 'Beta', 'next']));
    expect(labels).toHaveLength(3);
  });

  it('returns empty array for SVG with no text', () => {
    const labels = extractLabelsFromSVG('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(labels).toEqual([]);
  });
});
