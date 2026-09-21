import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileCode,
  ExternalLink,
  HelpCircle,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Settings,
  RefreshCw,
  AlertTriangle,
  HardDrive,
  Database,
  Cloud,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { GAS_SCRIPT_CODE } from '../services/gasCode';
import {
  getGasConfig,
  saveGasConfig,
  clearGasConfig,
  testGasConnection,
  getGasConnectionStatus,
} from '../services/api';

interface GasScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'configure' | 'instructions' | 'code';
}

export const GasScriptModal: React.FC<GasScriptModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'configure',
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'configure' | 'instructions' | 'code'>(initialTab);
  const [webAppUrl, setWebAppUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: number;
    message?: string;
    error?: string;
    is404?: boolean;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getGasConfig();
      setWebAppUrl(cfg.webAppUrl || '');
      setTestResult(null);
      setSavedSuccess(false);
      const status = getGasConnectionStatus();
      if (status.is404) {
        setTestResult({
          success: false,
          status: 404,
          is404: true,
          error: 'Current Google Apps Script URL returned HTTP 404 (Not Found). Please deploy Code.gs with access set to "Anyone".',
        });
      }
    }
  }, [isOpen]);

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

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setSavedSuccess(false);
    try {
      const res = await testGasConnection(webAppUrl.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveGasConfig({ webAppUrl: webAppUrl.trim() });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    clearGasConfig();
    setWebAppUrl('');
    setTestResult(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Google Drive &amp; Apps Script Storage</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                  Supabase + Drive
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Institutional Google Drive PDF storage &amp; Apps Script gateway configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Code.gs' : 'Copy Code.gs'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download .gs</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-100 px-6 bg-white gap-2">
          <button
            onClick={() => setActiveTab('configure')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'configure'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Connection &amp; Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'instructions'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Deployment Guide (4 Steps)</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'code'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Code.gs Source</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {activeTab === 'configure' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Architecture Context Banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5">
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-slate-900 mb-1">Dual High-Availability Storage</div>
                  <p className="text-slate-600 leading-relaxed">
                    <strong>Supabase Database:</strong> Manages all relational data (exams, submissions, marks, users, proctor telemetry).
                    <br />
                    <strong>Google Drive (via Apps Script):</strong> Archives Question Papers &amp; student answer booklets directly to your Google Workspace Drive.
                    <br />
                    <strong>Automatic Offline Fallback:</strong> If Google Drive is not connected or returns 404, files are automatically safeguarded in local IndexedDB &amp; database records so no exam data is ever lost.
                  </p>
                </div>
              </div>

              {/* URL Configuration Form */}
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                    Google Apps Script Web App URL
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Paste your deployed Google Apps Script Web App URL (must end in <code>/exec</code>):
                  </p>
                  <input
                    type="url"
                    value={webAppUrl}
                    onChange={(e) => {
                      setWebAppUrl(e.target.value);
                      setTestResult(null);
                      setSavedSuccess(false);
                    }}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-slate-900"
                  />
                </div>

                {/* Test & Save Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleTest}
                    disabled={testing || !webAppUrl.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Verifying Endpoint...' : 'Test Connection'}</span>
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={!webAppUrl.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Save URL</span>
                  </button>

                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer ml-auto"
                  >
                    <span>Clear / Disconnect</span>
                  </button>
                </div>

                {/* Saved confirmation */}
                {savedSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Google Apps Script configuration saved successfully!</span>
                  </div>
                )}

                {/* Diagnostic Test Result Box */}
                {testResult && (
                  <div
                    className={`p-4 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : testResult.is404
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-2">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Connection Verified (Status: 200 OK)</span>
                        </>
                      ) : testResult.is404 ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>HTTP 404 Not Found — Deployment Required</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span>Connection Check Result</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs">
                      {testResult.message || testResult.error}
                    </p>
                    {testResult.is404 && (
                      <div className="mt-2 pt-2 border-t border-amber-200 text-amber-800 text-[11px] space-y-1">
                        <div className="font-semibold">How to resolve 404 in Google Apps Script:</div>
                        <ol className="list-decimal pl-4 space-y-0.5">
                          <li>Open your Google Sheet &gt; <strong>Extensions &gt; Apps Script</strong>.</li>
                          <li>Click <strong>Deploy &gt; New deployment</strong> (or Manage deployments).</li>
                          <li>Ensure <strong>Execute as</strong> is set to <strong>"Me"</strong>.</li>
                          <li>Ensure <strong>Who has access</strong> is set to <strong>"Anyone"</strong>.</li>
                          <li>Copy the resulting URL that ends in <code>/exec</code> and paste it above.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Checklist */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="font-bold text-slate-900">Current Storage Fallback Status</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Supabase Database: Online</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>IndexedDB Local Storage: Active</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    {testResult?.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>Google Drive PDF Sync: {testResult?.success ? 'Connected' : 'Pending Deployment (Optional)'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>OSM Evaluation &amp; Marks: Ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm">
                <div className="font-bold text-blue-800 mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Zero Additional Setup Required
                </div>
                The script automatically auto-creates all required spreadsheet tabs (<code>Users</code>, <code>Exam</code>, <code>Submissions</code>, <code>Poctor_Logs</code>, <code>Paper</code>, <code>Doubt</code>), headers, and creates a Google Drive folder for storing uploaded PDFs with viewer permissions!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
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
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <h4 className="text-base font-bold text-slate-900">Paste Code.gs</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Erase any existing code in the Apps Script editor, copy the entire <code>Code.gs</code> script using the button in the header, and paste it into the editor. Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">Ctrl+S</kbd> to save.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
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
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      4
                    </span>
                    <h4 className="text-base font-bold text-slate-900">Connect in Portal</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Copy the resulting <strong>Web App URL</strong> (ends in <code>/exec</code>), return to the <strong>Connection &amp; Settings</strong> tab, paste it, and click <strong>Test Connection</strong>.
                  </p>
                </div>
              </div>

              {/* Default Accounts Info */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Auto-Seeded Default Accounts in `Users` Tab
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold text-[10px] uppercase">
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

          {activeTab === 'code' && (
            <div className="relative">
              <pre className="font-mono text-xs text-slate-800 bg-white p-5 rounded-xl border border-slate-200 overflow-x-auto leading-relaxed shadow-xs selection:bg-blue-500 selection:text-white">
                {GAS_SCRIPT_CODE}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
