import React, { useState } from 'react';
import {
  UserCheck,
  Sparkles,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  FileText,
  Sliders,
} from 'lucide-react';
import { UserPreferences, ReplyTone } from '../../server/types.js';
import { api } from '../services/api.js';

interface PersonalityViewProps {
  preferences: UserPreferences;
  onRefresh: () => void;
}

export const PersonalityView: React.FC<PersonalityViewProps> = ({
  preferences,
  onRefresh,
}) => {
  const [form, setForm] = useState<UserPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [newExample, setNewExample] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  React.useEffect(() => {
    setForm(preferences);
  }, [preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      await api.updateSettings(form);
      setStatus('AI Personality & Scheduling settings saved successfully!');
      onRefresh();
    } catch (err: any) {
      setStatus(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExample = () => {
    if (!newExample.trim()) return;
    setForm({
      ...form,
      sampleWritingEmails: [...(form.sampleWritingEmails || []), newExample.trim()],
    });
    setNewExample('');
  };

  const handleRemoveExample = (idx: number) => {
    setForm({
      ...form,
      sampleWritingEmails: form.sampleWritingEmails.filter((_, i) => i !== idx),
    });
  };

  const tones: { id: ReplyTone; label: string; desc: string }[] = [
    { id: 'professional', label: 'Professional', desc: 'Clear, polite, objective and business-ready' },
    { id: 'friendly', label: 'Friendly', desc: 'Approachable, warm, energetic, and collaborative' },
    { id: 'casual', label: 'Casual', desc: 'Relaxed, conversational, natural, low friction' },
    { id: 'formal', label: 'Formal', desc: 'Traditional executive etiquette and precision' },
    { id: 'concise', label: 'Concise', desc: 'Short, direct, bullet-focused, zero fluff' },
    { id: 'warm', label: 'Warm', desc: 'Empathetic, reassuring, deeply personable' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            AI Personality & Writing Persona
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Train MailPilot AI to mimic your tone, communication cadence, and schedule policies without global data training.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
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

      {/* Grid: Left Column (Tone & Style), Right Column (Working Hours & Signature) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Tone & Custom Instructions */}
        <div className="space-y-6">
          {/* Tone Selector */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Default Tone of Voice
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {tones.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, defaultTone: t.id })}
                  className={`p-3 rounded-xl text-left border transition-all text-xs ${
                    form.defaultTone === t.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                    {t.label}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {t.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Writing Directives */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              Custom Instructions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide rules for greeting, length, formatting, and wording preferences.
            </p>
            <textarea
              rows={4}
              value={form.customInstructions}
              onChange={(e) => setForm({ ...form, customInstructions: e.target.value })}
              placeholder="e.g. Write like me. Keep emails under 3 sentences. Avoid generic greetings. Never commit to contract deliverables."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed font-sans"
            />
          </div>

          {/* Few-Shot Style Mimicry Samples */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Your Real Email Samples (Few-Shot Prompting)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste emails you have written in the past. MailPilot will emulate your authentic phrasing and rhythm.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {(form.sampleWritingEmails || []).map((example, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs relative group"
                >
                  <button
                    onClick={() => handleRemoveExample(idx)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500 transition"
                    title="Remove sample"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase mb-1 block">
                    Sample #{idx + 1}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans">
                    {example}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <textarea
                rows={3}
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                placeholder="Paste an authentic email you sent in the past..."
                className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddExample}
                disabled={!newExample.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Sample Email
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Signature & Working Hours Scheduler */}
        <div className="space-y-6">
          {/* Email Signature */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Email Signature
              </h2>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={form.signatureEnabled}
                  onChange={(e) => setForm({ ...form, signatureEnabled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700 dark:text-slate-300">Append Signature</span>
              </label>
            </div>

            <textarea
              rows={3}
              value={form.signatureText}
              onChange={(e) => setForm({ ...form, signatureText: e.target.value })}
              placeholder="Best regards,&#10;Alex Vance&#10;Head of Operations, MailPilot"
              disabled={!form.signatureEnabled}
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none leading-relaxed font-sans disabled:opacity-40"
            />
          </div>

          {/* Working Hours & Scheduler */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Working Hours Scheduler
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Control when automatic and approved replies can be sent.
                </p>
              </div>

              <input
                type="checkbox"
                checked={form.workingHoursEnabled}
                onChange={(e) => setForm({ ...form, workingHoursEnabled: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={form.workingHoursStart}
                  onChange={(e) => setForm({ ...form, workingHoursStart: e.target.value })}
                  disabled={!form.workingHoursEnabled}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={form.workingHoursEnd}
                  onChange={(e) => setForm({ ...form, workingHoursEnd: e.target.value })}
                  disabled={!form.workingHoursEnabled}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Timezone
              </label>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Central European Time (CET)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
              </select>
            </div>

            {/* After-Hours Auto-Acknowledgement */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  After-Hours Auto-Acknowledgement
                </span>
                <input
                  type="checkbox"
                  checked={form.afterHoursReplyEnabled}
                  onChange={(e) =>
                    setForm({ ...form, afterHoursReplyEnabled: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Outside working hours, send an automatic receipt confirmation assuring the sender you will reply the next business morning.
              </p>
              <textarea
                rows={3}
                value={form.afterHoursCustomMessage}
                onChange={(e) => setForm({ ...form, afterHoursCustomMessage: e.target.value })}
                disabled={!form.afterHoursReplyEnabled}
                className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
