import React, { useState } from 'react';
import { Exam, AssignmentType, StudentGroup, User } from '../../types';
import { executeGasAction } from '../../services/api';
import { Calendar, Trash2, Edit3, Eye, Award, Clock, AlertTriangle, Loader2, Users, Layers, UserCheck } from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';

interface ExamsTableProps {
  exams: Exam[];
  onRefresh: () => void;
}

export const ExamsTable: React.FC<ExamsTableProps> = ({ exams, onRefresh }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editAssignmentType, setEditAssignmentType] = useState<AssignmentType>('ALL');
  const [editAssignedGroups, setEditAssignedGroups] = useState<string[]>([]);
  const [editAssignedStudents, setEditAssignedStudents] = useState<string[]>([]);
  const [groupsList, setGroupsList] = useState<StudentGroup[]>([]);
  const [studentsList, setStudentsList] = useState<User[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');

  const handleDelete = async (examId: string) => {
    if (!window.confirm(`Are you sure you want to delete examination "${examId}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(examId);
    try {
      const res = await executeGasAction('deleteExam', { examId });
      if (res.success) {
        onRefresh();
      } else {
        alert(res.error || 'Failed to delete examination.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred during deletion.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenEdit = async (exam: Exam) => {
    setEditingExam(exam);
    try {
      setEditStartTime(new Date(exam.StartTime).toISOString().slice(0, 16));
      setEditEndTime(new Date(exam.EndTime).toISOString().slice(0, 16));
    } catch {
      setEditStartTime(exam.StartTime);
      setEditEndTime(exam.EndTime);
    }
    setEditAssignmentType(exam.AssignmentType || 'ALL');
    setEditAssignedGroups(exam.AssignedGroups || []);
    setEditAssignedStudents(exam.AssignedStudents || []);

    // Load available groups and students
    try {
      const [gRes, sRes] = await Promise.all([
        executeGasAction('getGroups', {}),
        executeGasAction('getStudents', {}),
      ]);
      if (gRes.success && gRes.data?.groups) setGroupsList(gRes.data.groups);
      else if (gRes.success && (gRes as any).groups) setGroupsList((gRes as any).groups);

      if (sRes.success && sRes.data?.students) setStudentsList(sRes.data.students);
      else if (sRes.success && (sRes as any).students) setStudentsList((sRes as any).students);
    } catch (err) {
      console.error('Error fetching groups/students for edit:', err);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;

    setSavingEdit(true);
    try {
      const res = await executeGasAction('updateExam', {
        examId: editingExam.ExamId,
        startTime: new Date(editStartTime).toISOString(),
        endTime: new Date(editEndTime).toISOString(),
        assignmentType: editAssignmentType,
        assignedGroups: editAssignmentType === 'GROUPS' ? editAssignedGroups : [],
        assignedStudents: editAssignmentType === 'STUDENTS' ? editAssignedStudents : [],
      });

      if (res.success) {
        setEditingExam(null);
        onRefresh();
      } else {
        alert(res.error || 'Failed to update examination schedule.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating examination.');
    } finally {
      setSavingEdit(false);
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

  const getStatus = (start: string, end: string) => {
    const now = Date.now();
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();

    if (now < s) return { label: 'Scheduled', cls: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' };
    if (now > e) return { label: 'Concluded', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    return { label: 'Active Examination', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold animate-pulse' };
  };

  const renderAssignmentBadge = (exam: Exam) => {
    const type = exam.AssignmentType || 'ALL';
    if (type === 'ALL') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <Users className="w-3 h-3 mr-1 text-slate-500" />
          All Students
        </span>
      );
    }
    if (type === 'GROUPS') {
      const count = exam.AssignedGroups?.length || 0;
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <Layers className="w-3 h-3 mr-1 text-blue-600" />
          {count} Group{count !== 1 ? 's' : ''} ({exam.AssignedGroups?.join(', ') || 'None'})
        </span>
      );
    }
    if (type === 'STUDENTS') {
      const count = exam.AssignedStudents?.length || 0;
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          <UserCheck className="w-3 h-3 mr-1 text-purple-600" />
          {count} Candidate{count !== 1 ? 's' : ''}
        </span>
      );
    }
    return null;
  };

  return (
    <div id="exams-table-container" className="space-y-4 font-sans">
      {exams.length === 0 ? (
        <div className="p-12 rounded-lg bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
          No examinations registered yet. Click "Schedule New Exam" to schedule an assessment.
        </div>
      ) : (
        <div className="rounded-lg bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Exam Code</th>
                  <th className="px-4 py-3">Course / Subject</th>
                  <th className="px-4 py-3">Schedule Window</th>
                  <th className="px-4 py-3">Total Marks</th>
                  <th className="px-4 py-3">Assigned Scope</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Question Paper</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {exams.map((exam) => {
                  const status = getStatus(exam.StartTime, exam.EndTime);
                  return (
                    <tr key={exam.ExamId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-900">
                        {exam.ExamId}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 max-w-xs truncate">
                        {exam.Subject || 'General Examination'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                        <div>Start: {formatDateTime(exam.StartTime)}</div>
                        <div>End: {formatDateTime(exam.EndTime)}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-800 font-bold text-[11px]">
                          {exam.TotalMarks || 100} M
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {renderAssignmentBadge(exam)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 text-[10px] rounded border ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {exam.QPUrl ? (
                          <button
                            onClick={() => {
                              setPreviewPdfUrl(exam.QPUrl);
                              setPreviewPdfTitle(`Question Paper - ${exam.ExamId}`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-[11px] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview PDF</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No PDF attached</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(exam)}
                            className="p-1.5 rounded text-slate-500 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                            title="Edit Exam Parameters & Assignment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exam.ExamId)}
                            disabled={deletingId === exam.ExamId}
                            className="p-1.5 rounded text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Delete Exam Record"
                          >
                            {deletingId === exam.ExamId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
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

      {/* Edit Timings & Assignment Modal */}
      {editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-5 shadow-2xl space-y-4 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Schedule &amp; Assignment for <span className="text-blue-700 font-mono">{editingExam.ExamId}</span>
              </h3>
              <button
                onClick={() => setEditingExam(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold block">Start Time</label>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono focus:outline-hidden focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold block">End Time</label>
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono focus:outline-hidden focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Assignment Type */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-slate-700 font-semibold block">Candidate Assignment Scope</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAssignmentType('ALL')}
                    className={`py-1.5 px-2 rounded font-semibold text-xs border transition-colors ${
                      editAssignmentType === 'ALL'
                        ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    All Students
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAssignmentType('GROUPS')}
                    className={`py-1.5 px-2 rounded font-semibold text-xs border transition-colors ${
                      editAssignmentType === 'GROUPS'
                        ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Specific Groups
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAssignmentType('STUDENTS')}
                    className={`py-1.5 px-2 rounded font-semibold text-xs border transition-colors ${
                      editAssignmentType === 'STUDENTS'
                        ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Specific Students
                  </button>
                </div>

                {editAssignmentType === 'GROUPS' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded max-h-36 overflow-y-auto space-y-1.5">
                    {groupsList.length === 0 ? (
                      <div className="text-slate-500 italic text-[11px]">No groups found in database.</div>
                    ) : (
                      groupsList.map((g) => (
                        <label key={g.GroupId} className="flex items-center space-x-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editAssignedGroups.includes(g.GroupId)}
                            onChange={() => {
                              setEditAssignedGroups((prev) =>
                                prev.includes(g.GroupId) ? prev.filter((id) => id !== g.GroupId) : [...prev, g.GroupId]
                              );
                            }}
                            className="rounded text-blue-600 h-3.5 w-3.5 border-slate-300"
                          />
                          <span className="font-semibold text-slate-800">{g.Name}</span>
                          <span className="font-mono text-[10px] text-slate-500">({g.GroupId})</span>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {editAssignmentType === 'STUDENTS' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded max-h-36 overflow-y-auto space-y-1.5">
                    {studentsList.length === 0 ? (
                      <div className="text-slate-500 italic text-[11px]">No students found.</div>
                    ) : (
                      studentsList.map((s) => (
                        <label key={s.UserId} className="flex items-center space-x-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editAssignedStudents.includes(s.UserId)}
                            onChange={() => {
                              setEditAssignedStudents((prev) =>
                                prev.includes(s.UserId) ? prev.filter((id) => id !== s.UserId) : [...prev, s.UserId]
                              );
                            }}
                            className="rounded text-blue-600 h-3.5 w-3.5 border-slate-300"
                          />
                          <span className="font-semibold text-slate-800">{s.Name}</span>
                          <span className="font-mono text-[10px] text-slate-500">({s.UserId})</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingExam(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors disabled:opacity-50 shadow-xs"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Modal */}
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
