# Tool `cobrancas_paciente` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar 1 tool read-only `cobrancas_paciente` no agente interno P03 que retorna extrato financeiro de UM paciente, identificado por id/nome/phone, com totais e items.

**Architecture:** handler em `app/lib/internal-agent/financeiro.ts`, registrado no catálogo `internal-agent-tools.ts` e no barrel `internal-agent-handlers.ts`. Lookup de paciente reusa o mesmo pattern do `consulta_marcar` (id direto OR nome ilike OR phone exato, anti-leak por `tenant_id` filter). Query final em `tenant_payments` via `patient_phone` (chave canônica, schema denormalizado). systemMessage do P03 ganha 1 entrada no domínio Financeiro.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres), N8N self-hosted. Verificação manual via curl no endpoint `/api/interno/tools` (não há framework de teste).

---

## Task 1 — Handler `cobrancasPaciente` em `financeiro.ts`

**Files:**
- Modify: `app/lib/internal-agent/financeiro.ts` — adicionar export `cobrancasPaciente: Handler` no final do arquivo

- [ ] **Step 1.1: Confirmar schema de `patients` (campos id, name, phone, tenant_id)**

Run via `mcp__supabase__execute_sql`:
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='patients'
  and column_name in ('id','tenant_id','name','phone','email')
