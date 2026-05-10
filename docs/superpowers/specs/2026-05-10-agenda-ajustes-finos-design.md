# Agenda — Ajustes Finos via Agente Interno (P03)

Status: aprovado em 2026-05-10. Pronto pra virar plano de implementação.

## Contexto

O agente interno P03 (`EaZNHoaKhq0yJsiS`) hoje só permite consultar agenda (`agenda_hoje`, `agenda_periodo`) e mexer em consultas existentes (`consulta_reagendar`, `consulta_cancelar`). Faltam ações cotidianas: ver janelas livres, marcar nova consulta, bloquear horário esporádico (médico vai ao dentista, almoço extendido) e ajustar working_hours quando muda a rotina semanal.

Sem essas tools, a Dra. Paula precisa abrir o painel manual pra qualquer ajuste — quebra o fluxo de "tudo via agente".

## Objetivo

Adicionar quatro tools no agente interno P03 que cubram o ciclo completo de manipulação da agenda, mantendo o padrão arquitetural existente (handlers em `app/lib/internal-agent-handlers.ts` registrados em `app/lib/internal-agent-tools.ts`, schemas declarativos, writes via `mode=propose` com card de confirmação no painel).

## Não-objetivos

- Sincronizar `doctor_schedule_blocks` com Google Calendar — bloqueios ficam só no Singulare. Se virar pedido real, vira projeto à parte.
- Recorrência de bloqueios ("toda quarta de 12-13h") — primeira versão é só ad-hoc. Recorrência depois.
- Validar conflitos com bookings existentes ao bloquear — primeira versão só avisa no card, não recusa.
- Suporte multi-doctor pro mesmo bloco — cada bloqueio é de UM médico. Compartilhado vira N inserts.
- Detecção automática de "intenção de mudança permanente" pra sugerir `working_hours_atualizar` em vez de `bloquear_horario` — quem decide é o usuário, agente só executa o que for pedido.

## Schema novo

Uma tabela nova: `public.doctor_schedule_blocks`. Migration:

```sql
create table public.doctor_schedule_blocks (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  doctor_id uuid not null references tenant_doctors(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  source text not null default 'painel' check (source in ('agente','painel','google_cal')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  check (end_at > start_at)
);
create index doctor_schedule_blocks_lookup on doctor_schedule_blocks (tenant_id, doctor_id, start_at);
```

RLS: política idêntica à de `doctor_bookings` — leitura/escrita só pra `auth.uid()` que tenha membership ativo no `tenant_id` (admin/owner sempre, doctor só do próprio `doctor_id`).

## As quatro tools

### `horarios_livres` (read)

**Params:**
```
{
  start: "YYYY-MM-DD",
  end: "YYYY-MM-DD",
  doctor_id?: "uuid",          // admin/owner only; doctor já é filtrado pelo backend
  slot_minutes?: number = 30   // granularidade dos slots
}
```

**Comportamento:** itera os dias entre `start` e `end`, lê `working_hours[diaSemana]` do médico, gera slots de `slot_minutes` dentro da janela, subtrai os intervalos ocupados por:
- `doctor_bookings` com `status NOT IN ('cancelled')` no intervalo
- `doctor_schedule_blocks` no intervalo

Retorna o conjunto restante.

**Retorno:**
```
{
  ok: true,
  summary: "Encontrei 8 slots livres entre 12/05 e 16/05.",
  data: {
    slots: [
      { start: "2026-05-12T14:00:00-03:00", end: "2026-05-12T14:30:00-03:00", doctor_id: "..." },
      ...
    ],
    total: 8
  }
}
```

**RBAC:** doctor → só seu doctor_id. admin/owner → respeita `doctor_id` opcional; sem ele, retorna por médico (agrupado).

### `consulta_marcar` (write, mode=propose)

**Params:**
```
{
  patient_id?: "uuid",        // se já existe paciente
  patient_name?: string,      // se vai criar/identificar pelo nome
  patient_phone?: "+55...",   // opcional, ajuda a desambiguar
  slot_start: "YYYY-MM-DDTHH:mm",
  duration_minutes?: number = 60,
  doctor_id?: "uuid",         // admin/owner only
  notes?: string
}
```

**Comportamento:**
1. Resolve `patient_id`. Se foi passado explicitamente, usa direto. Se não, faz lookup por `(tenant_id, name OR phone)`:
   - Match único → usa o id encontrado.
   - Múltiplos matches → retorna `{ok: false, ambiguous: [{id, name, phone}, ...]}` pra agente pedir desambiguação ao usuário (não chega a montar card).
   - Zero matches → retorna `{ok: false, missing_patient: {name, phone}}` pra o agente, que então deve disparar uma chamada SEPARADA a `paciente_criar` em `mode=propose` antes de tentar `consulta_marcar` de novo com o `patient_id` resultante.
