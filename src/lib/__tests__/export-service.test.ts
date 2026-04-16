/**
 * Unit tests for export-service.ts
 *
 * Since vitest runs in Node (no DOM), we test:
 * - SVG string manipulation (font embedding)
 * - Blob creation
 * - triggerDownload is called correctly (mocked)
 * - PNG export with mocked Canvas/Image APIs
 * - DPI scaling for PNG export
 *
 * Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    embedFontsInSVG,
    exportFlowchart,
    parseSVGDimensions,
    svgToPngBlob,
} from '../export-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid SVG string with a <defs> section (like svg-generator output) */
const SVG_WITH_DEFS = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">',
  '<defs>',
  '  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">',
  '    <polygon points="0 0, 10 3.5, 0 7" fill="#000000" />',
  '  </marker>',
  '</defs>',
  '<rect x="10" y="10" width="80" height="40" fill="#FFFFFF" stroke="#000000" stroke-width="1" />',
  '<text x="50" y="30" text-anchor="middle" dominant-baseline="central" font-family="SimSun, Times New Roman, serif" font-size="12" fill="#000000">Hello</text>',
  '</svg>',
].join('\n');

/** Minimal SVG without <defs> */
const SVG_WITHOUT_DEFS = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">',
  '<rect x="10" y="10" width="80" height="40" fill="#FFFFFF" stroke="#000000" />',
  '</svg>',
].join('\n');

// ---------------------------------------------------------------------------
// Mock browser APIs for exportFlowchart download trigger
// ---------------------------------------------------------------------------

function setupDOMMocks() {
  const revokeObjectURL = vi.fn();
  const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');

  const clickFn = vi.fn();
  const anchor = {
    href: '',
    download: '',
    style: { display: '' },
    click: clickFn,
  };

  const createElement = vi.fn().mockReturnValue(anchor);
  const appendChild = vi.fn();
  const removeChild = vi.fn();

  // Assign to globalThis
  globalThis.URL.createObjectURL = createObjectURL;
  globalThis.URL.revokeObjectURL = revokeObjectURL;
  globalThis.document = {
    createElement,
    body: { appendChild, removeChild },
  } as unknown as Document;

  return { createObjectURL, revokeObjectURL, createElement, anchor, clickFn, appendChild, removeChild };
}

/**
 * Set up mocks for Canvas/Image APIs needed by PNG export.
 * Returns controls to verify canvas dimensions and draw calls.
 */
function setupPngMocks() {
  const domMocks = setupDOMMocks();

  const drawImageFn = vi.fn();
  const mockCtx = { drawImage: drawImageFn };

  let capturedCanvasWidth = 0;
  let capturedCanvasHeight = 0;

  const mockPngBlob = new Blob(['fake-png-data'], { type: 'image/png' });

  // Override createElement to handle both 'a' (download) and 'canvas'
  domMocks.createElement.mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return {
        get width() { return capturedCanvasWidth; },
        set width(v: number) { capturedCanvasWidth = v; },
        get height() { return capturedCanvasHeight; },
        set height(v: number) { capturedCanvasHeight = v; },
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn().mockImplementation((cb: (blob: Blob | null) => void) => {
          cb(mockPngBlob);
        }),
      };
    }
    // Default: anchor element for download
    return domMocks.anchor;
  });

  // Mock Image constructor
  const originalImage = globalThis.Image;
  // Must use `function` (not arrow) so it can be called with `new`
  globalThis.Image = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    let _src = '';
    const self = this;
    self.onload = null;
    self.onerror = null;
    Object.defineProperty(self, 'src', {
      get() { return _src; },
      set(v: string) {
        _src = v;
        // Simulate async image load
        setTimeout(() => { if (typeof self.onload === 'function') (self.onload as () => void)(); }, 0);
      },
      configurable: true,
    });
  }) as unknown as typeof Image;

  return {
    ...domMocks,
    drawImageFn,
    mockCtx,
    mockPngBlob,
    getCanvasWidth: () => capturedCanvasWidth,
    getCanvasHeight: () => capturedCanvasHeight,
    restoreImage: () => { globalThis.Image = originalImage; },
  };
}

