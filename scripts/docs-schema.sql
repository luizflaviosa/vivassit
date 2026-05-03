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
  tenant_id             varchar NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
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
  tenant_id           varchar NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  patient_id          bigint NOT NULL REFERENCES public.patients(id),
  doctor_id           uuid REFERENCES public.tenant_doctors(id),

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
