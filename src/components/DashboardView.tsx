import React from 'react';
import {
  Inbox,
  Sparkles,
  Send,
  FileEdit,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  Server,
} from 'lucide-react';
import { ActivityLog, BillingUsage, EmailMessage, ReplyMode } from '../../server/types.js';

interface DashboardViewProps {
  stats: {
    processedToday: number;
    repliesGenerated: number;
    repliesSent: number;
    draftsCreated: number;
    pendingApprovals: number;
    replyMode: ReplyMode;
  };
  billing: BillingUsage | null;
  activities: ActivityLog[];
  recentEmails: EmailMessage[];
  onSelectEmail: (id: string) => void;
  onNavigateTab: (tab: any) => void;
  onSimulate: (type: any) => void;
  user?: any;
  token?: string | null;
  onConnect?: () => void;
  onModeChange?: (mode: ReplyMode) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  billing,
  activities,
  recentEmails,
  onSelectEmail,
  onNavigateTab,
  onSimulate,
  user,
  token,
  onConnect,
  onModeChange,
}) => {
  const [showTroubleshoot, setShowTroubleshoot] = React.useState(false);
  const quotaPercent = billing
    ? Math.min(Math.round((billing.usedThisMonth / billing.monthlyQuota) * 100), 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Gmail Disconnected Action Banner */}
      {!token && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20 p-5 sm:p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                  Connection Action Required
                </span>
                <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  Google Workspace Scope Enabled
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Connect your Gmail Account to begin auto-replying
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                You've configured Gmail permissions in AI Studio. Now, sign in with your Google account (<span className="font-semibold text-slate-900 dark:text-white">hack73069@gmail.com</span>) to grant MailPilot permission to read your incoming emails and compose smart replies.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              {onConnect && (
                <button
                  onClick={onConnect}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition hover:scale-[1.02] cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Connect Gmail Account</span>
                </button>
              )}
              <button
                onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                className="px-3 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition text-center cursor-pointer"
              >
                {showTroubleshoot ? 'Hide Help' : 'Why is Gmail not connecting?'}
              </button>
            </div>
          </div>

          {/* Expandable Troubleshooter */}
          {showTroubleshoot && (
            <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">
                  1. Check Pop-up Blocker
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Browsers often block popups in web previews. Look in your browser URL bar for the blocked popup icon and allow popups for this site.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">
                  2. Two-Step Authorization
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Step 1 (done): OAuth scopes registered in Google Cloud. Step 2 (needed): Clicking "Connect Gmail" grants access to your individual mailbox.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">
                  3. In-Memory Security
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Tokens are stored securely in-memory. If you reload the page, click "Connect Gmail" once to re-authenticate your session.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Welcome & Status Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs text-indigo-100">
              <span className="flex items-center gap-1.5 font-medium">
                <span className={`w-2 h-2 rounded-full ${token ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{token ? 'Gmail Connected' : 'Demo / Standby'}</span>
              </span>
              <span aria-hidden="true" className="text-indigo-300/60">·</span>
              <span>
                Mode: <strong className="capitalize text-white">{stats.replyMode}</strong>
              </span>
              <span aria-hidden="true" className="text-indigo-300/60">·</span>
              <span className="text-emerald-300">24/7 Server Daemon Active</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              MailPilot AI Command Center
            </h1>
            <p className="text-sm text-indigo-100/90 mt-1 max-w-2xl">
              {token
                ? `Actively connected to ${user?.email || 'Gmail'}. Background daemon checks inbox every 45s and generates thread-aware replies.`
                : 'Connect your Gmail account or simulate live email scenarios to test instant automated responses.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onSimulate('meeting')}
              className="px-4 py-2.5 rounded-xl bg-white text-indigo-950 font-semibold text-xs hover:bg-indigo-50 shadow-md transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-4 h-4 text-indigo-600" />
              <span>Simulate Email</span>
            </button>
            <button
              onClick={() => onNavigateTab('hosting')}
              className="px-4 py-2.5 rounded-xl bg-indigo-700/80 border border-indigo-400/40 text-white font-semibold text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Server className="w-4 h-4 text-emerald-300" />
              <span>24/7 Hosting</span>
            </button>
          </div>
        </div>
      </div>

      {/* Autonomous Auto-Reply Control Bar */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Autonomous Auto-Reply Engine
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{stats.replyMode === 'automatic' ? 'Autonomous Mode (Direct Send)' : 'Approval Mode'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
              {stats.replyMode === 'automatic'
                ? 'Incoming emails are analyzed with Gemini and thread-aware replies are dispatched immediately without asking permission from you.'
                : 'Currently requiring manual confirmation. Click "Enable Autonomous Mode" to send replies automatically without asking permission.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {stats.replyMode !== 'automatic' && onModeChange && (
            <button
              onClick={() => onModeChange('automatic')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Enable Autonomous Mode</span>
            </button>
          )}
          <button
            onClick={() => onSimulate('meeting')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Test Auto-Reply</span>
          </button>
          <button
            onClick={() => onNavigateTab('rules')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer whitespace-nowrap"
          >
            Rules & Safeguards
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Processed Today */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Processed Today
            </span>
            <Inbox className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.processedToday}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" /> Inbound parsed
          </span>
        </div>

        {/* AI Replies Generated */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Generated Replies
            </span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.repliesGenerated}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Contextual drafts</span>
        </div>

        {/* Replies Sent */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Replies Sent
            </span>
            <Send className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {stats.repliesSent}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Auto & approved</span>
        </div>

        {/* Drafts Saved */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Drafts in Gmail
            </span>
            <FileEdit className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {stats.draftsCreated}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Saved to mailbox</span>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Needs Review
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            {stats.pendingApprovals}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Awaiting approval</span>
        </div>

        {/* Monthly Plan Quota */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Quota
            </span>
            <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
              {billing?.plan || 'Free'}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {billing?.usedThisMonth || 0} / {billing?.monthlyQuota || 50}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Activity Pipeline & Recent Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Activity Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Real-Time Execution Pipeline</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Email Received &rarr; AI Analyzed &rarr; Safety Checked &rarr; Action Executed
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('inbox')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View All Inbound <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {activities.slice(0, 7).map((act) => {
              let badgeBg = 'bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-300';
              let Icon = Inbox;

              if (act.type === 'email_received') {
                Icon = Inbox;
                badgeBg = 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50';
              } else if (act.type === 'ai_analyzed') {
                Icon = Sparkles;
                badgeBg = 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50';
              } else if (act.type === 'reply_generated') {
                Icon = FileEdit;
                badgeBg = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50';
              } else if (act.type === 'reply_sent') {
                Icon = Send;
                badgeBg = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50';
              } else if (act.type === 'approval_queued') {
                Icon = Clock;
                badgeBg = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/50';
              } else if (act.type === 'rule_triggered') {
                Icon = Shield;
                badgeBg = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/50';
              }

              return (
                <div
                  key={act.id}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750/50 transition border border-slate-100 dark:border-slate-700/40 text-xs"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${badgeBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {act.subject}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                      {act.details}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      From: {act.sender}
                    </span>
                  </div>
                </div>
              );
            })}

            {activities.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                No activity yet. Connect Gmail or click "Simulate Email Event" above.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Review & Safeguards Summary */}
        <div className="space-y-6">
          {/* Quick Review Widget */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Needs Approval</span>
              </h3>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                {stats.pendingApprovals}
              </span>
            </div>

            <div className="space-y-2.5">
              {recentEmails
                .filter((e) => e.status === 'in_review')
                .slice(0, 3)
                .map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      onSelectEmail(msg.id);
                      onNavigateTab('inbox');
                    }}
                    className="p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400 transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {msg.senderName || msg.senderEmail}
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        {msg.analysis?.category?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium mt-1 line-clamp-1">
                      {msg.subject}
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1 italic">
                      "{msg.suggestedReply?.content || msg.snippet}"
                    </p>
                  </div>
                ))}

              {recentEmails.filter((e) => e.status === 'in_review').length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  Review queue is clean!
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigateTab('queue')}
              className="w-full mt-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            >
              Open Review Queue
            </button>
          </div>

          {/* Active Safeguards Status */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Safety & Policy Guardrails</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Zero-risk enterprise filters actively protecting your inbox:
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Password resets & 2FA strictly blocked</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Financial & wire demands hard-gated</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Confidence &ge; 90% required for auto-send</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>RFC 2822 In-Reply-To thread integrity</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('safety')}
              className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Configure Safety Safeguards &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
