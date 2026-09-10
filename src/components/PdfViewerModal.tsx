import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Download, FileText, AlertCircle, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { getEmbeddablePdfUrl, base64ToBlobUrl } from '../utils/pdfHelper';
import { ErrorBoundary } from './ErrorBoundary';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  pdfUrl?: string | null;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ isOpen, onClose, title = 'Document Viewer', pdfUrl }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [useDocsViewer, setUseDocsViewer] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const safeTitle = typeof title === 'string' && title ? title : 'Document Viewer';
  const safePdfUrl = typeof pdfUrl === 'string' ? pdfUrl.trim() : '';

  useEffect(() => {
    if (isOpen && safePdfUrl) {
      setUseDocsViewer(false);
      setIframeError(false);

      if (safePdfUrl.startsWith('data:')) {
        const url = base64ToBlobUrl(safePdfUrl);
        setBlobUrl(url);
        return () => {
          if (url) {
            try {
              URL.revokeObjectURL(url);
            } catch (e) {
              // ignore cleanup error
            }
          }
        };
      } else {
        setBlobUrl(null);
      }
    }
  }, [isOpen, safePdfUrl]);

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

  const { embedUrl, isDriveUrl, driveFileId, directDownloadUrl } = getEmbeddablePdfUrl(safePdfUrl);

  const isDataUrl = safePdfUrl.startsWith('data:');

  const displayUrl = blobUrl
    ? blobUrl
    : useDocsViewer && directDownloadUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(directDownloadUrl)}&embedded=true`
    : embedUrl || safePdfUrl;

  const openInDriveUrl = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`
    : safePdfUrl;

  const sanitizedFilename = `${safeTitle.replace(/[^a-zA-Z0-9_-]/g, '_') || 'document'}.pdf`;

  return (
    <ErrorBoundary
      fallbackTitle="Unable to display document modal"
      fallbackMessage="There was an issue opening the PDF viewer. You can close this window or try opening the link directly."
      onReset={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
        <div className="relative w-full h-full sm:h-[90vh] sm:max-w-5xl bg-white border border-slate-200 sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{safeTitle}</h3>
                <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">
                  {isDriveUrl
                    ? `Google Drive Document (ID: ${driveFileId})`
                    : isDataUrl
                    ? 'Uploaded PDF Document'
                    : safePdfUrl || 'No URL specified'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {isDriveUrl && (
                <button
                  type="button"
                  onClick={() => setUseDocsViewer(!useDocsViewer)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-xs min-h-[38px]"
                  title="Toggle alternate Google Docs viewer engine"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{useDocsViewer ? 'Default Viewer' : 'Alt Viewer'}</span>
                </button>
              )}

              {!isDataUrl && safePdfUrl && (
                <a
                  href={openInDriveUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-xs min-h-[38px]"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
              )}

              {safePdfUrl && (
                <a
                  href={directDownloadUrl || safePdfUrl}
                  download={sanitizedFilename}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs min-h-[38px]"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              )}

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                aria-label="Close PDF Viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drive Permission helper tip */}
          {isDriveUrl && (
            <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 text-[11px] text-amber-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>Tip:</strong> If the preview requires login permissions, click <strong>Open in Tab</strong> to access with your authorized Google Account.
                </span>
              </div>
            </div>
          )}

          {/* Document Content View */}
          <div className="flex-1 bg-slate-100/70 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
            {displayUrl && !iframeError ? (
              <iframe
                src={displayUrl}
                title={safeTitle}
                allow="autoplay"
                onError={() => setIframeError(true)}
                className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-xs"
              />
            ) : (
              <div className="text-center p-8 max-w-md bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {iframeError ? 'Embedded Preview Blocked' : 'No Document URL Found'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {iframeError
                      ? 'The document provider prevented in-frame preview. You can open or download the PDF directly.'
                      : 'Please verify the exam question paper or submission URL.'}
                  </p>
                </div>

                {safePdfUrl && (
                  <div className="pt-2 flex justify-center gap-2">
                    <a
                      href={openInDriveUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs"
                    >
                      Open Document in New Tab
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
