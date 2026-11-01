import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Printer,
  RefreshCw,
  AlertCircle,
  FileText,
  Layers,
  Eye,
  Maximize2,
  FileDown,
} from 'lucide-react';
import { resolvePdfBytesAndUrl, ResolvedPdfSource } from '../utils/pdfHelper';

// Configure pdfjs worker using Vite asset URL
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  }
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

export interface PdfCanvasViewerProps {
  url?: string | Uint8Array | null;
  title?: string;
  examId?: string | null;
  studentId?: string | null;
  className?: string;
  showToolbar?: boolean;
  allowDownload?: boolean;
  allowOpenInTab?: boolean;
  allowPrint?: boolean;
  allowRotate?: boolean;
  allowZoom?: boolean;
  initialZoom?: number;
  initialViewMode?: 'continuous' | 'single';
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: string) => void;
}

// Sub-component: Individual PDF Page Canvas with High-DPI and Cancellation Support
interface PageCanvasItemProps {
  pageNumber: number;
  pdfDoc: any;
  zoom: number;
  rotation: number;
  containerWidth: number;
}

const PageCanvasItem: React.FC<PageCanvasItemProps> = React.memo(
  ({ pageNumber, pdfDoc, zoom, rotation, containerWidth }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderTaskRef = useRef<any>(null);
    const [rendering, setRendering] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
      width: 600,
      height: 800,
    });

    useEffect(() => {
      let isCancelled = false;

      async function renderPage() {
        if (!pdfDoc) return;

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (_) {}
          renderTaskRef.current = null;
        }

        try {
          setRendering(true);
          setPageError(null);

          const page = await pdfDoc.getPage(pageNumber);
          if (isCancelled) return;

          // Compute viewport with rotation
          const baseViewport = page.getViewport({ scale: 1.0, rotation });
          
          // Calculate scale to fit container nicely if zoom is auto, otherwise use zoom factor
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // cap at 2.5 to save GPU memory
          const scale = zoom;
          const viewport = page.getViewport({ scale, rotation });

          const displayWidth = Math.floor(viewport.width);
          const displayHeight = Math.floor(viewport.height);

          setDimensions({ width: displayWidth, height: displayHeight });

          const canvas = canvasRef.current;
          if (!canvas || isCancelled) return;

          canvas.width = Math.floor(displayWidth * dpr);
          canvas.height = Math.floor(displayHeight * dpr);
          canvas.style.width = `${displayWidth}px`;
          canvas.style.height = `${displayHeight}px`;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx || isCancelled) return;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const renderContext = {
            canvasContext: ctx,
            viewport,
          };

          const task = page.render(renderContext);
          renderTaskRef.current = task;

          await task.promise;
          if (!isCancelled) {
            setRendering(false);
          }
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
            console.warn(`Error rendering PDF page ${pageNumber}:`, err);
            setPageError(`Failed to render page ${pageNumber}`);
            setRendering(false);
          }
        }
      }

      renderPage();

      return () => {
        isCancelled = true;
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (_) {}
          renderTaskRef.current = null;
        }
      };
    }, [pageNumber, pdfDoc, zoom, rotation]);

    return (
      <div
        id={`pdf-page-${pageNumber}`}
        className="relative mx-auto my-3 bg-white shadow-md rounded-sm border border-slate-200 transition-all"
        style={{ width: `${dimensions.width}px`, minHeight: `${dimensions.height}px` }}
      >
        {rendering && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 text-white rounded-md text-xs font-medium shadow-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Rendering Page {pageNumber}...</span>
            </div>
          </div>
        )}

        {pageError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 min-h-[300px]">
            <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
            <p className="text-xs font-medium">{pageError}</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="block mx-auto" />
        )}

        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/60 text-white text-[10px] font-mono rounded pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
          Page {pageNumber}
        </div>
      </div>
    );
  }
);

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  url,
  title = 'Document',
  examId,
  studentId,
  className = '',
  showToolbar = true,
  allowDownload = true,
  allowOpenInTab = true,
  allowPrint = true,
  allowRotate = true,
  allowZoom = true,
  initialZoom = 1.0,
  initialViewMode = 'continuous',
  onLoadSuccess,
  onLoadError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Resolution state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvedSource, setResolvedSource] = useState<ResolvedPdfSource | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [numPages, setNumPages] = useState<number>(0);

  // Viewer controls state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>(initialViewMode);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [useFallbackEmbed, setUseFallbackEmbed] = useState<boolean>(false);

  // ResizeObserver to track container width for fit calculations
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Main resolver & loader effect
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      setLoading(true);
      setLoadError(null);
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);

      try {
        // Step 1: Resolve raw bytes and blob URL from any input format
        const resolved = await resolvePdfBytesAndUrl(url, { examId, studentId });
        if (isCancelled) return;

        setResolvedSource(resolved);

        // Case A: Multi-page images or single image scan
        if (resolved.isImage) {
          const totalImgPages = resolved.imagePages.length || 1;
          setNumPages(totalImgPages);
          setLoading(false);
          onLoadSuccess?.(totalImgPages);
          return;
        }

        // Case B: PDF Bytes available
        if (resolved.bytes && resolved.bytes.byteLength > 0) {
          const loadingTask = pdfjsLib.getDocument({
            data: resolved.bytes,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
          });

          const doc = await loadingTask.promise;
          if (isCancelled) return;

          setPdfDoc(doc);
          const pagesCount = doc.numPages || 1;
          setNumPages(pagesCount);
          setLoading(false);
          onLoadSuccess?.(pagesCount);
          return;
        }

        // Case C: Blob URL or Remote URL available (without direct bytes yet)
        if (resolved.blobUrl) {
          try {
            const loadingTask = pdfjsLib.getDocument({
              url: resolved.blobUrl,
              cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
              cMapPacked: true,
            });

            const doc = await loadingTask.promise;
            if (isCancelled) return;

            setPdfDoc(doc);
            const pagesCount = doc.numPages || 1;
            setNumPages(pagesCount);
            setLoading(false);
            onLoadSuccess?.(pagesCount);
            return;
          } catch (urlErr) {
            console.warn('PDF.js URL loading notice, falling back to embed:', urlErr);
            // If pdfjs fails on direct URL (e.g. strict CORS), activate fallback embed
            setUseFallbackEmbed(true);
            setLoading(false);
            return;
          }
        }

        // Case D: Nothing could be loaded
        throw new Error(resolved.error || 'The document format could not be decoded or loaded.');
      } catch (err: any) {
        if (!isCancelled) {
          console.error('PDF Document Loading Error:', err);
          const msg = err?.message || 'Unable to load PDF document.';
          setLoadError(msg);
          setLoading(false);
          onLoadError?.(msg);
        }
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [url, examId, studentId, onLoadSuccess, onLoadError]);

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 3.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.4));
  const handleResetZoom = () => setZoom(1.0);

  const handleFitWidth = useCallback(() => {
    // Fit to roughly container width minus padding (32px)
    if (containerWidth > 300) {
      const targetWidth = containerWidth - 48;
      // Standard A4 width is ~595pt
      const estimatedScale = targetWidth / 595;
      setZoom(Math.max(0.5, Math.min(estimatedScale, 2.5)));
    }
  }, [containerWidth]);

  // Rotation handler
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Page navigation
  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
    if (viewMode === 'continuous') {
      const target = document.getElementById(`pdf-page-${Math.max(currentPage - 1, 1)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
    if (viewMode === 'continuous') {
      const target = document.getElementById(`pdf-page-${Math.min(currentPage + 1, numPages)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Download handler
  const handleDownload = () => {
    const downloadUrl = resolvedSource?.blobUrl || (typeof url === 'string' ? url : null);
    if (!downloadUrl) return;

    const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Document'}.pdf`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Open in new window
  const handleOpenInNewTab = () => {
    const targetUrl = resolvedSource?.blobUrl || (typeof url === 'string' ? url : null);
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Print handler
  const handlePrint = () => {
    const targetUrl = resolvedSource?.blobUrl;
    if (targetUrl) {
      const printWin = window.open(targetUrl, '_blank');
      printWin?.focus();
      printWin?.print();
    } else {
      window.print();
    }
  };

  return (
    <div
      ref={containerRef}
      id="pdf-canvas-viewer-root"
      className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 overflow-hidden select-none ${className}`}
    >
      {/* 1. Header Toolbar */}
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-800/95 border-b border-slate-700/80 backdrop-blur-md z-20 shrink-0 text-xs shadow-xs">
          {/* Left: Document info & Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate max-w-[200px] sm:max-w-[320px]">
              <FileText className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">{title}</span>
            </div>

            {numPages > 0 && (
              <div className="flex items-center gap-1 ml-1 bg-slate-900/60 px-2 py-1 rounded-md border border-slate-700 text-slate-300">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-0.5 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] whitespace-nowrap px-1">
                  {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  className="p-0.5 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Controls (Zoom, Rotate, View Mode, Download, Open) */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* View Mode Toggle (Single vs Continuous) */}
            {numPages > 1 && (
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'continuous' ? 'single' : 'continuous'))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
                  viewMode === 'continuous'
                    ? 'bg-sky-600/30 text-sky-300 border-sky-500/40'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700'
                }`}
                title={viewMode === 'continuous' ? 'Switch to Single Page View' : 'Switch to Continuous Scroll View'}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {viewMode === 'continuous' ? 'Scroll' : 'Single'}
                </span>
              </button>
            )}

            {/* Zoom Controls */}
            {allowZoom && (
              <div className="flex items-center bg-slate-900/60 rounded-md border border-slate-700 divide-x divide-slate-700/60">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2 py-1 text-[10px] font-mono text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                  title="Reset 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleFitWidth}
                  className="p-1.5 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors text-[10px] font-medium"
                  title="Fit Page Width"
                >
                  Fit
                </button>
              </div>
            )}

            {/* Rotate */}
            {allowRotate && (
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors"
                title="Rotate Clockwise 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Print */}
            {allowPrint && (
              <button
                type="button"
                onClick={handlePrint}
                className="p-1.5 bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors hidden sm:flex"
                title="Print Document"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Open in New Tab */}
            {allowOpenInTab && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="p-1.5 bg-slate-900/60 hover:bg-slate-700/60 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-colors"
                title="Open in New Tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Download */}
            {allowDownload && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md font-semibold text-[11px] transition-colors shadow-xs"
                title="Download PDF Document"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Viewport Area */}
      <div
        ref={scrollContainerRef}
        id="pdf-canvas-scroll-container"
        className="flex-1 w-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center bg-slate-950/80 custom-scrollbar"
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center m-auto p-12 text-center text-slate-400">
            <div className="w-12 h-12 border-3 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-200">Decoding PDF Document...</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Preparing high-resolution vector canvas rendering
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && loadError && (
          <div className="flex flex-col items-center justify-center m-auto p-8 max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl text-center shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-rose-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Unable to Render PDF Preview</h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{loadError}</p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  setTimeout(() => setLoading(false), 200);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>

              {resolvedSource?.blobUrl && (
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Browser Tab</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        )}

        {/* Fallback Native Embed (If PDF.js fails or user triggers it) */}
        {!loading && !loadError && useFallbackEmbed && resolvedSource?.blobUrl && (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={resolvedSource.blobUrl}
              title={title}
              className="w-full h-full flex-1 rounded-lg border border-slate-700 bg-white"
            />
          </div>
        )}

        {/* Render Mode 1: PDF.js Document Pages */}
        {!loading && !loadError && !useFallbackEmbed && pdfDoc && (
          <div className="flex flex-col items-center w-full">
            {viewMode === 'continuous' ? (
              // All pages stacked in continuous scroll
              Array.from({ length: numPages }, (_, idx) => (
                <PageCanvasItem
                  key={`page-${idx + 1}`}
                  pageNumber={idx + 1}
                  pdfDoc={pdfDoc}
                  zoom={zoom}
                  rotation={rotation}
                  containerWidth={containerWidth}
                />
              ))
            ) : (
              // Single page mode
              <PageCanvasItem
                key={`single-page-${currentPage}`}
                pageNumber={currentPage}
                pdfDoc={pdfDoc}
                zoom={zoom}
                rotation={rotation}
                containerWidth={containerWidth}
              />
            )}
          </div>
        )}

        {/* Render Mode 2: Multi-Page Image / Photos Booklet */}
        {!loading && !loadError && resolvedSource?.isImage && (
          <div className="flex flex-col items-center w-full space-y-4">
            {resolvedSource.imagePages.map((imgSrc, idx) => (
              <div
                key={`img-page-${idx}`}
                className="relative bg-white shadow-md rounded-sm border border-slate-700 overflow-hidden"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                <img
                  src={imgSrc}
                  alt={`Document Page ${idx + 1}`}
                  className="max-w-full h-auto object-contain block"
                />
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/70 text-white text-[10px] font-mono rounded">
                  Page {idx + 1} of {resolvedSource.imagePages.length}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
