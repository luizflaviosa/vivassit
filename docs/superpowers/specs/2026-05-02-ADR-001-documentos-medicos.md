# ADR-001: Documentos Médicos Determinísticos com Assinatura Digital

**Status:** Proposed
**Date:** 2026-05-02
**Deciders:** Luiz (fundador)

---

## Context

Singulare é um SaaS multi-tenant para clínicas de saúde. Hoje tem: agente IA no WhatsApp, agendamento, NPS, cobrança, NFS-e. **Não tem dados clínicos** (prontuário, CID, diagnóstico).

Queremos adicionar geração automatizada de 5 tipos de documentos médicos:
1. Atestado de aptidão física
2. Guia TISS (convênio)
3. Relatório para afastamento INSS
4. LME — medicamento de alto custo
5. Relatório para vacina prioritária

Esses documentos exigem dados clínicos, campos regulados (CID-10, SIGTAP/TUSS), e assinatura com validade legal (ICP-Brasil via BirdID).

---

## Decision

### Workflow em 4 estágios com 3 perfis de operação

O sistema é **o mesmo** para todos os perfis — mesma tela, mesmo formulário, mesma validação. O que muda é **quem opera cada estágio**.

### Os 3 Perfis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  PERFIL A — Self-Service (Profissional sem add-on Atendimento)         │
│  ─────────────────────────────────────────────────────────────          │
│  Planos: Professional (R$197) ou Enterprise (R$397) sem add-on         │
│                                                                         │
│  O médico faz tudo sozinho:                                             │
│  [1. COLETA] IA coleta dados do paciente (automático)                  │
│  [2. MONTAGEM] Médico abre formulário, completa campos clínicos        │
│  [3. ASSINATURA] Médico assina (one-click BirdID)                      │
│  [4. ENTREGA] Sistema envia ao paciente                                │
│                                                                         │
│  Benefício: formulário pré-preenchido com dados do paciente +          │
│  dropdowns regulados (CID, TUSS). De 15-40 min → 3-8 min.             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PERFIL B — Backoffice Singulare (com add-on Atendimento R$297)        │
│  ─────────────────────────────────────────────────────────────          │
│  Qualquer plano + add-on Singulare Atendimento                         │
│                                                                         │
│  Equipe humana Singulare monta, médico só valida e assina:             │
│  [1. COLETA] IA coleta dados do paciente (automático)                  │
│  [2. MONTAGEM] Equipe Singulare monta o documento no painel           │
│  [3. ASSINATURA] Médico recebe notificação → revisa → one-click sign   │
│  [4. ENTREGA] Sistema envia ao paciente                                │
│                                                                         │
│  Benefício: médico não toca em formulário. Só revisa e assina.         │
│  Tempo do médico: ~30 segundos por documento.                          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PERFIL C — Backoffice Próprio (Enterprise com equipe interna)         │
│  ─────────────────────────────────────────────────────────────          │
│  Plano Enterprise (R$397) com roles staff/admin na clínica             │
│                                                                         │
│  Equipe da clínica monta, médico só valida e assina:                   │
│  [1. COLETA] IA coleta dados do paciente (automático)                  │
│  [2. MONTAGEM] Staff/admin da clínica monta no painel                 │
│  [3. ASSINATURA] Médico recebe notificação → revisa → one-click sign   │
│  [4. ENTREGA] Sistema envia ao paciente                                │
│                                                                         │
│  Benefício: igual ao B, mas com equipe própria.                        │
│  Não precisa do add-on Atendimento.                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxo Unificado (todos os perfis)

