# Singulare V2 — Apple-Style Design Prompt (Reutilizável)

> Briefing técnico-visual destilado de **apple.com/br/macbook-air**, **apple.com/br/iphone-17-pro**, **apple.com/br/vision-pro** e **apple.com/br/apple-intelligence**, traduzido para o universo da Singulare (saúde + IA no WhatsApp).
> Use este documento como **prompt-mestre** para gerar/refinar qualquer página marketing do produto.

---

## 1. PRINCÍPIOS NORTE

| Princípio | Como se manifesta |
|---|---|
| **Bold minimalism** | Tipografia gigante em headings (`clamp(2.5rem, 1.5rem + 5vw, 5.5rem)`), tracking apertado (`-0.03em`), 80%+ da viewport é vazio negativo |
| **Calm motion** | Animações lentas (600–1200ms), easing `cubic-bezier(0.16, 1, 0.3, 1)`, nada de bounce/elástico |
| **Scroll é a narrativa** | Cada seção conta um capítulo. Pin + scrub onde precisa de impacto, fade-stagger no resto |
| **Produto como herói** | Mockups grandes, centralizados, com perspective 3D suave (`perspective(1200px) rotateX(2deg)`) |
| **Cor com economia** | Background neutro 95%; accent violeta `#6E56CF` aparece em links, badges, charts. Nunca em blocos sólidos grandes |
| **Confiança técnica** | Dados duros ("60% menos faltas", "4.9★", "5.247 profissionais") em tipografia massiva, peso 700 |

---

## 2. SISTEMA DE DESIGN

### 2.1 Tipografia

```css
/* Inter, fluid clamp scale */
--text-hero:    clamp(2.5rem,  1.5rem + 5vw,    5.5rem);  /* 40 → 88px */
--text-display: clamp(2rem,    1.2rem + 4vw,    4rem);    /* 32 → 64px */
--text-h2:      clamp(1.75rem, 1rem   + 3vw,    3rem);    /* 28 → 48px */
--text-h3:      clamp(1.25rem, 1rem   + 1vw,    1.75rem); /* 20 → 28px */
--text-lead:    clamp(1.125rem, 1rem  + 0.5vw,  1.375rem);/* 18 → 22px */
--text-body:    1rem;       /* 16px */
--text-eyebrow: 0.8125rem;  /* 13px */ /* uppercase + tracking 0.08em */

/* Pesos */
font-weight: 600 → 700 em headlines; 400 em body; 500 em eyebrows
letter-spacing: -0.03em em hero/display, -0.02em em h2/h3, +0.08em em eyebrows
line-height: 1.05 em hero, 1.15 em display/h2, 1.5 em body
```

### 2.2 Cores

```css
/* Light (default) */
--bg:           #FFFFFF;
--bg-elev:      #F5F5F7;   /* cinza Apple */
--bg-card:      #FAFAFA;
--fg:           #1D1D1F;   /* preto Apple */
--fg-muted:     #6E6E73;
--fg-subtle:    #86868B;
--divider:      #D2D2D7;
--accent:       #6E56CF;   /* violeta Singulare */
--accent-deep:  #5746AF;
--accent-soft:  #F5F3FF;
--success:      #28A745;
--warning:      #F59E0B;

/* Dark mode (algumas seções) */
--bg-dark:      #000000;
--fg-dark:      #F5F5F7;
--bg-card-dark: #1D1D1F;
```

**Regras de aplicação:**
- Light = padrão (95% das seções)
- Dark inverte quando precisa **dramatizar** (Hero, AI, Performance)
- Accent violeta nunca em blocos sólidos > 200px²; sempre em texto, ícones, charts, badges, ou borders/glows

### 2.3 Espaçamento

```css
/* Container */
--container-max: 1280px;
--container-px:  clamp(1rem, 0.5rem + 2vw, 2.5rem);

/* Vertical rhythm */
--section-py:    clamp(4rem, 2rem + 8vw, 8rem);   /* 64 → 128px */
--block-gap:     clamp(2rem, 1rem + 2vw, 4rem);
--card-gap:      1.5rem;
--card-px:       clamp(1.25rem, 1rem + 1vw, 2rem);
```

### 2.4 Sombras e bordas

