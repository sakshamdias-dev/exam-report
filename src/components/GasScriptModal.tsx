import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode, ExternalLink, HelpCircle, Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { GAS_SCRIPT_CODE } from '../services/gasCode';

interface GasScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GasScriptModal: React.FC<GasScriptModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'instructions'>('code');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([GAS_SCRIPT_CODE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Google Apps Script Backend (`Code.gs`)</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                  Google Sheets + Drive
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ready-to-deploy script for Google Sheets database & Google Drive PDF storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Code.gs'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download .gs</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-100 px-6 bg-white">
          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'code'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Complete Source Code</span>
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'instructions'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Deployment Guide (4 Simple Steps)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {activeTab === 'code' ? (
            <div className="relative">
              <pre className="font-mono text-xs text-slate-800 bg-white p-5 rounded-xl border border-slate-200 overflow-x-auto leading-relaxed shadow-xs selection:bg-indigo-500 selection:text-white">
                {GAS_SCRIPT_CODE}
              </pre>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm">
                <div className="font-bold text-indigo-800 mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Zero Additional Setup Required
                </div>
                The script automatically auto-creates all 6 required spreadsheet tabs (<code>Users</code>, <code>Exam</code>, <code>Submissions</code>, <code>Poctor_Logs</code>, <code>Paper</code>, <code>Doubt</code>), headers, and creates a Google Drive folder for storing uploaded PDFs with viewer permissions!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <h4 className="text-base font-bold text-slate-900">Create Google Sheet</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Open a new Google Sheet (or use an existing one). Go to <strong>Extensions &gt; Apps Script</strong> in the top menu bar.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <h4 className="text-base font-bold text-slate-900">Paste Code.gs</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Erase any existing code in the Apps Script editor, copy the entire <code>Code.gs</code> script using the button above, and paste it into the editor. Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">Ctrl+S</kbd> to save.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      3
                    </span>
                    <h4 className="text-base font-bold text-slate-900">Deploy as Web App</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Click <strong>Deploy &gt; New deployment</strong>. Click the gear icon and select <strong>Web app</strong>. Set:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <strong>Execute as:</strong> "Me"
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <strong>Who has access:</strong> "Anyone"
                    </li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      4
                    </span>
                    <h4 className="text-base font-bold text-slate-900">Connect Portal</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Copy the resulting <strong>Web App URL</strong> (ends in <code>/exec</code>) and paste it into the <strong>Apps Script Settings</strong> dialog in this portal.
                  </p>
                </div>
              </div>

              {/* Default Accounts Info */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Auto-Seeded Default Accounts in `Users` Tab
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold text-[10px] uppercase">
                      Teacher Account
                    </span>
                    <p className="text-slate-800 font-mono mt-1.5">User ID: <strong className="text-emerald-700">TCH-801</strong></p>
                    <p className="text-slate-600 font-mono">Password: <strong className="text-slate-800">admin123</strong></p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-[10px] uppercase">
                      Student Account
                    </span>
                    <p className="text-slate-800 font-mono mt-1.5">User ID: <strong className="text-emerald-700">STU-101</strong></p>
                    <p className="text-slate-600 font-mono">Password: <strong className="text-slate-800">pass123</strong></p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
