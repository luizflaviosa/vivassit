# Integrações · Singulare

Mapa vivo de **todas as integrações, URLs, tokens, webhooks e fluxos** do sistema.
Documento referência pra qualquer dev novo, para auditoria e pra fechar gaps de setup futuro.

> **Atualizar quando**: nova integração entra no stack, troca de fornecedor, novo
> redirect URI / webhook / token. Cada seção tem dono mental — se mexer, atualiza.

---

## 🗺️ Visão geral

```
                    ┌─────────────────────────────┐
                    │    PACIENTE (WhatsApp)      │
                    └──────────────┬──────────────┘
                                   │ msg
                                   ▼
                    ┌─────────────────────────────┐
                    │   Evolution (self-hosted)   │ ← WhatsApp infra
                    └──────────────┬──────────────┘
                                   │ webhook
                                   ▼
                    ┌─────────────────────────────┐
                    │            n8n              │ ← orquestração + agente IA
                    │  (workflows, AI agent P03)  │
                    └──────────────┬──────────────┘
                                   │ Bearer N8N_TO_VERCEL_TOKEN
                                   ▼
            ┌──────────────────────────────────────────┐
            │   Vercel Next.js — app.singulare.org     │
            │   /api/interno/*  (server-to-server)     │
            │   /api/painel/*   (user auth, requireTenant)
            │   /api/webhooks/* (público assinado)     │
            └──────┬─────────┬──────────┬──────────────┘
                   │         │          │
            ┌──────▼───┐ ┌───▼────┐ ┌───▼──────────────────┐
            │ Supabase │ │ DFS    │ │  Outras integrações  │
            │ Postgres │ │ Trends │ │  Google APIs / Asaas │
            │ Auth     │ │        │ │  MP / Chatwoot / etc │
            └──────────┘ └────────┘ └──────────────────────┘
```

---

## 🌐 Domínios e URLs

| Domínio | Aponta pra | Uso |
|---|---|---|
| `singulare.org` | DNS principal | Marketing site (futuro) |
| `app.singulare.org` | Vercel (projeto `vivassit`) | Painel + APIs |
| `chatwoot.singulare.org` | Chatwoot self-hosted | Atendimento |
| `mcp-chatwoot/` (local) | servidor MCP local | wrapper API Chatwoot |
| n8n instance | externo (URL conhecida pelo time) | workflows |
| Evolution instance | self-hosted | WhatsApp connector |

---

## 🔌 Sistemas externos

### Vercel

