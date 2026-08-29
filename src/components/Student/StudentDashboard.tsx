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
  Users
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';
import { ImageToPdfModal } from './ImageToPdfModal';

interface StudentDashboardProps {
  currentUser: User;
  onEnterExam: (exam: Exam) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, onEnterExam }) => {
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');

  // Image to PDF Scanner Modal
  const [imageToPdfOpen, setImageToPdfOpen] = useState(false);
  const [scannerSuccessToast, setScannerSuccessToast] = useState<string | null>(null);

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
  const myExams = allExams.filter((exam) => {
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

  const getExamStatus = (startTime: string, endTime: string) => {
    const now = Date.now();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    if (now < start) {
      return { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (now > end) {
      return { label: 'Concluded', color: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
    return { label: 'Active Examination', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse' };
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

      {/* Scheduled Examinations Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">Assigned Examinations Roster</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono font-medium">{myExams.length} Courses Assigned</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-lg border border-slate-200 shadow-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-700" />
            Loading examinations schedule...
          </div>
        ) : myExams.length === 0 ? (
          <div className="p-8 rounded-lg bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
            No examinations currently assigned to your candidate ID or cohort group.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myExams.map((exam) => {
              const status = getExamStatus(exam.StartTime, exam.EndTime);
              const submission = submissions.find((s) => s.ExamId === exam.ExamId);
              const isSubmitted = !!submission;
              const isOngoing = status.label === 'Active Examination';

              return (
                <div
                  key={exam.ExamId}
                  className="rounded-lg bg-white border border-slate-200 p-4 flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all shadow-xs space-y-3.5 text-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {exam.ExamId}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                        {exam.Subject || 'General Examination'}
                      </h4>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>Total Marks: <strong className="text-slate-800">{exam.TotalMarks || 100}</strong></span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded border border-slate-200/80 font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Start:</span>
                        <span className="font-mono text-[11px] text-slate-800">{formatDateTime(exam.StartTime)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">End:</span>
                        <span className="font-mono text-[11px] text-slate-800">{formatDateTime(exam.EndTime)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    {isSubmitted ? (
                      <div className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Submitted</span>
                        </div>
                        {submission.Score !== undefined && submission.Score !== '' ? (
                          <span className="font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">
                            Marks: {submission.Score} / {exam.TotalMarks || 100}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 italic">Under Evaluation</span>
                        )}
                      </div>
                    ) : isOngoing ? (
                      <button
                        onClick={() => onEnterExam(exam)}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Enter Live Exam Console</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : status.label === 'Scheduled' ? (
                      <button
                        onClick={() => onEnterExam(exam)}
                        className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Open Exam Console</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="text-center py-1.5 text-xs text-slate-400 font-medium">
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
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Submission &amp; Evaluation Transcript</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono font-medium">{submissions.length} Submissions Logged</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Exam ID</th>
                    <th className="px-4 py-2.5">Submitted At</th>
                    <th className="px-4 py-2.5">Answer Document</th>
                    <th className="px-4 py-2.5">Marks Awarded</th>
                    <th className="px-4 py-2.5">Evaluator Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {submissions.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-900">
                        {sub.ExamId}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                        {formatDateTime(sub.SubmittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {sub.SubmissionUrl ? (
                          <button
                            onClick={() => {
                              setPreviewPdfUrl(sub.SubmissionUrl);
                              setPreviewPdfTitle(`Submission - ${sub.ExamId}`);
                            }}
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Submitted PDF</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">No document file</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.Score !== undefined && sub.Score !== '' ? (
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {sub.Score}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Pending Marks</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {sub.Feedback || <span className="text-slate-400 italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
