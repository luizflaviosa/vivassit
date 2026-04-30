# Tenant `singulare` (Dra. Paula Franzon) — Status full

**Data:** 2026-04-30 · usuária real principal da plataforma

## ✅ Configurado e funcionando

| Camada | Estado |
|---|---|
| **Tenant** | `clinic_name='Clínica Singulare'`, `status=active`, `subscription=trialing` |
| **Profissional** | Dra. Paula Franzon · Reumatologia · R$ 350 / 60min · seg/qui/sex 14-18h |
| **WhatsApp (Evolution)** | `+5511953441350` · `evolution_status=connected` · instance "Dra. Paula Franzon" |
| **Chatwoot** | account_id=1, inbox_id=3, url chatwoot.singulare.org/ |
| **Telegram bot** | `@SingulareBot?start=singulare` (chat_id 5749317361) |
| **Google Calendar** | `ff52c2d3...d0f84a@group.calendar.google.com` (Dra. Paula Franzon) |
| **Service Account** | `atendimento-singulare@grand-quarter-462319-i7.iam.gserviceaccount.com` com acesso ao calendar |
| **Prompts IA** | rendered_prompt (1000 chars) + assistant_prompt (336 chars) + internal_agent_capabilities ✓ |
| **Atividade real** | 30 mensagens/24h via Master Secretária — produção ativa |

## Workflows N8N que rodam pra ela automaticamente

| Workflow | Status | Cobertura |
|---|---|---|
| **1. Master Secretária** (`OOT4JZyKZUyB0SxB`) | ✅ ATIVO | Recebe pacientes via Chatwoot, agenda, cancela, consulta agenda |
| **2. Confirmação Diária** (`sOB9YWGkmDpW3NP4`) | ✅ ATIVO | Cron seg-sex 8h: lista todas consultas do dia seguinte e envia confirmação WhatsApp |
| **3. NPS Pesquisa Pós-Consulta** (`87vZl62KFCOqFbyI`) | ⚠️ CRIADO INATIVO | Cron 19h BRT: pesquisa NPS após consulta. Aguarda você ativar |
| **6. Assistente Interno BACKUP** (`WmM47MvuJPU8szyM`) | ✅ ATIVO | Chat IA do painel — Dra Paula tem `telegram_chat_id` válido |
| **0. Onboarding** | n/a | Dra Paula já onboardada |

## Pendências (necessitam ação sua)

### 1. Ativar workflow NPS no N8N
- Abre `https://n8n.singulare.org/workflow/87vZl62KFCOqFbyI`
- Verifica que credenciais Postgres + Google Calendar foram atribuídas (já foram automaticamente)
- Verifica env vars do N8N:
  - `EVOLUTION_BASE_URL` (ex: `https://evo.singulare.org`)
  - `EVOLUTION_API_KEY` (se sua Evolution exige)
- Toggle "Active" no canto superior
- **Teste manual:** clica "Execute Workflow" — vai rodar uma vez agora; checa se o Postgres `patient_feedback` recebe rows pending

### 2. Modificar Master Secretária pra capturar respostas NPS (pre-router)
Documentado em `docs/n8n/master-secretaria-nps-handler.md`. Adiciona 3 nós no início:
- Lookup Pending NPS (vê se paciente respondeu nas últimas 24h)
- Switch (numérico 0-10 = NPS, texto = follow-up se score baixo)
- Save Score / Save Followup

Sem isso, paciente até manda nota mas o sistema não captura — fica como conversa normal.

### 3. Dados pessoais a completar manualmente
Não tenho como inventar — você atualiza:
- `tenants.doctor_crm` (CRM da Dra Paula)
- `tenants.cnpj` (se houver MEI/PJ)
- `tenant_doctors.doctor_crm` (idem)
- `tenants.accountant_email` (atualmente placeholder `singulareempresa+contador@gmail.com` — troca pelo email do contador real)

### 4. Asaas KYC produção
- `asaas_account_status=pending` — submete documentação no Asaas pra sair de sandbox e aceitar pagamento real
- 7min de form + 24h de aprovação

### 5. (Opcional) Convidar membros da equipe
Hoje ela é o único member. Se tiver recepcionista ou parceiro:
- `/painel/equipe` → Convidar membro (recebe magic link por email)

## Como validar fim a fim

1. **WhatsApp paciente** → manda "Oi" no `+5511953441350`
2. Master Secretária responde, agenda consulta no Calendar
3. **Próximo dia 8h** → Confirmação Diária envia "Confirma sua consulta?" pro paciente
4. **Após consulta (depois das 19h)** → NPS workflow envia "De 0 a 10..." (após ativar)
5. Paciente responde número → Master Secretária pre-router salva em `patient_feedback`
6. Você abre `/painel/feedback` e vê NPS calculado em tempo real
