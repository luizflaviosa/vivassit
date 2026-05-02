# Documentos Médicos MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working medical document generator (Aptidão Física) with CID-10/TUSS lookup, clinical data storage, PDF generation, and 3-profile workflow (self-service / backoffice Singulare / backoffice clínica) — without BirdID digital signature (Phase 2).

**Architecture:** Deterministic form-based workflow in 4 stages (Coleta → Montagem → Assinatura → Entrega). MVP covers Montagem + Entrega for one document type (Aptidão Física). Lookup tables (CID-10, TUSS) imported from open-source repos. All API routes follow existing `requireTenant()` pattern. PDF generated server-side via `@react-pdf/renderer`. Status machine: draft → pending → signed → sent.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage), `@react-pdf/renderer` for PDF, TypeScript, Tailwind CSS, Framer Motion, Lucide icons.

---

## File Structure

### New files to create:

```
# SQL migration
scripts/docs-schema.sql                                 — All tables: lookups, clinical data, documents

# Import scripts (run once via tsx)
app/scripts/import-cid10.ts                             — Download CSV from DataSUS, parse, bulk insert
app/scripts/import-tuss.ts                              — Fetch JSON from GitHub tabelas-ans, bulk insert

# Shared types and queries
app/lib/docs-types.ts                                   — Document types, status, form schemas
app/lib/docs-queries.ts                                 — Supabase queries for documents module

# Lookup API routes (public, no auth — regulated data)
app/app/api/lookup/cid10/route.ts                       — Full-text search CID-10
app/app/api/lookup/tuss/route.ts                        — Full-text search TUSS

# Clinical data API (painel, requireTenant)
app/app/api/painel/pacientes/[id]/clinical/route.ts     — GET + PATCH patient clinical data

# Documents CRUD API (painel, requireTenant)
app/app/api/painel/docs/route.ts                        — POST (create) + GET (list)
app/app/api/painel/docs/[id]/route.ts                   — GET (detail) + PATCH (edit) + DELETE (cancel)
app/app/api/painel/docs/[id]/submit/route.ts            — POST: draft → pending
app/app/api/painel/docs/[id]/sign/route.ts              — POST: pending → signed (MVP: no BirdID, just marks signed)
app/app/api/painel/docs/[id]/send/route.ts              — POST: signed → sent

# PDF generation
app/lib/pdf/aptidao-fisica.tsx                          — React PDF template for Aptidão Física

# Painel pages
app/app/painel/docs/page.tsx                            — Document list with status filters
app/app/painel/docs/novo/page.tsx                       — New document wizard (select type → patient → form)
app/app/painel/docs/[id]/page.tsx                       — Document detail + preview + actions
```

### Existing files to modify:

```
app/app/painel/layout.tsx:78-96                         — Add "Documentos" nav item (enabled: true)
app/lib/types.ts                                        — Add doc-related types to exports (re-export)
```

---

## Task 1: Database Schema — Lookup Tables + Clinical Data + Documents

**Files:**
- Create: `scripts/docs-schema.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- scripts/docs-schema.sql
-- Medical documents module: lookup tables, clinical data, documents.
-- Execute in Supabase SQL Editor (Dashboard → SQL Editor → New query).

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. LOOKUP TABLES (imported from DataSUS/ANS, read-only, no RLS)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lookup_cid10 (
  code        text PRIMARY KEY,          -- 'A00.0' (with dot)
  name        text NOT NULL,             -- 'Cólera devida a Vibrio cholerae 01...'
  name_short  text,                      -- abbreviated version
  chapter     text                       -- 'I', 'II', ..., 'XXII'
);

CREATE INDEX IF NOT EXISTS idx_cid10_search
  ON public.lookup_cid10
  USING gin(to_tsvector('portuguese', code || ' ' || name));

CREATE TABLE IF NOT EXISTS public.lookup_tuss (
  code          text PRIMARY KEY,        -- '10101012'
  name          text NOT NULL,           -- 'Consulta em consultório...'
  table_number  int,                     -- 22 = procedimentos
  valid_from    date,
  valid_until   date                     -- null = currently active
);

CREATE INDEX IF NOT EXISTS idx_tuss_search
  ON public.lookup_tuss
  USING gin(to_tsvector('portuguese', code || ' ' || name));

-- ═══════════════════════════════════════════════════════════════
-- 2. PATIENT CLINICAL DATA (multi-tenant, RLS enabled)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.patient_clinical_data (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id             uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  patient_id            bigint NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,

  -- Personal data (complementary to patients table)
  cpf                   text,
  cns                   text,                -- Cartão Nacional de Saúde
  mother_name           text,
  address               text,

  -- Anthropometric data
  weight_kg             numeric(5,1),
  height_cm             numeric(5,1),
  blood_type            text CHECK (blood_type IS NULL OR blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies             text[],

  -- Insurance
  insurance_provider    text,
  insurance_card_number text,

  -- Clinical condition
  primary_cid           text REFERENCES public.lookup_cid10(code),
  conditions            jsonb DEFAULT '[]',  -- [{cid, description, since, status}]
  medications           jsonb DEFAULT '[]',  -- [{name, dosage, frequency, since}]

  -- Traceability
  collected_by          text DEFAULT 'manual' CHECK (collected_by IN ('agent','manual','form')),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, patient_id)
);

ALTER TABLE public.patient_clinical_data ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clinical_lookup
  ON public.patient_clinical_data(tenant_id, patient_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. MEDICAL DOCUMENTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.medical_documents (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id           uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  patient_id          bigint NOT NULL REFERENCES public.patients(id),
  doctor_id           bigint REFERENCES public.tenant_doctors(id),

  -- Who did what
  created_by_user     uuid REFERENCES auth.users(id),
  signed_by_user      uuid REFERENCES auth.users(id),

  -- Type and status
  doc_type            text NOT NULL CHECK (doc_type IN (
    'aptidao_fisica',
    'tiss_guia',
    'afastamento_inss',
    'lme_alto_custo',
    'vacina_prioritaria'
  )),
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending',
    'signed',
    'rejected',
    'sent',
    'cancelled'
  )),

  -- Content (deterministic snapshot of all form fields)
  form_data           jsonb NOT NULL,

  -- Rejection
  rejection_note      text,

  -- PDF (Supabase Storage)
  pdf_url             text,
  signed_pdf_url      text,
  signed_at           timestamptz,

  -- Timestamps
  submitted_at        timestamptz,
  sent_to_patient_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_docs_tenant
  ON public.medical_documents(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_pending
  ON public.medical_documents(doctor_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_docs_patient
  ON public.medical_documents(patient_id, doc_type);

-- ═══════════════════════════════════════════════════════════════
-- 4. ALTER EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════

-- tenants: CNES (establishment number)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnes text;

COMMIT;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open Supabase Dashboard → SQL Editor → New query. Paste the SQL above. Execute.

Verify tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('lookup_cid10', 'lookup_tuss', 'patient_clinical_data', 'medical_documents');
```

Expected: 4 rows returned.

- [ ] **Step 3: Commit**

```bash
git add scripts/docs-schema.sql
git commit -m "feat(docs): add schema for lookup tables, clinical data, medical documents"
```

---

## Task 2: Shared Types — Document Module

**Files:**
- Create: `app/lib/docs-types.ts`

- [ ] **Step 1: Create document types file**

