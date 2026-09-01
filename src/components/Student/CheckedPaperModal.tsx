import React, { useState } from 'react';
import { Submission, Exam, EvaluationDoubt } from '../../types';
import { executeGasAction } from '../../services/api';
import { 
  X, 
  FileCheck, 
  Eye, 
  MessageSquareQuote, 
  RotateCcw, 
  Send, 
  CheckCircle2, 
  Clock, 
  Award, 
  HelpCircle, 
  FileText, 
  AlertCircle, 
  ChevronRight,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';

interface CheckedPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission;
  exam?: Exam;
  onUpdate: () => void;
}

export const CheckedPaperModal: React.FC<CheckedPaperModalProps> = ({
  isOpen,
  onClose,
  submission,
  exam,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'paper' | 'doubts' | 'recheck'>('paper');
  
  // Doubts state
  const [doubtQuestion, setDoubtQuestion] = useState('');
  const [doubtPageRef, setDoubtPageRef] = useState('');
  const [doubtQuestionRef, setDoubtQuestionRef] = useState('');
  const [submittingDoubt, setSubmittingDoubt] = useState(false);
  const [doubtError, setDoubtError] = useState<string | null>(null);
  const [doubtSuccess, setDoubtSuccess] = useState<string | null>(null);

  // Rechecking state
  const [recheckGrounds, setRecheckGrounds] = useState('Totalling / Calculation Discrepancy');
  const [recheckReason, setRecheckReason] = useState('');
  const [submittingRecheck, setSubmittingRecheck] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [recheckSuccess, setRecheckSuccess] = useState<string | null>(null);

  // Fullscreen PDF Viewer
  const [fullscreenPdfUrl, setFullscreenPdfUrl] = useState<string | null>(null);
  const [fullscreenTitle, setFullscreenTitle] = useState('');

  if (!isOpen) return null;

  const evaluationDoubts: EvaluationDoubt[] = submission.EvaluationDoubts || [];
  const hasGradedPdf = !!submission.GradedUrl;
  const isRecheckPending = submission.Status === 'RECHECK_REQUESTED';
  const isRecheckResolved = submission.Status === 'RECHECK_RESOLVED';

  const handleSendDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtQuestion.trim()) {
      setDoubtError('Please enter your question or clarification.');
      return;
    }

    setSubmittingDoubt(true);
    setDoubtError(null);
    setDoubtSuccess(null);

    try {
      const res = await executeGasAction('createEvaluationDoubt', {
        studentId: submission.StudentId,
        examId: submission.ExamId,
        question: doubtQuestion.trim(),
        pageRef: doubtPageRef.trim(),
        questionRef: doubtQuestionRef.trim(),
      });

      if (res.success) {
        setDoubtQuestion('');
        setDoubtPageRef('');
        setDoubtQuestionRef('');
        setDoubtSuccess('Your evaluation doubt has been forwarded to the evaluator.');
        onUpdate();
      } else {
        setDoubtError(res.error || 'Failed to submit doubt.');
      }
    } catch (err: any) {
      setDoubtError(err.message || 'Error occurred while submitting doubt.');
    } finally {
      setSubmittingDoubt(false);
    }
  };

  const handleApplyRecheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recheckReason.trim()) {
      setRecheckError('Please describe the specific grounds and question details for rechecking.');
      return;
    }

    setSubmittingRecheck(true);
    setRecheckError(null);
    setRecheckSuccess(null);

    try {
      const res = await executeGasAction('requestRecheck', {
        studentId: submission.StudentId,
        examId: submission.ExamId,
        grounds: recheckGrounds,
        reason: recheckReason.trim(),
      });

      if (res.success) {
        setRecheckSuccess('Rechecking application registered successfully! Faculty has been notified.');
        onUpdate();
      } else {
        setRecheckError(res.error || 'Failed to apply for rechecking.');
      }
    } catch (err: any) {
      setRecheckError(err.message || 'Error occurred during rechecking application.');
    } finally {
      setSubmittingRecheck(false);
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh] font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
              <FileCheck className="w-5 h-5 text-[#009fe3]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  Evaluated Answer Booklet
                </h3>
                <span className="font-mono text-xs font-bold text-[#009fe3] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {submission.ExamId}
                </span>
                {isRecheckPending && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Recheck Under Review</span>
                  </span>
                )}
                {isRecheckResolved && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Recheck Completed</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {exam?.Subject || 'Subject Examination'} • Candidate ID: <span className="font-mono font-semibold">{submission.StudentId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score & Evaluation Summary Banner */}
        <div className="px-5 sm:px-6 py-3 bg-gradient-to-r from-sky-50/70 via-white to-amber-50/40 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[11px] text-slate-500 font-medium">Marks Awarded:</span>
              <div className="text-base font-extrabold text-slate-900 font-mono flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#f25f22]" />
                <span>{submission.Score !== '' && submission.Score !== undefined ? submission.Score : 'Pending'}</span>
                <span className="text-xs text-slate-400 font-normal">/ {exam?.TotalMarks || 100}</span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div>
              <span className="text-[11px] text-slate-500 font-medium">Evaluator Feedback:</span>
              <p className="text-xs text-slate-800 font-medium italic line-clamp-1 max-w-sm">
                {submission.Feedback ? `"${submission.Feedback}"` : 'No remarks provided'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {submission.GradedUrl ? (
              <button
                onClick={() => {
                  setFullscreenPdfUrl(submission.GradedUrl!);
                  setFullscreenTitle(`Evaluated Checked Paper - ${submission.ExamId}`);
                }}
                className="px-3 py-1.5 bg-[#009fe3] hover:bg-[#0088c4] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Fullscreen PDF</span>
              </button>
            ) : submission.SubmissionUrl ? (
              <button
                onClick={() => {
                  setFullscreenPdfUrl(submission.SubmissionUrl);
                  setFullscreenTitle(`Submitted Paper - ${submission.ExamId}`);
                }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Submitted Booklet</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-white px-6 gap-2 text-xs font-bold pt-2">
          <button
            onClick={() => setActiveTab('paper')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'paper'
                ? 'border-[#009fe3] text-[#009fe3]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Checked Paper Document</span>
          </button>

          <button
            onClick={() => setActiveTab('doubts')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'doubts'
                ? 'border-[#009fe3] text-[#009fe3]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Ask Evaluation Doubts</span>
            {evaluationDoubts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-800 font-mono">
                {evaluationDoubts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recheck')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'recheck'
                ? 'border-[#f25f22] text-[#f25f22]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Request Rechecking</span>
            {isRecheckPending && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping ml-1" />
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          
          {/* TAB 1: CHECKED PAPER PREVIEW */}
          {activeTab === 'paper' && (
            <div className="space-y-4">
              {hasGradedPdf ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Evaluated &amp; Annotated PDF Copy (Uploaded by Faculty)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Graded on: {formatDateTime(submission.SubmittedAt)}
                    </span>
                  </div>

                  {/* Embedded PDF iframe / preview */}
                  <div className="w-full h-[380px] bg-slate-900 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex flex-col items-center justify-center">
                    <iframe
                      src={submission.GradedUrl}
                      title="Evaluated Answer Sheet"
                      className="w-full h-full border-0"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-slate-500">
                      Have questions regarding deductions or markings? Switch to the <strong>Ask Evaluation Doubts</strong> tab or submit for <strong>Rechecking</strong>.
                    </p>
                    
                    <div className="flex items-center gap-2">
                      {submission.SubmissionUrl && (
                        <button
                          onClick={() => {
                            setFullscreenPdfUrl(submission.SubmissionUrl);
                            setFullscreenTitle(`Original Candidate Submission - ${submission.ExamId}`);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Compare Original Booklet</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setFullscreenPdfUrl(submission.GradedUrl!);
                          setFullscreenTitle(`Evaluated Booklet - ${submission.ExamId}`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#009fe3] hover:bg-[#0088c4] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Interactive Fullscreen Viewer</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Checked PDF Not Yet Uploaded</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      The evaluator has recorded your score ({submission.Score || 'Pending'} marks), but has not uploaded the marked PDF copy yet. You can still ask evaluation doubts or view your submitted booklet below.
                    </p>
                  </div>
                  {submission.SubmissionUrl && (
                    <button
                      onClick={() => {
                        setFullscreenPdfUrl(submission.SubmissionUrl);
                        setFullscreenTitle(`Submitted Booklet - ${submission.ExamId}`);
                      }}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-900 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Inspect My Submitted Answer Booklet</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASK EVALUATION DOUBTS */}
          {activeTab === 'doubts' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <HelpCircle className="w-4 h-4 text-[#009fe3]" />
                  <span>Submit Evaluation Doubt / Question on Checked Paper</span>
                </div>
                <p className="text-xs text-slate-500">
                  Ask the teacher for specific clarifications regarding marks deducted, step marks, or question assessment.
                </p>

                {doubtError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {doubtError}
                  </div>
                )}
                {doubtSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                    {doubtSuccess}
                  </div>
                )}

                <form onSubmit={handleSendDoubt} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Question Ref (e.g. Q3b, Question 4)
                      </label>
                      <input
                        type="text"
                        value={doubtQuestionRef}
                        onChange={(e) => setDoubtQuestionRef(e.target.value)}
                        placeholder="e.g. Question 2 (Part B)"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Page Reference in Booklet
                      </label>
                      <input
                        type="text"
                        value={doubtPageRef}
                        onChange={(e) => setDoubtPageRef(e.target.value)}
                        placeholder="e.g. Page 3, Step 4"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Your Question / Clarification Request *
                    </label>
                    <textarea
                      rows={3}
                      value={doubtQuestion}
                      onChange={(e) => setDoubtQuestion(e.target.value)}
                      placeholder="Explain your doubt clearly (e.g., 'In step 3 of Q2, my formula follows theorem 4.2. Could you please clarify why 3 marks were deducted?')"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingDoubt}
                      className="px-4 py-2 bg-[#009fe3] hover:bg-[#0088c4] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      {submittingDoubt ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending Doubt...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Transmit Doubt to Faculty</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Doubts Thread */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquareQuote className="w-4 h-4 text-slate-600" />
                  <span>Evaluation Doubt Q&amp;A History ({evaluationDoubts.length})</span>
                </div>

                {evaluationDoubts.length === 0 ? (
                  <div className="p-5 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-400">
                    No doubts submitted on this evaluation yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evaluationDoubts.map((d, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {d.QuestionRef && (
                              <span className="font-bold text-[#009fe3] bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px]">
                                {d.QuestionRef}
                              </span>
                            )}
                            {d.PageRef && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {d.PageRef}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            d.Status === 'ANSWERED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {d.Status === 'ANSWERED' ? 'Resolved by Evaluator' : 'Awaiting Faculty Response'}
                          </span>
                        </div>

                        {/* Student Question */}
                        <div className="p-2.5 rounded-lg bg-slate-50 text-slate-800 border border-slate-100 font-medium">
                          <span className="font-bold text-slate-900 block text-[11px] mb-0.5">Your Question:</span>
                          {d.Question}
                          <span className="block text-[10px] text-slate-400 mt-1 font-mono">{formatDateTime(d.CreatedAt)}</span>
                        </div>

                        {/* Teacher Response */}
                        {d.Answer ? (
                          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Faculty Response:</span>
                            </div>
                            <p className="text-xs font-medium">{d.Answer}</p>
                            {d.AnsweredAt && (
                              <span className="block text-[10px] text-emerald-700 mt-1 font-mono">
                                Answered: {formatDateTime(d.AnsweredAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-700 italic flex items-center gap-1 pl-1">
                            <Clock className="w-3 h-3" />
                            <span>Your doubt is queued with the faculty instructor.</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REQUEST RECHECKING */}
          {activeTab === 'recheck' && (
            <div className="space-y-4">
              {/* If already requested, show status card */}
              {isRecheckPending && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                    <span>Rechecking Application Under Active Review</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Your application for paper rechecking was registered on{' '}
                    <strong>{formatDateTime(submission.RecheckRequestedAt)}</strong>. Faculty has been assigned to re-verify your booklet evaluation.
                  </p>

                  <div className="p-3 rounded-xl bg-white/80 border border-amber-200 text-xs space-y-1.5 text-slate-800 font-medium">
                    <div>
                      <span className="text-slate-500">Selected Grounds:</span>{' '}
                      <strong>{submission.RecheckGrounds || 'General Evaluation Clarification'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Candidate Statement:</span>{' '}
                      <p className="italic mt-0.5 text-slate-700">"{submission.RecheckReason}"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* If recheck was completed */}
              {isRecheckResolved && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Rechecking Process Completed</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Faculty has re-evaluated your answer booklet and published final resolution on{' '}
                    <strong>{formatDateTime(submission.RecheckResolvedAt)}</strong>.
                  </p>

                  <div className="p-3.5 rounded-xl bg-white/90 border border-emerald-200 text-xs space-y-1.5 text-slate-800 font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Revised Marks Awarded:</span>
                      <span className="font-mono font-extrabold text-sm text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {submission.Score} / {exam?.TotalMarks || 100}
                      </span>
                    </div>
                    {submission.RecheckRemarks && (
                      <div>
                        <span className="text-slate-500">Faculty Recheck Remarks:</span>
                        <p className="italic text-slate-800 mt-0.5 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                          "{submission.RecheckRemarks}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recheck Application Form */}
              {!isRecheckPending && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <RotateCcw className="w-4 h-4 text-[#f25f22]" />
                    <span>Formal Paper Re-evaluation / Rechecking Request</span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    If you believe there is an unassessed step, formula evaluation discrepancy, or totalling error in your checked booklet, you may request an official faculty recheck.
                  </p>

                  {recheckError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {recheckError}
                    </div>
                  )}

                  {recheckSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                      {recheckSuccess}
                    </div>
                  )}

                  <form onSubmit={handleApplyRecheck} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Primary Grounds for Rechecking *
                      </label>
                      <select
                        value={recheckGrounds}
                        onChange={(e) => setRecheckGrounds(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer"
                      >
                        <option value="Totalling / Calculation Discrepancy">Totalling / Calculation Discrepancy</option>
                        <option value="Unassessed / Unmarked Answer Step">Unassessed / Unmarked Answer Step</option>
                        <option value="Formula & Derivation Rubric Clarification">Formula &amp; Derivation Rubric Clarification</option>
                        <option value="Alternate Valid Solution Method">Alternate Valid Solution Method</option>
                        <option value="General Discrepancy in Evaluation">General Discrepancy in Evaluation</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Detailed Rationale &amp; Question Reference *
                      </label>
                      <textarea
                        rows={3}
                        value={recheckReason}
                        onChange={(e) => setRecheckReason(e.target.value)}
                        placeholder="Specify the exact questions, page numbers, and reasons (e.g., 'On Page 2, Question 3(b) contains the complete proof but was uncredited with 0 marks. Totalling on Page 5 appears to sum to 74 instead of 70.')"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        required
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Note: Rechecking entails complete verification of arithmetic calculations and marked pages by faculty. Re-evaluated marks will supersede current records.
                      </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingRecheck}
                        className="px-5 py-2.5 bg-[#f25f22] hover:bg-[#d84d14] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 min-h-[40px]"
                      >
                        {submittingRecheck ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Submitting Application...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Apply for Official Rechecking</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>ExamFriendly Academic Assessment System</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Fullscreen PDF Viewer */}
      {fullscreenPdfUrl && (
        <PdfViewerModal
          isOpen={!!fullscreenPdfUrl}
          onClose={() => setFullscreenPdfUrl(null)}
          title={fullscreenTitle}
          pdfUrl={fullscreenPdfUrl}
        />
      )}
    </div>
  );
};
