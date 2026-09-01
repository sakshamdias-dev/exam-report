import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Award,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  FileCheck,
  Save,
} from 'lucide-react';
import { OsmQuestionScore, OSM_QUICK_COMMENTS } from '../../../types/osm';

interface OsmEvaluationPanelProps {
  isOpen: boolean;
  maxExamMarks: number;
  questionScores: OsmQuestionScore[];
  overallFeedback: string;
  isSaving: boolean;
  onToggle: () => void;
  onQuestionScoresChange: (scores: OsmQuestionScore[]) => void;
  onOverallFeedbackChange: (feedback: string) => void;
  onFinishChecking: () => void;
  onSaveDraft: () => void;
}

export const OsmEvaluationPanel: React.FC<OsmEvaluationPanelProps> = ({
  isOpen,
  maxExamMarks,
  questionScores,
  overallFeedback,
  isSaving,
  onToggle,
  onQuestionScoresChange,
  onOverallFeedbackChange,
  onFinishChecking,
  onSaveDraft,
}) => {
  const [activeTab, setActiveTab] = useState<'marks' | 'feedback'>('marks');

  // Calculate total awarded marks
  const totalAwardedMarks = questionScores.reduce((sum, q) => {
    if (typeof q.awardedMarks === 'number') {
      return sum + q.awardedMarks;
    }
    return sum;
  }, 0);

  const isOverMax = totalAwardedMarks > maxExamMarks;
  const percentage = maxExamMarks > 0 ? Math.round((totalAwardedMarks / maxExamMarks) * 100) : 0;

  const handleScoreChange = (id: string, val: string) => {
    const num: number | '' = val === '' ? '' : isNaN(Number(val)) ? '' : Math.max(0, Number(val));
    const updated = questionScores.map((q) => (q.id === id ? { ...q, awardedMarks: num } : q));
    onQuestionScoresChange(updated);
  };

  const handleMaxMarksChange = (id: string, val: string) => {
    const num = Math.max(1, Number(val) || 1);
    const updated = questionScores.map((q) => (q.id === id ? { ...q, maxMarks: num } : q));
    onQuestionScoresChange(updated);
  };

  const handleLabelChange = (id: string, label: string) => {
    const updated = questionScores.map((q) => (q.id === id ? { ...q, label } : q));
    onQuestionScoresChange(updated);
  };

  const handleAddQuestion = () => {
    const nextIdx = questionScores.length + 1;
    const newQ: OsmQuestionScore = {
      id: `q_${Date.now()}_${nextIdx}`,
      label: `Q${nextIdx}`,
      maxMarks: 10,
      awardedMarks: '',
    };
    onQuestionScoresChange([...questionScores, newQ]);
  };

  const handleRemoveQuestion = (id: string) => {
    if (questionScores.length <= 1) return;
    const updated = questionScores.filter((q) => q.id !== id);
    onQuestionScoresChange(updated);
  };

  const handleSetQuickScore = (id: string, score: number) => {
    const updated = questionScores.map((q) => (q.id === id ? { ...q, awardedMarks: score } : q));
    onQuestionScoresChange(updated);
  };

  const handleAppendQuickComment = (comment: string) => {
    if (!overallFeedback) {
      onOverallFeedbackChange(comment);
    } else {
      onOverallFeedbackChange(`${overallFeedback}\n• ${comment}`);
    }
  };

  return (
    <aside
      className={`bg-slate-900 border-l border-slate-800 transition-all duration-200 flex flex-col shrink-0 select-none z-20 ${
        isOpen ? 'w-72 sm:w-80' : 'w-10'
      }`}
    >
      {/* Header */}
      <div className="p-2.5 border-b border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={isOpen ? 'Collapse Evaluation Panel' : 'Expand Evaluation Panel'}
        >
          {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {isOpen && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Evaluation &amp; Marks</span>
          </div>
        )}
      </div>

      {!isOpen ? (
        <div className="flex-1 flex flex-col items-center py-4 gap-4 text-slate-400">
          <button
            type="button"
            onClick={onToggle}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono font-bold text-xs"
            title="Open Marks Panel"
          >
            {totalAwardedMarks}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
          {/* Top Score Summary Banner */}
          <div className="p-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Awarded Score</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span
                    className={`font-mono text-2xl font-black ${
                      isOverMax ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {totalAwardedMarks}
                  </span>
                  <span className="font-mono text-xs text-slate-400">/ {maxExamMarks}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Percentage</span>
                <div className="font-mono text-sm font-bold text-sky-400 mt-0.5">{percentage}%</div>
              </div>
            </div>

            {/* Warning if exceeded max marks */}
            {isOverMax && (
              <div className="mt-2 p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>Awarded marks ({totalAwardedMarks}) exceed maximum marks ({maxExamMarks})!</span>
              </div>
            )}
          </div>

          {/* Tab Navigation (Question Marks / Feedback) */}
          <div className="flex border-b border-slate-800 bg-slate-900/90 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('marks')}
              className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'marks'
                  ? 'border-sky-500 text-sky-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Question Marks ({questionScores.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('feedback')}
              className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'feedback'
                  ? 'border-sky-500 text-sky-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Feedback &amp; Remarks
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {activeTab === 'marks' ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-semibold uppercase">
                  <span>Question</span>
                  <span>Marks / Max</span>
                </div>

                <div className="space-y-2">
                  {questionScores.map((q) => (
                    <div
                      key={q.id}
                      className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/80 space-y-1.5 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Question label input */}
                        <input
                          type="text"
                          value={q.label}
                          onChange={(e) => handleLabelChange(q.id, e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-sky-500"
                        />

                        {/* Marks entry inputs */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max={q.maxMarks}
                            step="0.5"
                            placeholder="0"
                            value={q.awardedMarks !== undefined ? q.awardedMarks : ''}
                            onChange={(e) => handleScoreChange(q.id, e.target.value)}
                            className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-400 text-right focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-slate-500 font-mono">/</span>
                          <input
                            type="number"
                            min="1"
                            value={q.maxMarks}
                            onChange={(e) => handleMaxMarksChange(q.id, e.target.value)}
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-slate-400 text-right focus:outline-none focus:border-sky-500"
                          />

                          {questionScores.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(q.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors ml-0.5"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quick preset buttons */}
                      <div className="flex items-center gap-1 pt-1 border-t border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => handleSetQuickScore(q.id, 0)}
                          className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-700 rounded text-[10px] font-mono text-slate-300"
                          title="Award 0 marks"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetQuickScore(q.id, q.maxMarks / 2)}
                          className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-700 rounded text-[10px] font-mono text-slate-300"
                          title="Award half marks"
                        >
                          ½
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetQuickScore(q.id, q.maxMarks)}
                          className="px-1.5 py-0.5 bg-slate-900 hover:bg-emerald-950 hover:text-emerald-300 rounded text-[10px] font-mono text-slate-300 font-bold"
                          title="Award full marks"
                        >
                          Full ({q.maxMarks})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="w-full py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-sky-500 hover:bg-slate-800/60 text-slate-300 hover:text-sky-400 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question / Sub-Question</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>Evaluator Overall Remarks &amp; Feedback</span>
                  </label>
                  <textarea
                    rows={6}
                    value={overallFeedback}
                    onChange={(e) => onOverallFeedbackChange(e.target.value)}
                    placeholder="Enter general remarks, performance summary, or specific corrections for the candidate..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none font-sans leading-relaxed"
                  />
                </div>

                {/* Quick Feedback Suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Quick Comments:</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {OSM_QUICK_COMMENTS.map((qc, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAppendQuickComment(qc)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[11px] text-slate-300 text-left transition-colors"
                      >
                        {qc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action buttons */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
            <button
              type="button"
              onClick={onFinishChecking}
              disabled={isSaving}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>Finish Checking &amp; Save</span>
            </button>

            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-slate-400" />
              <span>{isSaving ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