```
                    PERFIL A              PERFIL B              PERFIL C
                    (self-service)        (Singulare)           (clínica)

ESTÁGIO 1           IA coleta do          IA coleta do          IA coleta do
COLETA              paciente via          paciente via          paciente via
(automático)        WhatsApp              WhatsApp              WhatsApp
                        │                     │                     │
                        ▼                     ▼                     ▼
ESTÁGIO 2           Médico abre           Operador Singulare    Staff/admin da
MONTAGEM            formulário e          abre formulário e     clínica abre
(humano)            preenche campos       preenche campos       formulário e
                    clínicos              clínicos (médico      preenche campos
                        │                 informou por voz/     clínicos
                        │                 chat/anotação)            │
                        │                     │                     │
                        ▼                     ▼                     ▼
                    ┌─────────────────────────────────────────────────┐
                    │  Validação: todos os campos obrigatórios OK?    │
                    │  CID válido? TUSS válido? Dados completos?      │
                    └────────────────────┬────────────────────────────┘
                                         │
                    ┌────────────────────┬┴───────────────────────────┐
                    │                    │                             │
                    ▼                    ▼                             ▼
ESTÁGIO 3       Perfil A:           Perfil B/C:                   Se rejeitado:
ASSINATURA      Médico já está      Médico recebe push:           volta para
(médico)        no formulário →     "Doc X pronto p/ assinatura"  ESTÁGIO 2
                click "Assinar"     → abre → revisa → "Assinar"   com nota
                        │                     │
                        └──────────┬──────────┘
                                   ▼
                            BirdID API OAuth 2.0
                            Assinatura ICP-Brasil
                                   │
                                   ▼
ESTÁGIO 4              PDF assinado → Supabase Storage
ENTREGA                ├─ Download no painel
(automático)           ├─ WhatsApp ao paciente (Baileys)
                       ├─ Email ao paciente
                       └─ TISS: XML para upload no portal
```

### Diferença chave no Perfil A (self-service)

No Perfil A, o médico faz montagem + assinatura **na mesma sessão**. Não precisa de notificação push, não precisa abrir outra tela. O fluxo é:

```
Médico abre /painel/docs/novo
  → seleciona tipo de documento
  → seleciona paciente (dados pré-preenchidos)
  → preenche campos clínicos (CID dropdown, decisões)
  → preview do documento
  → click "Assinar e Gerar"  ← montagem + assinatura em um fluxo
  → PDF assinado pronto
```

Nos Perfis B e C, a montagem e assinatura são **estágios separados** feitos por **pessoas diferentes**:

```
Backoffice monta → status: 'pending' → push notification →
Médico abre /painel/docs/[id]/assinar → revisa → click "Assinar" →
PDF assinado pronto
```

---

## Estágio 1: COLETA (IA Agent — automático, todos os perfis)

A IA conversa com pacientes via WhatsApp. Coleta dados que serão reutilizados em todos os documentos futuros:

### Dados coletáveis pela IA (do paciente)

| Dado | Quando coleta | Obrigatório para |
|------|--------------|-----------------|
| Nome completo | Primeiro contato | Todos |
| CPF | Primeiro contato | Todos |
| Data nascimento | Primeiro contato | Todos |
| Telefone | Primeiro contato | LME |
| Nome da mãe | Sob demanda (IA pergunta quando necessário) | LME |
| Peso (kg) | Pré-consulta ou sob demanda | LME |
| Altura (cm) | Pré-consulta ou sob demanda | LME |
| Alergias | Pré-consulta | Referência geral |
| Medicações em uso | Pré-consulta | LME, referência |
| Queixa principal | Agendamento | Referência para INSS |
| CNS (Cartão SUS) | Sob demanda | LME |
| Endereço | Sob demanda | INSS |
| Convênio + nº carteirinha | Primeiro contato | TISS |

### Dados NÃO coletáveis pela IA (decisão clínica do médico)

| Dado | Quem informa | Formato |
|------|-------------|---------|
| CID-10 | Médico | Dropdown com busca (tabela importada) |
| Código TUSS/SIGTAP | Médico ou backoffice | Dropdown com busca |
| Diagnóstico detalhado | Médico | Texto livre |
| Apto/Inapto | Médico | Radio button |
| Tempo de afastamento | Médico | Input numérico (dias) |
| Posologia | Médico | Texto estruturado |
| Justificativa clínica | Médico | Texto (template sugerido por CID) |
| Prognóstico | Médico | Dropdown [favorável, reservado, desfavorável] |

---

## Estágio 2: MONTAGEM (formulário determinístico)

### Campos por tipo de documento

#### A. Aptidão Física (10 campos — mais simples, quick win)

| # | Campo | Tipo | Fonte | Obrigatório |
|---|-------|------|-------|-------------|
| 1 | Nome paciente | ✅ pré-preenchido | patients.name | Sim |
| 2 | CPF | ✅ pré-preenchido | patient_clinical_data.cpf | Sim |
| 3 | Data nascimento | ✅ pré-preenchido | patients.birthdate | Sim |
| 4 | Tipo de atividade | 📋 dropdown | [musculação, corrida, natação, esporte coletivo, artes marciais, crossfit, pilates, yoga, outro] | Sim |
| 5 | Resultado | ✍️ input clínico | radio: [apto, inapto, apto com restrições] | Sim |
| 6 | Restrições | ✍️ input clínico | texto livre (visível só se "com restrições") | Condicional |
| 7 | Validade | 🔒 automático | 12 meses a partir da data | Sim |
| 8 | Nome profissional | 🔒 automático | tenant_doctors.name | Sim |
| 9 | Nº conselho (CRM/CRO/etc) | 🔒 automático | tenant_doctors.crm | Sim |
| 10 | Data emissão | 🔒 automático | now() | Sim |

