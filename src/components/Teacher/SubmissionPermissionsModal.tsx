import React, { useState, useEffect } from 'react';
import { Exam, StudentGroup, User, SubmissionOverride } from '../../types';
import { executeGasAction } from '../../services/api';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Layers, 
  Clock, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  X, 
  Calendar,
  Lock,
  Unlock
} from 'lucide-react';

interface SubmissionPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  onRefreshParent?: () => void;
}

export const SubmissionPermissionsModal: React.FC<SubmissionPermissionsModalProps> = ({
  isOpen,
  onClose,
  exam,
  onRefreshParent,
}) => {
  const [overrides, setOverrides] = useState<SubmissionOverride[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [targetType, setTargetType] = useState<'STUDENT' | 'GROUP'>('STUDENT');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [allowSubmission, setAllowSubmission] = useState(true); // true = allow, false = disallow
  const [reason, setReason] = useState('');
  const [extensionPreset, setExtensionPreset] = useState<'none' | '15m' | '30m' | '60m' | 'custom'>('30m');
  const [customExpiresAt, setCustomExpiresAt] = useState('');

  const fetchOverridesData = async () => {
    setLoading(true);
    try {
      const [ovrRes, stuRes, grpRes] = await Promise.all([
        executeGasAction('getSubmissionOverrides', { examId: exam.ExamId }),
        executeGasAction('getStudents', {}),
        executeGasAction('getGroups', {}),
      ]);

      if (ovrRes.success && ovrRes.data?.overrides) {
        setOverrides(ovrRes.data.overrides);
      } else if (ovrRes.success && (ovrRes as any).overrides) {
        setOverrides((ovrRes as any).overrides);
      }

      if (stuRes.success && stuRes.data?.students) {
        setStudents(stuRes.data.students);
        if (stuRes.data.students.length > 0 && !selectedTargetId) {
          setSelectedTargetId(stuRes.data.students[0].UserId);
        }
      } else if (stuRes.success && (stuRes as any).students) {
        setStudents((stuRes as any).students);
      }

      if (grpRes.success && grpRes.data?.groups) {
        setGroups(grpRes.data.groups);
      } else if (grpRes.success && (grpRes as any).groups) {
        setGroups((grpRes as any).groups);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOverridesData();
    }
  }, [isOpen, exam.ExamId]);

  // Update default selectedTargetId when targetType changes
  useEffect(() => {
    if (targetType === 'STUDENT' && students.length > 0) {
      setSelectedTargetId(students[0].UserId);
    } else if (targetType === 'GROUP' && groups.length > 0) {
      setSelectedTargetId(groups[0].GroupId);
    }
  }, [targetType, students, groups]);

  if (!isOpen) return null;

  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) {
      alert('Please select a student or group.');
      return;
    }

    setSaving(true);

    let expiresAt = '';
    if (allowSubmission) {
      const baseTime = Math.max(Date.now(), new Date(exam.EndTime).getTime());
      if (extensionPreset === '15m') {
        expiresAt = new Date(baseTime + 15 * 60000).toISOString();
      } else if (extensionPreset === '30m') {
        expiresAt = new Date(baseTime + 30 * 60000).toISOString();
      } else if (extensionPreset === '60m') {
        expiresAt = new Date(baseTime + 60 * 60000).toISOString();
      } else if (extensionPreset === 'custom' && customExpiresAt) {
        expiresAt = new Date(customExpiresAt).toISOString();
      }
    }

    let targetName = selectedTargetId;
    if (targetType === 'STUDENT') {
      const s = students.find((st) => st.UserId === selectedTargetId);
      if (s) targetName = `${s.Name} (${s.UserId})`;
    } else {
      const g = groups.find((gr) => gr.GroupId === selectedTargetId);
      if (g) targetName = `${g.Name} (${g.GroupId})`;
    }

    try {
      const res = await executeGasAction('setSubmissionOverride', {
        examId: exam.ExamId,
        targetType,
        targetId: selectedTargetId,
        targetName,
        allowSubmission,
        reason: reason.trim() || (allowSubmission ? 'Extended submission permission' : 'Submission barred by faculty'),
        expiresAt,
        grantedBy: 'Faculty Evaluator',
      });

      if (res.success) {
        setReason('');
        fetchOverridesData();
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(res.error || 'Failed to save submission override.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    setDeletingId(overrideId);
    try {
      const res = await executeGasAction('deleteSubmissionOverride', {
        overrideId,
        examId: exam.ExamId,
      });
      if (res.success) {
        fetchOverridesData();
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(res.error || 'Failed to delete rule.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting rule.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return 'Indefinite';
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
    <div id="submission-permissions-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-2xl space-y-4 font-sans max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
              <ShieldCheck className="w-5 h-5 text-sky-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Submission Permissions &amp; Overrides</h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/20 text-white border border-white/30">
                  {exam.ExamId}
                </span>
              </div>
              <p className="text-xs text-sky-100 mt-0.5">
                {exam.Subject || 'General Examination'} • End: {formatDateTime(exam.EndTime)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Policy Overview Card */}
          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-lg flex items-start gap-3">
            <Clock className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sky-900">
              <p className="font-semibold text-xs">
                Standard Rule: Submissions are strictly locked once the examination time is up.
              </p>
              <p className="text-[11px] text-sky-800 leading-relaxed">
                Use this control center to selectively <strong>grant submission extensions</strong> for candidates facing technical/medical issues, or <strong>disallow/block submissions</strong> for specific students or batches.
              </p>
            </div>
          </div>

          {/* Form to Grant / Restrict Access */}
          <form onSubmit={handleCreateOverride} className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600" />
                <span>Add Submission Rule / Exception</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Type Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">1. Target Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('STUDENT')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      targetType === 'STUDENT'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Specific Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('GROUP')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      targetType === 'GROUP'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Student Group</span>
                  </button>
                </div>
              </div>

              {/* Action / Permission Policy */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">2. Submission Access Policy</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowSubmission(true)}
                    className={`py-2 px-3 rounded-lg font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      allowSubmission
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>ALLOW Submission</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowSubmission(false)}
                    className={`py-2 px-3 rounded-lg font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      !allowSubmission
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>DISALLOW (Block)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Target Selection Dropdown */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                3. Select {targetType === 'STUDENT' ? 'Candidate (Roll No / Name)' : 'Student Cohort / Group'}
              </label>
              {targetType === 'STUDENT' ? (
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-hidden focus:border-sky-600"
                >
                  {students.map((s) => (
                    <option key={s.UserId} value={s.UserId}>
                      {s.UserId} — {s.Name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-hidden focus:border-sky-600"
                >
                  {groups.map((g) => (
                    <option key={g.GroupId} value={g.GroupId}>
                      {g.Name} ({g.GroupId}) — {g.StudentIds?.length || 0} candidates
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Extension Window (Only if ALLOW) */}
            {allowSubmission && (
              <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-200">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Submission Grace Period / Extension Window</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('15m')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      extensionPreset === '15m'
                        ? 'bg-sky-50 border-sky-600 text-sky-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    +15 Minutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('30m')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      extensionPreset === '30m'
                        ? 'bg-sky-50 border-sky-600 text-sky-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    +30 Minutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('60m')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      extensionPreset === '60m'
                        ? 'bg-sky-50 border-sky-600 text-sky-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    +60 Minutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('none')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      extensionPreset === 'none'
                        ? 'bg-sky-50 border-sky-600 text-sky-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    No Expiry (Open)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('custom')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      extensionPreset === 'custom'
                        ? 'bg-sky-50 border-sky-600 text-sky-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    Custom Deadline
                  </button>
                </div>

                {extensionPreset === 'custom' && (
                  <div className="pt-2">
                    <input
                      type="datetime-local"
                      value={customExpiresAt}
                      onChange={(e) => setCustomExpiresAt(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono text-xs focus:outline-hidden focus:border-sky-600"
                      required={extensionPreset === 'custom'}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Justification / Note */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                Administrative Reason / Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={allowSubmission ? "e.g. Granted late submission due to network reboot" : "e.g. Disallowed due to multiple tab switch violations"}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-sky-600"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Save Submission Rule</span>
              </button>
            </div>
          </form>

          {/* Active Overrides List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Active Submission Rules for this Exam ({overrides.length})
              </h4>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-sky-600" />
                Loading rules...
              </div>
            ) : overrides.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                No custom submission rules configured yet. The standard exam window applies to all candidates.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Scope</th>
                      <th className="px-3.5 py-2.5">Candidate / Group</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">Extended Deadline</th>
                      <th className="px-3.5 py-2.5">Reason</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overrides.map((ovr) => (
                      <tr key={ovr.OverrideId} className="hover:bg-slate-50">
                        <td className="px-3.5 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {ovr.TargetType}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 font-semibold text-slate-900">
                          {ovr.TargetName || ovr.TargetId}
                        </td>
                        <td className="px-3.5 py-3">
                          {ovr.AllowSubmission ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                              <Unlock className="w-3 h-3" />
                              ALLOWED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-300">
                              <Lock className="w-3 h-3" />
                              DISALLOWED
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 font-mono text-[11px] text-slate-600">
                          {ovr.AllowSubmission ? formatDateTime(ovr.ExpiresAt || '') : 'Blocked'}
                        </td>
                        <td className="px-3.5 py-3 text-slate-600 max-w-xs truncate">
                          {ovr.Reason || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <button
                            onClick={() => handleDeleteOverride(ovr.OverrideId)}
                            disabled={deletingId === ovr.OverrideId}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                            title="Remove this rule"
                          >
                            {deletingId === ovr.OverrideId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