2. Valida slot: dentro de `working_hours`, sem conflito em `doctor_bookings` (status≠cancelled) ou `doctor_schedule_blocks`. Se conflito → retorna `{ok: false, conflict: {...}}`.
3. Em `mode=propose`, NÃO insere nada — só monta card. O `INSERT INTO doctor_bookings` só acontece em `mode=execute`, vindo da confirmação do painel via mesma rota com mesmo payload.

**Retorno (propose):**
```
{
  ok: true,
  card: {
    type: "consulta_marcar",
    patient: { id, name, phone },
    doctor: { id, name },
    slot_start, slot_end,
    notes
  }
}
```

### `bloquear_horario` (write, mode=propose)

**Params:**
```
{
  start: "YYYY-MM-DDTHH:mm",
  end: "YYYY-MM-DDTHH:mm",
  reason?: string,
  doctor_id?: "uuid"          // admin/owner only
}
```

**Comportamento:** valida `end > start`. No `mode=propose`, retorna preview + lista de bookings existentes que caem na janela (aviso, não recusa — usuário decide). No `mode=execute`, insere em `doctor_schedule_blocks` com `source='agente'` e `created_by=user_id`.

**Retorno (propose):**
```
{
  ok: true,
  card: {
    type: "bloquear_horario",
    doctor: { id, name },
    start_at, end_at, reason,
    conflicts: [ { booking_id, patient_name, slot_start } ] // pode ser vazio
  }
}
```

### `working_hours_atualizar` (write, mode=propose, com confirmação extra)

**Params:**
```
{
  doctor_id?: "uuid",         // admin/owner only
  day: "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom",
  hours: "HH:MM-HH:MM" | "fechado"
}
```

**Comportamento:**
1. Lê `tenant_doctors.working_hours` atual.
2. No `mode=propose`, calcula diff (antes/depois) e retorna no card.
3. No `mode=execute`, faz `UPDATE tenant_doctors SET working_hours = jsonb_set(working_hours, '{<day>}', '<value>')` — o trigger `trg_doctor_prompt_rebuild` regenera `rendered_prompt` automaticamente.

**Por que confirmação extra:** essa tool muda o prompt do **agente WhatsApp Master Secretária** (workflow `OOT4JZyKZUyB0SxB`), que usa `rendered_prompt` pra dizer pros pacientes quando há atendimento. Mudar errado = bot oferecendo horário que o médico não cumpre, ou recusando horário válido.

**Mecanismo de confirmação:** o card no painel, em vez do botão "Confirmar/Cancelar" padrão, exige que o usuário digite literalmente `CONFIRMAR MUDANCA HORARIO` num input antes de habilitar o botão "Aplicar". Pequena fricção que evita aplicar acidentalmente.

**Retorno (propose):**
```
{
  ok: true,
  card: {
    type: "working_hours_atualizar",
    doctor: { id, name },
    day,
    before: "14:00-18:00",
    after:  "14:00-19:00",
    impact_warning: "Vai mudar o que o agente WhatsApp diz aos pacientes sobre disponibilidade no <day>."
  }
}
```

## systemMessage do P03 — diretivas adicionadas

Bloco a inserir no `<GUIA_DE_FERRAMENTAS>` da Camada 1 do prompt (workflow `EaZNHoaKhq0yJsiS`, nó `Agente Interno Singulare`):

```
- horarios_livres            → { start: "YYYY-MM-DD", end: "YYYY-MM-DD", slot_minutes?: number (30 default), doctor_id?: "uuid" (admin/owner only) }
                               Use quando perguntarem "tem vaga", "horários livres", "quando posso encaixar".
- consulta_marcar            → { patient_name OR patient_id, slot_start: "YYYY-MM-DDTHH:mm", duration_minutes?: number (60 default), doctor_id?: "uuid" (admin/owner only), notes?: string }
                               WRITE propose. Pra "marca consulta pra <paciente> <dia> <hora>".
- bloquear_horario           → { start: "YYYY-MM-DDTHH:mm", end: "YYYY-MM-DDTHH:mm", reason?: string, doctor_id?: "uuid" (admin/owner only) }
                               WRITE propose. Pra "bloqueia minha tarde de sexta", "marca almoço estendido".
- working_hours_atualizar    → { day: "seg"|"ter"|"qua"|"qui"|"sex"|"sab"|"dom", hours: "HH:MM-HH:MM"|"fechado", doctor_id?: "uuid" (admin/owner only) }
                               WRITE propose com confirmação extra. SÓ pra mudança PERMANENTE da rotina semanal ("agora trabalho sábado de manhã"). Pra ausência pontual use bloquear_horario.
                               IMPORTANTE: avise o usuário que muda o que o agente WhatsApp informa aos pacientes.
```

