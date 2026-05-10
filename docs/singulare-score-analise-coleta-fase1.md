# Singulare Score — Análise Profunda de Coleta Externa (Fase 1)
## Versão 1.0 — Maio 2026

---

## Resumo Executivo

Este documento detalha **todas as fontes externas** de coleta de dados para o módulo "Singulare Score" — um sistema de pontuação de presença digital para profissionais de saúde. Cada fonte é analisada em: **o que coletar**, **como coletar**, **viabilidade técnica**, **custos**, **limitações** e **implementação via n8n**.

O objetivo é que **toda a coleta externa esteja operacional na Fase 1**, alimentando um score de 0-100 calculado automaticamente por tenant.

---

## Visão Geral das Fontes de Coleta

| # | Fonte | Método | Custo Mensal (100 tenants) | Complexidade | Prioridade |
|---|-------|--------|--------------------------|-------------|-----------|
| 1 | Google Places API | API oficial | ~$5-10 | Baixa | 🔴 Crítica |
| 2 | Google Business Profile | API oficial (OAuth) | Grátis | Média | 🟡 Alta |
| 3 | Doctoralia | Web Scraping | $5-49 (Apify) ou grátis (próprio) | Alta | 🔴 Crítica |
| 4 | Instagram | Graph API (OAuth) | Grátis | Alta | 🟡 Alta |
| 5 | Facebook Page | Graph API (OAuth) | Grátis | Média | 🟢 Média |
| 6 | Google Search (SEO) | SerpAPI ou scraping | $0-50 | Média | 🟡 Alta |
| 7 | Website do médico | HTTP Request | Grátis | Baixa | 🟢 Média |
| 8 | Dados internos Supabase | Query SQL | Grátis | Baixa | 🔴 Crítica |

---

## 1. GOOGLE PLACES API (Nota + Reviews do Google Maps)

### O que coletar
- **Nota média** (rating) — ex: 4.7/5.0
- **Quantidade total de reviews**
- **Reviews individuais** (texto, nota, data, autor) — até 5 mais recentes
- **Foto do perfil** (se existe)
- **Horários de funcionamento** (se preenchidos)
- **Categorias** do negócio
- **Status de verificação** do Google Business
- **Endereço** formatado
- **place_id** para rastreamento futuro

### Como coletar
**Método: Text Search → Place Details (2 chamadas por tenant)**

```
Passo 1: Text Search
GET https://maps.googleapis.com/maps/api/place/textsearch/json
  ?query=Dr+João+Silva+cardiologista+São+Paulo
  &type=doctor
  &key=API_KEY

→ Retorna: place_id, nome, endereço, nota, total de reviews

Passo 2: Place Details (apenas se encontrou)
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id=ChIJ...
  &fields=rating,user_ratings_total,reviews,opening_hours,photos,business_status
  &key=API_KEY

→ Retorna: até 5 reviews com texto, notas individuais, fotos, horários
```

### Implementação n8n
- **Nó 1:** `HTTP Request` — Text Search com query montada a partir do `tenants.doctor_name` + `tenants.specialty` + `tenants.city`
- **Nó 2:** `IF` — Verificar se retornou resultados (`results.length > 0`)
- **Nó 3:** `HTTP Request` — Place Details com `place_id` do resultado
- **Nó 4:** `Code` — Calcular sub-score (0-30 pontos)

### Custo real
- Text Search: $5/1.000 chamadas (SKU Essentials)
- Place Details (Basic fields: rating, reviews): $5/1.000 chamadas
- **100 tenants × 2 chamadas × 4 semanas = 800 chamadas/mês**
- **Custo: ~$4/mês** (dentro do free tier de 10.000 chamadas Essentials)
- Free tier cobre até **~1.250 tenants** antes de começar a cobrar

### Limitações
- Retorna **máximo 5 reviews** por chamada (API oficial)
- Não retorna reviews históricas ou métricas de crescimento
- Pode retornar homônimos — precisa de lógica de desambiguação (cidade + especialidade)
- Rate limit: 100 requests/segundo (não é problema para coleta semanal)

