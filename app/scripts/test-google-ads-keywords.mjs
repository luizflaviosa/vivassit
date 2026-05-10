#!/usr/bin/env node
/**
 * Teste Google Ads API — Keyword Planner via REST.
 * Sem dependências externas.
 *
 * Pré-requisitos (todas via env):
 *   GADS_DEVELOPER_TOKEN     — Token do Google Ads Manager (API Center)
 *   GADS_CLIENT_ID           — OAuth Client ID (Cloud Console)
 *   GADS_CLIENT_SECRET       — OAuth Client Secret
 *   GADS_REFRESH_TOKEN       — Refresh token OAuth
 *   GADS_CUSTOMER_ID         — Customer ID 10 dígitos sem traços
 *   GADS_LOGIN_CUSTOMER_ID   — (opcional) MCC ID
 *   GADS_API_VERSION         — (opcional) v18 default
 */

import { writeFileSync } from 'node:fs';

const requiredEnv = ['GADS_DEVELOPER_TOKEN', 'GADS_CLIENT_ID', 'GADS_CLIENT_SECRET', 'GADS_REFRESH_TOKEN', 'GADS_CUSTOMER_ID'];
for (const k of requiredEnv) {
  if (!process.env[k]) { console.error(`❌ Missing env var: ${k}`); process.exit(1); }
}

const DEVELOPER_TOKEN = process.env.GADS_DEVELOPER_TOKEN;
const CLIENT_ID = process.env.GADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GADS_REFRESH_TOKEN;
const CUSTOMER_ID = process.env.GADS_CUSTOMER_ID.replace(/-/g, '');
const LOGIN_CUSTOMER_ID = (process.env.GADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
// Auto-detect versão suportada (Google Ads API tipicamente mantém últimas 4 versões)
const VERSION_CANDIDATES = process.env.GADS_API_VERSION
  ? [process.env.GADS_API_VERSION]
  : ['v21', 'v20', 'v19', 'v18', 'v17'];

let API = null;
let BASE = null;

// 1) Refresh access token
console.log('🔑 Refreshing access token…');
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
  }),
});
if (!tokenRes.ok) {
  console.error(`❌ Token refresh failed: HTTP ${tokenRes.status}`);
  console.error(await tokenRes.text());
  process.exit(1);
}
const { access_token } = await tokenRes.json();
console.log(`✅ Access token (${access_token.slice(0, 20)}…)\n`);

const headers = {
  Authorization: `Bearer ${access_token}`,
  'developer-token': DEVELOPER_TOKEN,
  'Content-Type': 'application/json',
};
if (LOGIN_CUSTOMER_ID) headers['login-customer-id'] = LOGIN_CUSTOMER_ID;

// 2) Sanity check — auto-probe versão suportada
const sanityHeaders = { ...headers };
delete sanityHeaders['login-customer-id'];
delete sanityHeaders['Content-Type'];

console.log(`🩺 Auto-detectando versão suportada (${VERSION_CANDIDATES.join(', ')})...`);
for (const version of VERSION_CANDIDATES) {
  const candidateBase = `https://googleads.googleapis.com/${version}`;
  const r = await fetch(`${candidateBase}/customers:listAccessibleCustomers`, { headers: sanityHeaders });
  console.log(`   ${version}: HTTP ${r.status}`);
  if (r.ok) {
    API = version;
    BASE = candidateBase;
    const data = await r.json();
    console.log(`✅ Versão suportada: ${API}`);
    console.log(`   Accessible customers: ${(data.resourceNames || []).join(', ') || '(nenhum)'}\n`);
    break;
  }
}

if (!BASE) {
  console.error('❌ Nenhuma versão (v17–v21) respondeu OK no listAccessibleCustomers.');
  console.error('   Provável: developer token ainda não aprovado, ou OAuth scope errado, ou conta sem acesso à API.');
  process.exit(1);
}

// 3) Keyword Planner — generateKeywordIdeas
const keywords = ['reumatologista', 'fibromialgia', 'artrose', 'lupus', 'artrite reumatoide'];
const url = `${BASE}/customers/${CUSTOMER_ID}:generateKeywordIdeas`;
const body = {
  language: 'languageConstants/1014',  // Portuguese
  geoTargetConstants: ['geoTargetConstants/2076'],  // Brazil
  keywordPlanNetwork: 'GOOGLE_SEARCH',
  keywordSeed: { keywords },
  pageSize: 50,
};

console.log(`📞 POST ${url}`);
console.log(`   customer_id=${CUSTOMER_ID}${LOGIN_CUSTOMER_ID ? `, login_customer_id=${LOGIN_CUSTOMER_ID}` : ''}`);
console.log(`   seed keywords: ${keywords.join(', ')}\n`);

const apiRes = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
const responseText = await apiRes.text();
let data;
try { data = JSON.parse(responseText); } catch { data = null; }

console.log(`HTTP: ${apiRes.status}\n`);

if (!apiRes.ok || !data) {
  console.error('❌ Erro:');
  console.error(responseText.slice(0, 2000));
  process.exit(1);
}
if (data.error) {
  console.error('❌ API Error:');
  console.error(JSON.stringify(data.error, null, 2));
  process.exit(1);
}

// 4) Print resultados
const results = data.results ?? [];
console.log(`✅ ${results.length} keyword ideas retornados\n`);
console.log('═'.repeat(90));
console.log('  Volume       LowCPC     HighCPC    Comp   Keyword');
console.log('═'.repeat(90));

for (const r of results.slice(0, 30)) {
  const m = r.keywordIdeaMetrics ?? {};
  const vol = m.avgMonthlySearches ?? 'null';
  const lowCpc = m.lowTopOfPageBidMicros ? `R$${(Number(m.lowTopOfPageBidMicros) / 1_000_000).toFixed(2)}` : '—';
  const highCpc = m.highTopOfPageBidMicros ? `R$${(Number(m.highTopOfPageBidMicros) / 1_000_000).toFixed(2)}` : '—';
  const comp = m.competitionIndex ?? m.competition ?? '—';
  console.log(`  ${String(vol).padStart(10)}   ${String(lowCpc).padStart(8)}   ${String(highCpc).padStart(8)}   ${String(comp).padStart(4)}   ${r.text}`);
}

writeFileSync('google-ads-result.json', JSON.stringify(data, null, 2));
console.log(`\n✅ Resposta completa salva em: google-ads-result.json`);
