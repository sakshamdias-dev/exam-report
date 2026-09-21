import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { executeGasAction } from '../../services/api';
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  KeyRound, 
  ShieldAlert, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  X,
  School,
  Lock,
  UserCheck,
  FileCode
} from 'lucide-react';
import { GasScriptModal } from '../GasScriptModal';

interface StudentAccountsManagementProps {
  onRefreshParent?: () => void;
}

export const StudentAccountsManagement: React.FC<StudentAccountsManagementProps> = ({ onRefreshParent }) => {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);

  // New Student Form
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await executeGasAction('getStudents', {});
      if (res.success && res.data?.students) {
        setStudents(res.data.students);
      } else if (res.success && (res as any).students) {
        setStudents((res as any).students);
      }
    } catch (e) {
      console.error('Error loading students:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !name.trim() || !password.trim()) {
      setFormError('Please complete all required fields (Student ID, Name, Password).');
      return;
    }

    if (password.trim().length < 4) {
      setFormError('Password must be at least 4 characters long.');
      return;
    }

    setCreating(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await executeGasAction('createStudent', {
        studentId: studentId.trim().toUpperCase(),
        name: name.trim(),
        password: password.trim(),
        role: 'student',
      });

      if (res.success) {
        setFormSuccess(`Student candidate "${name.trim()}" (${studentId.trim().toUpperCase()}) enrolled successfully!`);
        setStudentId('');
        setName('');
        setPassword('');
        fetchStudents();
        if (onRefreshParent) onRefreshParent();
        setTimeout(() => {
          setIsCreateOpen(false);
          setFormSuccess(null);
        }, 1500);
      } else {
        setFormError(res.error || 'Failed to create student account.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while creating student account.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, studentName: string) => {
    if (!window.confirm(`Are you sure you want to remove student "${studentName}" (${id}) from the enrollment register?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await executeGasAction('deleteStudent', { studentId: id });
      if (res.success) {
        setStudents((prev) => prev.filter((s) => s.UserId !== id));
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(res.error || 'Failed to delete student account.');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while deleting student.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.UserId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.Name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Security Policy Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Candidate Roster &amp; Student Credentials Register
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Enroll candidates, administer login roll numbers, and manage authorized access to scheduled examinations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsGasModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs shrink-0 min-h-[40px]"
            title="View or deploy Google Apps Script backend code"
          >
            <FileCode className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Backend Script</span>
            <span className="sm:hidden">Script</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs shrink-0 min-h-[40px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Candidate</span>
          </button>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search roster by candidate name or Roll ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-600 font-medium font-mono">
            {filteredStudents.length} {filteredStudents.length === 1 ? 'Candidate' : 'Candidates'} Registered
          </span>
          <button
            onClick={fetchStudents}
            disabled={loading}
            className="p-2 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Refresh candidate roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Student List */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          Loading candidate roster...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Candidate Accounts Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No student matches your search "${searchQuery}".`
              : 'No student accounts are currently enrolled in the roster.'}
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll First Candidate</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((stu) => (
            <div
              key={stu.UserId}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between gap-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 font-bold text-sm">
                    {stu.Name ? stu.Name.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{stu.Name}</h4>
                    <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                      ID: {stu.UserId}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(stu.UserId, stu.Name)}
                  disabled={deletingId === stu.UserId}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Remove candidate from register"
                >
                  {deletingId === stu.UserId ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold text-[10px]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Enrolled Candidate</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">AY 2026–27</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Student Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Enroll New Candidate</h3>
                  <p className="text-xs text-slate-500">Register candidate credentials for portal examination access</p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 bg-white">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Roll Number / Candidate ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STU-104 or 2026CS101"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-xs min-h-[42px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Candidate Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-xs min-h-[42px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Initial Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter secure password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-xs min-h-[42px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs min-h-[42px]"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering Candidate...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Enroll Candidate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Google Apps Script Modal */}
      <GasScriptModal
        isOpen={isGasModalOpen}
        onClose={() => setIsGasModalOpen(false)}
      />
    </div>
  );
};
