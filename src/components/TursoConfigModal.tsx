import React, { useState, useEffect } from 'react';
import { 
  getTursoConfig, 
  saveTursoConfig, 
  clearTursoConfig, 
  testTursoConnection, 
  ensureTursoSchema 
} from '../services/tursoService';
import { 
  Zap, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Trash2, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Radio, 
  Key, 
  Copy, 
  Check 
} from 'lucide-react';

interface TursoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: () => void;
}

export const TursoConfigModal: React.FC<TursoConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getTursoConfig();
      setUrl(cfg.url || '');
      setAuthToken(cfg.authToken || '');
      setTestResult(null);
      setSaveSuccess(false);

      if (cfg.isConfigured) {
        // Auto-run a quick ping test
        handleQuickTest(cfg.url, cfg.authToken);
      }
    }
  }, [isOpen]);

  const handleQuickTest = async (testUrl: string, testToken: string) => {
    if (!testUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testTursoConnection(testUrl, testToken);
      setTestResult(res);
      if (res.success) {
        await ensureTursoSchema();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setTestResult({
        success: false,
        error: 'Please enter a valid Turso Database URL (e.g., libsql://your-db-org.turso.io)',
      });
      return;
    }

    setIsTesting(true);
    const testRes = await testTursoConnection(url, authToken);
    setTestResult(testRes);
    setIsTesting(false);

    if (testRes.success) {
      saveTursoConfig(url, authToken);
      await ensureTursoSchema();
      setSaveSuccess(true);
      if (onConfigUpdated) onConfigUpdated();
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
  };

  const handleClear = () => {
    clearTursoConfig();
    setUrl('');
    setAuthToken('');
    setTestResult(null);
    if (onConfigUpdated) onConfigUpdated();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden font-sans my-8">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white flex items-center justify-between border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Turso Edge Realtime Engine</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-mono font-bold">
                  Zero Latency
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Ultra-low latency edge database for streaming student webcams, screen shares &amp; audio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200/80 text-cyan-950 text-xs space-y-2">
            <div className="font-bold flex items-center gap-2 text-cyan-900">
              <Radio className="w-4 h-4 text-cyan-600" />
              <span>Why Turso instead of Google Sheets for Live Video?</span>
            </div>
            <p className="text-cyan-800 text-[11px] leading-relaxed">
              Google Sheets / Google Apps Script takes 2-5 seconds per request and cannot handle 50KB image frames streamed every second from 30+ students. 
              <strong> Turso edge libSQL</strong> processes video frames, mic levels, and teacher warnings in <strong>&lt; 30 milliseconds</strong> with zero bottleneck!
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Turso Database URL</span>
                <a
                  href="https://turso.tech"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[11px] text-[#009fe3] hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Get Free Database (turso.tech)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <div className="relative">
                <Database className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="libsql://your-database-name-org.turso.io"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Turso Auth Token (JWT)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="eyJhbGciOi... (Turso Auth Token)"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Test Status Banner */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>{testResult.success ? 'Connection Successful!' : 'Connection Failed'}</span>
                    {testResult.latencyMs !== undefined && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-emerald-700">
                        ⚡ {testResult.latencyMs} ms latency
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90 leading-snug">
                    {testResult.success
                      ? 'Live proctoring tables automatically synchronized. Camera, screen share, and microphone data are streaming at edge speed.'
                      : testResult.error}
                  </p>
                </div>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Turso configuration successfully saved &amp; activated!</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Settings</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickTest(url, authToken)}
                  disabled={isTesting || !url.trim()}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Test Ping</span>
                </button>

                <button
                  type="submit"
                  disabled={isTesting || !url.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#009fe3] hover:bg-sky-600 rounded-xl transition-all shadow-md shadow-sky-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Save &amp; Activate Engine</span>
                </button>
              </div>
            </div>
          </form>

          {/* Quick Setup Guide */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Quick 60-Second Setup Guide
            </h4>
            <ol className="text-[11px] text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Sign in to <a href="https://turso.tech" target="_blank" rel="noreferrer noopener" className="text-[#009fe3] font-semibold underline">turso.tech</a> (free tier gives 9 Million reads/month).
              </li>
              <li>
                Create a database named <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">examfriendly</code> in your closest region.
              </li>
              <li>
                Copy the <strong>Database URL</strong> (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">libsql://examfriendly-yourname.turso.io</code>).
              </li>
              <li>
                Generate an <strong>Auth Token</strong> from the Turso dashboard or CLI (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">turso db tokens create examfriendly</code>).
              </li>
              <li>
                Paste both fields above and click <strong>Save &amp; Activate Engine</strong>.
              </li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