```typescript
// app/lib/docs-types.ts

// ──────────────────────────────────────────────────────────────
// Document types and statuses
// ──────────────────────────────────────────────────────────────

export const DOC_TYPES = {
  aptidao_fisica: 'Atestado de Aptidão Física',
  tiss_guia: 'Guia TISS',
  afastamento_inss: 'Relatório Afastamento INSS',
  lme_alto_custo: 'LME — Alto Custo',
  vacina_prioritaria: 'Relatório Vacina Prioritária',
} as const;

export type DocTypeKey = keyof typeof DOC_TYPES;

// MVP: only aptidao_fisica is enabled
export const ENABLED_DOC_TYPES: DocTypeKey[] = ['aptidao_fisica'];

export const DOC_STATUSES = {
  draft: { label: 'Rascunho', color: '#71717A' },       // zinc-500
  pending: { label: 'Aguardando assinatura', color: '#F59E0B' }, // amber-500
  signed: { label: 'Assinado', color: '#22C55E' },      // green-500
  rejected: { label: 'Rejeitado', color: '#EF4444' },   // red-500
  sent: { label: 'Enviado', color: '#6E56CF' },         // accent
  cancelled: { label: 'Cancelado', color: '#A1A1AA' },  // zinc-400
} as const;

export type DocStatus = keyof typeof DOC_STATUSES;

// ──────────────────────────────────────────────────────────────
// Aptidão Física form schema
// ──────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  'Musculação',
  'Corrida',
  'Natação',
  'Esporte coletivo',
  'Artes marciais',
  'Crossfit',
  'Pilates',
  'Yoga',
  'Ciclismo',
  'Outro',
] as const;

export const FITNESS_RESULTS = [
  { value: 'apto', label: 'Apto' },
  { value: 'inapto', label: 'Inapto' },
  { value: 'apto_restricoes', label: 'Apto com restrições' },
] as const;

export type FitnessResult = 'apto' | 'inapto' | 'apto_restricoes';

export interface AptidaoFisicaForm {
  // Pre-filled from patient
  patient_name: string;
  patient_cpf: string;
  patient_birthdate: string;

  // Clinical input
  activity_type: string;
  result: FitnessResult;
  restrictions: string; // visible only when result = 'apto_restricoes'

  // Automatic
  validity_date: string;      // +12 months from issue date
  professional_name: string;
  professional_council: string; // CRM/CRO/etc
  issue_date: string;          // now()
}

// ──────────────────────────────────────────────────────────────
// Database row types
// ──────────────────────────────────────────────────────────────

export interface PatientClinicalData {
  id: number;
  tenant_id: string;
  patient_id: number;
  cpf: string | null;
  cns: string | null;
  mother_name: string | null;
  address: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  blood_type: string | null;
  allergies: string[] | null;
  insurance_provider: string | null;
  insurance_card_number: string | null;
  primary_cid: string | null;
  conditions: Array<{ cid: string; description: string; since: string; status: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; since: string }>;
  collected_by: 'agent' | 'manual' | 'form';
  updated_at: string;
  created_at: string;
}

export interface MedicalDocument {
  id: number;
  tenant_id: string;
  patient_id: number;
  doctor_id: number | null;
  created_by_user: string | null;
  signed_by_user: string | null;
  doc_type: DocTypeKey;
  status: DocStatus;
  form_data: Record<string, unknown>;
  rejection_note: string | null;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  signed_at: string | null;
  submitted_at: string | null;
  sent_to_patient_at: string | null;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────
// Lookup types (for API responses)
// ──────────────────────────────────────────────────────────────

export interface CID10Entry {
  code: string;
  name: string;
  name_short: string | null;
  chapter: string | null;
}

export interface TUSSEntry {
  code: string;
  name: string;
  table_number: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/docs-types.ts
git commit -m "feat(docs): add shared types for document module"
```

---

## Task 3: Document Queries Helper

**Files:**
- Create: `app/lib/docs-queries.ts`

- [ ] **Step 1: Create document queries file**

```typescript
// app/lib/docs-queries.ts

import { supabaseAdmin } from './supabase';
import type {
  MedicalDocument,
  PatientClinicalData,
  DocTypeKey,
  DocStatus,
} from './docs-types';

const sb = () => supabaseAdmin();

// ──────────────────────────────────────────────────────────────
// Lookup: CID-10
// ──────────────────────────────────────────────────────────────

export async function searchCID10(query: string, limit = 20) {
  // Use full-text search for multi-word, ilike for short codes
  if (query.length <= 5 && /^[A-Z]\d/i.test(query)) {
    const { data } = await sb()
      .from('lookup_cid10')
      .select('code, name, name_short, chapter')
      .ilike('code', `${query}%`)
      .limit(limit);
    return data ?? [];
  }

  const { data } = await sb()
    .from('lookup_cid10')
    .select('code, name, name_short, chapter')
    .textSearch('code || \' \' || name', query, {
      type: 'websearch',
      config: 'portuguese',
    })
    .limit(limit);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────
// Lookup: TUSS
// ──────────────────────────────────────────────────────────────

export async function searchTUSS(query: string, limit = 20) {
  if (/^\d+$/.test(query)) {
    const { data } = await sb()
      .from('lookup_tuss')
      .select('code, name, table_number')
      .ilike('code', `${query}%`)
      .is('valid_until', null)
      .limit(limit);
    return data ?? [];
  }

  const { data } = await sb()
    .from('lookup_tuss')
    .select('code, name, table_number')
    .textSearch('code || \' \' || name', query, {
      type: 'websearch',
      config: 'portuguese',
    })
    .is('valid_until', null)
    .limit(limit);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────
// Patient clinical data
// ──────────────────────────────────────────────────────────────

export async function getPatientClinical(
  tenantId: string,
  patientId: number
): Promise<PatientClinicalData | null> {
  const { data } = await sb()
    .from('patient_clinical_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('patient_id', patientId)
    .maybeSingle();
  return data;
}

export async function upsertPatientClinical(
  tenantId: string,
  patientId: number,
  fields: Partial<Omit<PatientClinicalData, 'id' | 'tenant_id' | 'patient_id' | 'created_at'>>
) {
  const { data, error } = await sb()
    .from('patient_clinical_data')
    .upsert(
      {
        tenant_id: tenantId,
        patient_id: patientId,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,patient_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as PatientClinicalData;
}

// ──────────────────────────────────────────────────────────────
// Medical documents CRUD
// ──────────────────────────────────────────────────────────────

export async function createDocument(params: {
  tenant_id: string;
  patient_id: number;
  doctor_id: number;
  created_by_user: string;
  doc_type: DocTypeKey;
  form_data: Record<string, unknown>;
}): Promise<MedicalDocument> {
  const { data, error } = await sb()
    .from('medical_documents')
    .insert({
      tenant_id: params.tenant_id,
      patient_id: params.patient_id,
      doctor_id: params.doctor_id,
      created_by_user: params.created_by_user,
      doc_type: params.doc_type,
      form_data: params.form_data,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  return data as MedicalDocument;
}

export async function listDocuments(
  tenantId: string,
  filters?: { status?: DocStatus; doc_type?: DocTypeKey; doctor_id?: number }
) {
  let query = sb()
    .from('medical_documents')
    .select(`
      id, tenant_id, patient_id, doctor_id,
      doc_type, status, form_data,
      rejection_note, pdf_url, signed_pdf_url, signed_at,
      submitted_at, sent_to_patient_at, created_at, updated_at
    `)
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.doc_type) query = query.eq('doc_type', filters.doc_type);
  if (filters?.doctor_id) query = query.eq('doctor_id', filters.doctor_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MedicalDocument[];
}

export async function getDocument(
  tenantId: string,
  docId: number
): Promise<MedicalDocument | null> {
  const { data } = await sb()
    .from('medical_documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', docId)
    .maybeSingle();
  return data as MedicalDocument | null;
}

export async function updateDocument(
  tenantId: string,
  docId: number,
  fields: Partial<Pick<MedicalDocument, 'form_data' | 'status' | 'rejection_note' | 'pdf_url' | 'signed_pdf_url' | 'signed_at' | 'submitted_at' | 'sent_to_patient_at' | 'signed_by_user'>>
) {
  const { data, error } = await sb()
    .from('medical_documents')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', docId)
    .select()
    .single();

  if (error) throw error;
  return data as MedicalDocument;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/docs-queries.ts
git commit -m "feat(docs): add Supabase query helpers for documents module"
```

