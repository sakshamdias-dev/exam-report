import React, { useState, useEffect, useRef } from 'react';
import { Exam, User, Doubt } from '../../types';
import { executeGasAction, fileToBase64 } from '../../services/api';
import { 
  Clock, 
  ShieldAlert, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  CameraOff, 
  Maximize2, 
  Download, 
  Send, 
  MessageSquareQuote, 
  Loader2, 
  X, 
  ArrowLeft,
  Eye,
  Check,
  FileImage,
  Layers,
  Sparkles
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';
import { ImageToPdfModal } from './ImageToPdfModal';
import { getEmbeddablePdfUrl } from '../../utils/pdfHelper';

interface ExamRoomProps {
  exam: Exam;
  currentUser: User;
  onExit: () => void;
  onSubmitted: () => void;
}

export const ExamRoom: React.FC<ExamRoomProps> = ({ exam, currentUser, onExit, onSubmitted }) => {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [examEnded, setExamEnded] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Mobile View Toggle
  const [mobileTab, setMobileTab] = useState<'paper' | 'submit'>('paper');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Image to PDF Scanner Modal State
  const [imageToPdfOpen, setImageToPdfOpen] = useState(false);

  // Doubt Drawer State
  const [isDoubtOpen, setIsDoubtOpen] = useState(false);
  const [doubtText, setDoubtText] = useState('');
  const [doubtsList, setDoubtsList] = useState<Doubt[]>([]);
  const [submittingDoubt, setSubmittingDoubt] = useState(false);

  // PDF Preview State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');

  // 1. Calculate and count down time
  useEffect(() => {
    const end = new Date(exam.EndTime).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeftSeconds(diff);
      if (diff <= 0) {
        setExamEnded(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [exam.EndTime]);

  // 2. Initial Log: EXAM_START
  useEffect(() => {
    executeGasAction('logProctorEvent', {
      timestamp: new Date().toISOString(),
      examId: exam.ExamId,
      studentId: currentUser.UserId,
      actionType: 'EXAM_START',
      details: `Candidate ${currentUser.Name || currentUser.UserId} entered active exam room.`,
    });
  }, [exam.ExamId, currentUser]);

  // 3. Anti-Cheat Surveillance Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('TAB_SWITCH', 'Candidate switched away from active examination tab.');
      }
    };

    const handleWindowBlur = () => {
      logViolation('WINDOW_BLUR', 'Focus lost: active exam window blurred or desktop switched.');
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('COPY_PASTE_ATTEMPT', 'Clipboard copy/paste blocked during examination.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [exam.ExamId, currentUser]);

  const logViolation = (type: any, details: string) => {
    setWarningCount((prev) => prev + 1);
    setLastWarning(`${type}: ${details}`);

    executeGasAction('logProctorEvent', {
      timestamp: new Date().toISOString(),
      examId: exam.ExamId,
      studentId: currentUser.UserId,
      actionType: type,
      details: details,
    });
  };

  // 4. Webcam Stream management
  const toggleCamera = async () => {
    if (cameraEnabled) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setCameraEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraEnabled(true);
      } catch (err: any) {
        alert('Webcam access was denied or is unavailable on this device.');
      }
    }
  };

  // 5. Handle Student Answer Sheet file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Only PDF format documents are supported for final submission.');
      setSelectedFile(null);
      setFileBase64(null);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File size exceeds 25MB limit. Please compress your PDF.');
      setSelectedFile(null);
      setFileBase64(null);
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    try {
      const b64 = await fileToBase64(file);
      setFileBase64(b64);
    } catch (err) {
      setErrorMsg('Failed to process file locally.');
    }
  };

  // 6. Callback from ImageToPdfModal
  const handlePdfGeneratedFromImages = (pdfFile: File, pdfBase64Data: string) => {
    setSelectedFile(pdfFile);
    setFileBase64(pdfBase64Data);
    setErrorMsg(null);
  };

  // 7. Submit Answer Sheet
  const handleSubmitAnswer = async () => {
    if (!selectedFile || !fileBase64) {
      setErrorMsg('Please select or compile a valid PDF answer sheet before submitting.');
      return;
    }

    if (
      !window.confirm(
        'Confirm Final Submission: Are you sure you want to submit your answer booklet? This action locks your examination session.'
      )
    ) {
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await executeGasAction('submitAnswerSheet', {
        studentId: currentUser.UserId,
        examId: exam.ExamId,
        pdfBase64: fileBase64,
        filename: `ANS_${exam.ExamId}_${currentUser.UserId}.pdf`,
        submittedAt: new Date().toISOString(),
      });

      if (res.success) {
        setSubmitSuccess(true);
        executeGasAction('logProctorEvent', {
          timestamp: new Date().toISOString(),
          examId: exam.ExamId,
          studentId: currentUser.UserId,
          actionType: 'EXAM_SUBMIT',
          details: `Answer Sheet uploaded successfully.`,
        });

        setTimeout(() => {
          onSubmitted();
        }, 2000);
      } else {
        setErrorMsg(res.error || 'Failed to complete answer sheet submission.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during submission upload.');
    } finally {
      setSubmitting(false);
    }
  };

  // 8. Doubts/Questions Management
  const fetchDoubts = async () => {
    try {
      const res = await executeGasAction('getDoubts', { examId: exam.ExamId });
      if (res.success && res.data?.doubts) {
        setDoubtsList(res.data.doubts);
      } else if (res.success && (res as any).doubts) {
        setDoubtsList((res as any).doubts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDoubts();
    const interval = setInterval(fetchDoubts, 10000);
    return () => clearInterval(interval);
  }, [exam.ExamId]);

  const handleSendDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtText.trim()) return;

    setSubmittingDoubt(true);
    try {
      const res = await executeGasAction('createDoubt', {
        studentId: currentUser.UserId,
        examId: exam.ExamId,
        question: doubtText.trim(),
      });

      if (res.success) {
        setDoubtText('');
        fetchDoubts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingDoubt(false);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const qpEmbedInfo = getEmbeddablePdfUrl(exam.QPUrl);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans select-none">
      {/* Top ERP Examination Header */}
      <div className="bg-[#0F172A] text-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-30 shadow-md border-b border-slate-800">
        {/* Left: Exam Info & Candidate Details */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Exit Exam Hall"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {exam.Subject || 'General Examination'}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-950 text-indigo-300 rounded-md font-bold border border-indigo-800">
                {exam.ExamId}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Candidate: <strong className="text-slate-200">{currentUser.Name || currentUser.UserId}</strong></span>
              <span>•</span>
              <span className="font-mono text-slate-300">Roll: {currentUser.UserId}</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Countdown Timer & Status Bar */}
        <div className="flex items-center justify-between sm:justify-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <Clock className={`w-4 h-4 ${timeLeftSeconds < 600 ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`} />
            <div>
              <div className={`font-mono font-bold text-sm sm:text-base leading-none ${timeLeftSeconds < 600 ? 'text-rose-400' : 'text-white'}`}>
                {formatTime(timeLeftSeconds)}
              </div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                {examEnded ? 'Time Expired' : 'Time Remaining'}
              </div>
            </div>
          </div>

          {/* Surveillance Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border ${
              warningCount > 0
                ? 'bg-rose-950 text-rose-300 border-rose-800'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{warningCount === 0 ? 'Proctored' : `${warningCount} Warn`}</span>
          </div>

          {/* Ask Invigilator Button */}
          <button
            onClick={() => setIsDoubtOpen(!isDoubtOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 relative min-h-[38px]"
          >
            <MessageSquareQuote className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Ask Invigilator</span>
            {doubtsList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-pink-400 absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden px-4 pt-3 pb-1 bg-white border-b border-slate-200 grid grid-cols-2 gap-2">
        <button
          onClick={() => setMobileTab('paper')}
          className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] ${
            mobileTab === 'paper'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Question Paper</span>
        </button>
        <button
          onClick={() => setMobileTab('submit')}
          className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] ${
            mobileTab === 'submit'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>2. Answer Sheet &amp; Scan</span>
        </button>
      </div>

      {/* Warning Alert Banner */}
      {lastWarning && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span><strong>Surveillance Logged:</strong> {lastWarning}</span>
          </div>
          <button onClick={() => setLastWarning(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace (Split View on Desktop, Tabbed on Mobile) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Left Col (7 cols): Question Paper PDF Viewer */}
        <div
          className={`lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs ${
            mobileTab !== 'paper' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Paper (A4 View)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={qpEmbedInfo.directDownloadUrl || exam.QPUrl}
                download="Question_Paper.pdf"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 shadow-xs min-h-[36px]"
                title="Download Question Paper PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
              <button
                onClick={() => {
                  setPreviewPdfUrl(exam.QPUrl);
                  setPreviewPdfTitle(`Question Paper - ${exam.Subject || exam.ExamId}`);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200 min-h-[36px]"
                title="Expand Question Paper"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fullscreen</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-100 p-2 min-h-[480px]">
            {exam.QPUrl ? (
              <iframe
                src={qpEmbedInfo.embedUrl}
                title="Exam Question Paper"
                allow="autoplay"
                className="w-full h-full min-h-[500px] rounded-xl border border-slate-200 bg-white shadow-xs"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No question paper document attached.
              </div>
            )}
          </div>
        </div>

        {/* Right Col (5 cols): Answer Sheet Upload & Image-to-PDF Scanner */}
        <div
          className={`lg:col-span-5 flex flex-col gap-4 ${
            mobileTab !== 'submit' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Proctoring Surveillance Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Invigilation Feed
                </span>
              </div>
              <button
                onClick={toggleCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200 min-h-[34px]"
              >
                {cameraEnabled ? <CameraOff className="w-3.5 h-3.5 text-rose-600" /> : <Camera className="w-3.5 h-3.5 text-emerald-600" />}
                <span>{cameraEnabled ? 'Disable Feed' : 'Enable Proctor Feed'}</span>
              </button>
            </div>

            {cameraEnabled && (
              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 aspect-video max-h-32 flex items-center justify-center shadow-inner">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-mono bg-rose-600 text-white rounded font-bold">
                  ACTIVE SURVEILLANCE
                </span>
              </div>
            )}

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex justify-between">
                <span>Tab Switches Logged:</span>
                <span className="font-mono text-slate-900 font-bold">{warningCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Clipboard Protection:</span>
                <span className="text-emerald-700 font-semibold">Active &amp; Guarded</span>
              </div>
            </div>
          </div>

          {/* Answer Sheet Submission & Scanner Bento Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Answer Sheet Submission
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">A4 Format • PDF</span>
              </div>

              {/* PRIMARY PROMINENT FEATURE: Image to PDF Scanner Button */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-900">
                  <FileImage className="w-4 h-4 text-indigo-600 shrink-0" />
                  <h4 className="text-xs font-bold">Have handwritten answer photos?</h4>
                </div>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Upload multiple photos from your mobile/desktop, reorder pages, rotate if needed, and compile a single non-skewed A4 PDF answer booklet.
                </p>
                <button
                  type="button"
                  onClick={() => setImageToPdfOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs min-h-[40px]"
                >
                  <FileImage className="w-4 h-4" />
                  <span>Scan &amp; Assemble Answer Photos to PDF</span>
                </button>
              </div>

              {/* Or Select Existing PDF File */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-slate-400">or upload ready PDF</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-indigo-50/20 group">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors mb-1" />
                <span className="text-xs font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Select Pre-compiled PDF File'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to submit`
                    : 'Tap to browse standard PDF document'}
                </span>
              </label>

              {/* Selected File Details & Preview */}
              {selectedFile && fileBase64 && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs text-emerald-900 font-mono truncate font-semibold">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPdfUrl(fileBase64);
                      setPreviewPdfTitle(`Preview - ${selectedFile.name}`);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold min-h-[32px] px-2"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review PDF</span>
                  </button>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {errorMsg}
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Answer booklet successfully submitted and archived!</span>
                </div>
              )}
            </div>

            {/* Submit Final Answer Button */}
            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !selectedFile || submitSuccess}
              className="w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-h-[46px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Answer Booklet...</span>
                </>
              ) : submitSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Examination Completed</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Final Answer Sheet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Doubt/Invigilator Drawer */}
      {isDoubtOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="w-4 h-4 text-pink-600" />
              <h3 className="text-sm font-bold text-slate-900">Invigilator Assistance</h3>
            </div>
            <button
              onClick={() => setIsDoubtOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {doubtsList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No inquiries sent yet. Type your question below.
              </div>
            ) : (
              doubtsList.map((d) => (
                <div key={d.DoubtId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-800">{d.Question}</div>
                  {d.Answer ? (
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                      <strong>Invigilator:</strong> {d.Answer}
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-600 italic">Awaiting response from invigilator...</div>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendDoubt} className="p-4 border-t border-slate-200 bg-white flex gap-2">
            <input
              type="text"
              value={doubtText}
              onChange={(e) => setDoubtText(e.target.value)}
              placeholder="Ask question about exam paper..."
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              type="submit"
              disabled={submittingDoubt || !doubtText.trim()}
              className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* PDF Modal Viewer */}
      <PdfViewerModal
        isOpen={!!previewPdfUrl}
        onClose={() => setPreviewPdfUrl(null)}
        title={previewPdfTitle}
        pdfUrl={previewPdfUrl}
      />

      {/* Integrated Image to PDF Scanner Modal */}
      <ImageToPdfModal
        isOpen={imageToPdfOpen}
        onClose={() => setImageToPdfOpen(false)}
        examSubject={exam.Subject}
        examId={exam.ExamId}
        candidateId={currentUser.UserId}
        candidateName={currentUser.Name}
        onPdfGenerated={handlePdfGeneratedFromImages}
      />
    </div>
  );
};
