import React, { useState, useEffect } from 'react';
import { User, Exam, Submission, StudentGroup } from '../../types';
import { executeGasAction } from '../../services/api';
import { 
  Calendar, 
  FileCheck, 
  ShieldAlert, 
  MessageSquareQuote, 
  Plus, 
  RefreshCw, 
  Award, 
  Users,
  Layers,
  GraduationCap,
  Radio,
  Camera,
  Monitor
} from 'lucide-react';
import { ExamsTable } from './ExamsTable';
import { SubmissionsReview } from './SubmissionsReview';
import { ProctorLogsViewer } from './ProctorLogsViewer';
import { DoubtsConsole } from './DoubtsConsole';
import { CreateExamModal } from './CreateExamModal';
import { StudentAccountsManagement } from './StudentAccountsManagement';
import { StudentGroupsManagement } from './StudentGroupsManagement';
import { LiveProctoringGrid } from './LiveProctoringGrid';

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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const pendingGradingCount = submissions.filter((s) => s.Score === '' || s.Score === undefined).length;

  return (
    <div id="teacher-dashboard-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5 font-sans">
      {/* Top Banner with Institutional Stats */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#009fe3] shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">{currentUser.Name || 'Faculty Evaluator'}</h2>
                <span className="px-2 py-0.5 text-xs font-mono bg-sky-50 text-[#009fe3] rounded border border-sky-200 font-semibold">
                  ID: {currentUser.UserId}
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded border border-slate-200 font-semibold">
                  Exam Controller Access
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-2">
                <span>ExamFriendly Faculty Administration Console</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-slate-600">AY 2026–27 | Semester II</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="refresh-console-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 rounded-xl transition-colors border border-slate-200 shadow-xs min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              id="create-new-exam-btn"
              onClick={() => setIsCreateExamOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#f25f22] hover:bg-[#ea580c] rounded-xl transition-colors shadow-xs min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Exam</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-100">
          <div
            onClick={() => setActiveTab('live-proctor')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'live-proctor'
                ? 'bg-sky-50/80 border-[#009fe3] shadow-xs ring-1 ring-[#009fe3]/30'
                : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Live Proctoring</span>
              <Radio className="w-3.5 h-3.5 text-[#009fe3] animate-pulse" />
            </div>
            <div className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Camera &amp; Screen</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('exams')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'exams'
                ? 'bg-sky-50/80 border-[#009fe3] shadow-xs'
                : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Exams</span>
              <Calendar className="w-3.5 h-3.5 text-[#009fe3]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{exams.length}</div>
          </div>

          <div
            onClick={() => setActiveTab('students')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-sky-50/80 border-[#009fe3] shadow-xs'
                : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Candidates</span>
              <Users className="w-3.5 h-3.5 text-[#009fe3]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{studentsCount || '—'}</div>
          </div>

          <div
            onClick={() => setActiveTab('groups')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-sky-50/80 border-[#009fe3] shadow-xs'
                : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Cohorts/Groups</span>
              <Layers className="w-3.5 h-3.5 text-[#009fe3]" />
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{groupsCount || '—'}</div>
          </div>

          <div
            onClick={() => setActiveTab('submissions')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-orange-50/80 border-[#f25f22] shadow-xs'
                : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Pending Marks</span>
              <FileCheck className="w-3.5 h-3.5 text-[#f25f22]" />
            </div>
            <div className="text-lg font-bold font-mono text-[#f25f22] mt-0.5">{pendingGradingCount}</div>
          </div>

          <div
            onClick={() => setActiveTab('proctor')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'proctor'
                ? 'bg-rose-50/80 border-rose-300 shadow-xs'
                : 'bg-slate-50 border-slate-200/70 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Surveillance</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">Audit Logs</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1 pb-px scrollbar-none bg-white px-2 rounded-t-xl">
        <button
          id="tab-live-proctor"
          onClick={() => setActiveTab('live-proctor')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'live-proctor'
              ? 'border-[#009fe3] text-[#009fe3]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Radio className="w-4 h-4 text-[#009fe3] animate-pulse" />
          <span>Live Proctoring Grid (Cam/Mic/Screen)</span>
        </button>

        <button
          id="tab-exams"
          onClick={() => setActiveTab('exams')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'exams'
              ? 'border-[#009fe3] text-[#009fe3]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Examinations ({exams.length})</span>
        </button>

        <button
          id="tab-students"
          onClick={() => setActiveTab('students')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'students'
              ? 'border-[#009fe3] text-[#009fe3]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-[#009fe3]" />
          <span>Candidate Accounts</span>
        </button>

        <button
          id="tab-groups"
          onClick={() => setActiveTab('groups')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'groups'
              ? 'border-[#009fe3] text-[#009fe3]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-[#009fe3]" />
          <span>Student Groups ({groupsCount})</span>
        </button>

        <button
          id="tab-submissions"
          onClick={() => setActiveTab('submissions')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'submissions'
              ? 'border-[#f25f22] text-[#f25f22]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <span>Submissions &amp; Grading</span>
          {pendingGradingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-[10px]">
              {pendingGradingCount}
            </span>
          )}
        </button>

        <button
          id="tab-proctor"
          onClick={() => setActiveTab('proctor')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'proctor'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>Audit Logs</span>
        </button>

        <button
          id="tab-doubts"
          onClick={() => setActiveTab('doubts')}
          className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'doubts'
              ? 'border-[#009fe3] text-[#009fe3]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquareQuote className="w-4 h-4 text-purple-600" />
          <span>Candidate Queries</span>
        </button>
      </div>

      {/* Active Tab View */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#009fe3]" />
          Loading faculty console data...
        </div>
      ) : (
        <div>
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
    </div>
  );
};
