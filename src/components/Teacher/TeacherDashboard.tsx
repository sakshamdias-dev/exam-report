import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, Submission } from '../../types';
import { executeGasAction } from '../../services/api';
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
  Cloud
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
    </div>
  );
};

