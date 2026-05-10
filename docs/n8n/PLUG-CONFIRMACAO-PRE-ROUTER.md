# Plugar Confirmação Pre-Router no Master Secretária

> **Estado atual:** NPS Pre-Router já tá plugado entre `Buscar Config Tenant` e `Mensagem chegando?`.
> **Falta:** Inserir Confirmação Pre-Router **antes** do NPS Pre-Router.
> **Tempo:** ~5 min. Reversível.

## Fluxo final desejado

```
Buscar Config Tenant
    ↓
Confirmação Pre-Router  ← NOVO
    ↓
Confirmação handled?    ← NOVO (IF)
    ├─ true  → (vazio, STOP)
    └─ false ↓
NPS Pre-Router          ← já existe
    ↓
NPF handled?            ← já existe
    ├─ true  → (vazio, STOP)
    └─ false → Mensagem chegando? → fluxo normal IA
```

## Passo 1 — Desconectar `Buscar Config Tenant → NPS Pre-Router`

Abre https://n8n.singulare.org/workflow/OOT4JZyKZUyB0SxB

1. Clica na linha que sai de **`Buscar Config Tenant`** indo pro **`NPS Pre-Router`**
2. Aperta **Delete** (a tecla, não botão direito)

> **Nota:** Hoje há 2 saídas do `Buscar Config Tenant` indo pro NPS Pre-Router (output 0 e output 1). Apaga **as duas**.

## Passo 2 — Adicionar nó `Confirmação Pre-Router`

1. Clica no `+` da saída do **`Buscar Config Tenant`** (qualquer das 2 saídas)
2. Busca **"Execute Sub-Workflow"** (n8n-nodes-base.executeWorkflow)
3. Configura:
   - **Source:** Database
   - **Workflow:** `Master Secretária — Confirmação Pre-Router`
   - **Mode:** Run once with all items
   - **Workflow Inputs → Mapping Mode:** Define Below for Each Output
   - Cola estes 6 fields exatamente como abaixo (Type fica string em todos):

| Field | Value |
|---|---|
| `tenant_id` | `={{ $('Buscar Config Tenant').item.json.tenant_id }}` |
| `patient_phone` | `={{ $('Info').item.json.telefone }}` |
| `mensagem` | `={{ $('Info').item.json.mensagem }}` |
| `id_conta` | `={{ $('Info').item.json.id_conta }}` |
| `id_conversa` | `={{ $('Info').item.json.id_conversa }}` |
| `url_chatwoot` | `={{ $('Info').item.json.url_chatwoot }}` |

   - **Options → Wait for Sub-Workflow Completion:** ON
4. **Renomeia** o nó: clica no nome → `Confirmação Pre-Router`

## Passo 3 — Adicionar IF `Confirmação handled?`

1. Clica no `+` da saída do **`Confirmação Pre-Router`**
2. Busca **"If"** (n8n-nodes-base.if)
3. Configura **uma única condition**:
   - **Value 1:** `={{ $json.handled }}` (com expression mode)
   - **Operator:** `is true` (boolean)
4. **Renomeia:** `Confirmação handled?`

## Passo 4 — Conectar

- **Saída `true`** do `Confirmação handled?` → **deixa SEM conexão** (encerra o workflow — Confirmação Pre-Router já respondeu o paciente)
- **Saída `false`** do `Confirmação handled?` → conecta no nó **`NPS Pre-Router`** (que já existe)

## Passo 5 — Save + Active

1. **Save** (Ctrl/Cmd+S)
2. **Toggle Active** no canto superior direito (precisa ficar verde)

## Como testar

**Teste 1 — Sem confirmação pendente (fluxo normal):**
- Pelo seu WhatsApp, manda "oi" pra Paula
- Esperado: agente IA responde normal (Confirmação não interfere — `handled=false`, NPS também `handled=false`, cai no AI Agent)

**Teste 2 — Com confirmação pendente:**
```sql
-- 1. Cria appointment scheduled pra +55SEUNUMERO em ~24h
INSERT INTO appointments (tenant_id, patient_phone, patient_name, doctor_name, appointment_date, status)
VALUES ('singulare', '+55SEUNUMERO', 'Teste', 'Dra. Paula Franzon', now() + interval '24 hours', 'scheduled')
RETURNING id;

-- 2. Insere mensagem fake "ai" com palavra "confirm" nas últimas 18h
INSERT INTO n8n_historico_mensagens (session_id, message)
VALUES ('+55SEUNUMERO', '{"type":"ai","content":"Olá! Tudo bem? Vim confirmar sua consulta amanhã às 10h. Posso confirmar?"}'::jsonb);
```

- Pelo seu WhatsApp, manda **"sim"** pra Paula
- Esperado: 
  - Confirmação Pre-Router classifica intent=`confirm`
  - UPDATE `appointments.status='confirmed'`
  - Reply via Chatwoot: "Combinado! 💜 Sua consulta está confirmada..."
  - Push pro médico (✅ Teste confirmou)
  - `handled=true` → AI Agent NÃO roda
- Conferir: `SELECT status FROM appointments ORDER BY id DESC LIMIT 1;` → `confirmed`

**Teste 3 — Cancelar:**
- Mesma setup do Teste 2 (resetando status pra scheduled)
- Manda **"cancelar"**
- Esperado: push pro médico (❌ cancelou), `handled=false` → AI Agent assume e usa Calendar pra cancelar

## Rollback

1. Apaga os 2 nós novos (`Confirmação Pre-Router` + `Confirmação handled?`)
2. Reconecta `Buscar Config Tenant` direto no `NPS Pre-Router`
3. Save

Volta ao estado de antes (NPS-only).

## Por que esta ordem?

Confirmação **antes** do NPS porque:
- Confirmação roda 1×/dia por paciente agendado (volume diário)
- NPS roda 1×/dia por paciente atendido (volume bem menor)
- Match no Confirmação tem critério forte (mensagem AI recente + appointment próximo) → falsos positivos baixos
- Se ambos `handled=false`, fluxo normal AI roda (custo zero de chamar pre-routers vazios)