---

## Task 4: CID-10 Import Script

**Files:**
- Create: `app/scripts/import-cid10.ts`

- [ ] **Step 1: Create the import script**

```typescript
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

// CSV source: DataSUS CID-10 subcategories
// Using the raw GitHub file from cleytonferrari/CidDataSus for reliability
const CSV_URL =
  'https://raw.githubusercontent.com/cleytonferrari/CidDataSus/master/CidDataSus/Data/CID-10-SUBCATEGORIAS.CSV';

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
  console.log('Downloading CID-10 CSV from GitHub...');
  const res = await fetch(CSV_URL);
  if (!res.ok) {
    console.error(`Failed to download: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  // Skip header line
  const header = lines[0];
  console.log(`Header: ${header}`);
  const rows = lines.slice(1);
  console.log(`Parsed ${rows.length} CID-10 subcategories`);

  // Parse CSV (semicolon-separated)
  const records: Array<{
    code: string;
    name: string;
    name_short: string | null;
    chapter: string;
  }> = [];

  for (const line of rows) {
    const parts = line.split(';');
    if (parts.length < 2) continue;

    const rawCode = parts[0].trim();
    const name = parts[1].trim();
    const nameShort = parts[2]?.trim() || null;

    if (!rawCode || !name) continue;

    const code = formatCode(rawCode);
    records.push({
      code,
      name,
      name_short: nameShort,
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
```

- [ ] **Step 2: Run the import script**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsx scripts/import-cid10.ts
```

Expected output:
```
Downloading CID-10 CSV from GitHub...
Header: SUBCAT;DESCRICAO;DESCRABREV;CLASSIF;RESTRSEXO;CAUSAOBITO;REFER
Parsed ~12000 CID-10 subcategories
Inserting 12000 records into lookup_cid10...
  500/12000
  1000/12000
  ...
Done! 12000 CID-10 codes imported.
Total rows in lookup_cid10: ~12000
```

- [ ] **Step 3: Verify via Supabase SQL Editor**

```sql
SELECT code, name FROM lookup_cid10 WHERE code LIKE 'J06%' LIMIT 5;
-- Expected: 'J06.0' → 'Faringite aguda', 'J06.9' → 'Infecção aguda das vias aéreas...'
```

- [ ] **Step 4: Commit**

```bash
git add app/scripts/import-cid10.ts
git commit -m "feat(docs): add CID-10 import script from DataSUS CSV"
```

---

## Task 5: TUSS Import Script

**Files:**
- Create: `app/scripts/import-tuss.ts`

- [ ] **Step 1: Create the import script**

```typescript
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

// TUSS table 22 JSON from charlesfgarcia/tabelas-ans
// This repo has multiple tables; table 22 = "Terminologia de procedimentos e eventos em saúde"
const TABLES_TO_IMPORT = [
  {
    tableNumber: 22,
    url: 'https://raw.githubusercontent.com/charlesfgarcia/tabelas-ans/main/Tabela22.json',
    label: 'Procedimentos e eventos em saúde',
  },
  {
    tableNumber: 98,
    url: 'https://raw.githubusercontent.com/charlesfgarcia/tabelas-ans/main/Tabela98.json',
    label: 'Tipo de consulta',
  },
];

interface TUSSJsonEntry {
  codigo: string;
  termo: string;
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

  const entries: TUSSJsonEntry[] = await res.json();
  console.log(`  Parsed ${entries.length} entries`);

  const records = entries.map((e) => ({
    code: e.codigo,
    name: e.termo,
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
```

- [ ] **Step 2: Run the import script**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsx scripts/import-tuss.ts
```

Expected output:
```
Importing TUSS Table 22: Procedimentos e eventos em saúde
  Parsed ~5000 entries
  Inserted 5000 records

Importing TUSS Table 98: Tipo de consulta
  Parsed ~20 entries
  Inserted 20 records

Done! ~5020 TUSS codes imported.
Total rows in lookup_tuss: ~5020
```

- [ ] **Step 3: Verify via Supabase SQL Editor**

```sql
SELECT code, name FROM lookup_tuss WHERE code = '10101012';
-- Expected: '10101012' → 'CONSULTA EM CONSULTORIO...'
```

- [ ] **Step 4: Commit**

```bash
git add app/scripts/import-tuss.ts
git commit -m "feat(docs): add TUSS import script from tabelas-ans JSON"
```

---

## Task 6: Lookup API Routes (CID-10 + TUSS)

**Files:**
- Create: `app/app/api/lookup/cid10/route.ts`
- Create: `app/app/api/lookup/tuss/route.ts`

- [ ] **Step 1: Create CID-10 lookup endpoint**

```typescript
// app/app/api/lookup/cid10/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { searchCID10 } from '@/lib/docs-queries';

// Public endpoint — no auth required (read-only regulated data)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { success: false, message: 'Query deve ter pelo menos 2 caracteres' },
      { status: 400 }
    );
  }

  try {
    const results = await searchCID10(q, 20);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[lookup/cid10] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar CID-10' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create TUSS lookup endpoint**

```typescript
// app/app/api/lookup/tuss/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { searchTUSS } from '@/lib/docs-queries';

// Public endpoint — no auth required (read-only regulated data)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { success: false, message: 'Query deve ter pelo menos 2 caracteres' },
      { status: 400 }
    );
  }

  try {
    const results = await searchTUSS(q, 20);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[lookup/tuss] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar TUSS' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Smoke test both endpoints**

Start dev server if not running, then:

```bash
curl "http://localhost:3000/api/lookup/cid10?q=diabetes" | jq '.results | length'
# Expected: > 0

curl "http://localhost:3000/api/lookup/tuss?q=consulta" | jq '.results | length'
# Expected: > 0
```

- [ ] **Step 4: Commit**

```bash
git add app/app/api/lookup/cid10/route.ts app/app/api/lookup/tuss/route.ts
git commit -m "feat(docs): add public lookup API for CID-10 and TUSS search"
```

---

## Task 7: Patient Clinical Data API

**Files:**
- Create: `app/app/api/painel/pacientes/[id]/clinical/route.ts`

- [ ] **Step 1: Create clinical data endpoint (GET + PATCH)**

```typescript
// app/app/api/painel/pacientes/[id]/clinical/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getPatientClinical, upsertPatientClinical } from '@/lib/docs-queries';

const ALLOWED_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// GET: retrieve patient clinical data
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!ALLOWED_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json(
      { success: false, message: 'ID inválido' },
      { status: 400 }
    );
  }

  try {
    const data = await getPatientClinical(auth.ctx.tenant.tenant_id, patientId);
    return NextResponse.json({ success: true, clinical: data });
  } catch (error) {
    console.error('[painel/pacientes/clinical GET] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar dados clínicos' },
      { status: 500 }
    );
  }
}

