import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileImage,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  Loader2,
  Download,
  AlertCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  ZoomIn,
  Check
} from 'lucide-react';
import { AnswerPageImage, generatePdfFromImages } from '../../utils/imageToPdf';
import { ErrorBoundary } from '../ErrorBoundary';

interface ImageToPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPdfGenerated: (pdfFile: File, pdfBase64: string) => void;
  examSubject?: string;
  examId?: string;
  candidateId?: string;
  candidateName?: string;
}

export const ImageToPdfModal: React.FC<ImageToPdfModalProps> = ({
  isOpen,
  onClose,
  onPdfGenerated,
  examSubject,
  examId,
  candidateId,
  candidateName,
}) => {
  const [pages, setPages] = useState<AnswerPageImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState<{
    blob: Blob;
    base64: string;
    url: string;
    totalPages: number;
    fileSizeMb: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<AnswerPageImage | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset or cleanup when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Clean up object URLs
      pages.forEach((p) => {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch {}
      });
      if (generatedPdf?.url) {
        try {
          URL.revokeObjectURL(generatedPdf.url);
        } catch {}
      }
      setPages([]);
      setGeneratedPdf(null);
      setErrorMsg(null);
      setPreviewImage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    setErrorMsg(null);
    const newPages: AnswerPageImage[] = [];

    Array.from(filesList).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select valid image files (JPG, PNG, WEBP).');
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setErrorMsg(`Image "${file.name}" exceeds 20MB limit.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      newPages.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        previewUrl,
        rotation: 0,
        name: file.name,
        size: file.size,
      });
    });

    if (newPages.length > 0) {
      setPages((prev) => [...prev, ...newPages]);
      setGeneratedPdf(null); // Reset generated PDF if pages are added
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const updated = [...pages];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setPages(updated);
    setGeneratedPdf(null);
  };

  const handleRotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
    setGeneratedPdf(null);
  };

  const handleRemovePage = (index: number) => {
    const item = pages[index];
    if (item) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {}
    }
    setPages((prev) => prev.filter((_, idx) => idx !== index));
    setGeneratedPdf(null);
  };

  const handleClearAll = () => {
    if (pages.length === 0) return;
    if (window.confirm('Remove all uploaded answer sheet photos?')) {
      pages.forEach((p) => {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch {}
      });
      setPages([]);
      setGeneratedPdf(null);
    }
  };

  const handleCompilePdf = async () => {
    if (pages.length === 0) {
      setErrorMsg('Please upload at least one image of your answer sheet.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const headerText = examSubject
        ? `EXAM: ${examSubject.toUpperCase()} | ID: ${examId || 'ASSESSMENT'}`
        : 'EXAMINATION ANSWER SCRIPT';
      const footerStudentInfo = candidateId
        ? `CANDIDATE: ${candidateName ? candidateName + ' (' + candidateId + ')' : candidateId}`
        : 'CANDIDATE ANSWER BOOKLET';

      const result = await generatePdfFromImages(pages, {
        marginMm: 8,
        headerText,
        footerStudentInfo,
        includePageNumbers: true,
      });

      const sizeMb = (result.pdfBlob.size / 1024 / 1024).toFixed(2);

      setGeneratedPdf({
        blob: result.pdfBlob,
        base64: result.pdfBase64,
        url: result.pdfUrl,
        totalPages: result.totalPages,
        fileSizeMb: sizeMb,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assemble PDF from images.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAndAttach = () => {
    if (!generatedPdf) return;

    const filename = `ANS_${examId || 'EXAM'}_${candidateId || 'STU'}_${Date.now()}.pdf`;
    const pdfFile = new File([generatedPdf.blob], filename, { type: 'application/pdf' });

    onPdfGenerated(pdfFile, generatedPdf.base64);
    onClose();
  };

  return (
    <ErrorBoundary
      fallbackTitle="Document Scanner & Converter Error"
      fallbackMessage="An issue occurred during image-to-PDF conversion."
      onReset={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="relative w-full max-w-4xl max-h-[92vh] bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden font-sans">
          {/* Header - ERP Style */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Answer Sheet Image to PDF Scanner
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-50 text-indigo-700 rounded-md font-semibold border border-indigo-200/80">
                    No-Distortion Engine
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload multiple photos of handwritten pages, arrange order, rotate, and assemble into a standard A4 PDF.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8FAFC]">
            {/* Error Notification */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Upload & Dropzone Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 justify-center sm:justify-start">
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span>Select Answer Sheet Photos</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Select all pages from your camera or gallery (JPG, PNG, WEBP). You can reorder &amp; rotate pages next.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleAddFiles(e.target.files)}
                  className="hidden"
                  id="image-upload-input"
                />
                <label
                  htmlFor="image-upload-input"
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Photos / Pages</span>
                </label>

                {pages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-semibold transition-colors border border-slate-200 min-h-[42px]"
                    title="Clear all pages"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Page Count Bar & Quick Guide */}
            {pages.length > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold px-2 text-slate-600">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>
                    Uploaded <strong className="text-slate-900">{pages.length}</strong> {pages.length === 1 ? 'Page' : 'Pages'} (Numbered in Sequence)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">
                  Tip: Use arrows to move page sequence • Click rotate if taken in landscape
                </span>
              </div>
            )}

            {/* Pages Thumbnail Grid */}
            {pages.length === 0 ? (
              <div className="p-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
                  <FileImage className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No Answer Sheet Images Uploaded Yet</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the <strong>Add Photos / Pages</strong> button above to upload pictures of your handwritten test sheets.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {pages.map((page, index) => (
                  <div
                    key={page.id}
                    className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                  >
                    {/* Page Badge */}
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-slate-900/80 text-white font-mono text-[11px] font-bold shadow-xs backdrop-blur-xs">
                      Page {index + 1}
                    </div>

                    {/* Image Preview Container */}
                    <div className="relative aspect-[3/4] bg-slate-900 flex items-center justify-center overflow-hidden p-2">
                      <img
                        src={page.previewUrl}
                        alt={`Page ${index + 1}`}
                        style={{
                          transform: `rotate(${page.rotation}deg)`,
                          transition: 'transform 0.2s ease',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                        className="rounded-sm"
                      />

                      {/* Hover Zoom Icon */}
                      <button
                        type="button"
                        onClick={() => setPreviewImage(page)}
                        className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-semibold"
                      >
                        <ZoomIn className="w-5 h-5" />
                        <span>Inspect</span>
                      </button>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1 text-slate-600">
                      {/* Reorder Arrows */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMovePage(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 disabled:opacity-30 transition-colors border border-transparent hover:border-slate-200"
                          title="Move Page Up"
                          aria-label="Move page up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePage(index, 'down')}
                          disabled={index === pages.length - 1}
                          className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 disabled:opacity-30 transition-colors border border-transparent hover:border-slate-200"
                          title="Move Page Down"
                          aria-label="Move page down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Rotate & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRotatePage(index)}
                          className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 transition-colors border border-transparent hover:border-slate-200"
                          title="Rotate 90° clockwise"
                          aria-label="Rotate image"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePage(index)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors border border-transparent hover:border-rose-200"
                          title="Remove Page"
                          aria-label="Delete page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generated PDF Success Card */}
            {generatedPdf && (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-3 text-emerald-950">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Standard A4 PDF Booklet Ready</h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {generatedPdf.totalPages} Pages Compiled • {generatedPdf.fileSizeMb} MB • Proportional Scaling Preserved
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={generatedPdf.url}
                    download={`ANS_${examId || 'EXAM'}_${candidateId || 'STU'}.pdf`}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-300 transition-colors min-h-[38px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Copy</span>
                  </a>

                  <a
                    href={generatedPdf.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-300 transition-colors min-h-[38px]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View PDF</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="px-5 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {pages.length > 0
                ? `${pages.length} pages queued for compilation`
                : 'Upload answer photos to assemble your PDF submission'}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all min-h-[42px]"
              >
                Cancel
              </button>

              {!generatedPdf ? (
                <button
                  type="button"
                  onClick={handleCompilePdf}
                  disabled={pages.length === 0 || isGenerating}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-xs min-h-[42px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Compiling A4 PDF...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate PDF Booklet</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmAndAttach}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-600/20 min-h-[42px]"
                >
                  <Check className="w-4 h-4" />
                  <span>Attach PDF &amp; Use For Submission</span>
                </button>
              )}
            </div>
          </div>

          {/* Fullscreen Single Image Inspection Overlay */}
          {previewImage && (
            <div
              className="fixed inset-0 z-60 bg-slate-950/90 flex flex-col items-center justify-center p-4 animate-in fade-in"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center">
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <img
                  src={previewImage.previewUrl}
                  alt={previewImage.name}
                  style={{ transform: `rotate(${previewImage.rotation}deg)` }}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg border border-slate-700 shadow-2xl"
                />
                <span className="text-white text-xs mt-3 font-mono">
                  {previewImage.name} • Rotated {previewImage.rotation}°
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};
