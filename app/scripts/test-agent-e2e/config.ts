// Configuração centralizada da suite E2E.
// Lê variáveis do .env.local (dev) ou env vars (CI).

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Tenta .env.local primeiro (Next.js padrão), depois .env
for (const fname of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), fname);
  if (existsSync(p)) {
    loadEnv({ path: p, override: false });
  }
}

function require_env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export const config = {
  supabase: {
    url: require_env('NEXT_PUBLIC_SUPABASE_URL'),
    serviceKey: require_env('SUPABASE_SERVICE_ROLE_KEY'),
  },
  n8n: {
    webhookUrl: process.env.N8N_P01_WEBHOOK_URL ||
      'https://n8n.singulare.org/webhook/a2f5a714-f279-4452-aa0e-63506eadd347',
  },
  judge: {
    // Aceita GOOGLE_API_KEY ou GEMINI_API_KEY
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
    model: process.env.AGENT_JUDGE_MODEL || 'gemini-2.0-flash',
  },
  tenant: {
    id: 'singulare-e2e',
    name: 'Clinica E2E Testes',
    doctor: 'Dra. Teste E2E',
    chatwootAccountId: '1',
    chatwootInboxId: '13', // inbox real "singulare-e2e-tests" criado via API
  },
  chatwoot: {
    baseUrl: process.env.CHATWOOT_BASE_URL || 'https://chatwoot.singulare.org',
    accountId: process.env.CHATWOOT_ACCOUNT_ID || '1',
    inboxId: '13',
    token: process.env.CHATWOOT_API_ACCESS_TOKEN || '',
  },
  watcher: {
    pollIntervalMs: 1500,
    timeoutMs: 90_000,
  },
  // Delay entre turns (evita "Mensagem encavalada" do P01 que cacheia resposta anterior).
  betweenTurnsMs: 3500,
};
