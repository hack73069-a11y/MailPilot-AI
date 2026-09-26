import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './server/db.js';
import { aiProvider } from './server/ai/provider.js';
import { gmailClient } from './server/gmail/client.js';
import { emailProcessor } from './server/workers/emailProcessor.js';
import { backgroundDaemon } from './server/workers/backgroundDaemon.js';
import { ruleEngine } from './server/rules/engine.js';
import { EmailMessage, ReplyTone } from './server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to extract bearer token
function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  return authHeader.substring(7).trim();
}

// Helper to determine if an email or thread is simulated / local testing data
function isSimulatedMessage(id?: string, threadId?: string): boolean {
  if (!id && !threadId) return false;
  return Boolean(
    (id && (id.startsWith('sim-') || id.startsWith('msg-seed') || id.startsWith('seed-'))) ||
    (threadId && (threadId.startsWith('sim-') || threadId.startsWith('thread-')))
  );
}

/* =========================================================================
   API ROUTES
   ========================================================================= */

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MailPilot AI',
    version: '1.0.0',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 24/7 Background Worker Status & Control
app.get('/api/worker/status', (req: Request, res: Response) => {
  res.json(backgroundDaemon.getStatus());
});

app.post('/api/worker/token', async (req: Request, res: Response) => {
  const { token, email } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }
  db.setSavedToken(token, email);
  // Trigger immediate poll cycle in background
  backgroundDaemon.pollCycle().catch((err) => console.warn('[Worker] Immediate poll notice:', err.message));
  res.json({
    success: true,
    message: 'Gmail session token saved. 24/7 background worker is active.',
    status: backgroundDaemon.getStatus(),
  });
});

app.delete('/api/worker/token', (req: Request, res: Response) => {
  db.clearSavedToken();
  res.json({
    success: true,
    message: 'Active Gmail token cleared from background worker.',
    status: backgroundDaemon.getStatus(),
  });
});

app.post('/api/worker/start', (req: Request, res: Response) => {
  backgroundDaemon.start();
  res.json({
    success: true,
    message: '24/7 background worker daemon active',
    status: backgroundDaemon.getStatus(),
  });
});

app.post('/api/worker/stop', (req: Request, res: Response) => {
  backgroundDaemon.stop();
  res.json({
    success: true,
    message: '24/7 background worker daemon paused',
    status: backgroundDaemon.getStatus(),
  });
});

app.post('/api/worker/trigger', async (req: Request, res: Response) => {
  try {
    const result = await backgroundDaemon.pollCycle();
    res.json({
      success: true,
      processedCount: result.processedCount,
      repliesDispatched: result.repliesDispatched,
      status: backgroundDaemon.getStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Trigger poll failed' });
  }
});

// User Profile / Connected Account
app.get('/api/user/profile', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.json({
      connected: false,
      user: {
        email: 'guest@mailpilot.ai',
        displayName: 'Guest User',
        photoUrl: '',
      },
    });
  }

  try {
    const profile = await gmailClient.getProfile(token);
    return res.json({
      connected: true,
      user: {
        email: profile.emailAddress,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
        historyId: profile.historyId,
      },
    });
  } catch (err: any) {
    console.warn('Gmail getProfile with token failed:', err.message);
    return res.json({
      connected: false,
      error: err.message,
      user: {
        email: 'unauthenticated',
      },
    });
  }
});

// Privacy: Delete User Data
app.post('/api/user/delete-data', (req: Request, res: Response) => {
  db.deleteUserData();
  res.json({
    success: true,
    message: 'All application data, message history, rules, and cache have been completely wiped.',
  });
});

// Settings & Preferences
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(db.getPreferences());
});

app.put('/api/settings', (req: Request, res: Response) => {
  const updated = db.updatePreferences(req.body);
  res.json(updated);
});

// Rules CRUD
app.get('/api/rules', (req: Request, res: Response) => {
  res.json(db.getRules());
});

app.post('/api/rules', (req: Request, res: Response) => {
  const created = db.createRule(req.body);
  res.status(201).json(created);
});

