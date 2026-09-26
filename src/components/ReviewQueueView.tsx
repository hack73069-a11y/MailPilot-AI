import React, { useState } from 'react';
import {
  CheckSquare,
  Send,
  XCircle,
  FileEdit,
  RotateCw,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  User,
  Shield,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ApprovalQueueItem } from '../../server/types.js';
import { api } from '../services/api.js';
import { toast } from '../services/toast.js';

interface ReviewQueueViewProps {
  queue: ApprovalQueueItem[];
  onRefresh: () => void;
  onSelectEmail: (id: string) => void;
  isLoading?: boolean;
  onSimulate?: (type: 'meeting' | 'support' | 'security' | 'sales') => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  queue,
  onRefresh,
  onSelectEmail,
  isLoading = false,
  onSimulate,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [regenInstruction, setRegenInstruction] = useState<string>('');
  const [itemToApprove, setItemToApprove] = useState<ApprovalQueueItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const startEditing = (item: ApprovalQueueItem) => {
    setEditingItemId(item.id);
    setEditContent(item.reply.content);
    setRegenInstruction('');
  };

  const handleSaveEdit = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      await api.editQueueItem(item.id, editContent);
      setEditingItemId(null);
      toast.success('Proposed reply updated successfully!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update reply');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      const res = await api.regenerateQueueItem(item.id, {
        instruction: regenInstruction,
      });
      setEditContent(res.item.reply.content);
      toast.success('AI generated a fresh response!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Regeneration failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectApprove = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      await api.approveQueueItem(item.id);
      toast.success(`Sent reply to ${item.senderEmail} immediately via Gmail!`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAll = async () => {
    if (queue.length === 0) return;
    for (const item of queue) {
      try {
        await api.approveQueueItem(item.id);
      } catch (err) {
        console.error(err);
      }
    }
    toast.success(`All ${queue.length} pending replies sent autonomously!`);
    onRefresh();
  };

  const handleConfirmApprove = async () => {
    if (!itemToApprove) return;
    const itemId = itemToApprove.id;
    const recipient = itemToApprove.senderEmail;
    setItemToApprove(null);
    setActionLoading(itemId);
    try {
      await api.approveQueueItem(itemId);
      toast.success(`Approved and sent reply to ${recipient}!`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      await api.rejectQueueItem(item.id);
      onRefresh();
      toast.warning(`Reply to ${item.senderEmail} rejected`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.generateReply(item.messageId);
              onRefresh();
              toast.info('Item restored to review queue');
            } catch {}
          },
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Human Review & Approval Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              {queue.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review, edit, and authorize generated emails before they are dispatched through your Gmail account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={handleApproveAll}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Approve & Send All ({queue.length})</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-95 cursor-pointer"
            title="Refresh Queue"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs animate-skeleton-pulse space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-40 h-4 bg-slate-200 dark:bg-slate-700 rounded-md" />
                  <div className="w-24 h-4 bg-amber-100 dark:bg-amber-950/80 rounded-md" />
                </div>
                <div className="w-28 h-3 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/70 dark:border-slate-750 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-36 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="w-16 h-3 bg-indigo-100 dark:bg-indigo-950 rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="w-4/5 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="w-3/5 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>

                <div className="bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl p-3.5 border border-indigo-200/60 dark:border-indigo-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-32 h-3.5 bg-indigo-200 dark:bg-indigo-900 rounded" />
                    <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-3 bg-indigo-100 dark:bg-indigo-900/40 rounded" />
                    <div className="w-5/6 h-3 bg-indigo-100 dark:bg-indigo-900/40 rounded" />
                    <div className="w-4/6 h-3 bg-indigo-100 dark:bg-indigo-900/40 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Queue Cards List */}
      {!isLoading && (
        <div className="space-y-4">
          {queue.map((item) => {
            const isEditing = editingItemId === item.id;
            const isActionBusy = actionLoading === item.id;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-600"
              >
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.subject}
                    </span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md font-semibold border border-amber-200/50">
                      {item.queuedReason}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Received {new Date(item.receivedAt).toLocaleString()}
                  </span>
                </div>

                {/* Two Column Card Comparison: Left (Original), Right (Proposed Reply) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  {/* Left: Original Message & AI Triage */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/70 dark:border-slate-750 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          From: {item.sender}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded capitalize">
                          {item.analysis.category.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto mb-3">
                        {item.snippet}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-750 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Confidence: {(item.analysis.confidence * 100).toFixed(0)}%
                      </span>
                      <button
                        onClick={() => onSelectEmail(item.messageId)}
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        View Full Thread <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Right: AI Proposed Reply & Inline Editor */}
                  <div className="bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl p-3.5 border border-indigo-200/60 dark:border-indigo-800/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          Proposed Response
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize">
                          Tone: {item.reply.tone}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 mb-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={6}
                            className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                            placeholder="Edit reply content..."
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={regenInstruction}
                              onChange={(e) => setRegenInstruction(e.target.value)}
                              placeholder="Optional prompt tweak (e.g. 'Make it friendlier', 'Add availability on Friday')..."
                              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <button
                              onClick={() => handleRegenerate(item)}
                              disabled={isActionBusy}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <RotateCw className="w-3 h-3" /> Re-Draft
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto mb-3 font-sans">
                          {item.reply.content}
                        </p>
                      )}
                    </div>

                    {/* Actions bar */}
                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(item)}
                              disabled={isActionBusy}
                              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer shadow-2xs"
                            >
                              Save Draft
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-all active:scale-95 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditing(item)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                          >
                            <FileEdit className="w-3 h-3" /> Edit Reply
                          </button>
                        )}
                        <button
                          onClick={() => handleReject(item)}
                          disabled={isActionBusy}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setItemToApprove(item)}
                          disabled={isActionBusy}
                          title="Review preview modal before dispatch"
                          className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-100 transition-all active:scale-95 cursor-pointer"
                        >
                          Review & Send
                        </button>
                        <button
                          onClick={() => handleDirectApprove(item)}
                          disabled={isActionBusy}
                          title="Send this email response directly via Gmail without permission prompt"
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Approve & Send (Instant)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Polished Empty State */}
          {queue.length === 0 && (
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-10 sm:p-14 text-center shadow-xs relative overflow-hidden">
              {/* Subtle ambient radial glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Charming vector graphic */}
              <div className="relative mx-auto w-20 h-20 mb-4 flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-950/80 rounded-3xl rotate-6 transition-transform group-hover:rotate-12 duration-300" />
                <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-3xl -rotate-6" />
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                All Caught Up!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                All caught up! MailPilot's AI guard is watching your inbox 24/7. When emails require human review or safety verification, they will appear here for one-click dispatch.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {onSimulate && (
                  <>
                    <button
                      onClick={() => onSimulate('meeting')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Simulate Meeting Inquiry</span>
                    </button>
                    <button
                      onClick={() => onSimulate('sales')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Simulate Sales Lead</span>
                    </button>
                  </>
                )}
                <button
                  onClick={onRefresh}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Refresh Inbound Queue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mandatory User Confirmation Modal for Send Action */}
      {itemToApprove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950">
                <Send className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Approve & Send Email Reply
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              This will immediately send the approved response to{' '}
              <strong className="text-slate-900 dark:text-white">
                {itemToApprove.senderEmail}
              </strong>{' '}
              via the official Gmail API under subject{' '}
              <strong className="text-slate-900 dark:text-white">
                Re: {itemToApprove.subject}
              </strong>
              .
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mb-4 max-h-40 overflow-y-auto text-xs whitespace-pre-wrap font-sans">
              {itemToApprove.reply.content}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setItemToApprove(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Confirm & Dispatch Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
