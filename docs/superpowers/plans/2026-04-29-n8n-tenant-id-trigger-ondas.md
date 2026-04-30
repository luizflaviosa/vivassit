# Triggers de tenant_id automático nas tabelas n8n

**Data aplicação:** 2026-04-29
**Goal:** Garantir que toda escrita do n8n nas tabelas multi-tenant grave com `tenant_id` correto, mesmo nos nós Memory (que não permitem column mapping).

## Contexto

Workflows n8n da Master Secretária escrevem em 4 tabelas:
- `n8n_fila_mensagens` — Enfileirar mensagem (postgres node) já passa tenant_id explícito ✅
- `n8n_historico_mensagens` — Memory (Postgres Chat Memory) e Salvar memoria escrevem aqui
- `n8n_historico_exames` — Registra Exames (postgres node) escreve aqui
- `n8n_historico_exames_memory` — Postgres Chat Memory1 escreve aqui

Memory nodes não expõem column mapping → escrita auto SEM tenant_id → coluna NOT NULL com default `'singulare'` mascarava o problema.

## O que foi aplicado

### Onda 1 — Trigger em `n8n_historico_mensagens`

```sql
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_session_mensagens()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp' AS $$
BEGIN
  IF (NEW.tenant_id IS NULL OR NEW.tenant_id = 'singulare')
     AND NEW.session_id ~ '^\+\d{10,15}$' THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.n8n_fila_mensagens
    WHERE telefone = NEW.session_id
    ORDER BY timestamp DESC LIMIT 1;
    IF NEW.tenant_id IS NULL THEN NEW.tenant_id := 'singulare'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_tenant_id_mensagens
BEFORE INSERT ON public.n8n_historico_mensagens
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_session_mensagens();
```

**Lógica:** Se INSERT vem sem tenant_id (ou cai no default 'singulare') E session_id parece telefone E.164, lookup em `n8n_fila_mensagens` pelo telefone mais recente. Se não achar, mantém 'singulare'.

### Onda 2 — Tabelas de exames

```sql
ALTER TABLE public.n8n_historico_exames
  ADD COLUMN tenant_id varchar NOT NULL DEFAULT 'singulare';

ALTER TABLE public.n8n_historico_exames_memory
  ADD COLUMN tenant_id varchar NOT NULL DEFAULT 'singulare';

-- Trigger especifico para exames usa telefone_paciente
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_telefone_exames()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp' AS $$
BEGIN
  IF (NEW.tenant_id IS NULL OR NEW.tenant_id = 'singulare')
     AND NEW.telefone_paciente ~ '^\+\d{10,15}$' THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.n8n_fila_mensagens
    WHERE telefone = NEW.telefone_paciente
    ORDER BY timestamp DESC LIMIT 1;
    IF NEW.tenant_id IS NULL THEN NEW.tenant_id := 'singulare'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_tenant_id_exames
BEFORE INSERT ON public.n8n_historico_exames
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_telefone_exames();

-- exames_memory reusa funcao da Onda 1 (session_id-based)
CREATE TRIGGER trg_set_tenant_id_exames_memory
BEFORE INSERT ON public.n8n_historico_exames_memory
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_session_mensagens();
```

## Smoke tests executados (PASS)

| Cenário | Tabela | Input | tenant_id derivado | Resultado |
|---|---|---|---|---|
| Telefone real na fila | historico_mensagens | session_id=`+5500000001` (clinica-voda na fila) | `clinica-voda-c6e7d50f` | ✅ PASS |
| Session fixo | historico_mensagens | session_id=`assistente_confirmacao` | `singulare` (fallback) | ✅ PASS |
| Telefone fantasma | historico_mensagens | session_id=`+5599999999999` | `singulare` (fallback) | ✅ PASS |
| Telefone real | historico_exames | telefone_paciente=`+5500000002` | `clinica-voda-c6e7d50f` | ✅ PASS |
| Telefone fantasma | historico_exames | telefone_paciente=`+5599999999998` | `singulare` (fallback) | ✅ PASS |
| Telefone real | historico_exames_memory | session_id=`+5500000002` | `clinica-voda-c6e7d50f` | ✅ PASS |
| Session fixo | historico_exames_memory | session_id=`exam_specialist_session` | `singulare` (fallback) | ✅ PASS |

Todos os smoke tests rodaram em transação BEGIN…ROLLBACK — estado de produção intacto.

## Estado atual pós-aplicação

| Tabela | Rows | tenant_id existente |
|---|---|---|
| n8n_historico_mensagens | 1270 | todos 'singulare' (legacy, antes da era multi-tenant) |
| n8n_fila_mensagens | 185 | todos 'singulare' |
| n8n_historico_exames | 0 | n/a |
| n8n_historico_exames_memory | 0 | n/a |

Nenhuma migração retroativa de dados — só rows NOVAS são afetadas pelo trigger.

## Rollback (se necessário)

```sql
-- Onda 2 → Onda 1 (ordem reversa)
DROP TRIGGER IF EXISTS trg_set_tenant_id_exames_memory ON public.n8n_historico_exames_memory;
DROP TRIGGER IF EXISTS trg_set_tenant_id_exames ON public.n8n_historico_exames;
DROP FUNCTION IF EXISTS public.set_tenant_id_from_telefone_exames();

-- ATENCAO: ALTERs nao sao rollbackaveis sem perda de dados.
-- Antes de DROP COLUMN, considera fazer um backup:
-- CREATE TABLE n8n_historico_exames_bkp AS SELECT * FROM n8n_historico_exames;
ALTER TABLE public.n8n_historico_exames DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.n8n_historico_exames_memory DROP COLUMN IF EXISTS tenant_id;

DROP TRIGGER IF EXISTS trg_set_tenant_id_mensagens ON public.n8n_historico_mensagens;
DROP FUNCTION IF EXISTS public.set_tenant_id_from_session_mensagens();
```

## Limitações conhecidas

1. **Postgres Chat Memory com session_id fixo** (ex: `assistente_confirmacao`) cai sempre em `'singulare'`. Solução completa exigiria mudar workflow pra usar `session_id = 'assistente_confirmacao_<tenant_id>'`. Por ora, esses 20 rows compartilham bucket — risco baixo já que é scratch interno do agente.

2. **Trigger depende de fila ter sido populada antes** — workflow já garante isso (`Enfileirar mensagem.` roda antes do agente).

3. **Race condition teórica** — se Memory grava ANTES do Enfileirar mensagem (impossível pelo design atual), lookup falha → cai em 'singulare'.

## Próximas ações sugeridas (futuras)

- [ ] Audit retroativo: rodar `SELECT count(*), tenant_id FROM n8n_historico_mensagens GROUP BY 1` quando 2º tenant ativar
- [ ] Considerar mudar Postgres Chat Memory do Assistente de confirmação pra session_id dinâmico
- [ ] Migrations para popular tenant_id corretamente em rows legados (se necessário multi-tenant histórico)
