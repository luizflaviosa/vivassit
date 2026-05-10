#!/usr/bin/env node
// Teste DataForSEO Trends — confirma se a limitação atual é só do Google Ads
// search_volume ou se atinge outros endpoints DFS também.
//
// Uso:
//   DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy node scripts/test-dfs-trends.mjs

import { writeFileSync } from 'node:fs';

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error('❌ Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD');
  process.exit(1);
}

const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');

const keywords = [
  'reumatologista',
  'fibromialgia',
  'artrite reumatoide',
  'lupus',
  'paula franzon',
];

console.log('🔍 Testando DataForSEO Google Trends — Brasil, 12 meses\n');
console.log(`Keywords: ${keywords.join(', ')}\n`);

async function call(path, body) {
  const res = await fetch(`https://api.dataforseo.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { http: res.status, data };
}

// 1. DataForSEO Trends (clickstream proprietário deles)
console.log('━━━ 1. /v3/keywords_data/dataforseo_trends/explore/live ━━━');
const r1 = await call('/v3/keywords_data/dataforseo_trends/explore/live', [{
  keywords,
  location_name: 'Brazil',
  date_from: '2025-05-09',
  date_to: '2026-05-09',
}]);
console.log(`HTTP: ${r1.http} · status_code: ${r1.data.status_code} · ${r1.data.status_message}`);
const t1 = r1.data.tasks?.[0];
console.log(`task status: ${t1?.status_code} · ${t1?.status_message}`);
console.log(`results: ${t1?.result?.length ?? 0}`);
if (t1?.result?.[0]?.items?.length > 0) {
  console.log('SAMPLE (primeiros 2 items):');
  console.log(JSON.stringify(t1.result[0].items.slice(0, 2), null, 2).slice(0, 800));
} else {
  console.log('(sem items)');
}

console.log('');

// 2. Google Trends via DFS (pega direto do Google)
console.log('━━━ 2. /v3/keywords_data/google_trends/explore/live ━━━');
const r2 = await call('/v3/keywords_data/google_trends/explore/live', [{
  keywords: keywords.slice(0, 5), // Google Trends limita a 5
  location_name: 'Brazil',
  language_code: 'pt',
  type: 'web',
  category_code: 0,
  time_range: 'past_12_months',
  item_types: ['google_trends_graph', 'google_trends_topics_list', 'google_trends_queries_list'],
}]);
console.log(`HTTP: ${r2.http} · status_code: ${r2.data.status_code} · ${r2.data.status_message}`);
const t2 = r2.data.tasks?.[0];
console.log(`task status: ${t2?.status_code} · ${t2?.status_message}`);
console.log(`results: ${t2?.result?.length ?? 0}`);
const items2 = t2?.result?.[0]?.items ?? [];
console.log(`items: ${items2.length}`);
if (items2.length > 0) {
  for (const item of items2) {
    console.log(`  - ${item.type}: ${
      item.type === 'google_trends_graph'
        ? `${item.data?.length ?? 0} pontos no tempo`
        : item.type.includes('queries')
        ? `${item.data?.length ?? 0} queries`
        : item.type
    }`);
  }
  console.log('SAMPLE (primeiro graph point):');
  const graph = items2.find(i => i.type === 'google_trends_graph');
  if (graph?.data?.[0]) console.log(JSON.stringify(graph.data[0], null, 2));
}

console.log('');

// 3. Bulk Search Volume (clickstream — alternativa pro Google Ads)
console.log('━━━ 3. /v3/dataforseo_labs/google/bulk_search_volume/live ━━━');
const r3 = await call('/v3/dataforseo_labs/google/bulk_search_volume/live', [{
  keywords,
  location_name: 'Brazil',
  language_code: 'pt',
}]);
console.log(`HTTP: ${r3.http} · status_code: ${r3.data.status_code} · ${r3.data.status_message}`);
const t3 = r3.data.tasks?.[0];
console.log(`task status: ${t3?.status_code} · ${t3?.status_message}`);
const items3 = t3?.result?.[0]?.items ?? [];
console.log(`items: ${items3.length}`);
if (items3.length > 0) {
  console.log('SAMPLE (volumes):');
  for (const it of items3.slice(0, 5)) {
    console.log(`  - ${it.keyword}: vol=${it.search_volume} cpc=${it.cpc} comp=${it.competition}`);
  }
}

// Salva tudo pra inspeção
writeFileSync('dfs-trends-result.json', JSON.stringify({
  collected_at: new Date().toISOString(),
  trends_dfs: r1,
  trends_google: r2,
  bulk_search_volume_labs: r3,
}, null, 2));
console.log(`\n✅ Resposta completa salva em: ${process.cwd()}/dfs-trends-result.json`);