### Dados para o Score (peso: 30 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Nota média Google | 12 pts | `(rating / 5.0) × 12` |
| Quantidade de reviews | 10 pts | `min(reviews / 50, 1.0) × 10` |
| Tem horários preenchidos | 3 pts | Sim = 3, Não = 0 |
| Tem fotos | 3 pts | `min(fotos / 5, 1.0) × 3` |
| Perfil verificado | 2 pts | Sim = 2, Não = 0 |

---

## 2. GOOGLE BUSINESS PROFILE API (Dados do proprietário)

### O que coletar (requer OAuth do médico)
- **Todas as reviews** (sem limite de 5)
- **Métricas de performance**: impressões de busca, cliques, ligações
- **Fotos publicadas** pelo proprietário vs. clientes
- **Posts do Google Business** (se publica conteúdo)
- **Perguntas e respostas**
- **Categorias** e atributos do negócio

### Como coletar
**Método: Google Business Profile API (requer que o médico conecte a conta Google)**

```
GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
  ?pageSize=50
  &orderBy=updateTime desc

GET https://businessprofileperformance.googleapis.com/v1/locations/{locationId}:fetchMultiDailyMetricsTimeSeries
  ?dailyMetrics=WEBSITE_CLICKS,CALL_CLICKS,BUSINESS_DIRECTION_REQUESTS
  &dailyRange.startDate.year=2026&dailyRange.startDate.month=4&dailyRange.startDate.day=1
  &dailyRange.endDate.year=2026&dailyRange.endDate.month=5&dailyRange.endDate.day=4
```

### Implementação n8n
- Requer credencial OAuth2 do Google Business Profile por tenant
- Pode ser configurada no onboarding (passo opcional do Vivassist)
- **Nó Google Business Profile** nativo do n8n ou `HTTP Request` com OAuth2

### Custo
- **Grátis** (API oficial do Google, sem cobrança por chamada)

### Limitações
- **Requer consentimento do médico** (OAuth) — não é passivo
- API em transição: Google está migrando para a v1 da Business Profile Performance API
- Nem todo médico tem Google Business verificado
- Será um diferencial do **Tier 2/3** (médico conecta voluntariamente)

### Estratégia
- **Fase 1:** Usar apenas Google Places API (passivo, sem OAuth)
- **Fase 1.5:** Adicionar opção "Conecte seu Google Business" no dashboard para dados enriquecidos
- Quando conectado, substitui os dados do Places API por dados mais ricos

---

## 3. DOCTORALIA (Presença + Reviews no maior diretório médico do BR)

### O que coletar
- **Perfil existe?** (sim/não — já é um dado valioso)
- **Nota média** na Doctoralia
- **Quantidade de reviews/opiniões**
- **Texto das reviews** (últimas 5-10)
- **Especialidades** listadas
- **Endereço do consultório**
- **Preço da consulta** (se listado)
- **Agendamento online** ativo? (sim/não)
- **Selo "Certificado de Excelência"** (sim/não)
- **Quantidade de respostas a perguntas** de pacientes

### Como coletar
**Método A: Apify (recomendado para MVP)**

Existem dois scrapers prontos no Apify para doctoralia.com.br:
1. **Doctoralia Data Extractor** — extrai perfis completos por cidade + especialidade
2. **Doctoralia Brazil Reviews Scraper** — extrai reviews com notas e textos

```
# Chamada via API do Apify
POST https://api.apify.com/v2/acts/giovannibiancia~doctoralia/runs
{
  "country": "brazil",
  "city": "sao-paulo",
  "professions": ["cardiologista"]
}

# Resultado retorna:
{
  "doctor_name": "Dr. João Silva",
  "rating": 4.8,
  "reviews_count": 127,
  "address": "Av. Paulista, 1000",
  "specializations": ["Cardiologia", "Ecocardiograma"],
  "phone_number": ["11 99999-0000"],
  "link": "https://www.doctoralia.com.br/joao-silva/cardiologista/sao-paulo",
  "services": [{"service": "Consulta", "price": "R$ 400"}]
}
```

**Método B: Scraper próprio via n8n (sem custo)**

