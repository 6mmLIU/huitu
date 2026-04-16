'use client';

import { render } from '@/lib/render-engine';
import { generateSVG } from '@/lib/svg-generator';
import type { IR } from '@/types/ir';
import type { StyleConfig } from '@/types/style';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './FlowCanvas.module.css';

export interface FlowCanvasProps {
  ir: IR | null;
  style: StyleConfig;
  onRenderComplete?: () => void;
  onExportSVG?: () => void;
  onExportPNG?: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export default function FlowCanvas({
  ir,
  style,
  onRenderComplete,
  onExportSVG,
  onExportPNG,
}: FlowCanvasProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Debounce timer for re-renders triggered by style changes
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Core render logic
  // -----------------------------------------------------------------------

  const doRender = useCallback(
    async (currentIr: IR, currentStyle: StyleConfig) => {
      setIsRendering(true);
      try {
        const result = await render({
          ir: currentIr,
          style: currentStyle,
          layoutEngine: 'dagre',
        });
        const svgResult = generateSVG({
          layout: result.layout,
          style: currentStyle,
        });
        setSvgContent(svgResult.svgString);
        onRenderComplete?.();
      } catch {
        setSvgContent(null);
      } finally {
        setIsRendering(false);
      }
    },
    [onRenderComplete],
  );

  // Re-render when ir or style changes (debounced within 500ms)
  useEffect(() => {
    if (renderTimerRef.current) {
      clearTimeout(renderTimerRef.current);
    }

    if (!ir) {
      setSvgContent(null);
      return;
    }

    renderTimerRef.current = setTimeout(() => {
      doRender(ir, style);
    }, 100); // Small debounce; well within the 500ms requirement

    return () => {
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current);
      }
    };
  }, [ir, style, doRender]);

  // -----------------------------------------------------------------------
  // Zoom (mouse wheel)
  // -----------------------------------------------------------------------

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
    });
  }, []);

  // -----------------------------------------------------------------------
  // Pan (mouse drag)
  // -----------------------------------------------------------------------

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only left button
    if (e.button !== 0) return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Release panning if mouse leaves the canvas area
  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const hasFlowchart = svgContent !== null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Flow Canvas</span>
        {hasFlowchart && (
          <div className={styles.exportButtons}>
            {onExportSVG && (
              <button
                className={styles.exportButton}
                onClick={onExportSVG}
                aria-label="Export as SVG"
              >
                Export SVG
              </button>
            )}
            {onExportPNG && (
              <button
                className={styles.exportButton}
                onClick={onExportPNG}
                aria-label="Export as PNG"
              >
                Export PNG
              </button>
            )}
          </div>
        )}
      </div>

      <div
        ref={canvasRef}
        className={`${styles.canvasArea}${isPanningRef.current ? ` ${styles.grabbing}` : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label="Flowchart canvas"
      >
        {isRendering && <div className={styles.loading}>渲染中...</div>}

        {!isRendering && !hasFlowchart && (
          <div className={styles.placeholder}>
            在左侧输入文本并点击"生成"以预览流程图
          </div>
        )}

        {!isRendering && hasFlowchart && (
          <div
            className={styles.svgWrapper}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>
    </div>
  );
}
