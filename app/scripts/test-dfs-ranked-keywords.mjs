#!/usr/bin/env node
/**
 * Teste correto pra "espionar concorrente": ranked_keywords/live.
 *
 * Diferente do keywords_for_site (que retorna o UNIVERSO temático), este
 * retorna SÓ as keywords que o site efetivamente ranqueia no Google,
 * com posição real, tráfego estimado, página que ranqueia, etc.
 *
 * Uso:
 *   DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy \
 *     node scripts/test-dfs-ranked-keywords.mjs
 *
 * Custo: ~US$ 0.012 (1 task, 200 results).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
if (!LOGIN || !PASSWORD) {
  console.error('❌ Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD');
  process.exit(1);
}

const TARGET = process.argv[2] ?? 'drapaulafranzon.com.br';
const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');
const OUT = 'exports/dfs-test';
mkdirSync(OUT, { recursive: true });

console.log(`🎯 ranked_keywords → ${TARGET} (Brasil, PT)\n`);

const t0 = Date.now();
const res = await fetch(
  'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
  {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        target: TARGET,
        location_name: 'Brazil',
        language_name: 'Portuguese',
        limit: 200,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      },
    ]),
  },
);
const elapsed = Date.now() - t0;
const data = await res.json();

const file = join(OUT, `ranked-${TARGET.replace(/[^a-z0-9]/gi, '-')}.json`);
writeFileSync(file, JSON.stringify(data, null, 2));

const task = data.tasks?.[0];
const result = task?.result?.[0];
const items = result?.items ?? [];

console.log(
  `HTTP=${res.status} status_code=${data.status_code} task_status=${task?.status_code} cost=$${(data.cost ?? 0).toFixed(4)} (${elapsed}ms)`,
);
console.log(`Total que o site ranqueia: ${result?.total_count ?? items.length}`);
console.log(`Salvo em: ${file}\n`);

if (items.length === 0) {
  console.log('⚠️  Zero keywords ranqueadas. Causas prováveis:');
  console.log('   - Site novo / sem indexação');
  console.log('   - Domínio sem ranqueamento orgânico (só direct/social/Instagram)');
  console.log(`   - Task error: ${task?.status_message ?? 'n/a'}`);
  process.exit(0);
}

// Top 20 por volume
console.log('📊 TOP 20 keywords ranqueadas (por volume):\n');
console.log(
  'pos'.padEnd(5) + 'vol/mês'.padEnd(10) + 'cpc'.padEnd(8) + 'etv/mês'.padEnd(10) + 'intent'.padEnd(15) + 'keyword',
);
console.log('-'.repeat(110));

const top = [...items]
  .sort(
    (a, b) =>
      (b.keyword_data?.keyword_info?.search_volume ?? 0) -
      (a.keyword_data?.keyword_info?.search_volume ?? 0),
  )
  .slice(0, 20);

for (const it of top) {
  const kd = it.keyword_data ?? {};
  const ki = kd.keyword_info ?? {};
  const intent = kd.search_intent_info?.main_intent ?? '?';
  const serp = it.ranked_serp_element?.serp_item ?? {};
  const pos = serp.rank_absolute ?? '–';
  const vol = ki.search_volume ?? 0;
  const cpc = ki.cpc != null ? `$${ki.cpc.toFixed(2)}` : '–';
  const etv = serp.etv != null ? Math.round(serp.etv) : '–';
  console.log(
    String(pos).padEnd(5) +
      String(vol).padEnd(10) +
      String(cpc).padEnd(8) +
      String(etv).padEnd(10) +
      String(intent).padEnd(15) +
      kd.keyword,
  );
}

// Distribuições + brand
const positions = { '1-3': 0, '4-10': 0, '11-30': 0, '31-100': 0 };
const intents = {};
let totalEtv = 0;
let totalVol = 0;
const pages = {};

for (const it of items) {
  const pos = it.ranked_serp_element?.serp_item?.rank_absolute;
  if (pos != null) {
    if (pos <= 3) positions['1-3']++;
    else if (pos <= 10) positions['4-10']++;
    else if (pos <= 30) positions['11-30']++;
    else positions['31-100']++;
  }
  const intent = it.keyword_data?.search_intent_info?.main_intent ?? '?';
  intents[intent] = (intents[intent] ?? 0) + 1;
  totalEtv += it.ranked_serp_element?.serp_item?.etv ?? 0;
  totalVol += it.keyword_data?.keyword_info?.search_volume ?? 0;
  const url = it.ranked_serp_element?.serp_item?.url;
  if (url) pages[url] = (pages[url] ?? 0) + 1;
}

console.log(`\n📈 Agregado (${items.length} de ${result?.total_count ?? items.length} totais):`);
console.log(`   Volume total mensal:  ${totalVol.toLocaleString('pt-BR')}`);
console.log(`   Tráfego estimado:     ${Math.round(totalEtv).toLocaleString('pt-BR')} clicks/mês`);
console.log(`   Distribuição posição (do que está em página visível):`);
for (const [bucket, count] of Object.entries(positions)) {
  console.log(`     ${bucket.padEnd(8)} → ${count}`);
}
console.log(`   Distribuição intent:`);
for (const [intent, count] of Object.entries(intents)) {
  console.log(`     ${intent.padEnd(15)} → ${count}`);
}

// Top páginas que mais ranqueiam
const topPages = Object.entries(pages)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
console.log(`\n📄 Top 5 páginas mais ranqueadas:`);
for (const [url, count] of topPages) {
  console.log(`   ${count.toString().padStart(3)} kws  ${url}`);
}

// Brand vs não-brand
const brandTerms = ['paula franzon', 'dra paula', 'drapaula', 'franzon'];
const branded = items.filter((it) =>
  brandTerms.some((b) => (it.keyword_data?.keyword ?? '').toLowerCase().includes(b)),
);
console.log(`\n🏷️  Brand: ${branded.length} keywords`);
if (branded.length > 0) {
  console.log('   Top:', branded.slice(0, 5).map((i) => `${i.keyword_data.keyword} (vol ${i.keyword_data.keyword_info?.search_volume}, pos ${i.ranked_serp_element?.serp_item?.rank_absolute})`).join(' | '));
}
