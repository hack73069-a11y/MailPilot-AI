import React, { useState } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Zap,
  Clock,
  Sliders,
  Filter,
} from 'lucide-react';
import { ReplyRule, RuleCondition, ActionType, ReplyTone } from '../../server/types.js';
import { api } from '../services/api.js';
import { toast } from '../services/toast.js';

interface RulesBuilderViewProps {
  rules: ReplyRule[];
  onRefresh: () => void;
}

export const RulesBuilderView: React.FC<RulesBuilderViewProps> = ({
  rules,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  // New Rule Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { field: 'category', operator: 'equals', value: 'meeting_request' },
  ]);
  const [action, setAction] = useState<ActionType>('approval_queue');
  const [overrideTone, setOverrideTone] = useState<ReplyTone | ''>('professional');

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { field: 'keyword', operator: 'contains', value: '' },
    ]);
  };

  const handleRemoveCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const handleConditionChange = (
    idx: number,
    patch: Partial<RuleCondition>
  ) => {
    const updated = [...conditions];
    updated[idx] = { ...updated[idx], ...patch };
    setConditions(updated);
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.createRule({
        name,
        description,
        enabled: true,
        priority: rules.length + 1,
        conditions,
        conditionLogic,
        action,
        overrideTone: overrideTone ? (overrideTone as ReplyTone) : undefined,
        addSignature: true,
      });

      setShowAddModal(false);
      setName('');
      setDescription('');
      setConditions([{ field: 'category', operator: 'equals', value: 'meeting_request' }]);
      toast.success(`Rule "${name}" created and active!`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Error creating rule: ${err.message}`);
    }
  };

  const handleToggleRule = async (rule: ReplyRule) => {
    try {
      await api.updateRule(rule.id, { enabled: !rule.enabled });
      toast.info(`Rule "${rule.name}" ${!rule.enabled ? 'activated' : 'paused'}`);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const target = rules.find((r) => r.id === id);
    try {
      await api.deleteRule(id);
      onRefresh();
      toast.warning(`Rule "${target?.name || 'Rule'}" deleted`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            if (target) {
              try {
                await api.createRule({
                  name: target.name,
                  description: target.description,
                  priority: target.priority,
                  conditions: target.conditions,
                  conditionLogic: target.conditionLogic,
                  action: target.action,
                  overrideTone: target.overrideTone,
                  addSignature: target.addSignature,
                  enabled: target.enabled,
                });
                onRefresh();
                toast.success(`Rule "${target.name}" restored!`);
              } catch {}
            }
          },
        },
      });
    } catch (err: any) {
      toast.error(`Failed to delete rule: ${err.message}`);
    }
  };

  const getActionBadge = (act: ActionType) => {
    switch (act) {
      case 'auto_send':
        return (
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
            <Zap className="w-3 h-3" /> Auto Send
          </span>
        );
      case 'approval_queue':
        return (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
            <Clock className="w-3 h-3" /> Require Approval
          </span>
        );
      case 'draft_only':
        return (
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-200">
            Create Draft
          </span>
        );
      case 'ignore':
        return (
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200">
            Skip / Ignore
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Smart Reply Rules Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Build custom logical triggers (IF condition AND condition THEN action) to automate email triage.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Smart Rule
        </button>
      </div>

      {/* Rules Cards List */}
      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div
            key={rule.id}
            className={`p-4 rounded-2xl border transition-all shadow-xs ${
              rule.enabled
                ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 opacity-60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xs font-bold text-slate-400 w-5 pt-0.5">
                  #{idx + 1}
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {rule.name}
                    </h3>
                    {getActionBadge(rule.action)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {rule.description}
                  </p>
                </div>
              </div>

              {/* Toggles & Delete */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  onClick={() => handleToggleRule(rule)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {rule.enabled ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ToggleRight className="w-6 h-6" /> Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400">
                      <ToggleLeft className="w-6 h-6" /> Disabled
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conditions Visual Breakdown */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase text-[10px]">
                IF:
              </span>
              {rule.conditions.map((cond, i) => (
                <React.Fragment key={i}>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-750 font-medium text-slate-700 dark:text-slate-200">
                    <strong className="text-slate-900 dark:text-white capitalize">
                      {cond.field.replace('_', ' ')}
                    </strong>{' '}
                    <span className="text-slate-400">{cond.operator}</span>{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      "{cond.value}"
                    </strong>
                  </span>
                  {i < rule.conditions.length - 1 && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {rule.conditionLogic}
                    </span>
                  )}
                </React.Fragment>
              ))}

              <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[10px] ml-2">
                THEN:
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold">
                {rule.action === 'auto_send'
                  ? 'Generate reply and send automatically'
                  : rule.action === 'approval_queue'
                  ? 'Generate reply and place in Review Queue'
                  : rule.action === 'draft_only'
                  ? 'Create draft in Gmail'
                  : 'Ignore and do not auto-reply'}
              </span>

              {rule.overrideTone && (
                <span className="text-[11px] text-slate-400 italic">
                  (Tone: {rule.overrideTone})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600" />
                Create New Smart Reply Rule
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Client Fast-Track"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Describe what this rule automates..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {/* Conditions Section */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Conditions (IF statement)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Condition Logic:</span>
                    <select
                      value={conditionLogic}
                      onChange={(e) => setConditionLogic(e.target.value as 'AND' | 'OR')}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <option value="AND">Match ALL (AND)</option>
                      <option value="OR">Match ANY (OR)</option>
                    </select>
                  </div>
                </div>

                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={cond.field}
                      onChange={(e) =>
                        handleConditionChange(idx, { field: e.target.value as any })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-1"
                    >
                      <option value="category">Category</option>
                      <option value="domain">Sender Domain</option>
                      <option value="sender">Sender Email</option>
                      <option value="subject">Subject</option>
                      <option value="keyword">Keyword in Body</option>
                      <option value="urgency">Urgency</option>
                      <option value="time_of_day">Time of Day</option>
                    </select>

                    <select
                      value={cond.operator}
                      onChange={(e) =>
                        handleConditionChange(idx, { operator: e.target.value as any })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-32"
                    >
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                      <option value="not_contains">does not contain</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Value (e.g. meeting_request or partner.com)"
                      value={cond.value}
                      onChange={(e) => handleConditionChange(idx, { value: e.target.value })}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-1"
                    />

                    {conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Condition
                </button>
              </div>

              {/* Action Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Action (THEN)
                  </label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as ActionType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="approval_queue">Generate & Place in Review Queue</option>
                    <option value="auto_send">Generate & Send Automatically</option>
                    <option value="draft_only">Create Draft in Gmail</option>
                    <option value="ignore">Ignore / Do Not Reply</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tone Override (Optional)
                  </label>
                  <select
                    value={overrideTone}
                    onChange={(e) => setOverrideTone(e.target.value as ReplyTone)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="concise">Concise</option>
                    <option value="warm">Warm</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/30"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
