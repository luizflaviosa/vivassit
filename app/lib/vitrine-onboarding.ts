// app/lib/vitrine-onboarding.ts
//
// Helpers compartilhados pra criar/atualizar vitrine_profiles a partir
// dos dados de onboarding. Slug determinístico + parser tosco de endereco
// (cidade/UF). Não tenta resolver casos complicados — o profissional ajusta
// no painel/vitrine se vier errado.

import type { SupabaseClient } from '@supabase/supabase-js';

export function slugifyVitrine(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// Tenta extrair cidade + UF de uma string livre. Aceita formatos comuns:
//   "Rua X, 123, Bairro, Sao Paulo - SP"
//   "Av. Y - Belo Horizonte, MG"
//   "Apenas Sao Paulo / SP"
// Se não conseguir, devolve { city: '', state: 'SP' }.
const UF_REGEX = /\b([A-Z]{2})\b\s*$/;
const KNOWN_UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

export function parseAddressForVitrine(addr?: string | null): { city: string; state: string } {
  const fallback = { city: '', state: 'SP' };
  if (!addr) return fallback;
  const raw = String(addr).trim();
  if (!raw) return fallback;

  const ufMatch = raw.toUpperCase().match(UF_REGEX);
  const state = ufMatch && KNOWN_UFS.has(ufMatch[1]) ? ufMatch[1] : 'SP';

  // Heurística pra cidade: pega o último segmento antes do UF (separado por
  // virgula, hífen ou barra), tirando virgulas/hifens isolados.
  const withoutUf = state && ufMatch
    ? raw.slice(0, raw.toUpperCase().lastIndexOf(state)).replace(/[\s,\-/]+$/, '')
    : raw;
  const parts = withoutUf.split(/[,/]| - /).map((p) => p.trim()).filter(Boolean);
  const city = parts.length ? parts[parts.length - 1] : '';

  return { city: city.slice(0, 80), state };
}

// Profissional types validos (alinhar com app/lib/types.ts).
const VALID_PROF_TYPES = new Set([
  'dentista','fisioterapeuta','fonoaudiologo','medico','nutricionista',
  'psicanalista','psicologo','terapeuta','enfermeiro','psicopedagogo',
  'saude_estetica','outro',
]);

export function normalizeProfessionalType(value?: string | null): string {
  if (!value) return 'medico';
  const v = String(value).toLowerCase().trim();
  return VALID_PROF_TYPES.has(v) ? v : 'medico';
}

// Garante slug único na tabela: se "joao-cardiologia-sao-paulo" já existe,
// tenta "...-2", "...-3" até achar livre (até 50 tentativas).
export async function ensureUniqueVitrineSlug(
  supabase: SupabaseClient,
  base: string,
): Promise<string> {
  const baseSlug = base || `profissional-${Date.now().toString(36)}`;
  let candidate = baseSlug;
  for (let i = 2; i <= 50; i++) {
    const { data, error } = await supabase
      .from('vitrine_profiles')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) {
      // Em caso de erro do supabase, prefere falhar abrindo um sufixo timestamp
      return `${baseSlug}-${Date.now().toString(36)}`;
    }
    if (!data) return candidate;
    candidate = `${baseSlug}-${i}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}
