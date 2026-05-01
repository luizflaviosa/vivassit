# Master Secretária — Integração do Pre-Router NPS

Sub-workflow já criado: **`ZWzRBjClOdA5xRNQ`** ("Master Secretária — NPS Pre-Router") · 17 nós · INATIVO · credenciais Postgres OK · HTTP Evolution precisa env `EVOLUTION_BASE_URL` + `EVOLUTION_API_KEY`.

Este doc é o **passo manual** no UI do N8N pra plugar o pre-router no Master Secretária ATIVO (`OOT4JZyKZUyB0SxB`). 2 nós novos. ~5 min. Reversível em 1 clique cada (delete dos 2 nós).

---

## Antes / Depois

**Hoje:**
```
Buscar Config Tenant → Mensagem chegando? → ...
```

**Depois:**
```
Buscar Config Tenant → [NPS Pre-Router] → [IF handled?]
                                                ├─ true:  STOP (NPS já tratado, não chama AI)
                                                └─ false: Mensagem chegando? → ... (fluxo normal)
```

---

## Passo 1 — Adicionar "Execute Sub-Workflow"

1. Abre `1. Master Secretária` no N8N
2. Encontra o nó **`Buscar Config Tenant`** (NÃO o `Buscar Config Tenant1`)
3. Apaga a seta que sai dele pra **`Mensagem chegando?`** (clica na conexão e Delete)
4. Adiciona nó **`Execute Sub-Workflow`** logo à direita do `Buscar Config Tenant`:
   - Source: clica no `+` da saída do `Buscar Config Tenant` → "Execute Sub-Workflow" (procura "execute workflow")
5. Configura:
   - **Workflow**: seleciona `Master Secretária — NPS Pre-Router` (id `ZWzRBjClOdA5xRNQ`)
   - **Workflow Inputs** → Modo: "Define Below for Each Output" → cola estes 4 fields:
     - `tenant_id` (string) = `={{ $('Buscar Config Tenant').item.json.tenant_id }}`
     - `patient_phone` (string) = `={{ $('Info').item.json.telefone }}`
     - `mensagem` (string) = `={{ $('Info').item.json.mensagem }}`
     - `evolution_instance_name` (string) = `={{ $('Buscar Config Tenant').item.json.evolution_instance_name }}`
   - **Wait for sub-workflow completion**: ON
   - Save

## Passo 2 — Adicionar IF "handled?"

1. Logo à direita do `Execute Sub-Workflow`, adiciona um **`IF`**
2. Configura:
   - Condition: `={{ $json.handled }}` **equals** `true` (boolean)
3. **Saída True** (handled=true): deixa SEM conexão (encerra — NPS foi tratado, não vai pro AI)
4. **Saída False** (handled=false): conecta em **`Mensagem chegando?`** (segue fluxo normal pro AI Agent)

## Passo 3 — Salvar e ativar

1. Save no workflow Master Secretária
2. **Ativa o workflow `ZWzRBjClOdA5xRNQ`** no painel lateral do N8N (toggle Active)
3. Verifica que `EVOLUTION_BASE_URL` e `EVOLUTION_API_KEY` estão setadas nas env vars do N8N (se não, sub-workflow vai falhar nos `Reply Thanks`/`Reply Followup Ask`/`Reply Ack` — mas como tem `onError: continueRegularOutput`, ainda salva o NPS no banco)

---

## Como testar

**Sem cliente real**, num terminal SQL:
```sql
INSERT INTO patient_feedback
  (tenant_id, patient_phone, doctor_name, status, sent_at, appointment_date)
VALUES
  ('singulare', '+55SEUNUMERO', 'Dra. Paula Franzon', 'pending', now(), now())
RETURNING id;
```

Pelo seu WhatsApp, manda **"9"** para o número da Paula. Esperado:
- N8N executa o Master Secretária
- Pre-router lookup encontra o pending
- Switch → Pending → Parse Score (9) → Save → Reply Thanks
- Você recebe "Obrigada pelo retorno! Que bom que correu bem 💜"
- SQL `SELECT * FROM patient_feedback ORDER BY id DESC LIMIT 1` mostra `nps_score=9, status=closed, responded_at=...`

Repete com nota baixa: insere outra row pending, manda "3", esperado:
- Reply "Obrigada pela nota 🙏\nO que podemos melhorar pra próxima vez?"
- DB: `status=awaiting_followup, nps_score=3`
- Manda mensagem de texto livre ("muito tempo de espera"), esperado:
- Reply "Anotado, obrigada por contribuir 💜"
- DB: `status=closed, feedback_text='muito tempo de espera'`

**Sem nada pendente** (terceiro teste): manda "oi" → fluxo normal, IA Gemini responde.

---

## Rollback (se precisar)

No `1. Master Secretária`:
1. Apaga o IF "handled?"
2. Apaga o `Execute Sub-Workflow`
3. Reconecta `Buscar Config Tenant` → `Mensagem chegando?` direto
4. Desativa o `ZWzRBjClOdA5xRNQ`

Comportamento volta a ser idêntico ao de antes.
