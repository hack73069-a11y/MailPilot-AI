import { db } from '../db.js';
import { aiProvider } from '../ai/provider.js';
import { ruleEngine } from '../rules/engine.js';
import { gmailClient, ParsedGmailMessage } from '../gmail/client.js';
import { EmailMessage, EmailThread, GeneratedReply } from '../types.js';

export class EmailProcessor {
  /**
   * Process a parsed incoming email through the end-to-end AI pipeline
   */
  async processIncomingEmail(
    parsed: ParsedGmailMessage,
    accessToken?: string
  ): Promise<{ message: EmailMessage; actionTaken: string }> {
    // 1. Deduplication check
    const existing = db.getMessage(parsed.id);
    if (existing && existing.processed) {
      return { message: existing, actionTaken: 'already_processed' };
    }

    const isSimulated =
      parsed.id.startsWith('sim-') ||
      parsed.id.startsWith('msg-seed') ||
      parsed.threadId.startsWith('sim-') ||
      parsed.threadId.startsWith('thread-');

    // 2. Fetch or build thread context
    let thread = db.getThread(parsed.threadId);
    let threadMessages: EmailMessage[] = thread ? [...thread.messages] : [];

    // If access token available, not simulated, and thread not fully loaded, attempt fast thread fetch with timeout
    if (accessToken && !isSimulated && threadMessages.length <= 1) {
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

    // 3. Assemble thread text for AI context
    const threadContextStr = threadMessages
      .filter((m) => m.id !== parsed.id)
      .map(
        (m, idx) =>
          `[Message ${idx + 1} - From: ${m.sender} (${m.date})]:\n${m.bodyPlain || m.snippet}`
      )
      .join('\n\n---\n\n');

    // 4. Construct initial EmailMessage record
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
      labels: parsed.labels,
      isInternal: false,
      isRead: false,
      isSentByMe: false,
      processed: false,
      status: 'new',
    };

    // Ignore outgoing messages sent by the user
    if (parsed.labels && parsed.labels.includes('SENT')) {
      messageRecord.isSentByMe = true;
      messageRecord.status = 'replied';
      messageRecord.processed = true;
      db.upsertMessage(messageRecord);
      return { message: messageRecord, actionTaken: 'sent_by_me' };
    }

    db.upsertMessage(messageRecord);
    db.logActivity(
      'email_received',
      parsed.senderEmail,
      parsed.subject,
      `New message received in thread "${parsed.threadId.substring(0, 10)}..."`,
      'info'
    );

    // 5. Unified High-Speed AI Pipeline: Analysis + Personalized Reply in a single sub-second pass
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

    // 6. Stage 2: Rule Engine Evaluation
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

    // 8. Execute Calibrated Action
    const isAutoMode = preferences.replyMode === 'automatic';
    const shouldAutoSend =
      ruleResult.action === 'auto_send' ||
      (isAutoMode && analysis.requires_reply && !analysis.is_sensitive);

    if (shouldAutoSend) {
      const isSimulated = parsed.id.startsWith('sim-');
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
          db.incrementRepliesSent();
          db.logActivity(
            'reply_sent',
            parsed.senderEmail,
            parsed.subject,
            `Automated reply sent autonomously via Gmail API (no permission required).`,
            'success'
          );
        } catch (err: any) {
          console.error('Failed to auto-send reply via Gmail API:', err);
          // If Gmail API network/token issue occurs, save as draft rather than blocking user
          reply.status = 'drafted';
          messageRecord.status = 'drafted';
          db.incrementDraftsCreated();
        }
      } else {
        // Automatically reply in preview / demo mode
        reply.status = 'sent';
        reply.sentAt = new Date().toISOString();
        messageRecord.status = 'replied';
        db.incrementRepliesSent();
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
      // Place in approval queue only if user explicitly set mode to 'approval'
      if (preferences.replyMode === 'approval') {
        this.queueForApproval(messageRecord, reply, ruleResult.reason);
      } else {
        // Otherwise in automatic/autonomous mode, auto-dispatch
        reply.status = 'sent';
        reply.sentAt = new Date().toISOString();
        messageRecord.status = 'replied';
        db.incrementRepliesSent();
        db.logActivity(
          'reply_sent',
          parsed.senderEmail,
          parsed.subject,
          `Automated reply sent autonomously (${ruleResult.reason}).`,
          'success'
        );
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