#### B. Guia TISS (15 campos)

| # | Campo | Tipo | Fonte | Obrigatório |
|---|-------|------|-------|-------------|
| 1 | Operadora | 📋 dropdown | tabela ANS operadoras | Sim |
| 2 | Nº carteirinha | ✅ pré / ✍️ input | patient_clinical_data.insurance_card_number | Sim |
| 3 | Nome paciente | ✅ pré-preenchido | patients.name | Sim |
| 4 | CPF | ✅ pré-preenchido | patient_clinical_data.cpf | Sim |
| 5 | Código TUSS procedimento | 📋 dropdown + busca | lookup_tuss | Sim |
| 6 | Descrição procedimento | 🔒 automático | preenchido ao selecionar TUSS | Sim |
| 7 | CID-10 | 📋 dropdown + busca | lookup_cid10 | Sim |
| 8 | Quantidade | ✍️ input | numérico (default 1) | Sim |
| 9 | Valor unitário | ✅ pré-preenchido | tenant_doctors.consultation_value | Sim |
| 10 | Tipo atendimento | 📋 dropdown | [consulta, retorno, procedimento, exame] | Sim |
| 11 | Caráter atendimento | 📋 dropdown | [eletivo, urgência] | Sim |
| 12 | Data atendimento | ✅ pré / ✍️ input | data da consulta agendada | Sim |
| 13 | CNES | ✅ pré-preenchido | tenants.cnes | Sim |
| 14 | Profissional executante + conselho | 🔒 automático | tenant_doctors | Sim |
| 15 | Data emissão | 🔒 automático | now() | Sim |
| **Output** | XML TISS 4.03 validado automaticamente | | | |

#### C. Afastamento INSS (14 campos)

| # | Campo | Tipo | Fonte | Obrigatório |
|---|-------|------|-------|-------------|
| 1 | Nome paciente | ✅ pré-preenchido | patients.name | Sim |
| 2 | CPF | ✅ pré-preenchido | patient_clinical_data.cpf | Sim |
| 3 | Data nascimento | ✅ pré-preenchido | patients.birthdate | Sim |
| 4 | Endereço | ✅ pré-preenchido | patient_clinical_data.address | Sim |
| 5 | CID-10 | 📋 dropdown + busca | lookup_cid10 | Sim |
| 6 | Diagnóstico detalhado | ✍️ input clínico | texto livre | Sim |
| 7 | Anamnese / histórico | ✍️ input clínico | texto (template sugerido por CID selecionado) | Sim |
| 8 | Exames realizados | ✍️ input clínico | texto ou lista | Não |
| 9 | Limitações funcionais | ✍️ input clínico | texto (sugestões contextuais por CID) | Sim |
| 10 | Tempo afastamento (dias) | ✍️ input clínico | numérico | Sim |
| 11 | Prognóstico | 📋 dropdown | [favorável, reservado, desfavorável] | Sim |
| 12 | Nome profissional | 🔒 automático | tenant_doctors | Sim |
| 13 | Nº conselho | 🔒 automático | tenant_doctors.crm | Sim |
| 14 | Data emissão | 🔒 automático | now() | Sim |

#### D. LME Alto Custo (17 campos)

| # | Campo | Tipo | Fonte | Obrigatório |
|---|-------|------|-------|-------------|
| 1 | CNES | ✅ pré-preenchido | tenants.cnes | Sim |
| 2 | Nome paciente | ✅ pré-preenchido | patients.name | Sim |
| 3 | Nome mãe | ✅ pré-preenchido | patient_clinical_data.mother_name | Sim |
| 4 | CPF ou CNS | ✅ pré-preenchido | patient_clinical_data.cpf / .cns | Sim |
| 5 | Telefone | ✅ pré-preenchido | patients.phone | Sim |
| 6 | Peso (kg) | ✅ pré-preenchido | patient_clinical_data.weight_kg | Sim |
| 7 | Altura (cm) | ✅ pré-preenchido | patient_clinical_data.height_cm | Sim |
| 8 | CID-10 | 📋 dropdown + busca | lookup_cid10 | Sim |
| 9 | Medicamento | 📋 dropdown + busca | lookup_sigtap (medicamentos) | Sim |
| 10 | Posologia | ✍️ input clínico | texto estruturado | Sim |
| 11 | Qtde mensal | 📋 calculado / ✍️ input | auto-calcula pela posologia, editável | Sim |
| 12 | Diagnóstico | ✍️ input clínico | texto | Sim |
| 13 | Anamnese | ✍️ input clínico | texto (template sugerido pelo PCDT do CID) | Sim |
| 14 | Tratamentos anteriores | ✍️ input clínico | texto | Sim |
| 15 | Justificativa | ✍️ input clínico | texto (template PCDT, editável) | Sim |
| 16 | Profissional + conselho | 🔒 automático | tenant_doctors | Sim |
| 17 | Data | 🔒 automático | now() | Sim |