```
Passo 1: HTTP Request
GET https://www.doctoralia.com.br/pesquisa?q=João+Silva+cardiologista&loc=São+Paulo

Passo 2: Code node — parsear HTML com regex/cheerio
- Extrair: nota, reviews, link do perfil

Passo 3: HTTP Request para página do perfil
GET https://www.doctoralia.com.br/joao-silva/cardiologista/sao-paulo

Passo 4: Code node — extrair dados detalhados do perfil
```

### Implementação n8n
**Recomendação: começar com Método B (scraper próprio) + fallback para Apify**

- **Nó 1:** `HTTP Request` — buscar na Doctoralia por nome + especialidade + cidade
- **Nó 2:** `Code` — parsear resposta HTML, verificar se perfil existe
- **Nó 3:** `IF` — perfil encontrado?
- **Nó 4 (sim):** `HTTP Request` — buscar página do perfil
- **Nó 5:** `Code` — extrair nota, reviews, selos, serviços
- **Nó 6 (não):** registrar `doctoralia_present: false`

### Custo
- **Método A (Apify):** Plano Free = 30 runs/mês. Plano Starter = $49/mês (ilimitado). Para 100 tenants semanais, o plano free não basta.
- **Método B (scraper próprio):** Grátis, mas requer manutenção se Doctoralia mudar o HTML
- **Recomendação:** Método B para produção, Método A como backup

### Limitações
- Doctoralia pode bloquear IPs com muitas requisições (usar delays de 2-5s entre requests)
- HTML da Doctoralia pode mudar sem aviso (scraper precisa de monitoramento)
- Alguns perfis são "claim" (criados pela Doctoralia, não pelo médico) — distinguir
- Sem API oficial, não há garantia de disponibilidade

### Dados para o Score (peso: 15 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Perfil existe | 5 pts | Sim = 5, Não = 0 |
| Nota média | 5 pts | `(rating / 5.0) × 5` |
| Quantidade reviews | 3 pts | `min(reviews / 30, 1.0) × 3` |
| Agendamento online ativo | 2 pts | Sim = 2, Não = 0 |

---

## 4. INSTAGRAM (Presença e engajamento social)

### O que coletar

**Sem OAuth (dados públicos via Business Discovery):**
- **Perfil existe?** (sim/não)
- **Quantidade de seguidores**
- **Quantidade de posts**
- **Bio** (contém especialidade? contém CRM?)
- **Website** (se tem link)
- **Verificado?** (sim/não)
- **Últimos posts:** likes, comentários (para calcular engajamento)

**Com OAuth (médico conecta a conta):**
- Tudo acima +
- **Impressões** e **alcance** por post
- **Demografia** dos seguidores (idade, gênero, cidade)
- **Horários de pico** da audiência
- **Crescimento** de seguidores nos últimos 30 dias

### Como coletar

**Método A: Business Discovery (sem OAuth do médico)**

Requer que o Singulare tenha um Instagram Business próprio com token válido. A partir dele, pode consultar dados públicos de qualquer conta Business/Creator.

```
GET https://graph.facebook.com/v21.0/{singulare_ig_id}
  ?fields=business_discovery.username(dr.joaosilva){
    followers_count,
    media_count,
    biography,
    website,
    username,
    media.limit(12){
      like_count,
      comments_count,
      timestamp,
      media_type
    }
  }
  &access_token={TOKEN}
```

**Método B: OAuth do médico (Tier 2/3)**

O médico conecta via OAuth no dashboard do Vivassist. Permite acessar dados privados como impressões, alcance e demografia.

### Implementação n8n

**Para Business Discovery (passivo):**
- **Nó 1:** `HTTP Request` — query Business Discovery com username do Instagram
- **Nó 2:** `Code` — calcular taxa de engajamento: `(média de likes + comentários) / seguidores × 100`
- **Nó 3:** `Code` — calcular frequência de postagem: `posts nos últimos 30 dias`
- **Nó 4:** `Code` — analisar bio (contém CRM? especialidade? link?)

**Pré-requisito:** O tenant precisa ter o campo `instagram_username` no Supabase.
Coletar esse dado no onboarding (Vivassist) ou perguntar via WhatsApp.

### Custo
- **Grátis** (Graph API não cobra por chamadas)
- Rate limit: 200 chamadas/hora por conta Instagram autenticada
- 100 tenants × 1 chamada = 100 chamadas (dentro do limite horário)

