export type EmailCategory =
  | 'personal'
  | 'business'
  | 'work'
  | 'customer_support'
  | 'sales'
  | 'meeting_request'
  | 'appointment'
  | 'job_recruitment'
  | 'invoice_payment'
  | 'newsletter'
  | 'promotion'
  | 'spam'
  | 'urgent'
  | 'security_alert'
  | 'other';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'urgent' | 'frustrated';

export type ReplyMode = 'manual' | 'approval' | 'automatic';

export type ReplyTone = 'professional' | 'friendly' | 'casual' | 'formal' | 'concise' | 'warm';

export type ActionType = 'auto_send' | 'approval_queue' | 'draft_only' | 'ignore' | 'notify_user';

export interface UserPreferences {
  userId: string;
  replyMode: ReplyMode;
  defaultTone: ReplyTone;
  customInstructions: string;
  sampleWritingEmails: string[];
  signatureEnabled: boolean;
  signatureText: string;
  language: string;
  workingHoursEnabled: boolean;
  workingHoursStart: string; // "09:00"
  workingHoursEnd: string; // "18:00"
  workingDays: number[]; // 1 = Mon, ..., 5 = Fri
  timezone: string;
  afterHoursReplyEnabled: boolean;
  afterHoursCustomMessage: string;
  minAutoSendConfidence: number; // e.g. 0.90
  minApprovalConfidence: number; // e.g. 0.70
  allowedDomains: string[];
  blockedDomains: string[];
  allowedSenders: string[];
  blockedSenders: string[];
  allowedCategories: EmailCategory[];
  blockedCategories: EmailCategory[];
  notificationsEnabled: boolean;
}

export interface AIAnalysis {
  id: string;
  messageId: string;
  category: EmailCategory;
  urgency: UrgencyLevel;
  sentiment: Sentiment;
  requires_reply: boolean;
  has_question: boolean;
  should_escalate: boolean;
  is_sensitive: boolean;
  sensitivity_reason?: string;
  intent: string;
  suggested_action: string;
  confidence: number;
  extracted_entities?: {
    dates?: string[];
    people?: string[];
    actionItems?: string[];
  };
  analyzedAt: string;
}

export interface GeneratedReply {
  id: string;
  messageId: string;
  threadId: string;
  content: string;
  tone: ReplyTone;
  status: 'suggested' | 'approved' | 'rejected' | 'sent' | 'drafted';
  safetyScore: number;
  safetyPassed: boolean;
  safetyNotes?: string;
  validationChecklist: {
    relevant: boolean;
    answersQuestions: boolean;
    factuallyGrounded: boolean;
    noInventedInfo: boolean;
    noPrivateDataLeak: boolean;
    noUnauthorizedCommitments: boolean;
  };
  generatedAt: string;
  sentAt?: string;
  draftId?: string;
}

export interface EmailMessage {
  id: string;
  gmailId: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  senderName: string;
  recipient: string;
  subject: string;
  snippet: string;
  bodyPlain: string;
  bodyHtml?: string;
  hasAttachments: boolean;
  attachmentNames?: string[];
  date: string;
  labels: string[];
  isInternal: boolean;
  isRead: boolean;
  isSentByMe: boolean;
  processed: boolean;
  analysis?: AIAnalysis;
  suggestedReply?: GeneratedReply;
  status: 'new' | 'analyzed' | 'in_review' | 'replied' | 'drafted' | 'ignored' | 'archived';
}

export interface EmailThread {
  id: string;
  gmailThreadId: string;
  subject: string;
  messageCount: number;
  messages: EmailMessage[];
  lastMessageDate: string;
  snippet: string;
}

export interface RuleCondition {
  field: 'sender' | 'domain' | 'subject' | 'keyword' | 'category' | 'urgency' | 'time_of_day' | 'thread_status';
  operator: 'equals' | 'contains' | 'not_contains' | 'is' | 'in_range';
  value: string;
}

export interface ReplyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR';
  action: ActionType;
  overrideTone?: ReplyTone;
  addSignature?: boolean;
  customPrefix?: string;
  createdAt: string;
}

export interface ApprovalQueueItem {
  id: string;
  messageId: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  snippet: string;
  analysis: AIAnalysis;
  reply: GeneratedReply;
  status: 'pending' | 'approved' | 'rejected' | 'regenerated';
  queuedReason: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'email_received' | 'ai_analyzed' | 'reply_generated' | 'reply_sent' | 'draft_created' | 'approval_queued' | 'rule_triggered' | 'system_alert';
  sender: string;
  subject: string;
  details: string;
  status: 'success' | 'warning' | 'info' | 'error';
  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userEmail: string;
  details: string;
  ipAddress?: string;
}

export interface BillingUsage {
  plan: 'free' | 'pro' | 'business';
  monthlyQuota: number;
  usedThisMonth: number;
  resetDate: string;
  totalProcessedEmails: number;
  totalRepliesGenerated: number;
  totalRepliesSent: number;
  totalDraftsCreated: number;
}
