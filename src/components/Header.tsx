import React, { useState } from 'react';
import {
  Mail,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Bell,
  Sun,
  Moon,
  LogOut,
  Send,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ChevronDown,
  UserPlus,
  Building2,
  User as UserIcon,
  Trash2,
  Check,
} from 'lucide-react';
import {
  googleSignIn,
  logout,
  getConnectedAccounts,
  switchConnectedAccount,
  removeConnectedAccount,
  ConnectedGoogleAccount,
} from '../services/auth.js';
import { api } from '../services/api.js';
import { ReplyMode } from '../../server/types.js';
import { toast } from '../services/toast.js';

interface HeaderProps {
  user: any;
  token: string | null;
  replyMode: ReplyMode;
  onModeChange: (mode: ReplyMode) => void;
  onRefresh: () => void;
  onSimulate: (type: 'meeting' | 'support' | 'security' | 'sales') => void;
  onSignInSuccess?: (user: any, token: string) => void;
  onSwitchAccount?: (email: string) => Promise<void>;
  isSyncing: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  unreadApprovalsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  token,
  replyMode,
  onModeChange,
  onRefresh,
  onSimulate,
  onSignInSuccess,
  onSwitchAccount,
  isSyncing,
  theme,
  onToggleTheme,
  unreadApprovalsCount,
}) => {
  const [showAutoWarningModal, setShowAutoWarningModal] = useState(false);
  const [showTroubleshootModal, setShowTroubleshootModal] = useState(false);
  const [showSimulateMenu, setShowSimulateMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);

  const connectedAccounts = getConnectedAccounts();

  const handleModeSelect = (newMode: ReplyMode) => {
    onModeChange(newMode);
    toast.info(`Auto-reply mode switched to: ${newMode === 'automatic' ? 'Autonomous Mode' : newMode === 'approval' ? 'Review Queue' : 'Manual Mode'}`);
  };

  const confirmAutoMode = () => {
    onModeChange('automatic');
    toast.info('Autonomous Mode active: direct AI replies will be dispatched without asking permission');
    setShowAutoWarningModal(false);
  };

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        toast.success(`Connected as ${result.user.displayName || result.user.email}!`);
        if (onSignInSuccess) {
          onSignInSuccess(result.user, result.accessToken);
        }
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      toast.error(err.message || 'Failed to complete Google Sign-in.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setShowAccountSwitcher(false);
    toast.info('Signed out of Gmail.');
    onRefresh();
  };

  const handleSwitchAccount = async (targetEmail: string) => {
    setSwitchingEmail(targetEmail);
    setShowAccountSwitcher(false);
    try {
      if (onSwitchAccount) {
        await onSwitchAccount(targetEmail);
      } else {
        await switchConnectedAccount(targetEmail);
        onRefresh();
      }
      toast.success(`Switched active inbox to ${targetEmail}`);
    } catch (err: any) {
      toast.error(`Failed to switch account: ${err.message}`);
    } finally {
      setSwitchingEmail(null);
    }
  };

  const handleRemoveAccount = async (targetEmail: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeConnectedAccount(targetEmail);
      toast.info(`Account ${targetEmail} removed from switcher.`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to remove account: ${err.message}`);
    }
  };

  const handleAddAnotherAccount = async () => {
    setShowAccountSwitcher(false);
    await handleSignIn();
  };

  const handleSimulateWithToast = (type: 'meeting' | 'sales' | 'security') => {
    onSimulate(type);
    toast.info(`Simulated incoming ${type} email. Processing through AI triage pipeline.`);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden shadow-sm shadow-emerald-500/20 ring-1 ring-slate-200 dark:ring-slate-800 bg-slate-900 flex items-center justify-center shrink-0 group transition-transform duration-200 hover:scale-105">
              <img
                src="/mailpilot-logo.svg"
                alt="MailPilot AI Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none transition-transform duration-300 group-hover:scale-110"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  MailPilot<span className="text-emerald-600 dark:text-emerald-400">AI</span>
                </span>
                <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>24/7 Daemon Active</span>
                </span>
              </div>
            </div>
          </div>

          {/* Zone 2: Reply Mode Segmented Control */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleModeSelect('automatic')}
              title="Autonomous Mode: Incoming emails are automatically analyzed and answered immediately without asking permission"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                replyMode === 'automatic'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Autonomous (Direct Send)</span>
            </button>
            <button
              onClick={() => handleModeSelect('approval')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                replyMode === 'approval'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Review Queue</span>
              {unreadApprovalsCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                  {unreadApprovalsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleModeSelect('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                replyMode === 'manual'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Manual
            </button>
          </div>

          {/* Right Controls: Sync, Simulate, Notifications, Theme, Account */}
          <div className="flex items-center gap-2">
            {/* Sync Gmail */}
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              title="Sync latest emails from Gmail API"
              className="ripple-feedback flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Gmail'}</span>
            </button>

            {/* Simulate Dropdown for testing */}
            <div className="relative">
              <button
                onClick={() => setShowSimulateMenu(!showSimulateMenu)}
                className="ripple-feedback flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Simulate Incoming</span>
              </button>
              {showSimulateMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 text-xs"
                  onClick={() => setShowSimulateMenu(false)}
                >
                  <p className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Simulate Live Event
                  </p>
                  <button
                    onClick={() => handleSimulateWithToast('meeting')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all active:scale-95 cursor-pointer"
                  >
                    <span>📅 Meeting Request</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                      Safe
                    </span>
                  </button>
                  <button
                    onClick={() => handleSimulateWithToast('sales')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all active:scale-95 cursor-pointer"
                  >
                    <span>💼 Enterprise Inquiry</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                      Inquiry
                    </span>
                  </button>
                  <button
                    onClick={() => handleSimulateWithToast('security')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all active:scale-95 cursor-pointer"
                  >
                    <span>🛡️ Security Alert (Sensitive)</span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded">
                      Blocked
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition relative"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadApprovalsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Notifications
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {unreadApprovalsCount} pending reviews
                    </span>
                  </div>
                  {unreadApprovalsCount > 0 ? (
                    <div className="space-y-2">
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 text-xs">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                          {unreadApprovalsCount} email{unreadApprovalsCount > 1 ? 's' : ''} awaiting approval
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                          Review generated replies in the Review Queue before sending.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                      All caught up! No pending approvals.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Day / Night Theme Switch with Fluid Micro-Animations */}
            <div
              onClick={onToggleTheme}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleTheme();
                }
              }}
              title={`Currently in ${theme === 'dark' ? 'Night (Dark)' : 'Day (Light)'} mode. Click to switch to ${theme === 'dark' ? 'Day (Light)' : 'Night (Dark)'} mode.`}
              aria-label="Toggle Day and Night mode"
              className="relative flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 text-xs font-medium cursor-pointer select-none transition-shadow hover:shadow-xs group"
            >
              {/* Fluid Sliding Background Capsule */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  theme === 'light'
                    ? 'left-1 bg-white shadow-xs border border-amber-200/50'
                    : 'left-[calc(50%)] bg-slate-900 shadow-xs border border-indigo-500/30'
                }`}
              />

              {/* Day Option */}
              <div
                className={`relative z-10 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200 ${
                  theme === 'light'
                    ? 'text-amber-700 font-bold'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Sun
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    theme === 'light'
                      ? 'text-amber-500 fill-amber-500/30 animate-theme-sun scale-110'
                      : 'text-slate-400 scale-95 group-hover:rotate-45'
                  }`}
                />
                <span className="hidden sm:inline text-[11px] tracking-tight">Day</span>
              </div>

              {/* Night Option */}
              <div
                className={`relative z-10 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200 ${
                  theme === 'dark'
                    ? 'text-indigo-300 font-bold'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                <Moon
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    theme === 'dark'
                      ? 'text-indigo-400 fill-indigo-400/30 animate-theme-moon scale-110'
                      : 'text-slate-400 scale-95 group-hover:-rotate-12'
                  }`}
                />
                <span className="hidden sm:inline text-[11px] tracking-tight">Night</span>
              </div>
            </div>

            {/* Multi-Account Switcher & Google Sign In */}
            {user && token ? (
              <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer group shadow-2xs"
                  title="Switch between connected Google accounts or add another workspace inbox"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {(user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}

                  <div className="hidden sm:flex flex-col text-left leading-none">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                        {user.displayName || user.email}
                      </span>
                      {user.email && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                            !(
                              user.email.toLowerCase().endsWith('@gmail.com') ||
                              user.email.toLowerCase().endsWith('@googlemail.com')
                            )
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {!(
                            user.email.toLowerCase().endsWith('@gmail.com') ||
                            user.email.toLowerCase().endsWith('@googlemail.com')
                          )
                            ? 'Workspace'
                            : 'Personal'}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="truncate max-w-[110px]">{user.email}</span>
                    </span>
                  </div>

                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                      showAccountSwitcher ? 'rotate-180 text-indigo-500' : ''
                    }`}
                  />
                </button>

                {/* Account Switcher Dropdown Menu */}
                {showAccountSwitcher && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowAccountSwitcher(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-2.5 animate-in fade-in duration-150">
                      {/* Header */}
                      <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>Connected Google Accounts</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-500 font-semibold">
                              {connectedAccounts.length || 1}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Switch active inbox or monitor workspace email
                          </p>
                        </div>
                      </div>

                      {/* Accounts List */}
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                        {(connectedAccounts.length > 0
                          ? connectedAccounts
                          : [
                              {
                                uid: user.uid || 'current',
                                email: user.email,
                                displayName: user.displayName,
                                photoURL: user.photoURL,
                                accessToken: token,
                                isWorkspace: !(
                                  user.email?.toLowerCase().endsWith('@gmail.com') ||
                                  user.email?.toLowerCase().endsWith('@googlemail.com')
                                ),
                                connectedAt: Date.now(),
                                lastActive: Date.now(),
                              },
                            ]
                        ).map((acc) => {
                          const isActive =
                            user?.email?.toLowerCase() === acc.email.toLowerCase();
                          return (
                            <div
                              key={acc.email}
                              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                                isActive
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 shadow-2xs'
                                  : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {acc.photoURL ? (
                                  <img
                                    src={acc.photoURL}
                                    alt={acc.displayName || acc.email}
                                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                                    {(acc.email || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 leading-tight">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                                      {acc.displayName || acc.email.split('@')[0]}
                                    </span>
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                        acc.isWorkspace
                                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                      }`}
                                    >
                                      {acc.isWorkspace ? 'Workspace' : 'Personal'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px] mt-0.5">
                                    {acc.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isActive ? (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                    <Check className="w-3 h-3" />
                                    Active
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSwitchAccount(acc.email)}
                                    disabled={switchingEmail === acc.email}
                                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs"
                                  >
                                    {switchingEmail === acc.email ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      'Switch'
                                    )}
                                  </button>
                                )}

                                {connectedAccounts.length > 1 && (
                                  <button
                                    onClick={(e) => handleRemoveAccount(acc.email, e)}
                                    title={`Disconnect ${acc.email}`}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                        <button
                          onClick={handleAddAnotherAccount}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Connect Another Google Account</span>
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="w-full px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out All Accounts</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="gsi-material-button text-xs py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
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
                  <span>{isLoggingIn ? 'Connecting...' : 'Connect Gmail'}</span>
                </button>
                <button
                  onClick={() => setShowTroubleshootModal(true)}
                  title="Connection Help & Diagnostics"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs transition cursor-pointer"
                >
                  Help
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sign-In Error Toast / Notification */}
      {authError && (
        <div className="bg-rose-50 dark:bg-rose-950/90 border-b border-rose-200 dark:border-rose-800 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                <strong>Gmail Connection Notice:</strong> {authError}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowTroubleshootModal(true)}
                className="px-2.5 py-1 rounded bg-rose-200/80 dark:bg-rose-900 hover:bg-rose-300 dark:hover:bg-rose-800 font-bold text-[11px] transition cursor-pointer"
              >
                Troubleshoot Connection
              </button>
              <button
                onClick={handleSignIn}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={() => setAuthError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded text-base cursor-pointer"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Troubleshoot Connection Modal */}
      {showTroubleshootModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-base">
                <Mail className="w-5 h-5" />
                <h3>Gmail Connection Troubleshooting</h3>
              </div>
              <button
                onClick={() => setShowTroubleshootModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                <p className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                  1. OAuth Permissions vs User Login
                </p>
                <p className="text-indigo-800 dark:text-indigo-300">
                  When you clicked "I accept" in AI Studio, you provisioned the Google Workspace OAuth permissions for this app. To access your personal inbox (<code className="font-mono text-indigo-900 dark:text-indigo-100">hack73069@gmail.com</code>), you must click <strong>"Connect Gmail"</strong> in the app to initiate the user-level Google Sign-In.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
                <p className="font-bold text-amber-900 dark:text-amber-200 mb-1">
                  2. Browser Pop-up Blocker (Most Common Issue)
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  Because this app runs in a web sandbox, your browser might silently block the Google sign-in window. Look in your browser's address bar (URL bar) for a <strong>pop-up blocked</strong> icon. Select <em>"Always allow pop-ups from this site"</em> and click Connect Gmail again.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                  3. In-Memory Security Architecture
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  In compliance with Google API security standards, OAuth access tokens are kept safely in memory only and never stored in persistent local storage. If you refresh the page, click "Connect Gmail" once to restore your active token.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTroubleshootModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowTroubleshootModal(false);
                  handleSignIn();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                Connect Gmail Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Mode Strong Warning Modal */}
      {showAutoWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Enable Automatic Reply Mode?
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              In <strong>Automatic Mode</strong>, MailPilot AI will autonomously compose and dispatch
              live emails through your connected Gmail account without human review whenever confidence
              is &ge; 90% and no security gates are triggered.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 mb-5 space-y-2 text-xs">
              <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Safeguards active: Password resets, invoices, legal notices, and sensitive data are strictly blocked.</span>
              </div>
              <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Double validation: Output is audited for factual grounding before transmission.</span>
              </div>
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>You can switch back to Manual or Approval Queue mode at any time.</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAutoWarningModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAutoMode}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-md shadow-amber-600/30 transition flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                I Understand, Enable Automatic Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