### Limitações
- **Business Discovery só funciona com contas Business/Creator** — contas pessoais não retornam dados
- Requer que o Singulare tenha uma conta Instagram Business verificada
- Não retorna stories, reels insights ou dados históricos de terceiros
- Meta App Review necessário para produção (4-6 semanas de aprovação)
- **Se o médico não tiver Instagram ou for conta pessoal:** score dessa seção = 0

### Dados para o Score (peso: 15 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Perfil existe (Business/Creator) | 3 pts | Sim = 3, Não = 0 |
| Seguidores | 4 pts | `min(seguidores / 5000, 1.0) × 4` |
| Taxa de engajamento | 4 pts | `min(engagement_rate / 3.0, 1.0) × 4` (3% = nota máxima) |
| Frequência de postagem | 2 pts | `min(posts_30d / 12, 1.0) × 2` (12 posts/mês = máximo) |
| Bio completa (CRM + link) | 2 pts | CRM na bio = 1pt, link = 1pt |

---

## 5. FACEBOOK PAGE (Presença institucional)

### O que coletar
- **Página existe?** (sim/não)
- **Seguidores/curtidas** da página
- **Nota/avaliações** (Facebook Reviews)
- **Quantidade de reviews** no Facebook
- **Frequência de postagem**
- **Horários de funcionamento** (se preenchido)

### Como coletar

Usa a mesma Graph API do Facebook. Requer Page Access Token.

```
GET https://graph.facebook.com/v21.0/{page_id}
  ?fields=fan_count,rating_count,overall_star_rating,posts.limit(5){created_time,message}
  &access_token={TOKEN}
```

**Alternativa sem OAuth:** Buscar a página por nome e extrair dados públicos via Graph API search ou scraping leve.

### Implementação n8n
- Similar ao Instagram
- **Nó 1:** `HTTP Request` — buscar página por nome da clínica/médico
- **Nó 2:** `Code` — extrair métricas

### Custo
- **Grátis** (Graph API)

### Limitações
- Facebook Reviews estão sendo descontinuados em algumas regiões
- Muitos médicos não têm Facebook Page (mais relevante para clínicas)
- Menor relevância que Google e Instagram para médicos individuais

### Dados para o Score (peso: 5 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Página existe | 2 pts | Sim = 2, Não = 0 |
| Nota média | 2 pts | `(rating / 5.0) × 2` |
| Frequência de postagem | 1 pt | Posts no último mês? Sim = 1 |

---

## 6. GOOGLE SEARCH / SEO (Visibilidade orgânica)

### O que coletar
- **Aparece na primeira página do Google?** para `"especialidade + cidade"`
- **Posição no ranking** (1-100)
- **Quantidade de resultados** com o nome do médico
- **Rich snippets** aparecem? (horários, nota, etc.)
- **Site próprio** aparece nos resultados?

### Como coletar

**Método A: SerpAPI (recomendado)**
```
GET https://serpapi.com/search.json
  ?engine=google
  &q=cardiologista+São+Paulo+Dr+João+Silva
  &location=São+Paulo,+Brazil
  &hl=pt
  &gl=br
  &api_key=KEY

→ Retorna: posição orgânica, snippets, knowledge panel
```

**Método B: Google Custom Search API (limitado)**
```
GET https://www.googleapis.com/customsearch/v1
  ?key=API_KEY
  &cx=SEARCH_ENGINE_ID
  &q=cardiologista+São+Paulo+Dr+João+Silva

→ Retorna: até 10 resultados com título, link, snippet
```

**Método C: Scraping do Google (frágil, não recomendado)**
- Risco de bloqueio por CAPTCHA
- Não escalável

### Implementação n8n
- **Nó 1:** `HTTP Request` — SerpAPI com query formatada
- **Nó 2:** `Code` — analisar resultados:
  - O médico aparece nos 10 primeiros?
  - Qual posição?
  - Tem knowledge panel?
  - Doctoralia aparece?

### Custo
- **SerpAPI:** Plano Free = 100 buscas/mês. Plano Starter = $50/mês (5.000 buscas)
- **Google Custom Search:** 100 buscas/dia grátis, depois $5/1.000
- **Para 100 tenants × 2 queries × 4 semanas = 800 buscas/mês**
- **Recomendação:** Google Custom Search (grátis para até 100 tenants)

