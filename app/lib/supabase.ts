import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-side client com service_role: bypassa RLS, uso APENAS em rotas /api.
// Nunca importar este client em codigo client-side ('use client').

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('SUPABASE_URL nao configurada');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada');

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// Tabela de precos do plano SaaS Singulare
// Planos ativos: professional (197), enterprise (397), sob_medida (proposta)
// Legados mantidos para orders antigos: basic, premium, enterprise_plus
export const SAAS_PLAN_AMOUNTS: Record<string, number> = {
  basic: 97,
  professional: 197,
  premium: 297,
  enterprise: 397,
  enterprise_plus: 597,
  sob_medida: 0, // proposta personalizada — preço definido manualmente
};

// Add-on Singulare Atendimento (atendimento humano sob demanda).
// Soma R$ 297 ao total mensal em planos normais.
// Em sob_medida: cobrança via avaliação caso a caso → preço NÃO somado, vai
// junto na proposta personalizada da equipe comercial.
export const ADDON_HUMAN_SUPPORT_PRICE = 297;

// Trial padrao (em dias)
export const TRIAL_DAYS = 7;

// Marketing add-on pricing
export { MARKETING_PLAN_AMOUNTS } from './marketing-types';