```css
--shadow-sm:     0 1px 2px rgba(0,0,0,0.04);
--shadow-md:     0 4px 12px rgba(0,0,0,0.06);
--shadow-lg:     0 8px 24px rgba(0,0,0,0.08);
--shadow-glow:   0 0 60px rgba(110, 86, 207, 0.25);
--radius-card:   1.5rem;     /* 24px */
--radius-pill:   9999px;
```

### 2.5 Easing & duração

```css
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);     /* hero entrance */
--ease-inout:  cubic-bezier(0.4, 0, 0.2, 1);      /* default */
--ease-snap:   cubic-bezier(0.34, 1.56, 0.64, 1); /* button press */

--dur-fast:    180ms;
--dur-base:    320ms;
--dur-slow:    600ms;
--dur-narr:    1200ms;  /* hero/scroll */
```

---

## 3. PADRÕES DE SEÇÃO (em ordem narrativa)

| # | Seção | Função | Animação core |
|---|---|---|---|
| 1 | **Nav sticky** | Marca + 3 links + CTA | Fundo opaco no scroll (`backdrop-blur(20px)`) |
| 2 | **Hero fullscreen** | Headline + tagline + produto | Parallax 0.3x no produto + fade-up na copy |
| 3 | **Highlights (5 cards)** | Resumo dos diferenciais | Fade-up stagger 100ms entre cards |
| 4 | **Product showcase** | Color swatches + mockup do app | Crossfade entre cores (300ms) |
| 5 | **Performance/Stats** | Números grandes + bar charts | Count-up ao entrar viewport + bar grow |
| 6 | **AI section** | Inteligência do produto | Pin + scrub: cards aparecem em sequência |
| 7 | **Continuity** | Como tudo se conecta | Carousel horizontal auto-play |
| 8 | **Comparison** | Singulare vs alternativa | Tabs interativas, scrub bar charts |
| 9 | **Pricing** | Planos | Card popular elevado (`scale 1.02 + glow`) |
| 10 | **CTA + Footer** | Conversão | Eyebrow + headline + 2 botões |

### 3.1 Hero (template)

```
[eyebrow uppercase 13px tracking +0.08em violeta]
[H1 hero 40-88px peso 700 tracking -0.03em duas linhas]
[lead 18-22px cinza muted, max-width 600px, centralizado]
[CTA primário (violeta sólido) + CTA secundário (link com seta)]
[mockup do app em perspective 3D, parallax suave]
```

### 3.2 Highlights (template)

```
[eyebrow] "Comece pelos diferenciais"
[H2] "Tudo o que sua clínica precisa. Em um lugar só."
[grid de 5 cards: 2 grandes + 3 médios em desktop, stack mobile]
  [card] [icon 48px] [title h3] [desc 1 linha] [link "saiba mais →"]
[stagger 100ms entre cards via whileInView]
```

### 3.3 Performance (template)

```
[fundo dark #000]
[chip-style image: gradiente violeta com glow + numero "M5" → "IA"]
[H2 light text] "IA que entende seus pacientes."
[grid de 3 stats: número 64-96px peso 700 + label 14px muted]
[bar charts horizontais: violeta sólido (Singulare) vs cinza (manual)]
```

---

## 4. INTERAÇÕES & MICRO-MOTION

```jsx
// Card hover (Framer Motion)
whileHover={{ y: -4, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}

// Button press
whileTap={{ scale: 0.97 }}

// Fade-in on scroll
initial={{ opacity: 0, y: 24 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: "-100px" }}
transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}

// Stagger container
initial="hidden"
whileInView="show"
variants={{ show: { transition: { staggerChildren: 0.1 } } }}

// Parallax product image
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
const y = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
```

**Reduced motion:** sempre respeitar `@media (prefers-reduced-motion: reduce)` zerando `transform` e reduzindo `duration` para 10ms.

---

## 5. IMAGERY GUIDELINES

