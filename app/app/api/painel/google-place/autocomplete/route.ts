/**
 * GET /api/painel/google-place/autocomplete?q=<query>
 *
 * Type-ahead pra escolher Google Place ID — usuario digita o nome do negocio,
 * Google sugere lugares (igual a barra do Maps). Substitui o fluxo antigo de
 * "tentar achar na heuristica" que falhava quando endereco/dados batiam mal.
 *
 * Provider: Google Place Autocomplete (legacy v1) — limitado a Brasil e a
 * estabelecimentos. Custo: $0.00283/request (sem session token nesse design
 * porque nao chamamos Place Details depois — o autocomplete ja devolve place_id).
 *
 * Response:
 *   { predictions: [{ place_id, description, main_text, secondary_text }] }
 *
 * Setup: GOOGLE_PLACES_API_KEY no Vercel (mesma key do lookup antigo).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawPrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'no_api_key', message: 'Places API nao configurada.' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';

  // Minimo 2 chars pra evitar custo desnecessario
  if (q.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const apiUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  apiUrl.searchParams.set('input', q);
  apiUrl.searchParams.set('types', 'establishment');
  apiUrl.searchParams.set('components', 'country:br');
  apiUrl.searchParams.set('language', 'pt-BR');
  apiUrl.searchParams.set('key', apiKey);

  const res = await fetch(apiUrl.toString(), { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: 'api_error', message: `Places API ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    status: string;
    predictions?: RawPrediction[];
    error_message?: string;
  };

  if (data.status === 'ZERO_RESULTS') {
    return NextResponse.json({ predictions: [] });
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

  const predictions = (data.predictions ?? []).slice(0, 8).map((p) => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting?.main_text ?? p.description,
    secondary_text: p.structured_formatting?.secondary_text ?? '',
  }));

  return NextResponse.json({ predictions });
}
