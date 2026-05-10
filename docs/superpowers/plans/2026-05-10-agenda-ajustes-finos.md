# Agenda — Ajustes Finos via Agente Interno (P03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar 4 tools no agente interno P03 (`horarios_livres`, `consulta_marcar`, `bloquear_horario`, `working_hours_atualizar`) cobrindo o ciclo de manipulação da agenda, com 1 tabela nova (`doctor_schedule_blocks`) e 1 extensão pequena no chat-drawer pra confirmação por digitação literal.

**Architecture:** handlers em `app/lib/internal-agent-handlers.ts` (4 novos), declarados em `app/lib/internal-agent-tools.ts` (catálogo). Helper compartilhado `app/lib/agenda-availability.ts` calcula slots livres por interseção `working_hours − doctor_bookings − doctor_schedule_blocks`. Cards de propose seguem schema genérico existente; só `working_hours_atualizar` precisa de campo novo `confirmation_phrase` na tipagem do `ActionCard`. systemMessage do P03 (workflow `EaZNHoaKhq0yJsiS` no N8N) ganha 4 entradas no `<GUIA_DE_FERRAMENTAS>`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), N8N self-hosted (Gemini agent), nenhum framework de teste — verificação manual via SQL/curl/browser.

---

## Task 1 — Migration `doctor_schedule_blocks` + RLS

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_doctor_schedule_blocks.sql` (TIMESTAMP = `date +%Y%m%d%H%M%S` no momento)

- [ ] **Step 1.1: Conferir RLS atual de `doctor_bookings`**

Run: `mcp__supabase__execute_sql` com:
```sql
select polname, polcmd, polqual, polwithcheck
from pg_policy where polrelid = 'public.doctor_bookings'::regclass;
```

Anotar os qual/withcheck — vou replicar exatamente o mesmo padrão na nova tabela. Esperado: política liga a tabela ao tenant via `tenant_members.tenant_id = auth.uid()` ou similar.

- [ ] **Step 1.2: Escrever a migration**

Conteúdo do arquivo (substituir `<RLS_QUAL>` pelo qual real coletado em 1.1):

```sql
-- Tabela de bloqueios esporádicos de agenda (almoço, ausência pontual, etc).
-- Independente de doctor_bookings: doctor_bookings = consultas com paciente,
-- doctor_schedule_blocks = indisponibilidade sem paciente.