### Limitações
- SerpAPI é mais preciso mas custa mais
- Google Custom Search não retorna posição exata, apenas resultados
- Resultados variam por localização do servidor (usar parâmetro `gl=br`)

### Dados para o Score (peso: 10 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Aparece na 1ª página (top 10) | 5 pts | Sim = 5, Não = 0 |
| Tem site próprio nos resultados | 3 pts | Sim = 3, Não = 0 |
| Knowledge panel aparece | 2 pts | Sim = 2, Não = 0 |

---

## 7. WEBSITE DO MÉDICO (Análise de presença própria)

### O que coletar
- **Site existe?** (sim/não)
- **É mobile-friendly?** (responsive)
- **Tem SSL?** (HTTPS)
- **Velocidade de carregamento** (PageSpeed score)
- **Tem botão de agendamento?**
- **Tem informações de contato visíveis?**
- **Tem conteúdo educativo/blog?**

### Como coletar

**Método: Combinação de HTTP Request + Google PageSpeed API**

```
# Verificar se site existe
HEAD https://www.drjoaosilva.com.br
→ Status 200 = existe

# Google PageSpeed Insights API (grátis)
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url=https://www.drjoaosilva.com.br
  &category=performance
  &category=accessibility
  &strategy=mobile
  &key=API_KEY

→ Retorna: score de performance, acessibilidade, mobile-friendliness
```

### Implementação n8n
- **Nó 1:** `HTTP Request` (HEAD) — verificar se URL do site responde
- **Nó 2:** `IF` — site existe?
- **Nó 3:** `HTTP Request` — PageSpeed Insights API
- **Nó 4:** `Code` — extrair scores e analisar

**Pré-requisito:** Campo `website_url` no Supabase (coletar no onboarding ou via Google Places)

### Custo
- **PageSpeed API:** 25.000 chamadas/dia grátis
- **Totalmente grátis** para qualquer escala

### Limitações
- Nem todo médico tem site próprio (muitos usam só Doctoralia ou Instagram)
- Sites de terceiros (Doctoralia, Instagram) não contam como "site próprio"

### Dados para o Score (peso: 10 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Site existe | 3 pts | Sim = 3, Não = 0 |
| HTTPS ativo | 1 pt | Sim = 1, Não = 0 |
| Mobile-friendly (PageSpeed ≥ 50) | 2 pts | `min(mobile_score / 50, 1.0) × 2` |
| Performance (PageSpeed ≥ 70) | 2 pts | `min(perf_score / 70, 1.0) × 2` |
| Tem blog/conteúdo | 2 pts | Detecta `/blog` ou posts = 2 |

---

## 8. DADOS INTERNOS SUPABASE (Métricas operacionais exclusivas)

### O que coletar
Já temos no banco — só precisa de queries:
- **Taxa de agendamento** (consultas agendadas vs. contatos recebidos)
- **Tempo médio de resposta** do WhatsApp (via Chatwoot)
- **Taxa de no-show** (agendados vs. realizados)
- **Recorrência de pacientes** (pacientes que retornam)
- **NPS pós-consulta** (quando implementado)
- **Volume de mensagens** processadas pelo Master Secretária

### Como coletar
```sql
-- Taxa de agendamento (últimos 30 dias)
SELECT 
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END)::float / 
  NULLIF(COUNT(*), 0) as booking_rate
FROM appointments 
WHERE tenant_id = $1 
AND created_at >= NOW() - INTERVAL '30 days';

-- Tempo médio de resposta (via Chatwoot)
-- Calculado a partir do timestamp da mensagem do paciente
-- até o timestamp da primeira resposta do bot
```

### Implementação n8n
- **Nó 1:** `Postgres` — query com credential `5pMMhbiJHo9Pv3Jn`
- **Nó 2:** `Code` — calcular sub-score

### Custo
- **Grátis** (dados próprios)

