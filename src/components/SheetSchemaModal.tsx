import React from 'react';
import { X, Table, Database, Users, Calendar, FileCheck, ShieldAlert, BookOpen, MessageSquareQuote } from 'lucide-react';

interface SheetSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SheetSchemaModal: React.FC<SheetSchemaModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sheets = [
    {
      name: 'Users',
      icon: Users,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      description: 'Dynamic user authentication registry for student and teacher credentials.',
      schema: ['UserId', 'Password', 'Role', 'Name'],
      examples: [
        ['TCH-801', 'admin123', 'teacher', 'Head Teacher - Dr. Evelyn Vance'],
        ['STU-101', 'pass123', 'student', 'Demo Student - Alex Morgan'],
        ['STU-102', 'pass123', 'student', 'Student - Priya Sharma'],
      ],
    },
    {
      name: 'Exam',
      icon: Calendar,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      description: 'Scheduled examination records with start/end time windows and Drive Question Paper URLs.',
      schema: ['ExamId', 'StartTime', 'EndTime', 'QPUrl', 'CreatedAt'],
      examples: [
        ['EXAM-CS301', '2026-08-29T10:00:00Z', '2026-08-29T12:00:00Z', 'https://drive.google.com/file/d/.../view', '2026-08-28T09:00:00Z'],
        ['EXAM-MATH204', '2026-08-29T14:00:00Z', '2026-08-29T16:00:00Z', 'https://drive.google.com/file/d/.../view', '2026-08-28T10:30:00Z'],
      ],
    },
    {
      name: 'Submissions',
      icon: FileCheck,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      description: 'Candidate answer sheet uploads, timestamps, evaluation status, graded Drive PDF, and scores.',
      schema: ['StudentId', 'ExamId', 'SubmissionUrl', 'SubmittedAt', 'GradedUrl', 'Score'],
      examples: [
        ['STU-101', 'EXAM-PHY101', 'https://drive.google.com/file/d/.../view', '2026-08-27T11:45:00Z', 'https://drive.google.com/file/d/.../view', '71'],
        ['STU-102', 'EXAM-PHY101', 'https://drive.google.com/file/d/.../view', '2026-08-27T11:58:00Z', '', ''],
      ],
    },
    {
      name: 'Poctor_Logs',
      icon: ShieldAlert,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      description: 'Continuous anti-cheat surveillance events (tab switches, window blur, developer tools, fullscreen exits).',
      schema: ['Timestamp', 'ExamId', 'StudentId', 'ActionType', 'Details'],
      examples: [
        ['2026-08-29T10:05:12Z', 'EXAM-CS301', 'STU-101', 'EXAM_START', 'Candidate agreed to proctoring policy'],
        ['2026-08-29T10:24:45Z', 'EXAM-CS301', 'STU-101', 'WINDOW_BLUR', 'Switched focus away from exam tab for 3.2s'],
      ],
    },
    {
      name: 'Paper',
      icon: BookOpen,
      color: 'text-violet-700 bg-violet-50 border-violet-200',
      description: 'Detailed subject mapping, total exam marks, and master paper file links.',
      schema: ['PaperId', 'ExamId', 'Subject', 'TotalMarks', 'FileUrl'],
      examples: [
        ['PPR-CS301', 'EXAM-CS301', 'Advanced Data Structures & Algorithms', '100', 'https://drive.google.com/file/d/.../view'],
        ['PPR-MATH204', 'EXAM-MATH204', 'Multivariable Calculus & Differential Equations', '80', 'https://drive.google.com/file/d/.../view'],
      ],
    },
    {
      name: 'Doubt',
      icon: MessageSquareQuote,
      color: 'text-pink-700 bg-pink-50 border-pink-200',
      description: 'Live real-time student Q&A during examinations with teacher response broadcast.',
      schema: ['DoubtId', 'StudentId', 'ExamId', 'Question', 'Answer', 'Status', 'CreatedAt'],
      examples: [
        ['DBT-001', 'STU-101', 'EXAM-CS301', 'Is memory complexity required in Big-O notation for Q2?', 'Yes, state both Time and Space.', 'ANSWERED', '2026-08-29T10:18:00Z'],
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Google Sheets Database Architecture</h3>
              <p className="text-xs text-slate-500">
                6 Standardized Worksheet Tabs with Schema &amp; Data Types
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {sheets.map((sheet) => {
            const Icon = sheet.icon;
            return (
              <div key={sheet.name} className="rounded-2xl bg-white border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${sheet.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">`{sheet.name}` Tab</h4>
                        <span className="text-[10px] px-2 py-0.5 font-mono font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {sheet.schema.length} Columns
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{sheet.description}</p>
                    </div>
                  </div>
                </div>

                {/* Schema Pill Row */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                    Column Headers Schema:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sheet.schema.map((col, idx) => (
                      <span
                        key={col}
                        className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-800"
                      >
                        <span className="text-indigo-600 mr-1">#{idx + 1}</span> {col}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sample Rows Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {sheet.schema.map((col) => (
                          <th key={col} className="px-3 py-2 border-b border-slate-200 font-bold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {sheet.examples.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 whitespace-nowrap max-w-xs truncate">
                              {cell || <span className="text-slate-400 italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
