#!/usr/bin/env node
// Verifica status da conta DataForSEO sem custo.
// Uso:  DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy node scripts/test-dataforseo-status.mjs

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error('❌ Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD');
  process.exit(1);
}

const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');

console.log('🔍 Diagnóstico DataForSEO\n');
console.log(`Login informado:    ${LOGIN}`);
console.log(`Password (início):  ${PASSWORD.slice(0, 4)}...`);
console.log(`Base64 (início):    ${auth.slice(0, 12)}...\n`);

const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
  headers: { Authorization: `Basic ${auth}` },
});

const data = await res.json();
console.log(`HTTP: ${res.status}`);
console.log(`status_code: ${data.status_code}`);
console.log(`status_message: ${data.status_message}\n`);

const userData = data.tasks?.[0]?.result?.[0];
if (userData) {
  console.log('📊 Conta:');
  console.log(`  Login:        ${userData.login || '—'}`);
  console.log(`  Verified:     ${userData.verified ?? '—'}`);
  console.log(`  Money (USD):  ${userData.money?.balance ?? '—'}`);
  console.log(`  Limits:`);
  if (userData.rates) {
    Object.entries(userData.rates).forEach(([k, v]) => console.log(`    ${k}: ${JSON.stringify(v)}`));
  }
  console.log('\nResposta completa:');
  console.log(JSON.stringify(userData, null, 2));
} else {
  console.log('Sem dados de conta. Resposta bruta:');
  console.log(JSON.stringify(data, null, 2));
}
