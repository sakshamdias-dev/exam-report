import React from 'react';
import {
  Clock,
  AlertTriangle,
  UploadCloud,
  FileImage,
  CheckCircle2,
  X,
  Eye,
  Loader2,
  ShieldAlert,
  ArrowRight,
  FileText,
  Smartphone
} from 'lucide-react';

const formatTime = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.max(0, secs % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface SubmissionWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionTimeLeftSeconds: number;
  submissionWindowMinutes: number;
  isSubmissionWindowExpired: boolean;
  hasExtension: boolean;
  canSubmit: boolean;
  selectedFile: File | null;
  fileBase64: string | null;
  isFileReading: boolean;
  fileReadPercent: number;
  fileReadStatus: string;
  submitting: boolean;
  submitSuccess: boolean;
  submitProgress: {
    loaded: number;
    total: number;
    percent: number;
    stage: string;
    statusText: string;
  };
  errorMsg: string | null;
  isMobile: boolean;
  onOpenScanner: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReviewPdf: () => void;
  onSubmitFinal: () => void;
}

export const SubmissionWindowModal: React.FC<SubmissionWindowModalProps> = ({
  isOpen,
  onClose,
  submissionTimeLeftSeconds,
  submissionWindowMinutes,
  isSubmissionWindowExpired,
  hasExtension,
  canSubmit,
  selectedFile,
  fileBase64,
  isFileReading,
  fileReadPercent,
  fileReadStatus,
  submitting,
  submitSuccess,
  submitProgress,
  errorMsg,
  isMobile,
  onOpenScanner,
  onFileChange,
  onReviewPdf,
  onSubmitFinal,
}) => {
  if (!isOpen) return null;

  const isUrgent = submissionTimeLeftSeconds > 0 && submissionTimeLeftSeconds <= 120;

  return (
    <div
      id="submission-window-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans">
        {/* Top Emergency Status Header */}
        <div className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
          isSubmissionWindowExpired && !hasExtension
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : isUrgent
            ? 'bg-orange-50 border-orange-200 text-orange-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              isSubmissionWindowExpired && !hasExtension
                ? 'bg-rose-600 text-white'
                : isUrgent
                ? 'bg-[#f25f22] text-white animate-pulse'
                : 'bg-amber-600 text-white'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black tracking-tight">
                  {isSubmissionWindowExpired && !hasExtension
                    ? 'Submission Window Expired'
                    : 'Exam Over — Submit Answer Sheet'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isSubmissionWindowExpired && !hasExtension
                    ? 'bg-rose-200 text-rose-900 border border-rose-300'
                    : 'bg-amber-200 text-amber-900 border border-amber-300'
                }`}>
                  {isSubmissionWindowExpired && !hasExtension ? 'Portal Closed' : 'Writing Strictly Stopped'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {isSubmissionWindowExpired && !hasExtension
                  ? `The allocated ${submissionWindowMinutes}-minute submission grace period has ended.`
                  : `Question paper is aborted. Stop writing immediately. You have ${submissionWindowMinutes} minutes given separately to submit your answer sheet.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0"
            title="Minimize window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Submission Window Countdown Card */}
          <div className={`p-4 rounded-2xl border text-center space-y-2 relative overflow-hidden ${
            isSubmissionWindowExpired && !hasExtension
              ? 'bg-slate-900 border-rose-900 text-white'
              : isUrgent
              ? 'bg-slate-950 border-orange-500/50 text-orange-400 shadow-lg shadow-orange-500/10'
              : 'bg-slate-950 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10'
          }`}>
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {isSubmissionWindowExpired && !hasExtension
                  ? 'Official Submission Deadline Passed'
                  : 'Submission Window Closes In'}
              </span>
            </div>

            <div className="font-mono font-black text-3xl sm:text-4xl tracking-wider">
              {isSubmissionWindowExpired && !hasExtension
                ? '00:00'
                : formatTime(submissionTimeLeftSeconds)}
            </div>

            <div className="text-[11px] text-slate-300 flex items-center justify-center gap-2">
              <span>Allocated Grace Window: <strong>{submissionWindowMinutes} Mins (Max 10)</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Only upload permitted</span>
            </div>
          </div>

          {/* Strict Academic Conduct Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-slate-700">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-slate-900">Conduct Protocol:</strong> Writing after the exam end time is a violation of examination integrity. Proctor camera surveillance remains active while you scan and upload your answer sheet.
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submission Success State */}
          {submitSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-sm text-emerald-950">Answer Sheet Submitted Successfully!</h4>
              <p className="text-[11px] text-emerald-700">
                Your booklet has been securely encrypted, verified, and archived. Concluding examination session...
              </p>
            </div>
          )}

          {/* Live Upload Progress */}
          {submitting && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
              <div className="flex items-center justify-between font-bold text-sky-950">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#009fe3]" />
                  <span>{submitProgress.statusText || 'Submitting answer booklet...'}</span>
                </span>
                <span className="font-mono text-[#009fe3] font-black">{submitProgress.percent}%</span>
              </div>
              <div className="w-full h-2.5 bg-sky-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#009fe3] to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(6, submitProgress.percent)}%` }}
                />
              </div>
            </div>
          )}

          {/* If file is reading / buffering */}
          {isFileReading && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-sky-900">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#009fe3]" />
                  <span>{fileReadStatus}</span>
                </span>
                <span className="font-mono text-[#009fe3] font-bold">{fileReadPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-sky-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#009fe3] rounded-full transition-all"
                  style={{ width: `${fileReadPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Answer Booklet Options */}
          {!submitSuccess && (
            <div className="space-y-3 pt-1">
              {/* Option 1: Mobile Camera / Photo Scanner to PDF */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-50 via-orange-50/50 to-sky-50 border border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-[#f25f22]" />
                    <h4 className="font-bold text-slate-900 text-xs">Handwritten Answer Sheets</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[#ea580c] border border-orange-200">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Photograph each physical answer sheet page with your mobile/webcam. Automatically assemble and convert them into a single clean PDF.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScanner();
                  }}
                  disabled={!canSubmit || submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#f25f22] hover:bg-[#ea580c] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50 cursor-pointer min-h-[40px]"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Scan &amp; Assemble Answer Photos to PDF</span>
                </button>
              </div>

              {/* Option 2: Upload Pre-Compiled PDF */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-[#009fe3]" />
                    <span>Upload Ready PDF Answer Sheet</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Max 30MB • PDF</span>
                </div>

                {selectedFile && fileBase64 && !isFileReading ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-emerald-950 truncate text-xs">{selectedFile.name}</p>
                          <p className="text-[10px] text-emerald-700 font-mono">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to Submit
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                        Attached
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-200">
                      <button
                        type="button"
                        onClick={onReviewPdf}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-emerald-100/60 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Review PDF</span>
                      </button>
                      <label className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={onFileChange}
                          disabled={!canSubmit || submitting}
                          className="hidden"
                        />
                        <span>Change</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className={`border-2 border-dashed rounded-xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-sky-50/50 hover:border-sky-400 ${
                    !canSubmit ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={onFileChange}
                      disabled={!canSubmit || submitting}
                      className="hidden"
                    />
                    <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="font-semibold text-slate-800 text-xs">
                      Click to browse or drop PDF here
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Standard PDF documents up to 30MB
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Submit Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            Minimize to Workspace
          </button>

          <button
            type="button"
            onClick={onSubmitFinal}
            disabled={submitting || submitSuccess || !canSubmit || !selectedFile}
            className={`w-full sm:w-auto flex-1 max-w-xs py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              submitSuccess
                ? 'bg-emerald-600'
                : !canSubmit
                ? 'bg-slate-400'
                : !selectedFile
                ? 'bg-slate-400'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 ring-2 ring-emerald-500/30'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Answer Sheet...</span>
              </>
            ) : submitSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Submitted</span>
              </>
            ) : !selectedFile ? (
              <>
                <span>Select Answer PDF First</span>
              </>
            ) : (
              <>
                <span>Confirm &amp; Submit Answer Sheet</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
