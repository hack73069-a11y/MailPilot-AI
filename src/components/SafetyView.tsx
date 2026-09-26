import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Globe,
  Ban,
  FileCheck,
} from 'lucide-react';
import { UserPreferences, AuditLog } from '../../server/types.js';
import { api } from '../services/api.js';

interface SafetyViewProps {
  preferences: UserPreferences;
  onRefresh: () => void;
}

export const SafetyView: React.FC<SafetyViewProps> = ({
  preferences,
  onRefresh,
}) => {
  const [form, setForm] = useState<UserPreferences>(preferences);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newAllowedDomain, setNewAllowedDomain] = useState('');
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  React.useEffect(() => {
    setForm(preferences);
    loadAudits();
  }, [preferences]);

  const loadAudits = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) setAuditLogs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await api.updateSettings(form);
      setStatus('Safety thresholds and domain policies updated successfully.');
      onRefresh();
    } catch (err: any) {
      setStatus(`Error saving: ${err.message}`);
    }
  };

  const handleAddAllowedDomain = () => {
    if (!newAllowedDomain.trim()) return;
    const clean = newAllowedDomain.trim().toLowerCase();
    setForm({
      ...form,
      allowedDomains: [...(form.allowedDomains || []), clean],
    });
    setNewAllowedDomain('');
  };

  const handleRemoveAllowedDomain = (idx: number) => {
    setForm({
      ...form,
      allowedDomains: form.allowedDomains.filter((_, i) => i !== idx),
    });
  };

  const handleAddBlockedDomain = () => {
    if (!newBlockedDomain.trim()) return;
    const clean = newBlockedDomain.trim().toLowerCase();
    setForm({
      ...form,
      blockedDomains: [...(form.blockedDomains || []), clean],
    });
    setNewBlockedDomain('');
  };

  const handleRemoveBlockedDomain = (idx: number) => {
    setForm({
      ...form,
      blockedDomains: form.blockedDomains.filter((_, i) => i !== idx),
    });
  };

  const handleDeleteAllData = async () => {
    try {
      await api.deleteUserData();
      setShowDeleteModal(false);
      setStatus('All application data, email caches, and rules have been permanently wiped.');
      onRefresh();
    } catch (err: any) {
      setStatus(`Deletion error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Safety Engine & Data Privacy
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure autonomous sending confidence gates, domain security controls, and strict compliance boundaries.
          </p>
        </div>

        <button
          onClick={handleSavePreferences}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition self-start sm:self-auto"
        >
          Save Safety Settings
        </button>
      </div>

      {status && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{status}</span>
          </div>
          <button onClick={() => setStatus(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Hard Gate Safety Policies Checklist */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-500" />
          Mandatory Non-Negotiable Safeguards
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The following triggers automatically halt any auto-send operation, downgrading to a manual draft or review:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Password & Authentication Alerts
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Password reset requests, 2FA codes, login alerts, and credential verification emails are never answered.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Financial Transactions & Wire Transfers
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Bank notices, invoices, demands for funds, and wire coordinates are strictly blocked.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Legal & Government Notices
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Regulatory, subpoena, audit, or contractual notices require mandatory human council review.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Medical & Sensitive Personal Data
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Protected health info, insurance claims, and personal identification are guarded.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Thresholds Sliders */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          AI Confidence Gate Thresholds
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Auto Send Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 dark:text-slate-200">
                Auto-Send Minimum Confidence
              </label>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                {(form.minAutoSendConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.70"
              max="0.99"
              step="0.01"
              value={form.minAutoSendConfidence}
              onChange={(e) =>
                setForm({ ...form, minAutoSendConfidence: parseFloat(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-400">
              Only emails analyzed with confidence &ge; this value can be automatically sent in Automatic mode.
            </p>
          </div>

          {/* Approval Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 dark:text-slate-200">
                Review Queue Minimum Confidence
              </label>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                {(form.minApprovalConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.85"
              step="0.01"
              value={form.minApprovalConfidence}
              onChange={(e) =>
                setForm({ ...form, minApprovalConfidence: parseFloat(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-400">
              Emails below this value are saved as private drafts without queuing for immediate action.
            </p>
          </div>
        </div>
      </div>

      {/* Allowed & Blocked Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Allowed Domains */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            Allowed Domains (Priority Auto-Reply)
          </h3>
          <p className="text-slate-500 text-[11px]">
            Trusted partner or internal company domains eligible for automated replies.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. partner.com or stripe.com"
              value={newAllowedDomain}
              onChange={(e) => setNewAllowedDomain(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
            <button
              onClick={handleAddAllowedDomain}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(form.allowedDomains || []).map((dom, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5"
              >
                <span>{dom}</span>
                <button
                  onClick={() => handleRemoveAllowedDomain(i)}
                  className="text-emerald-600 hover:text-rose-500 font-bold"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Blocked Domains */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-500" />
            Blocked Domains (Never Reply)
          </h3>
          <p className="text-slate-500 text-[11px]">
            Domains from which all messages are automatically ignored with zero reply generation.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. spammer.com or marketing.io"
              value={newBlockedDomain}
              onChange={(e) => setNewBlockedDomain(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
            <button
              onClick={handleAddBlockedDomain}
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(form.blockedDomains || []).map((dom, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5"
              >
                <span>{dom}</span>
                <button
                  onClick={() => handleRemoveBlockedDomain(i)}
                  className="text-rose-600 hover:text-rose-800 font-bold"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone: Delete My Data */}
      <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Privacy Rights: Delete My Data
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 max-w-xl">
              Permanently purges all cached emails, message thread records, generated AI replies, custom rules, and activity logs from this application.
            </p>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition self-start sm:self-auto"
          >
            Delete My Data
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Confirm Data Purge
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Are you sure you want to delete all stored emails, threads, approval queues, custom rules, and audit logs? This action is irreversible.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllData}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30"
              >
                Yes, Purge Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