#### E. Vacina Prioritária (10 campos)

| # | Campo | Tipo | Fonte | Obrigatório |
|---|-------|------|-------|-------------|
| 1 | Nome paciente | ✅ pré-preenchido | patients.name | Sim |
| 2 | CPF | ✅ pré-preenchido | patient_clinical_data.cpf | Sim |
| 3 | Data nascimento | ✅ pré-preenchido | patients.birthdate | Sim |
| 4 | CID-10 comorbidade | 📋 dropdown + busca | lookup_cid10 | Sim |
| 5 | Descrição condição | ✍️ input clínico | texto (template por comorbidade) | Sim |
| 6 | Imunobiológico indicado | 📋 dropdown | tabela vacinas CRIE/PNI | Sim |
| 7 | Justificativa clínica | ✍️ input clínico | texto (template por comorbidade+vacina) | Sim |
| 8 | Validade | 🔒 automático | 12 meses | Sim |
| 9 | Profissional + conselho | 🔒 automático | tenant_doctors | Sim |
| 10 | Data emissão | 🔒 automático | now() | Sim |

---

## Estágio 3: ASSINATURA (BirdID — médico)

### Perfil A: Fluxo contínuo (montagem + assinatura na mesma sessão)

```
Médico preenche formulário
  → Preview do documento
  → Click "Assinar e Gerar"
  → BirdID OAuth (1ª vez) ou token armazenado (próximas)
  → PDF assinado ICP-Brasil
  → Pronto
```

### Perfis B e C: Fluxo separado (backoffice monta, médico assina depois)

```
Backoffice submete formulário → status: 'pending'
  → Push notification ao médico: "Atestado aptidão João Silva pronto"
  → Médico abre /painel/docs/[id]/assinar
  → Visualiza documento (read-only, pode editar campos clínicos se necessário)
  → Três opções:
      ├─ "Assinar" → BirdID API → PDF assinado → status: 'signed'
      ├─ "Editar" → abre campos clínicos para ajuste → "Assinar"
      └─ "Rejeitar" → textarea com motivo → status: 'rejected'
                       → notifica backoffice para corrigir
```

### BirdID Integration

**API:** https://api.birdid.com.br/ (docs: https://docs.vaultid.com.br)
**Autenticação:** OAuth 2.0
**Funcionalidades usadas:**
- Assinatura assíncrona de PDF
- Validação de integridade
- Certificado ICP-Brasil em nuvem (sem token físico)
- Integração S3/Storage para PDFs

**Fluxo OAuth (primeira vez por médico):**
```
GET /api/painel/docs/birdid/connect
  → Redirect para BirdID OAuth
  → Médico autoriza no app BirdID (celular)
  → Callback: /api/painel/docs/birdid/callback
  → Token armazenado encrypted (lib/crypto.ts AES-256-GCM)
  → Próximas assinaturas: one-click (token reusado)
```

**Armazenamento do token:** Campo `birdid_token_enc` em `tenant_members` (por usuário, não por tenant — cada médico tem seu certificado).

---

## Estágio 4: ENTREGA (automático, todos os perfis)

```
PDF assinado → Supabase Storage (bucket: medical-documents)
  ├─ Disponível para download no painel
  ├─ Envio via WhatsApp ao paciente (Baileys) — se autorizado
  ├─ Envio por email — se paciente tem email cadastrado
  └─ TISS especificamente: XML validado disponível para download
     (profissional faz upload manual no portal da operadora)
```

---

## Schema

