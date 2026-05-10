#!/usr/bin/env node
/**
 * Comprehensive DataForSEO research pra design de 3 features Singulare.
 *
 * Cenário: Dra. Paula Franzon, Reumatologia, Jundiaí/SP. Usado pra validar
 * com dados reais antes de virar produto.
 *
 * Outputs em exports/dfs-test/research/<endpoint>.json + sumário no console.
 *
 * Uso:
 *   DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy \
 *     node scripts/test-dfs-product-research.mjs
 *
 * Custo estimado: ~US$ 0.15 (8 chamadas mistas)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
if (!LOGIN || !PASSWORD) {
  console.error('❌ Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD');
  process.exit(1);
}

const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');
const OUT = 'exports/dfs-test/research';
mkdirSync(OUT, { recursive: true });

// Cenário fixo — Paula em SP. Pra outras especialidades, troque aqui.
const SCENARIO = {
  city: 'Jundiaí',
  state_full: 'São Paulo,Brazil',
  country: 'Brazil',
  language: 'Portuguese',
  doctor_name: 'Paula Franzon',
  specialty: 'reumatologia',
  // Keywords que provavelmente trazem paciente da Paula
  hot_keywords: [
    'reumatologista jundiaí',
    'reumatologista são paulo',
    'fibromialgia tratamento',
    'artrite reumatoide',
    'dor nas articulações',
    'lupus sintomas',
    'reumatologista perto de mim',
    'consulta reumatologista valor',
  ],
  // Concorrentes/agregadores grandes na saúde
  aggregators: [
    'doctoralia.com.br',
    'agendamentoemmedicos.com.br',
    'consultaclick.com.br',
  ],
};

let totalCost = 0;
const summary = [];

async function dfs(path, body, label) {
  const t0 = Date.now();
  const res = await fetch(`https://api.dataforseo.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const elapsed = Date.now() - t0;
  const cost = data.cost ?? 0;
  totalCost += cost;
  const file = join(OUT, `${label}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  const task = data.tasks?.[0];
  const items = task?.result?.[0]?.items ?? task?.result?.[0]?.keywords ?? task?.result ?? [];
  console.log(
    `  ${label.padEnd(40)} HTTP=${res.status} sc=${data.status_code} task=${task?.status_code} items=${
      Array.isArray(items) ? items.length : '?'
    } cost=$${cost.toFixed(4)} (${elapsed}ms)`,
  );
  summary.push({ label, status: data.status_code, task_status: task?.status_code, items: Array.isArray(items) ? items.length : null, cost });
  return { data, items, task };
}

async function dfsGet(path, label) {
  const t0 = Date.now();
  const res = await fetch(`https://api.dataforseo.com${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  const elapsed = Date.now() - t0;
  const cost = data.cost ?? 0;
  totalCost += cost;
  const file = join(OUT, `${label}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  const items = data.tasks?.[0]?.result ?? [];
  console.log(
    `  ${label.padEnd(40)} HTTP=${res.status} items=${items.length} cost=$${cost.toFixed(4)} (${elapsed}ms)`,
  );
  summary.push({ label, status: data.status_code, items: items.length, cost });
  return { data, items };
}

console.log('🧪 DataForSEO Product Research — Singulare\n');
console.log(`Cenário: ${SCENARIO.specialty} em ${SCENARIO.city}/SP, médica: ${SCENARIO.doctor_name}\n`);

// ─── FEATURE C: Trends/categories pra filtrar nicho saúde ───────
console.log('\n📂 [Feature C] trends/categories — categorias Google (grátis)');
const cats = await dfsGet('/v3/dataforseo_trends/categories', 'C1-categories');
const healthCats = (cats.items[0]?.children ?? cats.items)
  .filter ? (cats.items[0]?.children ?? cats.items).filter((c) => /sa[uú]de|health|medic|wellness/i.test(c.name ?? '')) : [];
if (healthCats.length) console.log('   Healthcare categories:', healthCats.slice(0, 5).map((c) => `${c.id || c.category_id}=${c.name || c.category_name}`).join(' | '));

// ─── FEATURE A: keyword_overview pras 3 top keywords da Paula ───
console.log('\n🔍 [Feature A] keyword_overview — análise rica de keyword');
const ko = await dfs('/v3/dataforseo_labs/google/keyword_overview/live', [
  {
    keywords: SCENARIO.hot_keywords.slice(0, 5),
    location_name: SCENARIO.country,
    language_name: SCENARIO.language,
    include_serp_info: true,
    include_clickstream_data: true,
  },
], 'A1-keyword-overview');

// ─── FEATURE B: ranked_keywords pra cada agregador (filtro implícito por país) ─
console.log('\n🎯 [Feature B] ranked_keywords — espionagem dos agregadores');
for (let i = 0; i < SCENARIO.aggregators.length; i++) {
  const target = SCENARIO.aggregators[i];
  const r = await dfs(
    '/v3/dataforseo_labs/google/ranked_keywords/live',
    [
      {
        target,
        location_name: SCENARIO.country,
        language_name: SCENARIO.language,
        limit: 200,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
        // Filtra só keywords da especialidade da Paula pra ver o quanto desse
        // tráfego é "roubável" pela clínica da Paula
        filters: [
          ['keyword_data.keyword',  'like_or', `%${SCENARIO.specialty}%`],
        ],
      },
    ],
    `B${i + 1}-ranked-${target.replace(/\./g, '-')}`,
  );
}

// ─── FEATURE B (variação): ranked_keywords filtrado por cidade ──
console.log('\n🌆 [Feature B+] ranked_keywords filtrado por cidade da Paula');
const localR = await dfs(
  '/v3/dataforseo_labs/google/ranked_keywords/live',
  [
    {
      target: SCENARIO.aggregators[0], // Doctoralia
      location_name: SCENARIO.country,
      language_name: SCENARIO.language,
      limit: 100,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
      filters: [
        ['keyword_data.keyword', 'like', `%${SCENARIO.city.toLowerCase()}%`],
      ],
    },
  ],
  'B4-doctoralia-jundiai',
);

// ─── FEATURE C: related_keywords pra brand do médico ────────────
console.log('\n🌱 [Feature C] related_keywords — variações que paciente usa');
const rel = await dfs('/v3/dataforseo_labs/google/related_keywords/live', [
  {
    keyword: SCENARIO.doctor_name.toLowerCase(),
    location_name: SCENARIO.country,
    language_name: SCENARIO.language,
    limit: 50,
    depth: 2,
  },
], 'C2-related-brand');

// ─── FEATURE C: historical_keyword_data pra sazonalidade ────────
console.log('\n📈 [Feature C] historical_keyword_data — sazonalidade longa');
const hist = await dfs('/v3/dataforseo_labs/google/historical_keyword_data/live', [
  {
    keywords: ['reumatologista', 'fibromialgia', 'lupus'],
    location_name: SCENARIO.country,
    language_name: SCENARIO.language,
  },
], 'C3-historical');

// ─── BÔNUS: clickstream pra alternar Google Ads bloqueado ───────
console.log('\n💰 [Bônus] clickstream/bulk_search_volume — alternativa pro Google Ads');
const cs = await dfs('/v3/clickstream_data/bulk_search_volume/live', [
  {
    keywords: SCENARIO.hot_keywords,
    location_name: SCENARIO.country,
    language_name: SCENARIO.language,
  },
], 'D1-clickstream');

// ─── SUMÁRIO ────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`💵 Custo total: $${totalCost.toFixed(4)}`);
console.log(`📁 Saída: ${OUT}/`);
console.log('═══════════════════════════════════════════════════════════════');

writeFileSync(join(OUT, '_summary.json'), JSON.stringify({ scenario: SCENARIO, totalCost, runs: summary, ranAt: new Date().toISOString() }, null, 2));

console.log('\nPróximo passo: revisar os JSONs e decidir quais features vão pra dev.');
