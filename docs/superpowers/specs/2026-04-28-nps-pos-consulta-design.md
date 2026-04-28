# NPS Pós-Consulta — Design

**Data:** 2026-04-28
**Autor:** Luiz + Claude
**Status:** Aprovado para implementação

---

## 1. Contexto e motivação

A plataforma Singulare/Vivassit já possui:

- Tabela `patient_feedback` no Supabase (com RLS habilitada) e schema com colunas `id, tenant_id, patient_name, patient_phone, doctor_name, appointment_date, nps_score, feedback_text, sent_at, responded_at, status`.
- Página `/painel/feedback` (`app/app/painel/feedback/page.tsx`) totalmente implementada: summary cards (NPS, score médio, taxa de resposta, promotores/detratores) e lista de feedbacks.
- API `/api/painel/feedback` (`app/app/api/painel/feedback/route.ts`) que agrega NPS via fórmula clássica `(promoters - detractors) / total * 100`, com promoters ≥9 e detractors ≤6.
- API `/api/painel/stats` e `/api/painel/overview` que já incluem `nps_avg`, `nps_score`, `nps_responses` na visão geral.

O que **falta** é a coleta — ninguém está populando `patient_feedback`. O painel exibe estado vazio porque o n8n ainda não envia pesquisa NPS após consulta nem trata respostas.

## 2. Escopo

**In-scope:**
- Novo workflow n8n "3. NPS Pesquisa Pós-Consulta" (cron diário 19:00 BRT) que envia a pesquisa via Evolution API.
- Modificação do workflow "1. Master Secretária" para reconhecer e tratar respostas NPS antes do AI Agent.
- Migração SQL idempotente no Supabase para padronizar valores aceitos em `patient_feedback.status` e adicionar índices.

**Out-of-scope (não toca nesta entrega):**
- Front-end `/painel/feedback` — já cobre todos os campos e agregações necessárias.
- `weekly_metrics` — tabela existe com RLS mas sem uso ativo no código. Agregação semanal vira tarefa separada se necessário.
- Feature flag `nps_enabled` por tenant — todos os tenants `evolution_status='connected'` recebem NPS por padrão. Opt-out vira fase 2 se demandado.
- Workflow "2. Confirmação Diária" — não é tocado. NPS é workflow separado, conforme requisito explícito.

## 3. Arquitetura

```
┌──────────────────────────────────┐
│ Cron 19:00 BRT (n8n)             │
│ Workflow "3. NPS Pesquisa"       │
└──────────────────────────────────┘
                │
                ├─► tenants (evolution_status='connected')
                │     │
                │     ├─► tenant_doctors (status='active', calendar_id NOT NULL)
                │     │     │
                │     │     ├─► Google Calendar.events.list
                │     │     │   timeMin=hoje 00:00 BRT, timeMax=now
                │     │     │
                │     │     └─► para cada evento concluído:
                │     │           1. extrai telefone da description (regex)
                │     │           2. dedupe em patient_feedback
                │     │           3. INSERT pending row
                │     │           4. Evolution API sendText
                │     │
                │     └─► (próximo doctor)
                │
                └─► (próximo tenant)


┌──────────────────────────────────┐
│ Paciente responde via WhatsApp   │
│ Evolution → webhook do n8n       │
│ Workflow "1. Master Secretária"  │
└──────────────────────────────────┘
                │
                ▼
       ┌──────────────────┐
       │ NPS pre-router   │  ← novo nó, antes do AI Agent
       │ (lookup)         │
       └──────────────────┘
                │
        ┌───────┴────────┐
        │                │
   é NPS?            não é NPS
        │                │
        ▼                ▼
  trata NPS         AI Agent normal
  (sem chamar IA)
```

## 4. Componentes

### 4.1 Workflow n8n "3. NPS Pesquisa Pós-Consulta" (novo)

Arquivo: `n8n-workflows/3-nps-pesquisa.json` (será criado).

**Nós, em ordem:**