## UI no painel

O chat-drawer (`app/app/painel/components/chat-drawer.tsx`) já renderiza cards de propose **genericamente** a partir do JSON `[[CARD]]{...}[[/CARD]]` — schema `{summary, detail?, confirm_label?, cancel_label?, action: {tool, params}}`. Não há componente React por tipo de card.

Pra `consulta_marcar` e `bloquear_horario`, basta os handlers retornarem `card` no formato existente — usa o `detail` em multilinha pra mostrar paciente/médico/data/conflitos. **Zero novos componentes**.

Pra `working_hours_atualizar` (confirmação extra por digitação literal), estendo o schema do card com um campo opcional `confirmation_phrase: string`. Quando presente, o chat-drawer renderiza um `<input>` extra antes do botão de confirmar — botão habilita só quando o valor digitado === `confirmation_phrase`. Backwards compatible (cards existentes não têm esse campo, comportamento inalterado).

## Componentes alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<timestamp>_doctor_schedule_blocks.sql` | Migration nova com a tabela + RLS |
| `app/lib/internal-agent-handlers.ts` | 4 handlers novos (`horariosLivres`, `consultaMarcar`, `bloquearHorario`, `workingHoursAtualizar`) |
| `app/lib/internal-agent-tools.ts` | Registra as 4 tools com schemas Zod |
| `app/app/painel/components/chat-drawer.tsx` | Estende `ActionCard` type com `confirmation_phrase?: string`; render condicional do input quando presente; botão desabilitado até match |
| `n8n/workflows/EaZNHoaKhq0yJsiS-...json` | systemMessage ampliado com as 4 tools (backup em `.n8n-backups/` antes) |

## Plano de implementação (ordem)

1. **Migration** `doctor_schedule_blocks` + RLS. Aplica via `/migrate`.
2. **`horarios_livres`** handler + tool registry. Mais simples, sem write — valida que o pipeline de read funciona pra essa nova categoria.
3. **`consulta_marcar`** handler + tool registry + `MarcarConsultaCard`. Resolve a feature de maior valor cotidiano. Reusa schema de `doctor_bookings`.
4. **`bloquear_horario`** handler + tool registry + `BloquearHorarioCard`. Usa a nova tabela.
5. **`working_hours_atualizar`** handler + tool registry + `MudarHorarioCard` (com confirmação extra). Última por ser a mais sensível.
6. **Patch systemMessage P03** com as 4 tools + push N8N (PUT direto, não `update_partial`).
7. **Validação ponta-a-ponta** no painel: passar pelas 4 perguntas-tipo ("tem vaga sexta?", "marca consulta pra Maria sexta 14h", "bloqueia minha tarde de sexta, vou ao dentista", "agora atendo sábado de manhã").

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `working_hours_atualizar` aplica errado e quebra atendimento WhatsApp | Confirmação literal por digitação no card; sempre `mode=propose` antes |
| `consulta_marcar` cria paciente duplicado por nome ambíguo | Lookup retorna lista de matches em vez de criar — agente pede desambiguação |
| `horarios_livres` fica lento em janelas grandes (3+ semanas) | Primeira versão limita janela máxima a 4 semanas no schema. Otimiza depois se for problema real |
| Bloqueios criados via agente colidem com bookings que viraram depois | `bloquear_horario` SÓ avisa, não recusa — usuário decide se reagenda os bookings ou aceita conflito |
| Mudança de schema sem RLS deixa cross-tenant leak | RLS policy obrigatória na própria migration, idêntica à de `doctor_bookings` |

## Critérios de aceite

- Migration aplicada, RLS testada (user de tenant A não vê blocks de tenant B).
- 4 tools respondendo no painel via P03 (perguntas-tipo do passo 7 acima passam end-to-end).
- Card de `working_hours_atualizar` recusa "Aplicar" sem digitação literal.
- `consulta_marcar` recusa criar duplicado quando match ambíguo.
- Backup do workflow P03 salvo em `.n8n-backups/` antes do push.
- Smoke test no agente WhatsApp Master Secretária pós-mudança de working_hours: o `rendered_prompt` reflete a nova janela.
