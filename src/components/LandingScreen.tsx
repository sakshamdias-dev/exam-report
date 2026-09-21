import React from 'react';
import { Role } from '../types';
import { 
  GraduationCap, 
  School, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  FileImage, 
  Award 
} from 'lucide-react';

interface LandingScreenProps {
  onSelectRole: (role: Role) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onSelectRole,
}) => {
  return (
    <div className="w-full flex flex-col font-sans bg-[#F8FAFC]">
      {/* 1. Full-Bleed Dark Slate Gradient Hero Section */}
      <section className="w-full bg-gradient-to-b from-slate-900 to-slate-950 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-800 relative overflow-hidden">
        {/* Subtle decorative ambience */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center space-y-6">
          {/* Institutional Status Badge (without redundant logo) */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-slate-200 border border-white/10 text-xs font-medium backdrop-blur-xs shadow-xs">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Official Institutional Assessment Terminal</span>
          </div>

          {/* Solid White Headline with Cyan Accent & No Neon Orange */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Digital Assessment &amp; <span className="text-cyan-400">Proctored Evaluation</span> Terminal
          </h1>

          {/* Standardized Body Copy: slate-300, 18px, 1.6 line-height, max-width 640px */}
          <p className="text-slate-300 text-[18px] leading-[1.6] max-w-[640px] mx-auto text-center font-normal">
            Welcome to the official <strong>ExamFriendly Examination Portal</strong>. Access secure real-time timed assessments, native PDF question papers, multi-photo Image-to-PDF answer sheet compiler, and strict anti-cheat surveillance.
          </p>
        </div>
      </section>

      {/* 2. Persona Gateways (Student & Faculty Cards) */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Candidate / Student Card */}
          <div
            id="student-portal-card"
            onClick={() => onSelectRole('student')}
            className="group relative rounded-xl bg-white border border-[#E2E8F0] border-t-4 border-t-blue-600 p-8 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[380px]"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                  Student Sign In
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Candidate / Student Portal</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Take assigned exams, view question papers, assemble answer sheet photos to PDF, and track published grading results.
                </p>
              </div>

              {/* Elevated Bullet Points with generous vertical spacing */}
              <ul className="space-y-3.5 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Live timer countdown with locked submission when time expires</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Image to PDF Tool:</strong> Capture answer photos, rotate, and compile A4 PDF booklet</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Real-time proctor surveillance and instant submission receipt confirmation</span>
                </li>
              </ul>
            </div>

            {/* Prominent Full-Width Solid CTA Button */}
            <div className="mt-8 pt-4">
              <button
                type="button"
                className="w-full py-3 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 group-hover:bg-blue-700"
              >
                <span>Sign In as Candidate</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Faculty / Controller Card */}
          <div
            id="faculty-console-card"
            onClick={() => onSelectRole('teacher')}
            className="group relative rounded-xl bg-white border border-[#E2E8F0] border-t-4 border-t-indigo-600 p-8 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[380px]"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <School className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                  Faculty Sign In
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Faculty &amp; Controller Console</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Schedule exams, manage student batches/cohorts, grade answer sheet PDFs, and review invigilation surveillance logs.
                </p>
              </div>

              {/* Elevated Bullet Points with generous vertical spacing */}
              <ul className="space-y-3.5 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Schedule exams for All Students, specific Groups, or Candidates</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Student Groups and laboratory cohort roster administration</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>On-Screen Marking (OSM) PDF evaluation, scores entry, and anti-cheat audit logs</span>
                </li>
              </ul>
            </div>

            {/* Prominent Full-Width Solid CTA Button */}
            <div className="mt-8 pt-4">
              <button
                type="button"
                className="w-full py-3 px-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 group-hover:bg-slate-800"
              >
                <span>Sign In as Faculty</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Institutional Specifications Section */}
        <div className="p-8 rounded-xl bg-white border border-[#E2E8F0] shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">ExamFriendly Academic Infrastructure</h2>
            <p className="text-xs text-slate-500 mt-0.5">Reliable, proctored, and automated examination system</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2.5">
              <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Anti-Cheat Surveillance</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Monitors focus loss, tab switching, and clipboard actions with instant invigilator audit logs.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2.5">
              <div className="w-8 h-8 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <FileImage className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Image to PDF Compiler</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Converts handwritten answer photos into proportion-preserved, sharp A4 PDF booklets with ease.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2.5">
              <div className="w-8 h-8 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Strict Window Lock</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically closes submissions once the scheduled examination countdown concludes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

