import React, { useState, useEffect } from 'react';
import { Role, User } from '../types';
import { executeGasAction } from '../services/api';
import { 
  X, 
  Lock, 
  User as UserIcon, 
  LogIn, 
  KeyRound, 
  GraduationCap, 
  School, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { ExamFriendlyLogo } from './ExamFriendlyLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole: Role;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialRole, onSuccess }) => {
  const [role, setRole] = useState<Role>(initialRole);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRole(initialRole);
      setError(null);
      setUserId('');
      setPassword('');
      setShowPassword(false);
    }
  }, [isOpen, initialRole]);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError('Please enter your Institutional ID and Password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await executeGasAction('userLogin', {
        userId: userId.trim().toUpperCase(),
        password: password.trim(),
        role: role,
      });

      if (res.success && res.data?.user) {
        onSuccess(res.data.user);
        onClose();
      } else if (res.success && (res as any).user) {
        onSuccess((res as any).user);
        onClose();
      } else {
        setError(res.error || 'Authentication failed. Please verify your Institutional User ID and password.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-sky-200/80 rounded-2xl flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Brand Banner with ExamFriendly Logo */}
        <div className="pt-6 pb-4 px-6 bg-gradient-to-b from-sky-50/60 to-white flex flex-col items-center justify-center border-b border-slate-100 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Logo */}
          <div className="py-1">
            <ExamFriendlyLogo size="md" showTagline={true} />
          </div>
          
          <div className="mt-2 text-center">
            <h3 className="text-sm font-bold text-slate-800">
              ExamFriendly Examination Portal
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {role === 'teacher' ? 'Faculty & Evaluator Authentication' : 'Student & Candidate Authentication'}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white">
          {/* Role Pill Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleRoleChange('student')}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[38px] ${
                role === 'student'
                  ? 'bg-white text-[#009fe3] shadow-xs border border-sky-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student / Candidate</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('teacher')}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[38px] ${
                role === 'teacher'
                  ? 'bg-white text-[#f25f22] shadow-xs border border-orange-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <School className="w-3.5 h-3.5" />
              <span>Faculty / Teacher</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* User ID Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Institutional ID / Roll Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={role === 'teacher' ? 'e.g. TCH-801' : 'e.g. STU-101'}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#009fe3]/50 focus:border-[#009fe3] font-mono uppercase shadow-xs min-h-[44px]"
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#009fe3]/50 focus:border-[#009fe3] font-mono shadow-xs min-h-[44px]"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px] ${
              role === 'teacher'
                ? 'bg-[#f25f22] hover:bg-[#ea580c] shadow-orange-600/20'
                : 'bg-[#009fe3] hover:bg-[#0284c7] shadow-sky-600/20'
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to {role === 'teacher' ? 'Faculty Console' : 'Student Portal'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#009fe3]" />
          <span>ExamFriendly Secure Examination System • Encrypted Session</span>
        </div>
      </div>
    </div>
  );
};
