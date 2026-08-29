import React, { useState, useEffect } from 'react';
import { executeGasAction, fileToBase64 } from '../../services/api';
import { AssignmentType, StudentGroup, User } from '../../types';
import {
  X,
  UploadCloud,
  FileText,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  Eye,
  Users,
  UserCheck,
  Layers,
  Search,
  CheckCircle2
} from 'lucide-react';
import { PdfViewerModal } from '../PdfViewerModal';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [examId, setExamId] = useState(`EXAM-${Math.floor(1000 + Math.random() * 9000)}`);
  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 125);
    return d.toISOString().slice(0, 16);
  });
  const [totalMarks, setTotalMarks] = useState(100);

  // Candidate Assignment Scope
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('ALL');
  const [availableGroups, setAvailableGroups] = useState<StudentGroup[]>([]);
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load groups and students
      executeGasAction('getGroups', {}).then((res) => {
        if (res.success && res.data?.groups) setAvailableGroups(res.data.groups);
        else if (res.success && (res as any).groups) setAvailableGroups((res as any).groups);
      }).catch(console.error);

      executeGasAction('getStudents', {}).then((res) => {
        if (res.success && res.data?.students) setAvailableStudents(res.data.students);
        else if (res.success && (res as any).students) setAvailableStudents((res as any).students);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF documents (.pdf) are permitted for Question Papers.');
        return;
      }

      setError(null);
      setSelectedFile(file);
      try {
        const b64 = await fileToBase64(file);
        setFileBase64(b64);
      } catch (err) {
        setError('Failed to process PDF file.');
      }
    }
  };

  const handleToggleGroup = (gId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };

  const handleToggleStudent = (sId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examId.trim() || !subject.trim()) {
      setError('Please fill in Exam ID and Subject Name.');
      return;
    }

    if (!selectedFile && !fileBase64) {
      setError('Please select or upload a Question Paper PDF file.');
      return;
    }

    if (assignmentType === 'GROUPS' && selectedGroupIds.length === 0) {
      setError('Please select at least one student group or switch to All Candidates.');
      return;
    }

    if (assignmentType === 'STUDENTS' && selectedStudentIds.length === 0) {
      setError('Please select at least one student candidate or switch to All Candidates.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await executeGasAction('createExam', {
        examId: examId.trim().toUpperCase(),
        subject: subject.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalMarks: Number(totalMarks),
        pdfBase64: fileBase64,
        assignmentType,
        assignedGroups: assignmentType === 'GROUPS' ? selectedGroupIds : [],
        assignedStudents: assignmentType === 'STUDENTS' ? selectedStudentIds : [],
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to register examination.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating exam.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = availableStudents.filter(
    (s) =>
      s.UserId.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.Name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div id="create-exam-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-lg flex flex-col shadow-2xl overflow-hidden max-h-[92vh] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Schedule New Examination</h3>
              <p className="text-[11px] text-slate-500">Configure parameters, assignment target cohorts, and attach question paper</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 bg-white text-xs">
          {error && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-slate-700 font-semibold block">
                Exam Code / Identifier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="e.g. EXAM-CHEM101"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 font-mono uppercase focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 font-semibold block">
                Total Marks Maximum <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 font-mono focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-700 font-semibold block">
              Subject Name / Course Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Biochemistry & Molecular Cellular Biology"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 font-mono focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                <span>End Time</span>
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 font-mono focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                required
              />
            </div>
          </div>

          {/* Targeted Candidate / Group Assignment Section */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold uppercase tracking-wider text-[11px] flex items-center">
                <Users className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                Target Audience &amp; Candidate Assignment
              </label>
              <span className="text-[11px] text-slate-500">
                {assignmentType === 'ALL'
                  ? 'Open to all candidates'
                  : assignmentType === 'GROUPS'
                  ? `${selectedGroupIds.length} group(s) chosen`
                  : `${selectedStudentIds.length} candidate(s) chosen`}
              </span>
            </div>

            {/* Assignment Mode Pills */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentType('ALL')}
                className={`py-2 px-3 rounded-md font-semibold text-xs border flex items-center justify-center space-x-1.5 transition-colors ${
                  assignmentType === 'ALL'
                    ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>All Students</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignmentType('GROUPS')}
                className={`py-2 px-3 rounded-md font-semibold text-xs border flex items-center justify-center space-x-1.5 transition-colors ${
                  assignmentType === 'GROUPS'
                    ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Specific Groups</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignmentType('STUDENTS')}
                className={`py-2 px-3 rounded-md font-semibold text-xs border flex items-center justify-center space-x-1.5 transition-colors ${
                  assignmentType === 'STUDENTS'
                    ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Specific Students</span>
              </button>
            </div>

            {/* If GROUPS selected */}
            {assignmentType === 'GROUPS' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                <span className="text-[11px] font-semibold text-slate-700 block">
                  Select one or more student groups:
                </span>
                {availableGroups.length === 0 ? (
                  <div className="p-3 text-center text-slate-500 italic text-[11px]">
                    No student groups created yet. You can create groups in the "Student Groups" tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {availableGroups.map((grp) => {
                      const isChecked = selectedGroupIds.includes(grp.GroupId);
                      return (
                        <label
                          key={grp.GroupId}
                          className={`flex items-start space-x-2 p-2 rounded border cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-blue-50/90 border-blue-300 text-blue-900'
                              : 'bg-white border-slate-200 hover:bg-slate-100/60 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleGroup(grp.GroupId)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300 mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold block text-xs truncate">{grp.Name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {grp.GroupId} • {grp.StudentIds.length} candidate(s)
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* If STUDENTS selected */}
            {assignmentType === 'STUDENTS' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Select target individual candidates:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fIds = filteredStudents.map((s) => s.UserId);
                      const all = fIds.every((id) => selectedStudentIds.includes(id));
                      if (all) {
                        setSelectedStudentIds((prev) => prev.filter((id) => !fIds.includes(id)));
                      } else {
                        setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...fIds])));
                      }
                    }}
                    className="text-[10px] font-semibold text-blue-700 hover:underline"
                  >
                    Toggle Filtered All
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search candidate by name or ID..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded text-slate-900 focus:outline-hidden focus:border-blue-600"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto bg-white border border-slate-200 rounded divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-center text-slate-500 italic text-[11px]">
                      No student accounts found matching query.
                    </div>
                  ) : (
                    filteredStudents.map((student) => {
                      const isChecked = selectedStudentIds.includes(student.UserId);
                      return (
                        <label
                          key={student.UserId}
                          className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs ${
                            isChecked ? 'bg-blue-50/70 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleStudent(student.UserId)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
                            />
                            <div>
                              <span className="font-semibold block">{student.Name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{student.UserId}</span>
                            </div>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                              Assigned
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Question Paper PDF Upload */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Official Question Paper PDF <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Standard A4 Document</span>
            </div>

            <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/20 group">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-blue-700 transition-colors mb-1" />
              <span className="text-xs font-semibold text-slate-800">
                {selectedFile ? selectedFile.name : 'Select Question Paper PDF'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB PDF attached`
                  : 'Click or drag PDF document here'}
              </span>
            </label>

            {selectedFile && fileBase64 && (
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="text-xs text-slate-800 truncate font-mono">{selectedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPdfUrl(fileBase64)}
                  className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-bold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md font-bold text-xs text-white bg-blue-700 hover:bg-blue-800 shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Examination...</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  <span>Publish &amp; Schedule Exam</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {previewPdfUrl && (
        <PdfViewerModal
          isOpen={!!previewPdfUrl}
          onClose={() => setPreviewPdfUrl(null)}
          title="Question Paper Preview"
          pdfUrl={previewPdfUrl}
        />
      )}
    </div>
  );
};