order by column_name;
```
Esperado: id (uuid), tenant_id (text/varchar), name (text), phone (text), email (text).

Se algum tipo for diferente do esperado, **pause e reporte** — pode mudar a SQL.

- [ ] **Step 1.2: Localizar onde inserir o handler em `financeiro.ts`**

Read `app/lib/internal-agent/financeiro.ts` pra entender estrutura. Já existem `pagamentosStatus`, `pagamentosPendentes` (reads) e `cobrancaAvulsa` (write). Adicionar `cobrancasPaciente` ENTRE `pagamentosPendentes` e `cobrancaAvulsa`.

- [ ] **Step 1.3: Adicionar import necessário (caso falte)**

No topo do arquivo já tem:
```typescript
import { supabaseAdmin } from '../supabase';
import type { Handler, WriteHandler } from './shared';
import { fmtBRL } from './shared';
```

Nenhum import novo necessário.

- [ ] **Step 1.4: Adicionar handler `cobrancasPaciente`**

Inserir o seguinte código em `financeiro.ts`, entre `pagamentosPendentes` (que termina com `};`) e o comentário/declaração de `cobrancaAvulsa`:

```typescript
// ── cobrancas_paciente ────────────────────────────────────────
// Extrato financeiro de 1 paciente. Identifica via id, nome (ilike) OU
// phone (E.164). Match canônico em tenant_payments é por patient_phone
// (tabela e denormalizada, sem FK). RBAC: tenant_id filter em TODA query.
export const cobrancasPaciente: Handler = async (params, ctx) => {
  const patientIdIn = params.patient_id ? String(params.patient_id).trim() : '';
  const patientNameIn = params.patient_name ? String(params.patient_name).trim() : '';
  const patientPhoneIn = params.patient_phone ? String(params.patient_phone).trim() : '';

  if (!patientIdIn && !patientNameIn && !patientPhoneIn) {
    return {
      ok: false,
      summary: 'Sem paciente identificado. Passe patient_id, patient_name ou patient_phone.',
    };
  }

  const admin = supabaseAdmin();

  // 1. Resolver patient_phone (chave canônica)
  let phone = patientPhoneIn;
  let resolvedName = patientNameIn;
  let resolvedEmail = '';

  if (!phone) {
    if (patientIdIn) {
      const { data: pat } = await admin
        .from('patients')
        .select('name, phone, email')
        .eq('id', patientIdIn)
        .eq('tenant_id', ctx.tenant_id)
        .maybeSingle();
      if (!pat) return { ok: false, summary: 'Paciente nao encontrado neste tenant.' };
      phone = pat.phone ?? '';
      resolvedName = pat.name ?? resolvedName;
      resolvedEmail = pat.email ?? '';
      if (!phone) {
        return { ok: false, summary: 'Paciente sem telefone cadastrado — nao da pra buscar cobrancas.' };
      }
    } else {
      // patient_name path
      const { data: matches } = await admin
        .from('patients')
        .select('id, name, phone, email')
        .eq('tenant_id', ctx.tenant_id)
        .ilike('name', `%${patientNameIn}%`)
        .limit(5);
      if (!matches || matches.length === 0) {
        return {
          ok: false,
          summary: `Paciente "${patientNameIn}" nao encontrado.`,
          data: { missing_patient: { name: patientNameIn } },
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          summary: `${matches.length} pacientes batem com "${patientNameIn}". Especifique o ID ou telefone.`,
          data: { ambiguous: matches },
        };
      }
      phone = matches[0].phone ?? '';
      resolvedName = matches[0].name ?? resolvedName;
      resolvedEmail = matches[0].email ?? '';
      if (!phone) {
        return { ok: false, summary: 'Paciente sem telefone cadastrado — nao da pra buscar cobrancas.' };
      }
    }
  }

  // 2. since default = 90 dias atrás
  const since = params.since
    ? String(params.since)
    : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const statusFilter = String(params.status ?? 'all');

  // 3. Query tenant_payments por (tenant_id, patient_phone)
  const { data, error } = await admin
    .from('tenant_payments')
    .select('id, consultation_value, asaas_net_value, status, payment_method, payment_url, created_at, doctor_name, patient_name, patient_email')
    .eq('tenant_id', ctx.tenant_id)
    .eq('patient_phone', phone)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { ok: false, summary: 'Erro ao buscar cobrancas', error: error.message };

  const PAID_STATUSES = new Set(['approved', 'paid', 'received', 'confirmed']);
  const now = Date.now();

  type Classified = 'paid' | 'pending' | 'overdue' | 'other';
  const itemsAll = (data ?? []).map((p) => {
    const status = (p.status ?? '').toLowerCase();
    const daysOpen = Math.floor((now - new Date(p.created_at!).getTime()) / 86_400_000);
    let classification: Classified = 'other';
    if (PAID_STATUSES.has(status)) classification = 'paid';
    else if (status === 'pending') classification = daysOpen > 3 ? 'overdue' : 'pending';
    return {
      id: p.id,
      value: Number(p.consultation_value),
      net_value: p.asaas_net_value !== null ? Number(p.asaas_net_value) : null,
      status: p.status,
      classification,
      payment_method: p.payment_method,
      created_at: p.created_at,
      days_open: daysOpen,
      payment_url: p.payment_url,
      doctor_name: p.doctor_name,
    };
  });

  // 4. Filtro status opcional
  const items = statusFilter === 'all'
    ? itemsAll
    : itemsAll.filter((i) => i.classification === statusFilter);

  // 5. Agrega totais
  const totals = {
    paid: 0, pending: 0, overdue: 0,
    count_paid: 0, count_pending: 0, count_overdue: 0,
  };
  for (const i of items) {
    if (i.classification === 'paid') { totals.paid += i.value; totals.count_paid++; }
    else if (i.classification === 'pending') { totals.pending += i.value; totals.count_pending++; }
    else if (i.classification === 'overdue') { totals.overdue += i.value; totals.count_overdue++; }
  }

  // 6. Summary humano
  const displayName = resolvedName || (items[0]?.patient_name as string | undefined) || 'paciente';
  const parts: string[] = [];
  if (totals.count_paid > 0) parts.push(`${totals.count_paid} paga(s) (${fmtBRL(totals.paid)})`);
  if (totals.count_pending > 0) parts.push(`${totals.count_pending} pendente(s) (${fmtBRL(totals.pending)})`);
  if (totals.count_overdue > 0) parts.push(`${totals.count_overdue} vencida(s) (${fmtBRL(totals.overdue)})`);
  const summary = items.length === 0
    ? `Sem cobrancas pra ${displayName} no periodo (desde ${since}).`
    : `${displayName}: ${parts.join(' • ')}.`;

  return {
    ok: true,
    summary,
    data: {
      patient: { name: displayName, phone, email: resolvedEmail || undefined },
      totals,
      items,
    },
  };
};
```

- [ ] **Step 1.5: Verificar tsc**

Run: `cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'financeiro\.ts|internal-agent' | head -10`

Esperado: nenhum erro relacionado a `financeiro.ts` ou `internal-agent`. (Erros em outros arquivos como `NovoDocView.tsx` são pre-existentes e podem ser ignorados.)

- [ ] **Step 1.6: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent/financeiro.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): handler cobrancas_paciente (read)"
```