1. **Schedule Trigger** — Cron `0 19 * * *` America/Sao_Paulo. Roda todos os dias.
2. **Postgres "List Tenants"** — `SELECT tenant_id, clinic_name, evolution_instance_name, evolution_phone_number FROM tenants WHERE evolution_status='connected' AND evolution_instance_name IS NOT NULL`
3. **Split In Batches** (tenant) — itera tenants
4. **Postgres "List Doctors"** — `SELECT id, doctor_name, calendar_id FROM tenant_doctors WHERE tenant_id=$1 AND status='active' AND calendar_id IS NOT NULL`
5. **Split In Batches** (doctor) — itera doctors
6. **Google Calendar "List Events"** — credencial via Service Account (mesma do app, JSON em credencial n8n). Parâmetros: `calendarId={{$json.calendar_id}}`, `timeMin={{TODAY_00:00 BRT em ISO}}`, `timeMax={{NOW em ISO}}`, `singleEvents=true`, `orderBy=startTime`.
7. **Function "Extract Patient Info"** — extrai dados da description do evento via regex:
   ```
   Telefone:\s*(\+?\d[\d\s\-()]+)
   Nome\s*Completo:\s*(.+)
   ```
   Normaliza telefone para E.164 (`+5511999999999`, mesma regra do `normalizePhoneToE164` do app). Deriva `first_name` como o primeiro token de "Nome Completo" (split por espaço, primeira palavra capitalizada). Se telefone ausente ou inválido → descarta evento (não envia NPS para evento sem telefone). Se nome ausente → usa fallback "Paciente".
8. **Postgres "Dedupe"** — `SELECT 1 FROM patient_feedback WHERE tenant_id=$1 AND patient_phone=$2 AND appointment_date::date = current_date AT TIME ZONE 'America/Sao_Paulo' LIMIT 1`. IF resultado vazio → continua. Se já existe → skip.
9. **Postgres "Insert Pending"** — INSERT em `patient_feedback`:
   ```sql
   INSERT INTO patient_feedback
     (tenant_id, patient_name, patient_phone, doctor_name,
      appointment_date, status, sent_at)
   VALUES ($1, $2, $3, $4, $5, 'pending', now())
   RETURNING id
   ```
10. **HTTP Request "Evolution sendText"** — POST `{{EVOLUTION_BASE_URL}}/message/sendText/{{evolution_instance_name}}` com body:

    *Confirmado via grep no app:* coluna em `tenants` é `evolution_instance_name` (também existem `evolution_instance_id`, `evolution_phone_number`, `evolution_status`). `EVOLUTION_BASE_URL` será env var no n8n (ex: `https://evo.singulare.org`).


    ```json
    {
      "number": "{{patient_phone}}",
      "text": "Olá {{first_name}}! 👋\n\nComo foi sua consulta hoje com {{doctor_name}}?\nDe 0 a 10, qual nota você daria?\n\n_Caso não tenha comparecido à consulta, é só ignorar esta mensagem._"
    }
    ```
11. **IF "Send OK"** — branch:
    - Sucesso: nada (status já é 'pending')
    - Falha: **Postgres "Mark send_failed"** UPDATE `status='send_failed'` no row recém-inserido (não bloqueia o lote)

**Comportamento de erro:** falha em um doctor não interrompe o tenant; falha em um tenant não interrompe os outros (n8n `continueOnFail` nos nós Postgres e HTTP).

### 4.2 Modificação no workflow "1. Master Secretária"

**Localização da inserção:** após o nó de webhook do Evolution API e antes do nó AI Agent.

**Novos nós (em ordem):**

1. **Postgres "Lookup Pending NPS"** — busca pesquisa pendente OU aguardando follow-up nas últimas 24h:
   ```sql
   SELECT id, status, nps_score
   FROM patient_feedback
   WHERE tenant_id = $1
     AND patient_phone = $2
     AND status IN ('pending', 'awaiting_followup')
     AND sent_at > now() - interval '24 hours'
   ORDER BY sent_at DESC
   LIMIT 1
   ```

