# Tool `cobrancas_paciente` no Agente Interno (P03)

Status: aprovado em 2026-05-17. Pronto pra virar plano de implementação.

## Contexto

Hoje o agente interno tem `pagamentos_status` e `pagamentos_pendentes`, ambas com escopo COLETIVO (somam o tenant todo). Quando o usuário pergunta "cobranças da Maria?", o agente não tem como filtrar por paciente — responde só agregados.

Falta uma tool focada num paciente específico, que retorne extrato individual (pagas + pendentes + vencidas) com payment_url quando aplicável.

## Objetivo

Adicionar uma única tool read-only `cobrancas_paciente` no agente P03 que retorna o extrato financeiro de um paciente identificado por `patient_id`, `patient_name` (busca fuzzy) ou `patient_phone` (E.164).

## Não-objetivos

- ~~Edição ou estorno de cobrança~~ — escopo seria muito maior (sensível, exige confirmação literal). Tratado em sub-projeto separado se virar necessidade.
- ~~Disparo de lembrete WhatsApp~~ — depende do sub-projeto "envio de mensagens via Evolution" que está em outro slot do roadmap.
- ~~Filtro por médico em `tenant_payments`~~ — a tabela só tem `doctor_name` denormalizado, sem `doctor_id`. Adicionar filtro robusto exigiria mudança de schema. Adiar até virar necessidade real (clínicas multi-médico).
- ~~Live fetch no Asaas (saldo, taxa dinâmica)~~ — usa só dados já gravados em `tenant_payments` pelo webhook Asaas.

## Decisões de schema

`tenant_payments` é uma tabela **denormalizada** — não tem FK `patient_id`. Campos relevantes:

| Coluna | Tipo | Uso na tool |
|---|---|---|
| `tenant_id` | varchar | filter obrigatório (anti-leak) |
| `patient_phone` | varchar | **chave de junção** com `patients` (E.164) |
| `patient_name` | varchar | exibição |
| `patient_email` | varchar | exibição |
| `consultation_value` | numeric | valor bruto |
| `asaas_net_value` | numeric | valor líquido (taxa já descontada) |
| `status` | varchar | enum aberto: `pending`, `approved`, `paid`, `received`, `confirmed` |
| `payment_method` | varchar | `pix` \| `cartao` \| `boleto` \| etc |
| `payment_url` | text | link Asaas pra cliente pagar (relevante pros pending) |
| `created_at` | timestamptz | dia emissão (base pro cálculo de `days_open`) |
| `doctor_name` | varchar | denormalizado (exibição apenas) |

**Decisão:** match com paciente vai sempre por `patient_phone` (mais confiável que nome). Quando o caller passa `patient_id` ou `patient_name`, primeiro resolvemos o `phone` na tabela `patients` (que tem o id real), depois filtramos `tenant_payments` por `(tenant_id, patient_phone)`.

## Comportamento da tool

### Params

```typescript
{
  patient_id?: "uuid",      // se passado, lookup em patients pra pegar phone
  patient_name?: string,    // ilike '%name%' pra encontrar paciente
  patient_phone?: string,   // E.164 (ex: +5511999999999); mais confiável
  since?: "YYYY-MM-DD",     // default: 90 dias atrás
  status?: "paid" | "pending" | "overdue" | "all",  // default: 'all'
}
```

`patient_id` OU `patient_name` OU `patient_phone` é obrigatório (pelo menos um). Sem nenhum → erro semântico imediato (defesa contra LLM esquecer o identificador).

### Fluxo de execução

1. **Validar input**: precisa ter pelo menos um de `patient_id`, `patient_name`, `patient_phone`. Senão retorna `{ok:false, summary:'Sem paciente identificado.'}`.

2. **Resolver `patient_phone`** (chave canônica):
   - Se `patient_phone` veio direto → usa.
   - Se `patient_id` veio: `SELECT name, phone FROM patients WHERE id=$1 AND tenant_id=$2`. Se não achar → `{ok:false, summary:'Paciente nao encontrado neste tenant.'}`. Se achar → usa phone.
   - Se `patient_name` veio: `SELECT id, name, phone FROM patients WHERE tenant_id=$1 AND name ILIKE '%$2%' LIMIT 5`:
     - 0 matches → `{ok:false, summary:'Paciente "X" nao encontrado.', data:{missing_patient:{name}}}`
     - >1 matches → `{ok:false, summary:'N pacientes batem...', data:{ambiguous:[{id,name,phone}]}}`
     - 1 match → usa o phone retornado.