### Dados para o Score (peso: 15 pontos)
| Métrica | Peso | Cálculo |
|---------|------|---------|
| Taxa de agendamento | 5 pts | `min(booking_rate / 0.4, 1.0) × 5` (40% = máximo) |
| Tempo de resposta < 2min | 4 pts | `min(2 / avg_response_min, 1.0) × 4` |
| Taxa de no-show < 10% | 3 pts | `min((1 - noshow_rate) / 0.9, 1.0) × 3` |
| Recorrência > 30% | 3 pts | `min(recurrence_rate / 0.3, 1.0) × 3` |

---

## Resumo da Composição do Score (0-100 pontos)

| Pilar | Fontes | Peso |
|-------|--------|------|
| **Google Presence** | Google Places API | **30 pts** |
| **Diretórios Médicos** | Doctoralia scraping | **15 pts** |
| **Redes Sociais** | Instagram + Facebook | **20 pts** |
| **SEO & Visibilidade** | Google Search + Website | **20 pts** |
| **Performance Operacional** | Supabase (dados internos) | **15 pts** |
| **TOTAL** | | **100 pts** |

### Classificação
| Faixa | Classificação | Ação sugerida |
|-------|--------------|---------------|
| 0-25 | 🔴 Crítico | "Sua presença digital precisa de atenção urgente" |
| 26-50 | 🟠 Em desenvolvimento | "Você tem uma base, mas há muito espaço para crescer" |
| 51-75 | 🟡 Bom | "Sua presença é sólida, vamos otimizar os detalhes" |
| 76-100 | 🟢 Excelente | "Você é referência digital na sua região" |

---

## Arquitetura do Workflow n8n (Fase 1)

```
[Cron Trigger: Semanal]
    │
    ▼
[Postgres: Buscar tenants ativos]
    │
    ▼
[Split In Batches: 10 por vez]
    │
    ├──▶ [Google Places API] ──▶ [Code: Parse + Score Google]
    │
    ├──▶ [Doctoralia Scraper] ──▶ [Code: Parse + Score Doctoralia]
    │
    ├──▶ [Instagram Graph API] ──▶ [Code: Parse + Score Instagram]
    │
    ├──▶ [Facebook Graph API] ──▶ [Code: Parse + Score Facebook]
    │
    ├──▶ [Google Custom Search] ──▶ [Code: Parse + Score SEO]
    │
    ├──▶ [Website Check + PageSpeed] ──▶ [Code: Parse + Score Website]
    │
    ├──▶ [Postgres: Dados internos] ──▶ [Code: Parse + Score Operacional]
    │
    ▼
[Code: Calcular Score Total (0-100)]
    │
    ▼
[Postgres: INSERT/UPDATE tenant_scores]
    │
    ▼
[IF: Score mudou significativamente?]
    │
    ├──▶ [Sim] ──▶ [Telegram: Notificar admin]
    │
    └──▶ [Wait 3s] ──▶ [Próximo batch]
```

### Tabela Supabase: `tenant_scores`

```sql
CREATE TABLE public.tenant_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
  
  -- Score total
  total_score INTEGER NOT NULL DEFAULT 0,
  classification TEXT, -- 'critical', 'developing', 'good', 'excellent'
  
  -- Sub-scores
  google_score INTEGER DEFAULT 0,
  doctoralia_score INTEGER DEFAULT 0,
  social_score INTEGER DEFAULT 0,
  seo_score INTEGER DEFAULT 0,
  operational_score INTEGER DEFAULT 0,
  
  -- Dados brutos Google
  google_rating NUMERIC(2,1),
  google_reviews_count INTEGER,
  google_place_id TEXT,
  google_verified BOOLEAN DEFAULT FALSE,
  
  -- Dados brutos Doctoralia
  doctoralia_present BOOLEAN DEFAULT FALSE,
  doctoralia_rating NUMERIC(2,1),
  doctoralia_reviews_count INTEGER,
  doctoralia_url TEXT,
  doctoralia_online_booking BOOLEAN DEFAULT FALSE,
  
  -- Dados brutos Instagram
  instagram_username TEXT,
  instagram_followers INTEGER,
  instagram_posts_count INTEGER,
  instagram_engagement_rate NUMERIC(4,2),
  instagram_posting_frequency INTEGER, -- posts nos últimos 30 dias
  
  -- Dados brutos Facebook
  facebook_page_exists BOOLEAN DEFAULT FALSE,
  facebook_fans INTEGER,
  facebook_rating NUMERIC(2,1),
  
  -- Dados brutos SEO
  google_search_top10 BOOLEAN DEFAULT FALSE,
  google_search_position INTEGER,
  has_knowledge_panel BOOLEAN DEFAULT FALSE,
  
  -- Dados brutos Website
  website_exists BOOLEAN DEFAULT FALSE,
  website_url TEXT,
  website_ssl BOOLEAN DEFAULT FALSE,
  website_mobile_score INTEGER,
  website_performance_score INTEGER,
  
  -- Dados operacionais
  booking_rate NUMERIC(4,2),
  avg_response_minutes NUMERIC(6,2),
  noshow_rate NUMERIC(4,2),
  recurrence_rate NUMERIC(4,2),
  
  -- Recomendações geradas
  recommendations JSONB DEFAULT '[]',
  
  -- Metadata
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  previous_score INTEGER,
  score_change INTEGER, -- diferença vs. coleta anterior
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX idx_tenant_scores_tenant ON tenant_scores(tenant_id);
CREATE INDEX idx_tenant_scores_date ON tenant_scores(collected_at DESC);

-- Histórico para trending
CREATE INDEX idx_tenant_scores_history ON tenant_scores(tenant_id, collected_at DESC);
```

