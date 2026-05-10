#!/usr/bin/env node
/**
 * Teste DataForSEO — explora endpoints novos com DADOS REAIS antes de virar
 * feature em produção. Bate em ~6 endpoints estratégicos e salva payload bruto
 * em exports/dfs-test/<endpoint>.json pra inspeção.
 *
 * Cenário: clínica Singulare em Jundiaí, Dra. Paula Franzon, Reumatologia.
 *
 * Uso:
 *   DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy \
 *     node app/scripts/test-dataforseo-fields.mjs
 *
 * Custo total estimado: ~US$ 0.027
 *   - merged_data:        $0.002
 *   - locations:          $0.000 (grátis)
 *   - categories:         $0.000 (grátis)
 *   - bulk_search_volume: $0.001 (8 kws)
 *   - keyword_overview:   $0.012 (1 kw rica)
 *   - keywords_for_site:  $0.012 (1 concorrente)
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
const OUT = 'exports/dfs-test';
mkdirSync(OUT, { recursive: true });

const SCENARIO = {
  city: 'São Paulo,Sao Paulo,Brazil', // location_name oficial DFS
  state: 'São Paulo,Brazil',
  country: 'Brazil',
  specialty_keywords: [
    'reumatologista jundiaí',
    'fibromialgia tratamento',
    'artrite reumatoide',
    'lupus sintomas',
    'dor articular crônica',
    'doença autoimune',
    'paula franzon reumatologista',
    'reumatologista perto de mim',
  ],
  brand_keyword: 'paula franzon',
  competitor_site: 'doctoralia.com.br', // alvo grande pra ter dados ricos
};

async function dfs(path, body) {
  const url = `https://api.dataforseo.com${path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const elapsed = Date.now() - t0;
  return { ok: res.ok, status: res.status, data, elapsed_ms: elapsed };
}

async function dfsGet(path) {
  const url = `https://api.dataforseo.com${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

function save(name, payload) {
  const file = join(OUT, `${name}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function summarize(name, result) {
  const sc = result.data?.status_code;
  const tasks = result.data?.tasks ?? [];
  const t0 = tasks[0];
  const tsc = t0?.status_code;
  const items = t0?.result?.[0]?.items ?? t0?.result?.[0]?.keywords ?? t0?.result ?? [];
  const cost = result.data?.cost ?? 0;
  const file = save(name, result.data);
  console.log(
    `  ✓ ${name.padEnd(30)} HTTP=${result.status} sc=${sc} task_sc=${tsc} items=${
      Array.isArray(items) ? items.length : 'n/a'
    } cost=$${cost.toFixed(4)} (${result.elapsed_ms}ms) → ${file}`,
  );
  return { sc, tsc, items, cost, file };
}

// ─────────────────────────────────────────────────────────
// 1. trends/merged_data — combina explore + subregion + demography
// ─────────────────────────────────────────────────────────
async function testMergedData() {
  console.log('\n[1] trends/merged_data/live — combina 3 calls em 1');
  const r = await dfs('/v3/dataforseo_trends/merged_data/live', [
    {
      keywords: ['reumatologista', 'fibromialgia', 'artrite reumatoide'],
      location_name: SCENARIO.country,
      time_range: 'past_12_months',
      type: 'web',
    },
  ]);
  return summarize('1-trends-merged-data', r);
}

// ─────────────────────────────────────────────────────────
// 2. trends/locations — lista geo válida (grátis)
// ─────────────────────────────────────────────────────────
async function testLocations() {
  console.log('\n[2] trends/locations — lista oficial Brasil (grátis)');
  // /locations retorna todas globais. Pode ser GET ou POST.
  const r = await dfsGet('/v3/dataforseo_trends/locations');
  const total = r.data?.tasks?.[0]?.result?.length ?? 0;
  // Filtra só Brasil pra preview
  const brOnly = (r.data?.tasks?.[0]?.result ?? []).filter(
    (l) => l.country_iso_code === 'BR' || l.location_name?.includes('Brazil'),
  );
  save('2-trends-locations-br-only', brOnly);
  console.log(
    `  ✓ trends/locations              total=${total} brasileiras=${brOnly.length} → 2-trends-locations-br-only.json`,
  );
  console.log('    sample BR:', brOnly.slice(0, 5).map((l) => l.location_name).join(' | '));
  return { items: brOnly };
}

// ─────────────────────────────────────────────────────────
// 3. trends/categories — categorias Google (grátis)
// ─────────────────────────────────────────────────────────
async function testCategories() {
  console.log('\n[3] trends/categories — categorias Google (grátis)');
  const r = await dfsGet('/v3/dataforseo_trends/categories');
  const all = r.data?.tasks?.[0]?.result ?? [];
  const healthOnly = all.filter(
    (c) =>
      c.category_name?.match(/health|medic|wellness|saúde|saude/i) ||
      c.parent_category_name?.match(/health|medic|wellness|saúde/i),
  );
  save('3-trends-categories-health', healthOnly);
  console.log(
    `  ✓ trends/categories             total=${all.length} health-related=${healthOnly.length} → 3-trends-categories-health.json`,
  );
  console.log('    sample:', healthOnly.slice(0, 8).map((c) => `${c.category_id}=${c.category_name}`).join(' | '));
  return { items: healthOnly };
}

// ─────────────────────────────────────────────────────────
// 4. clickstream_data/bulk_search_volume — alternativa Google Ads
// ─────────────────────────────────────────────────────────
async function testClickstream() {
  console.log('\n[4] clickstream_data/bulk_search_volume/live — volume sem Google Ads');
  const r = await dfs('/v3/clickstream_data/bulk_search_volume/live', [
    {
      keywords: SCENARIO.specialty_keywords,
      location_name: SCENARIO.country,
      language_name: 'Portuguese',
    },
  ]);
  return summarize('4-clickstream-bulk-volume', r);
}

// ─────────────────────────────────────────────────────────
// 5. labs/keyword_overview — 1-call que faz tudo
// ─────────────────────────────────────────────────────────
async function testKeywordOverview() {
  console.log('\n[5] labs/google/keyword_overview/live — 1-call rico (volume+intent+SERP+backlinks)');
  const r = await dfs('/v3/dataforseo_labs/google/keyword_overview/live', [
    {
      keywords: ['reumatologista jundiaí'],
      location_name: SCENARIO.country,
      language_name: 'Portuguese',
      include_serp_info: true,
      include_clickstream_data: true,
    },
  ]);
  return summarize('5-labs-keyword-overview', r);
}

// ─────────────────────────────────────────────────────────
// 6. labs/keywords_for_site — espionagem de concorrente
// ─────────────────────────────────────────────────────────
async function testKeywordsForSite() {
  console.log('\n[6] labs/google/keywords_for_site/live — espionar concorrente');
  const r = await dfs('/v3/dataforseo_labs/google/keywords_for_site/live', [
    {
      target: SCENARIO.competitor_site,
      location_name: SCENARIO.country,
      language_name: 'Portuguese',
      limit: 30,
      filters: [['keyword_data.search_volume', '>', 10]],
      order_by: ['keyword_data.search_volume,desc'],
    },
  ]);
  return summarize('6-labs-keywords-for-site', r);
}

// ─────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────
const results = {};
console.log('🧪 Teste DataForSEO — Singulare/Reumatologia\n');
console.log(`Scenario: ${SCENARIO.country} | Médica: Paula Franzon | Concorrente: ${SCENARIO.competitor_site}`);

try {
  results.merged = await testMergedData();
  results.locations = await testLocations();
  results.categories = await testCategories();
  results.clickstream = await testClickstream();
  results.keyword_overview = await testKeywordOverview();
  results.keywords_for_site = await testKeywordsForSite();
} catch (e) {
  console.error('\n❌ Falha:', e.message);
  process.exit(1);
}

console.log('\n✅ Concluído. Inspecione os JSONs em exports/dfs-test/');
console.log('   Arquivos pequenos abrem direto no editor. Os grandes (locations) usam jq pra filtrar.');
