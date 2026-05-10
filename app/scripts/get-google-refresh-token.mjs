#!/usr/bin/env node
/**
 * OAuth flow local — gera refresh_token sem usar OAuth Playground.
 *
 * Uso:
 *   GADS_CLIENT_ID=xxx GADS_CLIENT_SECRET=yyy node scripts/get-google-refresh-token.mjs
 *
 * Requer: o redirect URI 'http://localhost' precisa estar autorizado no
 * Cloud Console pro mesmo OAuth Client (n8n-google). Se não estiver,
 * adiciona em: APIs & Services → Credentials → n8n-google → Authorized redirect URIs
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const CLIENT_ID = process.env.GADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GADS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Defina GADS_CLIENT_ID e GADS_CLIENT_SECRET');
  process.exit(1);
}

const REDIRECT_URI = process.env.GADS_REDIRECT_URI || 'http://localhost:53682';
const SCOPE = 'https://www.googleapis.com/auth/adwords';

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('━'.repeat(70));
console.log('1) ABRA esta URL no navegador (cola na barra de endereços):\n');
console.log(authUrl.toString());
console.log('\n2) Faça login com a conta Google que tem acesso ao Google Ads Singulare');
console.log('3) Aprove os escopos solicitados');
console.log('4) O navegador VAI tentar abrir http://localhost — vai dar ERRO de página');
console.log('   (isso é esperado). Olha pra BARRA DE ENDEREÇOS — vai ter algo como:');
console.log('   http://localhost/?code=4/0AeoWuM9X-XXXXXX&scope=...');
console.log('5) Copia SÓ o valor do code (entre "code=" e "&scope")');
console.log('━'.repeat(70));

const rl = createInterface({ input, output });
const code = (await rl.question('\nCola o code aqui: ')).trim();
rl.close();

if (!code) {
  console.error('❌ Code vazio');
  process.exit(1);
}

console.log('\n🔄 Trocando code por refresh_token...');

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }),
});

const data = await res.json();

if (!res.ok || !data.refresh_token) {
  console.error('❌ Erro:');
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log('\n✅ Refresh token (cola no GADS_REFRESH_TOKEN):\n');
console.log(data.refresh_token);
console.log('\n   Access token (válido 1h, vai ser auto-refreshed pelo script de teste):');
console.log(`   ${data.access_token.slice(0, 40)}...`);