// PATCH: upsert patient clinical data
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!ALLOWED_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json(
      { success: false, message: 'ID inválido' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'JSON inválido' },
      { status: 400 }
    );
  }

  // Whitelist allowed fields
  const allowed = [
    'cpf', 'cns', 'mother_name', 'address',
    'weight_kg', 'height_cm', 'blood_type', 'allergies',
    'insurance_provider', 'insurance_card_number',
    'primary_cid', 'conditions', 'medications', 'collected_by',
  ];
  const fields: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) fields[key] = body[key];
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { success: false, message: 'Nenhum campo para atualizar' },
      { status: 400 }
    );
  }

  try {
    const data = await upsertPatientClinical(
      auth.ctx.tenant.tenant_id,
      patientId,
      fields
    );
    return NextResponse.json({ success: true, clinical: data });
  } catch (error) {
    console.error('[painel/pacientes/clinical PATCH] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao salvar dados clínicos' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/pacientes/\[id\]/clinical/route.ts
git commit -m "feat(docs): add patient clinical data API (GET + PATCH)"
```

---

## Task 8: Documents CRUD API — Create + List

**Files:**
- Create: `app/app/api/painel/docs/route.ts`

- [ ] **Step 1: Create documents list + create endpoint**

```typescript
// app/app/api/painel/docs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { createDocument, listDocuments } from '@/lib/docs-queries';
import { ENABLED_DOC_TYPES, type DocTypeKey, type DocStatus } from '@/lib/docs-types';

const WRITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];
const READ_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff', 'viewer'];

// GET: list documents for this tenant
export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!READ_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  const status = req.nextUrl.searchParams.get('status') as DocStatus | null;
  const docType = req.nextUrl.searchParams.get('doc_type') as DocTypeKey | null;
  const doctorId = req.nextUrl.searchParams.get('doctor_id');

  try {
    const docs = await listDocuments(auth.ctx.tenant.tenant_id, {
      status: status ?? undefined,
      doc_type: docType ?? undefined,
      doctor_id: doctorId ? parseInt(doctorId, 10) : undefined,
    });

    // Enrich with patient name
    const patientIds = [...new Set(docs.map((d) => d.patient_id))];
    let patientMap: Record<number, string> = {};

    if (patientIds.length > 0) {
      const { data: patients } = await supabaseAdmin()
        .from('patients')
        .select('id, name')
        .in('id', patientIds);

      if (patients) {
        patientMap = Object.fromEntries(patients.map((p) => [p.id, p.name ?? 'Sem nome']));
      }
    }

    const enriched = docs.map((d) => ({
      ...d,
      patient_name: patientMap[d.patient_id] ?? 'Sem nome',
    }));

    return NextResponse.json({ success: true, documents: enriched });
  } catch (error) {
    console.error('[painel/docs GET] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao listar documentos' },
      { status: 500 }
    );
  }
}

// POST: create new document draft
export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!WRITE_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  let body: {
    patient_id: number;
    doctor_id: number;
    doc_type: DocTypeKey;
    form_data: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'JSON inválido' },
      { status: 400 }
    );
  }

  if (!body.patient_id || !body.doctor_id || !body.doc_type || !body.form_data) {
    return NextResponse.json(
      { success: false, message: 'Campos obrigatórios: patient_id, doctor_id, doc_type, form_data' },
      { status: 400 }
    );
  }

  if (!ENABLED_DOC_TYPES.includes(body.doc_type)) {
    return NextResponse.json(
      { success: false, message: `Tipo de documento "${body.doc_type}" não disponível ainda` },
      { status: 400 }
    );
  }

  try {
    const doc = await createDocument({
      tenant_id: auth.ctx.tenant.tenant_id,
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      created_by_user: auth.ctx.user.id,
      doc_type: body.doc_type,
      form_data: body.form_data,
    });

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (error) {
    console.error('[painel/docs POST] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao criar documento' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/docs/route.ts
git commit -m "feat(docs): add document list + create API endpoints"
```

---

## Task 9: Documents API — Detail + Edit + Cancel

**Files:**
- Create: `app/app/api/painel/docs/[id]/route.ts`

- [ ] **Step 1: Create document detail endpoint**

```typescript
// app/app/api/painel/docs/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';
import { supabaseAdmin } from '@/lib/supabase';

const WRITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];
const READ_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff', 'viewer'];

// GET: document detail
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!READ_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  try {
    const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
    }

    // Enrich with patient and doctor names
    const [patientRes, doctorRes] = await Promise.all([
      supabaseAdmin().from('patients').select('name, phone, email, birthdate').eq('id', doc.patient_id).maybeSingle(),
      doc.doctor_id
        ? supabaseAdmin().from('tenant_doctors').select('doctor_name, doctor_crm, specialty').eq('id', doc.doctor_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      success: true,
      document: doc,
      patient: patientRes.data,
      doctor: doctorRes.data,
    });
  } catch (error) {
    console.error('[painel/docs/[id] GET] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao buscar documento' }, { status: 500 });
  }
}

// PATCH: edit draft document (only status=draft)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!WRITE_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }
  if (doc.status !== 'draft') {
    return NextResponse.json(
      { success: false, message: 'Apenas rascunhos podem ser editados' },
      { status: 400 }
    );
  }

  let body: { form_data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  if (!body.form_data) {
    return NextResponse.json({ success: false, message: 'form_data obrigatório' }, { status: 400 });
  }

  try {
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      form_data: body.form_data,
    });
    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id] PATCH] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao atualizar documento' }, { status: 500 });
  }
}

