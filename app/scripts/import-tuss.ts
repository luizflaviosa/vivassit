// app/scripts/import-tuss.ts
//
// Fetches TUSS table 22 (procedures) JSON from GitHub charlesfgarcia/tabelas-ans
// and bulk-inserts into lookup_tuss table.
//
// Usage: cd app && npx tsx scripts/import-tuss.ts
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

// TUSS table 22 JSON from charlesfgarcia/tabelas-ans (master branch)
const TABLES_TO_IMPORT = [
  {
    tableNumber: 22,
    url: 'https://raw.githubusercontent.com/charlesfgarcia/tabelas-ans/master/TUSS/tabela%2022/tabela_22.json',
    label: 'Procedimentos e eventos em saúde',
  },
];

interface TUSSJsonEntry {
  codigo: number | string;
  procedimento?: string;
  termo?: string;
  dt_inicio_vigencia?: string;
  dt_fim_vigencia?: string | null;
  dt_implantacao?: string;
}

async function importTable(tableNumber: number, url: string, label: string) {
  console.log(`\nImporting TUSS Table ${tableNumber}: ${label}`);
  console.log(`  URL: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  Failed to download: ${res.status} ${res.statusText}`);
    return 0;
  }

  const raw = await res.json();
  // Handle both array format and {table, rows} wrapper format
  const entries: TUSSJsonEntry[] = Array.isArray(raw) ? raw : raw.rows ?? [];
  console.log(`  Parsed ${entries.length} entries`);

  const records = entries.map((e) => ({
    code: String(e.codigo),
    name: e.procedimento ?? e.termo ?? '',
    table_number: tableNumber,
    valid_from: e.dt_inicio_vigencia || null,
    valid_until: e.dt_fim_vigencia || null,
  }));

  // Batch insert in chunks of 500
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('lookup_tuss')
      .upsert(batch, { onConflict: 'code', ignoreDuplicates: true });

    if (error) {
      console.error(`  Error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  Inserted ${inserted} records`);
  return inserted;
}

async function main() {
  let total = 0;

  for (const t of TABLES_TO_IMPORT) {
    total += await importTable(t.tableNumber, t.url, t.label);
  }

  console.log(`\nDone! ${total} TUSS codes imported.`);

  // Verify
  const { count } = await supabase
    .from('lookup_tuss')
    .select('*', { count: 'exact', head: true });
  console.log(`Total rows in lookup_tuss: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
