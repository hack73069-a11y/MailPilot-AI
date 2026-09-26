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
  private pollIntervalSeconds = 45;
  private isPolling = false;
  private lastError: string | null = null;

  public start() {
    if (this.intervalTimer) return;
    this.startedAt = new Date();
    console.log(`[Daemon] 🚀 MailPilot 24/7 background worker daemon started (interval: ${this.pollIntervalSeconds}s)`);

    // Initial check after 5 seconds
    setTimeout(() => {
      this.pollCycle().catch((err) => console.warn('[Daemon] Initial cycle notice:', err.message));
    }, 5000);

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

  public async pollCycle(): Promise<{ processedCount: number; repliesDispatched: number }> {
    if (this.isPolling) {
      return { processedCount: 0, repliesDispatched: 0 };
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
      // Poll latest inbox emails excluding user's own sent emails
      const listRes = await gmailClient.listMessages(token, 'in:inbox -label:SENT', 8);
      const messages = listRes.messages || [];

      for (const item of messages) {
        // Skip if already processed in local DB
        const existing = db.getMessage(item.id);
        if (existing && existing.processed) continue;

        try {
          const rawMsg = await gmailClient.getMessage(token, item.id);
          const parsed = gmailClient.parseMessage(rawMsg);
          const result = await emailProcessor.processIncomingEmail(parsed, token);
          processedCount++;

          if (result.actionTaken === 'auto_send' || result.actionTaken === 'sent') {
            repliesDispatched++;
          }
        } catch (msgErr: any) {
          console.warn(`[Daemon] Error processing message ${item.id}:`, msgErr.message);
        }
      }

      db.recordWorkerCycle(repliesDispatched);
    } catch (err: any) {
      this.lastError = err.message || 'Error communicating with Gmail API';
      if (err.message && err.message.includes('401')) {
        console.warn('[Daemon] Gmail token returned 401 Unauthorized. Token may require re-auth.');
      } else {
        console.warn('[Daemon] Cycle warning:', err.message);
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