// ---------------------------------------------------------------------------
// embedFontsInSVG tests
// ---------------------------------------------------------------------------

describe('embedFontsInSVG', () => {
  it('injects @font-face into existing <defs> section', () => {
    const result = embedFontsInSVG(SVG_WITH_DEFS);

    expect(result).toContain('@font-face');
    expect(result).toContain("font-family: 'SimSun'");
    expect(result).toContain("font-family: 'Times New Roman'");
    // The original defs content should still be present
    expect(result).toContain('marker id="arrowhead"');
    // Style block should be inside <defs>
    const defsIdx = result.indexOf('<defs>');
    const styleIdx = result.indexOf('<style');
    const defsCloseIdx = result.indexOf('</defs>');
    expect(styleIdx).toBeGreaterThan(defsIdx);
    expect(styleIdx).toBeLessThan(defsCloseIdx);
  });

  it('creates <defs> and injects @font-face when no <defs> exists', () => {
    const result = embedFontsInSVG(SVG_WITHOUT_DEFS);

    expect(result).toContain('@font-face');
    expect(result).toContain('<defs>');
    expect(result).toContain('</defs>');
    expect(result).toContain("font-family: 'SimSun'");
    expect(result).toContain("font-family: 'Times New Roman'");
    // Original content preserved
    expect(result).toContain('<rect');
  });

  it('preserves original SVG content', () => {
    const result = embedFontsInSVG(SVG_WITH_DEFS);

    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result).toContain('<rect');
    expect(result).toContain('<text');
    expect(result).toContain('Hello');
    expect(result).toContain('</svg>');
  });
});

// ---------------------------------------------------------------------------
// parseSVGDimensions tests
// ---------------------------------------------------------------------------

describe('parseSVGDimensions', () => {
  it('parses width and height from explicit attributes', () => {
    const dims = parseSVGDimensions(SVG_WITH_DEFS);
    expect(dims).toEqual({ width: 200, height: 100 });
  });

  it('falls back to viewBox when width/height attributes are missing', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><rect/></svg>';
    const dims = parseSVGDimensions(svg);
    expect(dims).toEqual({ width: 400, height: 250 });
  });

  it('returns default dimensions when no size info is present', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const dims = parseSVGDimensions(svg);
    expect(dims).toEqual({ width: 300, height: 150 });
  });
});

// ---------------------------------------------------------------------------
// exportFlowchart SVG tests
// ---------------------------------------------------------------------------

describe('exportFlowchart — SVG', () => {
  it('produces a valid Blob with type image/svg+xml', async () => {
    setupDOMMocks();

    const blob = await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'svg',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/svg+xml');
  });

  it('includes @font-face declarations in the exported SVG', async () => {
    setupDOMMocks();

    const blob = await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'svg',
      embedFonts: true,
    });

    const text = await blob.text();
    expect(text).toContain('@font-face');
    expect(text).toContain("font-family: 'SimSun'");
    expect(text).toContain("font-family: 'Times New Roman'");
  });

  it('includes the original SVG content in the exported Blob', async () => {
    setupDOMMocks();

    const blob = await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'svg',
    });

    const text = await blob.text();
    expect(text).toContain('<rect');
    expect(text).toContain('Hello');
    expect(text).toContain('</svg>');
  });

  it('skips font embedding when embedFonts is false', async () => {
    setupDOMMocks();

    const blob = await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'svg',
      embedFonts: false,
    });

    const text = await blob.text();
    expect(text).not.toContain('@font-face');
    expect(text).toContain('<rect');
  });

  it('triggers download with correct filename and blob URL', async () => {
    const mocks = setupDOMMocks();

    await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'svg',
    });

    expect(mocks.createObjectURL).toHaveBeenCalledOnce();
    expect(mocks.createElement).toHaveBeenCalledWith('a');
    expect(mocks.anchor.download).toBe('flowchart.svg');
    expect(mocks.clickFn).toHaveBeenCalledOnce();
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('throws when SVG exceeds 500KB', async () => {
    setupDOMMocks();

    const hugeSVG =
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">' +
      '<text>' + 'x'.repeat(512 * 1024) + '</text>' +
      '</svg>';

    await expect(
      exportFlowchart({ svgString: hugeSVG, format: 'svg' }),
    ).rejects.toThrow('500KB');
  });
});