3. **Query `tenant_payments`**:
   ```sql
   SELECT id, consultation_value, asaas_net_value, status, payment_method,
          payment_url, created_at, doctor_name, patient_name, patient_email
   FROM tenant_payments
   WHERE tenant_id = $1
     AND patient_phone = $2
     AND created_at >= $3   -- since (default: 90d ago)
   ORDER BY created_at DESC
   LIMIT 50;
   ```

4. **Classificar cada item**:
   - **paid**: `status` (lowercase) ∈ `['approved','paid','received','confirmed']`
   - **pending**: `status='pending'` e `days_open <= 3` (onde `days_open = (now - created_at) / 86400000`)
   - **overdue**: `status='pending'` e `days_open > 3`
   - **other**: qualquer outro status (raro; mantém pra debug)

5. **Aplicar filtro `status` opcional**: se param `status` foi passado e não é `'all'`, filtra a lista antes de agregar.

6. **Agregar totais** e montar `summary` legível pro agente:
   ```
   "Maria tem 3 cobranças: 2 pagas (R$700) e 1 vencida (R$350 há 5 dias)."
   ```

### Retorno

```typescript
{
  ok: true,
  summary: string,  // 1-2 frases pro agente narrar
  data: {
    patient: { name: string, phone: string, email?: string },
    totals: {
      paid: number,
      pending: number,
      overdue: number,
      count_paid: number,
      count_pending: number,
      count_overdue: number
    },
    items: Array<{
      id: number,
      value: number,
      net_value: number | null,
      status: string,            // bruto do banco, ex: "pending"
      classification: "paid" | "pending" | "overdue" | "other",
      payment_method: string | null,
      created_at: string,        // ISO
      days_open: number,
      payment_url: string | null,
      doctor_name: string
    }>
  }
}
```

## RBAC + privacidade

- `min_role: 'doctor'` — qualquer role acima também acessa.
- **Doctor**: filtra apenas por `tenant_id` (não há `doctor_id` na tabela pra filtrar). Em uma clínica multi-médico, doctor vê pagamentos do tenant inteiro. Aceitável dado que: (a) só existe Paula em produção hoje, (b) doctor já vê pacientes de outros médicos via outras tools, (c) filtro por médico exigiria mudança de schema.
- **Anti-leak cross-tenant**: TODA query SQL filtra explicitamente por `tenant_id = ctx.tenant_id`. Tanto o lookup em `patients` quanto o select em `tenant_payments`.
- **Privacidade**: a tool expõe `name`, `phone`, `email`, valores e `payment_url` — todos dados que o owner/médico já tem acesso via painel. Nada novo de superfície.

## Onde mexer

| Arquivo | Mudança |
|---|---|
| `app/lib/internal-agent/financeiro.ts` | Adicionar handler `cobrancasPaciente` (~60 linhas) |
| `app/lib/internal-agent-tools.ts` | Entry no `TOOL_CATALOG` (depois de `pagamentos_pendentes`) + bloco PARAM_ALIASES PT (`paciente`, `nome`, `telefone`, `desde`) |
| `app/lib/internal-agent-handlers.ts` | Re-export no barrel + entry no `HANDLERS` |
| `n8n/workflows/EaZNHoaKhq0yJsiS-...json` | systemMessage: 1 entrada nova no domínio Financeiro do `CATÁLOGO POR DOMÍNIO` |

## Critérios de aceite

- Tool `cobrancas_paciente` registrada em `TOOL_CATALOG` com `mode: 'read'`, `min_role: 'doctor'`.
- Handler responde corretamente nos 4 cenários: patient_id válido, patient_name único, patient_name ambíguo, patient_name não encontrado.
- Cross-tenant: query manual com `patient_id` de outro tenant retorna erro semântico, não dados do outro tenant.
- `summary` legível, com pelo menos os 3 totais (paid/pending/overdue) quando aplicáveis.
- `data.items[]` inclui `payment_url` quando presente (pra o agente conseguir mandar o link pro paciente quando alguém perguntar).
- systemMessage do P03 atualizado e workflow PUT na N8N.
- Smoke test via curl `/api/interno/tools` retorna dados reais da Paula pra um paciente conhecido.

## Riscos / mitigação

| Risco | Mitigação |
|---|---|
| `patient_name` ambíguo silencia retorno errado | Lookup retorna `ambiguous[]` explícito, agente desambigua |
| Phone normalization (com/sem `+`, com/sem `55`) | Match por igualdade exata. Se virar problema real, futura iteração normaliza. Atual: usuários colam phone do `patients` direto que já está normalizado |
| `since` muito grande gera retorno gigante | Hard limit `LIMIT 50` no SQL. Se virar problema, paginar |
| Tabela vazia (sem cobrança) | Retorna `{ok:true, summary:'Sem cobranças no período', data:{totals:zerados, items:[]}}` — não é erro |
