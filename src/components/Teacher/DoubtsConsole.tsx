import React, { useState, useEffect } from 'react';
import { Doubt, Exam } from '../../types';
import { executeGasAction } from '../../services/api';
import { MessageSquareQuote, Send, CheckCircle2, Clock, Filter, RefreshCw, Loader2, User } from 'lucide-react';

interface DoubtsConsoleProps {
  exams: Exam[];
}

export const DoubtsConsole: React.FC<DoubtsConsoleProps> = ({ exams }) => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'ANSWERED'>('ALL');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchDoubts = async () => {
    try {
      const res = await executeGasAction('getDoubts', {
        examId: selectedExamId !== 'ALL' ? selectedExamId : undefined,
      });

      if (res.success && res.data?.doubts) {
        setDoubts(res.data.doubts);
      } else if (res.success && (res as any).doubts) {
        setDoubts((res as any).doubts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDoubts();
    let doubtsChan: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        doubtsChan = new BroadcastChannel('examfriendly_doubts_sync_v1');
        doubtsChan.onmessage = () => {
          fetchDoubts();
        };
      }
    } catch (e) {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'examfriendly_doubts_v1' || e.key === 'exam_portal_doubts') {
        fetchDoubts();
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(fetchDoubts, 2000);
    return () => {
      clearInterval(interval);
      if (doubtsChan) doubtsChan.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [selectedExamId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDoubts();
  };

  const handleSendReply = async (doubtId: string) => {
    const answer = replyTextMap[doubtId]?.trim();
    if (!answer) return;

    setSubmittingId(doubtId);
    try {
      const res = await executeGasAction('answerDoubt', {
        doubtId,
        answer,
      });

      if (res.success) {
        setReplyTextMap((prev) => ({ ...prev, [doubtId]: '' }));
        fetchDoubts();
      } else {
        alert(res.error || 'Failed to reply to candidate inquiry.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while sending response.');
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredDoubts = doubts.filter((d) => {
    const matchesStatus = statusFilter === 'ALL' || d.Status === statusFilter;
    return matchesStatus;
  });

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Exam dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-xs">
            <Filter className="w-3.5 h-3.5 text-pink-600" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Examinations</option>
              {exams.map((ex) => (
                <option key={ex.ExamId} value={ex.ExamId}>
                  {ex.ExamId}
                </option>
              ))}
            </select>
          </div>

          {/* Status buttons */}
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 text-xs shadow-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'ALL' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 font-medium'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'OPEN' ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200' : 'text-slate-500 font-medium'
              }`}
            >
              Pending Reply
            </button>
            <button
              onClick={() => setStatusFilter('ANSWERED')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                statusFilter === 'ANSWERED' ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' : 'text-slate-500 font-medium'
              }`}
            >
              Answered
            </button>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 disabled:opacity-50 shadow-xs min-h-[36px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Inquiries</span>
        </button>
      </div>

      {/* Doubts Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-pink-600" />
          Loading candidate inquiries...
        </div>
      ) : filteredDoubts.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
          No student inquiries matching current criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDoubts.map((doubt) => (
            <div
              key={doubt.DoubtId}
              className={`rounded-2xl border p-5 space-y-3.5 flex flex-col justify-between shadow-xs transition-all bg-white ${
                doubt.Status === 'OPEN'
                  ? 'border-pink-300 ring-1 ring-pink-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-800">{doubt.ExamId}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-800 font-bold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-700" />
                      {doubt.StudentName || doubt.StudentId}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      doubt.Status === 'OPEN'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {doubt.Status === 'OPEN' ? 'Awaiting Clarification' : 'Answered'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Candidate Question:</div>
                  <p className="text-xs text-slate-900 font-medium leading-relaxed">{doubt.Question}</p>
                  <div className="text-[10px] text-slate-400 mt-2 font-mono">
                    Raised at: {formatTime(doubt.CreatedAt)}
                  </div>
                </div>

                {doubt.Answer && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] uppercase font-bold text-emerald-800 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Faculty Clarification Provided:
                    </div>
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed">{doubt.Answer}</p>
                  </div>
                )}
              </div>

              {/* Reply Box */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyTextMap[doubt.DoubtId] || ''}
                    onChange={(e) =>
                      setReplyTextMap((prev) => ({ ...prev, [doubt.DoubtId]: e.target.value }))
                    }
                    placeholder={doubt.Answer ? 'Revise answer...' : 'Type official clarification...'}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 min-h-[40px]"
                  />
                  <button
                    onClick={() => handleSendReply(doubt.DoubtId)}
                    disabled={submittingId === doubt.DoubtId || !replyTextMap[doubt.DoubtId]?.trim()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-xs min-h-[40px]"
                  >
                    {submittingId === doubt.DoubtId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{doubt.Answer ? 'Update' : 'Reply'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
