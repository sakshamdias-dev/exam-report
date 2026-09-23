import React, { useState, useEffect, useRef } from 'react';
import { User, Exam, Submission, Doubt } from '../../types';
import { executeGasAction } from '../../services/api';
import { playTeacherDoubtBeepSound } from '../../utils/audioAlert';
import { 
  Calendar, 
  FileCheck, 
  ShieldAlert, 
  ShieldCheck,
  MessageSquareQuote, 
  Plus, 
  RefreshCw, 
  Users,
  Radio,
  Send,
  CheckCircle2,
  ExternalLink,
  Award,
  Eye,
  AlertCircle,
  Copy,
  Check,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CreateExamModal } from '../Teacher/CreateExamModal';
import { OsmWindow } from '../Teacher/OSM/OsmWindow';
import { OsmSessionData } from '../../types/osm';
import { saveGradedPaperStorage } from '../../utils/fileStorage';

interface MobileTeacherDashboardProps {
  currentUser: User;
  activeTab: string;
  onSelectTab?: (tab: string) => void;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
}

export const MobileTeacherDashboard: React.FC<MobileTeacherDashboardProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onTabChange,
  onLogout,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);

  // Selected submission for OSM evaluation
  const [evaluatingSubmission, setEvaluatingSubmission] = useState<Submission | null>(null);
  const [evaluatingExam, setEvaluatingExam] = useState<Exam | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('ALL');

  // Quick reply state for doubts
  const [quickReplyText, setQuickReplyText] = useState<{ [doubtId: string]: string }>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [copiedExamId, setCopiedExamId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [examsRes, subsRes, doubtsRes] = await Promise.all([
        executeGasAction('getAllExams', {}),
        executeGasAction('getSubmissions', {}),
        executeGasAction('getDoubts', {}),
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

      const allDoubts: Doubt[] = doubtsRes.data?.doubts || (doubtsRes as any).doubts || [];
      if (Array.isArray(allDoubts)) {
        setDoubts(allDoubts);
      }
    } catch (err) {
      console.warn('Error fetching teacher mobile dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLink = (examId: string) => {
    const url = `${window.location.origin}/?exam=${examId}`;
    navigator.clipboard.writeText(url);
    setCopiedExamId(examId);
    setTimeout(() => setCopiedExamId(null), 2000);
  };

  const handleSendDoubtReply = async (doubt: Doubt) => {
    const text = quickReplyText[doubt.DoubtId]?.trim();
    if (!text) return;
    setSendingReplyId(doubt.DoubtId);
    try {
      const res = await executeGasAction('answerDoubt', {
        doubtId: doubt.DoubtId,
        answer: text,
      });
      if (res.success) {
        setQuickReplyText((prev) => ({ ...prev, [doubt.DoubtId]: '' }));
        fetchData();
      } else {
        alert(res.error || 'Failed to reply to candidate question');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingReplyId(null);
    }
  };

  const handleSaveOsmEvaluation = async (
    studentId: string,
    examId: string,
    score: number | '',
    feedback: string,
    gradedPdfBase64: string,
    sessionData: OsmSessionData
  ): Promise<boolean> => {
    try {
      if (gradedPdfBase64) {
        try {
          await saveGradedPaperStorage(examId, studentId, gradedPdfBase64);
        } catch (storageErr) {
          console.warn('Could not cache evaluated booklet:', storageErr);
        }
      }

      const res = await executeGasAction('uploadGradedAnswerSheet', {
        studentId,
        examId,
        score: score !== '' ? Number(score) : undefined,
        feedback: feedback.trim(),
        gradedPdfBase64: gradedPdfBase64,
        osmDraftData: JSON.stringify(sessionData),
      });

      if (res.success) {
        fetchData();
        return true;
      } else {
        alert(`Failed to record evaluation: ${res.error || 'Server error'}`);
        return false;
      }
    } catch (err: any) {
      alert(`Error saving evaluation: ${err.message || err}`);
      return false;
    }
  };

  const openDoubts = doubts.filter((d) => d.Status === 'OPEN');
  const gradedCount = submissions.filter((s) => s.Status === 'GRADED').length;
  const pendingCount = submissions.filter((s) => s.Status !== 'GRADED').length;

  // Filtered submissions
  const filteredSubmissions = submissions.filter((sub) => {
    if (selectedExamFilter !== 'ALL' && sub.ExamId !== selectedExamFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        sub.StudentId.toLowerCase().includes(q) ||
        (sub.ExamId && sub.ExamId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleTabSelect = (tab: string) => {
    if (typeof onTabChange === 'function') onTabChange(tab);
    if (typeof onSelectTab === 'function') onSelectTab(tab);
  };

  return (
    <div className="w-full px-3.5 py-4 space-y-4">
      {/* 1. Mobile Faculty Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-orange-950 text-white p-4 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-[#f25f22] font-bold text-base">
              {currentUser.Name ? currentUser.Name.charAt(0).toUpperCase() : 'F'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                {currentUser.Name || currentUser.UserId}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-slate-300 font-mono">
                  ID: {currentUser.UserId}
                </span>
                <span className="text-[10px] bg-orange-500/20 px-1.5 py-0.2 rounded text-orange-300 border border-orange-400/30">
                  Faculty
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9, rotate: 180 }}
              onClick={fetchData}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* Faculty Metrics Row */}
        <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/10 text-center text-xs">
          <div className="bg-white/5 rounded-xl py-1.5 px-1 border border-white/5">
            <div className="text-base font-extrabold text-white">{exams.length}</div>
            <div className="text-[10px] text-slate-300">Exams</div>
          </div>
          <div className="bg-amber-500/20 rounded-xl py-1.5 px-1 border border-amber-400/30">
            <div className="text-base font-extrabold text-amber-300">{pendingCount}</div>
            <div className="text-[10px] text-amber-200">Pending OSM</div>
          </div>
          <div className="bg-emerald-500/20 rounded-xl py-1.5 px-1 border border-emerald-400/30">
            <div className="text-base font-extrabold text-emerald-300">{gradedCount}</div>
            <div className="text-[10px] text-emerald-200">Graded</div>
          </div>
        </div>
      </motion.div>

      {/* 2. TAB: EXAMS */}
      {activeTab === 'exams' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Examinations &amp; Schedules</h3>
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => setIsCreateExamOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Exam</span>
            </motion.button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-500" />
              Loading exams...
            </div>
          ) : exams.length === 0 ? (
            <div className="py-10 bg-white rounded-2xl border border-slate-200 text-center p-4">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No exams configured</p>
              <button
                type="button"
                onClick={() => setIsCreateExamOpen(true)}
                className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
              >
                Create First Exam
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam, idx) => {
                const subCount = submissions.filter((s) => s.ExamId === exam.ExamId).length;
                const isCopied = copiedExamId === exam.ExamId;

                return (
                  <motion.div
                    key={exam.ExamId || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                          {exam.ExamId}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">
                          {exam.Subject || exam.ExamId}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {exam.Subject ? `ID: ${exam.ExamId}` : 'General Assessment'} • Max Marks: {exam.TotalMarks || 100}
                        </p>
                      </div>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {subCount} Submissions
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-center justify-between">
                      <span>{Math.round((new Date(exam.EndTime).getTime() - new Date(exam.StartTime).getTime()) / 60000)} Mins Duration</span>
                      <span>
                        {new Date(exam.StartTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(exam.ExamId)}
                        className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExamFilter(exam.ExamId);
                          handleTabSelect('submissions');
                        }}
                        className="py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Review Papers</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: SUBMISSIONS & OSM EVALUATION */}
      {activeTab === 'submissions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">On-Screen Marking (OSM)</h3>
            <span className="text-xs text-slate-500 font-medium">
              {filteredSubmissions.length} Submissions
            </span>
          </div>

          {/* Search and Exam Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Student Roll or Exam ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {exams.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedExamFilter('ALL')}
                  className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                    selectedExamFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  All Exams
                </button>
                {exams.map((ex) => (
                  <button
                    key={ex.ExamId}
                    type="button"
                    onClick={() => setSelectedExamFilter(ex.ExamId)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                      selectedExamFilter === ex.ExamId
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {ex.ExamId}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submissions List */}
          {filteredSubmissions.length === 0 ? (
            <div className="py-10 bg-white rounded-2xl border border-slate-200 text-center p-4">
              <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No submissions found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Submissions from candidates will appear here for grading.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((sub, i) => {
                const isGraded = sub.Status === 'GRADED';
                const matchedExam = exams.find((e) => e.ExamId === sub.ExamId);

                return (
                  <motion.div
                    key={`${sub.ExamId}_${sub.StudentId}_${sub.SubmittedAt || i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {sub.StudentId}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            • {sub.ExamId}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-800 text-xs mt-1">
                          {matchedExam?.Subject || sub.ExamId}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Submitted: {sub.SubmittedAt ? new Date(sub.SubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recorded'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isGraded
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isGraded ? 'Graded' : 'Pending'}
                        </span>
                        {isGraded && (
                          <div className="text-xs font-bold text-slate-900 font-mono mt-1">
                            {sub.Score}/{matchedExam?.TotalMarks || 100}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEvaluatingSubmission(sub);
                        setEvaluatingExam(matchedExam || null);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors ${
                        isGraded
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-orange-600 hover:bg-orange-700 text-white animate-pulse'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{isGraded ? 'Re-evaluate / Review Marking' : 'Launch OSM Evaluation'}</span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB: LIVE PROCTOR */}
      {activeTab === 'proctor' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Anti-Cheat Live Monitor</h3>
            <span className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Surveillance Live
            </span>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="font-semibold text-xs">Live Examination Surveillance</span>
              </div>
              <span className="text-[10px] text-slate-400">Multi-tab &amp; Audio Watch</span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Student webcams, audio meters, tab-switch violations, and proctor commands stream in real-time.
            </p>

            <div className="pt-2">
              <div className="py-2 px-3 rounded-xl bg-white/10 text-sky-200 text-xs font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                <span>Real-time proctor surveillance active</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 text-sm">Automated Cheating Guardrails</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tab-switching detected and logged with timestamps</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Background audio decibel spike thresholding</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Camera feed required to enter exam room</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB: DOUBTS */}
      {activeTab === 'doubts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Candidate Exam Doubts</h3>
            <span className="text-xs text-slate-500 font-medium">
              {openDoubts.length} Unresolved
            </span>
          </div>

          {doubts.length === 0 ? (
            <div className="py-10 bg-white rounded-2xl border border-slate-200 text-center p-4">
              <MessageSquareQuote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No student doubts posted</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Questions asked by students during exams will ring here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {doubts.map((doubt) => {
                const isOpen = doubt.Status === 'OPEN';

                return (
                  <motion.div
                    key={doubt.DoubtId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl bg-white border p-4 shadow-xs space-y-3 ${
                      isOpen ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {doubt.StudentName || doubt.StudentId}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            • {doubt.ExamId}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium mt-1">
                          "{doubt.Question}"
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isOpen
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isOpen ? 'Open' : 'Answered'}
                      </span>
                    </div>

                    {doubt.Answer && (
                      <div className="bg-emerald-50 rounded-xl p-2 text-xs text-emerald-800 border border-emerald-100">
                        <span className="font-bold text-[10px] uppercase text-emerald-600 block">
                          Your Reply:
                        </span>
                        {doubt.Answer}
                      </div>
                    )}

                    {isOpen && (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={quickReplyText[doubt.DoubtId] || ''}
                          onChange={(e) =>
                            setQuickReplyText((prev) => ({
                              ...prev,
                              [doubt.DoubtId]: e.target.value,
                            }))
                          }
                          placeholder="Type quick reply to candidate..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendDoubtReply(doubt)}
                          disabled={sendingReplyId === doubt.DoubtId}
                          className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{sendingReplyId === doubt.DoubtId ? 'Sending...' : 'Send Reply'}</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* OSM Full Screen Evaluator Modal */}
      {evaluatingSubmission && evaluatingExam && (
        <OsmWindow
          isOpen={true}
          onClose={() => {
            setEvaluatingSubmission(null);
            setEvaluatingExam(null);
            fetchData();
          }}
          submission={evaluatingSubmission}
          exam={evaluatingExam}
          onSaveEvaluation={handleSaveOsmEvaluation}
        />
      )}

      {/* Create Exam Modal */}
      {isCreateExamOpen && (
        <CreateExamModal
          isOpen={true}
          onClose={() => setIsCreateExamOpen(false)}
          onSuccess={() => {
            setIsCreateExamOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
