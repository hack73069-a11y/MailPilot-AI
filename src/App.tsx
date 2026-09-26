import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { Navigation, TabType } from './components/Navigation.js';
import { DashboardView } from './components/DashboardView.js';
import { InboxView } from './components/InboxView.js';
import { ReviewQueueView } from './components/ReviewQueueView.js';
import { RulesBuilderView } from './components/RulesBuilderView.js';
import { PersonalityView } from './components/PersonalityView.js';
import { SafetyView } from './components/SafetyView.js';
import { DiagnosticsView } from './components/DiagnosticsView.js';
import { HostingDaemonView } from './components/HostingDaemonView.js';
import { SettingsView } from './components/SettingsView.js';
import {
  initAuth,
  subscribeAuth,
  getCurrentUser,
  getAccessToken,
  googleSignIn,
  autoReconnectSession,
  clearExpiredSession,
  switchConnectedAccount,
} from './services/auth.js';
import { api } from './services/api.js';
import {
  EmailMessage,
  UserPreferences,
  ReplyRule,
  ApprovalQueueItem,
  ActivityLog,
  BillingUsage,
  ReplyMode,
} from '../server/types.js';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mailpilot_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // App Data
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [queue, setQueue] = useState<ApprovalQueueItem[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [billing, setBilling] = useState<BillingUsage | null>(null);
  const [rules, setRules] = useState<ReplyRule[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncAuthError, setSyncAuthError] = useState<string | null>(null);

  // Theme setup with class, attribute, and storage synchronization
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('mailpilot_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    // Add temporary transitioning class for smooth micro-animations across all UI surfaces
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 450);
  };

  // Fetch all core data
  const refreshAllData = useCallback(async () => {
    try {
      const [prefsData, emailsData, queueData, actsData, billingData, rulesData] =
        await Promise.all([
          api.getSettings().catch(() => null),
          api.getEmails().catch(() => []),
          api.getReviewQueue().catch(() => []),
          api.getActivity().catch(() => []),
          api.getBilling().catch(() => null),
          api.getRules().catch(() => []),
        ]);

      if (prefsData) setPreferences(prefsData);
      setEmails(emailsData);
      setQueue(queueData);
      setActivities(actsData);
      setBilling(billingData);
      setRules(rulesData);
    } catch (err) {
      console.error('Error refreshing applet data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auth initialization
  useEffect(() => {
    const unsubSubscribe = subscribeAuth((authedUser, accessToken) => {
      setUser(authedUser);
      setToken(accessToken);
    });

    const unsubInit = initAuth(
      (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        refreshAllData();
      },
      () => {
        // Token expired or not yet signed in for Gmail scopes
      }
    );

    return () => {
      unsubSubscribe();
      unsubInit();
    };
  }, [refreshAllData]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Autonomous background auto-reply loop with automatic reconnection:
  // Automatically syncs Gmail every 30 seconds when authenticated to process and reply to new emails
  useEffect(() => {
    if (!token) return;

    const intervalId = setInterval(async () => {
      try {
        const activeToken = token || (await getAccessToken());
        if (activeToken) {
          await api.syncGmail();
          await refreshAllData();
          setSyncAuthError(null);
        }
      } catch (err: any) {
        if (err.isAuthError || err.status === 401 || (err.message && err.message.includes('authError'))) {
          // Attempt automatic background reconnection
          try {
            const reconnected = await autoReconnectSession();
            if (reconnected?.accessToken) {
              setUser(reconnected.user);
              setToken(reconnected.accessToken);
              setSyncAuthError(null);
              await api.syncGmail();
              await refreshAllData();
              return;
            }
          } catch {}
          setSyncAuthError('Gmail session expired. Click Reconnect Gmail to renew credentials.');
        } else {
          console.debug('Background auto-sync cycle notice:', err.message);
        }
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [token, refreshAllData]);

  // Mode change handler
  const handleModeChange = async (mode: ReplyMode) => {
    if (!preferences) return;
    try {
      const updated = await api.updateSettings({ replyMode: mode });
      setPreferences(updated);
      refreshAllData();
    } catch (err) {
      console.error('Failed to change mode', err);
    }
  };

  // Sync Gmail with automatic reconnection
  const handleSyncGmail = async (overrideToken?: string) => {
    setIsSyncing(true);
    try {
      const activeToken = overrideToken || token || (await getAccessToken());
      if (activeToken) {
        await api.syncGmail();
        setSyncAuthError(null);
      }
      await refreshAllData();
    } catch (err: any) {
      if (err.isAuthError || err.status === 401 || (err.message && err.message.includes('authError'))) {
        // Attempt automatic reconnection
        try {
          const reconnected = await autoReconnectSession();
          if (reconnected?.accessToken) {
            setUser(reconnected.user);
            setToken(reconnected.accessToken);
            setSyncAuthError(null);
            await api.syncGmail();
            await refreshAllData();
            return;
          }
        } catch {}
        setSyncAuthError('Gmail access token is expired or unauthorized. Click "Reconnect Gmail" to renew your session.');
      } else {
        console.warn('Sync notice:', err.message);
      }
      // Fallback refresh
      await refreshAllData();
    } finally {
      setIsSyncing(false);
    }
  };

  // Multi-account switch handler
  const handleSwitchAccount = async (targetEmail: string) => {
    setIsSyncing(true);
    setSyncAuthError(null);
    try {
      const switched = await switchConnectedAccount(targetEmail);
      if (switched) {
        setUser({
          uid: switched.uid,
          email: switched.email,
          displayName: switched.displayName,
          photoURL: switched.photoURL,
        } as any);
        setToken(switched.accessToken);
        await handleSyncGmail(switched.accessToken);
      }
    } catch (err: any) {
      console.warn('Switch account notice:', err.message);
      if (err.isAuthError || err.status === 401 || (err.message && err.message.includes('authError'))) {
        setSyncAuthError(`Session for ${targetEmail} expired. Click Reconnect Gmail to renew credentials.`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Direct Sign-In Handler
  const handleDirectSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await handleSyncGmail(result.accessToken);
      }
    } catch (err) {
      console.error('Direct sign in error:', err);
    }
  };

  // Simulate email event
  const handleSimulate = async (type: 'meeting' | 'support' | 'security' | 'sales') => {
    setIsSyncing(true);
    try {
      const res = await api.simulateEmail(type);
      await refreshAllData();
      setSelectedEmailId(res.email.id);
      setCurrentTab('inbox');
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute Dashboard stats
  const dashboardStats = {
    processedToday: billing?.totalProcessedEmails || emails.length,
    repliesGenerated: billing?.totalRepliesGenerated || 0,
    repliesSent: billing?.totalRepliesSent || 0,
    draftsCreated: billing?.totalDraftsCreated || 0,
    pendingApprovals: queue.length,
    replyMode: preferences?.replyMode || 'approval',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading MailPilot AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* App Header */}
      <Header
        user={user}
        token={token}
        replyMode={preferences?.replyMode || 'approval'}
        onModeChange={handleModeChange}
        onRefresh={() => handleSyncGmail()}
        onSimulate={handleSimulate}
        onSignInSuccess={async (authedUser, accessToken) => {
          setUser(authedUser);
          setToken(accessToken);
          await handleSyncGmail(accessToken);
        }}
        onSwitchAccount={handleSwitchAccount}
        isSyncing={isSyncing}
        theme={theme}
        onToggleTheme={toggleTheme}
        unreadApprovalsCount={queue.length}
      />

      {/* Tabs Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        pendingApprovalsCount={queue.length}
      />

      {/* Session Expired / Auth Error Notification Banner */}
      {syncAuthError && (
        <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span className="font-medium">
                <strong>Gmail Session Update Needed:</strong> {syncAuthError}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDirectSignIn}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
              >
                Reconnect Gmail
              </button>
              <button
                onClick={() => setSyncAuthError(null)}
                className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-100 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                title="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            stats={dashboardStats}
            billing={billing}
            activities={activities}
            recentEmails={emails}
            onSelectEmail={(id) => {
              setSelectedEmailId(id);
              setCurrentTab('inbox');
            }}
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onSimulate={handleSimulate}
            user={user}
            token={token}
            onConnect={handleDirectSignIn}
            onModeChange={handleModeChange}
          />
        )}

        {currentTab === 'inbox' && (
          <InboxView
            emails={emails}
            selectedEmailId={selectedEmailId}
            onSelectEmail={(id) => setSelectedEmailId(id)}
            onRefresh={refreshAllData}
            token={token}
            onConnect={handleDirectSignIn}
          />
        )}

        {currentTab === 'queue' && (
          <ReviewQueueView
            queue={queue}
            onRefresh={refreshAllData}
            onSelectEmail={(id) => {
              setSelectedEmailId(id);
              setCurrentTab('inbox');
            }}
          />
        )}

        {currentTab === 'rules' && (
          <RulesBuilderView
            rules={rules}
            onRefresh={refreshAllData}
          />
        )}

        {currentTab === 'personality' && preferences && (
          <PersonalityView
            preferences={preferences}
            onRefresh={refreshAllData}
          />
        )}

        {currentTab === 'safety' && preferences && (
          <SafetyView
            preferences={preferences}
            onRefresh={refreshAllData}
          />
        )}

        {currentTab === 'hosting' && (
          <HostingDaemonView
            user={user}
            token={token}
            onRefreshAll={refreshAllData}
          />
        )}

        {currentTab === 'diagnostics' && (
          <DiagnosticsView
            user={user}
            token={token}
            onConnect={handleDirectSignIn}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            billing={billing}
            onRefresh={refreshAllData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 px-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            MailPilot AI &bull; Official Google Workspace OAuth 2.0 & Gmail API Compliance
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab('safety')}
              className="hover:text-slate-600 dark:hover:text-slate-300"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setCurrentTab('diagnostics')}
              className="hover:text-slate-600 dark:hover:text-slate-300"
            >
              API Diagnostics
            </button>
            <span>v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
