import React, { useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  pdfUrl?: string | null;
  examId?: string | null;
  studentId?: string | null;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title = 'Document Viewer',
  pdfUrl,
  examId,
  studentId,
}) => {
  const safeTitle = typeof title === 'string' && title ? title : 'Document Viewer';
  const safePdfUrl = typeof pdfUrl === 'string' ? pdfUrl.trim() : (pdfUrl ? String(pdfUrl) : '');

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ErrorBoundary
      fallbackTitle="Unable to display document modal"
      fallbackMessage="There was an issue opening the PDF viewer. You can close this window or try opening the link directly."
      onReset={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
        <div className="relative w-full h-full sm:h-[94vh] sm:max-w-6xl bg-slate-900 border border-slate-700/80 sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
          {/* Modal Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-800 border-b border-slate-700/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">{safeTitle}</h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center"
              aria-label="Close PDF Viewer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas Engine Viewer */}
          <div className="flex-1 w-full overflow-hidden bg-slate-950">
            <PdfCanvasViewer
              url={safePdfUrl}
              title={safeTitle}
              examId={examId}
              studentId={studentId}
              className="w-full h-full"
              allowDownload={true}
              allowOpenInTab={true}
              allowPrint={true}
              allowRotate={true}
              allowZoom={true}
              initialZoom={1.0}
              initialViewMode="continuous"
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

