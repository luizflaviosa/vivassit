---
description: Create tenant — Supabase row + Chatwoot inbox + Evolution instance + welcome email
argument-hint: [slug] [clinic_name] [admin_email]
allowed-tools: Agent, Bash, Read, Edit, mcp__supabase__execute_sql
---

# /onboard-tenant — Provisionar nova clínica

Cria um tenant ponta-a-ponta no stack Singulare.

## Passos

### 1. Parse + validação dos argumentos

`$ARGUMENTS` deve conter 3 tokens separados por espaço: `<slug> <clinic_name> <admin_email>`.

- `slug`: lowercase, `[a-z0-9-]+`, 3-40 chars (vai virar subdomínio/identificador).
- `clinic_name`: pode conter espaços — se vier com espaços, trate o segundo token como nome até o último-1, e o último como email. Se ambíguo, peça ao usuário para passar entre aspas ou em prompt interativo.
- `admin_email`: regex válido de email.

Se faltar QUALQUER arg ou for inválido: pare, peça ao usuário, NÃO assuma defaults.

### 2. Resumo + confirmação

Mostre ao usuário:

```
Vai criar tenant:
  slug:        <slug>
  nome:        <clinic_name>
  admin email: <admin_email>
  Supabase:    INSERT em tenants
  Chatwoot:    nova inbox em chatwoot.singulare.org (account 1)
  Evolution:   instância (provisionamento manual via UI — checklist abaixo)
  Email:       welcome via SES (us-east-1)
```

**Espere o "ok" do usuário antes de continuar.**

### 3. Criar tenant no Supabase

Use `mcp__supabase__execute_sql` no projeto `qwyxacfgoqlskidwzdxe`:

```sql
insert into public.tenants (slug, name, admin_email, status, created_at)
values ('<slug>', '<clinic_name>', '<admin_email>', 'active', now())
returning id, slug, created_at;
```

Capture o `id` retornado — vai ser usado nos próximos passos.

### 4. Chatwoot inbox

Rode o script de onboarding:

```bash
node scripts/automation/chatwoot-onboard.mjs --slug=<slug> --tenant-id=<uuid> --name="<clinic_name>"
```

Se o script ainda não existir (`!test -f scripts/automation/chatwoot-onboard.mjs && echo OK || echo MISSING`), pare e reporte ao usuário que esse passo precisa ser feito manualmente via UI do Chatwoot (account 1) — listando: criar inbox tipo "API", canal name `<clinic_name>`, anotar `inbox_id` para gravar em `tenants.chatwoot_inbox_id`.

### 5. Evolution instance (manual)

Provisionamento via UI por enquanto. Mostre este checklist ao usuário:

```
[ ] Acessar painel Evolution self-hosted
[ ] Criar nova instância com nome: singulare-<slug>
[ ] Configurar webhook -> https://n8n.singulare.org/webhook/evolution-inbound
[ ] Eventos a habilitar: MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED
[ ] Anotar instance API key
[ ] Atualizar tenants.evolution_instance_name = 'singulare-<slug>' via SQL
```

(TODO automatizar com `scripts/automation/evolution-provision.mjs` no futuro.)

### 6. Welcome email (SES)

- Se existir endpoint interno (procure em `app/app/api/` por algo tipo `send-welcome` ou `tenant/welcome`): chame-o via `curl` com payload `{ tenant_id, admin_email, slug }`.
- Se não existir: TODO — registre no log e peça ao usuário para enviar manualmente. Não invente endpoint.

### 7. Log + relatório final

Apresente ao usuário:

```
Tenant criado:
  id:              <uuid>
  slug:            <slug>
  Supabase row:    OK
  Chatwoot inbox:  <inbox_id> | MANUAL PENDING
  Evolution:       MANUAL — checklist acima
  Welcome email:   SENT | TODO
  Próximos passos: /deploy se mudou config; testar login do admin
```

Acrescente uma linha em `docs/onboarding-log.md` (crie se não existir) com data + slug + quem rodou.

## Regras

- NUNCA crie o tenant se a confirmação não veio explicitamente.
- Se qualquer passo crítico (Supabase) falhar, NÃO siga para os demais — reporte o erro.
- Não exponha API keys do Evolution / SES no output. Mascare.
