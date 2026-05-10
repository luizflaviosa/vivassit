/**
 * POST /api/painel/google-place/lookup
 *
 * Busca o Google Place ID da clínica automaticamente via Google Places API,
 * combinando dados do tenant (clinic_name, doctor_name, address, city).
 *
 * Removes a fricção de "abrir Place ID Finder, achar pin, copiar ID" da
 * configuração inicial. Usuário só clica "Buscar automaticamente" em
 * /painel/configuracoes.
 *
 * Body opcional:
 *   { query?: string }  // sobrescreve a query padrão (clinic+address)
 *
 * Response:
 *   - { ok: true, found: true, place: { place_id, name, address, rating } }
 *   - { ok: true, found: false, message, suggestions: [{name, address, place_id}] }
 *   - { ok: false, error: 'no_api_key' | 'no_address' | 'api_error' }
 *
 * Setup necessário (1x na vida):
 *   1. https://console.cloud.google.com/apis/library/places-backend.googleapis.com
 *      → Enable Places API (New) — projeto grand-quarter-462319-i7
 *   2. https://console.cloud.google.com/apis/credentials
 *      → Create credentials → API Key → restrinja pra Places API
 *   3. Vercel env var: GOOGLE_PLACES_API_KEY = <a key gerada>
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlaceCandidate {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_api_key',
        message:
          'Places API não configurada. Adicione GOOGLE_PLACES_API_KEY no Vercel. Doc: app/docs/GOOGLE-PLACES-SETUP.md',
      },
      { status: 503 },
    );
  }

  // Pega contexto do tenant pra montar query
  const supabase = supabaseAdmin();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('clinic_name, doctor_name, speciality, address, city, state, phone, real_phone')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle<{
      clinic_name: string | null;
      doctor_name: string | null;
      speciality: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      phone: string | null;
      real_phone: string | null;
    }>();

  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'tenant_not_found' }, { status: 404 });
  }

  let body: { query?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  // Query default: prioriza nome do médico (mais específico que da clínica),
  // depois especialidade, depois localização. Trim duplicatas.
  const parts = [
    body.query?.trim(),
    tenant.doctor_name,
    tenant.clinic_name,
    tenant.speciality,
    tenant.address,
    tenant.city,
    tenant.state,
  ]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .map((s) => s.trim());

  // Dedupe substrings (ex: address já contém city)
  const seen = new Set<string>();
  const uniqueParts: string[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!Array.from(seen).some((s) => s.includes(lower) || lower.includes(s))) {
      seen.add(lower);
      uniqueParts.push(p);
    }
  }

  const query = uniqueParts.join(' ');
  if (!query.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_query',
        message: 'Sem dados pra buscar. Preencha pelo menos nome + endereço da clínica.',
      },
      { status: 400 },
    );
  }

  // Chama Places API "Find Place from Text" — barato (~$0.017 por chamada)
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id,name,formatted_address,rating,user_ratings_total,business_status');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('locationbias', 'ipbias');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[google-place/lookup] Places API erro', res.status, txt.slice(0, 200));
    return NextResponse.json(
      { ok: false, error: 'api_error', message: `Places API ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    status: string;
    candidates?: PlaceCandidate[];
    error_message?: string;
  };

  if (data.status === 'ZERO_RESULTS' || !data.candidates?.length) {
    // Tenta fallback: query mais ampla só com doctor_name + city
    if (tenant.doctor_name && tenant.city && !body.query) {
      const fallbackQuery = `${tenant.doctor_name} ${tenant.city}`;
      const fbUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
      fbUrl.searchParams.set('input', fallbackQuery);
      fbUrl.searchParams.set('inputtype', 'textquery');
      fbUrl.searchParams.set('fields', 'place_id,name,formatted_address,rating,user_ratings_total,business_status');
      fbUrl.searchParams.set('language', 'pt-BR');
      fbUrl.searchParams.set('key', apiKey);
      const fbRes = await fetch(fbUrl.toString(), { cache: 'no-store' });
      const fbData = (await fbRes.json()) as { candidates?: PlaceCandidate[] };
      if (fbData.candidates?.length) {
        return NextResponse.json({
          ok: true,
          found: true,
          place: fbData.candidates[0],
          query: fallbackQuery,
          fallback: true,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      found: false,
      query,
      message:
        'Não achamos perfil do Google Meu Negócio com esses dados. Você pode criar grátis em business.google.com — leva 5min de cadastro + 5-7 dias pra Google verificar (carta postal).',
      create_url: 'https://business.google.com/create',
    });
  }

  if (data.status !== 'OK') {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_error',
        message: data.error_message ?? `Places API status=${data.status}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    found: true,
    place: data.candidates[0],
    query,
  });
}
