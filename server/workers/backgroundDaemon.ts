import { db } from '../db.js';
import { gmailClient } from '../gmail/client.js';
import { emailProcessor } from './emailProcessor.js';

export interface DaemonStatus {
  running: boolean;
  startedAt: string;
  uptimeSeconds: number;
  lastPollAt: string | null;
  pollIntervalSeconds: number;
  isPolling: boolean;
  totalCycles: number;
  totalRepliesDispatched: number;
  hasToken: boolean;
  tokenSource: 'database' | 'env' | 'none';
  userEmail?: string;
  lastError: string | null;
  mode: string;
}

class BackgroundDaemon {
  private intervalTimer: NodeJS.Timeout | null = null;
  private startedAt: Date = new Date();
  private pollIntervalSeconds = 8;
  private isPolling = false;
  private lastError: string | null = null;
  private quotaCooldownUntil = 0;
  private failedMessageCooldowns = new Map<string, number>();

  public start() {
    if (this.intervalTimer) return;
    this.startedAt = new Date();
    console.log(`[Daemon] 🚀 MailPilot 24/7 background worker daemon started (rate-safe interval: ${this.pollIntervalSeconds}s)`);

    // Initial check after 500ms
    setTimeout(() => {
      this.pollCycle().catch((err) => console.warn('[Daemon] Initial cycle notice:', err.message));
    }, 500);

    // Continuous interval
    this.intervalTimer = setInterval(() => {
      this.pollCycle().catch((err) => console.warn('[Daemon] Polling cycle notice:', err.message));
    }, this.pollIntervalSeconds * 1000);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[Daemon] 🛑 Background worker daemon paused.');
    }
  }

  public getActiveToken(): { token: string | null; source: 'database' | 'env' | 'none' } {
    const envToken = process.env.GMAIL_ACCESS_TOKEN || process.env.GOOGLE_ACCESS_TOKEN;
    if (envToken) return { token: envToken, source: 'env' };

    const dbToken = db.getSavedToken();
    if (dbToken) return { token: dbToken, source: 'database' };

    return { token: null, source: 'none' };
  }

  public async pollCycle(force = false): Promise<{ processedCount: number; repliesDispatched: number }> {
    // If in quota cooldown, honor backoff period unless user explicitly clicked manual sync
    if (Date.now() < this.quotaCooldownUntil && !force) {
      return { processedCount: 0, repliesDispatched: 0 };
    }

    if (this.isPolling) {
      if (!force) {
        return { processedCount: 0, repliesDispatched: 0 };
      }
      // If forced (e.g. user clicked Sync Gmail), wait briefly for current cycle to conclude
      let waited = 0;
      while (this.isPolling && waited < 15) {
        await new Promise((r) => setTimeout(r, 100));
        waited++;
      }
      if (this.isPolling) {
        return { processedCount: 0, repliesDispatched: 0 };
      }
    }

    const { token, source } = this.getActiveToken();
    if (!token) {
      return { processedCount: 0, repliesDispatched: 0 };
    }

    this.isPolling = true;
    this.lastError = null;
    let processedCount = 0;
    let repliesDispatched = 0;

    try {
      // Fetch newest messages from inbox (1 single efficient list query = 5 quota units)
      const listRes = await gmailClient.listMessages(token, 'in:inbox', 15);
      const messages = listRes.messages || [];

      // Filter messages that need processing
      const now = Date.now();
      const unhandled = messages.filter((item) => {
        if (!item?.id) return false;
        if (emailProcessor.isLocked(item.id)) return false;

        const failedUntil = this.failedMessageCooldowns.get(item.id);
        if (failedUntil && now < failedUntil) return false;

        const existing = db.getMessage(item.id);
        if (
          existing &&
          existing.processed &&
          (existing.status === 'replied' ||
            existing.status === 'ignored' ||
            existing.status === 'in_review' ||
            existing.status === 'analyzed')
        ) {
          return false;
        }
        return true;
      });

      // Process at most 4 new messages per cycle with 100ms throttle between them
      // This strictly prevents spiking per-second / per-minute quota limits
      const batch = unhandled.slice(0, 4);

      for (const item of batch) {
        emailProcessor.lock(item.id);

        try {
          // Add brief 100ms throttle between API calls
          await new Promise((r) => setTimeout(r, 100));

          const rawMsg = await gmailClient.getMessage(token, item.id);
          const parsed = gmailClient.parseMessage(rawMsg);

          const result = await emailProcessor.processIncomingEmail(parsed, token);
          processedCount++;

          if (result.actionTaken === 'auto_send' || result.actionTaken === 'sent') {
            repliesDispatched++;
          }
        } catch (msgErr: any) {
          const isQuota =
            msgErr.isQuotaError ||
            (msgErr.message &&
              (msgErr.message.includes('quota') ||
                msgErr.message.includes('Quota') ||
                msgErr.message.includes('Forbidden') ||
                msgErr.status === 403));

          if (isQuota) {
            // Apply 45-second cooldown to let Google's rate-limiting bucket recover
            this.quotaCooldownUntil = Date.now() + 45000;
            this.failedMessageCooldowns.set(item.id, Date.now() + 60000);
            console.warn(`[Daemon] Gmail API quota metric hit for message ${item.id}. Entering 45s cooldown.`);
            break; // Stop further requests this cycle to protect quota
          } else {
            this.failedMessageCooldowns.set(item.id, Date.now() + 30000);
            console.warn(`[Daemon] Notice processing message ${item.id}:`, msgErr.message);
          }
        } finally {
          emailProcessor.unlock(item.id);
        }
      }

      db.recordWorkerCycle(repliesDispatched);
    } catch (err: any) {
      const isQuota =
        err.isQuotaError ||
        (err.message &&
          (err.message.includes('quota') ||
            err.message.includes('Quota') ||
            err.message.includes('Forbidden') ||
            err.status === 403));

      if (isQuota) {
        this.quotaCooldownUntil = Date.now() + 45000;
        this.lastError = 'Gmail API rate limit reached. Pausing for 45 seconds to reset.';
        console.warn('[Daemon] Gmail quota exceeded notice. Backing off for 45s.');
      } else {
        const isAuthErr =
          err.isAuthError ||
          (err.message &&
            (err.message.includes('authError') || err.message.includes('401') || err.message.includes('expired')));
        if (isAuthErr) {
          db.clearSavedToken();
          this.lastError = null;
          console.log('[Daemon] Gmail session token inactive or expired. Daemon standing by for reconnection.');
        } else {
          this.lastError = err.message || 'Error communicating with Gmail API';
          console.warn('[Daemon] Polling cycle notice:', err.message);
        }
      }
    } finally {
      this.isPolling = false;
    }

    return { processedCount, repliesDispatched };
  }

  public getStatus(): DaemonStatus {
    const { token, source } = this.getActiveToken();
    const stats = db.getWorkerStats();
    const preferences = db.getPreferences();

    return {
      running: this.intervalTimer !== null,
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      lastPollAt: stats.lastPollAt || null,
      pollIntervalSeconds: this.pollIntervalSeconds,
      isPolling: this.isPolling,
      totalCycles: stats.totalCycles,
      totalRepliesDispatched: stats.totalAutoRepliesDispatched,
      hasToken: Boolean(token),
      tokenSource: source,
      userEmail: db.getUserEmail(),
      lastError: this.lastError,
      mode: preferences.replyMode,
    };
  }
}

export const backgroundDaemon = new BackgroundDaemon();
