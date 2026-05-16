// Brand tokens — Luxury Modular Intelligence v1.0
// Paleta minimalista navy/gold/sand pra paginas /v3 do Singulare.

export const BRAND_COLORS = {
  navy: '#0F1B33',
  gold: '#FFC62F',
  sand: '#F4EFE6',
  sky: '#BFD0E3',
  sage: '#B7C8B8',
  coral: '#FF8A80',
  graphite: '#1F1F1F',
} as const;

export type BrandColor = keyof typeof BRAND_COLORS;

// Tipografia — Poppins pra titulos/eyebrows (peso bold/letter-spacing wide),
// Space Grotesk pra corpo. Expostas via CSS vars no layout v3.
export const BRAND_FONTS = {
  display: 'var(--font-poppins), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  body: 'var(--font-space-grotesk), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
} as const;

// Tracking padrao (letter-spacing) por contexto — sempre uppercase quando aplicado.
export const BRAND_TRACKING = {
  eyebrow: '0.28em',
  wordmark: '0.32em',
  pill: '0.18em',
  progress: '0.22em',
} as const;

// Microcopy institucional (CNPJ, razao social) reusado em footer.
export const BRAND_LEGAL = {
  razaoSocial: 'MEDICAL SAO PAULO SERVICOS MEDICOS LTDA',
  cnpj: '20.247.908/0001-01',
  cidade: 'Jundiaí',
  uf: 'SP',
  email: 'contato@singulare.org',
  telefone: '(17) 3305-9030',
} as const;