// ---------------------------------------------------------------------------
// exportFlowchart PNG tests
// ---------------------------------------------------------------------------

describe('exportFlowchart — PNG', () => {
  let pngMocks: ReturnType<typeof setupPngMocks>;

  beforeEach(() => {
    pngMocks = setupPngMocks();
  });

  afterEach(() => {
    pngMocks.restoreImage();
  });

  it('returns a PNG Blob', async () => {
    const blob = await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'png',
      dpi: 300,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('triggers download with .png filename', async () => {
    await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'png',
      dpi: 300,
    });

    expect(pngMocks.anchor.download).toBe('flowchart.png');
    expect(pngMocks.clickFn).toHaveBeenCalledOnce();
  });

  it('defaults to 300dpi when dpi is not specified', async () => {
    await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'png',
    });

    // 200 * (300/96) = 625, 100 * (300/96) = 312.5 → 313
    expect(pngMocks.getCanvasWidth()).toBe(625);
    expect(pngMocks.getCanvasHeight()).toBe(313);
  });

  it('applies 300dpi scaling correctly (3.125x from 96dpi base)', async () => {
    await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'png',
      dpi: 300,
    });

    // SVG is 200x100, scale = 300/96 = 3.125
    // 200 * 3.125 = 625, 100 * 3.125 = 312.5 → 313
    expect(pngMocks.getCanvasWidth()).toBe(625);
    expect(pngMocks.getCanvasHeight()).toBe(313);
  });

  it('applies 600dpi scaling correctly (6.25x from 96dpi base)', async () => {
    await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'png',
      dpi: 600,
    });

    // SVG is 200x100, scale = 600/96 = 6.25
    // 200 * 6.25 = 1250, 100 * 6.25 = 625
    expect(pngMocks.getCanvasWidth()).toBe(1250);
    expect(pngMocks.getCanvasHeight()).toBe(625);
  });

  it('draws the image onto the canvas at scaled dimensions', async () => {
    await exportFlowchart({
      svgString: SVG_WITH_DEFS,
      format: 'png',
      dpi: 300,
    });

    expect(pngMocks.drawImageFn).toHaveBeenCalledOnce();
    const [, , , w, h] = pngMocks.drawImageFn.mock.calls[0];
    expect(w).toBe(625);
    expect(h).toBe(313);
  });
});

// ---------------------------------------------------------------------------
// svgToPngBlob direct tests
// ---------------------------------------------------------------------------

describe('svgToPngBlob', () => {
  let pngMocks: ReturnType<typeof setupPngMocks>;

  beforeEach(() => {
    pngMocks = setupPngMocks();
  });

  afterEach(() => {
    pngMocks.restoreImage();
  });

  it('creates canvas with correct dimensions for 300dpi', async () => {
    await svgToPngBlob(SVG_WITH_DEFS, 300);

    expect(pngMocks.getCanvasWidth()).toBe(625);
    expect(pngMocks.getCanvasHeight()).toBe(313);
  });

  it('creates canvas with correct dimensions for 600dpi', async () => {
    await svgToPngBlob(SVG_WITH_DEFS, 600);

    expect(pngMocks.getCanvasWidth()).toBe(1250);
    expect(pngMocks.getCanvasHeight()).toBe(625);
  });

  it('embeds fonts in the SVG before rendering to canvas', async () => {
    // The Image mock captures the src — we can verify it contains font-face
    await svgToPngBlob(SVG_WITHOUT_DEFS, 300);

    const imgConstructorCalls = (globalThis.Image as unknown as ReturnType<typeof vi.fn>).mock.instances;
    const imgInstance = imgConstructorCalls[0] as Record<string, unknown>;
    const decodedSrc = decodeURIComponent(imgInstance.src as string);
    expect(decodedSrc).toContain('@font-face');
    expect(decodedSrc).toContain("font-family: 'SimSun'");
  });
});
