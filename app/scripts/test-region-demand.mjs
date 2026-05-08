#!/usr/bin/env node
// Teste real DataForSEO — Dra. Paula Franzon, reumatologia, Jundiaí.
// Uso:  DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=yyy node scripts/test-region-demand.mjs

import { writeFileSync } from 'node:fs';

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error('❌ Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD');
  process.exit(1);
}

// ── Keyword strategy ──────────────────────────────────────────────────────────
// Bucket 1: intenção LOCAL (paciente buscando profissional na região)
const localIntent = [
  'reumatologista jundiai',
  'reumatologista jundiaí',
  'reumatologista em jundiai',
  'medico reumatologista jundiai',
  'médico reumatologista jundiai',
  'melhor reumatologista jundiai',
  'reumatologista particular jundiai',
  'reumatologista convenio jundiai',
  'clinica de reumatologia jundiai',
  'consulta reumatologista jundiai',
  'reumatologia jundiai',
];

// Bucket 2: sintomas/condições + cidade (paciente buscando solução, não profissional)
const symptomLocal = [
  'artrite jundiai',
  'fibromialgia jundiai',
  'dor nas articulações jundiai',
  'lupus jundiai',
];

// Bucket 3: nacional/genérico (referência de mercado total)
const generic = [
  'reumatologista',
  'reumatologia',
  'artrite reumatoide',
  'fibromialgia',
  'artrose',
  'lupus',
];

// Bucket 4: marca pessoal (saber se já tem demanda pelo nome)
const brand = [
  'dra paula franzon',
  'paula franzon reumatologista',
  'paula franzon jundiai',
];

const allKeywords = [...localIntent, ...symptomLocal, ...generic, ...brand];

// ── Call DataForSEO ───────────────────────────────────────────────────────────
const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');

async function searchVolume(keywords, locationName) {
  const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      keywords,
      location_name: locationName,
      language_code: 'pt',
      search_partners: false,
    }]),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.status_code !== 20000) throw new Error(`DFS ${data.status_code}: ${data.status_message}`);
  return data.tasks?.[0]?.result ?? [];
}

const fmt = (n) => n == null ? '—' : n.toLocaleString('pt-BR');
const fmtCpc = (n) => n == null ? '—' : `R$ ${Number(n).toFixed(2)}`;
const fmtComp = (lvl) => lvl ?? '—';

console.log('🔍 Consultando DataForSEO — Jundiaí, SP...\n');

// Run em duas localizações: Jundiaí (mercado real) e Brasil (referência)
const [jundiai, brasil] = await Promise.all([
  searchVolume(allKeywords, 'Jundiaí,São Paulo,Brazil'),
  searchVolume(generic, 'Brazil'),
]);

const sortByVol = (arr) => [...arr].sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0));

// ── Output ────────────────────────────────────────────────────────────────────
const groupBy = (arr, names) => arr.filter(k => names.includes(k.keyword));

const localResults = sortByVol(groupBy(jundiai, localIntent));
const symptomResults = sortByVol(groupBy(jundiai, symptomLocal));
const genericInJundiai = sortByVol(groupBy(jundiai, generic));
const brandResults = sortByVol(groupBy(jundiai, brand));
const brasilResults = sortByVol(brasil);

const totalLocalIntent = localResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);
const totalSymptom = symptomResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);

const printRow = (k) => {
  const vol = String(fmt(k.search_volume)).padStart(7);
  const cpc = String(fmtCpc(k.cpc)).padStart(9);
  const comp = String(fmtComp(k.competition_level)).padStart(7);
  console.log(`  ${vol}  ${cpc}  ${comp}  ${k.keyword}`);
};

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Volume   CPC      Concor.  Keyword');
console.log('═══════════════════════════════════════════════════════════════════');

console.log('\n📍 INTENÇÃO LOCAL (Jundiaí) — paciente procurando profissional:');
localResults.forEach(printRow);
console.log(`  ─────── total intenção local: ${fmt(totalLocalIntent)} buscas/mês`);

console.log('\n🩺 SINTOMAS + CIDADE (Jundiaí):');
symptomResults.forEach(printRow);
console.log(`  ─────── total sintomas locais: ${fmt(totalSymptom)} buscas/mês`);

console.log('\n📈 GENÉRICOS (em Jundiaí):');
genericInJundiai.forEach(printRow);

console.log('\n🇧🇷 GENÉRICOS (BRASIL inteiro — referência de mercado):');
brasilResults.forEach(printRow);

console.log('\n👤 MARCA PESSOAL (Dra. Paula Franzon):');
brandResults.forEach(printRow);

// ── Análise consolidada ───────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  RESUMO ESTRATÉGICO');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`  Mercado local addressable (Jundiaí):  ${fmt(totalLocalIntent + totalSymptom)} buscas/mês`);
console.log(`     ├─ procurando reumatologista:      ${fmt(totalLocalIntent)}`);
console.log(`     └─ procurando solução de sintoma:  ${fmt(totalSymptom)}`);

const avgCpcLocal = localResults
  .filter(k => k.cpc != null)
  .reduce((s, k, _, a) => s + Number(k.cpc) / a.length, 0);
console.log(`  CPC médio (Jundiaí, intenção local):  R$ ${avgCpcLocal.toFixed(2)}`);

const totalGenericBR = brasilResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);
console.log(`  Mercado nacional referência:          ${fmt(totalGenericBR)} buscas/mês`);

// Salva JSON completo
const out = {
  collected_at: new Date().toISOString(),
  location: 'Jundiaí, São Paulo, Brazil',
  buckets: {
    local_intent: localResults,
    symptom_local: symptomResults,
    generic_in_jundiai: genericInJundiai,
    brand: brandResults,
    generic_brazil: brasilResults,
  },
  summary: {
    total_local_intent: totalLocalIntent,
    total_symptom_local: totalSymptom,
    total_addressable: totalLocalIntent + totalSymptom,
    avg_cpc_local: avgCpcLocal,
    total_generic_brazil: totalGenericBR,
  },
};
writeFileSync('region-demand-result.json', JSON.stringify(out, null, 2));
console.log(`\n✅ JSON completo salvo em: ${process.cwd()}/region-demand-result.json`);
