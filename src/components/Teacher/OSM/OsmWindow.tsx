import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  OsmTool,
  OsmShapeType,
  OsmStampType,
  OsmPageAnnotations,
  OsmQuestionScore,
  OsmSessionData,
} from '../../../types/osm';
import { OsmToolbar } from './OsmToolbar';
import { OsmThumbnails } from './OsmThumbnails';
import { OsmCanvasPage } from './OsmCanvasPage';
import { OsmEvaluationPanel } from './OsmEvaluationPanel';
import { generateCheckedPdfBlob, generateFallbackAnswerBooklet, generateStudentBookletPdf } from '../../../utils/osmPdfGenerator';
import { getEmbeddablePdfUrl } from '../../../utils/pdfHelper';
import { getSubmissionFileStorage } from '../../../utils/fileStorage';
import { Submission, Exam } from '../../../types';
import { fileToBase64, executeGasAction } from '../../../services/api';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Upload,
  ExternalLink,
  FileText,
  Info,
  Image as ImageIcon,
} from 'lucide-react';

// Setup pdfjs worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

interface OsmWindowProps {
  submission: Submission;
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
  onSaveEvaluation: (
    studentId: string,
    examId: string,
    score: number | '',
    feedback: string,
    gradedPdfBase64: string,
    sessionData: OsmSessionData
  ) => Promise<boolean>;
}