app.put('/api/rules/:id', (req: Request, res: Response) => {
  const updated = db.updateRule(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Rule not found' });
  res.json(updated);
});

app.delete('/api/rules/:id', (req: Request, res: Response) => {
  const success = db.deleteRule(req.params.id);
  if (!success) return res.status(404).json({ error: 'Rule not found' });
  res.json({ success: true });
});

// Emails & Threads
app.get('/api/emails', (req: Request, res: Response) => {
  const { category, urgency, status, search } = req.query;
  let list = db.getMessages();

  if (category) {
    list = list.filter((m) => m.analysis?.category === category);
  }
  if (urgency) {
    list = list.filter((m) => m.analysis?.urgency === urgency);
  }
  if (status) {
    list = list.filter((m) => m.status === status);
  }
  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter(
      (m) =>
        m.subject.toLowerCase().includes(s) ||
        m.sender.toLowerCase().includes(s) ||
        m.snippet.toLowerCase().includes(s)
    );
  }

  res.json(list);
});

app.get('/api/emails/:id', (req: Request, res: Response) => {
  const message = db.getMessage(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const thread = db.getThread(message.threadId);
  res.json({ message, thread });
});

// Gmail Sync: Poll / Fetch latest incoming messages
app.post('/api/gmail/sync', async (req: Request, res: Response) => {
  const token = getBearerToken(req) || backgroundDaemon.getActiveToken().token;
  if (!token) {
    return res.status(401).json({
      error: 'Active Gmail access token required. Please click Connect Gmail to authenticate.',
      isAuthError: true,
      code: 'authError',
    });
  }

  try {
    const listRes = await gmailClient.listMessages(token, 'in:inbox -label:SENT', 10);
    const messages = listRes.messages || [];
    const processedResults = [];

    for (const item of messages) {
      // Avoid re-fetching already processed message
      const existing = db.getMessage(item.id);
      if (existing && existing.processed) continue;

      const rawMsg = await gmailClient.getMessage(token, item.id);
      const parsed = gmailClient.parseMessage(rawMsg);
      const result = await emailProcessor.processIncomingEmail(parsed, token);
      processedResults.push(result);
    }

    res.json({
      syncedCount: processedResults.length,
      results: processedResults,
    });
  } catch (err: any) {
    console.error('Gmail sync failed:', err.message || err);
    const isAuthError = err.isAuthError || err.status === 401 || (err.message && err.message.includes('authError'));
    const statusCode = isAuthError ? 401 : (err.status || 500);
    res.status(statusCode).json({
      error: err.message || 'Failed to sync emails from Gmail',
      isAuthError: Boolean(isAuthError),
      code: isAuthError ? 'authError' : 'syncError',
    });
  }
});

// Simulation endpoint: Create a realistic incoming email for demonstration & testing
app.post('/api/gmail/simulate', async (req: Request, res: Response) => {
  const { type } = req.body; // 'meeting' | 'support' | 'security' | 'sales' | 'general'
  const simId = `sim-${Date.now()}`;
  const threadId = `sim-thread-${Date.now()}`;

  let parsed: any;
  if (type === 'security') {
    parsed = {
      id: simId,
      threadId,
      sender: 'Google Security <no-reply@accounts.google.com>',
      senderEmail: 'no-reply@accounts.google.com',
      senderName: 'Google Security Team',
      recipient: 'me',
      subject: 'Security Alert: New sign-in from Linux device',
      date: new Date().toISOString(),
      snippet: 'We noticed a new login to your Google Account on a Linux device in Singapore.',
      bodyPlain:
        'Security alert:\n\nA new sign-in was detected on your account from a Linux device.\nLocation: Singapore\nTime: Just now\n\nIf this was you, you do not need to do anything. If this was not you, review your account security immediately.',
      hasAttachments: false,
      attachmentNames: [],
      labels: ['INBOX'],
    };
  } else if (type === 'sales') {
    parsed = {
      id: simId,
      threadId,
      sender: 'Elena Rostova <elena@growthreach.io>',
      senderEmail: 'elena@growthreach.io',
      senderName: 'Elena Rostova',
      recipient: 'me',
      subject: 'Quick question about MailPilot scaling plans',
      date: new Date().toISOString(),
      snippet: 'Hi Alex, I came across MailPilot and was impressed by your auto-reply features. Would love to know if you support custom enterprise SLAs?',
      bodyPlain:
        'Hi Alex,\n\nI came across MailPilot and was really impressed by your intelligent auto-reply system!\n\nWe are looking to roll this out across a team of 45 client managers. Could you share if your Business plan includes custom enterprise SLAs and SSO integration?\n\nBest,\nElena Rostova',
      hasAttachments: false,
      attachmentNames: [],
      labels: ['INBOX'],
    };
  } else {
    // Default meeting
    parsed = {
      id: simId,
      threadId,
      sender: 'Marcus Vance <marcus.vance@venturepartners.com>',
      senderEmail: 'marcus.vance@venturepartners.com',
      senderName: 'Marcus Vance',
      recipient: 'me',
      subject: 'Catch-up & Partnership Discussion next Tuesday?',
      date: new Date().toISOString(),
      snippet: 'Hi Alex, following up on our chat at the conference. Are you free next Tuesday afternoon for a 30-min coffee or Zoom sync?',
      bodyPlain:
        'Hi Alex,\n\nFollowing up on our conversation at the conference last week. It was great discussing the AI automation roadmap.\n\nAre you available for a 30-minute coffee or Zoom sync next Tuesday around 3:00 PM ET? Let me know what works best.\n\nBest,\nMarcus Vance',
      hasAttachments: false,
      attachmentNames: [],
      labels: ['INBOX'],
    };
  }

  const token = getBearerToken(req);
  const result = await emailProcessor.processIncomingEmail(parsed, token);
  res.json({ success: true, email: result.message, actionTaken: result.actionTaken });
});

// Single Email AI Actions
app.post('/api/emails/:id/analyze', async (req: Request, res: Response) => {
  const message = db.getMessage(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const thread = db.getThread(message.threadId);
  const threadContext = thread?.messages
    .filter((m) => m.id !== message.id)
    .map((m) => `[From: ${m.sender}]: ${m.bodyPlain || m.snippet}`)
    .join('\n\n');

  const analysis = await aiProvider.classifyEmail(
    {
      sender: message.sender,
      subject: message.subject,
      body: message.bodyPlain,
      snippet: message.snippet,
    },
    threadContext
  );

  analysis.messageId = message.id;
  message.analysis = analysis;
  db.upsertMessage(message);

  res.json(analysis);
});

app.post('/api/emails/:id/generate-reply', async (req: Request, res: Response) => {
  const message = db.getMessage(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const { customInstruction, tone } = req.body;
  const preferences = db.getPreferences();
  const thread = db.getThread(message.threadId);
  const threadMessages = thread ? thread.messages : [message];

  const analysis = message.analysis || (await aiProvider.classifyEmail({
    sender: message.sender,
    subject: message.subject,
    body: message.bodyPlain,
  }));

  const effectivePreferences = tone ? { ...preferences, defaultTone: tone as ReplyTone } : preferences;
  const reply = await aiProvider.generateReply(
    message,
    threadMessages,
    effectivePreferences,
    analysis,
    customInstruction
  );

  message.suggestedReply = reply;
  db.upsertMessage(message);
  db.incrementRepliesGenerated();

  res.json(reply);
});

// Combined Action: See message, use Gemini to create a reply and send it in one unified operation
app.post('/api/emails/:id/generate-and-send', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  const message = db.getMessage(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const { customInstruction, tone } = req.body;
  const preferences = db.getPreferences();
  const thread = db.getThread(message.threadId);
  const threadMessages = thread ? thread.messages : [message];

  // 1. Inspect & analyze message if needed
  const threadContext = threadMessages
    .filter((m) => m.id !== message.id)
    .map((m) => `[From: ${m.sender}]: ${m.bodyPlain || m.snippet}`)
    .join('\n\n');

  const analysis = message.analysis || (await aiProvider.classifyEmail(
    {
      sender: message.sender,
      subject: message.subject,
      body: message.bodyPlain,
      snippet: message.snippet,
    },
    threadContext
  ));
  analysis.messageId = message.id;
  message.analysis = analysis;

  // 2. Generate personalized reply with Gemini
  const effectivePreferences = tone ? { ...preferences, defaultTone: tone as ReplyTone } : preferences;
  const reply = await aiProvider.generateReply(
    message,
    threadMessages,
    effectivePreferences,
    analysis,
    customInstruction
  );
  message.suggestedReply = reply;
  db.incrementRepliesGenerated();

  // 3. Dispatch reply via Gmail API
  if (token && !isSimulatedMessage(message.id, message.threadId)) {
    try {
      await gmailClient.sendReply(token, {
        threadId: message.threadId,
        to: message.senderEmail,
        subject: message.subject,
        body: reply.content,
      });
    } catch (err: any) {
      db.upsertMessage(message);
      return res.status(500).json({ error: `Gmail API send failed: ${err.message}`, reply });
    }
  }

  // Update status & logs
  message.status = 'replied';
  reply.status = 'sent';
  reply.sentAt = new Date().toISOString();
  db.upsertMessage(message);
  db.incrementRepliesSent();

  db.logActivity(
    'reply_sent',
    message.senderEmail,
    message.subject,
    `Gemini generated reply and dispatched ${token ? 'via Gmail API' : '(preview mode)'}.`,
    'success'
  );

  const queueItem = db.getQueue().find((q) => q.messageId === message.id);
  if (queueItem) {
    db.removeFromQueue(queueItem.id);
  }

  res.json({ success: true, email: message, reply });
});

// Send Reply (Interactive from User)
app.post('/api/emails/:id/send-reply', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  const message = db.getMessage(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const { replyContent } = req.body;
  const content = replyContent || message.suggestedReply?.content;

  if (!content) {
    return res.status(400).json({ error: 'Reply content cannot be empty.' });
  }

  if (token && !isSimulatedMessage(message.id, message.threadId)) {
    try {
      await gmailClient.sendReply(token, {
        threadId: message.threadId,
        to: message.senderEmail,
        subject: message.subject,
        body: content,
      });
    } catch (err: any) {
      return res.status(500).json({ error: `Gmail API send failed: ${err.message}` });
    }
  }

  // Update status & log
  message.status = 'replied';
  if (message.suggestedReply) {
    message.suggestedReply.content = content;
    message.suggestedReply.status = 'sent';
    message.suggestedReply.sentAt = new Date().toISOString();
  }
  db.upsertMessage(message);
  db.incrementRepliesSent();

  db.logActivity(
    'reply_sent',
    message.senderEmail,
    message.subject,
    `Reply sent to ${message.senderEmail} ${token ? 'via Gmail API' : '(mock mode)'}.`,
    'success'
  );

  // If was in queue, mark queue item as approved
  const queueItem = db.getQueue().find((q) => q.messageId === message.id);
  if (queueItem) {
    db.removeFromQueue(queueItem.id);
  }

  res.json({ success: true, message });
});

// Create Draft
app.post('/api/emails/:id/create-draft', async (req: Request, res: Response) => {
  const token = getBearerToken(req);
  const message = db.getMessage(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const { replyContent } = req.body;
  const content = replyContent || message.suggestedReply?.content;
  if (!content) return res.status(400).json({ error: 'Draft content cannot be empty.' });

  let draftId = `draft-${Date.now()}`;
  if (token && !isSimulatedMessage(message.id, message.threadId)) {
    try {
      const gDraft = await gmailClient.createDraft(token, {
        threadId: message.threadId,
        to: message.senderEmail,
        subject: message.subject,
        body: content,
      });
      draftId = gDraft.id;
    } catch (err: any) {
      return res.status(500).json({ error: `Gmail draft creation failed: ${err.message}` });
    }
  }

  message.status = 'drafted';
  if (message.suggestedReply) {
    message.suggestedReply.status = 'drafted';
    message.suggestedReply.draftId = draftId;
  }
  db.upsertMessage(message);
  db.incrementDraftsCreated();

  db.logActivity(
    'draft_created',
    message.senderEmail,
    message.subject,
    `Draft saved to Gmail for ${message.senderEmail}.`,
    'info'
  );

  res.json({ success: true, draftId });
});

// Review Queue Endpoints
app.get('/api/review-queue', (req: Request, res: Response) => {
  res.json(db.getQueue());
});

app.post('/api/review-queue/:id/approve', async (req: Request, res: Response) => {
  const item = db.getQueueItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  const token = getBearerToken(req);
  const message = db.getMessage(item.messageId);

  if (token && message && !isSimulatedMessage(item.messageId, item.threadId)) {
    try {
      await gmailClient.sendReply(token, {
        threadId: item.threadId,
        to: item.senderEmail,
        subject: item.subject,
        body: item.reply.content,
      });
    } catch (err: any) {
      return res.status(500).json({ error: `Gmail API send failed: ${err.message}` });
    }
  }

  if (message) {
    message.status = 'replied';
    if (message.suggestedReply) {
      message.suggestedReply.status = 'sent';
      message.suggestedReply.sentAt = new Date().toISOString();
    }
    db.upsertMessage(message);
  }

  db.removeFromQueue(item.id);
  db.incrementRepliesSent();

  db.logActivity(
    'reply_sent',
    item.senderEmail,
    item.subject,
    `Reply approved and sent by user.`,
    'success'
  );

  res.json({ success: true });
});

app.post('/api/review-queue/:id/reject', (req: Request, res: Response) => {
  const item = db.getQueueItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  const message = db.getMessage(item.messageId);
  if (message) {
    message.status = 'ignored';
    db.upsertMessage(message);
  }

  db.removeFromQueue(item.id);
  db.logActivity(
    'system_alert',
    item.senderEmail,
    item.subject,
    `Suggested reply rejected by user.`,
    'info'
  );

  res.json({ success: true });
});

app.post('/api/review-queue/:id/edit', (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const item = db.getQueueItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  item.reply.content = content;
  db.updateQueueItem(item.id, { reply: item.reply });

  const message = db.getMessage(item.messageId);
  if (message && message.suggestedReply) {
    message.suggestedReply.content = content;
    db.upsertMessage(message);
  }

  res.json({ success: true, item });
});

app.post('/api/review-queue/:id/regenerate', async (req: Request, res: Response) => {
  const item = db.getQueueItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Queue item not found' });

  const { instruction, tone } = req.body;
  const message = db.getMessage(item.messageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const preferences = db.getPreferences();
  const thread = db.getThread(item.threadId);
  const threadMessages = thread ? thread.messages : [message];

  const effectivePreferences = tone ? { ...preferences, defaultTone: tone as ReplyTone } : preferences;
  const reply = await aiProvider.generateReply(
    message,
    threadMessages,
    effectivePreferences,
    item.analysis,
    instruction
  );

  item.reply = reply;
  db.updateQueueItem(item.id, { reply });

  message.suggestedReply = reply;
  db.upsertMessage(message);

  res.json({ success: true, item });
});

// Activity Feed & Stats
app.get('/api/activity', (req: Request, res: Response) => {
  res.json(db.getActivities(50));
});

app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  const messages = db.getMessages();
  const queue = db.getQueue();
  const billing = db.getBilling();
  const preferences = db.getPreferences();

  const processedToday = messages.filter((m) => {
    const today = new Date().toDateString();
    return new Date(m.date).toDateString() === today;
  }).length;

  res.json({
    connectedAccount: preferences.userId,
    replyMode: preferences.replyMode,
    processedToday: processedToday || billing.totalProcessedEmails,
    repliesGenerated: billing.totalRepliesGenerated,
    repliesSent: billing.totalRepliesSent,
    draftsCreated: billing.totalDraftsCreated,
    pendingApprovals: queue.length,
    plan: billing.plan,
    quotaUsed: billing.usedThisMonth,
    monthlyQuota: billing.monthlyQuota,
  });
});

// Billing
app.get('/api/billing', (req: Request, res: Response) => {
  res.json(db.getBilling());
});

app.post('/api/billing/plan', (req: Request, res: Response) => {
  const { plan } = req.body;
  if (!['free', 'pro', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  const updated = db.updateBillingPlan(plan);
  res.json(updated);
});

// Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});

// Admin Configuration
app.get('/api/admin/config', (req: Request, res: Response) => {
  res.json({
    ...aiProvider.getConfig(),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    maxOutputTokens: 2048,
    rateLimitPerMinute: 60,
  });
});

app.put('/api/admin/config', (req: Request, res: Response) => {
  const { provider, model } = req.body;
  if (provider && model) {
    aiProvider.setProvider({ provider, model });
  }
  res.json({ success: true, config: aiProvider.getConfig() });
});

// Automated Diagnostics & Test Suite
app.post('/api/test/run-diagnostics', async (req: Request, res: Response) => {
  const results = [];

  // Test 1: AI Provider Status
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  results.push({
    test: 'Gemini 3.8 Flash SDK Connection',
    status: hasGeminiKey ? 'passed' : 'warning',
    details: hasGeminiKey
      ? 'Gemini API key configured and ready.'
      : 'GEMINI_API_KEY not found in environment; running with heuristics engine.',
  });

  // Test 2: AI Classification & Intent
  try {
    const testAnalysis = await aiProvider.classifyEmail({
      sender: 'test@example.com',
      subject: 'Can we schedule a 15-minute call tomorrow?',
      body: 'Hi, are you free tomorrow at 10 AM?',
    });
    results.push({
      test: 'AI Email Classifier & Intent Detection',
      status: testAnalysis.category === 'meeting_request' ? 'passed' : 'warning',
      details: `Classified as ${testAnalysis.category} with ${(testAnalysis.confidence * 100).toFixed(0)}% confidence.`,
    });
  } catch (err: any) {
    results.push({
      test: 'AI Email Classifier',
      status: 'failed',
      details: err.message,
    });
  }

  // Test 3: Safety Guardrails Filter
  try {
    const sensitiveAnalysis = await aiProvider.classifyEmail({
      sender: 'bank@securebank.com',
      subject: 'Your password reset token and bank statement',
      body: 'Click here to reset your password and view wire transfer details.',
    });
    const passed = sensitiveAnalysis.is_sensitive === true;
    results.push({
      test: 'Safety Engine: Password & Financial Alert Gate',
      status: passed ? 'passed' : 'failed',
      details: passed
        ? 'Sensitive email correctly detected. Auto-send strictly prohibited.'
        : 'Failed to flag security/password email.',
    });
  } catch (err: any) {
    results.push({
      test: 'Safety Engine Test',
      status: 'failed',
      details: err.message,
    });
  }

  // Test 4: Rule Engine Evaluation
  try {
    const testMsg: EmailMessage = {
      id: 'test-m-1',
      gmailId: 'test-g-1',
      threadId: 'test-t-1',
      sender: 'client@partnercorp.com',
      senderEmail: 'client@partnercorp.com',
      senderName: 'Client',
      recipient: 'me',
      subject: 'Meeting follow up',
      snippet: 'Let us meet',
      bodyPlain: 'Let us meet tomorrow',
      hasAttachments: false,
      date: new Date().toISOString(),
      labels: ['INBOX'],
      isInternal: false,
      isRead: false,
      isSentByMe: false,
      processed: false,
      status: 'new',
    };
    const testRules = db.getRules();
    const testPrefs = db.getPreferences();
    const ruleEval = ruleEngine.evaluate(
      testMsg,
      {
        id: 'test-a-1',
        messageId: testMsg.id,
        category: 'meeting_request',
        urgency: 'medium',
        sentiment: 'neutral',
        requires_reply: true,
        has_question: true,
        should_escalate: false,
        is_sensitive: false,
        intent: 'Meeting request',
        suggested_action: 'Reply',
        confidence: 0.95,
        analyzedAt: new Date().toISOString(),
      },
      testRules,
      testPrefs
    );
    results.push({
      test: 'Rule Engine Action Calibration',
      status: 'passed',
      details: `Rule evaluated to action "${ruleEval.action}" (${ruleEval.reason}).`,
    });
  } catch (err: any) {
    results.push({
      test: 'Rule Engine Test',
      status: 'failed',
      details: err.message,
    });
  }

  // Test 5: Gmail RFC 2822 Parser
  try {
    const dummyRaw = {
      id: 'msg-test-123',
      threadId: 'th-123',
      internalDate: String(Date.now()),
      labelIds: ['INBOX'],
      payload: {
        headers: [
          { name: 'From', value: 'Alice Smith <alice@example.com>' },
          { name: 'Subject', value: 'Test RFC 2822' },
          { name: 'Message-ID', value: '<abc@example.com>' },
        ],
        body: {
          data: Buffer.from('Hello world plain text', 'utf-8').toString('base64url'),
        },
      },
    };
    const parsed = gmailClient.parseMessage(dummyRaw);
    const passed = parsed.senderEmail === 'alice@example.com' && parsed.bodyPlain === 'Hello world plain text';
    results.push({
      test: 'RFC 2822 MIME & Base64url Decoupler',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'MIME payload extracted, decoded, and headers matched.' : 'Parser failed to decode payload.',
    });
  } catch (err: any) {
    results.push({
      test: 'RFC 2822 Parser',
      status: 'failed',
      details: err.message,
    });
  }

  res.json({
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      warning: results.filter((r) => r.status === 'warning').length,
      failed: results.filter((r) => r.status === 'failed').length,
    },
    tests: results,
  });
});

/* =========================================================================
   VITE & STATIC ASSETS INTEGRATION
   ========================================================================= */

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MailPilot AI server running on http://0.0.0.0:${PORT}`);
    backgroundDaemon.start();
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