create table public.doctor_schedule_blocks (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null references public.tenants(id) on delete cascade,
  doctor_id uuid not null references public.tenant_doctors(id) on delete cascade,
  start_at timestamptz not null,
  end_at   timestamptz not null,
  reason   text,
  source   text not null default 'painel'
           check (source in ('agente','painel','google_cal')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index doctor_schedule_blocks_lookup
  on public.doctor_schedule_blocks (tenant_id, doctor_id, start_at);

alter table public.doctor_schedule_blocks enable row level security;

-- Política idêntica em forma à de doctor_bookings (substitua <RLS_QUAL>):
create policy doctor_schedule_blocks_tenant_isolation
  on public.doctor_schedule_blocks
  for all
  using ( <RLS_QUAL> )
  with check ( <RLS_QUAL> );
```

- [ ] **Step 1.3: Aplicar migration via MCP**

Run: `mcp__supabase__apply_migration` com `name = "doctor_schedule_blocks"` e o SQL acima.
Esperado: response `success: true`.

- [ ] **Step 1.4: Verificar tabela criada**

Run: `mcp__supabase__execute_sql` com:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='doctor_schedule_blocks'
order by ordinal_position;
```
Esperado: 9 linhas (id, tenant_id, doctor_id, start_at, end_at, reason, source, created_by, created_at).

- [ ] **Step 1.5: Smoke RLS — tentar SELECT cross-tenant**

Run: `mcp__supabase__execute_sql` com:
```sql
-- Isso roda como service_role (bypass RLS), só pra validar que tabela existe e está vazia.
select count(*) from public.doctor_schedule_blocks;
```
Esperado: 0.

A validação real de RLS vai ser feita end-to-end na Task 7 (smoke E2E no painel).

- [ ] **Step 1.6: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add supabase/migrations/*_doctor_schedule_blocks.sql
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(db): tabela doctor_schedule_blocks pra bloqueios esporadicos de agenda"
```

---

## Task 2 — Helper `agenda-availability.ts` (cálculo de slots livres)

**Files:**
- Create: `app/lib/agenda-availability.ts`

- [ ] **Step 2.1: Conferir formato de `working_hours`**

Run no Supabase:
```sql
select doctor_name, working_hours from public.tenant_doctors
where tenant_id='singulare' limit 1;
```
Esperado: JSON tipo `{"seg":"14:00-18:00","ter":"fechado", ...}`. Se for outro formato, ajustar parser na Step 2.2.

- [ ] **Step 2.2: Escrever helper**

Conteúdo de `app/lib/agenda-availability.ts`:

```typescript
/**
 * Cálculo de slots livres a partir de working_hours menos ocupações
 * (doctor_bookings + doctor_schedule_blocks). Usado por horarios_livres,
 * consulta_marcar (validação), bloquear_horario (preview de conflitos).
 *
 * working_hours esperado em tenant_doctors: { seg: "HH:MM-HH:MM"|"fechado", ter: ..., ... dom: ... }
 */

export interface TimeRange {
  start: Date;
  end: Date;
}

export type DayKey = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

const DAY_KEYS: DayKey[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export function dayKeyOf(d: Date): DayKey {
  return DAY_KEYS[d.getDay()];
}

/**
 * Parse "14:00-18:00" → {startMin: 840, endMin: 1080} (em minutos do dia).
 * "fechado" ou inválido → null.
 */
export function parseDayWindow(spec: unknown): { startMin: number; endMin: number } | null {
  if (typeof spec !== 'string') return null;
  const s = spec.trim().toLowerCase();
  if (!s || s === 'fechado') return null;
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

/**
 * Gera slots de `slotMinutes` cobrindo a janela [startMin, endMin) do dia `date` (na TZ do servidor).
 * Retorna lista de TimeRange.
 */
export function generateDaySlots(date: Date, startMin: number, endMin: number, slotMinutes: number): TimeRange[] {
  const slots: TimeRange[] = [];
  const baseY = date.getFullYear();
  const baseM = date.getMonth();
  const baseD = date.getDate();
  for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
    const sh = Math.floor(m / 60);
    const sm = m % 60;
    const eh = Math.floor((m + slotMinutes) / 60);
    const em = (m + slotMinutes) % 60;
    slots.push({
      start: new Date(baseY, baseM, baseD, sh, sm, 0, 0),
      end: new Date(baseY, baseM, baseD, eh, em, 0, 0),
    });
  }
  return slots;
}

/**
 * True se r1 e r2 se sobrepõem (qualquer minuto em comum).
 */
export function overlaps(r1: TimeRange, r2: TimeRange): boolean {
  return r1.start < r2.end && r2.start < r1.end;
}

/**
 * Retorna os slots de `slots` que NÃO se sobrepõem a NENHUM ocupado em `busy`.
 */
export function subtractBusy(slots: TimeRange[], busy: TimeRange[]): TimeRange[] {
  if (busy.length === 0) return slots;
  return slots.filter((s) => !busy.some((b) => overlaps(s, b)));
}

/**
 * Itera dias entre `start` e `end` (inclusive), pra cada dia consulta
 * working_hours[diaSemana] e gera slots de `slotMinutes`. Retorna o conjunto
 * resultante após subtrair `busy`.
 */
export function calcAvailableSlots(args: {
  start: Date;
  end: Date;
  workingHours: Record<string, unknown>;
  busy: TimeRange[];
  slotMinutes: number;
}): TimeRange[] {
  const out: TimeRange[] = [];
  const cursor = new Date(args.start.getFullYear(), args.start.getMonth(), args.start.getDate());
  const endDay = new Date(args.end.getFullYear(), args.end.getMonth(), args.end.getDate());
  while (cursor <= endDay) {
    const win = parseDayWindow(args.workingHours[dayKeyOf(cursor)]);
    if (win) {
      const daySlots = generateDaySlots(cursor, win.startMin, win.endMin, args.slotMinutes);
      out.push(...subtractBusy(daySlots, args.busy));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
```

- [ ] **Step 2.3: Smoke test manual via tsx**

Run:
```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsx -e '
import { calcAvailableSlots } from "./lib/agenda-availability";
const slots = calcAvailableSlots({
  start: new Date("2026-05-12T00:00:00-03:00"),
  end: new Date("2026-05-12T23:59:00-03:00"),
  workingHours: { seg:"fechado", ter:"14:00-17:00", qua:"fechado", qui:"fechado", sex:"fechado", sab:"fechado", dom:"fechado" },
  busy: [{ start: new Date("2026-05-12T15:00:00-03:00"), end: new Date("2026-05-12T15:30:00-03:00") }],
  slotMinutes: 30,
});
console.log("slots:", slots.length, slots.map(s => s.start.toISOString()).join(", "));
'
```
Esperado: 5 slots (14:00, 14:30, 15:30, 16:00, 16:30) — o 15:00 foi subtraído.

- [ ] **Step 2.4: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/agenda-availability.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): helper agenda-availability pra calcular slots livres"
```

---

## Task 3 — Tool `horarios_livres` (read)

**Files:**
- Modify: `app/lib/internal-agent-tools.ts` (adicionar 1 entrada no `TOOL_CATALOG`)
- Modify: `app/lib/internal-agent-handlers.ts` (handler novo + entrada em `HANDLERS`)

- [ ] **Step 3.1: Adicionar entrada no catálogo**

Em `app/lib/internal-agent-tools.ts`, dentro de `TOOL_CATALOG`, na seção READ — Agenda (após `agenda_periodo`), inserir:

```typescript
  {
    name: 'horarios_livres',
    description: 'Lista slots livres (default 30min) num intervalo, intersectando working_hours menos consultas e bloqueios. Use pra "tem vaga", "horários livres", "quando posso encaixar".',
    mode: 'read',
    min_role: 'viewer',
    params: {
      start: { type: 'date', required: true, description: 'Data inicial ISO YYYY-MM-DD' },
      end:   { type: 'date', required: true, description: 'Data final ISO YYYY-MM-DD (inclusiva, máx 28 dias após start)' },
      slot_minutes: { type: 'number', default: 30, description: 'Granularidade dos slots em minutos (default 30)' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner pode filtrar; doctor é sempre filtrado pelo próprio)' },
    },
  },
```

- [ ] **Step 3.2: Implementar handler**

Em `app/lib/internal-agent-handlers.ts`, importar o helper no topo (junto com outros imports):

```typescript
import { calcAvailableSlots } from './agenda-availability';
```

Adicionar o handler antes de `// WRITE HANDLERS (Sprint 2)`:

```typescript
const horariosLivres: Handler = async (params, ctx) => {
  const startStr = String(params.start ?? '');
  const endStr = String(params.end ?? '');
  if (!startStr || !endStr) {
    return { ok: false, summary: 'Faltam start e end (YYYY-MM-DD).' };
  }
  const start = new Date(`${startStr}T00:00:00-03:00`);
  const end = new Date(`${endStr}T23:59:59-03:00`);
  if (isNaN(+start) || isNaN(+end)) {
    return { ok: false, summary: 'Datas inválidas.' };
  }
  const diffDays = Math.floor((+end - +start) / 86_400_000);
  if (diffDays < 0 || diffDays > 28) {
    return { ok: false, summary: 'Janela inválida (0-28 dias).' };
  }
  const slotMinutes = Math.max(15, Math.min(120, Number(params.slot_minutes ?? 30)));

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
  const admin = supabaseAdmin();

  // Resolve médico(s) e working_hours
  let doctorsQuery = admin
    .from('tenant_doctors')
    .select('id, doctor_name, working_hours')
    .eq('tenant_id', ctx.tenant_id)
    .eq('active', true);
  if (scope.doctor_id) doctorsQuery = doctorsQuery.eq('id', scope.doctor_id);
  const { data: doctors, error: docErr } = await doctorsQuery;
  if (docErr) return { ok: false, summary: 'Erro ao buscar médicos', error: docErr.message };
  if (!doctors || doctors.length === 0) {
    return { ok: true, summary: 'Nenhum médico encontrado.', data: { slots: [], total: 0 } };
  }

  const result: Array<{ doctor_id: string; doctor_name: string; start: string; end: string }> = [];

  for (const doc of doctors) {
    // Bookings ocupados
    const { data: bookings } = await admin
      .from('doctor_bookings')
      .select('slot_start, slot_end')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', doc.id)
      .neq('status', 'cancelled')
      .gte('slot_start', start.toISOString())
      .lte('slot_start', end.toISOString());

    // Bloqueios
    const { data: blocks } = await admin
      .from('doctor_schedule_blocks')
      .select('start_at, end_at')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', doc.id)
      .gte('start_at', start.toISOString())
      .lte('start_at', end.toISOString());

    const busy = [
      ...(bookings ?? []).map((b) => ({ start: new Date(b.slot_start), end: new Date(b.slot_end) })),
      ...(blocks ?? []).map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
    ];

    const free = calcAvailableSlots({
      start, end,
      workingHours: (doc.working_hours as Record<string, unknown>) ?? {},
      busy,
      slotMinutes,
    });

    for (const s of free) {
      result.push({
        doctor_id: doc.id,
        doctor_name: doc.doctor_name,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      });
    }
  }

  return {
    ok: true,
    summary: `${result.length} slot(s) livre(s) entre ${startStr} e ${endStr}.`,
    data: { slots: result, total: result.length },
  };
};
```

- [ ] **Step 3.3: Registrar em `HANDLERS`**

Em `app/lib/internal-agent-handlers.ts`, no objeto `export const HANDLERS`, adicionar:

```typescript
  horarios_livres: horariosLivres,
```

- [ ] **Step 3.4: Smoke test via curl no dev local**

Pré-requisito: `npm run dev` rodando em outra aba. Substituir `<TOKEN>` pelo `N8N_TO_VERCEL_TOKEN` do `.env.local`.

```bash
curl -s -X POST http://localhost:3000/api/interno/tools \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"tool":"horarios_livres","tenant_id":"singulare","user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3","role":"owner","params":{"start":"2026-05-11","end":"2026-05-17"}}'
```
Esperado: JSON com `ok:true`, `data.slots[]` com slots no formato ISO, `data.total > 0` se Paula tiver janela na próxima semana.

- [ ] **Step 3.5: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent-tools.ts app/lib/internal-agent-handlers.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): tool horarios_livres (read)"
```

---

## Task 4 — Tool `consulta_marcar` (write propose+execute)

**Files:**
- Modify: `app/lib/internal-agent-tools.ts`
- Modify: `app/lib/internal-agent-handlers.ts`

- [ ] **Step 4.1: Adicionar entrada no catálogo**

Em `app/lib/internal-agent-tools.ts`, na seção WRITES (junto com `consulta_reagendar`):

```typescript
  {
    name: 'consulta_marcar',
    description: 'Marca nova consulta. Em propose, valida slot livre e devolve preview. Se nome ambíguo (>1 paciente match) devolve lista pra desambiguação. Se 0 matches, peça pra criar paciente antes via paciente_criar.',
    mode: 'write',
    min_role: 'doctor',
    params: {
      patient_id:       { type: 'string', description: 'UUID do paciente (preferível se já souber)' },
      patient_name:     { type: 'string', description: 'Nome do paciente (busca por nome+phone se patient_id ausente)' },
      patient_phone:    { type: 'string', description: 'Telefone E.164 (ex: +5511999999999) — opcional, ajuda desambiguar' },
      slot_start:       { type: 'string', required: true, description: 'ISO YYYY-MM-DDTHH:mm (sem timezone, assume -03:00)' },
      duration_minutes: { type: 'number', default: 60, description: 'Duração em minutos (default 60)' },
      doctor_id:        { type: 'string', description: 'UUID do médico (admin/owner; doctor é o próprio)' },
      notes:            { type: 'string', description: 'Observações livres' },
    },
  },
```

- [ ] **Step 4.2: Implementar handler**

Em `app/lib/internal-agent-handlers.ts`, na seção WRITE HANDLERS (após `consultaReagendar`):

```typescript
// ── consulta_marcar ─────────────────────────────────────────
// Cria nova consulta em doctor_bookings. Source-of-truth: NÃO sincroniza
// pro Google Calendar nesta versão (calendar_event_id fica null). Próxima
// sync feita por job separado se houver.
const consultaMarcar: WriteHandler = {
  async propose(params, ctx) {
    const slotStartStr = String(params.slot_start ?? '');
    if (!slotStartStr) return { ok: false, summary: 'slot_start obrigatório.' };
    const slotStart = new Date(slotStartStr.includes('Z') || /[+-]\d\d:\d\d$/.test(slotStartStr)
      ? slotStartStr : `${slotStartStr}-03:00`);
    if (isNaN(+slotStart)) return { ok: false, summary: 'slot_start inválido.' };
    const duration = Math.max(15, Math.min(240, Number(params.duration_minutes ?? 60)));
    const slotEnd = new Date(+slotStart + duration * 60_000);

    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo. Admin/owner deve passar doctor_id ou usar medicos_listar primeiro.' };

    const admin = supabaseAdmin();

    // Resolver paciente
    let patientId = params.patient_id ? String(params.patient_id) : null;
    let patientName = params.patient_name ? String(params.patient_name) : '';
    let patientPhone = params.patient_phone ? String(params.patient_phone) : '';
    if (!patientId) {
      let pq = admin.from('patients').select('id, name, phone').eq('tenant_id', ctx.tenant_id);
      if (patientName) pq = pq.ilike('name', `%${patientName}%`);
      if (patientPhone) pq = pq.eq('phone', patientPhone);
      const { data: matches } = await pq.limit(5);
      if (!matches || matches.length === 0) {
        return {
          ok: false,
          summary: `Paciente "${patientName || patientPhone}" não encontrado. Use paciente_criar antes.`,
          data: { missing_patient: { name: patientName, phone: patientPhone } },
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          summary: `${matches.length} pacientes batem com "${patientName}". Especifique o ID ou telefone.`,
          data: { ambiguous: matches },
        };
      }
      patientId = matches[0].id;
      patientName = matches[0].name;
      patientPhone = matches[0].phone ?? '';
    } else {
      const { data: pat } = await admin.from('patients').select('name, phone').eq('id', patientId).maybeSingle();
      patientName = pat?.name ?? patientName;
      patientPhone = pat?.phone ?? patientPhone;
    }

    // Conflitos
    const { data: conflictBookings } = await admin
      .from('doctor_bookings')
      .select('id, patient_name, slot_start, slot_end')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .neq('status', 'cancelled')
      .lt('slot_start', slotEnd.toISOString())
      .gt('slot_end', slotStart.toISOString());
    const { data: conflictBlocks } = await admin
      .from('doctor_schedule_blocks')
      .select('id, reason, start_at, end_at')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .lt('start_at', slotEnd.toISOString())
      .gt('end_at', slotStart.toISOString());
    if ((conflictBookings?.length ?? 0) > 0 || (conflictBlocks?.length ?? 0) > 0) {
      return {
        ok: false,
        summary: 'Conflito: slot ocupado por consulta ou bloqueio existente.',
        data: { conflict: { bookings: conflictBookings ?? [], blocks: conflictBlocks ?? [] } },
      };
    }

    const slotFmt = fmtDate(slotStart.toISOString());
    return {
      ok: true,
      summary: `Marcar consulta de ${patientName} em ${slotFmt}?`,
      card: {
        summary: `Marcar consulta`,
        detail: `Paciente: ${patientName}${patientPhone ? ` (${patientPhone})` : ''}\nQuando: ${slotFmt}\nDuração: ${duration} min${params.notes ? `\nNotas: ${String(params.notes)}` : ''}`,
        confirm_label: 'Confirmar agendamento',
        cancel_label: 'Voltar',
        action: {
          tool: 'consulta_marcar',
          params: {
            patient_id: patientId,
            slot_start: slotStart.toISOString(),
            duration_minutes: duration,
            doctor_id: scope.doctor_id,
            notes: params.notes ?? null,
          },
        },
      },
      data: { patient: { id: patientId, name: patientName, phone: patientPhone }, slot_start: slotStart.toISOString(), slot_end: slotEnd.toISOString() },
    };
  },

  async execute(params, ctx) {
    const slotStart = new Date(String(params.slot_start));
    const duration = Number(params.duration_minutes ?? 60);
    const slotEnd = new Date(+slotStart + duration * 60_000);
    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem doctor_id no escopo.' };

    const admin = supabaseAdmin();

    // Re-validar paciente
    const { data: patient } = await admin
      .from('patients').select('id, name, phone').eq('id', String(params.patient_id))
      .eq('tenant_id', ctx.tenant_id).maybeSingle();
    if (!patient) return { ok: false, summary: 'Paciente não encontrado no execute.' };

    const { data, error } = await admin.from('doctor_bookings').insert({
      tenant_id: ctx.tenant_id,
      doctor_id: scope.doctor_id,
      patient_id: patient.id,
      patient_name: patient.name,
      patient_phone: patient.phone,
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      duration_minutes: duration,
      status: 'booked',
      notes: params.notes ? String(params.notes) : null,
    }).select('id, slot_start').maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao criar consulta', error: error.message };
    return { ok: true, summary: `Consulta criada (id ${data?.id}).`, data: { booking: data } };
  },
};
```

- [ ] **Step 4.3: Registrar em `WRITE_HANDLERS`**

```typescript
  consulta_marcar: consultaMarcar,
```

- [ ] **Step 4.4: Smoke teste — propose com nome ambíguo**

(precisa de pelo menos 2 pacientes com nomes parecidos no tenant — se não houver, criar via SQL ou pular)

```bash
curl -s -X POST http://localhost:3000/api/interno/tools \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"tool":"consulta_marcar","mode":"propose","tenant_id":"singulare","user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3","role":"owner","params":{"patient_name":"Maria","slot_start":"2026-05-15T14:00","duration_minutes":60}}'
```
Esperado: `ok:false` se houver múltiplas Marias OU `ok:true` com card se uma só.

- [ ] **Step 4.5: Smoke teste — propose com paciente único + execute**

Substituir `<PATIENT_UUID>` por um id real:
```bash
curl -s -X POST http://localhost:3000/api/interno/tools \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"tool":"consulta_marcar","mode":"propose","tenant_id":"singulare","user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3","role":"owner","params":{"patient_id":"<PATIENT_UUID>","slot_start":"2026-05-22T15:00","duration_minutes":60}}'
```
Esperado: `ok:true` + `card`.

Depois execute (mesmos params, `mode:"execute"`). Esperado: `ok:true`, retorna booking criado.

Validar no banco:
```sql
select id, patient_name, slot_start, status from public.doctor_bookings
where tenant_id='singulare' and slot_start = '2026-05-22T15:00:00-03:00';
```

Limpar o booking de teste:
```sql
delete from public.doctor_bookings where id = '<id_retornado>';
```

- [ ] **Step 4.6: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent-tools.ts app/lib/internal-agent-handlers.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): tool consulta_marcar (write propose+execute)"
```

---

## Task 5 — Tool `bloquear_horario` (write propose+execute)

**Files:**
- Modify: `app/lib/internal-agent-tools.ts`
- Modify: `app/lib/internal-agent-handlers.ts`

- [ ] **Step 5.1: Adicionar entrada no catálogo**

```typescript
  {
    name: 'bloquear_horario',
    description: 'Bloqueia uma janela na agenda do médico (almoço, ausência, dentista). Em propose mostra preview e lista bookings que caem dentro (apenas aviso, não recusa).',
    mode: 'write',
    min_role: 'doctor',
    params: {
      start: { type: 'string', required: true, description: 'ISO YYYY-MM-DDTHH:mm (assume -03:00 se sem TZ)' },
      end:   { type: 'string', required: true, description: 'ISO YYYY-MM-DDTHH:mm' },
      reason: { type: 'string', description: 'Motivo livre (ex: "almoço", "consulta médica")' },
      doctor_id: { type: 'string', description: 'UUID do médico (admin/owner; doctor é o próprio)' },
    },
  },
```

- [ ] **Step 5.2: Implementar handler**

```typescript
const bloquearHorario: WriteHandler = {
  async propose(params, ctx) {
    const startStr = String(params.start ?? '');
    const endStr = String(params.end ?? '');
    const norm = (s: string) => /[Z+]/.test(s) || /-\d\d:\d\d$/.test(s) ? s : `${s}-03:00`;
    const start = new Date(norm(startStr));
    const end = new Date(norm(endStr));
    if (isNaN(+start) || isNaN(+end)) return { ok: false, summary: 'start/end inválidos.' };
    if (end <= start) return { ok: false, summary: 'end deve ser maior que start.' };

    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();

    // Bookings que caem dentro
    const { data: hits } = await admin
      .from('doctor_bookings')
      .select('id, patient_name, slot_start, slot_end, status')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .neq('status', 'cancelled')
      .lt('slot_start', end.toISOString())
      .gt('slot_end', start.toISOString());

    const startFmt = fmtDate(start.toISOString());
    const endFmt = fmtDate(end.toISOString());
    const reason = params.reason ? String(params.reason) : 'Indisponível';
    const conflictNote = hits && hits.length > 0
      ? `\n\nATENCAO: ${hits.length} consulta(s) caem dentro:\n` + hits.map((h) => `- ${h.patient_name} em ${fmtDate(h.slot_start)}`).join('\n')
      : '';

    return {
      ok: true,
      summary: `Bloquear ${startFmt} → ${endFmt}?`,
      card: {
        summary: `Bloquear horário`,
        detail: `De: ${startFmt}\nAté: ${endFmt}\nMotivo: ${reason}${conflictNote}`,
        confirm_label: 'Bloquear',
        cancel_label: 'Voltar',
        action: {
          tool: 'bloquear_horario',
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
            reason,
            doctor_id: scope.doctor_id,
          },
        },
      },
      data: { conflicts: hits ?? [] },
    };
  },

  async execute(params, ctx) {
    const start = new Date(String(params.start));
    const end = new Date(String(params.end));
    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();
    const { data, error } = await admin.from('doctor_schedule_blocks').insert({
      tenant_id: ctx.tenant_id,
      doctor_id: scope.doctor_id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: params.reason ? String(params.reason) : null,
      source: 'agente',
      created_by: ctx.user_id,
    }).select('id').maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao bloquear', error: error.message };
    return { ok: true, summary: `Bloqueio criado (id ${data?.id}).`, data: { block: data } };
  },
};
```

- [ ] **Step 5.3: Registrar em `WRITE_HANDLERS`**

```typescript
  bloquear_horario: bloquearHorario,
```

- [ ] **Step 5.4: Smoke teste**

```bash
# propose
curl -s -X POST http://localhost:3000/api/interno/tools \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"tool":"bloquear_horario","mode":"propose","tenant_id":"singulare","user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3","role":"owner","params":{"start":"2026-05-15T12:00","end":"2026-05-15T14:00","reason":"almoço estendido"}}'
# execute (mesmos params, mode:"execute")
```
Esperado: propose retorna card com detail formatado; execute retorna `id` do block.

Validar:
```sql
select id, start_at, end_at, reason, source from public.doctor_schedule_blocks where tenant_id='singulare' order by created_at desc limit 3;
```

Limpar:
```sql
delete from public.doctor_schedule_blocks where id = '<id>';
```

- [ ] **Step 5.5: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent-tools.ts app/lib/internal-agent-handlers.ts
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): tool bloquear_horario (write propose+execute)"
```

---

## Task 6 — Tool `working_hours_atualizar` (write c/ confirmação extra)

**Files:**
- Modify: `app/lib/internal-agent-tools.ts`
- Modify: `app/lib/internal-agent-handlers.ts`
- Modify: `app/app/painel/components/chat-drawer.tsx` (estender `ActionCard` + render condicional)

- [ ] **Step 6.1: Adicionar entrada no catálogo**

```typescript
  {
    name: 'working_hours_atualizar',
    description: 'Atualiza working_hours[dia] do médico (mudança PERMANENTE da rotina semanal). Para ausência pontual use bloquear_horario. Aviso ao usuário: muda o que o agente WhatsApp informa aos pacientes.',
    mode: 'write',
    min_role: 'doctor',
    params: {
      day:    { type: 'enum', required: true, enum: ['seg','ter','qua','qui','sex','sab','dom'], description: 'Dia da semana' },
      hours:  { type: 'string', required: true, description: '"HH:MM-HH:MM" ou "fechado"' },
      doctor_id: { type: 'string', description: 'UUID (admin/owner; doctor é o próprio)' },
    },
  },
```

- [ ] **Step 6.2: Estender schema do `ProposalCard`**

Em `app/lib/internal-agent-handlers.ts`, alterar `ProposalCard` (perto da linha 533):

```typescript
export interface ProposalCard {
  summary: string;
  detail?: string;
  confirm_label?: string;
  cancel_label?: string;
  confirmation_phrase?: string;  // NOVO: se presente, painel exige digitação literal antes de habilitar confirm
  action: { tool: string; params: Record<string, unknown> };
}
```

- [ ] **Step 6.3: Implementar handler**

```typescript
const workingHoursAtualizar: WriteHandler = {
  async propose(params, ctx) {
    const day = String(params.day ?? '');
    const hours = String(params.hours ?? '');
    const VALID_DAYS = ['seg','ter','qua','qui','sex','sab','dom'];
    if (!VALID_DAYS.includes(day)) return { ok: false, summary: `day inválido (esperado: ${VALID_DAYS.join('|')}).` };
    if (hours !== 'fechado' && !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(hours)) {
      return { ok: false, summary: 'hours deve ser "HH:MM-HH:MM" ou "fechado".' };
    }

    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();
    const { data: doc } = await admin
      .from('tenant_doctors')
      .select('id, doctor_name, working_hours')
      .eq('id', scope.doctor_id).eq('tenant_id', ctx.tenant_id).maybeSingle();
    if (!doc) return { ok: false, summary: 'Médico não encontrado.' };

    const wh = (doc.working_hours as Record<string, unknown>) ?? {};
    const before = String(wh[day] ?? 'fechado');

    return {
      ok: true,
      summary: `Mudar ${day} de "${before}" → "${hours}"?`,
      card: {
        summary: `Atualizar horário fixo`,
        detail: `Médico: ${doc.doctor_name}\nDia: ${day}\nAntes: ${before}\nDepois: ${hours}\n\nIMPACTO: o agente WhatsApp passa a informar este novo horário aos pacientes.`,
        confirm_label: 'Aplicar mudança',
        cancel_label: 'Voltar',
        confirmation_phrase: 'CONFIRMAR MUDANCA HORARIO',
        action: {
          tool: 'working_hours_atualizar',
          params: { day, hours, doctor_id: scope.doctor_id },
        },
      },
      data: { before, after: hours },
    };
  },

  async execute(params, ctx) {
    const day = String(params.day);
    const hours = String(params.hours);
    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();
    // jsonb_set via RPC seria mais limpo, mas SET direto via objeto JSON funciona:
    const { data: doc } = await admin
      .from('tenant_doctors')
      .select('working_hours')
      .eq('id', scope.doctor_id).eq('tenant_id', ctx.tenant_id).maybeSingle();
    const wh = { ...((doc?.working_hours as Record<string, unknown>) ?? {}) };
    wh[day] = hours;
    const { error } = await admin
      .from('tenant_doctors')
      .update({ working_hours: wh, updated_at: new Date().toISOString() })
      .eq('id', scope.doctor_id).eq('tenant_id', ctx.tenant_id);
    if (error) return { ok: false, summary: 'Falha ao atualizar.', error: error.message };
    // Trigger trg_doctor_prompt_rebuild regenera rendered_prompt automaticamente.
    return { ok: true, summary: `${day} agora é "${hours}". Prompt do WhatsApp regenerado.`, data: { day, hours } };
  },
};
```

- [ ] **Step 6.4: Registrar em `WRITE_HANDLERS`**

```typescript
  working_hours_atualizar: workingHoursAtualizar,
```

- [ ] **Step 6.5: Estender `ActionCard` no chat-drawer**

Em `app/app/painel/components/chat-drawer.tsx`, achar a interface `ActionCard` (perto do topo, antes da linha 30) e adicionar campo:

```typescript
interface ActionCard {
  tool: string;
  params: Record<string, unknown>;
  summary: string;
  detail?: string;
  confirm_label: string;
  cancel_label: string;
  confirmation_phrase?: string;  // NOVO
}
```

Depois, no `extractCards` (~linha 34), preservar o campo:

```typescript
        cards.push({
          tool: String(parsed.tool),
          params: (parsed.params as Record<string, unknown>) ?? {},
          summary: String(parsed.summary),
          detail: parsed.detail ? String(parsed.detail) : undefined,
          confirm_label: parsed.confirm_label ? String(parsed.confirm_label) : 'Confirmar',
          cancel_label: parsed.cancel_label ? String(parsed.cancel_label) : 'Cancelar',
          confirmation_phrase: parsed.confirmation_phrase ? String(parsed.confirmation_phrase) : undefined,
        });
```

- [ ] **Step 6.6: Renderizar input de confirmação literal**

No componente que renderiza um card (busque por onde os botões `confirm_label`/`cancel_label` aparecem — provavelmente um `<button onClick={...}>{card.confirm_label}</button>`), envolver com lógica:

```tsx
// dentro do componente que renderiza o card, no escopo onde card está disponível:
const [phraseTyped, setPhraseTyped] = useState('');
const requiresPhrase = !!card.confirmation_phrase;
const phraseOk = !requiresPhrase || phraseTyped.trim() === card.confirmation_phrase;

return (
  <div /* ... */ >
    {card.detail && <pre className="...">{card.detail}</pre>}
    {requiresPhrase && (
      <div className="mt-3">
        <label className="text-xs text-zinc-400">
          Pra confirmar, digite: <code>{card.confirmation_phrase}</code>
        </label>
        <input
          type="text"
          value={phraseTyped}
          onChange={(e) => setPhraseTyped(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
          placeholder="Digite a frase exata"
        />
      </div>
    )}
    <div className="mt-3 flex gap-2">
      <button onClick={onConfirm} disabled={!phraseOk} className="...">
        {card.confirm_label}
      </button>
      <button onClick={onCancel} className="...">{card.cancel_label}</button>
    </div>
  </div>
);
```

(Ajuste exato dos className/handlers conforme o componente real — a lógica essencial é os 3 useState + condição `disabled={!phraseOk}` no confirm button.)

Importar `useState` no topo do arquivo se ainda não estiver.

- [ ] **Step 6.7: Smoke teste backend**

```bash
curl -s -X POST http://localhost:3000/api/interno/tools \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"tool":"working_hours_atualizar","mode":"propose","tenant_id":"singulare","user_id":"6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3","role":"owner","params":{"day":"sab","hours":"09:00-12:00"}}'
```
Esperado: `ok:true`, `card.confirmation_phrase === "CONFIRMAR MUDANCA HORARIO"`, detail mostra antes/depois.

NÃO executar (é destrutivo) — testar via UI no Task 7.

- [ ] **Step 6.8: Commit**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add app/lib/internal-agent-tools.ts app/lib/internal-agent-handlers.ts app/app/painel/components/chat-drawer.tsx
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): working_hours_atualizar com confirmacao literal por digitacao"
```

---

## Task 7 — Patch systemMessage P03 + push N8N + smoke E2E

**Files:**
- Modify: `n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json`
- Backup: `.n8n-backups/p03-EaZNHoaKhq0yJsiS-pre-agenda-tools-<TIMESTAMP>.json`

- [ ] **Step 7.1: Backup do workflow local**

```bash
cp /Users/luizflavioxavierdesa/Desktop/vivassit/n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json \
  /Users/luizflavioxavierdesa/Desktop/vivassit/.n8n-backups/p03-EaZNHoaKhq0yJsiS-pre-agenda-tools-$(date +%Y%m%d-%H%M%S).json
```

- [ ] **Step 7.2: Patch systemMessage**

```bash
python3 << 'PYEOF'
import json, sys
path = '/Users/luizflavioxavierdesa/Desktop/vivassit/n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json'
with open(path) as f: wf = json.load(f)
target = next(n for n in wf['nodes'] if n['name'] == 'Agente Interno Singulare')
sm = target['parameters']['options']['systemMessage']

ANCHOR = '- documentos_listar         → { paciente_id?: "uuid", status?: "draft"|"sent"|"signed"|"all", limit?: number, doctor_id?: "uuid" (admin/owner only) }'

NEW_BLOCK = """
- horarios_livres            → { start: "YYYY-MM-DD", end: "YYYY-MM-DD" (max 28d), slot_minutes?: number (default 30), doctor_id?: "uuid" (admin/owner only) }
                               Use pra "tem vaga", "horários livres", "quando posso encaixar". Calcula working_hours menos consultas e bloqueios.
- consulta_marcar            → WRITE propose. { patient_id OR patient_name (+ patient_phone opcional), slot_start: "YYYY-MM-DDTHH:mm", duration_minutes?: 60, doctor_id?: "uuid" (admin/owner only), notes?: string }
                               Pra "marca consulta pra X em Y". Se nome ambíguo, devolve lista pra desambiguar. Se 0 matches, peça ao usuário pra criar via paciente_criar antes.
- bloquear_horario           → WRITE propose. { start: "YYYY-MM-DDTHH:mm", end: "YYYY-MM-DDTHH:mm", reason?: string, doctor_id?: "uuid" (admin/owner only) }
                               Pra "bloqueia minha tarde", "almoço estendido", ausência pontual. Avisa de bookings que caem dentro mas não recusa.
- working_hours_atualizar    → WRITE propose com CONFIRMAÇÃO LITERAL por digitação. { day: "seg"|"ter"|"qua"|"qui"|"sex"|"sab"|"dom", hours: "HH:MM-HH:MM"|"fechado", doctor_id?: "uuid" (admin/owner only) }
                               SÓ pra mudança PERMANENTE da rotina semanal. Pra ausência pontual use bloquear_horario.
                               IMPORTANTE: avise o usuário ANTES que isso muda o que o agente WhatsApp informa aos pacientes."""

if ANCHOR not in sm:
    print("ANCHOR not found — abort"); sys.exit(1)
if 'horarios_livres' in sm:
    print("ALREADY patched — skip"); sys.exit(0)
target['parameters']['options']['systemMessage'] = sm.replace(ANCHOR, ANCHOR + NEW_BLOCK)
with open(path, 'w') as f: json.dump(wf, f, ensure_ascii=False, indent=2)
print(f"OK old_len={len(sm)} new_len={len(target['parameters']['options']['systemMessage'])}")
PYEOF
```

Esperado: `OK old_len=5131 new_len=~6300+`.

- [ ] **Step 7.3: Push no N8N (PUT direto, NÃO `update_partial`)**

```bash
set -a && . /Users/luizflavioxavierdesa/Desktop/vivassit/app/.env.local && set +a && \
node -e '
const fs=require("fs");
const wf=JSON.parse(fs.readFileSync("/Users/luizflavioxavierdesa/Desktop/vivassit/n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json","utf8"));
const allowed=["name","nodes","connections","staticData"];
const payload={};for(const k of allowed)if(wf[k]!==undefined)payload[k]=wf[k];
payload.settings={executionOrder:"v1"};
fs.writeFileSync("/tmp/p03-push.json",JSON.stringify(payload));
' && curl -sS -X PUT "https://n8n.singulare.org/api/v1/workflows/EaZNHoaKhq0yJsiS" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data-binary @/tmp/p03-push.json -w "\nHTTP %{http_code}\n" -o /tmp/p03-resp.json && \
node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/p03-resp.json","utf8"));
const n=r.nodes.find(x=>x.name==="Agente Interno Singulare");
const sm=n.parameters.options.systemMessage;
console.log("active:",r.active,"sm:",sm.length,"has_horarios:",sm.includes("horarios_livres"));
' && rm -f /tmp/p03-push.json /tmp/p03-resp.json
```
Esperado: `HTTP 200`, `active: true`, `has_horarios: true`.

- [ ] **Step 7.4: Esperar deploy Vercel finalizar**

Push do código (Tasks 1-6) já saiu. Confirme deploy via:
```bash
mcp__claude_ai_Vercel__list_deployments com projectId="prj_HTYSHEBUacKN8hGBeGP4XugfeIz9", limit=3
```
Esperado: último deployment com `state="READY"` apontando pro último commit.

- [ ] **Step 7.5: Smoke E2E #1 — horarios_livres**

No painel (logado como owner), abrir chat-drawer e perguntar: *"Tem vaga na próxima semana?"*
Esperado: agente chama `horarios_livres` e responde com slots reais.

- [ ] **Step 7.6: Smoke E2E #2 — consulta_marcar**

Perguntar: *"Marca consulta pra Maria sexta às 14h"*
Esperado: agente chama `consulta_marcar` em mode=propose. Card aparece com paciente/data/duração. Confirmar. Validar no banco que booking foi criado. Cancelar a consulta de teste após (via SQL ou via tool `consulta_cancelar`).

- [ ] **Step 7.7: Smoke E2E #3 — bloquear_horario**

Perguntar: *"Bloqueia minha sexta de tarde, vou ao dentista"*
Esperado: card de bloqueio com janela e motivo. Confirmar. Validar inserção em `doctor_schedule_blocks`. Apagar o block de teste.

- [ ] **Step 7.8: Smoke E2E #4 — working_hours_atualizar**

Perguntar: *"Agora vou atender sábado das 9h às 12h"*
Esperado:
- Agente avisa do impacto no agente WhatsApp.
- Card aparece com diff antes/depois.
- Botão "Aplicar mudança" desabilitado.
- Input pedindo digitação literal `CONFIRMAR MUDANCA HORARIO`.
- Após digitar exato, botão habilita.
- Após confirmar, `tenant_doctors.working_hours.sab` muda no banco.
- `tenant_doctors.rendered_prompt` regenera (validar com `select rendered_prompt from tenant_doctors where id='d52102f7-5507-4416-b902-b5ff5fc12668';` — deve mencionar sábado).

Reverter ao final do teste:
```sql
update public.tenant_doctors
set working_hours = jsonb_set(working_hours, '{sab}', '"fechado"')
where id = 'd52102f7-5507-4416-b902-b5ff5fc12668';
```

- [ ] **Step 7.9: Commit do workflow patchado**

```bash
git -C /Users/luizflavioxavierdesa/Desktop/vivassit add n8n/workflows/EaZNHoaKhq0yJsiS-p03-agente-interno-atendimento-operacional-v3-0.json
git -C /Users/luizflavioxavierdesa/Desktop/vivassit commit -m "feat(agente-interno): systemMessage P03 com 4 tools de agenda (horarios_livres, consulta_marcar, bloquear_horario, working_hours_atualizar)"
git -C /Users/luizflavioxavierdesa/Desktop/vivassit push origin main
```

---

## Critérios de aceite (do spec)

- [x] Migration aplicada, RLS testada — Task 1
- [x] 4 tools respondendo via P03 — Tasks 3-6 + 7
- [x] Card de `working_hours_atualizar` recusa "Aplicar" sem digitação literal — Step 6.6 + 7.8
- [x] `consulta_marcar` recusa criar duplicado quando match ambíguo — Step 4.4
- [x] Backup do workflow P03 salvo em `.n8n-backups/` antes do push — Step 7.1
- [x] Smoke test no Master Secretária pós-mudança de working_hours: `rendered_prompt` reflete a nova janela — Step 7.8
