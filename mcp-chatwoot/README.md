# mcp-chatwoot

MCP server that exposes the [Chatwoot](https://www.chatwoot.com/) REST API as tools for any MCP-compatible client (Claude Code, Claude Desktop, etc.).

## Tools

- **`list_contacts`** — List contacts of the configured account. Args: `page`, `q`, `sort`, `include_contact_inboxes`.
- **`send_message`** — Send a message to an existing conversation. Args: `conversation_id`, `content`, `message_type`, `private`, `content_type`.

## Setup

```bash
cd mcp-chatwoot
npm install
npm run build
```

Set environment variables (see `.env.example`):

| Var | Description |
|-----|-------------|
| `CHATWOOT_BASE_URL` | e.g. `https://app.chatwoot.com` or your self-hosted URL |
| `CHATWOOT_ACCOUNT_ID` | Numeric account ID |
| `CHATWOOT_API_ACCESS_TOKEN` | User profile → Access Token |

## Run

```bash
CHATWOOT_BASE_URL=... CHATWOOT_ACCOUNT_ID=... CHATWOOT_API_ACCESS_TOKEN=... npm start
```

## Use in Claude Code

Add to `~/.claude.json` (or project `.mcp.json`):

```json
{
  "mcpServers": {
    "chatwoot": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-chatwoot/dist/index.js"],
      "env": {
        "CHATWOOT_BASE_URL": "https://app.chatwoot.com",
        "CHATWOOT_ACCOUNT_ID": "1",
        "CHATWOOT_API_ACCESS_TOKEN": "..."
      }
    }
  }
}
```
