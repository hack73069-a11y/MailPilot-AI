import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  UserPreferences,
  ReplyRule,
  EmailMessage,
  EmailThread,
  ApprovalQueueItem,
  ActivityLog,
  AuditLog,
  BillingUsage,
} from './types.js';

interface DatabaseSchema {
  preferences: UserPreferences;
  rules: ReplyRule[];
  messages: EmailMessage[];
  threads: EmailThread[];
  queue: ApprovalQueueItem[];
  activities: ActivityLog[];
  audits: AuditLog[];
  billing: BillingUsage;
  activeToken?: string;
  userEmail?: string;
  repliedMessageIds?: string[];
  repliedThreadTimestamps?: Record<string, number>;
  workerStats?: {
    lastPollAt?: string;
    totalCycles: number;
    totalAutoRepliesDispatched: number;
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'mailpilot-db.json');

const DEFAULT_PREFERENCES: UserPreferences = {
  userId: 'default-user',
  replyMode: 'automatic', // 'manual' | 'approval' | 'automatic'
  defaultTone: 'professional',
  customInstructions:
    'Write concise, clear, and courteous responses. Keep emails friendly and direct. Never make commitments or confirm dates without explicitly confirming first.',
  sampleWritingEmails: [
    'Hi Alex,\n\nThanks for reaching out! I would love to connect. Thursday at 2:00 PM works well for me. Let me know if that works for you or if another time suits.\n\nBest,\nAlex',
    'Hello Sarah,\n\nThank you for sharing the project status update. I have reviewed the items and have no objections. Please proceed with the next phase.\n\nBest regards,\nAlex',
  ],
  signatureEnabled: true,
  signatureText: 'Best regards,\nAlex Vance\nHead of Operations, MailPilot',
  language: 'English',
  workingHoursEnabled: true,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: 'America/New_York',
  afterHoursReplyEnabled: true,
  afterHoursCustomMessage:
    'Thanks for reaching out! I am currently outside regular working hours (9:00 AM - 6:00 PM ET). I will review your email and respond as soon as I return tomorrow.',
  minAutoSendConfidence: 0.0,
  minApprovalConfidence: 0.0,
  allowedDomains: ['gmail.com', 'google.com', 'stripe.com', 'github.com'],
  blockedDomains: ['spammer.com', 'unverified.io'],
  allowedSenders: [],
  blockedSenders: [],
  allowedCategories: [
    'business',
    'work',
    'meeting_request',
    'appointment',
    'customer_support',
    'personal',
    'sales',
    'job_recruitment',
    'other',
  ],
  blockedCategories: ['invoice_payment', 'spam', 'security_alert', 'promotion'],
  notificationsEnabled: true,
};

const DEFAULT_RULES: ReplyRule[] = [
  {
    id: 'rule-meeting-requests',
    name: 'Auto-Respond to Meeting Requests',
    description: 'When an email asks to schedule a meeting, suggest 2 time slots and request confirmation.',
    enabled: true,
    priority: 1,
    conditions: [
      { field: 'category', operator: 'equals', value: 'meeting_request' },
      { field: 'urgency', operator: 'not_contains', value: 'critical' },
    ],
    conditionLogic: 'AND',
    action: 'auto_send',
    overrideTone: 'friendly',
    addSignature: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-invoices-security',
    name: 'Block Auto-Reply on Invoices & Payments',
    description: 'Never auto-reply to invoices, billing statements, or payment demands.',
    enabled: true,
    priority: 2,
    conditions: [{ field: 'category', operator: 'equals', value: 'invoice_payment' }],
    conditionLogic: 'AND',
    action: 'ignore',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-customer-support',
    name: 'Customer Support Inquiry Acknowledgment',
    description: 'Provide a structured empathetic response confirming receipt and outlining next steps.',
    enabled: true,
    priority: 3,
    conditions: [{ field: 'category', operator: 'equals', value: 'customer_support' }],
    conditionLogic: 'AND',
    action: 'auto_send',
    overrideTone: 'warm',
    addSignature: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-newsletters',
    name: 'Ignore Newsletters & Promotions',
    description: 'Skip AI reply generation for bulk marketing emails and newsletters.',
    enabled: true,
    priority: 4,
    conditions: [{ field: 'category', operator: 'equals', value: 'newsletter' }],
    conditionLogic: 'AND',
    action: 'ignore',
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_BILLING: BillingUsage = {
  plan: 'free',
  monthlyQuota: 50,
  usedThisMonth: 12,
  resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  totalProcessedEmails: 18,
  totalRepliesGenerated: 14,
  totalRepliesSent: 9,
  totalDraftsCreated: 3,
};

const SEED_MESSAGES: EmailMessage[] = [
  {
    id: 'msg-seed-1',
    gmailId: 'gmail-192a3b4c5d6e7f80',
    threadId: 'thread-101',
    sender: 'Sarah Jenkins <sarah.jenkins@partnercorp.com>',
    senderEmail: 'sarah.jenkins@partnercorp.com',
    senderName: 'Sarah Jenkins',
    recipient: 'me',
    subject: 'Q4 Product Roadmap Sync - Friday?',
    snippet: 'Hi Alex, hope you are having a productive week. Can we schedule 30 minutes on Friday at 2:00 PM to review the roadmap?',
    bodyPlain: `Hi Alex,\n\nHope you are having a productive week!\n\nCan we schedule 30 minutes on Friday at 2:00 PM ET to review the Q4 product roadmap? I want to make sure engineering and marketing are aligned on the upcoming launch date.\n\nLet me know if that time works or if you have another opening.\n\nThanks,\nSarah Jenkins\nDirector of Strategic Partnerships`,
    hasAttachments: false,
    date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    labels: ['INBOX', 'IMPORTANT'],
    isInternal: false,
    isRead: false,
    isSentByMe: false,
    processed: true,
    status: 'in_review',
    analysis: {
      id: 'analysis-1',
      messageId: 'msg-seed-1',
      category: 'meeting_request',
      urgency: 'medium',
      sentiment: 'positive',
      requires_reply: true,
      has_question: true,
      should_escalate: false,
      is_sensitive: false,
      intent: 'Sender wants to schedule a 30-minute sync on Friday at 2:00 PM ET to review the Q4 product roadmap.',
      suggested_action: 'Confirm availability for Friday 2:00 PM or offer alternative slots.',
      confidence: 0.96,
      extracted_entities: {
        dates: ['Friday at 2:00 PM ET'],
        people: ['Sarah Jenkins', 'Alex'],
        actionItems: ['Schedule 30-min sync', 'Review Q4 product roadmap'],
      },
      analyzedAt: new Date(Date.now() - 3600 * 1000 * 2 + 5000).toISOString(),
    },
    suggestedReply: {
      id: 'reply-1',
      messageId: 'msg-seed-1',
      threadId: 'thread-101',
      content: `Hi Sarah,\n\nThanks for reaching out! Friday at 2:00 PM ET works well for me. I'll send over a calendar invite with the meeting link shortly.\n\nLooking forward to aligning on the Q4 roadmap.\n\nBest regards,\nAlex Vance\nHead of Operations, MailPilot`,
      tone: 'friendly',
      status: 'suggested',
      safetyScore: 0.98,
      safetyPassed: true,
      safetyNotes: 'Reply directly addresses time request, does not leak confidential data.',
      validationChecklist: {
        relevant: true,
        answersQuestions: true,
        factuallyGrounded: true,
        noInventedInfo: true,
        noPrivateDataLeak: true,
        noUnauthorizedCommitments: true,
      },
      generatedAt: new Date(Date.now() - 3600 * 1000 * 2 + 8000).toISOString(),
    },
  },
  {
    id: 'msg-seed-2',
    gmailId: 'gmail-192a3b4c5d6e7f81',
    threadId: 'thread-102',
    sender: 'David Chen <david.chen@enterprisecloud.io>',
    senderEmail: 'david.chen@enterprisecloud.io',
    senderName: 'David Chen',
    recipient: 'me',
    subject: 'Question regarding API webhook rate limits',
    snippet: 'Hello support team, we noticed a few 429 errors when sending batch webhook payloads yesterday evening.',
    bodyPlain: `Hello Alex,\n\nWe noticed a few 429 Too Many Requests errors when sending batch webhook payloads yesterday evening around 8:00 PM UTC.\n\nCould you clarify whether the current rate limit is 100 req/sec per workspace or if there is an hourly burst allowance? We want to tune our retry queues accordingly.\n\nBest regards,\nDavid Chen\nStaff Infrastructure Engineer`,
    hasAttachments: false,
    date: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    labels: ['INBOX'],
    isInternal: false,
    isRead: false,
    isSentByMe: false,
    processed: true,
    status: 'in_review',
    analysis: {
      id: 'analysis-2',
      messageId: 'msg-seed-2',
      category: 'customer_support',
      urgency: 'high',
      sentiment: 'neutral',
      requires_reply: true,
      has_question: true,
      should_escalate: false,
      is_sensitive: false,
      intent: 'Customer asking for clarification on API webhook rate limits and burst allowances due to 429 errors.',
      suggested_action: 'Acknowledge inquiry and provide rate limit specifications with documentation link.',
      confidence: 0.93,
      analyzedAt: new Date(Date.now() - 3600 * 1000 * 5 + 4000).toISOString(),
    },
    suggestedReply: {
      id: 'reply-2',
      messageId: 'msg-seed-2',
      threadId: 'thread-102',
      content: `Hi David,\n\nThank you for reaching out. Our webhook rate limit is currently set to 120 requests per second per workspace, with a burst buffer allowing up to 300 requests over a rolling 10-second window.\n\nFor high-volume batch payloads, we recommend enabling exponential backoff with jitter on your retry queues. I would be happy to share our webhook best practices guide if helpful.\n\nBest regards,\nAlex Vance\nHead of Operations, MailPilot`,
      tone: 'professional',
      status: 'suggested',
      safetyScore: 0.95,
      safetyPassed: true,
      validationChecklist: {
        relevant: true,
        answersQuestions: true,
        factuallyGrounded: true,
        noInventedInfo: true,
        noPrivateDataLeak: true,
        noUnauthorizedCommitments: true,
      },
      generatedAt: new Date(Date.now() - 3600 * 1000 * 5 + 6000).toISOString(),
    },
  },
  {
    id: 'msg-seed-3',
    gmailId: 'gmail-192a3b4c5d6e7f82',
    threadId: 'thread-103',
    sender: 'Acme Billing Services <billing@acmepayments.com>',
    senderEmail: 'billing@acmepayments.com',
    senderName: 'Acme Billing Services',
    recipient: 'me',
    subject: 'Invoice #INV-2026-9042 Paid Successfully',
    snippet: 'Your monthly subscription payment of $149.00 has processed successfully. Download your receipt.',
    bodyPlain: `Dear Customer,\n\nYour payment for Invoice #INV-2026-9042 in the amount of $149.00 has been processed successfully.\n\nPayment Method: Visa ending in 4242\nBilling Period: Sep 2026 - Oct 2026\n\nThank you for your business!`,
    hasAttachments: true,
    attachmentNames: ['Invoice_INV-2026-9042.pdf'],
    date: new Date(Date.now() - 3600 * 1000 * 9).toISOString(),
    labels: ['INBOX'],
    isInternal: false,
    isRead: true,
    isSentByMe: false,
    processed: true,
    status: 'ignored',
    analysis: {
      id: 'analysis-3',
      messageId: 'msg-seed-3',
      category: 'invoice_payment',
      urgency: 'low',
      sentiment: 'positive',
      requires_reply: false,
      has_question: false,
      should_escalate: false,
      is_sensitive: true,
      sensitivity_reason: 'Automated receipt / financial transaction document. No auto-reply safe.',
      intent: 'Receipt confirmation for subscription payment.',
      suggested_action: 'Archive or file under receipts; no response required.',
      confidence: 0.99,
      analyzedAt: new Date(Date.now() - 3600 * 1000 * 9 + 2000).toISOString(),
    },
  },
];

const SEED_THREADS: EmailThread[] = [
  {
    id: 'thread-101',
    gmailThreadId: 'thread-101',
    subject: 'Q4 Product Roadmap Sync - Friday?',
    messageCount: 1,
    messages: [SEED_MESSAGES[0]],
    lastMessageDate: SEED_MESSAGES[0].date,
    snippet: SEED_MESSAGES[0].snippet,
  },
  {
    id: 'thread-102',
    gmailThreadId: 'thread-102',
    subject: 'Question regarding API webhook rate limits',
    messageCount: 1,
    messages: [SEED_MESSAGES[1]],
    lastMessageDate: SEED_MESSAGES[1].date,
    snippet: SEED_MESSAGES[1].snippet,
  },
  {
    id: 'thread-103',
    gmailThreadId: 'thread-103',
    subject: 'Invoice #INV-2026-9042 Paid Successfully',
    messageCount: 1,
    messages: [SEED_MESSAGES[2]],
    lastMessageDate: SEED_MESSAGES[2].date,
    snippet: SEED_MESSAGES[2].snippet,
  },
];

const SEED_QUEUE: ApprovalQueueItem[] = [
  {
    id: 'queue-1',
    messageId: 'msg-seed-1',
    threadId: 'thread-101',
    sender: 'Sarah Jenkins <sarah.jenkins@partnercorp.com>',
    senderEmail: 'sarah.jenkins@partnercorp.com',
    subject: 'Q4 Product Roadmap Sync - Friday?',
    receivedAt: SEED_MESSAGES[0].date,
    snippet: SEED_MESSAGES[0].snippet,
    analysis: SEED_MESSAGES[0].analysis!,
    reply: SEED_MESSAGES[0].suggestedReply!,
    status: 'pending',
    queuedReason: 'Rule matched: Auto-Respond to Meeting Requests (Approval required)',
    createdAt: SEED_MESSAGES[0].suggestedReply!.generatedAt,
  },
  {
    id: 'queue-2',
    messageId: 'msg-seed-2',
    threadId: 'thread-102',
    sender: 'David Chen <david.chen@enterprisecloud.io>',
    senderEmail: 'david.chen@enterprisecloud.io',
    subject: 'Question regarding API webhook rate limits',
    receivedAt: SEED_MESSAGES[1].date,
    snippet: SEED_MESSAGES[1].snippet,
    analysis: SEED_MESSAGES[1].analysis!,
    reply: SEED_MESSAGES[1].suggestedReply!,
    status: 'pending',
    queuedReason: 'Rule matched: Customer Support Inquiry (Approval mode active)',
    createdAt: SEED_MESSAGES[1].suggestedReply!.generatedAt,
  },
];

const SEED_ACTIVITIES: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    type: 'email_received',
    sender: 'sarah.jenkins@partnercorp.com',
    subject: 'Q4 Product Roadmap Sync - Friday?',
    details: 'New incoming email received in Inbox.',
    status: 'info',
  },
  {
    id: 'act-2',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2 + 5000).toISOString(),
    type: 'ai_analyzed',
    sender: 'sarah.jenkins@partnercorp.com',
    subject: 'Q4 Product Roadmap Sync - Friday?',
    details: 'Classified as Meeting Request (96% confidence). Urgency: Medium.',
    status: 'success',
  },
  {
    id: 'act-3',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2 + 8000).toISOString(),
    type: 'reply_generated',
    sender: 'sarah.jenkins@partnercorp.com',
    subject: 'Q4 Product Roadmap Sync - Friday?',
    details: 'AI suggested reply generated. Placed in Review Queue for user approval.',
    status: 'warning',
  },
  {
    id: 'act-4',
    timestamp: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    type: 'email_received',
    sender: 'david.chen@enterprisecloud.io',
    subject: 'Question regarding API webhook rate limits',
    details: 'New customer support message received.',
    status: 'info',
  },
  {
    id: 'act-5',
    timestamp: new Date(Date.now() - 3600 * 1000 * 5 + 6000).toISOString(),
    type: 'reply_generated',
    sender: 'david.chen@enterprisecloud.io',
    subject: 'Question regarding API webhook rate limits',
    details: 'AI draft response generated with technical parameters.',
    status: 'warning',
  },
];