// DELETE: cancel document (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const cancelRoles: MemberRole[] = ['owner', 'admin', 'doctor'];
  if (!cancelRoles.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  try {
    await updateDocument(auth.ctx.tenant.tenant_id, docId, { status: 'cancelled' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[painel/docs/[id] DELETE] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao cancelar documento' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/docs/\[id\]/route.ts
git commit -m "feat(docs): add document detail, edit, cancel API endpoints"
```

---

## Task 10: Documents API — Submit + Sign + Send

**Files:**
- Create: `app/app/api/painel/docs/[id]/submit/route.ts`
- Create: `app/app/api/painel/docs/[id]/sign/route.ts`
- Create: `app/app/api/painel/docs/[id]/send/route.ts`

- [ ] **Step 1: Create submit endpoint (draft → pending)**

```typescript
// app/app/api/painel/docs/[id]/submit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';

const SUBMIT_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// POST: submit document for signing (draft → pending)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!SUBMIT_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }
  if (doc.status !== 'draft') {
    return NextResponse.json(
      { success: false, message: `Status atual é "${doc.status}", esperado "draft"` },
      { status: 400 }
    );
  }

  try {
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id]/submit] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao submeter documento' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create sign endpoint (pending → signed)**

```typescript
// app/app/api/painel/docs/[id]/sign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';

// Only doctors and owners (who are also professionals) can sign
const SIGN_ROLES: MemberRole[] = ['owner', 'doctor'];

// POST: sign document (pending → signed)
// MVP: marks as signed without BirdID. Phase 2 adds real digital signature.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!SIGN_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Apenas profissionais (doctor/owner) podem assinar documentos' },
      { status: 403 }
    );
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }

  // Allow signing from draft (Profile A: self-service) or pending (Profiles B/C)
  if (doc.status !== 'draft' && doc.status !== 'pending') {
    return NextResponse.json(
      { success: false, message: `Status atual é "${doc.status}", esperado "draft" ou "pending"` },
      { status: 400 }
    );
  }

  // Check for rejection request
  const body = await req.json().catch(() => ({}));
  if (body.reject) {
    if (!body.rejection_note?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Motivo da rejeição é obrigatório' },
        { status: 400 }
      );
    }
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'rejected',
      rejection_note: body.rejection_note.trim(),
    });
    return NextResponse.json({ success: true, document: updated });
  }

  try {
    // MVP: mark as signed (no BirdID integration yet)
    // Phase 2: call BirdID API here to get real ICP-Brasil signature
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'signed',
      signed_by_user: auth.ctx.user.id,
      signed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id]/sign] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao assinar documento' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create send endpoint (signed → sent)**

```typescript
// app/app/api/painel/docs/[id]/send/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';

const SEND_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// POST: mark document as sent to patient (signed → sent)
// MVP: just updates status. Phase 2: trigger WhatsApp/email delivery via N8N.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!SEND_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }
  if (doc.status !== 'signed') {
    return NextResponse.json(
      { success: false, message: `Status atual é "${doc.status}", esperado "signed"` },
      { status: 400 }
    );
  }

  try {
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'sent',
      sent_to_patient_at: new Date().toISOString(),
    });

    // Phase 2: trigger N8N workflow to send via WhatsApp/email
    // await fetch(process.env.N8N_WEBHOOK_URL + '/doc-send', { ... });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id]/send] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar documento' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/app/api/painel/docs/\[id\]/submit/route.ts app/app/api/painel/docs/\[id\]/sign/route.ts app/app/api/painel/docs/\[id\]/send/route.ts
git commit -m "feat(docs): add submit, sign, send status transition API endpoints"
```

---

## Task 11: PDF Template — Aptidão Física

**Files:**
- Create: `app/lib/pdf/aptidao-fisica.tsx`

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm install @react-pdf/renderer
```

- [ ] **Step 2: Create the PDF template**

```tsx
// app/lib/pdf/aptidao-fisica.tsx

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { AptidaoFisicaForm } from '@/lib/docs-types';

// Use default Helvetica (built-in, no font download needed)

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 160,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#555',
  },
  value: {
    flex: 1,
    fontSize: 11,
  },
  resultBox: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    width: 260,
    alignSelf: 'center',
    marginTop: 48,
    paddingTop: 8,
  },
  signatureName: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  signatureCouncil: {
    textAlign: 'center',
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
  validity: {
    marginTop: 24,
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
  },
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function resultLabel(result: string): string {
  switch (result) {
    case 'apto': return 'APTO';
    case 'inapto': return 'INAPTO';
    case 'apto_restricoes': return 'APTO COM RESTRIÇÕES';
    default: return result.toUpperCase();
  }
}

function resultColor(result: string): string {
  switch (result) {
    case 'apto': return '#16a34a';
    case 'inapto': return '#dc2626';
    case 'apto_restricoes': return '#d97706';
    default: return '#333';
  }
}

interface Props {
  form: AptidaoFisicaForm;
  clinicName?: string;
}

export function AptidaoFisicaPDF({ form, clinicName }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {clinicName && (
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
              {clinicName}
            </Text>
          )}
          <Text style={styles.title}>ATESTADO DE APTIDÃO FÍSICA</Text>
          <Text style={styles.subtitle}>Para prática de atividade física</Text>
        </View>

        <View style={styles.divider} />

        {/* Patient info */}
        <View style={styles.row}>
          <Text style={styles.label}>Paciente:</Text>
          <Text style={styles.value}>{form.patient_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>CPF:</Text>
          <Text style={styles.value}>{form.patient_cpf || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data de Nascimento:</Text>
          <Text style={styles.value}>
            {form.patient_birthdate ? formatDate(form.patient_birthdate) : '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Atividade:</Text>
          <Text style={styles.value}>{form.activity_type}</Text>
        </View>

        <View style={styles.divider} />

        {/* Result */}
        <View style={styles.resultBox}>
          <Text style={{ ...styles.resultText, color: resultColor(form.result) }}>
            {resultLabel(form.result)}
          </Text>
        </View>

        {/* Restrictions (if applicable) */}
        {form.result === 'apto_restricoes' && form.restrictions && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Restrições:</Text>
            <Text style={{ ...styles.value, marginTop: 4 }}>{form.restrictions}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Date */}
        <View style={styles.row}>
          <Text style={styles.label}>Data de emissão:</Text>
          <Text style={styles.value}>{formatDate(form.issue_date)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Válido até:</Text>
          <Text style={styles.value}>{formatDate(form.validity_date)}</Text>
        </View>

        {/* Signature */}
        <View style={styles.footer}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureName}>{form.professional_name}</Text>
            <Text style={styles.signatureCouncil}>{form.professional_council}</Text>
          </View>
          <Text style={styles.validity}>
            Este documento tem validade de 12 meses a partir da data de emissão.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/pdf/aptidao-fisica.tsx
git commit -m "feat(docs): add React PDF template for Aptidão Física"
```

---

## Task 12: PDF Generation API Endpoint

**Files:**
- Modify: `app/app/api/painel/docs/[id]/route.ts` (add PDF generation on GET with `?pdf=true`)

Instead of modifying the detail route, we add a dedicated PDF route:

- Create: `app/app/api/painel/docs/[id]/pdf/route.ts`

- [ ] **Step 1: Create PDF generation endpoint**

```typescript
// app/app/api/painel/docs/[id]/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { getDocument } from '@/lib/docs-queries';
import { supabaseAdmin } from '@/lib/supabase';
import { renderToBuffer } from '@react-pdf/renderer';
import { AptidaoFisicaPDF } from '@/lib/pdf/aptidao-fisica';
import type { AptidaoFisicaForm } from '@/lib/docs-types';
import React from 'react';

// GET: generate and return PDF for a document
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }

  try {
    let pdfBuffer: Buffer;

    switch (doc.doc_type) {
      case 'aptidao_fisica': {
        const form = doc.form_data as unknown as AptidaoFisicaForm;
        pdfBuffer = await renderToBuffer(
          React.createElement(AptidaoFisicaPDF, {
            form,
            clinicName: auth.ctx.tenant.clinic_name,
          })
        );
        break;
      }
      default:
        return NextResponse.json(
          { success: false, message: `PDF não disponível para tipo "${doc.doc_type}"` },
          { status: 400 }
        );
    }

    // Return PDF as download
    const filename = `${doc.doc_type}-${doc.id}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[painel/docs/[id]/pdf] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao gerar PDF' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/docs/\[id\]/pdf/route.ts
git commit -m "feat(docs): add PDF generation endpoint for medical documents"
```

---

## Task 13: Enable "Documentos" Nav in Painel

**Files:**
- Modify: `app/app/painel/layout.tsx:78-96`

- [ ] **Step 1: Add Documentos nav item**

In `app/app/painel/layout.tsx`, find the `navItems` array (around line 78). Add the "Documentos" item after "Notas fiscais" (FileText) and before "NPS / feedback" (Star):

```typescript
    // Find this line:
    { href: '/painel/nf', label: 'Notas fiscais', icon: <FileText className="w-4 h-4" />, enabled: true },
    // Add this line AFTER it:
    { href: '/painel/docs', label: 'Documentos', icon: <FileText className="w-4 h-4" />, enabled: true },
    // The next existing line should be:
    { href: '/painel/feedback', label: 'NPS / feedback', icon: <Star className="w-4 h-4" />, enabled: true },
```

Note: We reuse `FileText` icon (already imported). If you want a distinct icon, import `FileCheck` from lucide-react and use it instead.

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/layout.tsx
git commit -m "feat(docs): enable Documentos nav item in painel sidebar"
```

---

## Task 14: Painel Page — Document List

**Files:**
- Create: `app/app/painel/docs/page.tsx`

- [ ] **Step 1: Create documents list page**

```tsx
// app/app/painel/docs/page.tsx

'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Loader2,
  FileText,
  Plus,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { DOC_TYPES, DOC_STATUSES, type DocStatus, type DocTypeKey, type MedicalDocument } from '@/lib/docs-types';

const ACCENT_DEEP = '#5746AF';

type DocWithPatient = MedicalDocument & { patient_name: string };

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: DocStatus }) {
  const info = DOC_STATUSES[status];
  return (
    <span
      className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded"
      style={{
        background: `${info.color}18`,
        color: info.color,
      }}
    >
      {info.label}
    </span>
  );
}

function DocsInner() {
  const me = useMe();
  const [docs, setDocs] = useState<DocWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocStatus | ''>('');

  useEffect(() => {
    if (!me?.tenant_id) return;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        const res = await fetch(`/api/painel/docs?${params}`);
        const json = await res.json();
        if (json.success) setDocs(json.documents);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [me?.tenant_id, statusFilter]);

  if (!me?.tenant_id) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Documentos
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Documentos médicos
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Atestados, guias e relatórios gerados pelo sistema.
          </p>
        </div>
        <Link
          href="/painel/docs/novo"
          className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all flex-shrink-0"
          style={{ background: ACCENT_DEEP }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo documento</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-zinc-400" />
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
            statusFilter === '' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Todos
        </button>
        {(Object.keys(DOC_STATUSES) as DocStatus[])
          .filter((s) => s !== 'cancelled')
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {DOC_STATUSES[s].label}
            </button>
          ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
            <FileText className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1">
            Nenhum documento ainda
          </p>
          <p className="text-[13px] text-zinc-500 mb-4">
            Crie atestados, guias e relatórios com formulários pré-preenchidos.
          </p>
          <Link
            href="/painel/docs/novo"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all"
            style={{ background: ACCENT_DEEP }}
          >
            <Plus className="w-4 h-4" />
            Criar primeiro documento
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
            <div className="col-span-3">Tipo</div>
            <div className="col-span-3">Paciente</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Criado em</div>
            <div className="col-span-2 text-right">Ação</div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {docs.map((d) => (
              <Link
                key={d.id}
                href={`/painel/docs/${d.id}`}
                className="w-full text-left px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center hover:bg-violet-50/30 transition-colors group block"
              >
                <div className="col-span-3 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900 truncate">
                    {DOC_TYPES[d.doc_type]}
                  </p>
                  <p className="text-[12px] text-zinc-500 sm:hidden mt-0.5">
                    {d.patient_name} · {fmtDate(d.created_at)}
                  </p>
                </div>
                <div className="col-span-3 text-[13px] text-zinc-600 truncate hidden sm:block">
                  {d.patient_name}
                </div>
                <div className="col-span-2 hidden sm:block">
                  <StatusBadge status={d.status} />
                </div>
                <div className="col-span-2 text-[13px] text-zinc-600 hidden sm:block">
                  {fmtDate(d.created_at)}
                </div>
                <div className="col-span-2 text-right hidden sm:flex items-center justify-end">
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-violet-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto mt-12" />}>
      <DocsInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/docs/page.tsx
git commit -m "feat(docs): add documents list page in painel"
```

---

## Task 15: Painel Page — New Document Wizard

**Files:**
- Create: `app/app/painel/docs/novo/page.tsx`

- [ ] **Step 1: Create new document page (select patient → fill form → save)**

```tsx
// app/app/painel/docs/novo/page.tsx

'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  Search,
  Check,
  FileText,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import {
  DOC_TYPES,
  ENABLED_DOC_TYPES,
  ACTIVITY_TYPES,
  FITNESS_RESULTS,
  type DocTypeKey,
  type FitnessResult,
  type AptidaoFisicaForm,
} from '@/lib/docs-types';

const ACCENT_DEEP = '#5746AF';

interface PatientLite {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  birthdate: string | null;
}

interface DoctorLite {
  id: number;
  doctor_name: string;
  doctor_crm: string;
  specialty: string;
}

interface ClinicalData {
  cpf: string | null;
}

function NovoDocInner() {
  const me = useMe();
  const router = useRouter();

  // Wizard step: 1=type, 2=patient, 3=form
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<DocTypeKey>('aptidao_fisica');

  // Patient selection
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);

  // Doctor (auto from context)
  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorLite | null>(null);

  // Aptidão Física form
  const [activityType, setActivityType] = useState('');
  const [result, setResult] = useState<FitnessResult>('apto');
  const [restrictions, setRestrictions] = useState('');

  const [saving, setSaving] = useState(false);

  // Load patients + doctors
  useEffect(() => {
    if (!me?.tenant_id) return;
    Promise.all([
      fetch('/api/painel/pacientes').then((r) => r.json()),
      fetch('/api/painel/profissionais').then((r) => r.json()),
    ]).then(([pRes, dRes]) => {
      if (pRes.success) setPatients(pRes.patients);
      if (dRes.success) {
        setDoctors(dRes.doctors);
        if (dRes.doctors.length === 1) setSelectedDoctor(dRes.doctors[0]);
      }
    });
  }, [me?.tenant_id]);

  // Load clinical data when patient selected
  useEffect(() => {
    if (!selectedPatient) { setClinical(null); return; }
    fetch(`/api/painel/pacientes/${selectedPatient.id}/clinical`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setClinical(j.clinical); });
  }, [selectedPatient]);

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    );
  });

  const handleSave = useCallback(async () => {
    if (!selectedPatient || !selectedDoctor || !activityType) return;
    setSaving(true);

    const now = new Date();
    const validityDate = new Date(now);
    validityDate.setFullYear(validityDate.getFullYear() + 1);

    const formData: AptidaoFisicaForm = {
      patient_name: selectedPatient.name ?? 'Sem nome',
      patient_cpf: clinical?.cpf ?? '',
      patient_birthdate: selectedPatient.birthdate ?? '',
      activity_type: activityType,
      result,
      restrictions: result === 'apto_restricoes' ? restrictions : '',
      validity_date: validityDate.toISOString(),
      professional_name: selectedDoctor.doctor_name,
      professional_council: selectedDoctor.doctor_crm,
      issue_date: now.toISOString(),
    };

    try {
      const res = await fetch('/api/painel/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: selectedDoctor.id,
          doc_type: docType,
          form_data: formData,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/painel/docs/${json.document.id}`);
      } else {
        alert(json.message || 'Erro ao criar documento');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }, [selectedPatient, selectedDoctor, activityType, result, restrictions, clinical, docType, router]);

  if (!me?.tenant_id) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => (step > 1 ? setStep(step - 1) : router.push('/painel/docs'))}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {step > 1 ? 'Voltar' : 'Documentos'}
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: s <= step ? ACCENT_DEEP : '#e4e4e7' }}
          />
        ))}
      </div>

      {/* Step 1: Select type */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
            Tipo de documento
          </h2>
          <div className="space-y-2">
            {ENABLED_DOC_TYPES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => { setDocType(key); setStep(2); }}
                className="w-full text-left px-5 py-4 rounded-xl border border-black/[0.07] bg-white hover:border-violet-300 hover:bg-violet-50/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-zinc-400 group-hover:text-violet-500" />
                  <span className="text-[15px] font-medium text-zinc-900">{DOC_TYPES[key]}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-violet-500" />
              </button>
            ))}
            {/* Disabled types */}
            {(Object.keys(DOC_TYPES) as DocTypeKey[])
              .filter((k) => !ENABLED_DOC_TYPES.includes(k))
              .map((key) => (
                <div
                  key={key}
                  className="w-full px-5 py-4 rounded-xl border border-dashed border-black/[0.07] flex items-center justify-between opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-zinc-300" />
                    <span className="text-[15px] font-medium text-zinc-400">{DOC_TYPES[key]}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-400">Em breve</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Step 2: Select patient */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
            Selecionar paciente
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
            />
          </div>
          <div className="rounded-xl border border-black/[0.07] bg-white overflow-hidden max-h-80 overflow-y-auto">
            {filteredPatients.slice(0, 30).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedPatient(p); setStep(3); }}
                className="w-full text-left px-4 py-3 hover:bg-violet-50/30 transition-colors border-b border-black/[0.05] last:border-b-0 flex items-center justify-between"
              >
                <div>
                  <p className="text-[14px] font-semibold text-zinc-900">{p.name ?? 'Sem nome'}</p>
                  <p className="text-[12px] text-zinc-500">{p.phone}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Form (Aptidão Física) */}
      {step === 3 && selectedPatient && (
        <div className="space-y-6">
          <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
            {DOC_TYPES[docType]}
          </h2>

          {/* Patient summary */}
          <div className="rounded-xl bg-zinc-50 p-4 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Paciente</p>
            <p className="text-[15px] font-semibold text-zinc-900">{selectedPatient.name ?? 'Sem nome'}</p>
            <p className="text-[12px] text-zinc-500">
              {selectedPatient.phone}
              {clinical?.cpf && ` · CPF: ${clinical.cpf}`}
            </p>
          </div>

          {/* Doctor selector (if multiple) */}
          {doctors.length > 1 && (
            <div>
              <label className="text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-2 block">
                Profissional
              </label>
              <select
                value={selectedDoctor?.id ?? ''}
                onChange={(e) => {
                  const d = doctors.find((d) => d.id === parseInt(e.target.value, 10));
                  setSelectedDoctor(d ?? null);
                }}
                className="w-full h-11 px-3 bg-white text-[14px] rounded-lg border border-black/10 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06]"
              >
                <option value="">Selecione...</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.doctor_name} — {d.doctor_crm}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Activity type */}
          <div>
            <label className="text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-2 block">
              Tipo de atividade *
            </label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActivityType(a)}
                  className={`text-[13px] font-medium px-4 py-2 rounded-lg border transition-all ${
                    activityType === a
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-black/10 bg-white text-zinc-700 hover:border-black/20'
                  }`}
                >
                  {activityType === a && <Check className="w-3 h-3 inline mr-1" />}
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          <div>
            <label className="text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-2 block">
              Resultado *
            </label>
            <div className="space-y-2">
              {FITNESS_RESULTS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setResult(r.value as FitnessResult)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    result === r.value
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-black/10 bg-white hover:border-black/20'
                  }`}
                >
                  <span className="text-[14px] font-medium">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Restrictions (conditional) */}
          {result === 'apto_restricoes' && (
            <div>
              <label className="text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-2 block">
                Restrições *
              </label>
              <textarea
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                placeholder="Descreva as restrições para a prática..."
                rows={3}
                className="w-full px-4 py-3 bg-white text-[14px] text-zinc-900 rounded-lg border border-black/10 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] resize-none"
              />
            </div>
          )}

          {/* Save */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="h-11 px-5 rounded-lg border border-black/10 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-all"
            >
              Trocar paciente
            </button>
            <button
              type="button"
              disabled={saving || !activityType || !selectedDoctor}
              onClick={handleSave}
              className="h-11 px-6 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: ACCENT_DEEP }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Criar documento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronRight(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="m9 18 6-6-6-6"/></svg>
  );
}

export default function NovoDocPage() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto mt-12" />}>
      <NovoDocInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/docs/novo/page.tsx
git commit -m "feat(docs): add new document wizard page (type → patient → form)"
```

---

## Task 16: Painel Page — Document Detail + Preview + Actions

**Files:**
- Create: `app/app/painel/docs/[id]/page.tsx`

- [ ] **Step 1: Create document detail page**

```tsx
// app/app/painel/docs/[id]/page.tsx

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Download,
  Send,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { DOC_TYPES, DOC_STATUSES, type MedicalDocument, type DocStatus, type AptidaoFisicaForm } from '@/lib/docs-types';

const ACCENT_DEEP = '#5746AF';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: DocStatus }) {
  const info = DOC_STATUSES[status];
  return (
    <span
      className="text-[11px] uppercase tracking-wide font-bold px-3 py-1 rounded-full"
      style={{ background: `${info.color}18`, color: info.color }}
    >
      {info.label}
    </span>
  );
}

function DocDetailInner() {
  const me = useMe();
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;

  const [doc, setDoc] = useState<MedicalDocument | null>(null);
  const [patient, setPatient] = useState<{ name: string; phone: string; email: string | null; birthdate: string | null } | null>(null);
  const [doctor, setDoctor] = useState<{ doctor_name: string; doctor_crm: string; specialty: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!me?.tenant_id || !docId) return;
    (async () => {
      try {
        const res = await fetch(`/api/painel/docs/${docId}`);
        const json = await res.json();
        if (json.success) {
          setDoc(json.document);
          setPatient(json.patient);
          setDoctor(json.doctor);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [me?.tenant_id, docId]);

  const handleAction = async (action: 'submit' | 'sign' | 'send') => {
    setActing(true);
    try {
      const res = await fetch(`/api/painel/docs/${docId}/${action}`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setDoc(json.document);
      } else {
        alert(json.message || 'Erro');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setActing(false);
    }
  };

  if (!me?.tenant_id) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-20">
        <p className="text-[15px] text-zinc-500">Documento não encontrado.</p>
      </div>
    );
  }

  const form = doc.form_data as unknown as AptidaoFisicaForm;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/painel/docs')}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Documentos
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-1" style={{ color: ACCENT_DEEP }}>
            #{doc.id}
          </p>
          <h1 className="text-[24px] sm:text-[28px] leading-[1.1] tracking-[-0.025em] font-medium text-zinc-900">
            {DOC_TYPES[doc.doc_type]}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={doc.status} />
            <span className="text-[13px] text-zinc-500">{fmtDate(doc.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Patient + Doctor info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-zinc-50 p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-1">Paciente</p>
          <p className="text-[15px] font-semibold text-zinc-900">{patient?.name ?? 'Sem nome'}</p>
          <p className="text-[12px] text-zinc-500">{patient?.phone}</p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-1">Profissional</p>
          <p className="text-[15px] font-semibold text-zinc-900">{doctor?.doctor_name ?? '—'}</p>
          <p className="text-[12px] text-zinc-500">{doctor?.doctor_crm} · {doctor?.specialty}</p>
        </div>
      </div>

      {/* Form data preview */}
      <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06]">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Dados do documento</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
            <span className="font-semibold text-zinc-500">Paciente</span>
            <span className="text-zinc-900">{form.patient_name}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
            <span className="font-semibold text-zinc-500">CPF</span>
            <span className="text-zinc-900">{form.patient_cpf || '—'}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
            <span className="font-semibold text-zinc-500">Atividade</span>
            <span className="text-zinc-900">{form.activity_type}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
            <span className="font-semibold text-zinc-500">Resultado</span>
            <span
              className="font-bold"
              style={{
                color:
                  form.result === 'apto' ? '#16a34a' :
                  form.result === 'inapto' ? '#dc2626' : '#d97706',
              }}
            >
              {form.result === 'apto' ? 'APTO' : form.result === 'inapto' ? 'INAPTO' : 'APTO COM RESTRIÇÕES'}
            </span>
          </div>
          {form.result === 'apto_restricoes' && form.restrictions && (
            <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
              <span className="font-semibold text-zinc-500">Restrições</span>
              <span className="text-zinc-900">{form.restrictions}</span>
            </div>
          )}
          <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
            <span className="font-semibold text-zinc-500">Emissão</span>
            <span className="text-zinc-900">{fmtDate(form.issue_date)}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2 text-[13px]">
            <span className="font-semibold text-zinc-500">Validade</span>
            <span className="text-zinc-900">{fmtDate(form.validity_date)}</span>
          </div>
        </div>
      </div>

      {/* Rejection note */}
      {doc.status === 'rejected' && doc.rejection_note && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-red-600 mb-1">Motivo da rejeição</p>
          <p className="text-[13px] text-red-800">{doc.rejection_note}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        {/* Download PDF (always available) */}
        <a
          href={`/api/painel/docs/${doc.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-10 px-4 rounded-lg border border-black/10 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-all inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Baixar PDF
        </a>

        {/* Submit for signing (draft → pending) — Profiles B/C */}
        {doc.status === 'draft' && (
          <button
            type="button"
            disabled={acting}
            onClick={() => handleAction('submit')}
            className="h-10 px-4 rounded-lg border border-amber-300 bg-amber-50 text-[13px] font-semibold text-amber-700 hover:bg-amber-100 transition-all inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Clock className="w-4 h-4" />
            Enviar para assinatura
          </button>
        )}

        {/* Sign (draft/pending → signed) — Profile A or doctor reviewing */}
        {(doc.status === 'draft' || doc.status === 'pending') && (
          <button
            type="button"
            disabled={acting}
            onClick={() => handleAction('sign')}
            className="h-10 px-5 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all inline-flex items-center gap-2 disabled:opacity-40"
            style={{ background: '#16a34a' }}
          >
            <CheckCircle className="w-4 h-4" />
            Assinar
          </button>
        )}

        {/* Send to patient (signed → sent) */}
        {doc.status === 'signed' && (
          <button
            type="button"
            disabled={acting}
            onClick={() => handleAction('send')}
            className="h-10 px-5 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all inline-flex items-center gap-2 disabled:opacity-40"
            style={{ background: ACCENT_DEEP }}
          >
            <Send className="w-4 h-4" />
            Enviar ao paciente
          </button>
        )}
      </div>
    </div>
  );
}

export default function DocDetailPage() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto mt-12" />}>
      <DocDetailInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/docs/\[id\]/page.tsx
git commit -m "feat(docs): add document detail page with preview, actions, PDF download"
```

---

## Task 17: Smoke Test & Verify End-to-End

**Files:**
- No new files

- [ ] **Step 1: Start dev server**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run dev
```

- [ ] **Step 2: Verify lookup APIs**

```bash
curl -s "http://localhost:3000/api/lookup/cid10?q=J06" | jq '.results[0]'
# Expected: { "code": "J06.0", "name": "Faringite aguda", ... }

curl -s "http://localhost:3000/api/lookup/tuss?q=consulta" | jq '.results[0]'
# Expected: { "code": "10101012", "name": "CONSULTA EM CONSULTORIO...", ... }
```

- [ ] **Step 3: Navigate to painel and verify**

Open browser:
1. Go to `http://localhost:3000/painel` → verify "Documentos" nav item appears
2. Click "Documentos" → should see empty list with CTA
3. Click "Novo documento" → should see type selector with Aptidão Física enabled
4. Select Aptidão Física → patient list appears
5. Select a patient → form appears with activity types and result options
6. Fill form → click "Criar documento" → redirects to detail page
7. On detail page → click "Baixar PDF" → PDF opens in new tab
8. Click "Assinar" → status changes to "Assinado"
9. Click "Enviar ao paciente" → status changes to "Enviado"

- [ ] **Step 4: Verify document list shows created documents**

Go back to `/painel/docs` → document should appear in list with correct status badge.

- [ ] **Step 5: Commit if any hotfixes were needed**

```bash
git add -A
git commit -m "fix(docs): hotfixes from smoke test"
```

---

## Self-Review Checklist

### Spec coverage (ADR-001):
- ✅ Lookup tables: CID-10, TUSS (Tasks 1, 4, 5, 6)
- ✅ Patient clinical data: table + API (Tasks 1, 3, 7)
- ✅ Medical documents: table + full CRUD API (Tasks 1, 3, 8, 9, 10)
- ✅ Status machine: draft → pending → signed → sent (+ rejected, cancelled) (Tasks 8-10)
- ✅ RBAC: sign/reject = doctor/owner only; read = all; write = all except viewer (Tasks 7-10)
- ✅ Aptidão Física: all 10 fields (Task 2, 15)
- ✅ PDF generation (Tasks 11, 12)
- ✅ Nav item "Documentos" (Task 13)
- ✅ List page with status filters (Task 14)
- ✅ New document wizard (Task 15)
- ✅ Detail page with preview + actions (Task 16)
- ✅ Profile A flow: doctor creates + signs in one session (Task 16: "Assinar" from draft)
- ✅ Profile B/C flow: backoffice creates → submit → doctor signs later (Task 16: "Enviar para assinatura" → "Assinar")
- ❌ BirdID integration (explicitly out of MVP scope — Phase 2)
- ❌ TISS XML generation (Phase 2)
- ❌ Other 4 doc types (Phase 2+)
- ❌ Push notification to doctor for pending docs (Phase 2)
- ❌ WhatsApp/email delivery via N8N (Phase 2 — status tracked but delivery manual)

### Placeholder scan:
- No TBD/TODO in implementation code
- Phase 2 items clearly marked with comments in sign/send routes
- All code blocks are complete and self-contained

### Type consistency:
- `DocTypeKey`, `DocStatus`, `AptidaoFisicaForm` used consistently across all files
- `MedicalDocument`, `PatientClinicalData` types match SQL schema
- `requireTenant()` pattern followed in all API routes
- `MemberRole` checks consistent with ADR-001 RBAC matrix
