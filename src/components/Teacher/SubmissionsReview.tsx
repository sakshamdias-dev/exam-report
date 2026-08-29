import React, { useState } from 'react';
import { Submission, Exam } from '../../types';
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
  CheckCircle2
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';

interface SubmissionsReviewProps {
  submissions: Submission[];
  exams: Exam[];
  onRefresh: () => void;
}

export const SubmissionsReview: React.FC<SubmissionsReviewProps> = ({ submissions, exams, onRefresh }) => {
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Grading Modal State
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [scoreInput, setScoreInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [gradedFile, setGradedFile] = useState<File | null>(null);
  const [gradedFileBase64, setGradedFileBase64] = useState<string | null>(null);
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');

  // Filter submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesExam = selectedExamId === 'ALL' || sub.ExamId === selectedExamId;
    const matchesSearch =
      sub.StudentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.StudentName && sub.StudentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sub.ExamId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesExam && matchesSearch;
  });

  const handleOpenGrade = (sub: Submission) => {
    setGradingSubmission(sub);
    setScoreInput(sub.Score !== undefined && sub.Score !== null ? String(sub.Score) : '');
    setFeedbackInput(sub.Feedback || '');
    setGradedFile(null);
    setGradedFileBase64(null);
    setErrorMsg(null);
  };

  const handleGradedFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMsg('Only PDF files are supported for graded answer sheets.');
        return;
      }
      setErrorMsg(null);
      setGradedFile(file);
      try {
        const b64 = await fileToBase64(file);
        setGradedFileBase64(b64);
      } catch (err) {
        setErrorMsg('Error processing PDF file.');
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
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Exam Filter dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-xs">
            <Filter className="w-3.5 h-3.5 text-amber-700" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Examinations</option>
              {exams.map((ex) => (
                <option key={ex.ExamId} value={ex.ExamId}>
                  {ex.ExamId} - {ex.Subject || 'Exam'}
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
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium font-mono">
          Showing <strong className="text-slate-900">{filteredSubmissions.length}</strong> Candidate Submissions
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
                  <th className="px-5 py-3.5">Submission Timestamp</th>
                  <th className="px-5 py-3.5">Answer Booklet</th>
                  <th className="px-5 py-3.5">Marks / Status</th>
                  <th className="px-5 py-3.5">Graded Copy</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredSubmissions.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{sub.StudentName || sub.StudentId}</div>
                      <div className="text-[11px] font-mono text-indigo-700 font-semibold">{sub.StudentId}</div>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-amber-800">
                      {sub.ExamId}
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-mono text-[11px]">
                      {formatDateTime(sub.SubmittedAt)}
                    </td>
                    <td className="px-5 py-4">
                      {sub.SubmissionUrl ? (
                        <button
                          onClick={() => {
                            setPreviewPdfUrl(sub.SubmissionUrl);
                            setPreviewPdfTitle(`Answer Booklet - ${sub.StudentId} (${sub.ExamId})`);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold text-[11px] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect PDF</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No Booklet</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {sub.Score !== '' && sub.Score !== undefined ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                          <Award className="w-3 h-3" />
                          {sub.Score} Marks
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Pending Grading
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
                          <span>View Graded</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Not uploaded</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenGrade(sub)}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition-colors inline-flex items-center gap-1 min-h-[34px]"
                      >
                        <span>{sub.Score !== '' && sub.Score !== undefined ? 'Re-grade' : 'Grade'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grading Modal Dialog */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh] font-sans">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Grade Candidate Submission: <span className="font-mono text-amber-800">{gradingSubmission.StudentId}</span>
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

              {/* Candidate Answer preview button */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Candidate Answer Booklet PDF</div>
                  <div className="text-[11px] text-slate-500 font-mono">Submitted: {formatDateTime(gradingSubmission.SubmittedAt)}</div>
                </div>
                {gradingSubmission.SubmissionUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPdfUrl(gradingSubmission.SubmissionUrl);
                      setPreviewPdfTitle(`Student Answer Sheet - ${gradingSubmission.StudentId}`);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open Answer PDF</span>
                  </button>
                )}
              </div>

              {/* Score Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Numerical Marks Awarded
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="e.g. 88"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  required
                />
              </div>

              {/* Teacher Remarks / Feedback */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Evaluator Remarks &amp; Feedback
                </label>
                <textarea
                  rows={2}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Enter constructive remarks for the candidate..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Upload Graded PDF (Optional Annotated Copy) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Upload Annotated / Graded PDF (Optional)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">Evaluated Document Archive</span>
                </div>

                <label className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-amber-50/20 group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleGradedFileChange}
                    className="hidden"
                  />
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-amber-700 transition-colors mb-1.5" />
                  <span className="text-xs font-semibold text-slate-800">
                    {gradedFile ? gradedFile.name : 'Select Evaluated PDF'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Attach marked copy with evaluative remarks
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGrade}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 min-h-[42px]"
                >
                  {submittingGrade ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Marks...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save &amp; Publish Evaluation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={!!previewPdfUrl}
          onClose={() => setPreviewPdfUrl(null)}
          title={previewPdfTitle}
          pdfUrl={previewPdfUrl}
        />
      )}
    </div>
  );
};
