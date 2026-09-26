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
  Zap,
} from 'lucide-react';
import { ApprovalQueueItem } from '../../server/types.js';
import { api } from '../services/api.js';

interface ReviewQueueViewProps {
  queue: ApprovalQueueItem[];
  onRefresh: () => void;
  onSelectEmail: (id: string) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  queue,
  onRefresh,
  onSelectEmail,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [regenInstruction, setRegenInstruction] = useState<string>('');
  const [itemToApprove, setItemToApprove] = useState<ApprovalQueueItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
      setNotification({ text: 'Reply content updated successfully!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setNotification({ text: err.message || 'Failed to update reply', type: 'error' });
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
      setNotification({ text: 'AI generated a fresh response!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setNotification({ text: err.message || 'Regeneration failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateAndSend = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      await api.generateAndSendReply(item.messageId, {
        customInstruction: regenInstruction || undefined,
        tone: item.reply.tone,
      });
      setNotification({
        text: `Gemini generated fresh reply and sent directly to ${item.senderEmail}!`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setNotification({ text: err.message || 'Generate and send failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectApprove = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      await api.approveQueueItem(item.id);
      setNotification({
        text: `Sent reply to ${item.senderEmail} immediately via Gmail!`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setNotification({ text: err.message || 'Approval failed', type: 'error' });
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
    setNotification({
      text: `All ${queue.length} pending replies sent autonomously!`,
      type: 'success',
    });
    onRefresh();
  };

  const handleConfirmApprove = async () => {
    if (!itemToApprove) return;
    const itemId = itemToApprove.id;
    setItemToApprove(null);
    setActionLoading(itemId);
    try {
      await api.approveQueueItem(itemId);
      setNotification({
        text: `Approved and sent reply to ${itemToApprove.senderEmail}!`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setNotification({ text: err.message || 'Approval failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (item: ApprovalQueueItem) => {
    setActionLoading(item.id);
    try {
      await api.rejectQueueItem(item.id);
      setNotification({ text: 'Reply suggestion rejected.', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setNotification({ text: err.message || 'Rejection failed', type: 'error' });
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
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              title="Dispatch all pending replies immediately without requiring individual approvals"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-Send All ({queue.length})</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
          }`}
        >
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Queue Cards List */}
      <div className="space-y-4">
        {queue.map((item) => {
          const isEditing = editingItemId === item.id;
          const isLoading = actionLoading === item.id;

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-600"
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
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
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
                      <div className="space-y-2">
                        <textarea
                          rows={6}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Regenerate instruction (optional)..."
                            value={regenInstruction}
                            onChange={(e) => setRegenInstruction(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          />
                          <button
                            onClick={() => handleRegenerate(item)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1"
                          >
                            <RotateCw className="w-3 h-3" /> Redo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-sans">
                        {item.reply.content}
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-indigo-100 dark:border-indigo-900/60 mt-3">
                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(item)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(item)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5"
                        >
                          <FileEdit className="w-3.5 h-3.5 text-slate-400" />
                          Edit
                        </button>
                      )}

                      <button
                        onClick={() => handleReject(item)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRegenerateAndSend(item)}
                        disabled={isLoading}
                        title="Use Gemini to generate a fresh context-aware response and immediately dispatch it"
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>Redo & Send</span>
                      </button>

                      <button
                        onClick={() => handleDirectApprove(item)}
                        disabled={isLoading}
                        title="Send this email response directly via Gmail without permission prompt"
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
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

        {queue.length === 0 && (
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-12 text-center shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Approval Queue is Empty
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              All incoming emails needing review have been resolved. MailPilot AI is actively monitoring for new inbound messages.
            </p>
          </div>
        )}
      </div>

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
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5"
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
