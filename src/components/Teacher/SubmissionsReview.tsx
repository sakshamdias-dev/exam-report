import React, { useState, useEffect } from 'react';
import { Submission, Exam, EvaluationDoubt } from '../../types';
import { executeGasAction, fileToBase64 } from '../../services/api';
import { 
  FileCheck, 
  UploadCloud, 
  FileText, 
  Eye, 
  Check, 
  Loader2, 
  Search, 
  Filter, 
  X, 
  Award, 
  MessageSquareQuote,
  CheckCircle2,
  Clock,
  RotateCcw,
  HelpCircle,
  Send,
  AlertCircle,
  PenTool,
  Sparkles,
  Lock,
  Unlock,
  Edit3,
  Download,
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';
import { OsmWindow } from './OSM/OsmWindow';
import { OsmSessionData } from '../../types/osm';
import { generateStudentBookletPdf } from '../../utils/osmPdfGenerator';

interface SubmissionsReviewProps {
  submissions: Submission[];
  exams: Exam[];
  onRefresh: () => void;
}

export const SubmissionsReview: React.FC<SubmissionsReviewProps> = ({ submissions, exams, onRefresh }) => {
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNGRADED' | 'RECHECK' | 'GRADED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // OSM Full-Screen Window State
  const [osmSubmission, setOsmSubmission] = useState<Submission | null>(null);
  const [osmExam, setOsmExam] = useState<Exam | null>(null);

  // Result Release action state
  const [releasingResults, setReleasingResults] = useState(false);
  const [releaseSuccessMsg, setReleaseSuccessMsg] = useState<string | null>(null);

  // Grading Modal State
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [scoreInput, setScoreInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [gradedFile, setGradedFile] = useState<File | null>(null);
  const [gradedFileBase64, setGradedFileBase64] = useState<string | null>(null);
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recheck Resolution Modal State
  const [recheckSubmission, setRecheckSubmission] = useState<Submission | null>(null);
  const [recheckRemarksInput, setRecheckRemarksInput] = useState<string>('');
  const [recheckScoreInput, setRecheckScoreInput] = useState<string>('');
  const [recheckFeedbackInput, setRecheckFeedbackInput] = useState<string>('');
  const [recheckGradedFile, setRecheckGradedFile] = useState<File | null>(null);
  const [recheckGradedFileBase64, setRecheckGradedFileBase64] = useState<string | null>(null);
  const [submittingRecheck, setSubmittingRecheck] = useState(false);
  const [recheckErrorMsg, setRecheckErrorMsg] = useState<string | null>(null);

  // Evaluation Doubt Reply State (inside recheck or grading)
  const [doubtReplies, setDoubtReplies] = useState<Record<string, string>>({});
  const [submittingDoubtId, setSubmittingDoubtId] = useState<string | null>(null);

  // PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');

  // Track draft statuses locally
  const [draftStatusMap, setDraftStatusMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check localStorage for active in-progress drafts
    const map: Record<string, boolean> = {};
    submissions.forEach((sub) => {
      try {
        const raw = localStorage.getItem(`osm_session_${sub.ExamId}_${sub.StudentId}`);
        if (raw) {
          const parsed: OsmSessionData = JSON.parse(raw);
          if (parsed && !parsed.isCompleted) {
            map[`${sub.ExamId}_${sub.StudentId}`] = true;
          }
        }
      } catch {}
    });
    setDraftStatusMap(map);
  }, [submissions]);

  // Counts for tabs
  const pendingRechecksCount = submissions.filter((s) => s.Status === 'RECHECK_REQUESTED').length;
  const unGradedCount = submissions.filter((s) => s.Score === undefined || s.Score === '').length;

  // Selected Exam Object
  const currentSelectedExam = exams.find((e) => e.ExamId === selectedExamId);

  // Filter submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesExam = selectedExamId === 'ALL' || sub.ExamId === selectedExamId;
    const matchesSearch =
      sub.StudentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.StudentName && sub.StudentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sub.ExamId.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'UNGRADED') {
      matchesStatus = sub.Score === undefined || sub.Score === '';
    } else if (statusFilter === 'RECHECK') {
      matchesStatus = sub.Status === 'RECHECK_REQUESTED';
    } else if (statusFilter === 'GRADED') {
      matchesStatus = sub.Score !== undefined && sub.Score !== '';
    }

    return matchesExam && matchesSearch && matchesStatus;
  });

  // Open OSM for a submission
  const handleOpenOsm = (sub: Submission) => {
    const matchedExam = exams.find((e) => e.ExamId === sub.ExamId) || {
      ExamId: sub.ExamId,
      Subject: 'Subject Examination',
      TotalMarks: 100,
      StartTime: new Date().toISOString(),
      EndTime: new Date().toISOString(),
      QPUrl: '',
      CreatedAt: new Date().toISOString(),
    };
    setOsmSubmission(sub);
    setOsmExam(matchedExam);
  };

  // Save OSM Evaluation Handler
  const handleSaveOsmEvaluation = async (
    studentId: string,
    examId: string,
    score: number | '',
    feedback: string,
    gradedPdfBase64: string,
    sessionData: OsmSessionData
  ): Promise<boolean> => {
    try {
      const res = await executeGasAction('uploadGradedAnswerSheet', {
        studentId,
        examId,
        score: score !== '' ? Number(score) : undefined,
        feedback: feedback.trim(),
        gradedPdfBase64: gradedPdfBase64,
        osmDraftData: JSON.stringify(sessionData),
      });

      if (res.success) {
        onRefresh();
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

  // Toggle Results Release
  const handleToggleResultsRelease = async (examId: string, currentReleased: boolean) => {
    try {
      setReleasingResults(true);
      setReleaseSuccessMsg(null);
      const res = await executeGasAction('toggleExamResultsRelease', {
        examId,
        resultsReleased: !currentReleased,
      });

      if (res.success) {
        setReleaseSuccessMsg(
          !currentReleased
            ? `Grades & checked answer booklets for Exam ${examId} are now PUBLISHED to students.`
            : `Results for Exam ${examId} have been unpublished (hidden from students).`
        );
        onRefresh();
      } else {
        alert(res.error || 'Failed to update results release status.');
      }
    } catch (e: any) {
      alert(`Error updating release status: ${e.message || e}`);
    } finally {
      setReleasingResults(false);
    }
  };

  const handleDirectDownloadBooklet = async (sub: Submission) => {
    try {
      const matchedExam = exams.find((e) => e.ExamId === sub.ExamId);
      let imagePages: string[] | undefined = undefined;
      if (sub.RawImages && sub.RawImages.length > 0) {
        imagePages = sub.RawImages;
      } else if (sub.ImageUrls && sub.ImageUrls.length > 0) {
        imagePages = sub.ImageUrls;
      } else {
        try {
          const cached = localStorage.getItem(`osm_student_images_${sub.ExamId}_${sub.StudentId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) imagePages = parsed;
          }
        } catch (e) {}
      }

      const bookletBlob = await generateStudentBookletPdf(
        sub.SubmissionUrl || '',
        imagePages,
        {
          studentId: sub.StudentId,
          studentName: sub.StudentName,
          examId: sub.ExamId,
          subject: matchedExam?.Subject,
        }
      );

      const blobUrl = URL.createObjectURL(bookletBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `AnswerBooklet_${sub.ExamId}_${sub.StudentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      alert(`Could not download booklet PDF: ${err.message || err}`);
    }
  };

  const handleOpenGrade = (sub: Submission) => {
    setGradingSubmission(sub);
    setScoreInput(sub.Score !== undefined && sub.Score !== null ? String(sub.Score) : '');
    setFeedbackInput(sub.Feedback || '');
    setGradedFile(null);
    setGradedFileBase64(null);
    setErrorMsg(null);
  };

  const handleOpenRecheck = (sub: Submission) => {
    setRecheckSubmission(sub);
    setRecheckScoreInput(sub.Score !== undefined && sub.Score !== null ? String(sub.Score) : '');
    setRecheckFeedbackInput(sub.Feedback || '');
    setRecheckRemarksInput(sub.RecheckRemarks || '');
    setRecheckGradedFile(null);
    setRecheckGradedFileBase64(null);
    setRecheckErrorMsg(null);
  };

  const handleGradedFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isRecheck = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        const msg = 'Only PDF files are supported for graded answer sheets.';
        if (isRecheck) setRecheckErrorMsg(msg);
        else setErrorMsg(msg);
        return;
      }
      if (isRecheck) {
        setRecheckErrorMsg(null);
        setRecheckGradedFile(file);
      } else {
        setErrorMsg(null);
        setGradedFile(file);
      }
      try {
        const b64 = await fileToBase64(file);
        if (isRecheck) setRecheckGradedFileBase64(b64);
        else setGradedFileBase64(b64);
      } catch (err) {
        const msg = 'Error processing PDF file.';
        if (isRecheck) setRecheckErrorMsg(msg);
        else setErrorMsg(msg);
      }
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    if (scoreInput === '' && !gradedFileBase64) {
      setErrorMsg('Please provide either a numerical score or upload an evaluated PDF booklet.');
      return;
    }

    setSubmittingGrade(true);
    setErrorMsg(null);

    try {
      const res = await executeGasAction('uploadGradedAnswerSheet', {
        studentId: gradingSubmission.StudentId,
        examId: gradingSubmission.ExamId,
        score: scoreInput !== '' ? Number(scoreInput) : undefined,
        feedback: feedbackInput.trim(),
        gradedPdfBase64: gradedFileBase64,
      });

      if (res.success) {
        setGradingSubmission(null);
        onRefresh();
      } else {
        setErrorMsg(res.error || 'Failed to submit evaluation.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while recording evaluation.');
    } finally {
      setSubmittingGrade(false);
    }
  };

  const handleResolveRecheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recheckSubmission) return;

    setSubmittingRecheck(true);
    setRecheckErrorMsg(null);

    try {
      const res = await executeGasAction('resolveRecheck', {
        studentId: recheckSubmission.StudentId,
        examId: recheckSubmission.ExamId,
        score: recheckScoreInput !== '' ? Number(recheckScoreInput) : undefined,
        feedback: recheckFeedbackInput.trim(),
        remarks: recheckRemarksInput.trim(),
        gradedPdfBase64: recheckGradedFileBase64,
      });

      if (res.success) {
        setRecheckSubmission(null);
        onRefresh();
      } else {
        setRecheckErrorMsg(res.error || 'Failed to resolve rechecking request.');
      }
    } catch (err: any) {
      setRecheckErrorMsg(err.message || 'Error occurred while saving rechecking resolution.');
    } finally {
      setSubmittingRecheck(false);
    }
  };

  const handleAnswerDoubtInline = async (doubt: EvaluationDoubt, submissionTarget: Submission) => {
    const answer = doubtReplies[doubt.DoubtId];
    if (!answer || !answer.trim()) return;

    setSubmittingDoubtId(doubt.DoubtId);
    try {
      const res = await executeGasAction('answerEvaluationDoubt', {
        doubtId: doubt.DoubtId,
        answer: answer.trim(),
        examId: submissionTarget.ExamId,
        studentId: submissionTarget.StudentId,
      });

      if (res.success) {
        setDoubtReplies((prev) => ({ ...prev, [doubt.DoubtId]: '' }));
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingDoubtId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
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
    <div className="space-y-4 font-sans">
      {/* Top Results Release Notification Toast */}
      {releaseSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{releaseSuccessMsg}</span>
          </div>
          <button
            onClick={() => setReleaseSuccessMsg(null)}
            className="text-[11px] font-bold text-emerald-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Exam-Specific Results Release Control Banner */}
      {selectedExamId !== 'ALL' && currentSelectedExam && (
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              currentSelectedExam.ResultsReleased
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {currentSelectedExam.ResultsReleased ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">
                  {currentSelectedExam.ExamId} - {currentSelectedExam.Subject || 'Examination'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  currentSelectedExam.ResultsReleased
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {currentSelectedExam.ResultsReleased ? 'Results Published' : 'Grades Unreleased'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentSelectedExam.ResultsReleased
                  ? 'Students can currently view their total marks, evaluator feedback, and checked PDF answer booklets.'
                  : 'Checked booklets and grades are kept strictly confidential until you release results.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleResultsRelease(currentSelectedExam.ExamId, !!currentSelectedExam.ResultsReleased)}
            disabled={releasingResults}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 ${
              currentSelectedExam.ResultsReleased
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {releasingResults ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : currentSelectedExam.ResultsReleased ? (
              <Lock className="w-3.5 h-3.5 text-slate-600" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{currentSelectedExam.ResultsReleased ? 'Unpublish Results' : 'Release Grades & Checked Papers'}</span>
          </button>
        </div>
      )}

      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Exam Filter dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-xs">
            <Filter className="w-3.5 h-3.5 text-[#009fe3]" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Examinations</option>
              {exams.map((ex) => (
                <option key={ex.ExamId} value={ex.ExamId}>
                  {ex.ExamId} - {ex.Subject || 'Exam'} {ex.ResultsReleased ? '(Published)' : '(Unreleased)'}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name or Roll ID..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#009fe3]/30 shadow-xs"
            />
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({submissions.length})
          </button>

          <button
            onClick={() => setStatusFilter('UNGRADED')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              statusFilter === 'UNGRADED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Needs Checking ({unGradedCount})
          </button>

          <button
            onClick={() => setStatusFilter('RECHECK')}
            className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
              statusFilter === 'RECHECK' ? 'bg-[#f25f22] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Recheck Requests</span>
            {pendingRechecksCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === 'RECHECK' ? 'bg-white text-[#f25f22]' : 'bg-[#f25f22] text-white'
              }`}>
                {pendingRechecksCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('GRADED')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              statusFilter === 'GRADED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Checked ({submissions.length - unGradedCount})
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      {filteredSubmissions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
          No student submissions match your filters.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Candidate Name &amp; ID</th>
                  <th className="px-5 py-3.5">Exam Code</th>
                  <th className="px-5 py-3.5">Submission Time</th>
                  <th className="px-5 py-3.5">Original Answer PDF</th>
                  <th className="px-5 py-3.5">Score &amp; Status</th>
                  <th className="px-5 py-3.5">Checked PDF</th>
                  <th className="px-5 py-3.5">Recheck &amp; Doubts</th>
                  <th className="px-5 py-3.5 text-right">Online Marking (OSM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredSubmissions.map((sub, idx) => {
                  const isRecheckRequested = sub.Status === 'RECHECK_REQUESTED';
                  const doubtsCount = sub.EvaluationDoubts?.length || 0;
                  const openDoubtsCount = sub.EvaluationDoubts?.filter((d) => d.Status === 'OPEN').length || 0;
                  const hasDraft = draftStatusMap[`${sub.ExamId}_${sub.StudentId}`];
                  const isChecked = !!sub.GradedUrl || (sub.Score !== '' && sub.Score !== undefined);

                  return (
                    <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${isRecheckRequested ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{sub.StudentName || sub.StudentId}</div>
                        <div className="text-[11px] font-mono text-[#009fe3] font-semibold">{sub.StudentId}</div>
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-800">
                        {sub.ExamId}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-[11px]">
                        {formatDateTime(sub.SubmittedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {sub.SubmissionUrl || (sub.RawImages && sub.RawImages.length > 0) || (sub.ImageUrls && sub.ImageUrls.length > 0) ? (
                            <>
                              <button
                                onClick={() => {
                                  if (sub.SubmissionUrl) {
                                    setPreviewPdfUrl(sub.SubmissionUrl);
                                    setPreviewPdfTitle(`Answer Booklet - ${sub.StudentId} (${sub.ExamId})`);
                                  } else {
                                    handleDirectDownloadBooklet(sub);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                                title="Inspect student answer booklet"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDirectDownloadBooklet(sub)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-semibold text-[11px] transition-colors cursor-pointer"
                                title="Download student answer booklet as PDF to local computer"
                              >
                                <Download className="w-3.5 h-3.5 text-sky-600" />
                                <span>PDF</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No Booklet</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {sub.Score !== '' && sub.Score !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            <Award className="w-3 h-3" />
                            {sub.Score} Marks
                          </span>
                        ) : hasDraft ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Draft Saved</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Unchecked
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {sub.GradedUrl ? (
                          <button
                            onClick={() => {
                              setPreviewPdfUrl(sub.GradedUrl!);
                              setPreviewPdfTitle(`Evaluated Booklet - ${sub.StudentId} (${sub.ExamId})`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold text-[11px] transition-colors"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>View Checked</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Awaiting check</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isRecheckRequested ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f25f22] text-white animate-pulse">
                              <RotateCcw className="w-3 h-3" />
                              <span>Recheck Requested</span>
                            </span>
                          ) : sub.Status === 'RECHECK_RESOLVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Rechecked</span>
                            </span>
                          ) : null}

                          {doubtsCount > 0 && (
                            <button
                              onClick={() => handleOpenRecheck(sub)}
                              className="text-[11px] font-semibold text-[#009fe3] hover:underline flex items-center gap-1"
                            >
                              <HelpCircle className="w-3 h-3" />
                              <span>{doubtsCount} Doubt(s) {openDoubtsCount > 0 ? `(${openDoubtsCount} open)` : ''}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {/* OSM Check Paper / Resume Checking / View Checked Paper Primary Actions */}
                          {isChecked ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewPdfUrl(sub.GradedUrl || sub.SubmissionUrl);
                                  setPreviewPdfTitle(`Checked Paper - ${sub.StudentId}`);
                                }}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>View Checked Paper</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenOsm(sub)}
                                className="p-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                                title="Re-open in OSM to edit annotations or adjust marks"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenGrade(sub)}
                                className="p-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                                title="Upload new offline checked PDF / change score"
                              >
                                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </div>
                          ) : hasDraft ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenOsm(sub)}
                                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors inline-flex items-center gap-1.5 min-h-[34px] cursor-pointer active:scale-95"
                                title="Resume existing in-progress paper marking session"
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                                <span>Resume Checking</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenGrade(sub)}
                                className="p-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                                title="Upload offline checked PDF directly"
                              >
                                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenOsm(sub)}
                                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-[#009fe3] hover:bg-[#0088c4] text-white shadow-xs transition-all inline-flex items-center gap-1.5 min-h-[34px] cursor-pointer active:scale-95"
                                title="Open Online Screen Marking (OSM) to annotate and grade student answer booklet"
                              >
                                <PenTool className="w-3.5 h-3.5" />
                                <span>Check Paper</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenGrade(sub)}
                                className="p-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center gap-1 min-h-[34px] cursor-pointer"
                                title="Upload offline checked PDF & enter marks directly"
                              >
                                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </div>
                          )}

                          {isRecheckRequested && (
                            <button
                              onClick={() => handleOpenRecheck(sub)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-[#f25f22] hover:bg-[#d84d14] text-white shadow-xs transition-colors inline-flex items-center gap-1 min-h-[34px]"
                              title="Resolve student recheck request"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OSM Full-Screen Window Modal */}
      {osmSubmission && osmExam && (
        <OsmWindow
          submission={osmSubmission}
          exam={osmExam}
          isOpen={!!osmSubmission}
          onClose={() => {
            setOsmSubmission(null);
            setOsmExam(null);
          }}
          onSaveEvaluation={handleSaveOsmEvaluation}
        />
      )}

      {/* Standard Grading / Manual Upload PDF Modal Dialog */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh] font-sans">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-100 text-[#009fe3]">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Grade Candidate Submission: <span className="font-mono text-[#009fe3]">{gradingSubmission.StudentId}</span>
                  </h3>
                  <p className="text-xs text-slate-500">Exam Code: {gradingSubmission.ExamId}</p>
                </div>
              </div>

              <button
                onClick={() => setGradingSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4 bg-white overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Candidate Answer preview & offline download buttons */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Candidate Answer Booklet</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">For offline / online grading</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">Submitted: {formatDateTime(gradingSubmission.SubmittedAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectDownloadBooklet(gradingSubmission)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Download candidate answer booklet as PDF to check on your computer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600" />
                    <span>Download Booklet (PDF)</span>
                  </button>

                  {gradingSubmission.SubmissionUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewPdfUrl(gradingSubmission.SubmissionUrl);
                        setPreviewPdfTitle(`Student Answer Sheet - ${gradingSubmission.StudentId}`);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-[#009fe3] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Score Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Awarded Score / Marks
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009fe3]/30"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                    Marks
                  </span>
                </div>
              </div>

              {/* Feedback Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Evaluator Remarks / Feedback
                </label>
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Provide remarks or feedback to help the student understand their evaluation..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#009fe3]/30 resize-none font-sans"
                />
              </div>

              {/* Upload Graded Booklet (Alternative to OSM) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Upload Checked / Annotated PDF Booklet (Optional)
                </label>
                <div className="border border-dashed border-slate-300 hover:border-[#009fe3] rounded-xl p-4 text-center bg-slate-50/50 hover:bg-sky-50/30 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleGradedFileChange(e, false)}
                    className="hidden"
                    id="graded-pdf-upload-input"
                  />
                  <label htmlFor="graded-pdf-upload-input" className="cursor-pointer block">
                    <UploadCloud className="w-6 h-6 text-[#009fe3] mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-slate-800 block">
                      {gradedFile ? gradedFile.name : 'Choose evaluated PDF file'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      PDF documents up to 50MB
                    </span>
                  </label>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors min-h-[36px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGrade}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#0088c4] disabled:opacity-50 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 min-h-[36px]"
                >
                  {submittingGrade ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Evaluation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recheck Resolution Modal Dialog */}
      {recheckSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh] font-sans">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-100 text-[#f25f22]">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Resolve Recheck Application: <span className="font-mono text-[#f25f22]">{recheckSubmission.StudentId}</span>
                  </h3>
                  <p className="text-xs text-slate-500">Exam: {recheckSubmission.ExamId}</p>
                </div>
              </div>

              <button
                onClick={() => setRecheckSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveRecheck} className="p-6 space-y-4 bg-white overflow-y-auto">
              {recheckErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {recheckErrorMsg}
                </div>
              )}

              {/* Student's reason & grounds for recheck */}
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800">
                    Candidate's Recheck Grounds:
                  </span>
                  <span className="font-mono text-[10px] text-amber-700">
                    Requested: {recheckSubmission.RecheckRequestedAt ? formatDateTime(recheckSubmission.RecheckRequestedAt) : 'Recent'}
                  </span>
                </div>
                <div className="font-semibold text-slate-900">
                  {recheckSubmission.RecheckGrounds || 'General Rechecking / Mark Verification'}
                </div>
                {recheckSubmission.RecheckReason && (
                  <p className="italic text-slate-700 bg-white/70 p-2 rounded border border-amber-200/60">
                    "{recheckSubmission.RecheckReason}"
                  </p>
                )}
              </div>

              {/* Doubt Inquiries linked to this paper */}
              {recheckSubmission.EvaluationDoubts && recheckSubmission.EvaluationDoubts.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-[#009fe3]" />
                    <span>Candidate Evaluation Inquiries &amp; Doubts ({recheckSubmission.EvaluationDoubts.length})</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recheckSubmission.EvaluationDoubts.map((d) => (
                      <div key={d.DoubtId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-slate-500">{d.DoubtId}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.Status === 'ANSWERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {d.Status}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-800">
                          {d.QuestionRef && <span className="font-mono text-[#009fe3] mr-1">[{d.QuestionRef}]:</span>}
                          {d.Question}
                        </div>

                        {d.Answer ? (
                          <div className="p-2 rounded bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-[11px]">
                            <strong className="block text-[10px] text-emerald-700">Faculty Reply:</strong>
                            {d.Answer}
                          </div>
                        ) : (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              placeholder="Type reply to candidate's inquiry..."
                              value={doubtReplies[d.DoubtId] || ''}
                              onChange={(e) => setDoubtReplies({ ...doubtReplies, [d.DoubtId]: e.target.value })}
                              className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#009fe3]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAnswerDoubtInline(d, recheckSubmission)}
                              disabled={submittingDoubtId === d.DoubtId}
                              className="px-2.5 py-1 bg-[#009fe3] hover:bg-[#0088c4] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                            >
                              {submittingDoubtId === d.DoubtId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              <span>Reply</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revised Score */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Revised / Confirmed Total Marks
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={recheckScoreInput}
                    onChange={(e) => setRecheckScoreInput(e.target.value)}
                    placeholder="Enter revised score..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f25f22]/30"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                    Marks
                  </span>
                </div>
              </div>

              {/* Recheck Official Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Recheck Decision &amp; Faculty Remarks
                </label>
                <textarea
                  rows={3}
                  value={recheckRemarksInput}
                  onChange={(e) => setRecheckRemarksInput(e.target.value)}
                  placeholder="Explain resolution (e.g., 'Marks corrected in Question 3 step 2', 'Original marks verified and upheld')..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f25f22]/30 resize-none font-sans"
                />
              </div>

              {/* Footer CTA */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecheckSubmission(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors min-h-[36px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecheck}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#f25f22] hover:bg-[#d84d14] disabled:opacity-50 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 min-h-[36px]"
                >
                  {submittingRecheck ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Publish Recheck Resolution</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal PDF Viewer Modal */}
      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={!!previewPdfUrl}
          pdfUrl={previewPdfUrl}
          title={previewPdfTitle}
          onClose={() => setPreviewPdfUrl(null)}
        />
      )}
    </div>
  );
};
