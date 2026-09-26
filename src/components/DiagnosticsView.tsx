import React, { useState } from 'react';
import {
  Activity,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Terminal,
  Shield,
  Cpu,
  Mail,
  ExternalLink,
  Info,
  KeyRound,
} from 'lucide-react';
import { api } from '../services/api.js';

interface DiagnosticsViewProps {
  user?: any;
  token?: string | null;
  onConnect?: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  user,
  token,
  onConnect,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [popupTestResult, setPopupTestResult] = useState<string | null>(null);

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    setErrorStatus(null);
    try {
      const data = await api.runDiagnostics();
      setResults(data);
    } catch (err: any) {
      setErrorStatus(`Diagnostics failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleTestPopup = () => {
    try {
      const testWindow = window.open('about:blank', '_blank', 'width=100,height=100');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        setPopupTestResult('blocked');
      } else {
        testWindow.close();
        setPopupTestResult('allowed');
      }
    } catch {
      setPopupTestResult('blocked');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            System Diagnostics & Testing Suite
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Run automated unit and integration tests across the Gmail API, Gemini AI pipeline, MIME parser, and safety engine.
          </p>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={isRunning}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          {isRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>{isRunning ? 'Executing Tests...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {errorStatus && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorStatus}</span>
        </div>
      )}

      {/* Gmail Connection & OAuth Inspector */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-indigo-500" />
          Gmail Integration & OAuth 2.0 Connection State
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Item 1: Scope */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-[11px] text-slate-400 font-medium">OAuth 2.0 Scope</span>
            <div className="flex items-center gap-1.5 mt-1 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>gmail.modify</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Configured in Google Cloud project</p>
          </div>

          {/* Item 2: User Session */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-[11px] text-slate-400 font-medium">User Gmail Account</span>
            <div className="flex items-center gap-1.5 mt-1 font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
              {user ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">{user.email || 'Authenticated'}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Not Connected</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {token ? 'Access token active in memory' : 'Requires clicking "Connect Gmail"'}
            </p>
          </div>

          {/* Item 3: Pop-up check */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-[11px] text-slate-400 font-medium">Browser Pop-up Status</span>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-xs font-semibold">
                {popupTestResult === 'allowed' && <span className="text-emerald-500">Allowed ✅</span>}
                {popupTestResult === 'blocked' && <span className="text-rose-500">Blocked ❌</span>}
                {!popupTestResult && <span className="text-slate-500">Unchecked</span>}
              </span>
              <button
                onClick={handleTestPopup}
                className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-[10px] font-semibold transition"
              >
                Test Pop-up
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Google sign-in requires popups</p>
          </div>
        </div>

        {/* Action Callout if Disconnected */}
        {!token && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                Why is Gmail not connected yet?
              </p>
              <p className="text-amber-800 dark:text-amber-300 mt-1 text-[11px] max-w-xl">
                When you accepted the setup card in AI Studio, you enabled Gmail API access for this project. Now, you must link your personal Google account so MailPilot can read and reply to your emails.
              </p>
            </div>
            {onConnect && (
              <button
                onClick={onConnect}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer"
              >
                Connect Gmail Now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Scorecard if tests ran */}
      {results && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-slate-400">Total Tests</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {results.summary.total}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-emerald-600">Passed</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {results.summary.passed}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-amber-500">Warnings</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {results.summary.warning}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xs">
            <span className="text-xs text-rose-500">Failed</span>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {results.summary.failed}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Test Results */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-indigo-500" />
          Test Execution Log
        </h2>

        {results ? (
          <div className="space-y-2.5">
            {results.tests.map((t: any, idx: number) => {
              let Icon = CheckCircle2;
              let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';

              if (t.status === 'warning') {
                Icon = AlertTriangle;
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
              } else if (t.status === 'failed') {
                Icon = XCircle;
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
              }

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 flex items-start gap-3 text-xs"
                >
                  <div className={`p-1.5 rounded-lg border shrink-0 ${badgeColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {t.test}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider">
                        {t.status}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                      {t.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Cpu className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Diagnostic tests have not been run in this session.
            </p>
            <p className="mt-1">
              Click "Run Diagnostics" above to verify end-to-end service readiness.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
