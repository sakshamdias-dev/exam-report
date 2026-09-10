import React from 'react';
import { Role } from '../types';
import { 
  GraduationCap, 
  School, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Award,
  CalendarDays,
  FileImage,
  Sparkles,
  Zap
} from 'lucide-react';
import { ExamFriendlyLogo } from './ExamFriendlyLogo';

interface LandingScreenProps {
  onSelectRole: (role: Role) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onSelectRole,
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 font-sans">
      {/* Top Academic Banner */}
      <div className="bg-gradient-to-br from-[#0B1528] via-[#0F1E36] to-[#081220] text-white rounded-3xl p-6 sm:p-10 border border-sky-900/60 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#009fe3]/15 via-[#f25f22]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-5">
          {/* Institutional Badge & ExamFriendly Brand Logo Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white px-3 py-1.5 rounded-xl shadow-md border border-sky-100 flex items-center justify-center">
              <ExamFriendlyLogo size="sm" showTagline={false} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-sky-950/80 border border-sky-600/50 text-sky-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#009fe3]" />
              <span>ExamFriendly Examination Portal</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
            Digital Assessment &amp; <span className="text-[#009fe3]">Proctored Evaluation</span> <span className="text-[#f25f22]">Terminal</span>
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Welcome to the official <strong>ExamFriendly Examination Portal</strong>. Access secure real-time timed assessments, native PDF question papers, multi-photo Image-to-PDF answer sheet compiler, and strict anti-cheat surveillance.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-sky-900/50">
              <CalendarDays className="w-3.5 h-3.5 text-[#f25f22]" />
              <span>Academic Session 2026–27 | Sem II</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-sky-900/50">
              <Clock className="w-3.5 h-3.5 text-[#009fe3]" />
              <span>Strict Time Window Enforcement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Selection Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Student Portal Card */}
        <div
          onClick={() => onSelectRole('student')}
          className="group relative rounded-2xl bg-white border border-sky-200/80 p-6 sm:p-8 hover:border-[#009fe3] hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xs min-h-[340px]"
        >
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#009fe3] shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-900">Candidate / Student Portal</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-sky-50 text-[#009fe3] rounded-md border border-sky-200 font-bold">
                  Student Sign In
                </span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Take assigned exams, view question papers, assemble answer sheet photos to PDF, and track published grading results.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#009fe3] shrink-0" />
                <span>Live timer countdown &amp; locked submission when time is up</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#f25f22] shrink-0" />
                <span><strong>Image to PDF Tool:</strong> Capture answer photos, rotate, and build A4 PDF</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#009fe3] shrink-0" />
                <span>Real-time proctor surveillance &amp; instant submission confirmations</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[#009fe3] font-bold text-xs group-hover:text-[#0284c7] min-h-[44px]">
            <span>Sign In to Student Portal</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Faculty / Teacher Console Card */}
        <div
          onClick={() => onSelectRole('teacher')}
          className="group relative rounded-2xl bg-white border border-orange-200/80 p-6 sm:p-8 hover:border-[#f25f22] hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xs min-h-[340px]"
        >
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#f25f22] shadow-xs">
              <School className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-900">Faculty &amp; Controller Console</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-orange-50 text-[#f25f22] rounded-md border border-orange-200 font-bold">
                  Faculty Sign In
                </span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Schedule exams, manage student batches/cohorts, grade answer sheet PDFs, and review invigilation surveillance logs.
              </p>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#f25f22] shrink-0" />
                <span>Schedule exams for All Students, specific Groups, or Candidates</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#009fe3] shrink-0" />
                <span>Student Groups &amp; laboratory batch roster administration</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#f25f22] shrink-0" />
                <span>PDF evaluation, scores entry, and anti-cheat audit logs</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[#f25f22] font-bold text-xs group-hover:text-[#ea580c] min-h-[44px]">
            <span>Sign In to Faculty Console</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Institutional Specifications */}
      <div className="max-w-4xl mx-auto p-6 sm:p-7 rounded-2xl bg-white border border-sky-100 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">ExamFriendly Academic Infrastructure</h2>
            <p className="text-xs text-slate-500 mt-0.5">Reliable, proctored, and automated examination system</p>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-sky-50 text-[#009fe3] border border-sky-200">
            Powered by ExamFriendly
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#009fe3] flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Anti-Cheat Surveillance</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Monitors focus loss, tab switching, and clipboard actions with instant invigilator audit logs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#f25f22] flex items-center justify-center font-bold text-xs">
              <FileImage className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Image to PDF Compiler</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Converts handwritten answer photos into proportion-preserved, sharp A4 PDF booklets with ease.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <Award className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Strict Window Lock</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Automatically closes submissions once the scheduled examination countdown concludes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
