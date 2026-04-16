/**
 * SVG Generator — IR → SVG conversion with academic template support
 *
 * Converts LayoutResult (positioned nodes + edges) into SVG markup.
 * Applies StyleConfig for colors, fonts, borders.
 * Academic-default template: solid borders, white/light-gray fill,
 * NO gradients, NO shadows, NO filter elements.
 *
 * Requirements: 1.4, 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { StyleConfig } from '@/types/style';
import type { LayoutResult } from './render-engine';

// ---------------------------------------------------------------------------
// SVG namespace
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SVGGeneratorOptions {
  layout: LayoutResult;
  style: StyleConfig;
}

export interface SVGGeneratorResult {
  /** Serialized SVG string (for export / testing) */
  svgString: string;
  /** Create an SVGElement in a browser context (requires document) */
  toElement: (doc?: Document) => SVGSVGElement;
}

// ---------------------------------------------------------------------------
// Escape helper
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Font family helper
// ---------------------------------------------------------------------------

function buildFontFamily(style: StyleConfig): string {
  return `${style.fontFamily.zh}, ${style.fontFamily.en}, serif`;
}

// ---------------------------------------------------------------------------
// Arrow marker definition
// ---------------------------------------------------------------------------

function buildArrowMarker(style: StyleConfig): string {
  return [
    `<defs>`,
    `  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">`,
    `    <polygon points="0 0, 10 3.5, 0 7" fill="${escapeXml(style.borderColor)}" />`,
    `  </marker>`,
    `</defs>`,
  ].join('\n');
}


// ---------------------------------------------------------------------------
// Node shape renderers
// ---------------------------------------------------------------------------

/**
 * Render a rectangle node (process / subprocess).
 * Subprocess gets a double border effect via an inner rect.
 */
function renderRectNode(node: PositionedNode, style: StyleConfig, fontFamily: string): string {
  const { x, y } = node.position;
  const { width, height } = node.size;
  const lines: string[] = [];

  lines.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `fill="${escapeXml(style.fillColor)}" stroke="${escapeXml(style.borderColor)}" ` +
    `stroke-width="${style.borderWidth}" />`
  );

  // Subprocess: inner rect for double-border effect
  if (node.type === 'subprocess') {
    const inset = 4;
    lines.push(
      `<rect x="${x + inset}" y="${y + inset}" width="${width - inset * 2}" height="${height - inset * 2}" ` +
      `fill="none" stroke="${escapeXml(style.borderColor)}" stroke-width="${style.borderWidth}" />`
    );
  }

  // Text label centered
  lines.push(
    `<text x="${x + width / 2}" y="${y + height / 2}" ` +
    `text-anchor="middle" dominant-baseline="central" ` +
    `font-family="${escapeXml(fontFamily)}" font-size="${style.fontSize}" ` +
    `fill="${escapeXml(style.borderColor)}">${escapeXml(node.label)}</text>`
  );

  return lines.join('\n');
}

/**
 * Render a diamond node (decision).
 * Uses a polygon rotated 45° to form a diamond shape.
 */
function renderDiamondNode(node: PositionedNode, style: StyleConfig, fontFamily: string): string {
  const { x, y } = node.position;
  const { width, height } = node.size;
  const cx = x + width / 2;
  const cy = y + height / 2;

  // Diamond vertices: top, right, bottom, left
  const points = [
    `${cx},${y}`,
    `${x + width},${cy}`,
    `${cx},${y + height}`,
    `${x},${cy}`,
  ].join(' ');

  const lines: string[] = [];
  lines.push(
    `<polygon points="${points}" ` +
    `fill="${escapeXml(style.fillColor)}" stroke="${escapeXml(style.borderColor)}" ` +
    `stroke-width="${style.borderWidth}" />`
  );

  lines.push(
    `<text x="${cx}" y="${cy}" ` +
    `text-anchor="middle" dominant-baseline="central" ` +
    `font-family="${escapeXml(fontFamily)}" font-size="${style.fontSize}" ` +
    `fill="${escapeXml(style.borderColor)}">${escapeXml(node.label)}</text>`
  );

  return lines.join('\n');
}

/**
 * Render a rounded rectangle node (start / end).
 * Uses rx/ry for rounded corners to create a stadium/pill shape.
 */
