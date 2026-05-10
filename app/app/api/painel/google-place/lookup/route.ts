/**
 * POST /api/painel/google-place/lookup
 *
 * Busca o Google Place ID da clínica via Google Places API com cascata de
 * queries (mais específica → mais ampla) usando Text Search, que é mais
 * tolerante a query "humana" que findplacefromtext.
 *
 * Estratégia (em ordem):
 *   1. Query custom do usuário (body.query), se houver
 *   2. doctor_name + speciality + city  (alinhado com nome típico no GMN:
 *      "Dr. Fulano | Cardiologia")
 *   3. clinic_name + city                (se clinic_name existir)
 *   4. doctor_name + city                (sem speciality)
 *   5. doctor_name                       (último recurso)
 *
 * Endereço NÃO entra na query — é a fonte mais frequente de mismatch (o que
 * está cadastrado no painel raramente bate com o pin do GMN).
 *
 * Devolve até 5 candidatos pra UI escolher quando há ambiguidade.
 *
 * Body opcional:
 *   { query?: string }  // sobrescreve a query padrão
 *
 * Response:
 *   - { ok: true, found: true, place: <melhor>, candidates: [...], query }
 *   - { ok: true, found: false, message, create_url, queries_tried: [...] }
 *   - { ok: false, error: 'no_api_key' | 'no_query' | 'api_error' }
 *
 * Setup necessário (1x na vida):
 *   1. Enable Places API em https://console.cloud.google.com/apis/library/places-backend.googleapis.com
 *   2. Vercel env var: GOOGLE_PLACES_API_KEY
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

function stripDoctorPrefix(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/^(Dra?\.?|Doutora?|Dr\.?)\s*\.?\s*/i, '').trim();
}

async function textSearch(apiKey: string, query: string): Promise<PlaceCandidate[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('region', 'br');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      place_id: string;
      name: string;
      formatted_address: string;
      rating?: number;
      user_ratings_total?: number;
      business_status?: string;
    }>;
    error_message?: string;
  };

  if (data.status !== 'OK' || !data.results) return [];

  return data.results.slice(0, 5).map(r => ({
    place_id: r.place_id,
    name: r.name,
    formatted_address: r.formatted_address,
    rating: r.rating,
    user_ratings_total: r.user_ratings_total,
    business_status: r.business_status,
  }));
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
        message: 'Places API não configurada. Adicione GOOGLE_PLACES_API_KEY no Vercel.',
      },
      { status: 503 },
    );
  }

  const supabase = supabaseAdmin();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('clinic_name, doctor_name, speciality, city, state')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle<{
      clinic_name: string | null;
      doctor_name: string | null;
      speciality: string | null;
      city: string | null;
      state: string | null;
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

  const doctorClean = stripDoctorPrefix(tenant.doctor_name);
  const clinicClean = (tenant.clinic_name ?? '').trim();
  const speciality = (tenant.speciality ?? '').trim();
  const city = (tenant.city ?? '').trim();

  // Cascata de queries — mais específica → mais ampla.
  // Endereço fica de fora intencionalmente (raramente bate com pin do GMN).
  const queries: string[] = [];
  if (body.query?.trim()) queries.push(body.query.trim());
  if (doctorClean && speciality && city) queries.push(`${doctorClean} ${speciality} ${city}`);
  if (clinicClean && city && clinicClean.toLowerCase() !== doctorClean.toLowerCase()) {
    queries.push(`${clinicClean} ${city}`);
  }
  if (doctorClean && city) queries.push(`${doctorClean} ${city}`);
  if (doctorClean) queries.push(doctorClean);

  // Dedupe preservando ordem
  const seen = new Set<string>();
  const uniqueQueries = queries.filter(q => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueQueries.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_query',
        message: 'Sem dados pra buscar. Preencha pelo menos nome do médico + cidade.',
      },
      { status: 400 },
    );
  }

  // Roda em cascata. Para na primeira que devolve resultado válido,
  // mas acumula candidatos das primeiras 2 tentativas pra dar opções
  // ao usuário quando o match não é óbvio.
  const candidates: PlaceCandidate[] = [];
  const placeIdSeen = new Set<string>();
  const queriesTried: string[] = [];

  for (const q of uniqueQueries) {
    queriesTried.push(q);
    const found = await textSearch(apiKey, q);
    for (const c of found) {
      if (!placeIdSeen.has(c.place_id)) {
        placeIdSeen.add(c.place_id);
        candidates.push(c);
      }
    }
    // Para cedo se já achamos pelo menos 1 candidato + tentamos 2 queries
    if (candidates.length > 0 && queriesTried.length >= 2) break;
    // Ou se já temos 5+ candidatos
    if (candidates.length >= 5) break;
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      found: false,
      queries_tried: queriesTried,
      message:
        'Não achamos perfil do Google Meu Negócio com esses dados. Tente buscar com outro termo (ex: nome exato do listing) ou crie grátis em business.google.com — leva 5min de cadastro + 5-7 dias pra Google verificar (carta postal).',
      create_url: 'https://business.google.com/create',
    });
  }

  // Ranking: candidatos cujo nome contém doctorClean (ou substring significativa)
  // ficam acima. Empate desempata por user_ratings_total.
  const doctorLower = doctorClean.toLowerCase();
  const ranked = candidates.slice().sort((a, b) => {
    const aMatch = doctorLower && a.name.toLowerCase().includes(doctorLower) ? 1 : 0;
    const bMatch = doctorLower && b.name.toLowerCase().includes(doctorLower) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0);
  });

  return NextResponse.json({
    ok: true,
    found: true,
    place: ranked[0],
    candidates: ranked.slice(0, 5),
    query: queriesTried[0],
    queries_tried: queriesTried,
  });
}