export const OsmWindow: React.FC<OsmWindowProps> = ({
  submission,
  exam,
  isOpen,
  onClose,
  onSaveEvaluation,
}) => {
  if (!isOpen) return null;

  const storageDraftKey = `osm_session_${exam.ExamId}_${submission.StudentId}`;
  const storageStudentImagesKey = `osm_student_images_${exam.ExamId}_${submission.StudentId}`;

  // Direct Student Answer Sheet Images state (loaded from submission or local conversion cache)
  const [imagePages, setImagePages] = useState<string[]>(() => {
    if (submission.RawImages && submission.RawImages.length > 0) return submission.RawImages;
    if (submission.ImageUrls && submission.ImageUrls.length > 0) return submission.ImageUrls;
    try {
      const cached = localStorage.getItem(`osm_student_images_${exam.ExamId}_${submission.StudentId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // PDF Document state
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [totalPages, setTotalPages] = useState<number>(() => {
    if (submission.RawImages && submission.RawImages.length > 0) return submission.RawImages.length;
    if (submission.ImageUrls && submission.ImageUrls.length > 0) return submission.ImageUrls.length;
    return 1;
  });
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({});
  const [customPdfBase64, setCustomPdfBase64] = useState<string | null>(null);
  const [isUsingDigitalBookletFallback, setIsUsingDigitalBookletFallback] = useState<boolean>(false);
  const [fileSourceNotice, setFileSourceNotice] = useState<string | null>(null);

  // Layout & Navigation State
  const [zoom, setZoom] = useState<number>(1.15);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState<boolean>(true);
  const [evalPanelOpen, setEvalPanelOpen] = useState<boolean>(true);

  // Active Tool state
  const [activeTool, setActiveTool] = useState<OsmTool>('pen');
  const [penColor, setPenColor] = useState<string>('#dc2626'); // Red default for examiners
  const [penSize, setPenSize] = useState<number>(3);
  const [highlighterColor, setHighlighterColor] = useState<string>('#facc15'); // Yellow tint
  const [highlighterSize, setHighlighterSize] = useState<number>(20);
  const [shapeType, setShapeType] = useState<OsmShapeType>('tick');
  const [shapeWidth, setShapeWidth] = useState<number>(3);
  const [selectedStamp, setSelectedStamp] = useState<OsmStampType>('plus1');

  // Annotation Data per page
  const [annotationsPerPage, setAnnotationsPerPage] = useState<Record<number, OsmPageAnnotations>>({});

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<Record<number, OsmPageAnnotations>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<number, OsmPageAnnotations>[]>([]);

  // Question-wise marks & feedback
  const maxExamMarks = Number(exam.TotalMarks || 100);
  const [questionScores, setQuestionScores] = useState<OsmQuestionScore[]>(() => {
    return [
      { id: 'q1', label: 'Q1', maxMarks: 20, awardedMarks: '' },
      { id: 'q2', label: 'Q2', maxMarks: 20, awardedMarks: '' },
      { id: 'q3', label: 'Q3', maxMarks: 20, awardedMarks: '' },
      { id: 'q4', label: 'Q4', maxMarks: 20, awardedMarks: '' },
      { id: 'q5', label: 'Q5', maxMarks: 20, awardedMarks: '' },
    ];
  });
  const [overallFeedback, setOverallFeedback] = useState<string>(submission.Feedback || '');

  // Auto-save & Status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedText, setLastSavedText] = useState<string>('');
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 1. Initialize & Restore Session Draft
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(storageDraftKey);
      if (savedRaw) {
        const parsed: OsmSessionData = JSON.parse(savedRaw);
        if (parsed.annotationsPerPage) {
          setAnnotationsPerPage(parsed.annotationsPerPage);
        }
        if (parsed.questionMarks && parsed.questionMarks.length > 0) {
          setQuestionScores(parsed.questionMarks);
        }
        if (parsed.overallFeedback) {
          setOverallFeedback(parsed.overallFeedback);
        }
        if (parsed.lastSavedAt) {
          setLastSavedText(`Restored draft from ${new Date(parsed.lastSavedAt).toLocaleTimeString()}`);
        }
      } else if (submission.Score !== undefined && submission.Score !== '') {
        setQuestionScores([
          { id: 'q1', label: 'Total Score', maxMarks: maxExamMarks, awardedMarks: Number(submission.Score) || 0 },
        ]);
      }
    } catch (e) {
      console.warn('Error loading OSM draft:', e);
    }
  }, [storageDraftKey, submission.Score, maxExamMarks]);

  // 2. Load Direct Images or PDF Document
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      try {
        setLoadingPdf(true);
        setPdfLoadError(null);

        // Check 1: Direct student images (loaded from submission or local storage)
        if (imagePages && imagePages.length > 0) {
          if (!isCancelled) {
            setTotalPages(imagePages.length);
            setIsUsingDigitalBookletFallback(false);
            setFileSourceNotice(
              `Loaded ${imagePages.length} student answer sheet page photo${imagePages.length > 1 ? 's' : ''} directly.`
            );
            setLoadingPdf(false);
          }
          return;
        }

        // Check 1.5: Check IndexedDB / Memory storage for student answer booklet
        const storedFiles = await getSubmissionFileStorage(exam.ExamId, submission.StudentId);
        if (storedFiles?.rawImages && storedFiles.rawImages.length > 0) {
          if (!isCancelled) {
            setImagePages(storedFiles.rawImages);
            setTotalPages(storedFiles.rawImages.length);
            setIsUsingDigitalBookletFallback(false);
            setFileSourceNotice(
              `Loaded ${storedFiles.rawImages.length} student answer sheet page photo${storedFiles.rawImages.length > 1 ? 's' : ''} from storage.`
            );
            setLoadingPdf(false);
          }
          return;
        }

        if (storedFiles?.pdfBase64) {
          const base64 = storedFiles.pdfBase64.split(',')[1] || storedFiles.pdfBase64;
          const binaryStr = atob(base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const doc = await loadingTask.promise;
          if (!isCancelled) {
            setPdfDoc(doc);
            setTotalPages(doc.numPages || 1);
            setIsUsingDigitalBookletFallback(false);
            setFileSourceNotice('Loaded student answer booklet PDF directly from storage.');
            setLoadingPdf(false);
          }
          return;
        }

        // Check 2: If user uploaded a custom PDF
        if (customPdfBase64) {
          const base64 = customPdfBase64.split(',')[1] || customPdfBase64;
          const binaryStr = atob(base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const doc = await loadingTask.promise;
          if (!isCancelled) {
            setPdfDoc(doc);
            setTotalPages(doc.numPages || 1);
            setIsUsingDigitalBookletFallback(false);
            setFileSourceNotice('Loaded uploaded local PDF document successfully.');
            setLoadingPdf(false);
          }
          return;
        }

        const pdfInfo = getEmbeddablePdfUrl(submission.SubmissionUrl);
        const rawUrl = submission.SubmissionUrl || '';
        const pdfUrl = pdfInfo.directDownloadUrl || pdfInfo.embedUrl || rawUrl;

        // Case A: Data URL
        if (pdfUrl.startsWith('data:application/pdf;base64,') || pdfUrl.startsWith('data:')) {
          const base64 = pdfUrl.split(',')[1] || '';
          const binaryStr = atob(base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const loadingTask = pdfjsLib.getDocument({ data: bytes });
          const doc = await loadingTask.promise;
          if (!isCancelled) {
            setPdfDoc(doc);
            setTotalPages(doc.numPages || 1);
            setIsUsingDigitalBookletFallback(false);
            setLoadingPdf(false);
          }
          return;
        }

        // Case B: Direct URL - Attempt fetching with PDF.js
        if (pdfUrl && (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://'))) {
          try {
            const loadingTask = pdfjsLib.getDocument({
              url: pdfUrl,
              cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
              cMapPacked: true,
            });
            const doc = await loadingTask.promise;
            if (!isCancelled) {
              setPdfDoc(doc);
              setTotalPages(doc.numPages || 1);
              setIsUsingDigitalBookletFallback(false);
              setLoadingPdf(false);
              return;
            }
          } catch (directFetchErr) {
            console.warn('Direct PDF load via URL encountered CORS/Fetch issue:', directFetchErr);
          }
        }

        // Case B.2: If Google Drive link, attempt to fetch binary via backend Apps Script gateway
        if (pdfInfo.isDriveUrl && (pdfInfo.driveFileId || rawUrl)) {
          try {
            const gasRes = await executeGasAction('getFileBase64', {
              fileId: pdfInfo.driveFileId || '',
              fileUrl: rawUrl,
            });
            if (gasRes.success && gasRes.data?.base64Data) {
              const b64 = gasRes.data.base64Data.split(',')[1] || gasRes.data.base64Data;
              const binaryStr = atob(b64);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const loadingTask = pdfjsLib.getDocument({ data: bytes });
              const doc = await loadingTask.promise;
              if (!isCancelled) {
                setPdfDoc(doc);
                setTotalPages(doc.numPages || 1);
                setIsUsingDigitalBookletFallback(false);
                setFileSourceNotice('Loaded original student PDF via secure Drive gateway.');
                setLoadingPdf(false);
                return;
              }
            }
          } catch (driveFetchErr) {
            console.warn('Drive gateway fetch attempt:', driveFetchErr);
          }
        }

        // Case C: Fallback to Generated Digital Answer Booklet
        const fallbackBytes = await generateFallbackAnswerBooklet(
          submission.StudentId,
          submission.StudentName,
          exam.ExamId,
          exam.Subject,
          4
        );

        const loadingTask = pdfjsLib.getDocument({ data: fallbackBytes });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages || 4);
          setIsUsingDigitalBookletFallback(true);
          setFileSourceNotice(
            'Online link is CORS restricted (Google Drive). Official Digital Answer Booklet loaded for marking.'
          );
          setLoadingPdf(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Error loading document in OSM viewer:', err);
          // Generate minimal 1-page fallback so evaluator is never blocked
          try {
            const emergencyBytes = await generateFallbackAnswerBooklet(
              submission.StudentId,
              submission.StudentName,
              exam.ExamId,
              exam.Subject,
              2
            );
            const task = pdfjsLib.getDocument({ data: emergencyBytes });
            const doc = await task.promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages || 2);
            setIsUsingDigitalBookletFallback(true);
            setFileSourceNotice('Digital Evaluation Sheet initialized.');
            setLoadingPdf(false);
          } catch (emergencyErr) {
            setPdfLoadError(
              err.message || 'Could not load document directly. Please upload a local image or PDF copy.'
            );
            setLoadingPdf(false);
          }
        }
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [submission.SubmissionUrl, customPdfBase64, imagePages, submission.StudentId, submission.StudentName, exam.ExamId, exam.Subject]);

  // Handle local PDF upload from examiner
  const handleUploadLocalPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF documents are supported.');
      return;
    }

    try {
      setLoadingPdf(true);
      const b64 = await fileToBase64(file);
      setImagePages([]); // Clear direct images mode when PDF explicitly uploaded
      setCustomPdfBase64(b64);
    } catch (err) {
      alert('Failed to read local PDF file.');
      setLoadingPdf(false);
    }
  };

  // Handle local images upload (multiple photos of answer sheets)
  const handleUploadLocalImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setLoadingPdf(true);
      const fileList = Array.from(files).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      const base64List: string[] = [];

      for (const file of fileList) {
        const b64 = await fileToBase64(file);
        base64List.push(b64);
      }

      setCustomPdfBase64(null);
      setImagePages(base64List);
      setTotalPages(base64List.length);
      setIsUsingDigitalBookletFallback(false);
      setFileSourceNotice(
        `Loaded ${base64List.length} uploaded answer sheet image${base64List.length > 1 ? 's' : ''} directly.`
      );
      try {
        localStorage.setItem(storageStudentImagesKey, JSON.stringify(base64List));
      } catch (err) {}
    } catch (err: any) {
      alert(`Failed to load student photos: ${err.message || err}`);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Calculate current total awarded marks
  const totalAwardedMarks = questionScores.reduce((sum, q) => {
    if (typeof q.awardedMarks === 'number') {
      return sum + q.awardedMarks;
    }
    return sum;
  }, 0);

  // 3. Auto-save session state (Debounced)
  const saveDraftToStorage = useCallback(() => {
    try {
      const sessionData: OsmSessionData = {
        examId: exam.ExamId,
        studentId: submission.StudentId,
        studentName: submission.StudentName,
        subject: exam.Subject,
        totalPages,
        annotationsPerPage,
        questionMarks: questionScores,
        overallFeedback,
        totalScore: totalAwardedMarks,
        isCompleted: false,
        lastSavedAt: new Date().toISOString(),
      };

      localStorage.setItem(storageDraftKey, JSON.stringify(sessionData));
      setLastSavedText(`Saved ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      console.warn('Auto-save error:', e);
    }
  }, [
    storageDraftKey,
    exam.ExamId,
    submission.StudentId,
    submission.StudentName,
    exam.Subject,
    totalPages,
    annotationsPerPage,
    questionScores,
    overallFeedback,
    totalAwardedMarks,
  ]);

  // Trigger debounced auto-save on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraftToStorage();
    }, 1500);

    return () => clearTimeout(timer);
  }, [annotationsPerPage, questionScores, overallFeedback, saveDraftToStorage]);

  // 4. Update Annotations for a page + push to undo stack
  const handleUpdateAnnotations = useCallback((pageIdx: number, newPageAnn: OsmPageAnnotations) => {
    setAnnotationsPerPage((prev) => {
      setUndoStack((uPrev) => [...uPrev, { ...prev }]);
      setRedoStack([]); // Clear redo stack on new action
      return {
        ...prev,
        [pageIdx]: newPageAnn,
      };
    });
  }, []);

  // Undo / Redo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { ...annotationsPerPage }]);
    setAnnotationsPerPage(previous);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { ...annotationsPerPage }]);
    setAnnotationsPerPage(next);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
  };

  // 5. Page navigation
  const scrollToPage = (pageIdx: number) => {
    setCurrentPage(pageIdx);
    const targetEl = pageRefs.current[pageIdx];
    if (targetEl && scrollContainerRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageDimensionsLoaded = useCallback((pageIdx: number, dim: { width: number; height: number }) => {
    setPageDimensions((prev) => {
      if (prev[pageIdx]?.width === dim.width && prev[pageIdx]?.height === dim.height) {
        return prev;
      }
      return {
        ...prev,
        [pageIdx]: dim,
      };
    });
  }, []);

  // 6. Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoom(1.0);
  const handleZoomFitWidth = () => {
    if (scrollContainerRef.current) {
      const containerW = scrollContainerRef.current.clientWidth - 80;
      const baseW = pageDimensions[currentPage]?.width || 600;
      const calculated = Math.max(0.6, Math.min(2.2, +(containerW / baseW).toFixed(2)));
      setZoom(calculated);
    }
  };

  // 7. Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 8. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'p') {
        setActiveTool('pen');
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool('highlighter');
      } else if (e.key.toLowerCase() === 'e') {
        setActiveTool('eraser');
      } else if (e.key.toLowerCase() === 't') {
        setActiveTool('text');
      } else if (e.key.toLowerCase() === 's') {
        setActiveTool('shape');
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('select');
      } else if (e.key === '=' || e.key === '+') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, annotationsPerPage]);

  // 9. Finish Checking & Save Workflow
  const handleFinishChecking = async () => {
    try {
      setIsSaving(true);

      const sessionData: OsmSessionData = {
        examId: exam.ExamId,
        studentId: submission.StudentId,
        studentName: submission.StudentName,
        subject: exam.Subject,
        totalPages,
        annotationsPerPage,
        questionMarks: questionScores,
        overallFeedback,
        totalScore: totalAwardedMarks,
        isCompleted: true,
        lastSavedAt: new Date().toISOString(),
      };

      // Generate checked PDF with overlay annotations
      const dimensionsList = Array.from({ length: totalPages }).map(
        (_, i) => pageDimensions[i] || { width: 595.28, height: 841.89 }
      );

      const sourceDocPayload = customPdfBase64 || submission.SubmissionUrl || '';

      const gradedPdfDataUrl = await generateCheckedPdfBlob(
        sourceDocPayload,
        sessionData,
        dimensionsList,
        imagePages && imagePages.length > 0 ? imagePages : undefined
      );

      // Call parent evaluation save handler (saves score, feedback, gradedPdfDataUrl, updates submission state)
      const ok = await onSaveEvaluation(
        submission.StudentId,
        exam.ExamId,
        totalAwardedMarks,
        overallFeedback,
        gradedPdfDataUrl,
        sessionData
      );

      if (ok) {
        localStorage.setItem(storageDraftKey, JSON.stringify(sessionData));
        setSaveSuccessToast('Paper checked and evaluated answer booklet saved successfully!');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Error completing OSM evaluation:', err);
      alert(`Error saving graded paper: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 10. Download Clean Answer Booklet to Local Machine
  const handleDownloadStudentBooklet = async () => {
    try {
      setSaveSuccessToast('Preparing PDF download...');
      const sourcePayload = customPdfBase64 || submission.SubmissionUrl || '';
      const bookletBlob = await generateStudentBookletPdf(
        sourcePayload,
        imagePages && imagePages.length > 0 ? imagePages : undefined,
        {
          studentId: submission.StudentId,
          studentName: submission.StudentName,
          examId: exam.ExamId,
          subject: exam.Subject,
        }
      );

      const blobUrl = URL.createObjectURL(bookletBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `AnswerBooklet_${exam.ExamId}_${submission.StudentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setSaveSuccessToast('Booklet PDF downloaded to your computer!');
      setTimeout(() => setSaveSuccessToast(null), 3000);
    } catch (e: any) {
      console.error('Failed to download booklet PDF:', e);
      alert(`Could not download booklet PDF: ${e.message || e}`);
    }
  };

  return (
    <div
      ref={containerRef}
      id="osm-master-window"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white font-sans select-none overflow-hidden animate-in fade-in duration-150"
    >
      {/* Hidden File input for local PDF replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUploadLocalPdf}
      />

      {/* Hidden File input for local images replacement */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleUploadLocalImages}
      />

      {/* Top Toolbar */}
      <OsmToolbar
        studentName={submission.StudentName}
        studentId={submission.StudentId}
        examId={exam.ExamId}
        subject={exam.Subject}
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        isFullscreen={isFullscreen}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        activeTool={activeTool}
        penColor={penColor}
        penSize={penSize}
        highlighterColor={highlighterColor}
        highlighterSize={highlighterSize}
        shapeType={shapeType}
        shapeWidth={shapeWidth}
        selectedStamp={selectedStamp}
        isSaving={isSaving}
        lastSavedText={lastSavedText}
        totalAwardedMarks={totalAwardedMarks}
        maxExamMarks={maxExamMarks}
        onToolChange={setActiveTool}
        onPenColorChange={setPenColor}
        onPenSizeChange={setPenSize}
        onHighlighterColorChange={setHighlighterColor}
        onHighlighterSizeChange={setHighlighterSize}
        onShapeTypeChange={setShapeType}
        onStampTypeChange={setSelectedStamp}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onZoomFitWidth={handleZoomFitWidth}
        onToggleFullscreen={handleToggleFullscreen}
        onPrevPage={() => scrollToPage(Math.max(0, currentPage - 1))}
        onNextPage={() => scrollToPage(Math.min(totalPages - 1, currentPage + 1))}
        onGoToPage={scrollToPage}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSaveDraft={saveDraftToStorage}
        onFinishChecking={handleFinishChecking}
        onDownloadBooklet={handleDownloadStudentBooklet}
        onClose={onClose}
      />

      {/* Success Toast */}
      {saveSuccessToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-xs animate-in slide-in-from-top">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {/* Main Workspace Area (Left Thumbnails + Center Multi-page Canvas + Right Evaluation Panel) */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-slate-900">
        {/* Left Thumbnails Navigation Sidebar */}
        <OsmThumbnails
          totalPages={totalPages}
          currentPage={currentPage}
          isOpen={thumbnailsOpen}
          annotationsPerPage={annotationsPerPage}
          onToggle={() => setThumbnailsOpen(!thumbnailsOpen)}
          onSelectPage={scrollToPage}
        />

        {/* Center Multi-page Document Canvas */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center bg-[#1e293b] space-y-6 relative"
        >
          {/* Informative Source / Action Banner when using fallback, direct images, or URL */}
          {(fileSourceNotice || isUsingDigitalBookletFallback || (imagePages && imagePages.length > 0)) && !loadingPdf && (
            <div className="w-full max-w-4xl bg-slate-900/95 border border-sky-800/80 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shrink-0">
              <div className="flex items-center gap-2.5 text-xs text-sky-200">
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="leading-snug">{fileSourceNotice}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Upload direct page images / camera scans"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Load Page Photos</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Upload the PDF directly from your computer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Local PDF</span>
                </button>

                {submission.SubmissionUrl && (submission.SubmissionUrl.startsWith('http') || submission.SubmissionUrl.includes('drive.google')) && (
                  <a
                    href={submission.SubmissionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {loadingPdf ? (
            <div className="my-auto flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-sm font-semibold text-slate-200">Loading student answer booklet...</p>
              <p className="text-xs text-slate-500 font-mono">Exam: {exam.ExamId} | Candidate: {submission.StudentId}</p>
            </div>
          ) : pdfLoadError ? (
            <div className="my-auto max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100">Document Notice</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {pdfLoadError}
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Load Answer Photos (JPG/PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Local PDF to Mark</span>
                </button>
                {submission.SubmissionUrl && (
                  <a
                    href={submission.SubmissionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>Open Original Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            Array.from({ length: totalPages }).map((_, idx) => {
              const pageAnn = annotationsPerPage[idx] || {
                pageIndex: idx,
                strokes: [],
                highlighters: [],
                texts: [],
                shapes: [],
                stamps: [],
              };

              return (
                <div
                  key={idx}
                  ref={(el) => {
                    pageRefs.current[idx] = el;
                  }}
                  className="w-full flex justify-center"
                >
                  <OsmCanvasPage
                    pageIndex={idx}
                    pdfDoc={imagePages && imagePages.length > 0 ? null : pdfDoc}
                    imageSrc={imagePages && imagePages[idx] ? imagePages[idx] : null}
                    zoom={zoom}
                    activeTool={activeTool}
                    penColor={penColor}
                    penSize={penSize}
                    highlighterColor={highlighterColor}
                    highlighterSize={highlighterSize}
                    shapeType={shapeType}
                    shapeWidth={shapeWidth}
                    selectedStamp={selectedStamp}
                    annotations={pageAnn}
                    onUpdateAnnotations={handleUpdateAnnotations}
                    onPageDimensionsLoaded={handlePageDimensionsLoaded}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Right Evaluation & Marks Panel */}
        <OsmEvaluationPanel
          isOpen={evalPanelOpen}
          maxExamMarks={maxExamMarks}
          questionScores={questionScores}
          overallFeedback={overallFeedback}
          isSaving={isSaving}
          onToggle={() => setEvalPanelOpen(!evalPanelOpen)}
          onQuestionScoresChange={setQuestionScores}
          onOverallFeedbackChange={setOverallFeedback}
          onFinishChecking={handleFinishChecking}
          onSaveDraft={saveDraftToStorage}
        />
      </div>
    </div>
  );
};

