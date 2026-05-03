// app/scripts/import-cid10.ts
//
// Downloads CID-10 subcategories CSV from DataSUS (via GitHub mirror),
// parses it, and bulk-inserts into lookup_cid10 table.
//
// Usage: cd app && npx tsx scripts/import-cid10.ts
//
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// SQL source: CID-10 subcategories from lucasrafagnin/CID10-SQL
const SQL_URL =
  'https://raw.githubusercontent.com/lucasrafagnin/CID10-SQL/master/subcategoria.sql';

// CID chapters by first letter range
function getChapter(code: string): string {
  const chapters: [string, string, string][] = [
    ['A00', 'B99', 'I'],   ['C00', 'D48', 'II'],  ['D50', 'D89', 'III'],
    ['E00', 'E90', 'IV'],  ['F00', 'F99', 'V'],   ['G00', 'G99', 'VI'],
    ['H00', 'H59', 'VII'], ['H60', 'H95', 'VIII'],['I00', 'I99', 'IX'],
    ['J00', 'J99', 'X'],   ['K00', 'K93', 'XI'],  ['L00', 'L99', 'XII'],
    ['M00', 'M99', 'XIII'],['N00', 'N99', 'XIV'],  ['O00', 'O99', 'XV'],
    ['P00', 'P96', 'XVI'], ['Q00', 'Q99', 'XVII'], ['R00', 'R99', 'XVIII'],
    ['S00', 'T98', 'XIX'], ['V01', 'Y98', 'XX'],   ['Z00', 'Z99', 'XXI'],
    ['U00', 'U99', 'XXII'],
  ];
  const cat = code.replace('.', '').substring(0, 3);
  for (const [start, end, ch] of chapters) {
    if (cat >= start && cat <= end) return ch;
  }
  return '';
}

// Format code: 'A000' → 'A00.0'
function formatCode(raw: string): string {
  if (raw.length === 4) {
    return `${raw.substring(0, 3)}.${raw.substring(3)}`;
  }
  return raw;
}

async function main() {
  console.log('Downloading CID-10 SQL from GitHub...');
  const res = await fetch(SQL_URL);
  if (!res.ok) {
    console.error(`Failed to download: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.includes('VALUES'));
  console.log(`Parsed ${lines.length} CID-10 subcategories`);

  // Parse SQL INSERT statements
  const records: Array<{
    code: string;
    name: string;
    name_short: string | null;
    chapter: string;
  }> = [];

  const regex = /VALUES \('([^']+)','([^']*)'\)/;
  for (const line of lines) {
    const m = line.match(regex);
    if (!m) continue;

    const code = formatCode(m[1].trim());
    records.push({
      code,
      name: m[2].trim(),
      name_short: null,
      chapter: getChapter(code),
    });
  }

  console.log(`Inserting ${records.length} records into lookup_cid10...`);

  // Batch insert in chunks of 500
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('lookup_cid10')
      .upsert(batch, { onConflict: 'code', ignoreDuplicates: true });

    if (error) {
      console.error(`Error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
      console.log(`  ${inserted}/${records.length}`);
    }
  }

  console.log(`Done! ${inserted} CID-10 codes imported.`);

  // Verify
  const { count } = await supabase
    .from('lookup_cid10')
    .select('*', { count: 'exact', head: true });
  console.log(`Total rows in lookup_cid10: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
