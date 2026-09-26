import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Server,
  Users,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  HelpCircle,
  GitBranch,
} from 'lucide-react';

interface QuickStartProps {
  onSimulateTest?: (type: 'meeting' | 'support' | 'security' | 'sales') => void;
  onNavigateTab?: (tab: string) => void;
}

const STORAGE_KEY = 'mailpilot_quickstart_dismissed';

export const QuickStartWalkthrough: React.FC<QuickStartProps> = ({
  onSimulateTest,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        // Show after a brief delay for a pleasant entrance
        const timer = setTimeout(() => setIsOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
  };

  const handleReset = () => {
    setStep(0);
    setIsOpen(true);
  };

  const tourSteps = [
    {
      title: 'Autonomous AI Mode vs Review Queue',
      icon: Zap,
      accent: 'emerald',
      content:
        'Switch between Autonomous Mode (direct auto-replies) and Review Queue mode (human-in-the-loop approvals) from the header switch at any time.',
      actionLabel: 'Check Review Queue',
      action: () => onNavigateTab?.('queue'),
    },
    {
      title: 'Instant Simulation Sandbox',
      icon: Sparkles,
      accent: 'indigo',
      content:
        'Want to see how MailPilot handles incoming inquiries? Click "Simulate Incoming" in the top bar to test realistic customer scenarios and safety filters.',
      actionLabel: 'Simulate Meeting Email',
      action: () => onSimulateTest?.('meeting'),
    },
    {
      title: 'Testing the 24/7 Background Daemon',
      icon: Server,
      accent: 'sky',
      content:
        'MailPilot includes a production background daemon that polls Gmail autonomously around the clock. Click "Run Daemon Poll Now" in the Hosting tab to test manual sync cycles and inspect logs.',
      actionLabel: 'Test Background Daemon',
      action: () => onNavigateTab?.('hosting'),
    },
    {
      title: 'Toggling Custom Rules',
      icon: GitBranch,
      accent: 'purple',
      content:
        'Easily toggle automation rules on or off, adjust triage conditions, or route high-priority customer leads to custom AI tones from the Rules Builder.',
      actionLabel: 'View Custom Rules',
      action: () => onNavigateTab?.('rules'),
    },
    {
      title: 'Multi-Account Google Switcher',
      icon: Users,
      accent: 'amber',
      content:
        'Toggle seamlessly between personal Gmail and professional Google Workspace accounts with 1-click in the top-right account menu.',
      actionLabel: 'Got It & Close Tour',
      action: handleDismiss,
    },
  ];

  const current = tourSteps[step];
  const StepIcon = current.icon;

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-30">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-md hover:bg-slate-50 dark:hover:bg-slate-850 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
          title="Open Quick-Start Walkthrough"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
          <span>Quick Tour</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-sm sm:max-w-md w-full px-3 sm:px-0 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md p-4 space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <StepIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Step {step + 1} of {tourSteps.length}
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {current.title}
              </h4>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close walkthrough"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {current.content}
        </p>

        {/* Action + Step Navigation */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
                title="Previous step"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {step < tourSteps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition active:scale-95 cursor-pointer shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Finish Tour</span>
              </button>
            )}
          </div>

          {current.action && (
            <button
              onClick={() => {
                current.action();
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {current.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
