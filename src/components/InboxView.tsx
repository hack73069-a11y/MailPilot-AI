import React, { useState } from 'react';
import {
  Inbox,
  Search,
  Filter,
  Sparkles,
  Send,
  FileEdit,
  Clock,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  RotateCw,
  Eye,
  CornerDownLeft,
  Calendar,
  User,
  Shield,
  Tag,
  Zap,
} from 'lucide-react';
import { EmailMessage, EmailCategory, UrgencyLevel } from '../../server/types.js';
import { api } from '../services/api.js';

interface InboxViewProps {
  emails: EmailMessage[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  onRefresh: () => void;
  token?: string | null;
  onConnect?: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  onRefresh,
  token,
  onConnect,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Interactive editing state for selected email
  const [editingReply, setEditingReply] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<string>('friendly');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  // User Confirmation Modal for Sending Email (Mandatory Workspace Skill Guideline)
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const selectedEmail =
    emails.find((e) => e.id === selectedEmailId) || (emails.length > 0 ? emails[0] : null);

  // Sync editing text whenever selection changes
  React.useEffect(() => {
    if (selectedEmail?.suggestedReply?.content) {
      setEditingReply(selectedEmail.suggestedReply.content);
      if (selectedEmail.suggestedReply.tone) {
        setSelectedTone(selectedEmail.suggestedReply.tone);
      }
    } else {
      setEditingReply('');
    }
    setStatusMessage(null);
  }, [selectedEmail?.id, selectedEmail?.suggestedReply?.content, selectedEmail?.suggestedReply?.tone]);

  // Filtered emails
  const filteredEmails = emails.filter((e) => {
    if (categoryFilter !== 'all' && e.analysis?.category !== categoryFilter) return false;
    if (urgencyFilter !== 'all' && e.analysis?.urgency !== urgencyFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSub = e.subject.toLowerCase().includes(q);
      const matchSender = e.sender.toLowerCase().includes(q);
      const matchSnippet = e.snippet.toLowerCase().includes(q);
      if (!matchSub && !matchSender && !matchSnippet) return false;
    }
    return true;
  });

  const handleGenerateReply = async (customInstruction?: string) => {
    if (!selectedEmail) return;
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const newReply = await api.generateReply(selectedEmail.id, {
        customInstruction: customInstruction || customPrompt,
        tone: selectedTone,
      });
      setEditingReply(newReply.content);
      setStatusMessage({ text: 'Gemini created a context-aware email reply!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Generation failed', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAndSend = async () => {
    if (!selectedEmail) return;
    setIsSending(true);
    setStatusMessage(null);
    try {
      const res = await api.generateAndSendReply(selectedEmail.id, {
        customInstruction: customPrompt,
        tone: selectedTone,
      });
      setEditingReply(res.reply.content);
      setStatusMessage({
        text: `Gemini generated reply and dispatched directly to ${selectedEmail.senderEmail}!`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to generate and send', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendConfirmed = async () => {
    if (!selectedEmail) return;
    setShowSendConfirmModal(false);
    setIsSending(true);
    setStatusMessage(null);
    try {
      await api.sendReply(selectedEmail.id, editingReply);
      setStatusMessage({
        text: `Email successfully sent to ${selectedEmail.senderEmail} via Gmail API!`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to send reply', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEmail) return;
    setIsDrafting(true);
    setStatusMessage(null);
    try {
      await api.createDraft(selectedEmail.id, editingReply);
      setStatusMessage({ text: 'Draft saved to your Gmail mailbox!', type: 'success' });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to save draft', type: 'error' });
    } finally {
      setIsDrafting(false);
    }
  };

  const getCategoryColor = (cat?: EmailCategory) => {
    switch (cat) {
      case 'meeting_request':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'customer_support':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'sales':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'invoice_payment':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'security_alert':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'newsletter':
      case 'promotion':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    }
  };

  const getUrgencyColor = (urgency?: UrgencyLevel) => {
    switch (urgency) {
      case 'critical':
        return 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800';
      case 'high':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800';
      case 'medium':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800';
      default:
        return 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: EmailMessage['status']) => {
    switch (status) {
      case 'replied':
        return (
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto-Replied
          </span>
        );
      case 'in_review':
        return (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> In Review
          </span>
        );
      case 'drafted':
        return (
          <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 px-2 py-0.5 rounded-full flex items-center gap-1">
            <FileEdit className="w-3 h-3" /> Draft Saved
          </span>
        );
      case 'ignored':
        return (
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            Ignored
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
            New
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Gmail Disconnected Notice in Inbox */}
      {!token && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Gmail Not Connected: Showing Simulated & Demo Messages
              </p>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5 text-[11px]">
                To sync your real messages from your Gmail inbox, sign in with your Google account.
              </p>
            </div>
          </div>
          {onConnect && (
            <button
              onClick={onConnect}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Connect Gmail</span>
            </button>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search subjects, senders, or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="meeting_request">Meeting Request</option>
            <option value="customer_support">Customer Support</option>
            <option value="sales">Sales & BD</option>
            <option value="invoice_payment">Invoices & Billing</option>
            <option value="security_alert">Security Alerts</option>
            <option value="newsletter">Newsletters</option>
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="in_review">In Review Queue</option>
            <option value="replied">Replied</option>
            <option value="drafted">Draft Saved</option>
            <option value="ignored">Ignored</option>
          </select>

          <span className="text-[11px] text-slate-400 pl-2">
            Showing {filteredEmails.length} message{filteredEmails.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Main Split View: Left Email List (40%), Right Email Details (60%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
        {/* Left Column: Email Cards List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-2 shadow-xs overflow-y-auto max-h-[750px] space-y-2">
          {filteredEmails.map((email) => {
            const isSelected = selectedEmail?.id === email.id;
            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
                className={`p-3.5 rounded-xl cursor-pointer transition-all border text-xs ${
                  isSelected
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-100 dark:border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {email.senderName || email.senderEmail}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(email.date).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 truncate">
                  {email.subject}
                </div>

                <p className="text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 text-[11px]">
                  {email.snippet}
                </p>

                {/* Metadata Tags */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-700/40">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {email.analysis?.category && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCategoryColor(
                          email.analysis.category
                        )}`}
                      >
                        {email.analysis.category.replace('_', ' ')}
                      </span>
                    )}
                    {email.analysis?.urgency && (
                      <span
                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${getUrgencyColor(
                          email.analysis.urgency
                        )}`}
                      >
                        {email.analysis.urgency}
                      </span>
                    )}
                    {email.hasAttachments && (
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                        <Paperclip className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div>{getStatusBadge(email.status)}</div>
                </div>
              </div>
            );
          })}

          {filteredEmails.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              No emails match the selected filters.
            </div>
          )}
        </div>

        {/* Right Column: Detailed Email View & AI Reply Studio */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          {selectedEmail ? (
            <div className="space-y-4">
              {/* Email Header */}
              <div className="border-b border-slate-100 dark:border-slate-700/60 pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedEmail.subject}
                  </h2>
                  <div>{getStatusBadge(selectedEmail.status)}</div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      From:{' '}
                    </span>
                    {selectedEmail.sender}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Date:{' '}
                    </span>
                    {new Date(selectedEmail.date).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* AI Triage Card (Gemini 3.8 Flash Analysis) */}
              {selectedEmail.analysis && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 rounded-xl p-3.5 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      AI Intelligence Summary
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      Confidence: {(selectedEmail.analysis.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Sender Intent:{' '}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedEmail.analysis.intent}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Suggested Action:{' '}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedEmail.analysis.suggested_action}
                      </span>
                    </div>
                  </div>

                  {selectedEmail.analysis.is_sensitive && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        Sensitive Content Detected: {selectedEmail.analysis.sensitivity_reason || 'Auto-reply strictly prohibited.'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Email Plain Text Content */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/70 dark:border-slate-750 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto font-sans">
                {selectedEmail.bodyPlain || selectedEmail.snippet}
              </div>

              {/* Attachments if any */}
              {selectedEmail.hasAttachments && selectedEmail.attachmentNames && selectedEmail.attachmentNames.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-500">Attachments:</span>
                  {selectedEmail.attachmentNames.map((name, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      {name}
                    </span>
                  ))}
                </div>
              )}

              {/* Status Banner (e.g. success / error) */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* AI Reply Studio / Editor */}
              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4 space-y-3.5">
                {/* Workflow Card Header */}
                <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/20 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Gemini 3.8 Flash Reply Engine
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Model: gemini-3.8-flash
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Inspect message context, synthesize a thread-aware response, and dispatch via Gmail.
                        </p>
                      </div>
                    </div>

                    {/* Primary One-Click Action */}
                    <button
                      onClick={handleGenerateAndSend}
                      disabled={isSending || isGenerating}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                      title="Read message, generate tailored response with Gemini, and dispatch immediately without asking permission"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>{isSending ? 'Auto-Sending via Gmail...' : '⚡ Auto-Reply & Send (No Permission Needed)'}</span>
                    </button>
                  </div>

                  {/* Tone Selector & Options */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-200/50 dark:border-indigo-800/40 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mr-1">
                        Tone:
                      </span>
                      {['friendly', 'professional', 'casual', 'formal', 'concise', 'warm'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTone(t)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition cursor-pointer ${
                            selectedTone === t
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleGenerateReply()}
                      disabled={isGenerating || isSending}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{editingReply ? 'Re-draft with Gemini' : 'Draft with Gemini'}</span>
                    </button>
                  </div>
                </div>

                {/* Reply Editor Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" />
                      Email Response Preview & Live Editor
                    </span>
                    <span className="text-[11px]">
                      {editingReply ? `${editingReply.length} characters` : 'Ready to draft'}
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={editingReply}
                    onChange={(e) => setEditingReply(e.target.value)}
                    placeholder="Click 'Generate with Gemini & Send' or 'Draft with Gemini' above to generate an intelligent reply..."
                    className="w-full p-3.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed font-sans"
                  />
                </div>

                {/* Optional Custom Regeneration Prompt */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Custom instruction for Gemini (e.g. 'Accept the meeting for Tuesday 3 PM, request Zoom link')..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateReply();
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <button
                    onClick={() => handleGenerateReply(customPrompt)}
                    disabled={isGenerating || !customPrompt.trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shrink-0"
                  >
                    Generate Draft
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={isDrafting || !editingReply}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isDrafting ? 'Saving Draft...' : 'Save Draft in Gmail'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendConfirmed}
                      disabled={isSending || !editingReply}
                      title="Send this email reply immediately without confirmation prompt"
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Sending via Gmail...' : 'Send Reply via Gmail (Instant)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20 text-center">
              <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold">Select an email to view conversation</p>
              <p className="text-xs">Or click "Simulate Incoming" to test triage.</p>
            </div>
          )}
        </div>
      </div>

      {/* User Confirmation Dialog for Sending Email (Mandatory Google Workspace Pattern) */}
      {showSendConfirmModal && selectedEmail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950">
                <Send className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Sending Email via Gmail
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              Are you sure you want to dispatch this email from your connected Gmail address to{' '}
              <strong className="text-slate-900 dark:text-white">
                {selectedEmail.senderEmail}
              </strong>
              ?
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 mb-4 max-h-40 overflow-y-auto text-xs whitespace-pre-wrap font-sans">
              <p className="font-semibold text-slate-500 mb-1">
                Subject: Re: {selectedEmail.subject}
              </p>
              {editingReply}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSendConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendConfirmed}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
