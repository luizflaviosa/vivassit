# Suite E2E — Agente Master Secretária IA

Suite automatizada que dispara cenários reais no workflow P01 do N8N e avalia se o agente IA respondeu adequadamente. Pré-construída pra detectar os bugs identificados na auditoria de 2026-05-15.

Detalhes da estratégia, cenários e categorias em [`docs/agent-test-matrix.md`](../../../docs/agent-test-matrix.md).

## Pré-requisitos

1. **Tenant `singulare-e2e`** já criado via migration `20260515200000_seed_singulare_e2e_tenant.sql`. Confirme via:
   ```bash
   psql -c "SELECT tenant_id, status FROM tenants WHERE tenant_id = 'singulare-e2e';"
   ```

2. **Variáveis de ambiente** no `app/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ANTHROPIC_API_KEY=...
   # Opcional:
   N8N_P01_WEBHOOK_URL=https://n8n.singulare.org/webhook/a2f5a714-f279-4452-aa0e-63506eadd347
   AGENT_JUDGE_MODEL=claude-sonnet-4-6
   ```

## Como rodar

```bash
cd app
npm run test:agent                       # todos os cenários
npm run test:agent -- C15                # 1 cenário específico
npm run test:agent -- --grep falha-tools # categoria
npm run test:agent -- C15 C16 C17        # vários
```

Output:
- Console: linha por cenário com PASS/FAIL e tempo
- Relatório markdown completo em `docs/agent-test-matrix-history/<timestamp>.md` (com transcrição turn-a-turn)
- Exit code: 0 se todos PASS, 1 se algum FAIL

## Como funciona

1. **Setup**: cada cenário gera telefone/conversation_id únicos (`+551190000XXXXX`, conv `>900000`) pra não colidir com produção
2. **Payload**: cliente POST monta payload no shape Chatwoot esperado pelo nó `Info` do P01 e dispara no webhook
3. **Polling**: aguarda mensagem `type: ai` aparecer em `n8n_historico_mensagens` pra essa session_id (timeout 60s)
4. **Assertions**: 4 tipos mecânicos (string, booking, vazio, duplicada) + LLM judge (Claude avalia critério semântico)
5. **Cleanup**: DELETE em `n8n_historico_mensagens` e `doctor_bookings` filtrado por `tenant_id = singulare-e2e` + telefone do cenário

## Isolamento

- Tenant exclusivo `singulare-e2e` com `Dra. Teste E2E` (CRM/SP 999999, doctor_code 999)
- Calendar fake `e2e-test-calendar@singulare.local` — `safe_create_event` vai falhar no passo Calendar, mas o booking ainda vai pro banco (suficiente pra maioria das assertions)
- Telefones `+551190000*` reservados pra testes — não conflitam com `+5511977700*` (smoke tests antigos)
- Conversation IDs `>900000` evitam colidir com Chatwoot real (que tá em ~500)
- Evolution não vai conseguir enviar WhatsApp pros números fake — tudo bem, a mensagem AI já tá gravada no histórico antes do envio

## Limitações conhecidas

- **Anexos** (áudio, imagem, PDF) ainda não suportados — o builder aceita `attachment` mas precisa hospedar arquivo real e passar `data_url` válida
- **Concorrência** (C26-C28) requer execução paralela controlada — runner atual roda serial
- **Reaction** (C14) requer payload Chatwoot diferente — não testado ainda
- **Calendar checks** dependem de Google Calendar real — testes assumem que `safe_create_event` falha no Calendar mas grava booking no DB

## Próximos passos

Implementar cenários restantes da matriz (atualmente: ~8 de 44). Cada arquivo em `scenarios/` cobre uma categoria.

## Estrutura

```
app/scripts/test-agent-e2e/
├── README.md              # este arquivo
├── runner.ts              # CLI entry
├── config.ts              # env vars
├── types.ts               # Scenario, AssertionResult, etc
├── lib/
│   ├── supabase.ts        # cliente admin
│   ├── webhook-client.ts  # POST no webhook P01
│   ├── response-watcher.ts # poll histórico
│   ├── cleanup.ts         # DELETE
│   ├── assertions.ts      # 4 tipos mecânicos
│   ├── llm-judge.ts       # Claude judge
│   └── fixtures.ts        # builder payload
└── scenarios/
    ├── 01-novo-paciente.ts
    ├── 04-falha-tools.ts
    ├── 05-adversarial.ts
    └── 08-tipos-mensagem.ts
```
