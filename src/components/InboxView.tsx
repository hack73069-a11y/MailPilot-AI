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
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { EmailMessage, EmailCategory, UrgencyLevel } from '../../server/types.js';
import { api } from '../services/api.js';
import { toast } from '../services/toast.js';

interface InboxViewProps {
  emails: EmailMessage[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  onRefresh: () => void;
  token?: string | null;
  onConnect?: () => void;
  isLoading?: boolean;
  onSimulate?: (type: 'meeting' | 'support' | 'security' | 'sales') => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  onRefresh,
  token,
  onConnect,
  isLoading = false,
  onSimulate,
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

  // User Confirmation Modal for Sending Email
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);

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
  }, [selectedEmail?.id, selectedEmail?.suggestedReply?.content, selectedEmail?.suggestedReply?.tone]);

  const filteredEmails = emails.filter((e) => {
    if (statusFilter === 'all') {
      if (e.status === 'archived') return false;
    } else if (e.status !== statusFilter) {
      return false;
    }
    if (categoryFilter !== 'all' && e.analysis?.category !== categoryFilter) return false;
    if (urgencyFilter !== 'all' && e.analysis?.urgency !== urgencyFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSub = e.subject.toLowerCase().includes(q);
      const matchSender = e.sender.toLowerCase().includes(q);
      const matchSnippet = e.snippet.toLowerCase().includes(q);
      if (!matchSub && !matchSender && !matchSnippet) return false;
    }
    return true;
  });

  const handleArchiveEmail = async (emailToArchive: EmailMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.archiveEmail(emailToArchive.id);
      onRefresh();
      toast.success(`Archived "${emailToArchive.subject.slice(0, 24)}..."`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.unarchiveEmail(emailToArchive.id);
              onRefresh();
              toast.info(`Restored "${emailToArchive.subject.slice(0, 24)}..." to Inbox`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to restore email');
            }
          },
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive email');
    }
  };

  const handleUnarchiveEmail = async (emailToRestore: EmailMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.unarchiveEmail(emailToRestore.id);
      onRefresh();
      toast.success(`Restored "${emailToRestore.subject.slice(0, 24)}..." to Inbox`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore email');
    }
  };

  const handleGenerateReply = async (customInstruction?: string) => {
    if (!selectedEmail) return;
    setIsGenerating(true);
    try {
      const newReply = await api.generateReply(selectedEmail.id, {
        customInstruction: customInstruction || customPrompt,
        tone: selectedTone,
      });
      setEditingReply(newReply.content);
      toast.success('Gemini synthesized a thread-aware reply draft!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAndSend = async () => {
    if (!selectedEmail) return;
    setIsSending(true);
    try {
      const res = await api.generateAndSendReply(selectedEmail.id, {
        customInstruction: customPrompt,
        tone: selectedTone,
      });
      setEditingReply(res.reply.content);
      toast.success(`Autonomous reply generated & sent to ${selectedEmail.senderEmail}!`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate and send');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendConfirmed = async () => {
    if (!selectedEmail) return;
    setShowSendConfirmModal(false);
    setIsSending(true);
    try {
      await api.sendReply(selectedEmail.id, editingReply);
      toast.success(`Email reply dispatched to ${selectedEmail.senderEmail} via Gmail API!`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEmail) return;
    setIsDrafting(true);
    try {
      await api.createDraft(selectedEmail.id, editingReply);
      toast.info('Draft saved to your Gmail mailbox!', {
        action: {
          label: 'View',
          onClick: () => window.open('https://mail.google.com', '_blank'),
        },
      });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
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
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            Ignored (Filtered)
          </span>
        );
      case 'archived':
        return (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200 dark:border-slate-700">
            <Archive className="w-3 h-3 text-slate-400" /> Archived
          </span>
        );
      default:
        return (
          <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            Received
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Real Gmail Connection Banner if token missing */}
      {!token && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Sandbox Preview Mode Active
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                Displaying pre-loaded seed inquiries. Connect your Google account to sync live inbox messages and auto-respond.
              </p>
            </div>
          </div>
          {onConnect && (
            <button
              onClick={onConnect}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
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
            <option value="all">All Active</option>
            <option value="in_review">In Review Queue</option>
            <option value="replied">Replied</option>
            <option value="drafted">Draft Saved</option>
            <option value="ignored">Ignored</option>
            <option value="archived">Archived</option>
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
          {/* Skeleton Loaders */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/60 animate-skeleton-pulse space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="w-48 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700/60 rounded" />
                    <div className="w-4/5 h-2.5 bg-slate-100 dark:bg-slate-700/60 rounded" />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="w-20 h-3 bg-indigo-100 dark:bg-indigo-950 rounded" />
                    <div className="w-16 h-3 bg-emerald-100 dark:bg-emerald-950 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading &&
            filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              return (
                <div
                  key={email.id}
                  onClick={() => onSelectEmail(email.id)}
                  className={`group relative p-3.5 rounded-xl cursor-pointer transition-all border text-xs ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-100 dark:border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {email.senderName || email.senderEmail}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(email.date).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
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
                    <div className="flex items-center gap-1.5">
                      {email.status === 'archived' ? (
                        <button
                          onClick={(e) => handleUnarchiveEmail(email, e)}
                          title="Restore email to active inbox"
                          className="opacity-80 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 cursor-pointer"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleArchiveEmail(email, e)}
                          title="Archive email (with undo)"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div>{getStatusBadge(email.status)}</div>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Polished Empty States */}
          {!isLoading && filteredEmails.length === 0 && (
            <div className="py-14 px-6 text-center space-y-4 relative overflow-hidden">
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-950/80 rounded-3xl rotate-6 transition-transform" />
                <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-3xl -rotate-6" />
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                  <Inbox className="w-8 h-8 text-indigo-500" />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {emails.length === 0 ? 'Inbox Clean & Monitored' : 'No Matching Messages'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed mt-1">
                  {emails.length === 0
                    ? "All caught up! MailPilot's AI guard is watching your inbox 24/7. When emails arrive, they will be processed autonomously according to your reply rules."
                    : 'No emails match your selected search query or category filters. Try adjusting your filters above.'}
                </p>
              </div>
              {onSimulate && emails.length === 0 && (
                <button
                  onClick={() => onSimulate('meeting')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulate Incoming Email</span>
                </button>
              )}
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
                  <div className="flex items-center gap-2">
                    {selectedEmail.status === 'archived' ? (
                      <button
                        onClick={() => handleUnarchiveEmail(selectedEmail)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Restore email to active inbox"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Unarchive</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveEmail(selectedEmail)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Archive email from inbox"
                      >
                        <Archive className="w-3.5 h-3.5 text-slate-400" />
                        <span>Archive</span>
                      </button>
                    )}
                    {getStatusBadge(selectedEmail.status)}
                  </div>
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
                    <div className="p-2 rounded-lg bg-rose-100/70 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mt-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>Safety Guardrail Active:</strong>{' '}
                        {selectedEmail.analysis.sensitivity_reason ||
                          'Sensitive financial or security document. Auto-send held for safety.'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Original Message Body */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-750 text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">
                {selectedEmail.bodyPlain || selectedEmail.snippet}
              </div>

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
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Read message, generate tailored response with Gemini, and dispatch immediately without asking permission"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>{isSending ? 'Auto-Sending via Gmail...' : '⚡ Auto-Reply & Send (Instant)'}</span>
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
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all active:scale-95 cursor-pointer ${
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
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
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
                    placeholder="Click 'Auto-Reply & Send' or 'Draft with Gemini' above to generate an intelligent reply..."
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
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    Generate Draft
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={isDrafting || !editingReply}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isDrafting ? 'Saving Draft...' : 'Save Draft in Gmail'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendConfirmed}
                      disabled={isSending || !editingReply}
                      title="Send this email reply immediately via Gmail"
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Sending via Gmail...' : 'Send Reply via Gmail (Instant)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20 text-center space-y-3 relative overflow-hidden">
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-950/80 rounded-3xl rotate-6 transition-transform" />
                <div className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-3xl -rotate-6" />
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                  All Caught Up!
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed mt-1">
                  MailPilot's AI guard is watching your inbox 24/7. Select an email from the left feed to inspect message context, or simulate an incoming test inquiry.
                </p>
              </div>
              {onSimulate && (
                <button
                  onClick={() => onSimulate('meeting')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer mt-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulate Incoming Email</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Confirmation Dialog for Sending Email */}
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
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendConfirmed}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
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