```sql
-- ═══════════════════════════════════════════════════════════════
-- TABELAS DE LOOKUP (importadas do DataSUS, read-only, sem RLS)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE lookup_cid10 (
  code    text PRIMARY KEY,         -- 'J06.9'
  name    text NOT NULL,            -- 'Infecção aguda das vias aéreas superiores'
  chapter text NOT NULL             -- 'X - Doenças do aparelho respiratório'
);
CREATE INDEX idx_cid10_search ON lookup_cid10
  USING gin(to_tsvector('portuguese', code || ' ' || name));

CREATE TABLE lookup_tuss (
  code    text PRIMARY KEY,         -- '10101012'
  name    text NOT NULL,            -- 'Consulta em consultório'
  grouping text                     -- agrupamento
);
CREATE INDEX idx_tuss_search ON lookup_tuss
  USING gin(to_tsvector('portuguese', code || ' ' || name));

CREATE TABLE lookup_sigtap (
  code      text PRIMARY KEY,
  name      text NOT NULL,
  tuss_code text REFERENCES lookup_tuss(code)
);
CREATE INDEX idx_sigtap_search ON lookup_sigtap
  USING gin(to_tsvector('portuguese', code || ' ' || name));

-- ═══════════════════════════════════════════════════════════════
-- DADOS CLÍNICOS DO PACIENTE (acumulativos, multi-tenant)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE patient_clinical_data (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  patient_id      bigint NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Dados pessoais complementares
  cpf             text,
  cns             text,               -- Cartão Nacional de Saúde
  mother_name     text,
  address         text,

  -- Dados antropométricos
  weight_kg       numeric(5,1),
  height_cm       numeric(5,1),
  blood_type      text CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies       text[],

  -- Convênio
  insurance_provider    text,
  insurance_card_number text,

  -- Condição clínica atual
  primary_cid     text REFERENCES lookup_cid10(code),
  conditions      jsonb DEFAULT '[]',   -- [{cid, description, since, status}]
  medications     jsonb DEFAULT '[]',   -- [{name, dosage, frequency, since}]

  -- Rastreabilidade
  collected_by    text DEFAULT 'manual' CHECK (collected_by IN ('agent','manual','form')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, patient_id)
);

ALTER TABLE patient_clinical_data ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clinical_lookup ON patient_clinical_data(tenant_id, patient_id);

-- ═══════════════════════════════════════════════════════════════
-- DOCUMENTOS MÉDICOS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE medical_documents (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  patient_id      bigint NOT NULL REFERENCES patients(id),
  doctor_id       bigint REFERENCES tenant_doctors(id),

  -- Quem fez o quê
  created_by_user uuid REFERENCES auth.users(id),    -- quem montou
  signed_by_user  uuid REFERENCES auth.users(id),    -- quem assinou

  -- Tipo e status
  doc_type        text NOT NULL CHECK (doc_type IN (
    'aptidao_fisica',
    'tiss_guia',
    'afastamento_inss',
    'lme_alto_custo',
    'vacina_prioritaria'
  )),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- sendo montado
    'pending',      -- aguardando assinatura (perfis B/C)
    'signed',       -- assinado via BirdID
    'rejected',     -- rejeitado pelo médico
    'sent',         -- entregue ao paciente
    'cancelled'
  )),

  -- Conteúdo (snapshot determinístico de todos os campos)
  form_data       jsonb NOT NULL,

  -- Rejeição
  rejection_note  text,

  -- PDF e assinatura digital
  pdf_url         text,                 -- Storage: PDF antes de assinar
  signed_pdf_url  text,                 -- Storage: PDF assinado ICP-Brasil
  birdid_signature_id text,             -- ID da assinatura no BirdID
  signed_at       timestamptz,

  -- TISS específico
  tiss_xml        text,                 -- XML TISS 4.03 gerado

  -- Timestamps
  submitted_at    timestamptz,          -- quando enviado para assinatura
  sent_to_patient_at timestamptz,       -- quando entregue ao paciente
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medical_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_docs_tenant ON medical_documents(tenant_id, status, created_at DESC);
CREATE INDEX idx_docs_pending ON medical_documents(doctor_id, status) WHERE status = 'pending';
CREATE INDEX idx_docs_patient ON medical_documents(patient_id, doc_type);

-- ═══════════════════════════════════════════════════════════════
-- ALTERAÇÕES EM TABELAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════

-- tenants: CNES do estabelecimento
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cnes text;

-- tenant_members: token BirdID por usuário-médico
ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS birdid_token_enc text;
```

## Rotas de API

