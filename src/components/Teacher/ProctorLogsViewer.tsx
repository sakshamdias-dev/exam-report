import React, { useState, useEffect } from 'react';
import { ProctorLog, Exam } from '../../types';
import { executeGasAction } from '../../services/api';
import { ShieldAlert, Search, Filter, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, Shield, Eye, Lock } from 'lucide-react';

interface ProctorLogsViewerProps {
  exams: Exam[];
}

export const ProctorLogsViewer: React.FC<ProctorLogsViewerProps> = ({ exams }) => {
  const [logs, setLogs] = useState<ProctorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [selectedActionType, setSelectedActionType] = useState<string>('ALL');
  const [searchStudent, setSearchStudent] = useState<string>('');

  const fetchLogs = async () => {
    try {
      const res = await executeGasAction('getProctorLogs', {
        examId: selectedExamId !== 'ALL' ? selectedExamId : undefined,
      });

      if (res.success && res.data?.logs) {
        setLogs(res.data.logs);
      } else if (res.success && (res as any).logs) {
        setLogs((res as any).logs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedExamId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const filteredLogs = logs.filter((log) => {
    const matchesAction = selectedActionType === 'ALL' || log.ActionType === selectedActionType;
    const matchesStudent =
      !searchStudent || log.StudentId.toLowerCase().includes(searchStudent.toLowerCase());
    return matchesAction && matchesStudent;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'TAB_SWITCH':
        return { label: 'Tab Switch Violation', cls: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' };
      case 'WINDOW_BLUR':
        return { label: 'Window Focus Lost', cls: 'bg-amber-50 text-amber-800 border-amber-200 font-bold' };
      case 'FULLSCREEN_EXIT':
        return { label: 'Fullscreen Exited', cls: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' };
      case 'COPY_PASTE_ATTEMPT':
        return { label: 'Clipboard Blocked', cls: 'bg-purple-50 text-purple-700 border-purple-200 font-bold' };
      case 'EXAM_START':
        return { label: 'Exam Room Entered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' };
      case 'EXAM_SUBMIT':
        return { label: 'Final Paper Submitted', cls: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' };
      default:
        return { label: action, cls: 'bg-slate-100 text-slate-700 border-slate-200 font-bold' };
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ` (${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`;
    } catch {
      return iso;
    }
  };

  const totalViolations = logs.filter(
    (l) => l.ActionType === 'TAB_SWITCH' || l.ActionType === 'WINDOW_BLUR' || l.ActionType === 'FULLSCREEN_EXIT'
  ).length;

  return (
    <div className="space-y-5 font-sans">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 font-medium">Invigilation Audit Events</div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">{logs.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 font-medium">Anti-Cheat Flags Logged</div>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-0.5">{totalViolations}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 font-medium">Invigilation State</div>
            <div className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Real-Time Surveillance Active</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Exam Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-xs">
            <Filter className="w-3.5 h-3.5 text-amber-700" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Exams</option>
              {exams.map((ex) => (
                <option key={ex.ExamId} value={ex.ExamId}>
                  {ex.ExamId}
                </option>
              ))}
            </select>
          </div>

          {/* Action Type Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-xs">
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Event Types</option>
              <option value="TAB_SWITCH">Tab Switch</option>
              <option value="WINDOW_BLUR">Window Blur</option>
              <option value="COPY_PASTE_ATTEMPT">Copy/Paste Attempt</option>
              <option value="EXAM_START">Exam Start</option>
              <option value="EXAM_SUBMIT">Exam Submit</option>
            </select>
          </div>

          {/* Search student */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchStudent}
              onChange={(e) => setSearchStudent(e.target.value)}
              placeholder="Search Candidate Roll ID..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
            />
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 disabled:opacity-50 shadow-xs min-h-[36px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-700" />
          Loading invigilation audit telemetry...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
          No invigilation events recorded for current criteria.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Candidate ID</th>
                  <th className="px-5 py-3.5">Exam Code</th>
                  <th className="px-5 py-3.5">Action Event</th>
                  <th className="px-5 py-3.5">Telemetry Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredLogs.map((log, idx) => {
                  const badge = getActionBadge(log.ActionType);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {formatTimestamp(log.Timestamp)}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {log.StudentId}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-amber-800 whitespace-nowrap">
                        {log.ExamId}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-[10px] rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {log.Details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
