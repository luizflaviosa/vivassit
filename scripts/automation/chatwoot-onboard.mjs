#!/usr/bin/env node
/**
 * chatwoot-onboard.mjs — cria inbox API no Chatwoot pra novo tenant.
 * Uso: --slug=<slug> --name=<nome> [--apply]
 * Default dry-run: mostra payload sem chamar API.
 * POST /api/v1/accounts/1/inboxes  (channel.type=api).
 */

const BASE = process.env.CHATWOOT_BASE_URL || "https://chatwoot.singulare.org";
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || "1";
const TOKEN = process.env.CHATWOOT_API_TOKEN;
const WEBHOOK = process.env.CHATWOOT_INBOX_WEBHOOK_URL || "https://app.singulare.org/api/webhooks/chatwoot";

if (!TOKEN) {
  console.error("ERRO: env var CHATWOOT_API_TOKEN ausente. Defina em .env.local.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");

function getFlag(name) {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const slug = getFlag("slug");
const name = getFlag("name");

if (!slug || !name) {
  console.error("uso: chatwoot-onboard.mjs --slug=<slug> --name=<nome> [--apply]");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
  console.error(`Slug inválido: ${slug}. Use kebab-case (a-z, 0-9, -).`);
  process.exit(1);
}

const inboxName = `${slug} - ${name}`;
const payload = {
  name: inboxName,
  channel: {
    type: "api",
    webhook_url: WEBHOOK,
  },
};

console.log(`Chatwoot base: ${BASE}`);
console.log(`Account: ${ACCOUNT_ID}`);
console.log(`Inbox name: ${inboxName}`);
console.log(`Webhook: ${WEBHOOK}`);

if (!apply) {
  console.log("[dry-run] use --apply para criar a inbox.");
  process.exit(0);
}

try {
  const res = await fetch(`${BASE}/api/v1/accounts/${ACCOUNT_ID}/inboxes`, {
    method: "POST",
    headers: {
      api_access_token: TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Chatwoot ${res.status}: ${body.slice(0, 400)}`);
    process.exit(1);
  }
  const data = await res.json();
  const inboxId = data.id || data.inbox?.id;
  console.log(`Inbox criada. inbox_id=${inboxId}`);
  if (data.inbox_identifier) console.log(`inbox_identifier=${data.inbox_identifier}`);
} catch (err) {
  console.error("ERRO:", err.message || err);
  process.exit(1);
}
