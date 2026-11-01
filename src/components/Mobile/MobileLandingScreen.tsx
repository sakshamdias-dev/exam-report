import React from 'react';
import { Role } from '../../types';
import { 
  GraduationCap, 
  School, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  FileImage, 
  Award,
  Sparkles,
  Smartphone,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { ExamFriendlyLogo } from '../ExamFriendlyLogo';

interface MobileLandingScreenProps {
  onSelectRole: (role: Role) => void;
}

export const MobileLandingScreen: React.FC<MobileLandingScreenProps> = ({
  onSelectRole,
}) => {
  return (
    <div className="w-full flex flex-col font-sans px-4 py-5 space-y-5">
      {/* 1. App Store Style Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 text-white p-5 shadow-md border border-slate-800 relative overflow-hidden text-center"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col items-center justify-center space-y-3 relative z-10">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 2 }}
            className="w-14 h-14 bg-white rounded-2xl shadow-lg p-2 flex items-center justify-center border-2 border-sky-400"
          >
            <ExamFriendlyLogo size="md" showTagline={false} />
          </motion.div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sky-200 border border-white/10 text-[11px] font-medium backdrop-blur-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Official Mobile Examination App</span>
          </div>

          <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
            ExamFriendly <span className="text-sky-400">Mobile Terminal</span>
          </h1>

          <p className="text-slate-300 text-xs leading-relaxed max-w-xs">
            Secure proctored exams, live PDF question papers, built-in camera answer sheet scanner, and instant grading reports.
          </p>
        </div>
      </motion.div>

      {/* 2. Horizontal Feature Carousel Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { label: 'Timed Exam Room', icon: ShieldCheck, color: 'text-sky-500 bg-sky-50 border-sky-200' },
          { label: 'Phone Camera Scanner', icon: FileImage, color: 'text-blue-500 bg-blue-50 border-blue-200' },
          { label: 'Mobile OSM Checking', icon: Award, color: 'text-orange-500 bg-orange-50 border-orange-200' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-2xs shrink-0 font-medium ${item.color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </motion.div>
          );
        })}
      </div>

      {/* 3. Primary Mobile Persona Gateways */}
      <div className="space-y-3.5">
        {/* Student App Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectRole('student')}
          className="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-blue-600 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-snug">Candidate App</h3>
                <p className="text-[11px] text-slate-500">Student Examination Portal</p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-md border border-blue-200">
              Student
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Take live timed examinations</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Snap answer photos &amp; compile PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>View evaluated answer sheets &amp; marks</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Launch Student Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Teacher App Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectRole('teacher')}
          className="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-orange-500 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <School className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-snug">Faculty Console</h3>
                <p className="text-[11px] text-slate-500">Teacher &amp; Evaluator Portal</p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-700 rounded-md border border-orange-200">
              Teacher
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Grade papers with Mobile Touch OSM</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Real-time anti-cheat surveillance feed</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Create, schedule, &amp; manage exams</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Launch Faculty Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </div>

      {/* 4. Mobile System Trust Card */}
      <div className="p-3.5 rounded-xl bg-slate-200/60 border border-slate-300/60 text-center space-y-1">
        <p className="text-[11px] font-semibold text-slate-700">
          Institutional Mobile Examination Protocol
        </p>
        <p className="text-[10px] text-slate-500">
          Runs directly in your mobile browser with zero app installation. Safe, encrypted, and compliant.
        </p>
      </div>
    </div>
  );
};
