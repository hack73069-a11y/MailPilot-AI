import React, { useState, useEffect } from 'react';
import {
  Settings,
  CreditCard,
  Cpu,
  Bell,
  Check,
  Zap,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { BillingUsage } from '../../server/types.js';
import { api } from '../services/api.js';

interface SettingsViewProps {
  billing: BillingUsage | null;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  billing,
  onRefresh,
}) => {
  const [adminConfig, setAdminConfig] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [browserNotificationStatus, setBrowserNotificationStatus] = useState<string>('default');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    if ('Notification' in window) {
      setBrowserNotificationStatus(Notification.permission);
    }
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await api.getAdminConfig();
      setAdminConfig(cfg);
      if (cfg.provider) setSelectedProvider(cfg.provider);
      if (cfg.model) setSelectedModel(cfg.model);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAIConfig = async () => {
    try {
      await api.updateAdminConfig({
        provider: selectedProvider,
        model: selectedModel,
      });
      setStatus('AI Provider settings updated successfully.');
      loadConfig();
    } catch (err: any) {
      setStatus(`Error updating AI settings: ${err.message}`);
    }
  };

  const handleChangePlan = async (plan: 'free' | 'pro' | 'business') => {
    try {
      await api.updateBillingPlan(plan);
      setStatus(`Plan updated to ${plan.toUpperCase()}. Quota refreshed.`);
      onRefresh();
    } catch (err: any) {
      setStatus(`Plan update failed: ${err.message}`);
    }
  };

  const handleRequestNotificationPermission = async () => {
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      setBrowserNotificationStatus(res);
      if (res === 'granted') {
        new Notification('MailPilot AI Notifications Enabled', {
          body: 'You will receive immediate alerts for reviews and critical emails.',
        });
      }
    }
  };

  const plans = [
    {
      id: 'free' as const,
      name: 'Free Starter',
      price: '$0',
      quota: '50 AI Replies / month',
      features: [
        '50 AI Replies / mo',
        'Standard Google OAuth 2.0',
        'Gemini 3.8 Flash model',
        'Manual & Review Queue mode',
        'Standard Safety Filters',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Professional',
      price: '$29',
      popular: true,
      quota: '1,000 AI Replies / month',
      features: [
        '1,000 AI Replies / mo',
        'Full Automatic Mode support',
        'Thread-aware memory & history',
        'Custom Writing Style Mimicry',
        'Working Hours Auto-Ack',
        'Priority Webhook Triage',
      ],
    },
    {
      id: 'business' as const,
      name: 'Business Enterprise',
      price: '$99',
      quota: '10,000 AI Replies / month',
      features: [
        '10,000 AI Replies / mo',
        'Unlimited Smart Reply Rules',
        'Zero Data Retention compliance',
        'Multi-Provider Fallback',
        'Dedicated Enterprise SLAs',
        'Audit Logging & Export',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Settings, AI Providers & Subscriptions
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your AI provider routing, usage tiers, and notification channels.
        </p>
      </div>

      {status && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between border border-emerald-200">
          <span>{status}</span>
          <button onClick={() => setStatus(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Subscription Plans */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            SaaS Subscription Tier
          </h2>
          <span className="text-xs text-slate-400">
            Current plan:{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 uppercase">
              {billing?.plan || 'Free'}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = billing?.plan === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {p.name}
                    </span>
                    {p.popular && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/80 px-2 py-0.5 rounded-full">
                        Most Popular
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      {p.price}
                    </span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>

                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
                    {p.quota}
                  </p>

                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-6">
                    {p.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleChangePlan(p.id)}
                  disabled={isCurrent}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                    isCurrent
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : `Switch to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Provider Architecture & Configuration */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              AI Model Provider Architecture
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select your active reasoning backend. MailPilot AI abstracts LLM calls with standardized JSON outputs.
            </p>
          </div>
          <button
            onClick={handleSaveAIConfig}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
          >
            Save AI Provider
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Gemini */}
          <div
            onClick={() => {
              setSelectedProvider('gemini');
              setSelectedModel('gemini-3.8-flash');
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              selectedProvider === 'gemini'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900 dark:text-white">
                Google Gemini
              </span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                Active / Native
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Model: gemini-3.8-flash (via @google/genai SDK)
            </p>
          </div>

          {/* OpenAI */}
          <div
            onClick={() => {
              setSelectedProvider('openai');
              setSelectedModel('gpt-4o');
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              selectedProvider === 'openai'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900 dark:text-white">
                OpenAI
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                Configurable
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Model: gpt-4o / gpt-4o-mini
            </p>
          </div>

          {/* Anthropic */}
          <div
            onClick={() => {
              setSelectedProvider('anthropic');
              setSelectedModel('claude-3-5-sonnet');
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              selectedProvider === 'anthropic'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900 dark:text-white">
                Anthropic
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                Configurable
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Model: claude-3-5-sonnet
            </p>
          </div>
        </div>
      </div>

      {/* Notifications Channels */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-500" />
          Notification Channels
        </h2>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-xs">
          <div>
            <p className="font-bold text-slate-900 dark:text-white">
              Browser Web Notifications
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Receive real-time desktop popups when an email requires human approval.
            </p>
          </div>

          {browserNotificationStatus === 'granted' ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Check className="w-4 h-4" /> Enabled
            </span>
          ) : (
            <button
              onClick={handleRequestNotificationPermission}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
            >
              Enable Browser Alerts
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