2. **Switch "NPS Router"** — três ramos baseados em `lookup.status`:

   **Ramo A — `pending` (esperando nota):**
   - **Function "Parse Score"** — extrai inteiro 0-10 da mensagem. Regex tolerante: `/\b(10|[0-9])\b/` no texto. Se múltiplos matches, pega o primeiro. Se não houver match → cai pro fluxo padrão do AI Agent (mensagem não é NPS).
   - **Postgres "Save Score"** — UPDATE:
     ```sql
     UPDATE patient_feedback
     SET nps_score = $1,
         responded_at = now(),
         status = CASE WHEN $1 <= 6 THEN 'awaiting_followup' ELSE 'closed' END
     WHERE id = $2
     ```
   - **IF "Score ≤6"**:
     - Sim: Evolution sendText "Obrigada pela nota 🙏 O que podemos melhorar pra próxima vez?"
     - Não: Evolution sendText "Obrigada pelo retorno! Que bom que correu bem 💜"
   - **STOP** — não passa pro AI Agent.

   **Ramo B — `awaiting_followup` (aguardando texto livre de melhoria):**
   - **Postgres "Save Feedback Text"** — UPDATE:
     ```sql
     UPDATE patient_feedback
     SET feedback_text = $1, status = 'closed'
     WHERE id = $2
     ```
   - **Evolution sendText** "Anotado, obrigada por contribuir 💜"
   - **STOP** — não passa pro AI Agent.

   **Ramo C — sem pesquisa pendente:**
   - Continua o fluxo normal pro AI Agent.

**Princípio:** o NPS pre-router só intercepta quando há contexto NPS ativo. Mensagens fora desse contexto seguem normal — o agente Gemini não é envenenado com lógica NPS.

### 4.3 Migração Supabase (`scripts/nps-schema.sql` — novo)

Migração idempotente:

```sql
-- 1. CHECK constraint em status (idempotente: drop+create)
ALTER TABLE public.patient_feedback
  DROP CONSTRAINT IF EXISTS patient_feedback_status_check;

ALTER TABLE public.patient_feedback
  ADD CONSTRAINT patient_feedback_status_check
  CHECK (status IN ('pending', 'responded', 'awaiting_followup', 'closed', 'send_failed'));

-- 2. Índices pra performance
CREATE INDEX IF NOT EXISTS idx_patient_feedback_lookup
  ON public.patient_feedback (tenant_id, patient_phone, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_feedback_dedupe
  ON public.patient_feedback (tenant_id, appointment_date);
```

Roda manualmente no Supabase SQL Editor antes de ativar o workflow.

**Nota sobre status legado:** se houver rows antigos com status diferente, o ALTER falha. O script primeiro faz um `UPDATE` defensivo: rows com status NULL ou desconhecido viram 'pending'. Detalhes na fase de plan.

## 5. Fluxo de dados

### 5.1 Envio (cron 19h)

| Passo | Origem | Destino | Operação |
|---|---|---|---|
| 1 | Postgres `tenants` | n8n | SELECT tenants ativos |
| 2 | Postgres `tenant_doctors` | n8n | SELECT doctors com calendar |
| 3 | Google Calendar | n8n | events.list (today 00:00 → now) |
| 4 | n8n (regex na description) | n8n | extrai phone, name |
| 5 | Postgres `patient_feedback` | n8n | dedupe SELECT |
| 6 | n8n | Postgres `patient_feedback` | INSERT pending |
| 7 | n8n | Evolution API | sendText |
| 8 | (em caso de falha) | Postgres | UPDATE status='send_failed' |

### 5.2 Resposta (Master Secretária)

| Passo | Origem | Destino | Operação |
|---|---|---|---|
| 1 | Evolution webhook | n8n | mensagem do paciente |
| 2 | Postgres | n8n | lookup pesquisa pendente (24h) |
| 3 | Switch NPS | — | 3 ramos: pending / awaiting_followup / passa direto |
| 4a | n8n (regex 0-10) | Postgres | UPDATE nps_score, responded_at, status |
| 4a | n8n | Evolution API | reply confirmando + (se ≤6) pergunta follow-up |
| 4b | n8n (texto livre) | Postgres | UPDATE feedback_text, status='closed' |
| 4b | n8n | Evolution API | reply de agradecimento |

### 5.3 Visualização

Sem mudanças. `/painel/feedback` lê `patient_feedback` e agrega NPS — já implementado.

