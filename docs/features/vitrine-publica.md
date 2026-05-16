# Vitrine pública (página `/p/[slug]`)

## O que é

Cada tenant ativo ganha uma página pública minimalista em
`https://singulare.org/p/<slug>` com nome, foto, especialidade, cidade, bio
curta, NPS médio (quando aplicável) e CTA pra WhatsApp.

A página já existia (renderizada por `app/app/p/[slug]/page.tsx`, com
Schema.org `Physician` + `AggregateRating` e logging de view via
`logMarketingEvent`). Esse feature adiciona o fluxo de criação automática
+ editor no painel.

## Quando é criada

No `/api/onboarding` (`app/app/api/onboarding/route.ts`), depois do tenant
e do `tenant_doctors` principal. A entry é gravada com:

- `slug = slugify(doctor_name + ' ' + speciality + ' ' + city)`, com
  sufixo `-2`, `-3` etc se colidir (`ensureUniqueVitrineSlug`).
- `published = false` — o profissional precisa opt-in explícito.
- `professional_type` normalizado pra um dos `PROFESSIONAL_TYPES` de
  `app/lib/types.ts` (fallback `medico`).
- `city` / `state` parseados de `address` via `parseAddressForVitrine`
  (fallback `Sao Paulo / SP`).

Tenants "Sob Medida" (clínicas grandes) **não** ganham vitrine no
onboarding — entram no fluxo de proposta comercial e definem isso depois.

## Como publicar

Painel → "Crescimento" → "Página pública" (`/painel/vitrine`).

- Form pra editar `display_name`, `bio` (máx 500 chars), `photo_url`,
  `professional_type`, `specialty`, `city`, `state`.
- Switch "Publicar página": exige consentimento LGPD explícito antes de
  ativar pela primeira vez.
- Pré-visualização lateral (iframe da `/p/<slug>` quando publicado;
  mock simples quando não).
- Botão "Ver página ao vivo" só habilita quando `published = true`.

Backend: `app/app/api/painel/vitrine/route.ts` expõe `GET` (carrega ou
cria on-demand pra tenants legacy sem vitrine) e `PATCH` (campos +
publish toggle).

## LGPD

- Coluna `lgpd_consent_at timestamptz` em `vitrine_profiles` (migration
  `20260516123825_vitrine_lgpd_consent.sql`).
- Gravada na **primeira** transição `published=false → published=true`.
  Despublicar e republicar não regrava (mantém o primeiro consent).
- IP do request salvo em `lgpd_consent_ip` pra auditoria.
- Texto exibido ao profissional: "Concordo que meu nome, foto,
  especialidade e cidade fiquem visíveis publicamente em
  `singulare.org/p/<slug>` e possam ser indexados em buscadores. Posso
  despublicar a qualquer momento."
- Despublicar oculta a página instantaneamente (`getVitrineBySlug`
  filtra `published=true`), mas mantém a row no DB.
- Os dados são removidos junto com o tenant via `ON DELETE CASCADE` no
  FK `vitrine_profiles.tenant_id → tenants.tenant_id`.

## Roadmap pendente (MVP 2/3)

- Upload de foto direto pelo painel (Supabase Storage) — hoje é input
  URL com TODO marcado na UI.
- Bio + FAQ gerados por IA (a partir dos dados do tenant) com revisão
  manual antes de publicar.
- Gate por add-on de marketing (publicação só liberada em planos
  específicos).
- Despublicação automática quando `subscription_status` vira `canceled`.
- Editor visual completo (cores, secundário, ordem dos blocos).
- Domínio próprio (`drpaula.com.br` apontando pra `/p/paula-...`).

## Arquivos tocados nesse MVP 1

- `supabase/migrations/20260516123825_vitrine_lgpd_consent.sql`
- `app/lib/vitrine-onboarding.ts` (helpers compartilhados)
- `app/app/api/onboarding/route.ts` (insert vitrine_profile)
- `app/app/api/painel/vitrine/route.ts` (GET + PATCH)
- `app/app/painel/vitrine/page.tsx` (editor + preview)
- `app/app/painel/layout.tsx` (item de menu)
