import { getAccessToken } from './auth.js';
import {
  EmailMessage,
  UserPreferences,
  ReplyRule,
  ApprovalQueueItem,
  ActivityLog,
  BillingUsage,
  AIAnalysis,
  GeneratedReply,
} from '../../server/types.js';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export const api = {
  // Health
  async getHealth() {
    const res = await fetch('/api/health');
    return res.json();
  },

  // User Profile
  async getProfile() {
    const res = await fetchWithAuth('/api/user/profile');
    return res.json();
  },

  async deleteUserData() {
    const res = await fetchWithAuth('/api/user/delete-data', { method: 'POST' });
    return res.json();
  },

  // Settings
  async getSettings(): Promise<UserPreferences> {
    const res = await fetchWithAuth('/api/settings');
    return res.json();
  },

  async updateSettings(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await fetchWithAuth('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
    return res.json();
  },

  // Rules
  async getRules(): Promise<ReplyRule[]> {
    const res = await fetchWithAuth('/api/rules');
    return res.json();
  },

  async createRule(rule: Omit<ReplyRule, 'id' | 'createdAt'>): Promise<ReplyRule> {
    const res = await fetchWithAuth('/api/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
    return res.json();
  },

  async updateRule(id: string, patch: Partial<ReplyRule>): Promise<ReplyRule> {
    const res = await fetchWithAuth(`/api/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return res.json();
  },

  async deleteRule(id: string): Promise<boolean> {
    const res = await fetchWithAuth(`/api/rules/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // Emails
  async getEmails(params: {
    category?: string;
    urgency?: string;
    status?: string;
    search?: string;
  } = {}): Promise<EmailMessage[]> {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.urgency) query.set('urgency', params.urgency);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    const res = await fetchWithAuth(`/api/emails?${query.toString()}`);
    return res.json();
  },

  async getEmailById(id: string): Promise<{ message: EmailMessage; thread?: { messages: EmailMessage[] } }> {
    const res = await fetchWithAuth(`/api/emails/${id}`);
    return res.json();
  },

  async syncGmail(): Promise<{ syncedCount: number; results: any[] }> {
    const res = await fetchWithAuth('/api/gmail/sync', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Sync failed' }));
      const customErr: any = new Error(err.error || 'Failed to sync emails');
      customErr.status = res.status;
      customErr.isAuthError = res.status === 401 || err.isAuthError || err.code === 'authError';
      throw customErr;
    }
    return res.json();
  },

  async simulateEmail(type: 'meeting' | 'support' | 'security' | 'sales' = 'meeting'): Promise<{
    success: boolean;
    email: EmailMessage;
    actionTaken: string;
  }> {
    const res = await fetchWithAuth('/api/gmail/simulate', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
    return res.json();
  },

  async analyzeEmail(id: string): Promise<AIAnalysis> {
    const res = await fetchWithAuth(`/api/emails/${id}/analyze`, { method: 'POST' });
    return res.json();
  },

  async generateReply(
    id: string,
    opts: { customInstruction?: string; tone?: string } = {}
  ): Promise<GeneratedReply> {
    const res = await fetchWithAuth(`/api/emails/${id}/generate-reply`, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    return res.json();
  },

  async generateAndSendReply(
    id: string,
    opts: { customInstruction?: string; tone?: string } = {}
  ): Promise<{ success: boolean; email: EmailMessage; reply: GeneratedReply }> {
    const res = await fetchWithAuth(`/api/emails/${id}/generate-and-send`, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Action failed' }));
      throw new Error(err.error || 'Failed to generate and send reply');
    }
    return res.json();
  },

  async sendReply(id: string, replyContent?: string): Promise<{ success: boolean; message: EmailMessage }> {
    const res = await fetchWithAuth(`/api/emails/${id}/send-reply`, {
      method: 'POST',
      body: JSON.stringify({ replyContent }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Send failed' }));
      throw new Error(err.error || 'Failed to send reply');
    }
    return res.json();
  },

  async createDraft(id: string, replyContent?: string): Promise<{ success: boolean; draftId: string }> {
    const res = await fetchWithAuth(`/api/emails/${id}/create-draft`, {
      method: 'POST',
      body: JSON.stringify({ replyContent }),
    });
    return res.json();
  },

  // Review Queue
  async getReviewQueue(): Promise<ApprovalQueueItem[]> {
    const res = await fetchWithAuth('/api/review-queue');
    return res.json();
  },

  async approveQueueItem(id: string): Promise<boolean> {
    const res = await fetchWithAuth(`/api/review-queue/${id}/approve`, { method: 'POST' });
    return res.ok;
  },

  async rejectQueueItem(id: string): Promise<boolean> {
    const res = await fetchWithAuth(`/api/review-queue/${id}/reject`, { method: 'POST' });
    return res.ok;
  },

  async editQueueItem(id: string, content: string): Promise<{ success: boolean; item: ApprovalQueueItem }> {
    const res = await fetchWithAuth(`/api/review-queue/${id}/edit`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return res.json();
  },

  async regenerateQueueItem(
    id: string,
    opts: { instruction?: string; tone?: string }
  ): Promise<{ success: boolean; item: ApprovalQueueItem }> {
    const res = await fetchWithAuth(`/api/review-queue/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    return res.json();
  },

  // Dashboard & Activity
  async getDashboardStats() {
    const res = await fetchWithAuth('/api/dashboard/stats');
    return res.json();
  },

  async getActivity(): Promise<ActivityLog[]> {
    const res = await fetchWithAuth('/api/activity');
    return res.json();
  },

  async getBilling(): Promise<BillingUsage> {
    const res = await fetchWithAuth('/api/billing');
    return res.json();
  },

  async updateBillingPlan(plan: 'free' | 'pro' | 'business'): Promise<BillingUsage> {
    const res = await fetchWithAuth('/api/billing/plan', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    return res.json();
  },

  // Diagnostics
  async runDiagnostics() {
    const res = await fetchWithAuth('/api/test/run-diagnostics', { method: 'POST' });
    return res.json();
  },

  // Admin Config
  async getAdminConfig() {
    const res = await fetchWithAuth('/api/admin/config');
    return res.json();
  },

  async updateAdminConfig(data: { provider: string; model: string }) {
    const res = await fetchWithAuth('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // 24/7 Background Daemon & Always-On Worker
  async getWorkerStatus() {
    const res = await fetchWithAuth('/api/worker/status');
    return res.json();
  },

  async saveWorkerToken(token: string, email?: string) {
    const res = await fetchWithAuth('/api/worker/token', {
      method: 'POST',
      body: JSON.stringify({ token, email }),
    });
    return res.json();
  },

  async clearWorkerToken() {
    const res = await fetchWithAuth('/api/worker/token', {
      method: 'DELETE',
    });
    return res.json();
  },

  async triggerWorkerPoll() {
    const res = await fetchWithAuth('/api/worker/trigger', {
      method: 'POST',
    });
    return res.json();
  },

  async startWorker() {
    const res = await fetchWithAuth('/api/worker/start', {
      method: 'POST',
    });
    return res.json();
  },

  async stopWorker() {
    const res = await fetchWithAuth('/api/worker/stop', {
      method: 'POST',
    });
    return res.json();
  },
};
