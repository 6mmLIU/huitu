import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(__dirname, '../FlowCanvas.tsx');
const source = readFileSync(SOURCE_PATH, 'utf-8');

describe('FlowCanvas module', () => {
  it('exports FlowCanvas as default function component', async () => {
    const mod = await import('../FlowCanvas');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
    expect(mod.default.name).toBe('FlowCanvas');
  });

  it('is re-exported from components index', async () => {
    const mod = await import('../index');
    expect(mod.FlowCanvas).toBeDefined();
    expect(typeof mod.FlowCanvas).toBe('function');
  });
});

describe('FlowCanvas source code – render complete callback', () => {
  it('references onRenderComplete callback in props', () => {
    expect(source).toContain('onRenderComplete');
  });

  it('invokes onRenderComplete after rendering', () => {
    // The callback is called via optional chaining after successful render
    expect(source).toMatch(/onRenderComplete\?\.\(\)/);
  });
});

describe('FlowCanvas source code – export buttons (Req 9.3)', () => {
  it('contains an SVG export button', () => {
    expect(source).toMatch(/Export SVG|export.*svg/i);
    expect(source).toContain('onExportSVG');
  });

  it('contains a PNG export button', () => {
    expect(source).toMatch(/Export PNG|export.*png/i);
    expect(source).toContain('onExportPNG');
  });

  it('SVG export button has an aria-label', () => {
    expect(source).toMatch(/aria-label=.*Export as SVG/);
  });

  it('PNG export button has an aria-label', () => {
    expect(source).toMatch(/aria-label=.*Export as PNG/);
  });
});

describe('FlowCanvas source code – imports render engine and svg generator', () => {
  it('imports render from render-engine', () => {
    expect(source).toMatch(/import.*render.*from.*render-engine/);
  });

  it('imports generateSVG from svg-generator', () => {
    expect(source).toMatch(/import.*generateSVG.*from.*svg-generator/);
  });
});

describe('FlowCanvas – no login required (Req 7.1)', () => {
  it('does not reference any authentication or login logic', () => {
    expect(source).not.toMatch(/login|signIn|auth|session.*token/i);
  });
});