---

## Task 2 — Registrar tool em `internal-agent-tools.ts`

**Files:**
- Modify: `app/lib/internal-agent-tools.ts`

- [ ] **Step 2.1: Localizar `pagamentos_pendentes` no `TOOL_CATALOG`**

Read `app/lib/internal-agent-tools.ts`. Procure por `name: 'pagamentos_pendentes'`. A entrada de `cobrancas_paciente` vai logo DEPOIS dela (mesma seção Financeiro).

- [ ] **Step 2.2: Inserir entry no `TOOL_CATALOG`**

Imediatamente após o objeto `pagamentos_pendentes` (que termina com `},`), inserir:

```typescript
  {
    name: 'cobrancas_paciente',
    description: 'Extrato financeiro de UM paciente. Identifica via patient_id, patient_name (busca fuzzy) ou patient_phone (E.164). Retorna pagas/pendentes/vencidas com totais. Use pra "cobranças da Maria", "quanto X me deve", "status financeiro do paciente Y". Se nome ambiguo devolve lista pra desambiguar; se 0 matches retorna erro semantico.',
    mode: 'read',
    min_role: 'doctor',
    params: {
      patient_id:    { type: 'string', description: 'UUID do paciente (preferencial se ja souber)' },
      patient_name:  { type: 'string', description: 'Nome do paciente (busca ilike, fuzzy)' },
      patient_phone: { type: 'string', description: 'Telefone E.164 (+5511999999999) — match canonico em tenant_payments' },
      since:         { type: 'date',   description: 'Data inicial (default: 90 dias atras)' },
      status:        { type: 'enum', enum: ['paid','pending','overdue','all'], default: 'all', description: 'Filtra por classificacao' },
    },
  },
```

- [ ] **Step 2.3: Adicionar PARAM_ALIASES PT**

Localizar o objeto `PARAM_ALIASES` no mesmo arquivo. Adicionar entrada:

```typescript
  cobrancas_paciente: {
    paciente_id: 'patient_id',
    paciente:    'patient_name',
    nome:        'patient_name',
    telefone:    'patient_phone',
    desde:       'since',
  },
```

- [ ] **Step 2.4: Verificar tsc**

Run: `cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'internal-agent-tools' | head -5`

Esperado: nenhum erro.

- [ ] **Step 2.5: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent-tools.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): registrar cobrancas_paciente em TOOL_CATALOG + alias PT"
```

---

## Task 3 — Wire no barrel `internal-agent-handlers.ts`

**Files:**
- Modify: `app/lib/internal-agent-handlers.ts`

- [ ] **Step 3.1: Adicionar import + entrada no `HANDLERS`**

Localizar o import da seção financeiro:
```typescript
import { pagamentosStatus, pagamentosPendentes, cobrancaAvulsa } from './internal-agent/financeiro';
```
Trocar pra:
```typescript
import { pagamentosStatus, pagamentosPendentes, cobrancasPaciente, cobrancaAvulsa } from './internal-agent/financeiro';
```

No objeto `HANDLERS`, adicionar entry depois de `pagamentos_pendentes: pagamentosPendentes,`:
```typescript
  cobrancas_paciente: cobrancasPaciente,
```

- [ ] **Step 3.2: Verificar tsc**

Run: `cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'internal-agent-handlers' | head -5`

Esperado: nenhum erro.

- [ ] **Step 3.3: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent-handlers.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): expor cobrancas_paciente no barrel HANDLERS"
```

---

## Task 4 — Patch systemMessage P03 no N8N

**Files:**
- Modify: `n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json`
- Backup: `.n8n-backups/p03-EaZNHoaKhq0yJsiS-pre-cobrancas-<TIMESTAMP>.json`

- [ ] **Step 4.1: Backup local do workflow P03**

