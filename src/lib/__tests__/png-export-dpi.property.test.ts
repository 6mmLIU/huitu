/**
 * Feature: paperflow, Property 10: PNG 导出尺寸与 DPI 成比例
 *
 * Validates: Requirements 6.2
 *
 * For any valid SVG with logical dimensions (width, height) and any DPI
 * setting (300 or 600), the exported PNG image pixel dimensions should be
 * proportional to (width * dpi/96, height * dpi/96) where 96 is the
 * standard screen DPI baseline.
 */
import { parseSVGDimensions, svgToPngBlob } from '@/lib/export-service';
import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_DPI = 96;

/**
 * Set up minimal DOM mocks for Canvas/Image APIs used by svgToPngBlob.
 * Captures the canvas width/height that get assigned during PNG conversion.
 */
function setupCanvasMocks() {
  const captured: { width: number; height: number } = { width: 0, height: 0 };

  const mockCtx = {
    drawImage: vi.fn(),
  };

  const mockCanvas = {
    get width() { return captured.width; },
    set width(v: number) { captured.width = v; },
    get height() { return captured.height; },
    set height(v: number) { captured.height = v; },
    getContext: vi.fn().mockReturnValue(mockCtx),
    toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['fake-png'], { type: 'image/png' }));
    }),
  };

  // Mock Image constructor — immediately fires onload
  globalThis.Image = class MockImage {
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set _src(value: string) {
      this.src = value;
      if (this.onload) this.onload();
    }

    constructor() {
      // Use a microtask so the promise handlers are attached before onload fires
      const self = this;
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(this),
        'src',
      );
      Object.defineProperty(this, 'src', {
        get() { return self._srcValue ?? ''; },
        set(v: string) {
          self._srcValue = v;
          // Fire onload asynchronously so the promise .then is attached
          Promise.resolve().then(() => {
            if (self.onload) self.onload();
          });
        },
      });
    }

    private _srcValue?: string;
  } as unknown as typeof Image;

  globalThis.document = {
    createElement: vi.fn().mockReturnValue(mockCanvas),
  } as unknown as Document;

  return captured;
}

describe('Property 10: PNG 导出尺寸与 DPI 成比例', () => {
  let captured: { width: number; height: number };

  beforeEach(() => {
    captured = setupCanvasMocks();
  });

  it('PNG pixel dimensions are proportional to SVG logical size and DPI', async () => {
    // Arbitrary: random SVG logical dimensions + random DPI
    const arbSvgWidth = fc.integer({ min: 50, max: 2000 });
    const arbSvgHeight = fc.integer({ min: 50, max: 2000 });
    const arbDpi = fc.constantFrom(300 as const, 600 as const);

    await fc.assert(
      fc.asyncProperty(arbSvgWidth, arbSvgHeight, arbDpi, async (width, height, dpi) => {
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect/></svg>`;

        // Verify parseSVGDimensions reads the correct logical size
        const dims = parseSVGDimensions(svgString);
        expect(dims.width).toBe(width);
        expect(dims.height).toBe(height);

        // Convert to PNG at the given DPI
        await svgToPngBlob(svgString, dpi);

        // The canvas dimensions should be proportional to logical size * (dpi / 96)
        const scale = dpi / BASE_DPI;
        const expectedWidth = Math.round(width * scale);
        const expectedHeight = Math.round(height * scale);

        expect(captured.width).toBe(expectedWidth);
        expect(captured.height).toBe(expectedHeight);
      }),
      { numRuns: 100 },
    );
  });
});
