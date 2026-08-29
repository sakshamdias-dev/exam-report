import React from 'react';
import { User } from '../types';
import { 
  GraduationCap, 
  LogOut, 
  ShieldCheck,
  CalendarDays,
  UserCheck
} from 'lucide-react';
import { ExamFriendlyLogo } from './ExamFriendlyLogo';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B1528] text-white border-b border-sky-900/50 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Left: Official ExamFriendly Brand Logo & Portal Name */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="bg-white p-1.5 sm:p-2 rounded-xl shadow-sm border border-sky-200/40 flex items-center justify-center shrink-0">
            <ExamFriendlyLogo size="sm" showTagline={false} />
          </div>
          
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm sm:text-lg tracking-tight">
                ExamFriendly <span className="text-[#009fe3]">Examination</span> <span className="text-[#f25f22]">Portal</span>
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-sky-950/80 text-sky-300 rounded-md border border-sky-700/50">
                <ShieldCheck className="w-3 h-3 text-[#009fe3]" />
                Proctored Console
              </span>
            </div>
            <p className="hidden sm:flex items-center gap-2 text-[11px] text-slate-300 font-medium">
              <span className="text-slate-400">Official Institutional Assessment Terminal</span>
              <span className="text-sky-600">•</span>
              <span className="flex items-center gap-1 text-sky-200 font-mono text-[10px]">
                <CalendarDays className="w-3 h-3 text-[#f25f22]" />
                AY 2026–27 | Sem II
              </span>
            </p>
          </div>
        </div>

        {/* Right: Academic Status & User Profile Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Institutional Status Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-sky-900/40 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium text-[11px]">Server Live</span>
          </div>

          {/* User Account Info / Logout */}
          {currentUser ? (
            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-sky-900/40 shadow-xs">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    currentUser.Role === 'teacher'
                      ? 'bg-orange-500/20 text-[#f25f22] border border-orange-500/40'
                      : 'bg-sky-500/20 text-[#009fe3] border border-sky-500/40'
                  }`}
                >
                  {currentUser.Role === 'teacher' ? 'FAC' : 'STU'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-white truncate max-w-[150px]">
                    {currentUser.Name || currentUser.UserId}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">
                    ID: {currentUser.UserId}
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                title="Sign Out of ExamFriendly Portal"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-sky-300/80 font-mono hidden sm:block">
              Candidate &amp; Faculty Access
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
