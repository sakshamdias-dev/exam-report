import React, { useState, useEffect } from 'react';
import { Exam, LiveProctorStream, ProctorCommand, User } from '../../types';
import { 
  getLiveStreams, 
  subscribeToLiveStreams, 
  sendProctorCommand,
  openGoogleMeetPopout,
  generateGoogleMeetLink,
  eraseStudentSessionData,
  eraseExamAllSessionsData
} from '../../services/proctoringService';
import { 
  getTursoConfig, 
  testTursoConnection 
} from '../../services/tursoService';
import { TursoConfigModal } from '../TursoConfigModal';
import { executeGasAction } from '../../services/api';
import { 
  ShieldAlert, 
  Camera, 
  Monitor, 
  Mic, 
  Smartphone, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  Volume2, 
  Search, 
  Filter, 
  RefreshCw, 
  Maximize2, 
  Send, 
  Unlock, 
  Clock, 
  Users, 
  Eye, 
  Radio, 
  Sparkles,
  AlertCircle,
  X,
  Laptop,
  Video,
  ExternalLink,
  Copy,
  Check,
  Link2,
  Edit3,
  Zap,
  Database,
  Trash2
} from 'lucide-react';
import { ExamFriendlyLogo } from '../ExamFriendlyLogo';

interface LiveProctoringGridProps {
  exams: Exam[];
  currentUser: User;
}