```bash
cp /Users/luizflavioxavierdesa/Desktop/vivassit/n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json \
   /Users/luizflavioxavierdesa/Desktop/vivassit/.n8n-backups/p03-EaZNHoaKhq0yJsiS-pre-cobrancas-$(date +%Y%m%d-%H%M%S).json
```

- [ ] **Step 4.2: Adicionar entry no systemMessage**

Run o script Python abaixo. Ele acha a linha exata de `pagamentos_pendentes` no domínio "Financeiro" do systemMessage e insere `cobrancas_paciente` logo depois.

```bash
python3 << 'PYEOF'
import json, sys
path = '/Users/luizflavioxavierdesa/Desktop/vivassit/n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json'
with open(path) as f: wf = json.load(f)
target = next(n for n in wf['nodes'] if n['name'] == 'Agente Interno Singulare')
sm = target['parameters']['options']['systemMessage']

ANCHOR = '- pagamentos_pendentes    → { include_overdue_only?: boolean }'
NEW_LINE = '\n- cobrancas_paciente      → { patient_id? OR patient_name? OR patient_phone? (E.164), since?: "YYYY-MM-DD" (default 90d), status?: "paid"|"pending"|"overdue"|"all" } — extrato financeiro de UM paciente. Use pra "cobrancas da Maria", "quanto X deve". Ambiguous/missing igual a consulta_marcar.'

if ANCHOR not in sm:
    print("ANCHOR not found — abort"); sys.exit(1)
if 'cobrancas_paciente' in sm:
    print("ALREADY patched — skip"); sys.exit(0)

target['parameters']['options']['systemMessage'] = sm.replace(ANCHOR, ANCHOR + NEW_LINE)
with open(path, 'w') as f: json.dump(wf, f, ensure_ascii=False, indent=2)
print(f"OK old_len={len(sm)} new_len={len(target['parameters']['options']['systemMessage'])}")
PYEOF
```

Esperado: `OK old_len=XXXX new_len=YYYY` com YYYY > XXXX.

Se o `ANCHOR` não bater (ex: usuário editou systemMessage manual depois), o script aborta — abrir o file e localizar a região "Financeiro" do CATÁLOGO POR DOMÍNIO, inserir manualmente após `pagamentos_pendentes`.

- [ ] **Step 4.3: Push do workflow pro N8N (PUT direto, NÃO `update_partial`)**

```bash
set -a && . /Users/luizflavioxavierdesa/Desktop/vivassit/app/.env.local && set +a && \
node -e '
const fs=require("fs");
const wf=JSON.parse(fs.readFileSync("/Users/luizflavioxavierdesa/Desktop/vivassit/n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json","utf8"));
const allowed=["name","nodes","connections","staticData"];
const payload={};for(const k of allowed)if(wf[k]!==undefined)payload[k]=wf[k];
const es=wf.settings||{};
payload.settings={executionOrder:"v1"};
if(es.timezone) payload.settings.timezone=es.timezone;
if(es.errorWorkflow) payload.settings.errorWorkflow=es.errorWorkflow;
fs.writeFileSync("/tmp/p03-push.json",JSON.stringify(payload));
' && curl -sS -X PUT "https://n8n.singulare.org/api/v1/workflows/EaZNHoaKhq0yJsiS" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data-binary @/tmp/p03-push.json -w "\nHTTP %{http_code}\n" -o /tmp/p03-resp.json && \
node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/p03-resp.json","utf8"));
const n=r.nodes.find(x=>x.name==="Agente Interno Singulare");
const sm=n.parameters.options.systemMessage;
console.log("active:",r.active,"sm_chars:",sm.length,"has_cobrancas_paciente:",sm.includes("cobrancas_paciente"));
'
rm -f /tmp/p03-push.json /tmp/p03-resp.json
```

Esperado: `HTTP 200`, `active: true`, `has_cobrancas_paciente: true`.

- [ ] **Step 4.4: Commit do JSON local**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): systemMessage P03 com tool cobrancas_paciente"
```

---

## Task 5 — Push pra main + smoke test ponta a ponta

**Files:** nenhum a modificar — só push e validação.

- [ ] **Step 5.1: Push de todos os commits anteriores**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit push origin main 2>&1 | tail -3
```