## 6. Tratamento de erros

- **Sem telefone na description**: log e skip (não bloqueia outros eventos).
- **Falha sendText**: `status='send_failed'` no row → não conta como pesquisa enviada nas métricas (a API filtra por `status != 'send_failed'` se necessário, mas o painel atual já só conta `nps_score IS NOT NULL` para responded).
- **Paciente responde fora da janela 24h**: cai no fluxo normal do agente IA, sem efeitos no NPS.
- **Paciente envia número fora de contexto** (sem feedback pendente): ramo C, AI Agent trata normalmente.
- **Múltiplas consultas no mesmo dia (mesmo paciente)**: dedupe é por `(tenant_id, patient_phone, appointment_date::date)`. Mesmo paciente com 2 consultas no dia (raro) recebe 1 NPS — limitação aceita.
- **Paciente faltou (no-show)**: recebe a mensagem com disclaimer "Caso não tenha comparecido, é só ignorar". Eventualmente pode responder algo — vira ruído de dados, mitigado pelo disclaimer.

## 7. Como testar

**Teste manual ponta-a-ponta:**

1. Aplicar `scripts/nps-schema.sql` no Supabase.
2. Importar `n8n-workflows/3-nps-pesquisa.json` no n8n; ativar.
3. Modificar workflow "1. Master Secretária" (passo a passo no plano).
4. Criar evento no Google Calendar de um doctor de tenant teste, com `description` contendo `Telefone: +55XX...`, com horário começando 30 min atrás (já passou).
5. Executar manualmente o workflow "3. NPS Pesquisa" (botão "Execute Workflow").
6. Verificar:
   - row em `patient_feedback` com `status='pending'`, `sent_at` recente.
   - mensagem WhatsApp recebida no telefone de teste com disclaimer.
7. Responder com "9" → verificar `nps_score=9, status='closed', responded_at=now()`. Recebe reply de agradecimento.
8. Repetir com "3" → verificar `status='awaiting_followup'`. Receber reply pedindo melhoria. Responder texto → verificar `feedback_text` populado, `status='closed'`.
9. Conferir `/painel/feedback` — row aparece, summary atualiza.

**Teste idempotência:**
- Re-executar o workflow no mesmo dia → não cria duplicata (dedupe funciona).

## 8. Critérios de aceitação

- [ ] Workflow "3. NPS Pesquisa" rodou às 19h e populou rows `pending` em `patient_feedback` para todas consultas concluídas hoje (com telefone).
- [ ] Paciente respondendo "8" via WhatsApp grava `nps_score=8, status='closed'` e recebe reply.
- [ ] Paciente respondendo "4" recebe pergunta de follow-up; texto seguinte é gravado em `feedback_text`.
- [ ] Mensagem fora do contexto NPS (paciente sem feedback pending) cai no AI Agent normal.
- [ ] `/painel/feedback` exibe os rows com summary calculado corretamente.
- [ ] Re-execução do cron no mesmo dia não cria duplicatas.

## 9. Ordem de entrega

1. Schema SQL (migração) — preparada e revisada, mas só rodada quando integrar.
2. Workflow n8n "3. NPS Pesquisa" — JSON exportado e importado em n8n staging.
3. Modificações no Master Secretária — passo a passo manual no n8n editor.
4. Teste ponta-a-ponta em tenant de teste (Voda ou Singulare).
5. Ativação em produção.

## 10. Riscos e itens em aberto

- **Convenção da description do Calendar**: depende do Master Secretária estar gravando consistentemente "Telefone: +55..." nos eventos que cria. Se houver eventos legados sem essa convenção, eles são ignorados (correto comportamento).
- **Janela 24h**: paciente que responde só no dia seguinte perde a janela. Considerar 48h se taxa de resposta for baixa.
- **Internacionalização**: textos em pt-BR fixos. Não é problema agora (Singulare é Brasil-only), mas anotar para futuro.
- **Telefone do paciente como chave**: se o paciente trocar número entre consultas, dedupe ainda funciona (são chaves diferentes). Se o paciente responder de outro número que não o cadastrado no evento, perde o link — limitação aceita.
