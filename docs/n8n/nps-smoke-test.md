# NPS — Smoke Test ponta-a-ponta

Sequência manual pra validar a feature em tenant teste antes de ativar em produção.

## Pré-requisitos

- Tenant teste com `evolution_status='connected'`
- Pelo menos 1 doctor com `calendar_id` válido
- Telefone WhatsApp de teste acessível

## Passos

### 1. Aplicar SQL

No Supabase SQL Editor, copia/cola o conteúdo de `scripts/nps-schema.sql` e roda.

Verifica:
```sql
SELECT conname FROM pg_constraint WHERE conname = 'patient_feedback_status_check';
SELECT indexname FROM pg_indexes WHERE tablename = 'patient_feedback';
```

Esperado: constraint existe, 2 índices novos (`idx_patient_feedback_lookup`, `idx_patient_feedback_dedupe`).

### 2. Importar workflow "3. NPS Pesquisa Pós-Consulta" no n8n

Siga `docs/n8n/3-nps-pesquisa-walkthrough.md` — monta o workflow nó-a-nó.

Antes de ativar, **teste manualmente**:

1. Cria evento no Calendar do doctor teste:
   - `start.dateTime`: 30 min atrás (já passou)
   - `description`:
     ```
     Telefone: +55XX9999999X
     Nome Completo: Paciente Teste
     Data de Nascimento: 01/01/1990
     ID da conversa: smoke-test
     ```
2. Clica **Execute Workflow** no n8n.
3. Confere:
   ```sql
   SELECT id, patient_phone, doctor_name, status, sent_at
   FROM patient_feedback
   WHERE patient_phone = '+55XX9999999X'
   ORDER BY sent_at DESC LIMIT 1;
   ```
   Esperado: 1 row, status='pending', sent_at recente.
4. Verifica WhatsApp do número teste — chegou a mensagem com disclaimer de no-show.

### 3. Modificar Master Secretária

Siga `docs/n8n/master-secretaria-nps-handler.md`. Adiciona pre-router antes do Gemini.

### 4. Testar fluxo de resposta — caso promotor (≥7)

1. Pelo WhatsApp teste, responde **"9"**.
2. Confere reply: "Obrigada pelo retorno! Que bom que correu bem 💜"
3. SQL:
   ```sql
   SELECT nps_score, responded_at, status FROM patient_feedback
   WHERE patient_phone='+55XX9999999X' ORDER BY sent_at DESC LIMIT 1;
   ```
   Esperado: `nps_score=9, status='closed', responded_at not null`.

### 5. Testar fluxo de resposta — caso detrator (≤6)

1. Cria novo evento Calendar (ou força INSERT manual com `status='pending'`).
2. Re-executa workflow NPS pra criar nova row pending pro número teste.
3. Pelo WhatsApp, responde **"3"**.
4. Confere reply: "Obrigada pela nota 🙏\nO que podemos melhorar pra próxima vez?"
5. SQL: `SELECT status FROM patient_feedback WHERE id = LAST_FEEDBACK_ID;` → esperado `awaiting_followup`.
6. Responde texto livre: **"O atendimento demorou muito"**
7. Confere reply: "Anotado, obrigada por contribuir 💜"
8. SQL: `SELECT feedback_text, status FROM patient_feedback WHERE id = LAST_FEEDBACK_ID;` → `feedback_text='O atendimento demorou muito', status='closed'`.

### 6. Testar dedupe

Re-executa workflow no mesmo dia (sem novo evento). Confere que **não cria** row duplicado.

### 7. Testar fallback (mensagem não-NPS)

1. Sem feedback pendente, manda "oi" pelo WhatsApp.
2. AI Agent responde normalmente — pre-router não interceptou.

### 8. Verificar painel

- Acessa `/painel/feedback` no app.
- Confere: rows aparecem, summary cards atualizados (NPS, score médio, taxa, promotores/detratores).

### 9. Ativar workflow em produção

- No n8n, marca o workflow "3. NPS Pesquisa Pós-Consulta" como **Active**.
- Confere `Schedule Trigger` exibe próxima execução para hoje 19:00 ou amanhã 19:00 BRT.

## Critérios de aceitação ✅

- [ ] SQL aplicado sem erro
- [ ] Workflow novo importado e ativado
- [ ] Master Secretária com pre-router NPS
- [ ] Mensagem chega no WhatsApp do paciente teste
- [ ] Score 9 → status='closed', reply correto
- [ ] Score 3 → awaiting_followup → texto livre → closed, reply correto
- [ ] Dedupe não duplica no mesmo dia
- [ ] Mensagem fora de contexto cai no AI Agent normal
- [ ] /painel/feedback exibe rows com summary

## Rollback

Se algo der errado em produção:

1. **n8n**: desativa o workflow "3. NPS Pesquisa Pós-Consulta" (toggle "Active" off).
2. **Master Secretária**: desconecta o Switch "NPS Router" e religa o webhook → AI Agent direto. Os nós ficam órfãos mas não atrapalham (manter pra restaurar depois).
3. **SQL**: a migração é aditiva (não remove colunas). Não precisa rollback.