Esperado: push OK, Vercel inicia deploy.

- [ ] **Step 5.2: Aguardar Vercel ready**

Via MCP Vercel:
```
mcp__claude_ai_Vercel__list_deployments com projectId="prj_HTYSHEBUacKN8hGBeGP4XugfeIz9", teamId="team_bt7LVA71g3zN0Brw0PV1jHk7"
```

Verificar que o deployment do último commit está com `state: "READY"`. Pode levar 1-3 minutos.

- [ ] **Step 5.3: Smoke 1 — paciente identificado por phone direto**

Buscar um phone real de um paciente da Paula via Supabase:
```sql
select id, name, phone from patients
where tenant_id='singulare' and phone is not null
order by created_at desc limit 1;
```

Anotar o phone retornado. Depois rodar o curl:
```bash
set -a && . /Users/luizflavioxavierdesa/Desktop/vivassit/app/.env.local && set +a && \
curl -sS -X POST "https://app.singulare.org/api/interno/tools" \
  -H "Authorization: Bearer $N8N_TO_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"cobrancas_paciente",
    "tenant_id":"singulare",
    "user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3",
    "role":"owner",
    "params":{"patient_phone":"<PHONE_DO_PASSO_ANTERIOR>"}
  }' | head -50
```

Esperado: `ok:true`, `summary` legível, `data.patient`, `data.totals`, `data.items[]`. Mesmo que o paciente não tenha cobranças, retorna `ok:true` com items vazios e summary "Sem cobrancas pra X no periodo".

- [ ] **Step 5.4: Smoke 2 — paciente identificado por nome único**

Buscar um nome único:
```sql
select name, count(*) as ct from patients
where tenant_id='singulare' group by name having count(*) = 1 order by name limit 5;
```

Pegar um e:
```bash
curl -sS -X POST "https://app.singulare.org/api/interno/tools" \
  -H "Authorization: Bearer $N8N_TO_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"cobrancas_paciente",
    "tenant_id":"singulare",
    "user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3",
    "role":"owner",
    "params":{"patient_name":"<NOME>"}
  }'
```

Esperado: `ok:true` (encontrou pelo nome, resolveu pra phone, fez query).

- [ ] **Step 5.5: Smoke 3 — paciente inexistente**

```bash
curl -sS -X POST "https://app.singulare.org/api/interno/tools" \
  -H "Authorization: Bearer $N8N_TO_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"cobrancas_paciente",
    "tenant_id":"singulare",
    "user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3",
    "role":"owner",
    "params":{"patient_name":"FantasiaNomeQueNaoExiste123"}
  }'
```

Esperado: `ok:false`, `summary` com "Paciente ... nao encontrado", `data.missing_patient`.

- [ ] **Step 5.6: Smoke 4 — anti-leak cross-tenant**

```bash
# patient_id de outro tenant (qualquer UUID que existe em patients mas tenant diferente)
# Se nao houver outro tenant ativo em prod, simular passando UUID aleatorio:
curl -sS -X POST "https://app.singulare.org/api/interno/tools" \
  -H "Authorization: Bearer $N8N_TO_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"cobrancas_paciente",
    "tenant_id":"singulare",
    "user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3",
    "role":"owner",
    "params":{"patient_id":"00000000-0000-0000-0000-000000000000"}
  }'
```

Esperado: `ok:false`, `summary` "Paciente nao encontrado neste tenant." (não retorna dados de outro tenant).

---

## Critérios de aceite (do spec)

- [x] Tool `cobrancas_paciente` registrada em `TOOL_CATALOG` com `mode: 'read'`, `min_role: 'doctor'` — Task 2
- [x] Handler responde nos 4 cenários (id válido, nome único, nome ambíguo, nome não encontrado) — Task 1 + Smoke 5.3/5.4/5.5
- [x] Cross-tenant retorna erro semântico — Smoke 5.6
- [x] Summary legível com totais — Task 1.4 Step 6 do código
- [x] `data.items[]` inclui `payment_url` — Task 1.4 código retorna esse campo
- [x] systemMessage P03 atualizado e pushed — Task 4
- [x] Smoke via curl `/api/interno/tools` — Task 5
