#!/usr/bin/env node
/**
 * Teste focado: keywords_for_site pro site da Dra. Paula Franzon.
 * Pega TODAS as palavras pelas quais o site dela ranqueia no Google BR,
 * com volume + posição + tráfego estimado + intent.
 *
 * Saída: exports/dfs-test/dra-paula-keywords-for-site.json (raw) + summary no console.
 *
 * Uso:
 *   DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy \
 *     node app/scripts/test-dfs-keywords-for-site.mjs
 *
 * Custo: ~US$ 0.012 (1 task).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
if (!LOGIN || !PASSWORD) {
  console.error('❌ Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD');
  process.exit(1);
}

const TARGET = 'drapaulafranzon.com.br';
const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');
const OUT = 'exports/dfs-test';
mkdirSync(OUT, { recursive: true });

console.log(`🔍 keywords_for_site → ${TARGET} (Brasil, PT)\n`);

const t0 = Date.now();
const res = await fetch(
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live',
  {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        target: TARGET,
        location_name: 'Brazil',
        language_name: 'Portuguese',
        limit: 200,
        filters: [['keyword_info.search_volume', '>=', 1]],
        order_by: ['keyword_info.search_volume,desc'],
        include_serp_info: true,
      },
    ]),
  },
);
const elapsed = Date.now() - t0;
const data = await res.json();

const file = join(OUT, 'dra-paula-keywords-for-site.json');
writeFileSync(file, JSON.stringify(data, null, 2));

const task = data.tasks?.[0];
const result = task?.result?.[0];
const items = result?.items ?? [];

console.log(
  `HTTP=${res.status} status_code=${data.status_code} task_status=${task?.status_code} cost=$${(data.cost ?? 0).toFixed(4)} (${elapsed}ms)`,
);
console.log(`Total items: ${result?.total_count ?? items.length}`);
console.log(`Salvo em: ${file}\n`);

if (items.length === 0) {
  console.log('⚠️  Zero keywords. Possíveis causas:');
  console.log('   - Site recém-lançado / sem indexação ainda');
  console.log('   - Domínio sem ranqueamento orgânico (só direct/social)');
  console.log('   - DataForSEO não tem dados desse domínio (low traffic threshold)');
  console.log(`   - Task error: ${task?.status_message ?? 'n/a'}`);
  process.exit(0);
}

// ─────── Top keywords por volume ───────
console.log(`\n📊 TOP 20 keywords por volume mensal:\n`);
console.log(
  'pos'.padEnd(5) +
    'vol/mês'.padEnd(10) +
    'cpc'.padEnd(8) +
    'kd'.padEnd(5) +
    'intent'.padEnd(15) +
    'keyword',
);
console.log('-'.repeat(110));

const topByVolume = [...items]
  .sort(
    (a, b) =>
      (b.keyword_info?.search_volume ?? 0) - (a.keyword_info?.search_volume ?? 0),
  )
  .slice(0, 20);

for (const it of topByVolume) {
  const ki = it.keyword_info ?? {};
  const props = it.keyword_properties ?? {};
  const intent = it.search_intent_info?.main_intent ?? '?';
  const pos = it.ranked_serp_element?.serp_item?.rank_absolute ?? '–';
  const vol = ki.search_volume ?? 0;
  const cpc = ki.cpc != null ? `$${ki.cpc.toFixed(2)}` : '–';
  const diff = props.keyword_difficulty != null ? props.keyword_difficulty : '–';
  console.log(
    String(pos).padEnd(5) +
      String(vol).padEnd(10) +
      String(cpc).padEnd(8) +
      String(diff).padEnd(5) +
      String(intent).padEnd(15) +
      it.keyword,
  );
}

// ─────── Sumário agregado ───────
const totalVolume = items.reduce(
  (s, it) => s + (it.keyword_info?.search_volume ?? 0),
  0,
);
const intents = {};
const positions = { '1-3': 0, '4-10': 0, '11-30': 0, '31-100': 0, 'sem_pos': 0 };
let totalEstTraffic = 0;
for (const it of items) {
  const intent = it.search_intent_info?.main_intent ?? '?';
  intents[intent] = (intents[intent] ?? 0) + 1;
  const pos = it.ranked_serp_element?.serp_item?.rank_absolute;
  if (pos == null) positions['sem_pos']++;
  else if (pos <= 3) positions['1-3']++;
  else if (pos <= 10) positions['4-10']++;
  else if (pos <= 30) positions['11-30']++;
  else positions['31-100']++;
  totalEstTraffic += it.ranked_serp_element?.serp_item?.etv ?? 0;
}

console.log(`\n📈 Agregado (todas ${items.length} keywords):`);
console.log(`   Volume total mensal somado: ${totalVolume.toLocaleString('pt-BR')}`);
console.log(`   Tráfego orgânico estimado:  ${Math.round(totalEstTraffic).toLocaleString('pt-BR')} clicks/mês`);
console.log(`   Distribuição por posição:`);
for (const [bucket, count] of Object.entries(positions)) {
  console.log(`     ${bucket.padEnd(8)} → ${count}`);
}
console.log(`   Distribuição por intent:`);
for (const [intent, count] of Object.entries(intents)) {
  console.log(`     ${intent.padEnd(15)} → ${count}`);
}

// ─────── Brand vs non-brand ───────
const brandTerms = ['paula franzon', 'dra paula', 'drapaula', 'franzon'];
const branded = items.filter((it) =>
  brandTerms.some((b) => (it.keyword ?? '').toLowerCase().includes(b)),
);
const nonBranded = items.filter(
  (it) => !brandTerms.some((b) => (it.keyword ?? '').toLowerCase().includes(b)),
);
console.log(`\n🏷️  Brand vs não-brand:`);
console.log(`   Brand   (${branded.length}): ${branded.slice(0, 5).map((i) => i.keyword).join(' | ')}`);
console.log(`   Não-brand (${nonBranded.length}): ${nonBranded.slice(0, 5).map((i) => i.keyword).join(' | ')}`);
