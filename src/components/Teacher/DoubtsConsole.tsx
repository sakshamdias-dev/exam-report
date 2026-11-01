import React, { useState, useEffect, useRef } from 'react';
import { Doubt, Exam } from '../../types';
import { executeGasAction } from '../../services/api';
import { MessageSquareQuote, Send, CheckCircle2, Clock, Filter, RefreshCw, Loader2, User, Bell, Volume2, X } from 'lucide-react';
import { playTeacherDoubtBeepSound } from '../../utils/audioAlert';

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

  // Sound alert & new doubt popup state
  const [newDoubtAlert, setNewDoubtAlert] = useState<{
    id: string;
    studentName: string;
    question: string;
    examId?: string;
    timestamp: string;
  } | null>(null);
  const knownDoubtIdsRef = useRef<Set<string>>(new Set());
  const isInitialFetchRef = useRef<boolean>(true);

  const fetchDoubts = async () => {
    try {
      const res = await executeGasAction('getDoubts', {
        examId: selectedExamId !== 'ALL' ? selectedExamId : undefined,
      });

      const fetchedDoubts: Doubt[] = res.data?.doubts || (res as any).doubts || [];

      if (Array.isArray(fetchedDoubts)) {
        if (isInitialFetchRef.current) {
          // Record existing doubts so we don't alert for old ones on page load
          fetchedDoubts.forEach((d) => knownDoubtIdsRef.current.add(d.DoubtId));
          isInitialFetchRef.current = false;
        } else {
          // Check for newly arrived open doubts
          const newlyArrived = fetchedDoubts.filter(
            (d) => !knownDoubtIdsRef.current.has(d.DoubtId) && d.Status === 'OPEN'
          );

          if (newlyArrived.length > 0) {
            const latest = newlyArrived[newlyArrived.length - 1];
            // Play teacher beep sound
            playTeacherDoubtBeepSound();
            // Show alert popup
            setNewDoubtAlert({
              id: latest.DoubtId,
              studentName: latest.StudentName || latest.StudentId || 'Student',
              question: latest.Question,
              examId: latest.ExamId,
              timestamp: new Date().toLocaleTimeString(),
            });
          }

          // Update known doubts list
          fetchedDoubts.forEach((d) => knownDoubtIdsRef.current.add(d.DoubtId));
        }

        setDoubts(fetchedDoubts);
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
    <div className="space-y-4 font-sans relative">
      {/* Real-time New Doubt Alert Popup with Audio Notification */}
      {newDoubtAlert && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-pink-500/40 p-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
                <Volume2 className="w-4 h-4 animate-bounce" />
              </span>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-pink-400 font-bold block">
                  New Doubt Raised
                </span>
                <span className="text-xs font-bold text-white">
                  {newDoubtAlert.studentName}
                </span>
              </div>
            </div>
            <button
              onClick={() => setNewDoubtAlert(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50 text-xs text-slate-200 line-clamp-2">
            &ldquo;{newDoubtAlert.question}&rdquo;
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
            <span>{newDoubtAlert.timestamp}</span>
            <button
              onClick={() => {
                setStatusFilter('OPEN');
                setNewDoubtAlert(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Review Query
            </button>
          </div>
        </div>
      )}

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
