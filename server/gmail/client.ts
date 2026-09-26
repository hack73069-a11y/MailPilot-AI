export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  senderName: string;
  recipient: string;
  subject: string;
  date: string;
  snippet: string;
  bodyPlain: string;
  bodyHtml?: string;
  hasAttachments: boolean;
  attachmentNames: string[];
  messageIdHeader?: string;
  referencesHeader?: string;
  inReplyToHeader?: string;
  labels: string[];
}

export class GmailClient {
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';

  /**
   * Fetch connected user's Gmail profile
   */
  async getProfile(accessToken: string): Promise<GmailProfile> {
    const res = await fetch(`${this.baseUrl}/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      let isAuthError = res.status === 401;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.errors?.[0]?.reason === 'authError' || parsed.error?.code === 401) {
          isAuthError = true;
        }
      } catch {}
      const err: any = new Error(
        isAuthError
          ? 'Gmail session expired or invalid credentials (authError). Please reconnect your Google account.'
          : `Gmail API error (${res.status}): ${errText}`
      );
      err.status = res.status;
      err.isAuthError = isAuthError;
      throw err;
    }

    return res.json();
  }

  /**
   * List recent inbox messages
   */
  async listMessages(
    accessToken: string,
    query = 'in:inbox',
    maxResults = 10
  ): Promise<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string }> {
    const url = new URL(`${this.baseUrl}/messages`);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(maxResults));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      let isAuthError = res.status === 401;
      let errorDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.errors?.[0]?.reason === 'authError' || parsed.error?.code === 401) {
          isAuthError = true;
        }
        if (parsed.error?.message) {
          errorDetail = parsed.error.message;
        }
      } catch {}

      const err: any = new Error(
        isAuthError
          ? `Gmail session expired or invalid credentials (authError). Please reconnect your Google account.`
          : `Failed to list Gmail messages (${res.status}): ${errorDetail}`
      );
      err.status = res.status;
      err.isAuthError = isAuthError;
      throw err;
    }

    return res.json();
  }

  /**
   * Fetch full message by ID
   */
  async getMessage(accessToken: string, messageId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/messages/${messageId}?format=full`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch message ${messageId}: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Fetch complete thread by ID
   */
  async getThread(accessToken: string, threadId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/threads/${threadId}?format=full`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch thread ${threadId}: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Send RFC 2822 reply
   */
  async sendReply(
    accessToken: string,
    options: {
      threadId: string;
      to: string;
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
    }
  ): Promise<{ id: string; threadId: string }> {
    const rawRfc2822 = this.constructRfc2822(options);
    const encoded = Buffer.from(rawRfc2822, 'utf-8').toString('base64url');

    const res = await fetch(`${this.baseUrl}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encoded,
        threadId: options.threadId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to send email via Gmail API: ${err}`);
    }

    return res.json();
  }

  /**
   * Create draft in Gmail
   */
  async createDraft(
    accessToken: string,
    options: {
      threadId: string;
      to: string;
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
    }
  ): Promise<{ id: string; message: { id: string; threadId: string } }> {
    const rawRfc2822 = this.constructRfc2822(options);
    const encoded = Buffer.from(rawRfc2822, 'utf-8').toString('base64url');

    const res = await fetch(`${this.baseUrl}/drafts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          raw: encoded,
          threadId: options.threadId,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create draft via Gmail API: ${err}`);
    }

    return res.json();
  }

  /**
   * Parse Gmail API message object into structured model
   */
  parseMessage(raw: any): ParsedGmailMessage {
    const headers = raw.payload?.headers || [];
    const getHeader = (name: string): string => {
      const found = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return found ? found.value : '';
    };

    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject') || '(No Subject)';
    const date = getHeader('Date') || new Date(Number(raw.internalDate) || Date.now()).toISOString();
    const messageIdHeader = getHeader('Message-ID');
    const referencesHeader = getHeader('References');
    const inReplyToHeader = getHeader('In-Reply-To');

    // Parse sender name & email
    let senderName = from;
    let senderEmail = from;
    const match = from.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      senderName = match[1].replace(/["']/g, '').trim();
      senderEmail = match[2].trim();
    } else {
      senderEmail = from.replace(/<|>/g, '').trim();
      senderName = senderEmail.split('@')[0];
    }

    // Extract body and attachments
    let bodyPlain = '';
    let bodyHtml = '';
    const attachmentNames: string[] = [];

    const extractParts = (part: any) => {
      if (!part) return;

      if (part.filename && part.filename.length > 0) {
        attachmentNames.push(part.filename);
      }

      if (part.mimeType === 'text/plain' && part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        bodyPlain += decoded;
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        bodyHtml += decoded;
      }

      if (part.parts && Array.isArray(part.parts)) {
        for (const subPart of part.parts) {
          extractParts(subPart);
        }
      }
    };

    if (raw.payload?.body?.data) {
      const decoded = Buffer.from(raw.payload.body.data, 'base64url').toString('utf-8');
      if (raw.payload.mimeType === 'text/html') {
        bodyHtml = decoded;
      } else {
        bodyPlain = decoded;
      }
    }

    if (raw.payload?.parts) {
      extractParts(raw.payload);
    }

    // Fallback plain text from HTML if only HTML was present
    if (!bodyPlain && bodyHtml) {
      bodyPlain = bodyHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return {
      id: raw.id,
      threadId: raw.threadId,
      sender: from,
      senderEmail,
      senderName,
      recipient: to,
      subject,
      date,
      snippet: raw.snippet || bodyPlain.substring(0, 160),
      bodyPlain: bodyPlain.trim(),
      bodyHtml: bodyHtml.trim() || undefined,
      hasAttachments: attachmentNames.length > 0,
      attachmentNames,
      messageIdHeader,
      referencesHeader,
      inReplyToHeader,
      labels: raw.labelIds || [],
    };
  }

  /**
   * Build clean standard RFC 2822 email payload
   */
  private constructRfc2822(options: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  }): string {
    const subject = options.subject.startsWith('Re:')
      ? options.subject
      : `Re: ${options.subject}`;

    const headers: string[] = [
      `To: ${options.to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
    ];

    if (options.inReplyTo) {
      headers.push(`In-Reply-To: ${options.inReplyTo}`);
    }
    if (options.references) {
      headers.push(`References: ${options.references}`);
    } else if (options.inReplyTo) {
      headers.push(`References: ${options.inReplyTo}`);
    }

    return `${headers.join('\r\n')}\r\n\r\n${options.body}`;
  }
}

export const gmailClient = new GmailClient();
