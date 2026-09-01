import React, { useState, useEffect } from 'react';
import { Exam, Submission, User, StudentGroup } from '../../types';
import { executeGasAction } from '../../services/api';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  Award, 
  FileCheck,
  Eye,
  FileImage,
  Layers,
  UserCheck,
  Users,
  Lock,
  Unlock,
  Radio,
  PlayCircle,
  AlertTriangle,
  Sparkles,
  CheckCircle
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';
import { ImageToPdfModal } from './ImageToPdfModal';
import { CheckedPaperModal } from './CheckedPaperModal';
import { 
  HelpCircle, 
  RotateCcw, 
  MessageSquareQuote,
  AlertCircle
} from 'lucide-react';

interface StudentDashboardProps {
  currentUser: User;
  onEnterExam: (exam: Exam) => void;
}

type ExamCategoryTab = 'ALL' | 'ACTIVE' | 'UPCOMING' | 'PAST';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, onEnterExam }) => {
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExamCategoryTab>('ALL');

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');

  // Image to PDF Scanner Modal
  const [imageToPdfOpen, setImageToPdfOpen] = useState(false);
  const [scannerSuccessToast, setScannerSuccessToast] = useState<string | null>(null);

  // Checked Paper & Evaluation Doubts / Recheck Modal
  const [selectedCheckedSubmission, setSelectedCheckedSubmission] = useState<Submission | null>(null);
  const [selectedCheckedExam, setSelectedCheckedExam] = useState<Exam | undefined>(undefined);

  // Live timer tick to update upcoming/active counts and countdowns
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const [examsRes, subsRes, groupsRes] = await Promise.all([
        executeGasAction('getAllExams', {}),
        executeGasAction('getSubmissions', { studentId: currentUser.UserId }),
        executeGasAction('getGroups', {}),
      ]);

      if (examsRes.success && examsRes.data?.exams) {
        setAllExams(examsRes.data.exams);
      } else if (examsRes.success && (examsRes as any).exams) {
        setAllExams((examsRes as any).exams);
      }

      if (subsRes.success && subsRes.data?.submissions) {
        setSubmissions(subsRes.data.submissions);
      } else if (subsRes.success && (subsRes as any).submissions) {
        setSubmissions((subsRes as any).submissions);
      }

      if (groupsRes.success && groupsRes.data?.groups) {
        setStudentGroups(groupsRes.data.groups);
      } else if (groupsRes.success && (groupsRes as any).groups) {
        setStudentGroups((groupsRes as any).groups);
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
  }, [currentUser.UserId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Groups this student is a member of
  const myGroupIds = studentGroups
    .filter((g) => g.StudentIds.some((sId) => sId.toUpperCase() === currentUser.UserId.toUpperCase()))
    .map((g) => g.GroupId);

  // Filter exams assigned to this student
  const myAssignedExams = allExams.filter((exam) => {
    const type = exam.AssignmentType || 'ALL';
    if (type === 'ALL') return true;

    if (type === 'STUDENTS') {
      return (
        exam.AssignedStudents &&
        exam.AssignedStudents.some((sId) => sId.toUpperCase() === currentUser.UserId.toUpperCase())
      );
    }

    if (type === 'GROUPS') {
      return (
        exam.AssignedGroups &&
        exam.AssignedGroups.some((gId) => myGroupIds.includes(gId))
      );
    }

    return true;
  });

  // SORT RULE: Latest paper always on top (by StartTime or CreatedAt descending)
  const sortedExams = [...myAssignedExams].sort((a, b) => {
    const timeA = new Date(a.StartTime || a.CreatedAt || 0).getTime();
    const timeB = new Date(b.StartTime || b.CreatedAt || 0).getTime();
    return timeB - timeA;
  });

  // Categorize exams into: Upcoming, Active, and Past
  const upcomingExams = sortedExams.filter((exam) => {
    const start = new Date(exam.StartTime).getTime();
    const isSubmitted = submissions.some((s) => s.ExamId === exam.ExamId);
    return currentTime < start && !isSubmitted;
  });

  const activeExams = sortedExams.filter((exam) => {
    const start = new Date(exam.StartTime).getTime();
    const end = new Date(exam.EndTime).getTime();
    const isSubmitted = submissions.some((s) => s.ExamId === exam.ExamId);
    return currentTime >= start && currentTime <= end && !isSubmitted;
  });

  const pastExams = sortedExams.filter((exam) => {
    const end = new Date(exam.EndTime).getTime();
    const isSubmitted = submissions.some((s) => s.ExamId === exam.ExamId);
    return currentTime > end || isSubmitted;
  });

  // Filter exams based on selected category tab
  const displayedExams = 
    selectedCategory === 'ACTIVE' ? activeExams :
    selectedCategory === 'UPCOMING' ? upcomingExams :
    selectedCategory === 'PAST' ? pastExams :
    sortedExams;

  const getExamStatusDetails = (exam: Exam, isSubmitted: boolean) => {
    const start = new Date(exam.StartTime).getTime();
    const end = new Date(exam.EndTime).getTime();

    if (isSubmitted) {
      return { 
        category: 'PAST' as const,
        label: 'Submitted Booklet', 
        color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        badge: 'bg-emerald-100 text-emerald-800',
        canStart: false,
        countdownText: null
      };
    }

    if (currentTime < start) {
      const diffSecs = Math.max(0, Math.floor((start - currentTime) / 1000));
      const hours = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      const countdownStr = hours > 0 
        ? `Starts in ${hours}h ${mins}m` 
        : `Starts in ${mins}m ${secs}s`;

      return { 
        category: 'UPCOMING' as const,
        label: 'Upcoming Paper', 
        color: 'bg-amber-50 text-amber-800 border-amber-300',
        badge: 'bg-amber-100 text-amber-900 border-amber-200',
        canStart: false,
        countdownText: countdownStr
      };
    }

    if (currentTime > end) {
      return { 
        category: 'PAST' as const,
        label: 'Concluded', 
        color: 'bg-slate-100 text-slate-600 border-slate-300',
        badge: 'bg-slate-100 text-slate-700',
        canStart: false,
        countdownText: 'Time Expired'
      };
    }

    // Active
    const diffSecs = Math.max(0, Math.floor((end - currentTime) / 1000));
    const hours = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const countdownStr = hours > 0 
      ? `${hours}h ${mins}m remaining` 
      : `${mins}m remaining`;

    return { 
      category: 'ACTIVE' as const,
      label: 'Live Examination', 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse',
      badge: 'bg-emerald-600 text-white',
      canStart: true,
      countdownText: countdownStr
    };
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

  return (
    <div id="student-dashboard-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      {/* Top Academic Profile & Quick Actions Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-base shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">{currentUser.Name || 'Student Candidate'}</h2>
              <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded border border-blue-200 font-bold">
                ID: {currentUser.UserId}
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-semibold">
                Active Candidate
              </span>
              {myGroupIds.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded border border-slate-200 font-mono">
                  {myGroupIds.length} Cohort Group(s)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 font-medium">
              <span>Department of Examinations &amp; Candidate Portal</span>
              <span>•</span>
              <span className="font-mono text-[11px] text-slate-600">AY 2026–27 | Semester II</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="image-to-pdf-scanner-btn"
            onClick={() => setImageToPdfOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200 shadow-xs"
            title="Scan handwritten answer sheet photos and compile into PDF"
          >
            <FileImage className="w-4 h-4 text-blue-700" />
            <span>Image to PDF Scanner</span>
          </button>

          <button
            id="student-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 rounded-md transition-colors border border-slate-200 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Notification if PDF was compiled via Scanner */}
      {scannerSuccessToast && (
        <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{scannerSuccessToast}</span>
          </div>
          <button onClick={() => setScannerSuccessToast(null)} className="font-bold underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Examination Categories & Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Active Examinations Card */}
        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
            selectedCategory === 'ACTIVE'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Active Papers (Live)</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${activeExams.length > 0 ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
              {activeExams.length} Live
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {activeExams.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {activeExams.length > 0 ? 'Examinations currently underway' : 'No papers currently in progress'}
          </div>
        </button>

        {/* Upcoming Examinations Card */}
        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === 'UPCOMING' ? 'ALL' : 'UPCOMING')}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
            selectedCategory === 'UPCOMING'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Upcoming Papers</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-200">
              {upcomingExams.length} Scheduled
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {upcomingExams.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Papers locked until exact start time
          </div>
        </button>

        {/* Past Examinations Card */}
        <button
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === 'PAST' ? 'ALL' : 'PAST')}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
            selectedCategory === 'PAST'
              ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/20'
              : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Past / Concluded</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
              {pastExams.length} Papers
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {pastExams.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Submitted &amp; concluded evaluation records
          </div>
        </button>
      </div>

      {/* Scheduled Examinations Section with Category Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">Assigned Examinations Roster</h3>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
              Latest First
            </span>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Papers</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                {sortedExams.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active (Live)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${selectedCategory === 'ACTIVE' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                {activeExams.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('UPCOMING')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'UPCOMING'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Upcoming</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${selectedCategory === 'UPCOMING' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900'}`}>
                {upcomingExams.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('PAST')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'PAST'
                  ? 'bg-slate-800 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>Past</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${selectedCategory === 'PAST' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {pastExams.length}
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200 shadow-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-700" />
            Loading examinations schedule...
          </div>
        ) : displayedExams.length === 0 ? (
          <div className="p-10 rounded-xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="font-semibold text-slate-700">
              {selectedCategory === 'ACTIVE' && 'No active examinations underway right now.'}
              {selectedCategory === 'UPCOMING' && 'No upcoming examinations currently scheduled.'}
              {selectedCategory === 'PAST' && 'No past examinations found.'}
              {selectedCategory === 'ALL' && 'No examinations currently assigned to your candidate ID or cohort group.'}
            </p>
            {selectedCategory !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                View all assigned papers ({sortedExams.length})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedExams.map((exam) => {
              const submission = submissions.find((s) => s.ExamId === exam.ExamId);
              const isSubmitted = !!submission;
              const statusDetails = getExamStatusDetails(exam, isSubmitted);
              const isUpcoming = statusDetails.category === 'UPCOMING';
              const isActive = statusDetails.category === 'ACTIVE';

              return (
                <div
                  key={exam.ExamId}
                  className={`rounded-2xl bg-white border p-4 sm:p-5 flex flex-col justify-between transition-all shadow-xs space-y-4 text-xs relative overflow-hidden ${
                    isActive
                      ? 'border-emerald-300 ring-2 ring-emerald-500/10 hover:border-emerald-400 hover:shadow-md'
                      : isUpcoming
                      ? 'border-amber-200 hover:border-amber-300 hover:shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Top Header info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                        {exam.ExamId}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusDetails.color}`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />}
                        {isUpcoming && <Lock className="w-3 h-3 text-amber-700" />}
                        <span>{statusDetails.label}</span>
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                        {exam.Subject || 'General Examination'}
                      </h4>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>Max Marks: <strong>{exam.TotalMarks || 100}</strong></span>
                        </span>
                        {statusDetails.countdownText && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {statusDetails.countdownText}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Schedule Time Box */}
                    <div className="text-xs space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Start Time:</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-800 font-bold">
                          {formatDateTime(exam.StartTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>End Time:</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-800 font-bold">
                          {formatDateTime(exam.EndTime)}
                        </span>
                      </div>
                    </div>

                    {/* Security & QP Lock Status Notice for Upcoming Papers */}
                    {isUpcoming && (
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-tight">
                          <strong className="block font-bold">Question Paper Locked</strong>
                          <span className="text-amber-800">
                            Paper and submission unlock automatically at scheduled start time.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action CTA Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    {isSubmitted ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Submitted Booklet</span>
                          </div>
                          {submission.Score !== undefined && submission.Score !== '' ? (
                            <span className="font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">
                              Marks: {submission.Score} / {exam.TotalMarks || 100}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-semibold italic">Under Evaluation</span>
                          )}
                        </div>

                        {/* Open Checked Paper & Doubts/Recheck Modal */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCheckedSubmission(submission);
                            setSelectedCheckedExam(exam);
                          }}
                          className="w-full py-2.5 px-3 bg-[#009fe3] hover:bg-[#0088c4] text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>{submission.GradedUrl ? 'View Checked Paper & Doubts' : 'Evaluation Details & Doubts'}</span>
                        </button>
                      </div>
                    ) : isActive ? (
                      <button
                        type="button"
                        onClick={() => onEnterExam(exam)}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Enter Live Exam Console</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    ) : isUpcoming ? (
                      <button
                        type="button"
                        onClick={() => onEnterExam(exam)}
                        className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Enter pre-exam holding lobby to test your camera and join Meet room. Question paper remains locked until start time."
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Enter Pre-Exam Lobby</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-80" />
                      </button>
                    ) : (
                      <div className="text-center py-2 text-xs text-slate-400 font-medium bg-slate-50 rounded-xl border border-slate-200">
                        Examination Concluded
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submission History & Official Evaluation Records */}
      {submissions.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#009fe3]" />
              <h3 className="text-sm font-bold text-slate-900">Evaluated Answer Sheets &amp; Result Transcript</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono font-medium">{submissions.length} Submissions Logged</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Exam Code</th>
                    <th className="px-4 py-2.5">Submission Time</th>
                    <th className="px-4 py-2.5">My Answer Booklet</th>
                    <th className="px-4 py-2.5">Marks &amp; Feedback</th>
                    <th className="px-4 py-2.5">Evaluated / Checked Paper</th>
                    <th className="px-4 py-2.5">Rechecking Status</th>
                    <th className="px-4 py-2.5 text-right">Student Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {submissions.map((sub, idx) => {
                    const exam = allExams.find((e) => e.ExamId === sub.ExamId);
                    const doubtsCount = sub.EvaluationDoubts?.length || 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-900">
                          <div>{sub.ExamId}</div>
                          {exam?.Subject && (
                            <div className="text-[10px] text-slate-500 font-sans font-normal truncate max-w-[140px]">
                              {exam.Subject}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {formatDateTime(sub.SubmittedAt)}
                        </td>
                        <td className="px-4 py-3">
                          {sub.SubmissionUrl ? (
                            <button
                              onClick={() => {
                                setPreviewPdfUrl(sub.SubmissionUrl);
                                setPreviewPdfTitle(`Submitted Booklet - ${sub.ExamId}`);
                              }}
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 bg-slate-100 px-2 py-1 rounded text-xs font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Booklet</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">No file</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {sub.Score !== undefined && sub.Score !== '' ? (
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                                {sub.Score} Marks
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Pending Grading</span>
                            )}
                            {sub.Feedback && (
                              <p className="text-[11px] text-slate-600 italic line-clamp-1 max-w-[160px]">
                                "{sub.Feedback}"
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {sub.GradedUrl ? (
                            <button
                              onClick={() => {
                                setSelectedCheckedSubmission(sub);
                                setSelectedCheckedExam(exam);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-[#009fe3] hover:bg-sky-100 border border-sky-200 font-bold text-xs transition-colors shadow-2xs"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-[#009fe3]" />
                              <span>See Checked Paper</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Awaiting checked PDF</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sub.Status === 'RECHECK_REQUESTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Under Recheck</span>
                            </span>
                          ) : sub.Status === 'RECHECK_RESOLVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Recheck Completed</span>
                            </span>
                          ) : sub.Score !== undefined && sub.Score !== '' ? (
                            <span className="text-[11px] text-slate-500 font-medium">Evaluation Published</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedCheckedSubmission(sub);
                                setSelectedCheckedExam(exam);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#009fe3] hover:bg-[#0088c4] text-white font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-1"
                              title="Ask doubts or apply for rechecking"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Doubts &amp; Recheck</span>
                              {doubtsCount > 0 && (
                                <span className="bg-white text-[#009fe3] rounded-full px-1.5 py-0.2 text-[9px] font-mono">
                                  {doubtsCount}
                                </span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Checked Paper, Doubts & Rechecking Modal */}
      {selectedCheckedSubmission && (
        <CheckedPaperModal
          isOpen={!!selectedCheckedSubmission}
          onClose={() => {
            setSelectedCheckedSubmission(null);
            setSelectedCheckedExam(undefined);
          }}
          submission={selectedCheckedSubmission}
          exam={selectedCheckedExam}
          onUpdate={() => {
            fetchData();
          }}
        />
      )}

      {/* Preview PDF Modal */}
      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={!!previewPdfUrl}
          onClose={() => setPreviewPdfUrl(null)}
          title={previewPdfTitle}
          pdfUrl={previewPdfUrl}
        />
      )}

      {/* Image To PDF Scanner Modal */}
      {imageToPdfOpen && (
        <ImageToPdfModal
          isOpen={imageToPdfOpen}
          onClose={() => setImageToPdfOpen(false)}
          onPdfGenerated={(pdfFile) => {
            setScannerSuccessToast(`PDF "${pdfFile.name}" compiled successfully (${(pdfFile.size / 1024 / 1024).toFixed(2)} MB). You can attach it during examination submission.`);
          }}
          candidateId={currentUser.UserId}
          candidateName={currentUser.Name}
        />
      )}
    </div>
  );
};
