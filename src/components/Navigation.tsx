import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  GitBranch,
  UserCheck,
  ShieldCheck,
  Server,
  Activity,
  Settings,
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'inbox'
  | 'queue'
  | 'rules'
  | 'personality'
  | 'safety'
  | 'hosting'
  | 'diagnostics'
  | 'settings';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  pendingApprovalsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  pendingApprovalsCount,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox AI', icon: Inbox },
    {
      id: 'queue',
      label: 'Review Queue',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { id: 'rules', label: 'Smart Rules', icon: GitBranch },
    { id: 'personality', label: 'AI Voice & Tone', icon: UserCheck },
    { id: 'hosting', label: '24/7 Server Daemon', icon: Server },
    { id: 'safety', label: 'Safety & Security', icon: ShieldCheck },
    { id: 'diagnostics', label: 'Test Suite', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
