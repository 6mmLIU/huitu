/**
 * Export Service — SVG/PNG export with font embedding and browser download
 *
 * Converts SVG strings into downloadable files.
 * SVG export embeds @font-face declarations for SimSun and Times New Roman.
 * Ensures exported SVG file size does not exceed 500KB.
 * Triggers browser download within 1 second.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 11.4
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** SVG markup string to export */
  svgString: string;
  /** Target format */
  format: 'svg' | 'png';
  /** PNG resolution (PNG only) */
  dpi?: 300 | 600;
  /** Embed @font-face declarations in SVG (SVG only, default true) */
  embedFonts?: boolean;
}

/** Maximum SVG file size in bytes (500 KB) */
const MAX_SVG_SIZE = 500 * 1024;

// ---------------------------------------------------------------------------
// Font embedding
// ---------------------------------------------------------------------------

/**
 * Build @font-face CSS declarations for academic fonts.
 * In MVP we declare font-family references (no actual font file embedding).
 */
function buildFontFaceCSS(): string {
  return [
    '@font-face {',
    "  font-family: 'SimSun';",
    '  src: local(\'SimSun\'), local(\'宋体\');',
    '  font-weight: normal;',
    '  font-style: normal;',
    '}',
    '@font-face {',
    "  font-family: 'Times New Roman';",
    "  src: local('Times New Roman');",
    '  font-weight: normal;',
    '  font-style: normal;',
    '}',
  ].join('\n');
}

/**
 * Inject @font-face declarations into an SVG string.
 *
 * Strategy:
 * 1. If a `<defs>` element exists, prepend a `<style>` block inside it.
 * 2. Otherwise, insert a `<defs><style>…</style></defs>` right after the opening `<svg …>` tag.
 */
export function embedFontsInSVG(svgString: string): string {
  const fontCSS = buildFontFaceCSS();
  const styleBlock = `<style type="text/css">\n${fontCSS}\n</style>`;

  // Check if <defs> already exists
  const defsOpenIdx = svgString.indexOf('<defs>');
  if (defsOpenIdx !== -1) {
    // Insert style block right after <defs>
    const insertPos = defsOpenIdx + '<defs>'.length;
    return (
      svgString.slice(0, insertPos) +
      '\n' + styleBlock + '\n' +
      svgString.slice(insertPos)
    );
  }

  // No <defs> — insert after opening <svg ...> tag
  const svgTagCloseIdx = svgString.indexOf('>');
  if (svgTagCloseIdx === -1) {
    // Malformed SVG, return as-is
    return svgString;
  }
  const insertPos = svgTagCloseIdx + 1;
  return (
    svgString.slice(0, insertPos) +
    '\n<defs>\n' + styleBlock + '\n</defs>\n' +
    svgString.slice(insertPos)
  );
}

// ---------------------------------------------------------------------------
// Download trigger
// ---------------------------------------------------------------------------

/**
 * Trigger a browser file download for the given Blob.
 * Uses a temporary anchor element + object URL.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // Clean up
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// SVG → PNG conversion via Canvas API
// ---------------------------------------------------------------------------

/** Standard screen DPI baseline */
const BASE_DPI = 96;

/**
 * Parse width/height from an SVG string.
 * Looks for `width="…"` and `height="…"` attributes on the root `<svg>` tag,
 * then falls back to the `viewBox` attribute.
 */
export function parseSVGDimensions(svgString: string): { width: number; height: number } {
  // Try explicit width/height attributes first
  const wMatch = svgString.match(/<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"/);
  const hMatch = svgString.match(/<svg[^>]*\bheight="(\d+(?:\.\d+)?)"/);

  if (wMatch && hMatch) {
    return { width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }

  // Fallback to viewBox
  const vbMatch = svgString.match(/<svg[^>]*\bviewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)"/);
  if (vbMatch) {
    return { width: parseFloat(vbMatch[1]), height: parseFloat(vbMatch[2]) };
  }

  // Default fallback
  return { width: 300, height: 150 };
}

/**
 * Convert an SVG string to a PNG Blob at the specified DPI.
 *
 * Steps:
 * 1. Embed fonts into the SVG so the rendered image matches Flow_Canvas display
 * 2. Create a data URL from the SVG
 * 3. Load it into an Image element
 * 4. Draw onto a Canvas scaled by (dpi / 96)
 * 5. Export the Canvas as a PNG Blob
 */
export async function svgToPngBlob(svgString: string, dpi: 300 | 600): Promise<Blob> {
  const scale = dpi / BASE_DPI;
  const svgWithFonts = embedFontsInSVG(svgString);
  const { width, height } = parseSVGDimensions(svgWithFonts);

  const canvasWidth = Math.round(width * scale);
  const canvasHeight = Math.round(height * scale);

  // Encode SVG as a data URL
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgWithFonts);

  // Load into an Image
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG into Image element for PNG conversion.'));
    img.src = svgDataUrl;
  });

  // Draw onto a Canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get Canvas 2D context for PNG export.');
  }

  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  // Export as PNG Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null during PNG export.'));
        }
      },
      'image/png',
    );
  });
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Export a flowchart SVG to the requested format and trigger a browser download.
 *
 * For SVG format:
 * 1. Optionally embeds @font-face declarations
 * 2. Validates file size ≤ 500 KB
 * 3. Creates a Blob and triggers download
 *
 * @returns The created Blob (useful for testing / further processing)
 * @throws Error if SVG exceeds 500 KB or format is unsupported
 */
export async function exportFlowchart(options: ExportOptions): Promise<Blob> {
  const { svgString, format, embedFonts: shouldEmbedFonts = true } = options;

  if (format === 'svg') {
    // Step 1: Optionally embed fonts
    const finalSVG = shouldEmbedFonts
      ? embedFontsInSVG(svgString)
      : svgString;

    // Step 2: Check file size
    const blob = new Blob([finalSVG], { type: 'image/svg+xml' });
    if (blob.size > MAX_SVG_SIZE) {
      throw new Error(
        `SVG file size (${blob.size} bytes) exceeds the 500KB limit. ` +
        'Try simplifying the flowchart or disabling font embedding.',
      );
    }

    // Step 3: Trigger download
    triggerDownload(blob, 'flowchart.svg');

    return blob;
  }

  if (format === 'png') {
    const dpi = options.dpi ?? 300;
    const pngBlob = await svgToPngBlob(svgString, dpi);
    triggerDownload(pngBlob, 'flowchart.png');
    return pngBlob;
  }

  throw new Error(`Export format "${format}" is not supported.`);
}