function renderRoundedRectNode(node: PositionedNode, style: StyleConfig, fontFamily: string): string {
  const { x, y } = node.position;
  const { width, height } = node.size;
  const rx = height / 2; // Full rounding for pill shape

  const lines: string[] = [];
  lines.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `rx="${rx}" ry="${rx}" ` +
    `fill="${escapeXml(style.fillColor)}" stroke="${escapeXml(style.borderColor)}" ` +
    `stroke-width="${style.borderWidth}" />`
  );

  lines.push(
    `<text x="${x + width / 2}" y="${y + height / 2}" ` +
    `text-anchor="middle" dominant-baseline="central" ` +
    `font-family="${escapeXml(fontFamily)}" font-size="${style.fontSize}" ` +
    `fill="${escapeXml(style.borderColor)}">${escapeXml(node.label)}</text>`
  );

  return lines.join('\n');
}


// ---------------------------------------------------------------------------
// Node dispatcher
// ---------------------------------------------------------------------------

function renderNode(node: PositionedNode, style: StyleConfig, fontFamily: string): string {
  switch (node.type) {
    case 'decision':
      return renderDiamondNode(node, style, fontFamily);
    case 'start':
    case 'end':
      return renderRoundedRectNode(node, style, fontFamily);
    case 'process':
    case 'subprocess':
    default:
      return renderRectNode(node, style, fontFamily);
  }
}

// ---------------------------------------------------------------------------
// Edge renderer — orthogonal polyline with arrowhead
// ---------------------------------------------------------------------------

function renderEdge(edge: PositionedEdge, style: StyleConfig, fontFamily: string): string {
  const lines: string[] = [];

  if (edge.points.length < 2) return '';

  // Build polyline points string
  const pointsStr = edge.points.map((p) => `${p.x},${p.y}`).join(' ');

  lines.push(
    `<polyline points="${pointsStr}" ` +
    `fill="none" stroke="${escapeXml(style.borderColor)}" ` +
    `stroke-width="${style.borderWidth}" ` +
    `marker-end="url(#arrowhead)" />`
  );

  // Edge label (positioned at midpoint of the polyline)
  if (edge.label) {
    const midIdx = Math.floor(edge.points.length / 2);
    const midPoint = edge.points[midIdx];
    const labelOffsetX = 8;
    const labelOffsetY = -6;

    lines.push(
      `<text x="${midPoint.x + labelOffsetX}" y="${midPoint.y + labelOffsetY}" ` +
      `text-anchor="start" dominant-baseline="auto" ` +
      `font-family="${escapeXml(fontFamily)}" font-size="${style.fontSize}" ` +
      `fill="${escapeXml(style.borderColor)}">${escapeXml(edge.label)}</text>`
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate SVG from a LayoutResult and StyleConfig.
 *
 * Returns an object with:
 * - `svgString`: serialized SVG markup (for export / testing / SSR)
 * - `toElement(doc?)`: creates an SVGSVGElement in a browser context
 *
 * The generated SVG:
 * - Uses solid borders, solid fill (no gradients, no shadows, no filters)
 * - Uses SimSun (Chinese) + Times New Roman (English) by default
 * - Uses solid arrowheads and polyline connectors
 * - Text labels match IR node/edge labels exactly
 */
export function generateSVG(options: SVGGeneratorOptions): SVGGeneratorResult {
  const { layout, style } = options;
  const { nodes, edges, dimensions } = layout;

  const padding = 20;
  const totalWidth = dimensions.width + padding * 2;
  const totalHeight = dimensions.height + padding * 2;
  const fontFamily = buildFontFamily(style);

  // Build SVG content parts
  const parts: string[] = [];

  // Arrow marker definition
  parts.push(buildArrowMarker(style));

  // Render edges first (below nodes)
  for (const edge of edges) {
    parts.push(renderEdge(edge, style, fontFamily));
  }

  // Render nodes on top
  for (const node of nodes) {
    parts.push(renderNode(node, style, fontFamily));
  }

  const innerContent = parts.join('\n');

  const svgString = [
    `<svg xmlns="${SVG_NS}" width="${totalWidth}" height="${totalHeight}" ` +
    `viewBox="0 0 ${totalWidth} ${totalHeight}">`,
    innerContent,
    `</svg>`,
  ].join('\n');

  return {
    svgString,
    toElement(doc?: Document): SVGSVGElement {
      const d = doc ?? document;
      const container = d.createElement('div');
      container.innerHTML = svgString;
      return container.firstElementChild as SVGSVGElement;
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: extract all text labels from SVG string
// ---------------------------------------------------------------------------

/**
 * Extract all text content from <text> elements in an SVG string.
 * Useful for testing label fidelity.
 */
export function extractLabelsFromSVG(svgString: string): string[] {
  const labels: string[] = [];
  const regex = /<text[^>]*>([^<]*)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(svgString)) !== null) {
    // Unescape XML entities back to plain text
    const text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    labels.push(text);
  }
  return labels;
}