- **Projeto**: `vivassit` (`prj_HTYSHEBUacKN8hGBeGP4XugfeIz9`)
- **Team**: `team_bt7LVA71g3zN0Brw0PV1jHk7` (luizflaviosa's projects)
- **Branch deploy**: `main` → produção em `app.singulare.org`
- **Cron jobs** (em `app/vercel.json`):
  - `/api/interno/region-demand-refresh` — dia 1 às 03:00 UTC
  - `/api/interno/market-trends-refresh` — dia 1 às 03:30 UTC
- **Env vars**: configuradas só via dashboard Vercel (NUNCA em git)
- **Auth pra cron**: header `Authorization: Bearer ${CRON_SECRET}` ou `${N8N_TO_VERCEL_TOKEN}`

### Supabase

- **Project ID**: ver `lib/supabase.ts` / `.env.local`
- **Tabelas chave**:
  - Multi-tenant: `tenants`, `tenant_members` (CASCADE), `tenant_doctors`
  - Score: `tenant_scores`, `tenant_market_keywords`, `tenant_region_demand_history`, `tenant_market_trends_history`
  - Operacional: `appointments`, `patient_clinical_data`, `medical_documents`
  - Marketing: `vitrine_profiles`, `marketing_events`, `marketing_subscriptions`, `tenant_posts`, `tenant_campaigns`
  - n8n: `n8n_fila_mensagens`, `n8n_historico_mensagens`
  - Auth: `auth.users` (gerido pelo Supabase)
- **Auth**:
  - `SUPABASE_SERVICE_ROLE_KEY` — server-side, bypass RLS, em rotas `/api/*`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-side com RLS
- **Tenant resolution** (`lib/auth-tenant.ts`):
  1. Cookie `singulare_active_tenant` → valida via `tenant_members`
  2. `tenant_members.user_id` ativo mais recente
  3. Fallback `tenants.admin_email` (cria tenant_member auto)

### Google Cloud (project `grand-quarter-462319-i7`)

- **APIs habilitadas**:
  - Google Ads API (`googleads.googleapis.com`)
  - Google Calendar API
  - (validar lista completa no Cloud Console)
- **OAuth 2.0 Client**: `n8n-google` — `216899828411-j4cgoib7k3n1ps3nc0ht0r69t442ctr8.apps.googleusercontent.com`
- **Service Account**: `atendimento-singulare@grand-quarter-462319-i7.iam.gserviceaccount.com` (Calendar API server-side)

#### Modelo de multi-tenancy do Google Calendar (decisão arquitetural)

**Modelo escolhido: Single-account + Multi-calendar**

Todos os calendários dos médicos vivem dentro de UMA única conta Google (admin do Singulare). Cada médico recebe um "secondary calendar" próprio com ID único formato `<hash>@group.calendar.google.com`. O ID fica armazenado em `tenant_doctors.calendar_id`.

**Por que esse modelo:**
- ❌ NÃO precisa Workspace Google (zero custo recorrente)
- ❌ NÃO precisa Service Account + Domain-Wide Delegation
- ❌ NÃO precisa publicar OAuth Consent Screen
- ❌ NÃO precisa cada médico fazer OAuth próprio
- ❌ NÃO precisa subdomínio dedicado de auth
- ✅ 1 OAuth flow inicial (admin Singulare), refresh_token vale indefinidamente pois admin é developer/test user
- ✅ Onboarding novo tenant não tem fricção — sistema cria calendário automaticamente
- ✅ Médico recebe convite/share do calendário no Gmail dele (pessoal) e visualiza

**Fluxo automatizado:**
```
1. POST /api/onboarding (cria tenant + médico)
2. lib/google-calendar.ts.createDoctorCalendar() chama Calendar API
3. Calendar API retorna novo calendar_id (xxxxx@group.calendar.google.com)
4. Salva em tenant_doctors.calendar_id
5. Push notification (watch) configurado em /api/admin/google-calendar/setup-watches
6. Eventos sincronizados via webhook /api/webhooks/google-calendar
```

**Limites práticos a monitorar:**
- Google Calendar API: ~25-50 calendários por conta gratuita; com Workspace pago sobe pra ~750
- Quando aproximar do teto, opções: (a) migrar pra Workspace + DWD, (b) usar múltiplas contas com sharding por tenant, (c) modelo híbrido
- API quota: 1M req/day no projeto — folga grande hoje

**Referência implementação:**
- Helper: [lib/google-calendar.ts](../app/lib/google-calendar.ts)
- Sync: [lib/google-calendar-sync.ts](../app/lib/google-calendar-sync.ts)
- Onboarding: [app/api/onboarding/route.ts](../app/app/api/onboarding/route.ts)
- Watches: [app/api/admin/google-calendar/setup-watches/route.ts](../app/app/api/admin/google-calendar/setup-watches/route.ts)
- Backfill: [app/api/admin/backfill-doctor-calendars/route.ts](../app/app/api/admin/backfill-doctor-calendars/route.ts)
- Webhook: [app/api/webhooks/google-calendar/](../app/app/api/webhooks/google-calendar/)

### Google Ads

- **Manager Account (MCC)**: `131-855-2890` ("Singulare")
- **Conta gerenciada**: `633-595-8403` (Singulare clínica)
- **Developer token**: vive no Manager (API Center) — atualmente em **Test Access**
- **OAuth Client**: `n8n-google` (o mesmo do Calendar — compartilha)
- **OAuth refresh_token**: gerado via `scripts/get-google-refresh-token.mjs` — vale indefinidamente
- **API version testada e funcional**: v21 (Google mantém últimas 4 versões)

#### Status atual (bloqueio conhecido)

🚧 Developer token está em **Test Access** — `listAccessibleCustomers` funciona, mas qualquer chamada a contas reais (incluindo a própria Singulare) retorna 403 `DEVELOPER_TOKEN_NOT_APPROVED`.

**Para destravar**: aplicar pra **Basic Access** em https://ads.google.com → Manager → Tools → API Center → Access Levels. Prazo típico: 1–14 dias úteis.

**Pré-requisitos pra aprovação:**
- Site público com conteúdo real (`singulare.org`)
- Privacy policy URL publicada
- Descrição do uso da API (ex: "SaaS pra clínicas — Keyword Planner pra insights de mercado")
- Email de contato monitorado

#### Arquitetura prevista (após aprovação)

```
Singulare backend (Vercel)
   │ refresh_token (vive em env GADS_REFRESH_TOKEN, não expira)
   ▼
Google Ads API v21
   │ login-customer-id: 1318552890 (MCC)
   │ customer_id: 6335958403 (conta cliente)
   ▼
KeywordPlanIdeaService.generateKeywordIdeas
   → search_volume + cpc + competition por keyword/região
```

#### Scripts de teste/setup
- `scripts/get-google-refresh-token.mjs` — OAuth flow local
- `scripts/test-google-ads-keywords.mjs` — sanity check + teste real do Keyword Planner

### Google Business Profile (GBP)

- **OAuth scope**: `https://www.googleapis.com/auth/business.manage`
- **OAuth Client**: `n8n-google` (mesmo do Calendar/Ads)
- **APIs usadas**:
  - `mybusinessaccountmanagement.googleapis.com/v1/accounts` — descobre o account ID
  - `mybusinessbusinessinformation.googleapis.com/v1/{account}/locations` — descobre location ID
  - `businessprofileperformance.googleapis.com/v1/locations/{id}:fetchMultiDailyMetricsTimeSeries` — métricas diárias
- **Métricas coletadas**: impressões (search/maps × desktop/mobile), call clicks, direction requests, website clicks, bookings, conversations
- **Token**: `refresh_token` long-lived criptografado em `marketing_subscriptions.gbp_refresh_token_enc`
- **Cache**: append-only em `tenant_gbp_insights_history` (1 row por refresh)
- **Refresh**: cron mensal `/api/interno/gbp-insights-refresh` (`0 4 1 * *`) + botão manual no painel
- **Pré-requisito**: tenant precisa ter perfil GBP verificado e fazer OAuth via `/painel/marketing/configurar`

#### Pré-requisito Cloud Console

Habilitar no projeto `grand-quarter-462319-i7`:
- `mybusinessaccountmanagement.googleapis.com`
- `mybusinessbusinessinformation.googleapis.com`
- `businessprofileperformance.googleapis.com`

E adicionar redirect URI no OAuth Client `n8n-google`:
- `https://app.singulare.org/api/painel/marketing/oauth/gbp`

### Google Places (New)

- **API key**: `GOOGLE_PLACES_API_KEY` (env Vercel)
- **APIs usadas**:
  - `places.googleapis.com/v1/places:searchText` — descobre competidores no raio
  - `maps.googleapis.com/api/place/findplacefromtext/json` — usado em `/api/painel/google-place/lookup` pra achar Place ID da clínica
  - `maps.googleapis.com/api/geocode/json` — geocoding pra centro do raio
- **Custo**: ~US$ 0.032/searchText (Text Search Pro). Refresh mensal por tenant.
- **Cache**: append-only em `tenant_competitors_history`
- **Refresh**: cron mensal `/api/interno/competitors-refresh` (`30 4 1 * *`) + botão manual

### DataForSEO

- **Conta**: `luizflaviosa@yahoo.com.br`
- **Status atual**: Trends/clickstream funciona ✅ · Google Ads search_volume retorna nulls (ticket aberto com Svitlana)
- **Saldo**: pay-as-you-go — checar em https://app.dataforseo.com/
- **Endpoints em uso**:
  - `keywords_data/dataforseo_trends/explore/live` (12m + delta)
  - `keywords_data/dataforseo_trends/subregion_interests/live`
  - `keywords_data/dataforseo_trends/demography/live`
- **Endpoints pretendidos** (catálogo em `exports/dataforseo-campos-disponiveis.csv`):
  - `clickstream_data/bulk_search_volume` — alternativa ao Google Ads se este não destravar
  - `dataforseo_labs/google/keyword_suggestions` + `keyword_ideas` — descoberta de keywords
  - `dataforseo_labs/google/search_intent` — classificação de intent
  - `dataforseo_labs/google/serp_competitors` — análise de concorrentes

### Instagram Graph API (Meta)

- **App Meta**: criado em [developers.facebook.com](https://developers.facebook.com/apps), produto "Facebook Login for Business" + "Instagram Graph API"
- **Tipo**: Business
- **Status**: Development mode até Business Verification + App Review concluírem
  - Em Development: só Admins/Developers/Testers do app conseguem fazer OAuth
  - Em Live: qualquer tenant pode conectar
- **Redirect URI cadastrada**: `https://app.singulare.org/api/painel/marketing/oauth/instagram`
- **Graph version fixa**: v21.0
- **Token model**: long-lived user access token (60 dias) trocado via `fb_exchange_token`. Renovação mensal via cron.

#### Permissions / Scopes solicitados

| Scope | Pra quê | Status app review |
|---|---|---|
| `instagram_business_basic` | ler perfil, media list | sensível — Standard Access |
| `instagram_business_content_publish` | publicar posts/carousels | sensível — Standard Access |
| `pages_show_list` | listar páginas FB do user | basic |
| `pages_read_engagement` | ler insights de página | sensível |
| `pages_manage_posts` | publicar via página FB | sensível |
| `business_management` | descobrir IG Business via Page | sensível |

Scopes "sensíveis" exigem App Review da Meta antes de Live. Em Development, todos funcionam pra Admin/Tester do app.

#### Env vars (Vercel)

| Var | Onde usa |
|---|---|
| `META_APP_ID` | OAuth route + token refresh route |
| `META_APP_SECRET` | OAuth route + token refresh route |
| `ENCRYPTION_KEY` | criptografar/descriptografar `instagram_token_enc` (já existente, AES-256-GCM) |

#### Endpoints

| Path | Método | Função | Auth |
|---|---|---|---|
| `/api/painel/marketing/oauth/instagram` | GET | Redireciona pro Meta OAuth (sem `code`) ou processa callback (com `code`) | `requireTenant` |
| `/api/interno/instagram-token-refresh` | GET/POST | Loop em todos tenants, estende long-lived token | Bearer `N8N_TO_VERCEL_TOKEN` ou `CRON_SECRET` |
| `/api/painel/marketing/subscription` | GET | Retorna estado de conexão (inclui campos IG/GBP) | `requireTenant` |

#### Schema (`marketing_subscriptions`)

| Coluna | Tipo |
|---|---|
| `instagram_token_enc` | text — long-lived token criptografado (AES-256-GCM) |
| `instagram_business_account_id` | text — ID do IG Business (não confundir com user ID) |
| `instagram_username` | text — handle visível no painel |
| `facebook_page_id` | text — ID da Page que tem o IG Business linkado |
| `instagram_token_expires_at` | timestamptz — expiração calculada (used_iat + expires_in) |

#### Library (server-side)

`lib/instagram-publisher.ts` expõe:

- `loadIgConnection(supabase, tenantId)` — fetch + decrypt token
- `getProfile(supabase, tenantId)` — basic profile + counts
- `getAccountInsights(supabase, tenantId, metrics, period)` — reach, profile_views, etc
- `publishImagePost(supabase, tenantId, imageUrl, caption)` — Container API 2-step
- `publishCarousel(supabase, tenantId, items, caption)` — multi-item carousel
- `refreshLongLivedToken(supabase, tenantId, appId, appSecret)` — usado pelo cron

#### Cron

`/api/interno/instagram-token-refresh` em `vercel.json`: `0 5 1 * *` (mensal, dia 1, 05:00 UTC). Refresh mensal vs expiração de 60 dias = sempre ≥ 30 dias de buffer.

#### UI

Página `/painel/marketing/configurar` ([app/app/painel/marketing/configurar/page.tsx](../app/app/painel/marketing/configurar/page.tsx)) mostra status (conectado/não, expiração do token) e botão "Conectar/Reconectar Instagram" → linka pra `/api/painel/marketing/oauth/instagram`.

#### Para promover pra Live (publicar app Meta)

- [ ] Business Verification concluída
- [ ] Privacy Policy URL publicada
- [ ] Terms of Service URL publicada
- [ ] Data Deletion URL ou instruções
- [ ] App Review submetido pros 6 scopes acima (cada um precisa caso de uso + screencast)
- [ ] Webhook subscription opcional (DM, comentários — futuro)

### Chatwoot

- **URL**: `chatwoot.singulare.org` (self-hosted)
- **Account ID**: 1
- **Inbox 3**: "Dra. Paula Franzon"
- **MCP local**: `mcp-chatwoot/` — wrapper da API
- **Webhook recebido**: `app.singulare.org/api/webhooks/chatwoot` (pendente formalizar)

### WhatsApp — Evolution API

- **Modelo**: self-hosted Evolution
- **Decisão**: Meta Cloud API foi rejeitado (custo + onboarding lento). Migrar só com gatilhos definidos.
- **Fluxo**: paciente → Evolution → webhook n8n → n8n chama Vercel API

### n8n

- **Auth pra Vercel**: `Authorization: Bearer ${N8N_TO_VERCEL_TOKEN}`
- **Endpoints internos chamados**:
  - `/api/interno/tools` (catálogo + dispatch de tools do agente IA)
  - `/api/interno/region-demand-refresh`, `/api/interno/market-trends-refresh`
- **Workflows conhecidos**:
  - P03 — AI Agent (Master Secretária IA / Singulare Score Collector)
  - Routing por inbox + tenant
  - PROBLEM-MAP-multi-doctor-setup (ver `docs/PROBLEM-MAP-multi-doctor-setup.md`)

### Email

- **Transacional (auth, notificações)**: AWS SES `us-east-1` em `singulare.org`
- **Onboarding final**: Gmail/Workspace via `singularewempresa@gmail.com`
- **DKIM/SPF/DMARC**: configurados na zona DNS de `singulare.org`

### Pagamentos

- **Asaas** — gateway primário
  - Webhook: `app.singulare.org/api/webhooks/asaas` (configurar no painel Asaas)
  - Auth: token no header (env var Vercel)
- **Mercado Pago** — alternativo
  - Webhook: `app.singulare.org/api/webhooks/mercadopago`
  - Auth: signature validation

### BirdID

- **Uso**: assinatura eletrônica de documentos (visto em `lib/birdid.ts`)
- **Auth**: token (env var Vercel)

---

## 🔐 OAuth & Redirect URIs

### OAuth Client `n8n-google` (Google Cloud Console)

**Client ID**: `216899828411-j4cgoib7k3n1ps3nc0ht0r69t442ctr8.apps.googleusercontent.com`

**Authorized redirect URIs** — manter estes na lista:

| URI | Pra quê |
|---|---|
| `http://localhost` | Scripts CLI ad-hoc |
| `http://localhost:53682` | OAuth flow local com porta dedicada |
| `http://localhost:3000` | `next dev` (futuro OAuth UX no painel) |
| `https://developers.google.com/oauthplayground` | Debug e exploração de APIs |
| `https://app.singulare.org/api/auth/google/callback` | Callback genérico produção |
| `https://app.singulare.org/api/auth/google-calendar/callback` | Médico vincula calendário pessoal |
| `https://app.singulare.org/api/auth/google-ads/callback` | Médico autoriza Singulare a gerir Ads |

**Importante**: Google OAuth NÃO aceita wildcards. Por isso usar `app.singulare.org` como ponto fixo.

### OAuth Consent Screen

- **Tipo**: External (necessário pra usuários fora do workspace autorizarem)
- **Status atual**: confirmar — se "Testing", limita a 100 testers; precisa publicar pra prod
- **Scopes solicitados**: `https://www.googleapis.com/auth/adwords`, `https://www.googleapis.com/auth/calendar`

#### Quando publicar (sair de Testing) — CRÍTICO

Em **Testing**, refresh token expira a cada 7 dias e só 100 test users autorizam. Pra OAuth servir múltiplos médicos/pacientes em produção, **publicar é obrigatório**.

**Checklist pra publicar:**
- [ ] Privacy policy URL publicada (ex: `singulare.org/privacidade`)
- [ ] Terms of service URL publicada (ex: `singulare.org/termos`)
- [ ] App homepage URL (`app.singulare.org`)
- [ ] Logo 120×120 ou 240×240 px
- [ ] Justificativa por scope sensível
- [ ] Domínio `singulare.org` verificado (DNS TXT record)
- [ ] Para scopes **restricted** (Calendar, Ads): **security review** Google — 4–6 semanas, exige docs sobre proteção de dados, video demo
- [ ] Submeter em Cloud Console → OAuth consent screen → "Publish app"

**Quem precisa publicar?**
- ❌ Só você usa server-side com sua conta → fica em Testing pra sempre
- ✅ Médicos vão vincular contas Google deles → publicar antes do feature ir live

---

## 📡 Webhooks

### Recebidos por Vercel

| Sistema | Endpoint | Auth | Status |
|---|---|---|---|
| Asaas | `/api/webhooks/asaas` | token assinado | ✅ |
| Mercado Pago | `/api/webhooks/mercadopago` | signature | ✅ |
| Google Calendar (push) | `/api/webhooks/google-calendar` | channel token + secret | ✅ |
| Chatwoot | `/api/webhooks/chatwoot` | a configurar | ⏳ |
| n8n → painel | `/api/interno/*` | Bearer N8N_TO_VERCEL_TOKEN | ✅ |

### Enviados por Vercel

| Destino | Quando | Auth |
|---|---|---|
| n8n | post de mensagem WhatsApp via fila | Bearer interno |
| Asaas | criar cobrança / nota fiscal | API key Asaas |
| Mercado Pago | criar preferência | Access Token MP |
| Google Calendar API | sync de eventos médico | Service Account JWT |
| Google Ads API | (futuro) consulta keyword | OAuth refresh_token |
| Chatwoot | enviar mensagem programática | API token |
| Evolution | (futuro) enviar mensagem direta | API token Evolution |
| BirdID | enviar documento pra assinatura | token BirdID |
| AWS SES | email transacional | IAM key AWS |

---

## 🗝️ Env vars (todas só no Vercel dashboard)

> **Regra**: NUNCA commit em git. Sempre via Vercel Settings → Environment Variables.

| Var | Quem usa | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | público |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | bypass RLS, secreto |
| `N8N_TO_VERCEL_TOKEN` | header de auth servidor↔servidor | aceito em `/api/interno/*` e cron |
| `CRON_SECRET` | Vercel Cron | pode ser igual a N8N_TO_VERCEL_TOKEN |
| `DATAFORSEO_LOGIN` | helper region-demand + market-trends | email da conta DFS |
| `DATAFORSEO_PASSWORD` | helper region-demand + market-trends | API password (não senha do site) |
| `DATAFORSEO_BASE_URL` | (opcional) | sandbox `sandbox.dataforseo.com` pra testar sem cobrar |
| Google Calendar Service Account JSON | Calendar sync | normalmente em `GOOGLE_CALENDAR_CREDENTIALS_B64` ou similar |
| `GADS_DEVELOPER_TOKEN` | (futuro) Google Ads helper | quando integrar |
| `GADS_CLIENT_ID/SECRET/REFRESH_TOKEN` | (futuro) | OAuth Ads |
| `GADS_CUSTOMER_ID/LOGIN_CUSTOMER_ID` | (futuro) | conta + MCC |
| Asaas, MP credentials | webhooks pagamento | nomes específicos a confirmar |
| BirdID credentials | assinatura | confirmar nome var |
| AWS SES credentials | email | IAM keys |

---

## 🛠️ APIs internas — inventário

### `/api/painel/*` — user auth (`requireTenant`)

| Path | Método | Função |
|---|---|---|
| `/api/painel/me` | GET | Tenant ativo do user logado |
| `/api/painel/tenants` | GET | Lista tenants do user |
| `/api/painel/members` | GET/POST | Gerenciar tenant_members |
| `/api/painel/marketing/score` | GET | Score atual + recomendações |
| `/api/painel/marketing/posts` | GET/PATCH | Posts gerados pela IA |
| `/api/painel/marketing/reviews` | GET/POST | Pedido de review NPS≥9 |
| `/api/painel/marketing/region-demand` | GET | Cache de demanda regional (Google Ads) |
| `/api/painel/marketing/region-demand-refresh` | POST | Refresh cache (qualquer member) |
| `/api/painel/marketing/market-trends` | GET | Cache de Trends (DFS clickstream) |
| `/api/painel/marketing/market-trends-refresh` | POST | Refresh trends (qualquer member) |
| `/api/painel/marketing/subscription` | GET/PATCH | Configurar URL de Google Review |
| `/api/painel/atendimento/*` | GET/POST | Conversas Chatwoot |
| `/api/painel/mensagens` | GET/POST | n8n histórico |

### `/api/interno/*` — server-to-server (Bearer N8N_TO_VERCEL_TOKEN)

| Path | Método | Função |
|---|---|---|
| `/api/interno/tools` | GET/POST | Catálogo + dispatch de tools do agente IA |
| `/api/interno/region-demand-refresh` | POST/GET | Refresh em massa (cron + manual) |
| `/api/interno/market-trends-refresh` | POST/GET | Idem trends |

### `/api/webhooks/*` — público assinado

(Documentado na seção Webhooks acima.)

### `/api/auth/*` — OAuth callbacks (futuro)

(Reservados pelo OAuth redirect URIs — ainda a implementar a maioria.)

---

## 🗄️ Database — schemas chave

```sql
-- Multi-tenant
tenants (tenant_id PK, clinic_name, plan_type, admin_email, admin_user_id, city, state, ...)
tenant_members (tenant_id FK, user_id FK, role, status, doctor_id) [CASCADE]
tenant_doctors (id uuid PK, tenant_id FK, doctor_name, specialty, is_primary, ...)

-- Score & Marketing intelligence
tenant_scores (tenant_id, total_score, classification, google_/doctoralia_/social_/seo_/operational_score, recommendations jsonb, collected_at, ...)
tenant_market_keywords (tenant_id PK, market_keywords text[], name_keywords text[], source 'auto'|'custom', generated_from jsonb)
tenant_region_demand_history (id, tenant_id, payload jsonb, collected_at)
tenant_market_trends_history (id, tenant_id, payload jsonb, collected_at)

-- FK delete rules: maioria CASCADE, exceto n8n_fila_mensagens / n8n_historico_mensagens (RESTRICT) e nf_requests (NO ACTION)
```

Lista completa: `mcp__supabase__list_tables` ou Supabase Studio.

---

## ⏰ Cron schedules

| Path | Schedule (UTC) | O quê |
|---|---|---|
| `/api/interno/region-demand-refresh` | `0 3 1 * *` (dia 1, 03:00) | Atualiza dados Google Ads região |
| `/api/interno/market-trends-refresh` | `30 3 1 * *` (dia 1, 03:30) | Atualiza Trends DFS |

> Cron Vercel passa header `Authorization: Bearer ${CRON_SECRET}` automaticamente — o endpoint aceita também N8N_TO_VERCEL_TOKEN.

---

## 📝 Como adicionar nova integração (passo a passo padrão)

1. **Decidir auth model**: server-to-server (token) vs OAuth user vs API key
2. **Criar env vars no Vercel** com prefixo padronizado (ex: `XCORP_*` ou `S2S_*`)
3. **Helper em `lib/`** isolando a chamada (não espalhar fetches pelo código)
4. **Endpoint próprio em `/api/`**:
   - `/api/painel/*` se acionado pela UI do cliente
   - `/api/interno/*` se server-to-server (cron, n8n)
   - `/api/webhooks/*` se receber callback
5. **Migration Supabase** se precisar persistir
6. **Atualizar este doc** com URI/token/endpoint adicionados
7. **Atualizar `vercel.json` cron** se for periódico
8. **Atualizar OAuth redirect URIs** se for OAuth

---

## 🔍 Onde buscar mais

- **Schema Supabase**: `mcp__supabase__list_tables` ou Studio UI
- **Catálogo DataForSEO**: `exports/dataforseo-campos-disponiveis.csv`
- **Problem maps específicos**:
  - `docs/PROBLEM-MAP-multi-doctor-setup.md`
  - `docs/SES-SUPABASE-INTEGRACAO.md`
  - `docs/n8n/PLUG-CONFIRMACAO-PRE-ROUTER.md`
- **Vercel deploys + logs**: dashboard Vercel ou `mcp__claude_ai_Vercel__*`

---

_Última atualização: 2026-05-09 — manutenção contínua é responsabilidade de quem adiciona/altera integração._
