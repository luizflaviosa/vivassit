#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { ChatwootClient } from "./chatwoot.js";

let cachedClient: ChatwootClient | null = null;
function getClient(): ChatwootClient {
  if (cachedClient) return cachedClient;
  const missing: string[] = [];
  if (!process.env.CHATWOOT_ACCOUNT_ID) missing.push("CHATWOOT_ACCOUNT_ID");
  if (!process.env.CHATWOOT_API_ACCESS_TOKEN) missing.push("CHATWOOT_API_ACCESS_TOKEN");
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in your MCP server config or pass --env-file=path/to/.env to node.`,
    );
  }
  cachedClient = new ChatwootClient({
    baseUrl: process.env.CHATWOOT_BASE_URL ?? "https://app.chatwoot.com",
    accountId: process.env.CHATWOOT_ACCOUNT_ID!,
    apiAccessToken: process.env.CHATWOOT_API_ACCESS_TOKEN!,
  });
  return cachedClient;
}

const server = new McpServer({
  name: "mcp-chatwoot",
  version: "0.1.0",
});

const listContactsInput = z.object({
  page: z.number().int().min(1).optional().describe("Page number, 1-indexed (default 1)"),
  q: z.string().optional().describe("Free-text search across name, email and phone"),
  sort: z
    .enum(["name", "-name", "email", "-email", "last_activity_at", "-last_activity_at"])
    .optional()
    .describe("Sort order; prefix with '-' for descending"),
  include_contact_inboxes: z
    .boolean()
    .optional()
    .describe("Include the inboxes each contact belongs to"),
});

const listConversationsInput = z.object({
  status: z
    .enum(["open", "resolved", "pending", "snoozed", "all"])
    .optional()
    .describe("Conversation status filter (default 'open')"),
  assignee_type: z
    .enum(["me", "unassigned", "assigned", "all"])
    .optional()
    .describe("Filter by assignee bucket"),
  page: z.number().int().min(1).optional().describe("Page number, 1-indexed (default 1)"),
  inbox_id: z.number().int().positive().optional().describe("Restrict to a specific inbox"),
  team_id: z.number().int().positive().optional().describe("Restrict to a specific team"),
  labels: z.array(z.string()).optional().describe("Filter by one or more labels"),
  q: z.string().optional().describe("Free-text search across conversation messages"),
});

const sendMessageInput = z.object({
  conversation_id: z.number().int().positive().describe("ID of the target conversation"),
  content: z.string().min(1).describe("Message body"),
  message_type: z
    .enum(["incoming", "outgoing", "template"])
    .optional()
    .describe("Direction/type of message (default 'outgoing')"),
  private: z
    .boolean()
    .optional()
    .describe("If true, the message is a private internal note (default false)"),
  content_type: z
    .enum(["text", "input_email", "cards", "input_select", "form", "article"])
    .optional()
    .describe("Rich content type (default 'text')"),
});

server.registerTool(
  "list_contacts",
  {
    description:
      "List contacts from the configured Chatwoot account. Supports pagination, search and sorting.",
    inputSchema: listContactsInput.shape,
  },
  async (args) => {
    const data = await getClient().listContacts(args);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "list_conversations",
  {
    description:
      "List conversations from the configured Chatwoot account. Defaults to status='open' to show currently open sessions. Supports filtering by status, assignee, inbox, team, labels and free-text search.",
    inputSchema: listConversationsInput.shape,
  },
  async (args) => {
    const data = await getClient().listConversations({
      status: args.status ?? "open",
      assignee_type: args.assignee_type,
      page: args.page,
      inbox_id: args.inbox_id,
      team_id: args.team_id,
      labels: args.labels,
      q: args.q,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "send_message",
  {
    description: "Send a message to an existing Chatwoot conversation.",
    inputSchema: sendMessageInput.shape,
  },
  async (args) => {
    const data = await getClient().sendMessage({
      conversationId: args.conversation_id,
      content: args.content,
      messageType: args.message_type,
      private: args.private,
      contentType: args.content_type,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-chatwoot listening on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