---

## Campos necessários na tabela `tenants` (adicionar)

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS facebook_page_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_place_id TEXT; -- cachear após primeira busca
```

---

## Estimativa de Custos Totais (Fase 1)

| Serviço | Plano | Custo/mês | Notas |
|---------|-------|-----------|-------|
| Google Places API | Pay-as-you-go | $0-5 | Free tier cobre 1.250 tenants |
| Google PageSpeed API | Grátis | $0 | 25K calls/dia |
| Google Custom Search | Grátis | $0 | 100 calls/dia (suficiente) |
| Instagram Graph API | Grátis | $0 | 200 calls/hora |
| Facebook Graph API | Grátis | $0 | Incluído |
| Doctoralia (scraper próprio) | n8n HTTP | $0 | Manutenção própria |
| Doctoralia (Apify backup) | Starter | $49 | Apenas se scraper falhar |
| Supabase | Já contratado | $0 | Dados internos |
| **TOTAL** | | **$0-54/mês** | |

---

## Cronograma de Implementação

| Semana | Entrega |
|--------|---------|
| **S1** | Criar tabela `tenant_scores` + adicionar campos em `tenants` + workflow base n8n (cron + batch) |
| **S2** | Implementar coletas: Google Places + Doctoralia + Website/PageSpeed |
| **S3** | Implementar coletas: Instagram + Facebook + Google Search + dados internos |
| **S4** | Cálculo do score final + sistema de recomendações + notificação Telegram |

---

## Sistema de Recomendações Automáticas

O campo `recommendations` (JSONB) será preenchido automaticamente pelo workflow com base nos gaps identificados:

```json
[
  {
    "priority": "high",
    "category": "google",
    "message": "Você tem apenas 3 avaliações no Google. Peça aos seus pacientes para avaliarem — médicos com 20+ reviews atraem 3x mais pacientes.",
    "action": "Ative o envio automático de pedido de review pós-consulta"
  },
  {
    "priority": "high", 
    "category": "doctoralia",
    "message": "Você não tem perfil na Doctoralia. 90% dos pacientes buscam médicos na internet antes de agendar.",
    "action": "Crie seu perfil gratuito em doctoralia.com.br"
  },
  {
    "priority": "medium",
    "category": "instagram",
    "message": "Seu Instagram tem 234 seguidores mas apenas 2 posts no último mês. Poste pelo menos 3x por semana para manter engajamento.",
    "action": "Considere nosso plano Growth para gestão de conteúdo"
  },
  {
    "priority": "low",
    "category": "website",
    "message": "Seu site não é otimizado para mobile (score 38/100). 84% dos agendamentos são feitos por smartphone.",
    "action": "Atualize o design do seu site para responsivo"
  }
]
```

As recomendações de "priority: high" que envolvem upsell (como gestão de conteúdo ou tráfego pago) são o **gancho comercial** para os Tiers 2 e 3.
