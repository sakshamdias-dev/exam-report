import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, Submission, Doubt } from '../../types';
import { executeGasAction } from '../../services/api';
import { playTeacherDoubtBeepSound } from '../../utils/audioAlert';
import { 
  Calendar, 
  FileCheck, 
  ShieldAlert, 
  MessageSquareQuote, 
  Plus, 
  RefreshCw, 
  Users,
  Layers,
  Radio,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Bell,
  Send,
  X,
  CheckCircle2,
  ExternalLink,
  Volume2
} from 'lucide-react';
import { ExamsTable } from './ExamsTable';
import { SubmissionsReview } from './SubmissionsReview';
import { ProctorLogsViewer } from './ProctorLogsViewer';
import { DoubtsConsole } from './DoubtsConsole';
import { CreateExamModal } from './CreateExamModal';
import { StudentAccountsManagement } from './StudentAccountsManagement';
import { StudentGroupsManagement } from './StudentGroupsManagement';
import { LiveProctoringGrid } from './LiveProctoringGrid';
import { GasScriptModal } from '../GasScriptModal';
import { getGasConnectionStatus } from '../../services/api';

interface TeacherDashboardProps {
  currentUser: User;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'live-proctor' | 'exams' | 'students' | 'groups' | 'submissions' | 'proctor' | 'doubts'>('live-proctor');
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [studentsCount, setStudentsCount] = useState<number>(0);
  const [groupsCount, setGroupsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [gasStatus, setGasStatus] = useState(() => getGasConnectionStatus());

  // Real-time doubt monitoring & pop-up alert state for faculty
  const [activeDoubtPopup, setActiveDoubtPopup] = useState<Doubt | null>(null);
  const [popupQuickReply, setPopupQuickReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState('');
  const [unreadDoubtsCount, setUnreadDoubtsCount] = useState(0);
  const knownDoubtIdsRef = useRef<Set<string>>(new Set());
  const isInitialDoubtPoll = useRef(true);

  const checkIncomingDoubts = async () => {
    try {
      const res = await executeGasAction('getDoubts', {});
      const allDoubts: Doubt[] = res.data?.doubts || (res as any).doubts || [];
      if (Array.isArray(allDoubts)) {
        const openDoubts = allDoubts.filter((d) => d.Status === 'OPEN');
        setUnreadDoubtsCount(openDoubts.length);

        if (isInitialDoubtPoll.current) {
          allDoubts.forEach((d) => knownDoubtIdsRef.current.add(d.DoubtId));
          isInitialDoubtPoll.current = false;
        } else {
          // Check for any newly arrived open doubts
          const newOpen = openDoubts.filter((d) => !knownDoubtIdsRef.current.has(d.DoubtId));
          if (newOpen.length > 0) {
            const latest = newOpen[newOpen.length - 1];
            // Sound beep for teacher
            playTeacherDoubtBeepSound();
            setActiveDoubtPopup(latest);
            setPopupQuickReply('');
            setReplySuccessMsg('');
          }
          allDoubts.forEach((d) => knownDoubtIdsRef.current.add(d.DoubtId));
        }
      }
    } catch (e) {
      console.warn('Doubt monitoring error in TeacherDashboard:', e);
    }
  };

  useEffect(() => {
    checkIncomingDoubts();
    const interval = setInterval(checkIncomingDoubts, 3000);

    let doubtsChan: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        doubtsChan = new BroadcastChannel('examfriendly_doubts_sync_v1');
        doubtsChan.onmessage = () => {
          checkIncomingDoubts();
        };
      }
    } catch (_) {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'examfriendly_doubts_v1' || e.key === 'exam_portal_doubts') {
        checkIncomingDoubts();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      if (doubtsChan) doubtsChan.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleSendQuickReply = async () => {
    if (!activeDoubtPopup || !popupQuickReply.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await executeGasAction('answerDoubt', {
        doubtId: activeDoubtPopup.DoubtId,
        answer: popupQuickReply.trim(),
      });
      if (res.success) {
        setReplySuccessMsg('Clarification successfully transmitted to student!');
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const chan = new BroadcastChannel('examfriendly_doubts_sync_v1');
            chan.postMessage({ type: 'DOUBT_ANSWERED', doubtId: activeDoubtPopup.DoubtId });
            chan.close();
          }
        } catch (_) {}
        setTimeout(() => {
          setActiveDoubtPopup(null);
          setReplySuccessMsg('');
          setPopupQuickReply('');
          checkIncomingDoubts();
        }, 1400);
      }
    } catch (err) {
      console.error('Failed to answer doubt from popup:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const checkGasStatus = () => {
    setGasStatus(getGasConnectionStatus());
  };

  useEffect(() => {
    const handleConfigChange = () => {
      checkGasStatus();
    };
    window.addEventListener('gas-config-updated', handleConfigChange);
    return () => window.removeEventListener('gas-config-updated', handleConfigChange);
  }, []);

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -180 : 180,
        behavior: 'smooth',
      });
      setTimeout(checkTabScroll, 200);
    }
  };

  const fetchData = async () => {
    try {
      const [examsRes, subsRes, studentsRes, groupsRes] = await Promise.all([
        executeGasAction('getAllExams', {}),
        executeGasAction('getSubmissions', {}),
        executeGasAction('getStudents', {}),
        executeGasAction('getGroups', {}),
      ]);

      if (examsRes.success && examsRes.data?.exams) {
        setExams(examsRes.data.exams);
      } else if (examsRes.success && (examsRes as any).exams) {
        setExams((examsRes as any).exams);
      }

      if (subsRes.success && subsRes.data?.submissions) {
        setSubmissions(subsRes.data.submissions);
      } else if (subsRes.success && (subsRes as any).submissions) {
        setSubmissions((subsRes as any).submissions);
      }

      if (studentsRes.success && studentsRes.data?.students) {
        setStudentsCount(studentsRes.data.students.length);
      } else if (studentsRes.success && (studentsRes as any).students) {
        setStudentsCount((studentsRes as any).students.length);
      }

      if (groupsRes.success && groupsRes.data?.groups) {
        setGroupsCount(groupsRes.data.groups.length);
      } else if (groupsRes.success && (groupsRes as any).groups) {
        setGroupsCount((groupsRes as any).groups.length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    checkTabScroll();
    window.addEventListener('resize', checkTabScroll);
    return () => window.removeEventListener('resize', checkTabScroll);
  }, [exams, groupsCount, submissions]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const pendingGradingCount = submissions.filter((s) => s.Score === '' || s.Score === undefined).length;

  return (
    <div id="teacher-dashboard-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      {/* 1. Header: Cleaned-up body header (Profile kept exclusively in dark top navbar to eliminate duplicate visual clutter) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Faculty Administration</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage live surveillance, scheduled examinations, submissions grading, and cohort rosters</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="open-drive-settings-btn"
            onClick={() => setIsGasModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-xs cursor-pointer min-h-[38px]"
            title="Configure Google Drive & Apps Script Storage"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Drive Storage</span>
            {gasStatus.is404 && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Deployment setup required" />
            )}
          </button>
          <button
            id="refresh-console-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors border border-slate-200 shadow-xs cursor-pointer min-h-[38px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            id="create-new-exam-btn"
            onClick={() => setIsCreateExamOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Exam</span>
          </button>
        </div>
      </div>

      {/* 2. Metric / KPI Cards: Standardized, uniform styling (1px #E5E7EB border, 8px radius, white bg, identical padding, soft alpha badges, no orange outline) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Live Proctoring */}
        <button
          type="button"
          onClick={() => setActiveTab('live-proctor')}
          className={`p-4 rounded-lg bg-white border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === 'live-proctor'
              ? 'border-blue-500 ring-1 ring-blue-500/30'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Live Proctoring</span>
            <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div className="mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Camera &amp; Screen
            </span>
          </div>
        </button>

        {/* Exams */}
        <button
          type="button"
          onClick={() => setActiveTab('exams')}
          className={`p-4 rounded-lg bg-white border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === 'exams'
              ? 'border-blue-500 ring-1 ring-blue-500/30'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Exams</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{exams.length}</div>
        </button>

        {/* Candidates */}
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`p-4 rounded-lg bg-white border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === 'students'
              ? 'border-blue-500 ring-1 ring-blue-500/30'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Candidates</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{studentsCount || '—'}</div>
        </button>

        {/* Cohorts/Groups */}
        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={`p-4 rounded-lg bg-white border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === 'groups'
              ? 'border-blue-500 ring-1 ring-blue-500/30'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Cohorts/Groups</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{groupsCount || '—'}</div>
        </button>

        {/* Pending Marks (Uniform styling, soft alpha badge, no neon orange border outline) */}
        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
          className={`p-4 rounded-lg bg-white border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === 'submissions'
              ? 'border-blue-500 ring-1 ring-blue-500/30'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Pending Marks</span>
            <FileCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono flex items-center gap-2">
            <span>{pendingGradingCount}</span>
            {pendingGradingCount > 0 ? (
              <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                to grade
              </span>
            ) : (
              <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                all checked
              </span>
            )}
          </div>
        </button>

        {/* Surveillance */}
        <button
          type="button"
          onClick={() => setActiveTab('proctor')}
          className={`p-4 rounded-lg bg-white border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === 'proctor'
              ? 'border-blue-500 ring-1 ring-blue-500/30'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Surveillance</span>
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
              Audit Logs
            </span>
          </div>
        </button>
      </div>

      {/* 3. Tab Overflow: Horizontally scrollable menu with smooth scroll indicators */}
      <div className="relative border-b border-slate-200">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div
          ref={tabsRef}
          onScroll={checkTabScroll}
          className="flex overflow-x-auto scrollbar-none gap-2 px-1 pb-px scroll-smooth"
        >
          <button
            id="tab-live-proctor"
            onClick={() => setActiveTab('live-proctor')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'live-proctor'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>Live Proctoring Grid</span>
          </button>

          <button
            id="tab-exams"
            onClick={() => setActiveTab('exams')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'exams'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Examinations ({exams.length})</span>
          </button>

          <button
            id="tab-students"
            onClick={() => setActiveTab('students')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'students'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Candidate Accounts</span>
          </button>

          <button
            id="tab-groups"
            onClick={() => setActiveTab('groups')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'groups'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Student Groups ({groupsCount})</span>
          </button>

          <button
            id="tab-submissions"
            onClick={() => setActiveTab('submissions')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'submissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Submissions &amp; Grading</span>
            {pendingGradingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-[10px]">
                {pendingGradingCount}
              </span>
            )}
          </button>

          <button
            id="tab-proctor"
            onClick={() => setActiveTab('proctor')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'proctor'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Audit Logs</span>
          </button>

          <button
            id="tab-doubts"
            onClick={() => setActiveTab('doubts')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'doubts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquareQuote className="w-4 h-4" />
            <span>Candidate Queries</span>
            {unreadDoubtsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                {unreadDoubtsCount}
              </span>
            )}
          </button>
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 4. Active Tab View: De-boxed presentation */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
          Loading faculty console data...
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'live-proctor' && <LiveProctoringGrid exams={exams} currentUser={currentUser} />}
          {activeTab === 'exams' && <ExamsTable exams={exams} onRefresh={fetchData} />}
          {activeTab === 'students' && <StudentAccountsManagement onRefreshParent={fetchData} />}
          {activeTab === 'groups' && <StudentGroupsManagement onRefreshParent={fetchData} />}
          {activeTab === 'submissions' && (
            <SubmissionsReview submissions={submissions} exams={exams} onRefresh={fetchData} />
          )}
          {activeTab === 'proctor' && <ProctorLogsViewer exams={exams} />}
          {activeTab === 'doubts' && <DoubtsConsole exams={exams} />}
        </div>
      )}

      {/* Create Exam Modal */}
      {isCreateExamOpen && (
        <CreateExamModal
          isOpen={isCreateExamOpen}
          onClose={() => setIsCreateExamOpen(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Google Drive & Apps Script Storage Modal */}
      {isGasModalOpen && (
        <GasScriptModal
          isOpen={isGasModalOpen}
          onClose={() => {
            setIsGasModalOpen(false);
            checkGasStatus();
          }}
        />
      )}

      {/* Real-time Student Doubt / Query Alert Pop-up Modal for Faculty */}
      {activeDoubtPopup && (
        <div
          id="teacher-doubt-popup"
          className="fixed top-6 right-6 z-50 w-full max-w-md bg-white border-2 border-rose-400/90 rounded-2xl shadow-2xl p-5 font-sans animate-in slide-in-from-top-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <MessageSquareQuote className="w-4 h-4 text-rose-600" />
                Live Candidate Query
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                <Volume2 className="w-3 h-3 text-rose-500" />
                Audio Alert
              </span>
              <button
                type="button"
                onClick={() => setActiveDoubtPopup(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="py-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {activeDoubtPopup.StudentName || activeDoubtPopup.StudentId}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {exams.find((e) => e.ExamId === activeDoubtPopup.ExamId)?.Subject || activeDoubtPopup.ExamId}
              </span>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs text-slate-800 font-medium leading-relaxed">
              <span className="text-rose-600 font-bold mr-1">Q:</span>
              &ldquo;{activeDoubtPopup.Question}&rdquo;
            </div>

            {replySuccessMsg ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{replySuccessMsg}</span>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <textarea
                  value={popupQuickReply}
                  onChange={(e) => setPopupQuickReply(e.target.value)}
                  placeholder="Type instant clarification for candidate..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none h-18 text-slate-800"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSendQuickReply();
                    }
                  }}
                />

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('doubts');
                      setActiveDoubtPopup(null);
                    }}
                    className="text-[11px] font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open All Queries
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDoubtPopup(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleSendQuickReply}
                      disabled={!popupQuickReply.trim() || sendingReply}
                      className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Send className="w-3 h-3" />
                      {sendingReply ? 'Transmitting...' : 'Send Clarification'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

