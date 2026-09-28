import { db } from '../db.js';
import { aiProvider } from '../ai/provider.js';
import { ruleEngine } from '../rules/engine.js';
import { gmailClient, ParsedGmailMessage } from '../gmail/client.js';
import { EmailMessage, EmailThread, GeneratedReply } from '../types.js';

export class EmailProcessor {
  private inFlightMessageIds = new Set<string>();
  private inFlightThreadIds = new Set<string>();
  private recentReplyDispatchedTimestamps = new Map<string, number>();

  public isLocked(messageId: string, threadId?: string): boolean {
    return this.inFlightMessageIds.has(messageId) || Boolean(threadId && this.inFlightThreadIds.has(threadId));
  }

  public lock(messageId: string, threadId?: string): void {
    if (messageId) this.inFlightMessageIds.add(messageId);
    if (threadId) this.inFlightThreadIds.add(threadId);
  }

  public unlock(messageId: string, threadId?: string): void {
    if (messageId) this.inFlightMessageIds.delete(messageId);
    if (threadId) this.inFlightThreadIds.delete(threadId);
  }

  /**
   * Process a parsed incoming email through the end-to-end AI pipeline
   */
  async processIncomingEmail(
    parsed: ParsedGmailMessage,
    accessToken?: string
  ): Promise<{ message: EmailMessage; actionTaken: string }> {
    // 1. Persistent deduplication check against duplicate sends
    if (db.isMessageReplied(parsed.id)) {
      const existing = db.getMessage(parsed.id);
      if (existing) {
        return { message: existing, actionTaken: 'already_replied' };
      }
    }

    const existing = db.getMessage(parsed.id);
    if (existing && (existing.processed || existing.status === 'replied')) {
      return { message: existing, actionTaken: 'already_processed' };
    }

    // 2. Skip messages sent by the user themselves
    const userEmail = db.getUserEmail();
    if (
      (userEmail && parsed.senderEmail.toLowerCase() === userEmail.toLowerCase()) ||
      (parsed.labels && parsed.labels.includes('SENT'))
    ) {
      const sentMsg: EmailMessage = {
        id: parsed.id,
        gmailId: parsed.id,
        threadId: parsed.threadId,
        sender: parsed.sender,
        senderEmail: parsed.senderEmail,
        senderName: parsed.senderName,
        recipient: parsed.recipient,
        subject: parsed.subject,
        snippet: parsed.snippet,
        bodyPlain: parsed.bodyPlain,
        hasAttachments: parsed.hasAttachments,
        date: parsed.date,
        labels: parsed.labels || ['SENT'],
        isInternal: false,
        isRead: true,
        isSentByMe: true,
        processed: true,
        status: 'replied',
      };
      db.upsertMessage(sentMsg);
      return { message: sentMsg, actionTaken: 'sent_by_me' };
    }

    // Acquire locks
    this.inFlightMessageIds.add(parsed.id);
    if (parsed.threadId) this.inFlightThreadIds.add(parsed.threadId);

    const isSimulated =
      parsed.id.startsWith('sim-') ||
      parsed.id.startsWith('msg-seed') ||
      parsed.threadId.startsWith('sim-') ||
      parsed.threadId.startsWith('thread-');

    // IMMEDIATELY construct initial EmailMessage record and save to DB
    // This ensures the email is INSTANTLY visible in the Inbox!
    const messageRecord: EmailMessage = {
      id: parsed.id,
      gmailId: parsed.id,
      threadId: parsed.threadId,
      sender: parsed.sender,
      senderEmail: parsed.senderEmail,
      senderName: parsed.senderName,
      recipient: parsed.recipient,
      subject: parsed.subject,
      snippet: parsed.snippet,
      bodyPlain: parsed.bodyPlain,
      bodyHtml: parsed.bodyHtml,
      hasAttachments: parsed.hasAttachments,
      attachmentNames: parsed.attachmentNames,
      date: parsed.date,
      labels: parsed.labels || ['INBOX'],
      isInternal: false,
      isRead: !(parsed.labels && parsed.labels.includes('UNREAD')),
      isSentByMe: false,
      processed: true,
      status: 'processing',
    };

    db.upsertMessage(messageRecord);
    db.logActivity(
      'email_received',
      parsed.senderEmail,
      parsed.subject,
      `New incoming email received: "${parsed.subject}"`,
      'info'
    );

    try {
      // Fetch or build thread context
      let thread = db.getThread(parsed.threadId);
      let threadMessages: EmailMessage[] = thread ? [...thread.messages] : [];
      if (!threadMessages.some((m) => m.id === messageRecord.id)) {
        threadMessages.push(messageRecord);
      }

      // If access token available, not simulated, and thread body missing, attempt thread fetch
      if (accessToken && !isSimulated && threadMessages.length <= 1 && (!messageRecord.bodyPlain || messageRecord.bodyPlain.length < 50)) {
        try {
          const fullThread: any = await Promise.race([
            gmailClient.getThread(accessToken, parsed.threadId),
            new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
          if (fullThread && fullThread.messages && Array.isArray(fullThread.messages)) {
            threadMessages = fullThread.messages.map((m: any) => {
              const p = gmailClient.parseMessage(m);
              return {
                id: p.id,
                gmailId: p.id,
                threadId: p.threadId,
                sender: p.sender,
                senderEmail: p.senderEmail,
                senderName: p.senderName,
                recipient: p.recipient,
                subject: p.subject,
                snippet: p.snippet,
                bodyPlain: p.bodyPlain,
                bodyHtml: p.bodyHtml,
                hasAttachments: p.hasAttachments,
                attachmentNames: p.attachmentNames,
                date: p.date,
                labels: p.labels,
                isInternal: false,
                isRead: true,
                isSentByMe: p.labels.includes('SENT'),
                processed: true,
                status: 'replied',
              } as EmailMessage;
            });
          }
        } catch (err: any) {
          console.debug('Fast path: using single message context for fast response:', err.message);
        }
      }

      // Assemble thread text for AI context
      const threadContextStr = threadMessages
        .filter((m) => m.id !== parsed.id)
        .map(
          (m, idx) =>
            `[Message ${idx + 1} - From: ${m.sender} (${m.date})]:\n${m.bodyPlain || m.snippet}`
        )
        .join('\n\n---\n\n');

      // Unified High-Speed AI Pipeline: Analysis + Personalized Reply in a single sub-second pass
      const preferences = db.getPreferences();
      const rules = db.getRules();

      const { analysis, reply } = await aiProvider.classifyAndDraft(
        messageRecord,
        threadMessages,
        preferences
      );
      messageRecord.analysis = analysis;
      messageRecord.suggestedReply = reply;
      messageRecord.status = 'analyzed';
      db.incrementRepliesGenerated();

      db.logActivity(
        'ai_analyzed',
        parsed.senderEmail,
        parsed.subject,
        `Classified as ${analysis.category.toUpperCase()} (${(analysis.confidence * 100).toFixed(0)}% conf). Urgency: ${analysis.urgency}. ${analysis.is_sensitive ? 'SENSITIVE' : ''}`,
        analysis.is_sensitive ? 'warning' : 'success'
      );

      // Stage 2: Rule Engine Evaluation
      const ruleResult = ruleEngine.evaluate(messageRecord, analysis, rules, preferences);

      // If ignore, record and return
      if (ruleResult.action === 'ignore') {
        messageRecord.status = 'ignored';
        messageRecord.processed = true;
        db.upsertMessage(messageRecord);
        db.logActivity(
          'rule_triggered',
          parsed.senderEmail,
          parsed.subject,
          `Ignored: ${ruleResult.reason}`,
          'info'
        );
        return { message: messageRecord, actionTaken: 'ignored' };
      }

      // Apply tone override if rule matched
      if (ruleResult.matchedRule?.overrideTone) {
        reply.tone = ruleResult.matchedRule.overrideTone;
      }

      db.logActivity(
        'reply_generated',
        parsed.senderEmail,
        parsed.subject,
        `Generated reply. Safety score: ${(reply.safetyScore * 100).toFixed(0)}%. ${reply.safetyPassed ? 'Passed' : 'Review needed'}.`,
        reply.safetyPassed ? 'success' : 'warning'
      );

      // Stage 3: Execute Calibrated Action
      const isAutoMode = preferences.replyMode === 'automatic';
      const isThreadCoolingDown = db.isThreadRepliedRecently(parsed.threadId, 60000);
      const isAlreadyReplied = db.isMessageReplied(parsed.id);

      const shouldAutoSend =
        !isAlreadyReplied &&
        !isThreadCoolingDown &&
        (ruleResult.action === 'auto_send' ||
          (isAutoMode && analysis.requires_reply && !analysis.is_sensitive));

      if (shouldAutoSend) {
        // Record immediately in database and in-memory set to prevent any parallel send
        db.recordReplyDispatched(parsed.id, parsed.threadId);
        this.recentReplyDispatchedTimestamps.set(parsed.threadId, Date.now());

        if (accessToken && !isSimulated) {
          try {
            await gmailClient.sendReply(accessToken, {
              threadId: parsed.threadId,
              to: parsed.senderEmail,
              subject: parsed.subject,
              body: reply.content,
              inReplyTo: parsed.messageIdHeader,
              references: parsed.referencesHeader || parsed.messageIdHeader,
            });
            reply.status = 'sent';
            reply.sentAt = new Date().toISOString();
            messageRecord.status = 'replied';
            messageRecord.processed = true;
            db.incrementRepliesSent();
            db.upsertMessage(messageRecord);

            // Mark message read in Gmail so it's not resurfaced as unread
            gmailClient.modifyLabels(accessToken, parsed.id, ['UNREAD']).catch(() => {});

            db.logActivity(
              'reply_sent',
              parsed.senderEmail,
              parsed.subject,
              `Automated reply sent autonomously via Gmail API (no permission required).`,
              'success'
            );
          } catch (err: any) {
            console.error('Failed to auto-send reply via Gmail API:', err);
            reply.status = 'drafted';
            messageRecord.status = 'drafted';
            db.incrementDraftsCreated();
            db.upsertMessage(messageRecord);
          }
        } else {
          // Automatically reply in preview / demo mode
          reply.status = 'sent';
          reply.sentAt = new Date().toISOString();
          messageRecord.status = 'replied';
          messageRecord.processed = true;
          db.incrementRepliesSent();
          db.upsertMessage(messageRecord);
          db.logActivity(
            'reply_sent',
            parsed.senderEmail,
            parsed.subject,
            `Automated reply generated and auto-dispatched without asking permission.`,
            'success'
          );
        }
      } else if (ruleResult.action === 'draft_only') {
        if (accessToken && !isSimulated) {
          try {
            const draftRes = await gmailClient.createDraft(accessToken, {
              threadId: parsed.threadId,
              to: parsed.senderEmail,
              subject: parsed.subject,
              body: reply.content,
              inReplyTo: parsed.messageIdHeader,
              references: parsed.referencesHeader || parsed.messageIdHeader,
            });
            reply.status = 'drafted';
            reply.draftId = draftRes.id;
            messageRecord.status = 'drafted';
            db.incrementDraftsCreated();
            db.logActivity(
              'draft_created',
              parsed.senderEmail,
              parsed.subject,
              `Draft created in Gmail (${ruleResult.reason}).`,
              'info'
            );
          } catch (err) {
            console.error('Failed to create draft in Gmail:', err);
            if (preferences.replyMode === 'approval') {
              this.queueForApproval(messageRecord, reply, 'Draft creation fallback to review queue');
            }
          }
        } else {
          reply.status = 'drafted';
          messageRecord.status = 'drafted';
          db.incrementDraftsCreated();
        }
      } else {
        // Place in approval queue if approval mode or review is required
        if (preferences.replyMode === 'approval' || (analysis.requires_reply && !analysis.is_sensitive)) {
          this.queueForApproval(
            messageRecord,
            reply,
            ruleResult.reason || (isThreadCoolingDown ? 'Thread reply cooldown active - queued for review' : 'Pending review')
          );
        } else {
          messageRecord.status = analysis.requires_reply ? 'in_review' : 'analyzed';
        }
      }

      messageRecord.processed = true;
      db.upsertMessage(messageRecord);

      // Update thread object
      const existingIndex = threadMessages.findIndex((m) => m.id === messageRecord.id);
      if (existingIndex >= 0) {
        threadMessages[existingIndex] = messageRecord;
      } else {
        threadMessages.push(messageRecord);
      }

      const updatedThread: EmailThread = {
        id: parsed.threadId,
        gmailThreadId: parsed.threadId,
        subject: parsed.subject,
        messageCount: threadMessages.length,
        messages: threadMessages,
        lastMessageDate: parsed.date,
        snippet: parsed.snippet,
      };
      db.upsertThread(updatedThread);

      return { message: messageRecord, actionTaken: ruleResult.action };
    } finally {
      this.inFlightMessageIds.delete(parsed.id);
      this.inFlightThreadIds.delete(parsed.threadId);
    }
  }

  private queueForApproval(
    message: EmailMessage,
    reply: GeneratedReply,
    reason: string
  ) {
    message.status = 'in_review';
    db.addToQueue({
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      messageId: message.id,
      threadId: message.threadId,
      sender: message.sender,
      senderEmail: message.senderEmail,
      subject: message.subject,
      receivedAt: message.date,
      snippet: message.snippet,
      analysis: message.analysis!,
      reply,
      status: 'pending',
      queuedReason: reason,
      createdAt: new Date().toISOString(),
    });

    db.logActivity(
      'approval_queued',
      message.senderEmail,
      message.subject,
      `Queued for human review: ${reason}`,
      'warning'
    );
  }
}

export const emailProcessor = new EmailProcessor();
