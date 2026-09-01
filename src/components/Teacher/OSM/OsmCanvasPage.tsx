import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  OsmTool,
  OsmShapeType,
  OsmStampType,
  OsmPageAnnotations,
  OsmPenStroke,
  OsmHighlighterStroke,
  OsmTextAnnotation,
  OsmShapeAnnotation,
  OsmStampAnnotation,
  OsmNormalizedPoint,
} from '../../../types/osm';
import { drawSmoothStrokeOnCanvas, isPointNearStroke } from '../../../utils/strokeHelper';
import { Trash2, Move, Edit2, Check, X } from 'lucide-react';

interface OsmCanvasPageProps {
  pageIndex: number;
  pdfDoc: any | null; // PDFDocumentProxy from pdfjs-dist
  imageSrc?: string | null; // Direct student page image
  zoom: number;
  activeTool: OsmTool;
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  shapeType: OsmShapeType;
  shapeWidth: number;
  selectedStamp: OsmStampType;
  annotations: OsmPageAnnotations;
  onUpdateAnnotations: (pageIndex: number, newAnnotations: OsmPageAnnotations) => void;
  onPageDimensionsLoaded?: (pageIndex: number, dimensions: { width: number; height: number }) => void;
}

export const OsmCanvasPage: React.FC<OsmCanvasPageProps> = ({
  pageIndex,
  pdfDoc,
  imageSrc,
  zoom,
  activeTool,
  penColor,
  penSize,
  highlighterColor,
  highlighterSize,
  shapeType,
  shapeWidth,
  selectedStamp,
  annotations,
  onUpdateAnnotations,
  onPageDimensionsLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 600, height: 850 });
  const [pageLoading, setPageLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Active PDF render task ref to prevent "Cannot use the same canvas during multiple render() operations"
  const renderTaskRef = useRef<any>(null);
  const onPageDimensionsLoadedRef = useRef(onPageDimensionsLoaded);
  useEffect(() => {
    onPageDimensionsLoadedRef.current = onPageDimensionsLoaded;
  }, [onPageDimensionsLoaded]);

  // Active Drawing State
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<OsmNormalizedPoint[]>([]);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  // Text Inline Editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingTextPos, setEditingTextPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selected item for Move / Drag
  const [selectedAnnotation, setSelectedAnnotation] = useState<{ type: 'text' | 'shape'; id: string } | null>(null);
  const isDraggingAnnotationRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; originalX: number; originalY: number } | null>(null);

  // 1. Render Direct Image or PDF page
  useEffect(() => {
    let isCancelled = false;

    // Direct Image Mode (renders student's original photos directly)
    if (imageSrc) {
      setPageLoading(true);
      setRenderError(null);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (isCancelled) return;
        const naturalW = img.naturalWidth || 800;
        const naturalH = img.naturalHeight || 1130;

        if (onPageDimensionsLoadedRef.current) {
          onPageDimensionsLoadedRef.current(pageIndex, { width: naturalW, height: naturalH });
        }

        // Standard display base width 794px scaled by zoom
        const baseWidth = 794;
        const baseHeight = (naturalH / naturalW) * baseWidth;
        const viewportWidth = baseWidth * zoom;
        const viewportHeight = baseHeight * zoom;
        const dpr = window.devicePixelRatio || 1;

        setPageSize({ width: viewportWidth, height: viewportHeight });

        const canvas = pdfCanvasRef.current;
        if (!canvas || isCancelled) return;

        canvas.width = Math.floor(viewportWidth * dpr);
        canvas.height = Math.floor(viewportHeight * dpr);
        canvas.style.width = `${viewportWidth}px`;
        canvas.style.height = `${viewportHeight}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx || isCancelled) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(img, 0, 0, viewportWidth, viewportHeight);

        setPageLoading(false);
      };

      img.onerror = () => {
        if (isCancelled) return;
        setRenderError('Could not load student answer sheet photo.');
        setPageLoading(false);
      };

      img.src = imageSrc;

      return () => {
        isCancelled = true;
      };
    }

    // PDF.js Mode
    async function renderPdfPage() {
      if (!pdfDoc) return;

      // Cancel any ongoing render task on this canvas before starting a new one
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
        renderTaskRef.current = null;
      }

      try {
        setPageLoading(true);
        setRenderError(null);

        const page = await pdfDoc.getPage(pageIndex + 1);
        if (isCancelled) return;

        // Standard unscaled viewport to get base dimensions
        const baseViewport = page.getViewport({ scale: 1.0 });
        const baseWidth = baseViewport.width;
        const baseHeight = baseViewport.height;

        if (onPageDimensionsLoadedRef.current) {
          onPageDimensionsLoadedRef.current(pageIndex, { width: baseWidth, height: baseHeight });
        }

        // Scaled viewport for current zoom
        const scale = zoom;
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;

        setPageSize({ width: viewport.width, height: viewport.height });

        const canvas = pdfCanvasRef.current;
        if (!canvas || isCancelled) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx || isCancelled) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setPageLoading(false);
        }
      } catch (err: any) {
        // Ignore expected cancellation exceptions when switching zoom/pages
        if (err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled')) {
          return;
        }
        if (!isCancelled) {
          console.warn(`Error rendering PDF page ${pageIndex + 1}:`, err);
          setRenderError(err.message || 'Failed to render PDF page');
          setPageLoading(false);
        }
      } finally {
        if (!isCancelled) {
          renderTaskRef.current = null;
        }
      }
    }

    renderPdfPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
        renderTaskRef.current = null;
      }
    };
  }, [imageSrc, pdfDoc, pageIndex, zoom]);

  // 2. Redraw Annotations Canvas Layer whenever annotations or zoom changes
  const redrawAnnotationsCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const { width, height } = pageSize;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // A. Highlighters (bottom layer)
    if (annotations?.highlighters) {
      for (const h of annotations.highlighters) {
        drawSmoothStrokeOnCanvas(ctx, h.points, width, height, {
          color: h.color,
          size: h.size * zoom,
          opacity: h.opacity ?? 0.35,
          isHighlighter: true,
        });
      }
    }

    // B. Shapes
    if (annotations?.shapes) {
      for (const s of annotations.shapes) {
        const sx = s.startX * width;
        const sy = s.startY * height;
        const ex = s.endX * width;
        const ey = s.endY * height;

        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.fill || 'transparent';
        ctx.lineWidth = s.strokeWidth * zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (s.type === 'line') {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        } else if (s.type === 'arrow') {
          const headlen = Math.max(8, s.strokeWidth * zoom * 2.5);
          const angle = Math.atan2(ey - sy, ex - sx);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.beginPath();
          ctx.fillStyle = s.color;
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headlen * Math.cos(angle - Math.PI / 6), ey - headlen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(ex - headlen * Math.cos(angle + Math.PI / 6), ey - headlen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        } else if (s.type === 'rect') {
          const rx = Math.min(sx, ex);
          const ry = Math.min(sy, ey);
          const rw = Math.abs(ex - sx);
          const rh = Math.abs(ey - sy);
          if (s.fill && s.fill !== 'transparent') ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
        } else if (s.type === 'circle') {
          const rx = Math.abs(ex - sx) / 2;
          const ry = Math.abs(ey - sy) / 2;
          const cx = Math.min(sx, ex) + rx;
          const cy = Math.min(sy, ey) + ry;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (s.fill && s.fill !== 'transparent') ctx.fill();
          ctx.stroke();
        } else if (s.type === 'tick') {
          const w = Math.abs(ex - sx) || 28 * zoom;
          const h = Math.abs(ey - sy) || 28 * zoom;
          const bx = Math.min(sx, ex);
          const by = Math.min(sy, ey);
          ctx.beginPath();
          ctx.moveTo(bx + w * 0.1, by + h * 0.55);
          ctx.lineTo(bx + w * 0.4, by + h * 0.9);
          ctx.lineTo(bx + w * 0.95, by + h * 0.15);
          ctx.stroke();
        } else if (s.type === 'cross') {
          const bx = Math.min(sx, ex);
          const by = Math.min(sy, ey);
          const w = Math.abs(ex - sx) || 24 * zoom;
          const h = Math.abs(ey - sy) || 24 * zoom;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + w, by + h);
          ctx.moveTo(bx + w, by);
          ctx.lineTo(bx, by + h);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // C. Pen Strokes
    if (annotations?.strokes) {
      for (const stroke of annotations.strokes) {
        drawSmoothStrokeOnCanvas(ctx, stroke.points, width, height, {
          color: stroke.color,
          size: stroke.size * zoom,
          opacity: stroke.opacity ?? 1.0,
          isHighlighter: false,
        });
      }
    }

    // D. Stamps
    if (annotations?.stamps) {
      for (const stamp of annotations.stamps) {
        const sx = stamp.x * width;
        const sy = stamp.y * height;
        ctx.save();
        ctx.font = `bold ${Math.round((stamp.fontSize || 16) * zoom)}px sans-serif`;
        ctx.fillStyle = stamp.color;
        ctx.textBaseline = 'middle';
        ctx.fillText(stamp.label, sx, sy);
        ctx.restore();
      }
    }
  }, [pageSize, annotations, zoom]);

  useEffect(() => {
    redrawAnnotationsCanvas();
  }, [redrawAnnotationsCanvas]);

  // Handle Pointer Events (Mouse, Pen/Stylus, Touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const normX = Math.max(0, Math.min(1, clientX / rect.width));
    const normY = Math.max(0, Math.min(1, clientY / rect.height));
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    // Capture pointer
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      isDrawingRef.current = true;
      currentPointsRef.current = [{ x: normX, y: normY, pressure }];
    } else if (activeTool === 'shape') {
      isDrawingRef.current = true;
      startPointRef.current = { x: normX, y: normY };
      currentPointsRef.current = [{ x: normX, y: normY }];
    } else if (activeTool === 'eraser') {
      // Erase at point
      eraseAtPoint(normX, normY);
      isDrawingRef.current = true;
    } else if (activeTool === 'stamp') {
      // Place Stamp
      placeStampAt(normX, normY);
    } else if (activeTool === 'text') {
      // Open inline text editor
      startNewTextAnnotation(normX, normY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const normX = Math.max(0, Math.min(1, clientX / rect.width));
    const normY = Math.max(0, Math.min(1, clientY / rect.height));
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      currentPointsRef.current.push({ x: normX, y: normY, pressure });

      // Live rendering onto drawing canvas
      const canvas = drawingCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        redrawAnnotationsCanvas(); // Redraw base layer

        // Draw live active stroke
        const { width, height } = pageSize;
        drawSmoothStrokeOnCanvas(ctx, currentPointsRef.current, width, height, {
          color: activeTool === 'pen' ? penColor : highlighterColor,
          size: (activeTool === 'pen' ? penSize : highlighterSize) * zoom,
          opacity: activeTool === 'highlighter' ? 0.35 : 1.0,
          isHighlighter: activeTool === 'highlighter',
        });
      }
    } else if (activeTool === 'shape' && startPointRef.current) {
      // Live preview of shape
      const canvas = drawingCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        redrawAnnotationsCanvas();

        const { width, height } = pageSize;
        const sx = startPointRef.current.x * width;
        const sy = startPointRef.current.y * height;
        const ex = normX * width;
        const ey = normY * height;

        ctx.save();
        ctx.strokeStyle = penColor;
        ctx.lineWidth = shapeWidth * zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (shapeType === 'line') {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        } else if (shapeType === 'arrow') {
          const headlen = Math.max(8, shapeWidth * zoom * 2.5);
          const angle = Math.atan2(ey - sy, ex - sx);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.beginPath();
          ctx.fillStyle = penColor;
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headlen * Math.cos(angle - Math.PI / 6), ey - headlen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(ex - headlen * Math.cos(angle + Math.PI / 6), ey - headlen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        } else if (shapeType === 'rect') {
          const rx = Math.min(sx, ex);
          const ry = Math.min(sy, ey);
          const rw = Math.abs(ex - sx);
          const rh = Math.abs(ey - sy);
          ctx.strokeRect(rx, ry, rw, rh);
        } else if (shapeType === 'circle') {
          const rx = Math.abs(ex - sx) / 2;
          const ry = Math.abs(ey - sy) / 2;
          const cx = Math.min(sx, ex) + rx;
          const cy = Math.min(sy, ey) + ry;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (shapeType === 'tick') {
          const w = Math.abs(ex - sx) || 28 * zoom;
          const h = Math.abs(ey - sy) || 28 * zoom;
          const bx = Math.min(sx, ex);
          const by = Math.min(sy, ey);
          ctx.beginPath();
          ctx.moveTo(bx + w * 0.1, by + h * 0.55);
          ctx.lineTo(bx + w * 0.4, by + h * 0.9);
          ctx.lineTo(bx + w * 0.95, by + h * 0.15);
          ctx.stroke();
        } else if (shapeType === 'cross') {
          const bx = Math.min(sx, ex);
          const by = Math.min(sy, ey);
          const w = Math.abs(ex - sx) || 24 * zoom;
          const h = Math.abs(ey - sy) || 24 * zoom;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + w, by + h);
          ctx.moveTo(bx + w, by);
          ctx.lineTo(bx, by + h);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (activeTool === 'eraser') {
      eraseAtPoint(normX, normY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (activeTool === 'pen') {
      if (currentPointsRef.current.length > 0) {
        const newStroke: OsmPenStroke = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          points: [...currentPointsRef.current],
          color: penColor,
          size: penSize,
          opacity: 1.0,
          createdAt: Date.now(),
        };

        const existingStrokes = annotations.strokes || [];
        onUpdateAnnotations(pageIndex, {
          ...annotations,
          strokes: [...existingStrokes, newStroke],
        });
      }
    } else if (activeTool === 'highlighter') {
      if (currentPointsRef.current.length > 0) {
        const newHighlighter: OsmHighlighterStroke = {
          id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          points: [...currentPointsRef.current],
          color: highlighterColor,
          size: highlighterSize,
          opacity: 0.35,
          createdAt: Date.now(),
        };

        const existingHL = annotations.highlighters || [];
        onUpdateAnnotations(pageIndex, {
          ...annotations,
          highlighters: [...existingHL, newHighlighter],
        });
      }
    } else if (activeTool === 'shape' && startPointRef.current) {
      const rect = drawingCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const normX = Math.max(0, Math.min(1, clientX / rect.width));
      const normY = Math.max(0, Math.min(1, clientY / rect.height));

      const newShape: OsmShapeAnnotation = {
        id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: shapeType,
        startX: startPointRef.current.x,
        startY: startPointRef.current.y,
        endX: normX,
        endY: normY,
        color: penColor,
        strokeWidth: shapeWidth,
        createdAt: Date.now(),
      };

      const existingShapes = annotations.shapes || [];
      onUpdateAnnotations(pageIndex, {
        ...annotations,
        shapes: [...existingShapes, newShape],
      });
      startPointRef.current = null;
    }

    currentPointsRef.current = [];
  };

  // Erase annotations near point (only erases teacher annotations, original PDF is untouched)
  const eraseAtPoint = (px: number, py: number) => {
    let changed = false;
    const newStrokes = (annotations.strokes || []).filter((s) => {
      const hit = isPointNearStroke(px, py, s.points, 0.025);
      if (hit) changed = true;
      return !hit;
    });

    const newHL = (annotations.highlighters || []).filter((h) => {
      const hit = isPointNearStroke(px, py, h.points, 0.035);
      if (hit) changed = true;
      return !hit;
    });

    const newShapes = (annotations.shapes || []).filter((s) => {
      const minX = Math.min(s.startX, s.endX) - 0.02;
      const maxX = Math.max(s.startX, s.endX) + 0.02;
      const minY = Math.min(s.startY, s.endY) - 0.02;
      const maxY = Math.max(s.startY, s.endY) + 0.02;
      const hit = px >= minX && px <= maxX && py >= minY && py <= maxY;
      if (hit) changed = true;
      return !hit;
    });

    const newStamps = (annotations.stamps || []).filter((st) => {
      const dist = Math.hypot(st.x - px, st.y - py);
      const hit = dist < 0.04;
      if (hit) changed = true;
      return !hit;
    });

    const newTexts = (annotations.texts || []).filter((t) => {
      const dist = Math.hypot(t.x - px, t.y - py);
      const hit = dist < 0.04;
      if (hit) changed = true;
      return !hit;
    });

    if (changed) {
      onUpdateAnnotations(pageIndex, {
        ...annotations,
        strokes: newStrokes,
        highlighters: newHL,
        shapes: newShapes,
        stamps: newStamps,
        texts: newTexts,
      });
    }
  };

  // Place Stamp at normalized position
  const placeStampAt = (px: number, py: number) => {
    const stampLabels: Record<OsmStampType, { label: string; color: string }> = {
      plus1: { label: '+1', color: '#16a34a' },
      plus2: { label: '+2', color: '#16a34a' },
      plus3: { label: '+3', color: '#16a34a' },
      plus4: { label: '+4', color: '#16a34a' },
      plus5: { label: '+5', color: '#16a34a' },
      half: { label: '½', color: '#2563eb' },
      zero: { label: '0', color: '#dc2626' },
      correct: { label: '✓ Correct', color: '#16a34a' },
      wrong: { label: '✗ Wrong', color: '#dc2626' },
      explain: { label: 'Explain this step', color: '#ea580c' },
      recheck: { label: 'Recheck calculation', color: '#9333ea' },
      tick: { label: '✓', color: '#16a34a' },
      cross: { label: '✗', color: '#dc2626' },
    };

    const cfg = stampLabels[selectedStamp] || { label: '+1', color: '#16a34a' };

    const newStamp: OsmStampAnnotation = {
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: px,
      y: py,
      stampType: selectedStamp,
      label: cfg.label,
      color: cfg.color,
      fontSize: 18,
      createdAt: Date.now(),
    };

    const existingStamps = annotations.stamps || [];
    onUpdateAnnotations(pageIndex, {
      ...annotations,
      stamps: [...existingStamps, newStamp],
    });
  };

  // Text Tool handlers
  const startNewTextAnnotation = (px: number, py: number) => {
    const newId = `text_${Date.now()}`;
    setEditingTextId(newId);
    setEditingTextValue('');
    setEditingTextPos({ x: px, y: py });
  };

  const handleSaveTextAnnotation = () => {
    if (!editingTextId || !editingTextValue.trim()) {
      setEditingTextId(null);
      return;
    }

    const existing = (annotations.texts || []).filter((t) => t.id !== editingTextId);
    const newText: OsmTextAnnotation = {
      id: editingTextId,
      x: editingTextPos.x,
      y: editingTextPos.y,
      text: editingTextValue.trim(),
      color: penColor || '#dc2626',
      fontSize: 14,
      bold: true,
      italic: false,
      bgColor: '#ffffffd9',
      createdAt: Date.now(),
    };

    onUpdateAnnotations(pageIndex, {
      ...annotations,
      texts: [...existing, newText],
    });

    setEditingTextId(null);
    setEditingTextValue('');
  };

  const handleDeleteTextAnnotation = (id: string) => {
    const updated = (annotations.texts || []).filter((t) => t.id !== id);
    onUpdateAnnotations(pageIndex, {
      ...annotations,
      texts: updated,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-white shadow-xl rounded-sm mx-auto my-4 select-none border border-slate-300 overflow-visible transition-shadow"
      style={{ width: `${pageSize.width}px`, height: `${pageSize.height}px` }}
    >
      {/* Background Page Loading indicator */}
      {pageLoading && (
        <div className="absolute inset-0 bg-slate-50/80 flex items-center justify-center text-xs text-slate-500 z-10">
          <span className="animate-pulse font-mono">Rendering Page {pageIndex + 1}...</span>
        </div>
      )}

      {renderError && (
        <div className="absolute inset-0 bg-rose-50/90 p-4 flex flex-col items-center justify-center text-xs text-rose-700 z-10 text-center">
          <p className="font-bold">Error Rendering Page {pageIndex + 1}</p>
          <p className="text-[11px] mt-1 text-rose-600">{renderError}</p>
        </div>
      )}

      {/* Layer 1: PDF Background Canvas */}
      <canvas
        ref={pdfCanvasRef}
        className="absolute inset-0 block pointer-events-none"
      />

      {/* Layer 2: Interactive Drawing & Annotations Canvas */}
      <canvas
        ref={drawingCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`absolute inset-0 block touch-none z-10 ${
          activeTool === 'pen'
            ? 'cursor-crosshair'
            : activeTool === 'highlighter'
            ? 'cursor-cell'
            : activeTool === 'eraser'
            ? 'cursor-pointer'
            : activeTool === 'text'
            ? 'cursor-text'
            : activeTool === 'stamp'
            ? 'cursor-copy'
            : 'cursor-default'
        }`}
      />

      {/* Layer 3: Render Interactive Text Annotations (DOM elements for crisp typing & editing) */}
      {annotations?.texts?.map((t) => {
        const left = t.x * pageSize.width;
        const top = t.y * pageSize.height;

        return (
          <div
            key={t.id}
            style={{
              left: `${left}px`,
              top: `${top}px`,
              transform: 'translate(-4px, -4px)',
            }}
            className="absolute z-20 group"
          >
            <div
              className="px-2 py-1 rounded shadow-xs border border-amber-300 bg-amber-50/95 text-slate-900 font-semibold max-w-xs transition-all hover:ring-2 hover:ring-amber-400"
              style={{
                color: t.color || '#dc2626',
                fontSize: `${Math.max(11, t.fontSize * zoom)}px`,
              }}
            >
              <div className="whitespace-pre-wrap leading-tight">{t.text}</div>
            </div>

            {/* Quick Actions overlay on hover in select mode */}
            {activeTool === 'select' && (
              <div className="hidden group-hover:flex items-center gap-1 absolute -top-7 left-0 bg-slate-900 text-white rounded px-1.5 py-0.5 shadow-md text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTextId(t.id);
                    setEditingTextValue(t.text);
                    setEditingTextPos({ x: t.x, y: t.y });
                  }}
                  className="p-1 hover:text-sky-400"
                  title="Edit Text"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTextAnnotation(t.id)}
                  className="p-1 hover:text-rose-400"
                  title="Delete Text"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Inline Text Box Creation Overlay */}
      {editingTextId && (
        <div
          style={{
            left: `${editingTextPos.x * pageSize.width}px`,
            top: `${editingTextPos.y * pageSize.height}px`,
          }}
          className="absolute z-30 bg-white border-2 border-sky-500 rounded-lg p-2 shadow-2xl space-y-2 min-w-[220px]"
        >
          <textarea
            autoFocus
            rows={2}
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSaveTextAnnotation();
              } else if (e.key === 'Escape') {
                setEditingTextId(null);
              }
            }}
            placeholder="Type comment or feedback..."
            className="w-full text-xs font-semibold p-1.5 border border-slate-300 rounded focus:outline-none focus:border-sky-500 resize-none font-sans"
            style={{ color: penColor }}
          />

          <div className="flex items-center justify-between gap-1 text-xs pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">Ctrl+Enter to save</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditingTextId(null)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSaveTextAnnotation}
                className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1"
                title="Save Text Note"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Page Number Watermark */}
      <div className="absolute bottom-2 right-3 pointer-events-none text-[11px] font-mono font-semibold text-slate-400/80 bg-slate-100/70 px-2 py-0.5 rounded border border-slate-200">
        Page {pageIndex + 1}
      </div>
    </div>
  );
};