class DatabaseService {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDir();
    this.data = this.loadData();
  }

  private ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.preferences) {
          parsed.preferences.replyMode = 'automatic';
          if (!parsed.preferences.minAutoSendConfidence || parsed.preferences.minAutoSendConfidence > 0.8) {
            parsed.preferences.minAutoSendConfidence = 0.70;
          }
        }
        if (parsed.rules && Array.isArray(parsed.rules)) {
          parsed.rules.forEach((r: any) => {
            if (r.id === 'rule-meeting-requests' || r.id === 'rule-customer-support') {
              r.action = 'auto_send';
            }
          });
        }
        return parsed;
      }
    } catch (err) {
      console.error('Error loading db file, falling back to seed:', err);
    }

    const initial: DatabaseSchema = {
      preferences: DEFAULT_PREFERENCES,
      rules: DEFAULT_RULES,
      messages: SEED_MESSAGES,
      threads: SEED_THREADS,
      queue: SEED_QUEUE,
      activities: SEED_ACTIVITIES,
      audits: [],
      billing: INITIAL_BILLING,
    };
    this.saveData(initial);
    return initial;
  }

  private saveData(dataToSave?: DatabaseSchema) {
    try {
      this.ensureDir();
      const content = JSON.stringify(dataToSave || this.data, null, 2);
      fs.writeFileSync(DB_FILE, content, 'utf-8');
    } catch (err) {
      console.error('Failed to save database file:', err);
    }
  }

  // Preferences
  getPreferences(): UserPreferences {
    return this.data.preferences;
  }

  updatePreferences(patch: Partial<UserPreferences>): UserPreferences {
    this.data.preferences = { ...this.data.preferences, ...patch };
    this.saveData();
    this.logAudit('update_preferences', 'User updated system preferences');
    return this.data.preferences;
  }

  // Rules
  getRules(): ReplyRule[] {
    return this.data.rules;
  }

  getRule(id: string): ReplyRule | undefined {
    return this.data.rules.find((r) => r.id === id);
  }

  createRule(rule: Omit<ReplyRule, 'id' | 'createdAt'>): ReplyRule {
    const newRule: ReplyRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.rules.push(newRule);
    this.saveData();
    this.logAudit('create_rule', `Created rule "${newRule.name}"`);
    return newRule;
  }

  updateRule(id: string, patch: Partial<ReplyRule>): ReplyRule | null {
    const idx = this.data.rules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.rules[idx] = { ...this.data.rules[idx], ...patch };
    this.saveData();
    this.logAudit('update_rule', `Updated rule id ${id}`);
    return this.data.rules[idx];
  }

  deleteRule(id: string): boolean {
    const initialLen = this.data.rules.length;
    this.data.rules = this.data.rules.filter((r) => r.id !== id);
    if (this.data.rules.length !== initialLen) {
      this.saveData();
      this.logAudit('delete_rule', `Deleted rule id ${id}`);
      return true;
    }
    return false;
  }

  // Messages & Threads
  getMessages(): EmailMessage[] {
    const hasRealMessages = this.data.messages.some(
      (m) => !m.id.startsWith('msg-seed-') && !m.id.startsWith('sim-')
    );
    if (hasRealMessages) {
      return this.data.messages.filter((m) => !m.id.startsWith('msg-seed-'));
    }
    return this.data.messages;
  }

  getMessage(id: string): EmailMessage | undefined {
    return this.data.messages.find((m) => m.id === id || m.gmailId === id);
  }

  upsertMessage(msg: EmailMessage): EmailMessage {
    const idx = this.data.messages.findIndex((m) => m.id === msg.id || m.gmailId === msg.gmailId);
    if (idx >= 0) {
      this.data.messages[idx] = { ...this.data.messages[idx], ...msg };
    } else {
      this.data.messages.unshift(msg);
      this.data.billing.totalProcessedEmails += 1;
    }
    this.saveData();
    return msg;
  }

  getThreads(): EmailThread[] {
    return this.data.threads;
  }

  getThread(threadId: string): EmailThread | undefined {
    return this.data.threads.find((t) => t.id === threadId || t.gmailThreadId === threadId);
  }

  upsertThread(thread: EmailThread): void {
    const idx = this.data.threads.findIndex(
      (t) => t.id === thread.id || t.gmailThreadId === thread.gmailThreadId
    );
    if (idx >= 0) {
      this.data.threads[idx] = thread;
    } else {
      this.data.threads.unshift(thread);
    }
    this.saveData();
  }

  // Queue
  getQueue(): ApprovalQueueItem[] {
    const hasRealMessages = this.data.messages.some(
      (m) => !m.id.startsWith('msg-seed-') && !m.id.startsWith('sim-')
    );
    if (hasRealMessages) {
      return this.data.queue.filter((q) => !q.messageId.startsWith('msg-seed-'));
    }
    return this.data.queue;
  }

  getQueueItem(id: string): ApprovalQueueItem | undefined {
    return this.data.queue.find((q) => q.id === id);
  }

  addToQueue(item: ApprovalQueueItem): ApprovalQueueItem {
    // Avoid duplicate queue entry for same message
    const existing = this.data.queue.find((q) => q.messageId === item.messageId);
    if (existing) {
      Object.assign(existing, item);
      this.saveData();
      return existing;
    }
    this.data.queue.unshift(item);
    this.saveData();
    return item;
  }

  updateQueueItem(id: string, patch: Partial<ApprovalQueueItem>): ApprovalQueueItem | null {
    const idx = this.data.queue.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    this.data.queue[idx] = { ...this.data.queue[idx], ...patch };
    this.saveData();
    return this.data.queue[idx];
  }

  removeFromQueue(id: string): void {
    this.data.queue = this.data.queue.filter((q) => q.id !== id);
    this.saveData();
  }

  // Activities
  getActivities(limit = 50): ActivityLog[] {
    return this.data.activities.slice(0, limit);
  }

  logActivity(
    type: ActivityLog['type'],
    sender: string,
    subject: string,
    details: string,
    status: ActivityLog['status'] = 'info',
    metadata?: Record<string, unknown>
  ): ActivityLog {
    const act: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      sender,
      subject,
      details,
      status,
      metadata,
    };
    this.data.activities.unshift(act);
    if (this.data.activities.length > 200) {
      this.data.activities = this.data.activities.slice(0, 200);
    }
    this.saveData();
    return act;
  }

  // Audits
  logAudit(action: string, details: string, userEmail = 'user@gmail.com', ipAddress?: string): AuditLog {
    const audit: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      userEmail,
      details,
      ipAddress,
    };
    this.data.audits.unshift(audit);
    if (this.data.audits.length > 500) {
      this.data.audits = this.data.audits.slice(0, 500);
    }
    this.saveData();
    return audit;
  }

  getAuditLogs(limit = 100): AuditLog[] {
    return this.data.audits.slice(0, limit);
  }

  // Billing
  getBilling(): BillingUsage {
    return this.data.billing;
  }

  incrementRepliesGenerated(): void {
    this.data.billing.totalRepliesGenerated += 1;
    this.data.billing.usedThisMonth += 1;
    this.saveData();
  }

  incrementRepliesSent(): void {
    this.data.billing.totalRepliesSent += 1;
    this.saveData();
  }

  incrementDraftsCreated(): void {
    this.data.billing.totalDraftsCreated += 1;
    this.saveData();
  }

  updateBillingPlan(plan: 'free' | 'pro' | 'business'): BillingUsage {
    this.data.billing.plan = plan;
    this.data.billing.monthlyQuota = plan === 'free' ? 50 : plan === 'pro' ? 1000 : 10000;
    this.saveData();
    this.logAudit('change_plan', `Switched billing plan to ${plan.toUpperCase()}`);
    return this.data.billing;
  }

  private memoryToken: string | undefined = undefined;
  private memoryUser: any = undefined;
  private memoryTokenExpiresAt: number | undefined = undefined;

  // Active Token & Background Worker Persistence (stored in-memory only to avoid committing tokens to disk/git)
  getSavedToken(): string | undefined {
    if (this.memoryTokenExpiresAt && Date.now() > this.memoryTokenExpiresAt) {
      this.clearSavedToken();
      return undefined;
    }
    return this.memoryToken;
  }

  setSavedToken(token: string, email?: string, user?: any, expiresInMs = 3600000): void {
    this.memoryToken = token;
    this.memoryTokenExpiresAt = Date.now() + expiresInMs;
    if (user) this.memoryUser = user;
    this.data.activeToken = undefined; // Never persist bearer tokens to JSON file
    if (email) this.data.userEmail = email;
    this.saveData();
    this.logAudit('store_token', 'Saved active Gmail access token for continuous 24/7 background worker');
  }

  getUserMeta(): any {
    return this.memoryUser || (this.data.userEmail ? { email: this.data.userEmail } : undefined);
  }

  clearSavedToken(): void {
    this.memoryToken = undefined;
    this.memoryUser = undefined;
    this.memoryTokenExpiresAt = undefined;
    this.data.activeToken = undefined;
    this.saveData();
    this.logAudit('clear_token', 'Cleared Gmail access token');
  }

  getUserEmail(): string | undefined {
    return this.data.userEmail;
  }

  // Persistent deduplication against double-replies
  isMessageReplied(messageId: string): boolean {
    if (!messageId) return false;
    if (this.data.repliedMessageIds?.includes(messageId)) return true;
    const msg = this.getMessage(messageId);
    return Boolean(msg && (msg.status === 'replied' || msg.suggestedReply?.status === 'sent'));
  }

  isThreadRepliedRecently(threadId: string, cooldownMs = 60000): boolean {
    if (!threadId) return false;
    const lastTime = this.data.repliedThreadTimestamps?.[threadId];
    if (lastTime && Date.now() - lastTime < cooldownMs) return true;
    return false;
  }

  recordReplyDispatched(messageId: string, threadId: string): void {
    if (!this.data.repliedMessageIds) this.data.repliedMessageIds = [];
    if (!this.data.repliedThreadTimestamps) this.data.repliedThreadTimestamps = {};
    if (messageId && !this.data.repliedMessageIds.includes(messageId)) {
      this.data.repliedMessageIds.push(messageId);
      if (this.data.repliedMessageIds.length > 1000) {
        this.data.repliedMessageIds = this.data.repliedMessageIds.slice(-1000);
      }
    }
    if (threadId) {
      this.data.repliedThreadTimestamps[threadId] = Date.now();
    }
    this.saveData();
  }

  getWorkerStats() {
    return this.data.workerStats || {
      lastPollAt: undefined,
      totalCycles: 0,
      totalAutoRepliesDispatched: 0,
    };
  }

  recordWorkerCycle(dispatchedRepliesCount = 0) {
    if (!this.data.workerStats) {
      this.data.workerStats = {
        lastPollAt: new Date().toISOString(),
        totalCycles: 1,
        totalAutoRepliesDispatched: dispatchedRepliesCount,
      };
    } else {
      this.data.workerStats.lastPollAt = new Date().toISOString();
      this.data.workerStats.totalCycles += 1;
      this.data.workerStats.totalAutoRepliesDispatched += dispatchedRepliesCount;
    }
    this.saveData();
  }

  // Privacy: Delete My Data
  deleteUserData(): void {
    this.data.messages = [];
    this.data.threads = [];
    this.data.queue = [];
    this.data.activities = [];
    this.data.audits = [];
    this.data.preferences = DEFAULT_PREFERENCES;
    this.data.rules = DEFAULT_RULES;
    this.data.billing = INITIAL_BILLING;
    this.saveData();
    this.logAudit('delete_all_data', 'User triggered Delete My Data complete purge');
  }
}

export const db = new DatabaseService();