export const LiveProctoringGrid: React.FC<LiveProctoringGridProps> = ({ exams, currentUser }) => {
  const [streams, setStreams] = useState<LiveProctorStream[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'ONLINE' | 'FLAGGED' | 'BLOCKED' | 'MOBILE'>('ALL');
  
  // Modal states
  const [inspectTarget, setInspectTarget] = useState<{ studentId: string; examId: string } | null>(null);
  const [blockingStream, setBlockingStream] = useState<LiveProctorStream | null>(null);
  const [blockReason, setBlockReason] = useState<string>('Suspected unfair means / Unauthorized resources detected');
  const [customBlockReason, setCustomBlockReason] = useState<string>('');
  const [blockLoading, setBlockLoading] = useState(false);

  const [warningStream, setWarningStream] = useState<LiveProctorStream | null>(null);
  const [warningText, setWarningText] = useState<string>('Warning: Please ensure your face is fully visible on camera and focus on the exam screen.');
  const [warningLoading, setWarningLoading] = useState(false);

  // Google Meet Invigilation State
  const [copiedMeet, setCopiedMeet] = useState(false);
  const [isEditingMeet, setIsEditingMeet] = useState(false);
  const [customMeetInput, setCustomMeetInput] = useState('');
  const [meetActionLoading, setMeetActionLoading] = useState(false);

  // Turso Real-time Edge Engine State
  const [isTursoModalOpen, setIsTursoModalOpen] = useState(false);
  const [tursoConfig, setTursoConfig] = useState(() => getTursoConfig());
  const [tursoLatency, setTursoLatency] = useState<number | null>(null);

  const checkTursoStatus = async () => {
    const cfg = getTursoConfig();
    setTursoConfig(cfg);
    if (cfg.isConfigured) {
      try {
        const res = await testTursoConnection(cfg.url, cfg.authToken);
        if (res.success && res.latencyMs !== undefined) {
          setTursoLatency(res.latencyMs);
        }
      } catch {
        setTursoLatency(null);
      }
    } else {
      setTursoLatency(null);
    }
  };

  useEffect(() => {
    checkTursoStatus();
    const interval = setInterval(checkTursoStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTursoUpdated = () => {
    checkTursoStatus();
  };

  // Derive active exam and meet URL
  const currentExam = exams.find((e) => e.ExamId === selectedExamId) || exams[0];
  const activeMeetUrl = currentExam?.MeetUrl || (selectedExamId !== 'ALL' ? `https://meet.google.com/exf-${selectedExamId.toLowerCase().replace(/[^a-z0-9]/g, '')}-inv` : 'https://meet.google.com/exf-cs30-inv');

  const handleCopyMeetLink = () => {
    if (!activeMeetUrl) return;
    navigator.clipboard.writeText(activeMeetUrl);
    setCopiedMeet(true);
    setTimeout(() => setCopiedMeet(false), 2000);
  };

  const handleLaunchGoogleMeet = () => {
    if (activeMeetUrl) {
      openGoogleMeetPopout(activeMeetUrl);
    }
  };

  const handleAutoGenerateMeet = async () => {
    const targetExamId = selectedExamId === 'ALL' ? (exams[0]?.ExamId || 'GENERAL') : selectedExamId;
    setMeetActionLoading(true);
    try {
      const res = await executeGasAction('createGoogleMeetRoom', {
        examId: targetExamId,
        subject: currentExam?.Subject || 'Online Exam',
      });
      if (res.success && res.data?.meetUrl) {
        // Update local exam object
        if (currentExam) {
          currentExam.MeetUrl = res.data.meetUrl;
        }
      }
    } catch (err) {
      console.error('Error generating Google Meet:', err);
    } finally {
      setMeetActionLoading(false);
      setIsEditingMeet(false);
    }
  };

  const handleSaveCustomMeet = async () => {
    if (!customMeetInput.trim()) return;
    const targetExamId = selectedExamId === 'ALL' ? (exams[0]?.ExamId || 'GENERAL') : selectedExamId;
    setMeetActionLoading(true);
    try {
      await executeGasAction('updateExam', {
        examId: targetExamId,
        meetUrl: customMeetInput.trim(),
      });
      if (currentExam) {
        currentExam.MeetUrl = customMeetInput.trim();
      }
    } catch (err) {
      console.error('Error saving Google Meet link:', err);
    } finally {
      setMeetActionLoading(false);
      setIsEditingMeet(false);
    }
  };

  // Subscribe to real-time streams (runs once on mount)
  useEffect(() => {
    const unsubscribe = subscribeToLiveStreams((updatedStreams) => {
      setStreams(updatedStreams);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Derive inspected stream from active streams list
  const selectedStreamForInspect = inspectTarget
    ? streams.find((s) => s.studentId === inspectTarget.studentId && s.examId === inspectTarget.examId) || null
    : null;

  // Filter streams
  const filteredStreams = streams.filter((s) => {
    const matchesExam = selectedExamId === 'ALL' || s.examId === selectedExamId;
    const matchesSearch =
      !searchQuery ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesExam || !matchesSearch) return false;

    if (filterType === 'ONLINE') return s.status === 'ONLINE';
    if (filterType === 'FLAGGED') return (s.warningCount || 0) > 0 || (s.violationsList && s.violationsList.length > 0);
    if (filterType === 'BLOCKED') return s.isBlocked || s.status === 'BLOCKED';
    if (filterType === 'MOBILE') return s.isMobile;
    return true;
  });

  // Action: Block Student for Unfair Means
  const handleConfirmBlock = async () => {
    if (!blockingStream) return;
    setBlockLoading(true);
    const finalReason = customBlockReason.trim() ? customBlockReason.trim() : blockReason;

    const cmd: ProctorCommand = {
      commandId: 'cmd_' + Date.now(),
      type: 'BLOCK',
      examId: blockingStream.examId,
      studentId: blockingStream.studentId,
      reason: finalReason,
      timestamp: new Date().toISOString(),
    };

    sendProctorCommand(cmd);

    // Also persist via GAS backend audit log & override
    try {
      await Promise.all([
        executeGasAction('logProctorEvent', {
          timestamp: new Date().toISOString(),
          examId: blockingStream.examId,
          studentId: blockingStream.studentId,
          actionType: 'BLOCKED_BY_TEACHER',
          details: `Invigilator ${currentUser.Name || currentUser.UserId} BLOCKED candidate for: ${finalReason}`,
        }),
        executeGasAction('saveSubmissionOverride', {
          override: {
            OverrideId: 'ovr_' + Date.now(),
            ExamId: blockingStream.examId,
            TargetType: 'STUDENT',
            TargetId: blockingStream.studentId,
            TargetName: blockingStream.studentName,
            AllowSubmission: false,
            Reason: `BLOCKED FOR UNFAIR MEANS: ${finalReason}`,
            GrantedBy: currentUser.Name || currentUser.UserId,
            CreatedAt: new Date().toISOString(),
          },
        }),
      ]);
    } catch (e) {
      console.error('Error logging block event:', e);
    } finally {
      setBlockLoading(false);
      setBlockingStream(null);
      setCustomBlockReason('');
    }
  };

  // Action: Unblock Student
  const handleUnblock = async (stream: LiveProctorStream) => {
    const cmd: ProctorCommand = {
      commandId: 'cmd_' + Date.now(),
      type: 'UNBLOCK',
      examId: stream.examId,
      studentId: stream.studentId,
      timestamp: new Date().toISOString(),
    };

    sendProctorCommand(cmd);

    try {
      await executeGasAction('logProctorEvent', {
        timestamp: new Date().toISOString(),
        examId: stream.examId,
        studentId: stream.studentId,
        actionType: 'UNBLOCKED_BY_TEACHER',
        details: `Invigilator ${currentUser.Name || currentUser.UserId} UNBLOCKED candidate.`,
      });
    } catch (e) {
      console.error('Error logging unblock event:', e);
    }
  };

  // Action: Send Warning to Student
  const handleSendWarning = async () => {
    if (!warningStream || !warningText.trim()) return;
    setWarningLoading(true);

    const cmd: ProctorCommand = {
      commandId: 'cmd_' + Date.now(),
      type: 'WARN',
      examId: warningStream.examId,
      studentId: warningStream.studentId,
      warningText: warningText.trim(),
      timestamp: new Date().toISOString(),
    };

    sendProctorCommand(cmd);

    try {
      await executeGasAction('logProctorEvent', {
        timestamp: new Date().toISOString(),
        examId: warningStream.examId,
        studentId: warningStream.studentId,
        actionType: 'WARNING_ISSUED',
        details: `Warning issued to candidate: "${warningText.trim()}"`,
      });
    } catch (e) {
      console.error('Error logging warning event:', e);
    } finally {
      setWarningLoading(false);
      setWarningStream(null);
      setWarningText('Warning: Please ensure your face is fully visible on camera and focus on the exam screen.');
    }
  };

  // Action: Erase and Purge a single student's proctoring session data
  const handlePurgeStudentSession = async (stream: LiveProctorStream) => {
    if (
      !window.confirm(
        `Erase and close session for candidate ${stream.studentName || stream.studentId}? This will remove all proctoring video feeds and records from the database.`
      )
    ) {
      return;
    }

    try {
      await eraseStudentSessionData(stream.examId, stream.studentId);
      if (inspectTarget?.studentId === stream.studentId) {
        setInspectTarget(null);
      }
    } catch (e) {
      console.error('Error purging session:', e);
    }
  };

  // Action: Purge all session data for selected exam
  const handlePurgeAllExamSessions = async () => {
    const examLabel = selectedExamId === 'ALL' ? 'ALL active exams' : `Exam ${selectedExamId}`;
    if (
      !window.confirm(
        `Purge all proctoring session feeds & database records for ${examLabel}? This action completely resets the live feed surveillance table.`
      )
    ) {
      return;
    }

    try {
      await eraseExamAllSessionsData(selectedExamId === 'ALL' ? undefined : selectedExamId);
      setInspectTarget(null);
    } catch (e) {
      console.error('Error purging all sessions:', e);
    }
  };

  const onlineCount = streams.filter((s) => s.status === 'ONLINE').length;
  const flaggedCount = streams.filter((s) => (s.warningCount || 0) > 0).length;
  const blockedCount = streams.filter((s) => s.isBlocked || s.status === 'BLOCKED').length;
  const mobileCount = streams.filter((s) => s.isMobile).length;

  return (
    <div className="space-y-5 font-sans">
      {/* Top Live Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-sky-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Live Active Feeds</div>
            <div className="text-2xl font-bold font-mono text-[#009fe3] flex items-center gap-1.5 mt-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {onlineCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 text-[#009fe3]">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Flagged Candidates</div>
            <div className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
              {flaggedCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Blocked / Disqualified</div>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-0.5">
              {blockedCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <Ban className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Mobile Candidates</div>
            <div className="text-2xl font-bold font-mono text-slate-700 mt-0.5">
              {mobileCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Turso Real-time Edge DB Engine Status Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white shadow-md border border-cyan-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-white">Turso Edge Realtime Engine</span>
              {tursoConfig.isConfigured ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE (EDGE SYNC)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold">
                  LOCAL + HYBRID MODE
                </span>
              )}
              {tursoLatency !== null && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-200 border border-cyan-700/50 text-[10px] font-mono font-semibold">
                  ⚡ {tursoLatency} ms latency
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {tursoConfig.isConfigured
                ? 'High-speed edge database streaming student webcams, screen frames & audio VU levels continuously.'
                : 'Connect Turso libSQL edge database for millisecond cross-device video & screen streaming.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsTursoModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px]"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{tursoConfig.isConfigured ? 'Manage Turso DB' : 'Configure Turso Engine'}</span>
          </button>
        </div>
      </div>

      {/* Google Meet Live Invigilation Command Center Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white shadow-md border border-emerald-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold flex items-center gap-1">
                <Video className="w-3 h-3 text-emerald-400" />
                GOOGLE MEET LIVE INVIGILATION
              </div>
              <span className="text-xs text-emerald-200/80 font-medium">
                1080p Multi-Candidate Surveillance Hall
              </span>
            </div>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>{currentExam ? `${currentExam.Subject || currentExam.ExamId}` : 'All Examination Rooms'}</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Google Meet streams real-time full-resolution camera and microphone audio without browser latency. Use alongside the ExamFriendly automated proctoring snapshot grid below.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/40 border border-emerald-500/30 text-xs font-mono text-emerald-300">
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[280px] sm:max-w-md">{activeMeetUrl}</span>
              </div>

              <button
                type="button"
                onClick={handleCopyMeetLink}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/10"
              >
                {copiedMeet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMeet ? 'Copied Link' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomMeetInput(activeMeetUrl);
                  setIsEditingMeet(!isEditingMeet);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/10"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingMeet ? 'Cancel' : 'Edit / Change Link'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleLaunchGoogleMeet}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg hover:shadow-emerald-500/25 active:scale-95"
            >
              <Video className="w-4 h-4 text-slate-950" />
              <span>Launch Google Meet Grid</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-950 opacity-70" />
            </button>

            <button
              type="button"
              onClick={handleAutoGenerateMeet}
              disabled={meetActionLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 border border-emerald-500/30 text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{meetActionLoading ? 'Creating...' : 'Regenerate Room'}</span>
            </button>
          </div>
        </div>

        {/* Inline Edit Form for Google Meet URL */}
        {isEditingMeet && (
          <div className="mt-4 pt-3 border-t border-emerald-500/30 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in">
            <input
              type="url"
              value={customMeetInput}
              onChange={(e) => setCustomMeetInput(e.target.value)}
              placeholder="Paste institution Google Meet link: https://meet.google.com/xxx-yyyy-zzz"
              className="w-full sm:flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-emerald-400/50 text-xs text-white placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveCustomMeet}
                disabled={meetActionLoading}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Save &amp; Broadcast
              </button>
              <button
                type="button"
                onClick={() => setIsEditingMeet(false)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Exam Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
            <Filter className="w-3.5 h-3.5 text-[#009fe3]" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Active Exams ({exams.length})</option>
              {exams.map((ex) => (
                <option key={ex.ExamId} value={ex.ExamId}>
                  {ex.Subject ? `${ex.Subject} (${ex.ExamId})` : ex.ExamId}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({streams.length})
            </button>
            <button
              onClick={() => setFilterType('ONLINE')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterType === 'ONLINE' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live ({onlineCount})
            </button>
            <button
              onClick={() => setFilterType('FLAGGED')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterType === 'FLAGGED' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flagged ({flaggedCount})
            </button>
            <button
              onClick={() => setFilterType('BLOCKED')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterType === 'BLOCKED' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Blocked ({blockedCount})
            </button>
            <button
              onClick={() => setFilterType('MOBILE')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterType === 'MOBILE' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mobile ({mobileCount})
            </button>
          </div>
        </div>

        {/* Search Candidate & Purge Bar */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#009fe3]"
            />
          </div>

          <button
            type="button"
            onClick={handlePurgeAllExamSessions}
            title="Erase and purge all proctoring session records and video feeds from the database"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Purge Data</span>
          </button>
        </div>
      </div>

      {/* Grid of Student Live Surveillance Cards */}
      {filteredStreams.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#009fe3] flex items-center justify-center mx-auto">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Active Student Feeds Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {streams.length === 0
              ? 'Candidate live feeds will appear here automatically as soon as students enter the active exam room and start their camera/mic/screen streams.'
              : 'No candidates matched the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredStreams.map((stream) => {
            const isBlocked = stream.isBlocked || stream.status === 'BLOCKED';
            const isOnline = stream.status === 'ONLINE';
            const hasViolations = (stream.warningCount || 0) > 0;

            return (
              <div
                key={`${stream.examId}_${stream.studentId}`}
                className={`bg-white rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden relative ${
                  isBlocked
                    ? 'border-rose-300 ring-2 ring-rose-500/20'
                    : hasViolations
                    ? 'border-amber-300 ring-1 ring-amber-400/30'
                    : 'border-slate-200 hover:border-sky-300'
                }`}
              >
                {/* Card Header: Student Info & Badges */}
                <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isBlocked
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-sky-100 text-[#009fe3]'
                      }`}
                    >
                      {stream.studentId.substring(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {stream.studentName || stream.studentId}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                        <span>ID: {stream.studentId}</span>
                        <span>•</span>
                        <span className="truncate">{stream.examId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Device & Status Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {stream.isMobile ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        Mobile
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold flex items-center gap-1">
                        <Laptop className="w-3 h-3 text-[#009fe3]" />
                        Desktop
                      </span>
                    )}

                    {isBlocked ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                        <Ban className="w-3 h-3" />
                        BLOCKED
                      </span>
                    ) : isOnline ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px]">
                        {stream.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dual Live Feeds Area */}
                <div className="p-3 grid grid-cols-2 gap-2 bg-slate-950">
                  {/* Left: Camera Feed */}
                  <div className="relative aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
                    {stream.cameraFrame ? (
                      <img
                        src={stream.cameraFrame}
                        alt={`${stream.studentId} webcam`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 text-center p-2 space-y-1">
                        <Camera className="w-5 h-5 text-slate-600" />
                        <span className="text-[9px] font-mono">No Cam Frame</span>
                      </div>
                    )}

                    {/* Camera Label Overlay */}
                    <div className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-semibold text-white flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5 text-[#009fe3]" />
                      <span>Webcam</span>
                    </div>

                    {/* Live Audio VU Meter */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-900/85 backdrop-blur-xs px-2 py-1 rounded flex items-center gap-1.5">
                      <Mic className={`w-3 h-3 ${stream.audioLevel > 20 ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-100 ${
                            stream.audioLevel > 50
                              ? 'bg-rose-500'
                              : stream.audioLevel > 20
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, stream.audioLevel * 1.4)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-300 font-bold">
                        {stream.audioLevel > 0 ? `${stream.audioLevel}%` : '0%'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Screen Share Feed (or Mobile Guard Banner) */}
                  <div className="relative aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
                    {stream.isMobile ? (
                      <div className="flex flex-col items-center justify-center text-center p-2 space-y-1.5 text-slate-400">
                        <Smartphone className="w-6 h-6 text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-200">Mobile Guard</span>
                        <span className="text-[8px] text-slate-400 leading-tight">
                          OS screen capture restricted • Front Cam &amp; Focus Active
                        </span>
                      </div>
                    ) : stream.screenFrame ? (
                      <img
                        src={stream.screenFrame}
                        alt={`${stream.studentId} screen`}
                        className="w-full h-full object-contain bg-black"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 text-center p-2 space-y-1">
                        <Monitor className="w-5 h-5 text-slate-600" />
                        <span className="text-[9px] font-mono">No Screen Frame</span>
                      </div>
                    )}

                    {/* Screen Label Overlay */}
                    <div className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-semibold text-white flex items-center gap-1">
                      <Monitor className="w-2.5 h-2.5 text-[#f25f22]" />
                      <span>{stream.isMobile ? 'Mobile' : 'Screen Share'}</span>
                    </div>
                  </div>
                </div>

                {/* Violation & Alert Summary Bar */}
                <div className="px-3.5 py-2 bg-white border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Invigilation Flags:</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                        (stream.warningCount || 0) > 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stream.warningCount || 0} Flags
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectTarget({ studentId: stream.studentId, examId: stream.examId })}
                    className="text-[#009fe3] hover:text-[#0284c7] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                </div>

                {/* Teacher Actions Bar */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  {isBlocked ? (
                    <button
                      type="button"
                      onClick={() => handleUnblock(stream)}
                      className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[36px]"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unblock Candidate</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setWarningStream(stream)}
                        className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[36px]"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Warn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (activeMeetUrl) openGoogleMeetPopout(activeMeetUrl);
                        }}
                        title="View Candidate in Google Meet Room"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors min-h-[36px]"
                      >
                        <Video className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Meet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePurgeStudentSession(stream)}
                        title="Erase and close this student's proctoring session"
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-semibold flex items-center justify-center transition-colors min-h-[36px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setBlockingStream(stream)}
                        className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[36px]"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block (Unfair)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INSPECT HD MODAL */}
      {selectedStreamForInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center font-bold">
                  {selectedStreamForInspect.studentId.substring(0, 3)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedStreamForInspect.studentName || selectedStreamForInspect.studentId}</span>
                    <span className="text-xs font-mono text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                      ID: {selectedStreamForInspect.studentId}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exam: <strong className="text-slate-200">{selectedStreamForInspect.examId}</strong> • Live Surveillance Feed
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectTarget(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Large Feeds */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Large Webcam */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-[#009fe3]" />
                      Candidate Webcam Video
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      Audio: {selectedStreamForInspect.audioLevel}%
                    </span>
                  </div>
                  <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {selectedStreamForInspect.cameraFrame ? (
                      <img
                        src={selectedStreamForInspect.cameraFrame}
                        alt="HD Cam"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Camera feed offline</span>
                    )}
                  </div>
                </div>

                {/* Large Screen Share */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-[#f25f22]" />
                      Candidate Screen Share Feed
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedStreamForInspect.isMobile ? 'Mobile Mode' : 'Desktop Monitor'}
                    </span>
                  </div>
                  <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {selectedStreamForInspect.isMobile ? (
                      <div className="p-6 text-center text-slate-400 space-y-2">
                        <Smartphone className="w-8 h-8 text-amber-400 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-200">Mobile Candidate Environment</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          Screen share API is restricted on mobile OS. Focus loss &amp; front camera active.
                        </p>
                      </div>
                    ) : selectedStreamForInspect.screenFrame ? (
                      <img
                        src={selectedStreamForInspect.screenFrame}
                        alt="HD Screen"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Screen share offline</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Total Flags:</span>
                  <span className="px-2 py-0.5 bg-rose-950 text-rose-400 font-mono font-bold rounded border border-rose-800">
                    {selectedStreamForInspect.warningCount || 0}
                  </span>
                  {selectedStreamForInspect.isBlocked && (
                    <span className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded">
                      BLOCKED / DISQUALIFIED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePurgeStudentSession(selectedStreamForInspect)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Erase Session</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeMeetUrl) openGoogleMeetPopout(activeMeetUrl);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Open in Google Meet</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWarningStream(selectedStreamForInspect);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Issue Warning</span>
                  </button>

                  {selectedStreamForInspect.isBlocked ? (
                    <button
                      type="button"
                      onClick={() => handleUnblock(selectedStreamForInspect)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unblock</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBlockingStream(selectedStreamForInspect);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Block for Unfair Means</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK STUDENT CONFIRMATION MODAL */}
      {blockingStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-rose-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 my-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Ban className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Block Candidate for Unfair Means</h3>
              <p className="text-xs text-slate-600">
                This will immediately terminate the examination screen for{' '}
                <strong>{blockingStream.studentName || blockingStream.studentId}</strong> (ID: {blockingStream.studentId}) and lock their submission.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="font-bold text-slate-700">Select Grounds for Disqualification:</label>
              <select
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="Suspected unfair means / Unauthorized resources detected">
                  Suspected unfair means / Unauthorized resources detected
                </option>
                <option value="Secondary device / Smartphone detected in frame">
                  Secondary device / Smartphone detected in frame
                </option>
                <option value="Multiple unauthorized persons in camera view">
                  Multiple unauthorized persons in camera view
                </option>
                <option value="Repeated tab switching & window blur violations">
                  Repeated tab switching &amp; window blur violations
                </option>
                <option value="Screen sharing terminated / Camera feed obstructed">
                  Screen sharing terminated / Camera feed obstructed
                </option>
                <option value="Impersonation / Candidate not visible on camera">
                  Impersonation / Candidate not visible on camera
                </option>
                <option value="Other">Other Custom Grounds</option>
              </select>

              {blockReason === 'Other' && (
                <textarea
                  value={customBlockReason}
                  onChange={(e) => setCustomBlockReason(e.target.value)}
                  placeholder="Specify detailed reason for blocking..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBlockingStream(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all min-h-[42px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                disabled={blockLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition-all min-h-[42px] disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                <span>{blockLoading ? 'Blocking...' : 'Confirm Block'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE WARNING MODAL */}
      {warningStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-amber-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 my-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Send Live Invigilator Warning</h3>
              <p className="text-xs text-slate-600">
                A high-priority popup alert will display instantly on the screen of{' '}
                <strong>{warningStream.studentName || warningStream.studentId}</strong>.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700">Warning Message:</label>
              <textarea
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                placeholder="Enter warning text..."
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWarningStream(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all min-h-[42px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendWarning}
                disabled={warningLoading || !warningText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all min-h-[42px] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{warningLoading ? 'Sending...' : 'Send Warning'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TURSO EDGE REALTIME DB CONFIGURATION MODAL */}
      <TursoConfigModal
        isOpen={isTursoModalOpen}
        onClose={() => setIsTursoModalOpen(false)}
        onConfigUpdated={handleTursoUpdated}
      />
    </div>
  );
};
