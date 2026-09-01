import React, { useState, useEffect, useRef } from 'react';
import { Exam, User, Doubt, SubmissionOverride, StudentGroup, LiveProctorStream, ProctorCommand } from '../../types';
import { executeGasAction, fileToBase64 } from '../../services/api';
import { saveSubmissionFileStorage } from '../../utils/fileStorage';
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
  Sparkles, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Mic, 
  Monitor, 
  Smartphone, 
  Radio, 
  Ban,
  AlertCircle,
  Video,
  ExternalLink
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';
import { ImageToPdfModal } from './ImageToPdfModal';
import { ProctoringSetupModal } from './ProctoringSetupModal';
import { ExamFriendlyLogo } from '../ExamFriendlyLogo';
import { getEmbeddablePdfUrl } from '../../utils/pdfHelper';
import { 
  isMobileDevice, 
  supportsDisplayMedia, 
  captureVideoFrame, 
  AudioMeter, 
  publishCandidateStream, 
  disconnectCandidateStream, 
  eraseStudentSessionData,
  subscribeToStudentCommands,
  openGoogleMeetPopout
} from '../../services/proctoringService';

interface ExamRoomProps {
  exam: Exam;
  currentUser: User;
  onExit: () => void;
  onSubmitted: () => void;
}

export const ExamRoom: React.FC<ExamRoomProps> = ({ exam, currentUser, onExit, onSubmitted }) => {
  const isMobile = isMobileDevice();

  // Proctoring Initialization & Gate
  const [proctorSetupCompleted, setProctorSetupCompleted] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const audioMeterRef = useRef<AudioMeter | null>(null);

  // Video element refs for frame streaming
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamIntervalRef = useRef<any>(null);

  // Teacher Block / Termination & Warning State
  const [isTerminatedByTeacher, setIsTerminatedByTeacher] = useState(false);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [activeTeacherWarning, setActiveTeacherWarning] = useState<string | null>(null);

  // Timer & Violations
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [examEnded, setExamEnded] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [violationsList, setViolationsList] = useState<{ timestamp: string; action: string; details: string }[]>([]);

  // Overrides & Permissions State
  const [overrides, setOverrides] = useState<SubmissionOverride[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);

  // Mobile View Toggle
  const [mobileTab, setMobileTab] = useState<'paper' | 'submit'>('paper');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [selectedRawImages, setSelectedRawImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [highlightUploadBox, setHighlightUploadBox] = useState(false);

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

  // 1. Calculate and count down time (both until start and until end)
  const [isBeforeStart, setIsBeforeStart] = useState<boolean>(() => {
    return Date.now() < new Date(exam.StartTime).getTime();
  });
  const [secondsUntilStart, setSecondsUntilStart] = useState<number>(0);

  useEffect(() => {
    const start = new Date(exam.StartTime).getTime();
    const end = new Date(exam.EndTime).getTime();

    const updateTimer = () => {
      const now = Date.now();
      if (now < start) {
        setIsBeforeStart(true);
        const diffStart = Math.max(0, Math.floor((start - now) / 1000));
        setSecondsUntilStart(diffStart);
        setTimeLeftSeconds(Math.max(0, Math.floor((end - now) / 1000)));
        setExamEnded(false);
      } else {
        setIsBeforeStart(false);
        setSecondsUntilStart(0);
        const diffEnd = Math.max(0, Math.floor((end - now) / 1000));
        setTimeLeftSeconds(diffEnd);
        if (diffEnd <= 0) {
          setExamEnded(true);
        } else {
          setExamEnded(false);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [exam.StartTime, exam.EndTime]);

  // 2. Fetch Overrides & Groups to check teacher allow/disallow permissions
  const fetchPermissions = async () => {
    try {
      const [ovrRes, grpRes] = await Promise.all([
        executeGasAction('getSubmissionOverrides', { examId: exam.ExamId }),
        executeGasAction('getGroups', {}),
      ]);

      if (ovrRes.success && ovrRes.data?.overrides) {
        setOverrides(ovrRes.data.overrides);
      } else if (ovrRes.success && (ovrRes as any).overrides) {
        setOverrides((ovrRes as any).overrides);
      }

      if (grpRes.success && grpRes.data?.groups) {
        setGroups(grpRes.data.groups);
      } else if (grpRes.success && (grpRes as any).groups) {
        setGroups((grpRes as any).groups);
      }
    } catch (err) {
      console.error('Error loading submission overrides:', err);
    } finally {
      setLoadingOverrides(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
    const interval = setInterval(fetchPermissions, 20000);
    return () => clearInterval(interval);
  }, [exam.ExamId]);

  // Compute Permission Overrides for this Candidate
  const studentId = (currentUser.UserId || '').trim().toUpperCase();
  const studentGroupIds = groups
    .filter((g) => g.StudentIds && g.StudentIds.includes(studentId))
    .map((g) => g.GroupId);

  const activeDisallowOverride = overrides.find(
    (o) =>
      o.AllowSubmission === false &&
      ((o.TargetType === 'STUDENT' && o.TargetId.toUpperCase() === studentId) ||
        (o.TargetType === 'GROUP' && studentGroupIds.includes(o.TargetId)))
  );

  const activeAllowOverride = overrides.find(
    (o) =>
      o.AllowSubmission === true &&
      ((o.TargetType === 'STUDENT' && o.TargetId.toUpperCase() === studentId) ||
        (o.TargetType === 'GROUP' && studentGroupIds.includes(o.TargetId))) &&
      (!o.ExpiresAt || Date.now() <= new Date(o.ExpiresAt).getTime())
  );

  const isTimeExpired = timeLeftSeconds <= 0;
  const isBlocked = !!activeDisallowOverride || isTerminatedByTeacher;
  const hasExtension = !isBeforeStart && !!activeAllowOverride;
  // Students actively taking the exam in the console can submit their work (grace period supported)
  const canSubmit = !isBeforeStart && !isBlocked;

  // 3. Attach streams to video elements whenever they change
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, proctorSetupCompleted]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, proctorSetupCompleted]);

  // 4. Real-time Broadcasting Loop: Camera frame, screen frame, mic level to Turso & edge
  useEffect(() => {
    if (!proctorSetupCompleted || isTerminatedByTeacher) return;

    const broadcastFrame = () => {
      const camFrame = captureVideoFrame(videoRef.current, 320, 240, 0.45);
      const scrFrame = captureVideoFrame(screenVideoRef.current, 360, 225, 0.40);
      const audioVol = audioMeterRef.current ? audioMeterRef.current.getVolumeLevel() : 0;

      const payload: LiveProctorStream = {
        studentId: currentUser.UserId,
        studentName: currentUser.Name || currentUser.UserId,
        examId: exam.ExamId,
        cameraFrame: camFrame || undefined,
        screenFrame: scrFrame || undefined,
        audioLevel: audioVol,
        deviceType: isMobile ? 'MOBILE' : 'DESKTOP',
        isMobile: isMobile,
        isScreenSharing: !!screenStream,
        isCameraActive: !!cameraStream,
        isMicActive: !!audioMeterRef.current,
        isBlocked: isTerminatedByTeacher,
        blockedReason: terminationReason || undefined,
        warningCount: warningCount,
        lastSeen: Date.now(),
        status: isTerminatedByTeacher ? 'BLOCKED' : submitSuccess ? 'SUBMITTED' : 'ONLINE',
        activeWarning: activeTeacherWarning || undefined,
        violationsList: violationsList,
      };

      publishCandidateStream(payload);
    };

    // Broadcast immediately and then every 900ms for real-time edge streaming
    broadcastFrame();
    streamIntervalRef.current = setInterval(broadcastFrame, 900);

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, [
    proctorSetupCompleted,
    isTerminatedByTeacher,
    terminationReason,
    warningCount,
    activeTeacherWarning,
    submitSuccess,
    violationsList,
    exam.ExamId,
    currentUser,
    isMobile,
    cameraStream,
    screenStream,
  ]);

  // 5. Subscribe to Teacher Real-Time Commands (BLOCK, UNBLOCK, WARN)
  useEffect(() => {
    const unsubscribe = subscribeToStudentCommands(exam.ExamId, currentUser.UserId, (cmd: ProctorCommand) => {
      if (cmd.type === 'BLOCK') {
        setIsTerminatedByTeacher(true);
        setTerminationReason(cmd.reason || 'Blocked for unfair means by invigilator');
        // Stop audio/video tracks
        if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
        if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
      } else if (cmd.type === 'UNBLOCK') {
        setIsTerminatedByTeacher(false);
        setTerminationReason(null);
      } else if (cmd.type === 'WARN') {
        setActiveTeacherWarning(cmd.warningText || 'Please pay attention to the exam rules.');
        setWarningCount((c) => c + 1);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [exam.ExamId, currentUser.UserId, cameraStream, screenStream]);

  // 6. Anti-Cheat Surveillance Listeners
  useEffect(() => {
    if (!proctorSetupCompleted || isTerminatedByTeacher) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('TAB_SWITCH', 'Candidate switched away from active examination tab.');
      }
    };

    const handleWindowBlur = () => {
      logViolation('WINDOW_BLUR', 'Focus lost: active exam window blurred or app switched.');
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
  }, [exam.ExamId, currentUser, proctorSetupCompleted, isTerminatedByTeacher]);

  const logViolation = (type: any, details: string) => {
    setWarningCount((prev) => prev + 1);
    setLastWarning(`${type}: ${details}`);
    setViolationsList((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), action: type, details },
    ]);

    executeGasAction('logProctorEvent', {
      timestamp: new Date().toISOString(),
      examId: exam.ExamId,
      studentId: currentUser.UserId,
      actionType: type,
      details: details,
    });
  };

  // Automatic session data erasure and proctor stream termination when exam ends
  useEffect(() => {
    if (examEnded && !hasExtension && proctorSetupCompleted) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
      }
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }
      if (audioMeterRef.current) {
        audioMeterRef.current.destroy();
        audioMeterRef.current = null;
      }
      eraseStudentSessionData(exam.ExamId, currentUser.UserId).catch((err) => {
        console.warn('Session erase error on exam conclusion:', err);
      });
    }
  }, [examEnded, hasExtension, proctorSetupCompleted, exam.ExamId, currentUser.UserId]);

  // 7. Cleanup streams on unmount / exit
  const handleExitRoom = async () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
    if (audioMeterRef.current) audioMeterRef.current.destroy();
    try {
      await eraseStudentSessionData(exam.ExamId, currentUser.UserId);
    } catch (e) {
      console.warn('Session data erase error:', e);
    }
    onExit();
  };

  // Component unmount teardown
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
      if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
      if (audioMeterRef.current) audioMeterRef.current.destroy();
      eraseStudentSessionData(exam.ExamId, currentUser.UserId).catch(() => {});
    };
  }, [cameraStream, screenStream, exam.ExamId, currentUser.UserId]);

  // 8. Handle Student Answer Sheet file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canSubmit) {
      setErrorMsg('Submissions are closed. File selection is disabled.');
      return;
    }

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
      saveSubmissionFileStorage(exam.ExamId, currentUser.UserId, b64);
    } catch (err) {
      setErrorMsg('Failed to process file locally.');
    }
  };

  // 9. Callback from ImageToPdfModal
  const handlePdfGeneratedFromImages = (pdfFile: File, pdfBase64Data: string, rawImages?: string[]) => {
    setSelectedFile(pdfFile);
    setFileBase64(pdfBase64Data);
    if (rawImages && rawImages.length > 0) {
      setSelectedRawImages(rawImages);
      saveSubmissionFileStorage(exam.ExamId, currentUser.UserId, pdfBase64Data, rawImages);
      try {
        localStorage.setItem(`osm_student_images_${exam.ExamId}_${currentUser.UserId}`, JSON.stringify(rawImages));
      } catch (e) {}
    } else {
      saveSubmissionFileStorage(exam.ExamId, currentUser.UserId, pdfBase64Data);
    }
    setErrorMsg(null);
  };

  // 10. Submit Answer Sheet Workflow
  const handleSubmitAnswer = () => {
    if (!canSubmit) {
      setErrorMsg(
        isBlocked
          ? 'Submissions are blocked by instructor for your account.'
          : 'Examination has not started yet. Submissions open at scheduled start time.'
      );
      return;
    }

    if (!selectedFile || !fileBase64) {
      setErrorMsg('Please select a PDF file or click "Scan & Assemble Answer Photos to PDF" above before submitting.');
      setHighlightUploadBox(true);
      setTimeout(() => setHighlightUploadBox(false), 2500);
      return;
    }

    setErrorMsg(null);
    setIsConfirmSubmitOpen(true);
  };

  const performFinalSubmission = async () => {
    if (!selectedFile || !fileBase64) {
      setErrorMsg('Please select or compile a valid PDF answer sheet before submitting.');
      setIsConfirmSubmitOpen(false);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await executeGasAction('submitAnswerSheet', {
        studentId: currentUser.UserId,
        studentName: currentUser.Name || currentUser.UserId,
        examId: exam.ExamId,
        pdfBase64: fileBase64,
        rawImages: selectedRawImages,
        imageUrls: selectedRawImages,
        filename: selectedFile.name || `ANS_${exam.ExamId}_${currentUser.UserId}.pdf`,
        submittedAt: new Date().toISOString(),
      });

      if (res.success) {
        setSubmitSuccess(true);
        setIsConfirmSubmitOpen(false);
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        
        // Erase session data from Turso & edge database
        try {
          await eraseStudentSessionData(exam.ExamId, currentUser.UserId);
        } catch (e) {
          console.warn('Erase session error:', e);
        }

        executeGasAction('logProctorEvent', {
          timestamp: new Date().toISOString(),
          examId: exam.ExamId,
          studentId: currentUser.UserId,
          actionType: 'EXAM_SUBMIT',
          details: `Answer Sheet uploaded successfully (${selectedFile.name}). Proctoring session concluded and purged.`,
        });

        setTimeout(() => {
          if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
          if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
          if (audioMeterRef.current) audioMeterRef.current.destroy();
          onSubmitted();
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Failed to complete answer sheet submission.');
        setIsConfirmSubmitOpen(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during submission upload.');
      setIsConfirmSubmitOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // 11. Fetch Doubts for this student with real-time sync
  const fetchDoubts = async () => {
    try {
      const res = await executeGasAction('getDoubts', { examId: exam.ExamId });
      const doubts: Doubt[] = res.data?.doubts || (res as any).doubts || [];
      if (Array.isArray(doubts)) {
        const curId = (currentUser.UserId || '').trim().toUpperCase();
        const studentDoubts = doubts.filter((d: Doubt) => {
          const dStudentId = (d.StudentId || '').trim().toUpperCase();
          return !dStudentId || dStudentId === curId;
        });
        setDoubtsList(studentDoubts);
      }
    } catch (err) {
      console.error('Error fetching doubts:', err);
    }
  };

  useEffect(() => {
    fetchDoubts();
    let doubtsChan: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        doubtsChan = new BroadcastChannel('examfriendly_doubts_sync_v1');
        doubtsChan.onmessage = () => {
          fetchDoubts();
        };
      }
    } catch (e) {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'examfriendly_doubts_v1' || e.key === 'exam_portal_doubts') {
        fetchDoubts();
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(fetchDoubts, 2000);
    return () => {
      clearInterval(interval);
      if (doubtsChan) doubtsChan.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [exam.ExamId, currentUser.UserId]);

  const handleSendDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtText.trim()) return;

    setSubmittingDoubt(true);
    try {
      const res = await executeGasAction('createDoubt', {
        examId: exam.ExamId,
        studentId: currentUser.UserId,
        studentName: currentUser.Name || currentUser.UserId,
        question: doubtText.trim(),
      });

      if (res.success) {
        setDoubtText('');
        fetchDoubts();
      }
    } catch (err) {
      console.error(err);
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

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const qpEmbedInfo = getEmbeddablePdfUrl(exam.QPUrl);

  // Gating: If proctoring setup is not done, show ProctoringSetupModal
  if (!proctorSetupCompleted) {
    return (
      <div className="min-h-screen bg-[#0B1528] flex items-center justify-center p-4">
        <ProctoringSetupModal
          isOpen={!proctorSetupCompleted}
          examTitle={exam.Subject || exam.ExamId}
          studentName={currentUser.Name || currentUser.UserId}
          studentId={currentUser.UserId}
          onCancel={onExit}
          onComplete={(cStream, sStream, aMeter) => {
            setCameraStream(cStream);
            setScreenStream(sStream);
            audioMeterRef.current = aMeter;
            setProctorSetupCompleted(true);

            executeGasAction('logProctorEvent', {
              timestamp: new Date().toISOString(),
              examId: exam.ExamId,
              studentId: currentUser.UserId,
              actionType: 'EXAM_START',
              details: `Candidate initialized proctoring (Camera: ON, Mic: ON, Screen: ${sStream ? 'ON' : isMobile ? 'MOBILE_MODE' : 'OFF'})`,
            });
          }}
        />
      </div>
    );
  }

  // TERMINATED FOR UNFAIR MEANS OVERLAY
  if (isTerminatedByTeacher) {
    return (
      <div className="min-h-screen bg-rose-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-lg w-full bg-rose-900 border border-rose-500 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-rose-800 border-2 border-rose-400 text-white flex items-center justify-center mx-auto shadow-lg animate-bounce">
            <Ban className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 bg-rose-950 text-rose-300 font-mono text-xs font-bold rounded-full border border-rose-700">
              DISQUALIFICATION NOTICE
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              EXAMINATION TERMINATED
            </h1>
            <p className="text-xs sm:text-sm text-rose-200 leading-relaxed">
              Your examination session has been <strong>blocked and terminated</strong> by the faculty invigilator due to suspected unfair means.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-700 text-left space-y-2 text-xs">
            <div className="flex justify-between text-rose-300">
              <span>Candidate:</span>
              <strong className="text-white">{currentUser.Name || currentUser.UserId} ({currentUser.UserId})</strong>
            </div>
            <div className="flex justify-between text-rose-300">
              <span>Exam ID:</span>
              <strong className="text-white">{exam.ExamId}</strong>
            </div>
            <div className="border-t border-rose-800 pt-2 text-rose-200">
              <strong className="text-rose-400 block mb-0.5">Invigilator Grounds / Remarks:</strong>
              <span>{terminationReason || 'Violation of institutional proctoring rules.'}</span>
            </div>
          </div>

          <button
            onClick={handleExitRoom}
            className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-rose-900 font-bold text-sm shadow-xl transition-all min-h-[46px]"
          >
            Exit Examination Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8FA] flex flex-col font-sans select-none relative">
      {/* Hidden screen video capture element for proctor snapshots */}
      <video
        ref={screenVideoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* TEACHER LIVE WARNING POPUP MODAL */}
      {activeTeacherWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border-2 border-amber-400 rounded-3xl shadow-2xl p-6 text-center space-y-4 font-sans">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-mono text-[10px] font-bold rounded-md">
                HIGH PRIORITY INVIGILATOR NOTICE
              </span>
              <h3 className="text-base font-bold text-slate-900">Proctor Warning Issued</h3>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left leading-relaxed">
              {activeTeacherWarning}
            </div>

            <button
              onClick={() => setActiveTeacherWarning(null)}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all min-h-[44px]"
            >
              I Acknowledge &amp; Understand
            </button>
          </div>
        </div>
      )}

      {/* Top Header - Deep Sky Blue & Dark Navy Branding with ExamFriendly PNG Logo */}
      <div className="bg-[#0A192F] text-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-30 shadow-md border-b border-sky-900/50">
        {/* Left: Exam Info & PNG Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExitRoom}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Exit Exam Hall"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Nav PNG Logo */}
          <div className="bg-white p-1 rounded-lg border border-sky-300/40 hidden sm:flex items-center justify-center shrink-0">
            <ExamFriendlyLogo size="sm" showTagline={false} variant="nav" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {exam.Subject || 'General Examination'}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-sky-950 text-[#009fe3] rounded-md font-bold border border-sky-800">
                {exam.ExamId}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Candidate: <strong className="text-slate-200">{currentUser.Name || currentUser.UserId}</strong></span>
              <span>•</span>
              <span className="font-mono text-sky-300">Roll: {currentUser.UserId}</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Countdown Timer & Status Bar */}
        <div className="flex items-center justify-between sm:justify-center gap-2.5 sm:gap-3">
          {/* Real-time Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-sky-900/60 shadow-xs">
            <Clock className={`w-4 h-4 ${isBeforeStart ? 'text-amber-400 animate-pulse' : timeLeftSeconds < 600 ? 'text-[#f25f22] animate-pulse' : 'text-[#009fe3]'}`} />
            <div>
              <div className={`font-mono font-bold text-xs sm:text-sm leading-none ${isBeforeStart ? 'text-amber-400' : timeLeftSeconds < 600 ? 'text-[#f25f22]' : 'text-white'}`}>
                {isBeforeStart ? formatTime(secondsUntilStart) : formatTime(timeLeftSeconds)}
              </div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                {isBeforeStart ? 'Starts In' : examEnded ? 'Time Expired' : 'Remaining'}
              </div>
            </div>
          </div>

          {/* Live Proctoring Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-sky-800/80 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-300 hidden md:inline">Live Proctored</span>
            <div className="flex items-center gap-1 text-slate-300 text-[10px] pl-1 border-l border-slate-700">
              <Camera className="w-3 h-3 text-[#009fe3]" />
              <Mic className="w-3 h-3 text-emerald-400" />
              {isMobile ? (
                <Smartphone className="w-3 h-3 text-[#f25f22]" />
              ) : (
                <Monitor className="w-3 h-3 text-[#f25f22]" />
              )}
            </div>
          </div>

          {/* Submission Status Pill */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border ${
              isBeforeStart
                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                : isBlocked
                ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                : !canSubmit
                ? 'bg-orange-950/80 text-[#f25f22] border-orange-800'
                : hasExtension
                ? 'bg-sky-950/80 text-sky-300 border-sky-800'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            }`}
          >
            {isBeforeStart ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Starts Soon (Locked)</span>
              </>
            ) : isBlocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Blocked</span>
              </>
            ) : !canSubmit ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Closed</span>
              </>
            ) : hasExtension ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-[#009fe3]" />
                <span>Extension Active</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submissions Open</span>
              </>
            )}
          </div>

          {/* Ask Invigilator Button */}
          <button
            onClick={() => setIsDoubtOpen(!isDoubtOpen)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 relative min-h-[36px]"
          >
            <MessageSquareQuote className="w-3.5 h-3.5 text-[#f25f22]" />
            <span className="hidden sm:inline">Ask Invigilator</span>
            {doubtsList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#f25f22] absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Google Meet Live Invigilation Bar */}
      {exam.MeetUrl && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-b border-emerald-800 text-white px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                <span>Google Meet Live Invigilation Hall</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-900 text-emerald-200 border border-emerald-700">
                  1080p Real-Time
                </span>
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                Join the invigilation room for HD video &amp; audio surveillance alongside ExamFriendly auto-proctor.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openGoogleMeetPopout(exam.MeetUrl!)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 min-h-[36px]"
            >
              <Video className="w-3.5 h-3.5 text-slate-950" />
              <span>Join Google Meet</span>
              <ExternalLink className="w-3 h-3 text-slate-950 opacity-70" />
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(exam.MeetUrl!);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 transition-colors min-h-[36px]"
            >
              Copy Meet Link
            </button>
          </div>
        </div>
      )}

      {/* Submission Status Banner (Top Notice if Closed or Extended) */}
      {isBlocked ? (
        <div className="bg-rose-700 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs font-medium">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-white shrink-0" />
            <span>
              <strong>Submission Blocked:</strong> Faculty has disallowed submission for your account ({activeDisallowOverride?.Reason || 'Disciplinary / Administrative constraint'}). Contact invigilator.
            </span>
          </div>
        </div>
      ) : isTimeExpired && !hasExtension ? (
        <div className="bg-gradient-to-r from-orange-600 to-rose-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs font-medium">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-white shrink-0" />
            <span>
              <strong>Examination Concluded:</strong> The exam time limit has ended. Submissions are strictly locked. If you encountered technical difficulties, request a late submission permission from your instructor.
            </span>
          </div>
        </div>
      ) : hasExtension ? (
        <div className="bg-gradient-to-r from-sky-700 to-sky-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs font-medium">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-sky-200 shrink-0" />
            <span>
              <strong>Faculty Extension Granted:</strong> You have been granted late submission permission by the faculty. (Reason: {activeAllowOverride?.Reason || 'Authorized extension'}). Submissions are accepted until {activeAllowOverride?.ExpiresAt ? new Date(activeAllowOverride.ExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Indefinite'}.
            </span>
          </div>
        </div>
      ) : null}

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden px-4 pt-3 pb-1 bg-white border-b border-slate-200 grid grid-cols-2 gap-2">
        <button
          onClick={() => setMobileTab('paper')}
          className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[44px] ${
            mobileTab === 'paper'
              ? 'bg-[#009fe3] text-white shadow-xs'
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
              ? 'bg-[#009fe3] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>2. Answer Sheet &amp; Scan</span>
        </button>
      </div>

      {/* Pre-Exam Holding Lobby Information Banner */}
      {isBeforeStart && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 sm:px-6 py-3 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm flex items-center gap-2">
                <span>Pre-Exam Holding Lobby</span>
                <span className="bg-black/20 text-white px-2 py-0.5 rounded text-[10px] font-mono">
                  Paper Locked
                </span>
              </div>
              <p className="text-[11px] text-amber-100 mt-0.5 leading-snug">
                The examination starts at <strong>{formatDateTime(exam.StartTime)}</strong>. The question paper will automatically decrypt and unlock when the timer reaches zero.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/25 px-3 py-1.5 rounded-xl border border-white/20 text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
            <span>Unlocks In: {formatTime(secondsUntilStart)}</span>
          </div>
        </div>
      )}

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
              {isBeforeStart ? (
                <Lock className="w-4 h-4 text-amber-600" />
              ) : (
                <FileText className="w-4 h-4 text-[#009fe3]" />
              )}
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {isBeforeStart ? 'Question Paper (Encrypted Vault)' : 'Question Paper (A4 View)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isBeforeStart ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Locked until Start Time</span>
                </span>
              ) : (
                <>
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
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#009fe3] bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors border border-sky-200 shadow-xs min-h-[36px]"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Fullscreen</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Embedded Viewer Container OR High-Security Lock Vault */}
          <div className="flex-1 bg-slate-800 min-h-[480px] lg:min-h-[580px] flex flex-col relative">
            {isBeforeStart ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-10 bg-slate-900 text-white space-y-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
                    <Lock className="w-8 h-8" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 animate-ping opacity-75" />
                </div>

                <div className="max-w-md space-y-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Question Paper Encrypted &amp; Locked
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Under institutional examination protocols, question papers are strictly locked and cannot be viewed or downloaded prior to the official start time.
                  </p>
                </div>

                {/* Digital Countdown Box */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 text-amber-400 max-w-xs w-full shadow-inner space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    Auto-Decrypts &amp; Opens In
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-black tracking-wider">
                    {formatTime(secondsUntilStart)}
                  </div>
                  <div className="text-[10px] text-amber-300/80 font-mono">
                    Scheduled Start: {formatDateTime(exam.StartTime)}
                  </div>
                </div>

                {/* Candidate Pre-Exam Readiness Checklist */}
                <div className="w-full max-w-md p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-left text-xs space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Candidate Pre-Flight Readiness Checklist</span>
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1.5 pl-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>Web camera is streaming live with face clearly visible.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>Microphone is unmuted and room noise is minimized.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>Blank A4 sheets, stationery, and pens are prepared on desk.</span>
                    </li>
                    {exam.MeetUrl && (
                      <li className="flex items-center gap-2 text-emerald-300 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span>Connected to the Google Meet Live Invigilation Hall.</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            ) : exam.QPUrl ? (
              !qpEmbedInfo.isDriveUrl ? (
                <object
                  data={qpEmbedInfo.embedUrl}
                  type="application/pdf"
                  className="w-full h-full min-h-[520px] flex-1 border-0"
                >
                  <iframe
                    src={qpEmbedInfo.embedUrl}
                    title="Question Paper Document"
                    className="w-full h-full min-h-[520px] flex-1 border-0"
                  />
                </object>
              ) : (
                <iframe
                  src={qpEmbedInfo.embedUrl}
                  title="Question Paper Drive Document"
                  className="w-full h-full min-h-[520px] flex-1 border-0"
                  allow="autoplay"
                />
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <FileText className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-sm font-semibold">No Question Paper PDF attached.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Contact room proctor if question paper does not load.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col (5 cols): Proctoring Feeds & Answer Booklet Upload / Assembly */}
        <div
          className={`lg:col-span-5 flex flex-col gap-4 ${
            mobileTab !== 'submit' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Active Live Surveillance Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#009fe3] animate-pulse" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Live Invigilation Feed
                </span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Connected to Proctor
              </span>
            </div>

              {/* Video preview with active frame */}
            <div className="relative aspect-4/3 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
              {cameraStream && !examEnded ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror-mode"
                  />

                  {/* Status overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/85 text-[10px] font-mono text-emerald-400 border border-emerald-800/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>REC • LIVE PROCTORING</span>
                  </div>

                  {/* Screen share badge or mobile badge */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/85 text-[10px] font-mono text-sky-300 border border-sky-800/60">
                    {isMobile ? (
                      <>
                        <Smartphone className="w-3 h-3 text-[#f25f22]" />
                        <span>Mobile Guard</span>
                      </>
                    ) : (
                      <>
                        <Monitor className="w-3 h-3 text-[#009fe3]" />
                        <span>Screen Shared</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500">
                    <CameraOff className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {examEnded ? 'Proctoring Concluded & Cleared' : 'Camera Stream Offline'}
                  </span>
                  <span className="text-[10px] text-slate-500 max-w-xs">
                    {examEnded
                      ? 'Live streams terminated and session data erased from database.'
                      : 'Webcam will activate when proctoring session is started.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Answer Booklet Upload / Scan & Submit Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-[#009fe3]" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Answer Sheet Submission
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">A4 Format • PDF</span>
              </div>

              {/* Status Notice if Closed */}
              {!canSubmit && (
                <div className={`p-3.5 rounded-xl space-y-1 ${
                  isBeforeStart
                    ? 'bg-amber-50 border border-amber-200 text-amber-900'
                    : 'bg-orange-50 border border-orange-200 text-orange-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Lock className={`w-4 h-4 shrink-0 ${isBeforeStart ? 'text-amber-600' : 'text-[#f25f22]'}`} />
                    <span>
                      {isBeforeStart
                        ? 'Submission Portal Locked (Pre-Exam)'
                        : 'Submissions Are Currently Closed'}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${isBeforeStart ? 'text-amber-800' : 'text-orange-800'}`}>
                    {isBeforeStart
                      ? `Answer booklet submission opens automatically when the examination starts at ${formatDateTime(exam.StartTime)}.`
                      : isBlocked
                      ? 'Submissions for your account have been restricted by the faculty.'
                      : 'The scheduled exam time limit has ended. No new answer booklets can be uploaded.'}
                  </p>
                </div>
              )}

              {/* PRIMARY PROMINENT FEATURE: Image to PDF Scanner Button */}
              <div className={`p-4 rounded-xl bg-gradient-to-r from-sky-50 via-orange-50/40 to-sky-50 border border-sky-200 space-y-2.5 ${!canSubmit ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2 text-slate-900">
                  <FileImage className="w-4 h-4 text-[#f25f22] shrink-0" />
                  <h4 className="text-xs font-bold">Have handwritten answer photos?</h4>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Upload multiple photos from your mobile/desktop, reorder pages, rotate if needed, and compile a single non-skewed A4 PDF answer booklet.
                </p>
                <button
                  type="button"
                  onClick={() => setImageToPdfOpen(true)}
                  disabled={!canSubmit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f25f22] hover:bg-[#ea580c] text-white rounded-xl text-xs font-bold transition-all shadow-xs min-h-[40px] disabled:opacity-50 cursor-pointer"
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

              <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group ${
                highlightUploadBox
                  ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-200 animate-pulse'
                  : 'border-slate-200 hover:border-sky-400 bg-slate-50 hover:bg-sky-50/30'
              } ${!canSubmit ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={!canSubmit}
                  className="hidden"
                />
                <UploadCloud className={`w-6 h-6 mb-1 transition-colors ${highlightUploadBox ? 'text-orange-500' : 'text-slate-400 group-hover:text-[#009fe3]'}`} />
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
                    className="text-xs text-[#009fe3] hover:text-sky-800 flex items-center gap-1 font-bold min-h-[32px] px-2 cursor-pointer"
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
              type="button"
              onClick={handleSubmitAnswer}
              disabled={submitting || submitSuccess || !canSubmit}
              className={`w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-h-[46px] cursor-pointer ${
                submitSuccess
                  ? 'bg-emerald-600'
                  : !canSubmit
                  ? 'bg-slate-400'
                  : !selectedFile
                  ? 'bg-gradient-to-r from-sky-600 to-[#009fe3] hover:from-sky-700 hover:to-[#0284c7]'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 ring-2 ring-emerald-500/30'
              }`}
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
              ) : !canSubmit ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Submissions Closed</span>
                </>
              ) : !selectedFile ? (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Attach PDF &amp; Submit Final Answer Sheet</span>
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

      {/* Doubt Q&A Slide-over Drawer */}
      {isDoubtOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 font-sans">
            {/* Drawer Header */}
            <div className="p-4 bg-[#0A192F] text-white flex items-center justify-between border-b border-sky-900">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-[#f25f22]" />
                <h3 className="font-bold text-sm">Exam Room Invigilator Support</h3>
              </div>
              <button
                onClick={() => setIsDoubtOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Doubts Conversation History */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {doubtsList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <MessageSquareQuote className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No active doubts submitted yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Have questions about question phrasing or formatting? Send a message directly to the invigilator.
                  </p>
                </div>
              ) : (
                doubtsList.map((d) => (
                  <div
                    key={d.DoubtId}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 leading-relaxed">
                        {d.Question}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          d.Status === 'ANSWERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {d.Status}
                      </span>
                    </div>

                    {d.Answer ? (
                      <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs space-y-1">
                        <div className="text-[10px] font-bold text-[#009fe3] uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Invigilator Response:</span>
                        </div>
                        <p className="text-slate-800 font-medium">{d.Answer}</p>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-[#009fe3]" />
                        <span>Awaiting teacher review...</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Doubt Input Box */}
            <form onSubmit={handleSendDoubt} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={doubtText}
                onChange={(e) => setDoubtText(e.target.value)}
                placeholder="Ask teacher a question..."
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 min-h-[40px]"
                disabled={submittingDoubt}
              />
              <button
                type="submit"
                disabled={submittingDoubt || !doubtText.trim()}
                className="px-4 py-2 bg-[#009fe3] hover:bg-[#0284c7] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center min-h-[40px]"
              >
                {submittingDoubt ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Image To PDF Scanner Modal */}
      <ImageToPdfModal
        isOpen={imageToPdfOpen}
        onClose={() => setImageToPdfOpen(false)}
        examSubject={exam.Subject}
        examId={exam.ExamId}
        candidateId={currentUser.UserId}
        candidateName={currentUser.Name}
        onPdfGenerated={handlePdfGeneratedFromImages}
      />

      {/* PDF Fullscreen Preview Modal */}
      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={!!previewPdfUrl}
          onClose={() => setPreviewPdfUrl(null)}
          title={previewPdfTitle}
          pdfUrl={previewPdfUrl}
        />
      )}

      {/* Final Submission Confirmation Modal (Replaces blocked window.confirm) */}
      {isConfirmSubmitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
            {/* Modal Header */}
            <div className="bg-[#0A192F] p-4 text-white flex items-center justify-between border-b border-sky-900">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Confirm Final Submission</h3>
                  <p className="text-[10px] text-sky-200 font-mono">Exam: {exam.ExamId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmSubmitOpen(false)}
                disabled={submitting}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Subject:</span>
                  <span className="font-bold text-slate-900 text-right truncate max-w-[200px]">{exam.Subject}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Candidate:</span>
                  <span className="font-bold text-slate-900">{currentUser.Name || currentUser.UserId} ({currentUser.UserId})</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Attached Booklet:</span>
                  <span className="font-mono font-bold text-emerald-700 truncate max-w-[190px]">{selectedFile?.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Document Size:</span>
                  <span className="font-mono text-slate-700">{selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : 0} MB</span>
                </div>
                {selectedRawImages && selectedRawImages.length > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-medium">Total Scanned Pages:</span>
                    <span className="font-bold text-sky-700">{selectedRawImages.length} Pages</span>
                  </div>
                )}
              </div>

              {/* Review PDF Quick CTA */}
              {fileBase64 && selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPdfUrl(fileBase64);
                    setPreviewPdfTitle(`Verify - ${selectedFile.name}`);
                  }}
                  className="w-full py-2 px-3 bg-sky-50 hover:bg-sky-100 text-[#009fe3] border border-sky-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Review Attached PDF Booklet Before Submitting</span>
                </button>
              )}

              {/* Warning box */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Session Lock Warning:</strong>
                  Once confirmed, your answer booklet is instantly submitted for grading and your live examination session will conclude.
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmSubmitOpen(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer min-h-[42px] disabled:opacity-50"
                >
                  Review More
                </button>
                <button
                  type="button"
                  onClick={performFinalSubmission}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer min-h-[42px] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Yes, Submit Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