| Tipo | Tratamento |
|---|---|
| **Mockup do app** | iPhone/iPad frame em perspective 3D suave, sombra grande embaixo, glow violeta no fundo |
| **Pessoas (profissionais saúde)** | Foto realista, fundo neutro/claro, sorriso natural, segurando celular ou laptop |
| **Ícones** | Lucide React, 24px, stroke-width 1.5, cor `--fg` ou `--accent` |
| **Backgrounds decorativos** | Radial gradient violeta blur(120px), opacidade 0.3, cantos da seção |
| **Charts** | Bar charts horizontais minimalistas, accent violeta sólido vs cinza `#D2D2D7` |

**Fontes de imagem para protótipo:** Unsplash via URL direta com query `?w=1600&auto=format&fit=crop`. Em produção, hospedar em CDN próprio.

---

## 6. ACESSIBILIDADE

- Contraste mínimo 7:1 em texto sobre fundo (`--fg` sobre `--bg` = 16:1 ✓)
- Foco visível: `outline: 2px solid var(--accent); outline-offset: 4px;`
- Touch targets ≥ 44×44px
- Respeitar `prefers-reduced-motion`
- Headings em ordem (h1 → h2 → h3, sem pular)
- Imagens com `alt` descritivo (não decorativo)

---

## 7. CHECKLIST DE APLICAÇÃO

Quando aplicar este prompt em uma página nova:

- [ ] Usar `var(--text-hero)` no H1, nunca número fixo
- [ ] Container `max-width: var(--container-max)` com px responsivo
- [ ] `section { padding-block: var(--section-py); }`
- [ ] Toda animação com `ease-out` ou `ease-inout`, nunca linear
- [ ] `whileInView` com `viewport={{ once: true, margin: "-100px" }}`
- [ ] Mockup com `perspective(1200px) rotateX(2deg)` + parallax
- [ ] Accent violeta apenas em texto, ícones, charts, badges
- [ ] Dark mode em seções de impacto (Hero/AI/Performance)
- [ ] Sticky nav com `backdrop-filter: blur(20px)` ao scrollar
- [ ] CTA final com 2 botões: primário sólido + secundário link
- [ ] `prefers-reduced-motion` respeitado em todo motion

---

## 8. PROMPT EXECUTÁVEL (cole isso pra IA gerar uma página nova)

```
Crie uma página Next.js 14 (App Router) + Tailwind + Framer Motion seguindo o "Singulare V2 — Apple Design System":

CONTEXTO: Singulare é um SaaS de IA no WhatsApp para clínicas de saúde (psicólogos, dentistas, nutricionistas). Marca: violeta #6E56CF. Tom Apple-style: bold minimalism, scroll-driven, calm motion.

REGRAS:
- Tipografia fluid com clamp(): hero 40→88px, h2 28→48px, body 16px. Tracking -0.03em em headings. Peso 600-700 em headlines, 400 em body.
- Cores: bg #FFFFFF, fg #1D1D1F, muted #6E6E73, accent violeta #6E56CF (apenas texto/ícones/charts), bg-elev #F5F5F7. Dark sections (#000) só em Hero/AI/Performance.
- Espaçamento: section-py clamp(64px, 128px), container-max 1280px, container-px clamp(16px, 40px).
- Animações: ease cubic-bezier(0.16,1,0.3,1), durations 600-1200ms em hero, 320ms em micro. Sempre via whileInView once:true margin:-100px. Stagger 100ms entre cards. Parallax 0.2-0.3x em produto.
- Mockup do produto: device em perspective(1200px) rotateX(2deg) com glow violeta blur(120px) opacity 0.3.
- Sticky nav: backdrop-blur(20px) só após 80px de scroll.
- CTA principal: fundo violeta, texto branco, radius pill, padding 16x32px. CTA secundário: link com seta →.
- Acessibilidade: contraste 7:1, prefers-reduced-motion, foco visível.

ESTRUTURA: Nav fixo + Hero fullscreen + Highlights (5 cards stagger) + Product Showcase (color swatches) + Performance (dark, bar charts) + AI Section (cards sequenciais) + Continuity (carousel) + Pricing + CTA Footer.

NÃO FAÇA:
- Cores accent em blocos sólidos grandes
- Animações com bounce/elástico
- Tipografia com tamanho fixo (sempre clamp)
- Headings curtos numa linha só (sempre 2 linhas)
- Mais de 5 features em destaque (cognitive load)
- Auto-play vídeos sem fallback
- Custom cursors sem mobile fallback
```
