# /v3 — Luxury Modular Intelligence v1.0 (paginas paralelas)

Versao paralela das paginas publicas do Singulare aplicando o brand system
Luxury Modular Intelligence v1.0. As paginas da raiz nao foram alteradas — coexistem.

Brand resumido:
- Navy `#0F1B33` · Gold `#FFC62F` · Sand `#F4EFE6`
- Tipografia: Poppins Bold (display) + Space Grotesk (corpo) — carregadas via `next/font`
- Logo: 3 quadrados sobrepostos em gold sobre navy
- Eyebrow: tracking 0.28em uppercase, prefixado por travessao "—"
- CTA padrao: pill gold com texto navy uppercase tracking 0.18em

Todas as paginas `/v3/*` tem `robots: { index: false, follow: true }` ate liberacao.

## Rotas criadas

| URL | Arquivo | Descricao |
|---|---|---|
| `/v3` | `app/app/v3/page.tsx` | Landing principal — hero navy, proof bar, features, planos, depoimentos, FAQ, CTA |
| `/v3/empresa` | `app/app/v3/empresa/page.tsx` | Pagina formal — razao social, CNPJ, endereco, produtos, compliance |
| `/v3/bem-vindo` | `app/app/v3/bem-vindo/page.tsx` | Q&A com 12 duvidas mais comuns (accordion) |
| `/v3/profissionais` | `app/app/v3/profissionais/page.tsx` | Landing B2B — grid de profissoes + pilares |
| `/v3/secretaria-ia/[especialidade]/[cidade]` | `app/app/v3/secretaria-ia/[especialidade]/[cidade]/page.tsx` | Template programatico SEO — 360 combinacoes reutilizando `@/lib/seo-data` |
| `/v3/conectar/[token]` | `app/app/v3/conectar/[token]/page.tsx` + `ConnectClientV3.tsx` | Pareamento WhatsApp — QR + codigo + polling em `/api/conectar/[token]/status` |
| `/v3/onboarding` | `app/app/v3/onboarding/page.tsx` + `OnboardingClientV3.tsx` | Wizard 3 etapas — submit em `/api/onboarding` (mesma API) |

## Componentes compartilhados

Localizacao: `app/app/v3/_components/`

| Componente | Uso |
|---|---|
| `tokens.ts` | `BRAND_COLORS`, `BRAND_FONTS`, `BRAND_TRACKING`, `BRAND_LEGAL` |
| `Logo3Squares.tsx` | SVG dos 3 quadrados sobrepostos (props `size`, `color`) |
| `Wordmark.tsx` | "SINGULARE" em Poppins Bold uppercase tracking 0.32em |
| `BrandHeader.tsx` | Header navy fixo — Logo + Wordmark + nav opcional + CTA gold |
| `BrandFooter.tsx` | Footer navy com hairline gold, disclosure CNPJ, links legais |
| `CTAGoldPill.tsx` | Botao pill gold com texto navy uppercase |
| `CTAGoldOutline.tsx` | Variante outline (stroke gold) |
| `EyebrowDash.tsx` | Eyebrow "— PRA COMECAR" tracking 0.28em |
| `SectionShell.tsx` | Wrapper de secao com padding consistente (max 1080px) |

## Layout

`app/app/v3/layout.tsx`:
- Importa Poppins (400, 500, 700) e Space Grotesk (400, 500, 600) via `next/font/google`
- Expoe CSS vars `--font-poppins` e `--font-space-grotesk`
- Background sand `#F4EFE6`, theme color navy `#0F1B33`
- Metadata `robots: { index: false, follow: true }`

## Reusos do raiz

- `@/lib/seo-data` — `SEO_ESPECIALIDADES`, `CITIES`, `findSeoEspecialidade`, `findCity`
- `@/lib/types` — `PROFESSIONAL_TYPES`, `COUNCIL_BY_PROFESSIONAL`, `SPECIALTIES_BY_PROFESSIONAL`, `ESTABLISHMENT_SIZES`
- API `/api/onboarding` (POST) — sem alteracoes, validacao identica

## API conectar (pendencia)

A rota `/v3/conectar/[token]` consome dois endpoints que precisam ser
implementados (ou ja existir no painel — verificar):

- `GET /api/conectar/[token]/status` — retorna `{ status, qr_code_base64, qr_string, pairing_code, phone_number, clinic_name, redirect_to }`
- `POST /api/conectar/[token]/refresh-qr` — forca regeneracao do QR

A pagina degrada com mensagem amigavel se o endpoint nao existir, mas o
fluxo completo so funciona apos a API estar disponivel.