```
# ─── Lookup (público, sem auth — dados SUS) ───
GET /api/lookup/cid10?q=diabetes           → full-text search, retorna [{code, name}]
GET /api/lookup/tuss?q=consulta            → full-text search
GET /api/lookup/sigtap?q=hemograma         → full-text search

# ─── Dados clínicos do paciente (painel, requireTenant) ───
GET   /api/painel/pacientes/[id]/clinical  → retorna patient_clinical_data
PATCH /api/painel/pacientes/[id]/clinical  → upsert dados clínicos

# ─── Documentos (painel, requireTenant) ───
POST   /api/painel/docs                    → cria draft com form_data
GET    /api/painel/docs                    → lista (filtro: ?status=pending&doctor_id=X)
GET    /api/painel/docs/[id]               → detalhe com form_data
PATCH  /api/painel/docs/[id]               → edita draft (só status=draft)
POST   /api/painel/docs/[id]/submit        → draft → pending (notifica médico)
POST   /api/painel/docs/[id]/sign          → pending → signed (BirdID API)
POST   /api/painel/docs/[id]/reject        → pending → rejected (com nota)
POST   /api/painel/docs/[id]/send          → signed → sent (WhatsApp/email)
DELETE /api/painel/docs/[id]               → cancela (soft delete, status=cancelled)

# ─── BirdID OAuth (por médico) ───
GET    /api/painel/birdid/connect          → inicia OAuth flow
GET    /api/painel/birdid/callback         → persiste token encrypted
```

## RBAC

| Ação | owner | admin | doctor | staff | viewer |
|------|:-----:|:-----:|:------:|:-----:|:------:|
| Ver dados clínicos | ✅ | ✅ | ✅¹ | ✅ | ❌ |
| Editar dados clínicos | ✅ | ✅ | ✅ | ✅ | ❌ |
| Criar draft (montar) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar draft | ✅ | ✅ | ✅ | ✅ | ❌ |
| Submeter para assinatura | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Assinar (BirdID)** | ✅² | ❌ | **✅** | ❌ | ❌ |
| **Rejeitar** | ✅² | ❌ | **✅** | ❌ | ❌ |
| Enviar ao paciente | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver documentos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cancelar | ✅ | ✅ | ✅ | ❌ | ❌ |

¹ Doctor vê apenas seus pacientes (doctor_preference ou documentos onde doctor_id = seu ID)
² Owner pode assinar se também for profissional com certificado BirdID

## Telas no Painel

```
/painel/docs                          → Lista de documentos (filtros por status, tipo)
/painel/docs/novo                     → Wizard: seleciona tipo → seleciona paciente → formulário
/painel/docs/[id]                     → Detalhe + preview PDF
/painel/docs/[id]/editar              → Edição do draft
/painel/docs/[id]/assinar             → Tela de revisão + assinatura (médico)
/painel/configurar/birdid             → Conectar certificado BirdID
```

## Consequences

### O que fica claro:
- O sistema é o MESMO para os 3 perfis — quem opera é que muda
- Campos regulados (CID, TUSS, SIGTAP) são sempre dropdown/autocomplete, nunca texto livre
- Médico no Perfil A faz tudo num fluxo contínuo (montar + assinar)
- Médico nos Perfis B/C recebe documento pronto → revisa → one-click sign
- Add-on Atendimento Singulare ganha mais valor (monta documentos pelo médico)
- Dados clínicos se acumulam — cada documento futuro tem mais campos pré-preenchidos

### O que precisa investigar:
- [ ] BirdID Pro API: pricing, SLA, OAuth flow exato, formato de assinatura
- [ ] Script de importação CID-10 CSV → Supabase (DataSUS download)
- [ ] Script de importação TUSS/SIGTAP → Supabase
- [ ] PDF rendering: avaliar pdf-lib vs @react-pdf vs N8N PDF node
- [ ] Templates de texto sugerido por CID (quem escreve: médico consultor ou IA?)
- [ ] PCDT em formato estruturado: avaliar se existe JSON/CSV ou só PDF
- [ ] Supabase Storage: bucket privado com signed URLs para PDFs
- [ ] BirdID token refresh: qual a validade? precisa de cron para renovar?

### O que fica mais fácil depois:
- Adicionar novos tipos de documento (receita, encaminhamento, atestado genérico)
- Analytics sobre documentos gerados por tenant
- IA usa patient_clinical_data para contexto nas conversas
- Integração com prontuário completo no futuro (se decidir)

### Marketing: módulo independente
Marketing (Vitrine SEO, NPS→Review, Instagram, Google Ads) continua com a arquitetura do plano anterior. Não depende de dados clínicos. Desenvolvido em paralelo.
