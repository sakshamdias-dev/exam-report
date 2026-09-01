import React, { useState, useEffect } from 'react';
import { X, Globe, Zap, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldCheck, ExternalLink } from 'lucide-react';
import { executeGasAction, getGasConfig, saveGasConfig } from '../services/api';

interface GasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const GasSettingsModal: React.FC<GasSettingsModalProps> = ({ isOpen, onClose, onConfigChanged }) => {
  const [webAppUrl, setWebAppUrl] = useState('');
  const [mode, setMode] = useState<'live' | 'simulator'>('simulator');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getGasConfig();
      setWebAppUrl(cfg.webAppUrl || '');
      setMode(cfg.mode || 'simulator');
      setTestResult(null);
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Save temporarily to test
      saveGasConfig({ webAppUrl, mode });
      const res = await executeGasAction('initSheets', {});
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || 'Connected successfully to Google Apps Script & Sheets database!',
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Failed to connect. Please verify the URL and deployment settings.',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Network error attempting to contact Google Apps Script.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveGasConfig({ webAppUrl: webAppUrl.trim(), mode });
    setSaved(true);
    onConfigChanged();
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Google Apps Script Integration</h3>
              <p className="text-xs text-slate-500">Connect to your live Google Sheet + Drive or use Simulator</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 bg-white">
          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Operation Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('simulator')}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  mode === 'simulator'
                    ? 'border-indigo-600 bg-indigo-50/60 text-slate-900 ring-1 ring-indigo-500/30'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">Built-in Simulator</span>
                  {mode === 'simulator' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-xs text-slate-500">
                  Instant demo mode with pre-seeded data in browser storage.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('live')}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  mode === 'live'
                    ? 'border-emerald-600 bg-emerald-50/60 text-slate-900 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">Live Google Apps Script</span>
                  {mode === 'live' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500">
                  Direct live connection to your deployed Google Sheets &amp; Drive.
                </p>
              </button>
            </div>
          </div>

          {/* Web App URL Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Google Apps Script Web App URL
              </label>
              <span className="text-[11px] text-slate-500">Ends in <code>/exec</code></span>
            </div>
            <div className="relative">
              <input
                type="url"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Paste the URL generated when deploying your Apps Script as a Web App (with <em>"Who has access: Anyone"</em>).
            </p>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs border flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              )}
              <div>
                <p className="font-bold">{testResult.success ? 'Connection Verified' : 'Connection Error'}</p>
                <p className="opacity-90 mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={testing || (mode === 'live' && !webAppUrl.trim())}
              onClick={handleTestConnection}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all border border-slate-200 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test Connection / Ping'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                {saved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />}
                <span>{saved ? 'Saved!' : 'Save & Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
