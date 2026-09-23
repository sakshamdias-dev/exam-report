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
  Sparkles,
  Lock,
  Unlock,
  Radio,
  PlayCircle,
  AlertTriangle,
  Camera,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PdfViewerModal } from '../PdfViewerModal';
import { ImageToPdfModal } from '../Student/ImageToPdfModal';
import { CheckedPaperModal } from '../Student/CheckedPaperModal';

interface MobileStudentDashboardProps {
  currentUser: User;
  onEnterExam: (exam: Exam) => void;
  activeTab: string;
  onSelectTab?: (tab: string) => void;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
}

export const MobileStudentDashboard: React.FC<MobileStudentDashboardProps> = ({
  currentUser,
  onEnterExam,
  activeTab,
  onSelectTab,
  onTabChange,
  onLogout,
}) => {
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'PAST'>('ALL');

  // Modals
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [imageToPdfOpen, setImageToPdfOpen] = useState(false);
  const [selectedCheckedSubmission, setSelectedCheckedSubmission] = useState<Submission | null>(null);
  const [selectedCheckedExam, setSelectedCheckedExam] = useState<Exam | undefined>(undefined);

  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);
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
    } catch (err) {
      console.warn('Error fetching student mobile dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser.UserId]);

  // Group membership
  const assignedGroupIds = studentGroups
    .filter((g) => g.StudentIds && g.StudentIds.includes(currentUser.UserId))
    .map((g) => g.GroupId);

  const myExams = allExams.filter((exam) => {
    if (exam.AssignmentType === 'ALL' || !exam.AssignmentType) return true;
    if (exam.AssignmentType === 'STUDENTS') {
      return exam.AssignedStudents?.includes(currentUser.UserId);
    }
    if (exam.AssignmentType === 'GROUPS') {
      return exam.AssignedGroups?.some((gid) => assignedGroupIds.includes(gid));
    }
    if (!exam.AssignedGroups || exam.AssignedGroups.length === 0) return true;
    return exam.AssignedGroups.some((gid) => assignedGroupIds.includes(gid));
  });

  const getExamState = (exam: Exam) => {
    const sub = submissions.find((s) => s.ExamId === exam.ExamId);
    if (sub) {
      return { status: 'SUBMITTED', label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    const start = new Date(exam.StartTime).getTime();
    const end = new Date(exam.EndTime).getTime();
    if (currentTime >= start && currentTime <= end) {
      return { status: 'ACTIVE', label: 'Live Now', color: 'bg-rose-50 text-rose-600 border-rose-200' };
    }
    if (currentTime < start) {
      return { status: 'UPCOMING', label: 'Scheduled', color: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    return { status: 'PAST', label: 'Ended', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  const filteredExams = myExams.filter((exam) => {
    if (filterCategory === 'ALL') return true;
    const state = getExamState(exam);
    if (filterCategory === 'ACTIVE') return state.status === 'ACTIVE';
    if (filterCategory === 'UPCOMING') return state.status === 'UPCOMING';
    if (filterCategory === 'PAST') return state.status === 'PAST' || state.status === 'SUBMITTED';
    return true;
  });

  const activeCount = myExams.filter((e) => getExamState(e).status === 'ACTIVE').length;
  const gradedSubmissions = submissions.filter((s) => s.Status === 'GRADED' && s.Score !== undefined);

  return (
    <div className="w-full px-3.5 py-4 space-y-4">
      {/* 1. Candidate Mobile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white p-4 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 font-bold text-base">
              {currentUser.Name ? currentUser.Name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                {currentUser.Name || currentUser.UserId}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-sky-300 font-mono">
                  ID: {currentUser.UserId}
                </span>
                <span className="text-[10px] bg-sky-400/20 px-1.5 py-0.2 rounded text-sky-200 border border-sky-300/30">
                  Candidate
                </span>
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition-colors"
            title="Refresh Schedule"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {/* Quick Mobile Metrics Row */}
        <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/10 text-center text-xs">
          <div className="bg-white/5 rounded-xl py-1.5 px-1 border border-white/5">
            <div className="text-base font-extrabold text-white">{myExams.length}</div>
            <div className="text-[10px] text-slate-300">Total Exams</div>
          </div>
          <div className="bg-rose-500/20 rounded-xl py-1.5 px-1 border border-rose-400/30">
            <div className="text-base font-extrabold text-rose-300 flex items-center justify-center gap-1">
              {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />}
              {activeCount}
            </div>
            <div className="text-[10px] text-rose-200">Live Now</div>
          </div>
          <div className="bg-emerald-500/20 rounded-xl py-1.5 px-1 border border-emerald-400/30">
            <div className="text-base font-extrabold text-emerald-300">{gradedSubmissions.length}</div>
            <div className="text-[10px] text-emerald-200">Results In</div>
          </div>
        </div>
      </motion.div>

      {/* 2. TAB: EXAMS */}
      {activeTab === 'exams' && (
        <div className="space-y-3">
          {/* Horizontal Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Exams' },
              { id: 'ACTIVE', label: `Live (${activeCount})` },
              { id: 'UPCOMING', label: 'Scheduled' },
              { id: 'PAST', label: 'Completed' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  filterCategory === cat.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Exam Cards List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
              Loading your examinations...
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="py-10 bg-white rounded-2xl border border-slate-200 text-center p-4">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No exams in this category</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Check back later or view all exams</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExams.map((exam, i) => {
                const state = getExamState(exam);
                const isLive = state.status === 'ACTIVE';
                const sub = submissions.find((s) => s.ExamId === exam.ExamId);

                return (
                  <motion.div
                    key={exam.ExamId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl bg-white border p-4 shadow-xs space-y-3 transition-all ${
                      isLive ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${state.color}`}>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                          {state.label}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">
                          {exam.Subject || exam.ExamId}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {exam.Subject ? `ID: ${exam.ExamId}` : 'General Assessment'} • Max Marks: {exam.TotalMarks || 100}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-slate-700">
                          {Math.round((new Date(exam.EndTime).getTime() - new Date(exam.StartTime).getTime()) / 60000)} Mins
                        </div>
                        <span className="text-[10px] text-slate-400">Duration</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(exam.StartTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(exam.StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(exam.EndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      {sub ? (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Submitted
                          </span>
                          {sub.Status === 'GRADED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCheckedSubmission(sub);
                                setSelectedCheckedExam(exam);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
                            >
                              Score: {sub.Score}/{exam.TotalMarks || 100} • View
                            </button>
                          )}
                        </div>
                      ) : isLive ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => onEnterExam(exam)}
                          className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors animate-pulse"
                        >
                          <PlayCircle className="w-4 h-4" />
                          <span>START EXAMINATION NOW</span>
                        </motion.button>
                      ) : state.status === 'UPCOMING' ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Scheduled (Room Locked)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed"
                        >
                          <span>Assessment Concluded</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Graded Answer Sheets &amp; Results</h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {gradedSubmissions.length} Papers Evaluated
            </span>
          </div>

          {gradedSubmissions.length === 0 ? (
            <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center p-4">
              <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No graded results yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Evaluations will appear here once teachers complete On-Screen Marking.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {gradedSubmissions.map((sub, idx) => {
                const matchedExam = allExams.find((e) => e.ExamId === sub.ExamId);
                const score = Number(sub.Score) || 0;
                const total = matchedExam?.TotalMarks || 100;
                const percent = Math.round((score / total) * 100);

                return (
                  <motion.div
                    key={`${sub.ExamId}_${sub.SubmittedAt || idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Graded &amp; Verified
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5">
                          {matchedExam?.Subject || sub.ExamId}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          ID: {sub.ExamId}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-extrabold text-slate-900 font-mono">
                          {score}
                          <span className="text-xs text-slate-400 font-normal">/{total}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-600">
                          {percent}%
                        </span>
                      </div>
                    </div>

                    {sub.Feedback && (
                      <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 border border-slate-200">
                        <span className="font-semibold text-slate-900 block text-[10px] uppercase text-slate-400">
                          Evaluator Remarks
                        </span>
                        {sub.Feedback}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCheckedSubmission(sub);
                        setSelectedCheckedExam(matchedExam);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Evaluated Answer Sheet (PDF)</span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB: SCANNER */}
      {activeTab === 'scanner' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-sky-700 text-white p-5 text-center space-y-3 shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Mobile Camera Answer Sheet Compiler
              </h3>
              <p className="text-xs text-sky-100 max-w-xs mx-auto mt-1 leading-relaxed">
                Take photos of your physical handwritten answer sheet pages, rotate, order, and compile a crisp A4 PDF booklet.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => setImageToPdfOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-white text-blue-700 font-bold text-xs shadow-md flex items-center justify-center gap-2 hover:bg-sky-50 transition-colors"
            >
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Launch Camera / PDF Compiler</span>
            </motion.button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 text-sm">Scanner Tips for High Clarity</h4>
            <ul className="space-y-2 list-disc list-inside">
              <li>Place answer sheets on a flat, well-lit surface.</li>
              <li>Avoid shadows from your phone or hand.</li>
              <li>Review each page before compiling into the final PDF.</li>
              <li>Once generated, save the PDF to your device for exam submission.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 5. TAB: PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Student Profile Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-bold text-slate-800">{currentUser.Name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Roll / Candidate ID:</span>
                <span className="font-mono font-bold text-slate-800">{currentUser.UserId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Role:</span>
                <span className="font-semibold text-sky-600 uppercase">Student Candidate</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Assigned Groups:</span>
                <span className="font-medium text-slate-800">
                  {assignedGroupIds.length > 0 ? assignedGroupIds.join(', ') : 'All Batches'}
                </span>
              </div>
            </div>
          </div>

          {onLogout && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <h4 className="font-bold text-slate-800 text-sm">Account Session</h4>
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
              >
                <span>Log Out of Session</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Embedded Modals */}
      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={true}
          pdfUrl={previewPdfUrl}
          title={previewPdfTitle}
          onClose={() => setPreviewPdfUrl(null)}
        />
      )}

      {imageToPdfOpen && (
        <ImageToPdfModal
          isOpen={true}
          onClose={() => setImageToPdfOpen(false)}
          onPdfGenerated={(_dataUri) => {
            setImageToPdfOpen(false);
          }}
        />
      )}

      {selectedCheckedSubmission && (
        <CheckedPaperModal
          isOpen={true}
          onClose={() => setSelectedCheckedSubmission(null)}
          submission={selectedCheckedSubmission}
          exam={selectedCheckedExam}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};
