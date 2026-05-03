export interface ChatwootConfig {
  baseUrl: string;
  accountId: string;
  apiAccessToken: string;
}

export interface ListContactsParams {
  page?: number;
  q?: string;
  sort?: "name" | "-name" | "email" | "-email" | "last_activity_at" | "-last_activity_at";
  include_contact_inboxes?: boolean;
}

export interface ListConversationsParams {
  status?: "open" | "resolved" | "pending" | "snoozed" | "all";
  assignee_type?: "me" | "unassigned" | "assigned" | "all";
  page?: number;
  inbox_id?: number;
  team_id?: number;
  labels?: string[];
  q?: string;
}

export interface SendMessageParams {
  conversationId: number;
  content: string;
  messageType?: "incoming" | "outgoing" | "template";
  private?: boolean;
  contentType?: "text" | "input_email" | "cards" | "input_select" | "form" | "article";
}

export class ChatwootClient {
  constructor(private readonly config: ChatwootConfig) {
    if (!config.baseUrl) throw new Error("CHATWOOT_BASE_URL is required");
    if (!config.accountId) throw new Error("CHATWOOT_ACCOUNT_ID is required");
    if (!config.apiAccessToken) throw new Error("CHATWOOT_API_ACCESS_TOKEN is required");
  }

  private url(path: string, query?: Record<string, unknown>): string {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = new URL(
      `${base}/api/v1/accounts/${this.config.accountId}${path}`,
    );
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        api_access_token: this.config.apiAccessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Chatwoot API ${method} ${url} → ${res.status} ${res.statusText}: ${text}`);
    }

    return (await res.json()) as T;
  }

  async listContacts(params: ListContactsParams = {}): Promise<unknown> {
    return this.request("GET", this.url("/contacts", { ...params }));
  }

  async listConversations(params: ListConversationsParams = {}): Promise<unknown> {
    const { labels, ...rest } = params;
    const query: Record<string, unknown> = { ...rest };
    if (labels && labels.length > 0) query.labels = labels.join(",");
    return this.request("GET", this.url("/conversations", query));
  }

  async sendMessage(params: SendMessageParams): Promise<unknown> {
    const { conversationId, content, messageType = "outgoing", private: isPrivate = false, contentType } = params;
    return this.request("POST", this.url(`/conversations/${conversationId}/messages`), {
      content,
      message_type: messageType,
      private: isPrivate,
      content_type: contentType,
    });
  }
}
